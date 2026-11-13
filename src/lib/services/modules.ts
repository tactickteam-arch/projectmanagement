import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { diff, logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { AppError, badRequest, forbidden, notFound } from "@/lib/errors";
import { approvalAfterSave, canBeApproved, checkModuleRules, detailsSchema } from "@/lib/module-rules";
import { hqRecipients, notifyUsers } from "@/lib/notify";
import { getStoreForUser, recalcStoreStatus } from "@/lib/services/stores";
import { MODULE_STATUS_LABELS } from "@/lib/status";
import type { FieldDef } from "@/modules/types";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .nullable()
  .optional()
  .transform((v) => (v ? parseDateOnly(v) : v === null ? null : undefined));
const money = z.number().min(0, "Cost cannot be negative").max(1e11).nullable().optional();
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

export const UpdateModuleInput = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"]).optional(),
  blockerReason: text(1000),
  plannedStart: date,
  plannedEnd: date,
  actualStart: date,
  actualEnd: date,
  vendorName: text(120),
  vendorPhone: text(30),
  estCost: money,
  actualCost: money,
  remarks: text(4000),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** Loads a store module by store + type, after the store access check. */
export async function getModuleByType(user: CurrentUser, storeId: string, moduleType: string) {
  const store = await getStoreForUser(user, storeId);
  const mod = await prisma.storeModule.findUnique({ where: { storeId_moduleType: { storeId, moduleType } } });
  if (!mod) throw notFound("Module not found");
  return { store, mod };
}

/** Loads a store module by id, after the store access check. */
export async function getModuleById(user: CurrentUser, moduleId: string) {
  const mod = await prisma.storeModule.findUnique({ where: { id: moduleId } });
  if (!mod) throw notFound("Module not found");
  const store = await getStoreForUser(user, mod.storeId);
  return { store, mod };
}

export async function countCountingPhotos(storeModuleId: string, photoTag: string | null): Promise<number> {
  return prisma.attachment.count({
    where: { storeModuleId, fileType: { startsWith: "image/" }, ...(photoTag ? { tag: photoTag } : {}) },
  });
}

/** PATCH /api/stores/:id/modules/:moduleType — owner updates common + specific fields. */
export async function updateModule(user: CurrentUser, storeId: string, moduleType: string, raw: unknown) {
  const { store, mod } = await getModuleByType(user, storeId, moduleType);
  if (!can.editModules(user, store)) throw forbidden("Only the store owner can update modules.");
  const input = UpdateModuleInput.parse(raw);
  const template = await prisma.moduleTemplate.findUniqueOrThrow({ where: { moduleType } });

  let details: Record<string, unknown> | undefined;
  if (input.details) {
    const parsed = detailsSchema(template.fieldSchema as unknown as FieldDef[]).safeParse(input.details);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[`details.${issue.path.join(".")}`] = issue.message;
      throw badRequest("Some fields are not valid.", fieldErrors);
    }
    details = parsed.data;
  }

  const pick = <T>(v: T | undefined, cur: T) => (v === undefined ? cur : v);
  const next = {
    status: input.status ?? mod.status,
    blockerReason: pick(input.blockerReason, mod.blockerReason),
    plannedStart: pick(input.plannedStart, mod.plannedStart),
    plannedEnd: pick(input.plannedEnd, mod.plannedEnd),
    actualStart: pick(input.actualStart, mod.actualStart),
    actualEnd: pick(input.actualEnd, mod.actualEnd),
  };
  if (next.status !== "BLOCKED") next.blockerReason = null;

  const errors = checkModuleRules({
    moduleType,
    current: mod,
    next,
    storeHasKeyHandover: store.keyHandoverDate !== null,
    photoCount: next.status === "COMPLETED" ? await countCountingPhotos(mod.id, template.photoTag) : 0,
    minPhotos: template.minPhotos,
  });
  if (Object.keys(errors).length) throw new AppError(400, Object.values(errors)[0], errors);

  const approval = approvalAfterSave(mod, next.status);
  const data: Prisma.StoreModuleUpdateInput = {
    ...next,
    vendorName: pick(input.vendorName, mod.vendorName),
    vendorPhone: pick(input.vendorPhone, mod.vendorPhone),
    estCost: pick(input.estCost, mod.estCost === null ? null : Number(mod.estCost)),
    actualCost: pick(input.actualCost, mod.actualCost === null ? null : Number(mod.actualCost)),
    remarks: pick(input.remarks, mod.remarks),
    ...(details ? { details: details as Prisma.InputJsonObject } : {}),
    approvalStatus: approval.approvalStatus,
    ...(approval.submitted ? { completedAt: new Date(), approvalComment: null, approvedBy: { disconnect: true }, approvedAt: null } : {}),
    updatedBy: { connect: { id: user.id } },
  };

  return prisma.$transaction(async (tx) => {
    const updated = await tx.storeModule.update({ where: { id: mod.id }, data });
    const before = { ...mod, details: mod.details } as unknown as Record<string, unknown>;
    const afterView = { ...next, vendorName: data.vendorName, vendorPhone: data.vendorPhone, estCost: data.estCost, actualCost: data.actualCost, remarks: data.remarks, ...(details ? { details } : {}) };
    const d = diff(before, afterView as Record<string, unknown>);
    if (d) await logActivity(tx, { userId: user.id, storeId, storeModuleId: mod.id, action: "module.updated", ...d });

    const label = template.displayName;
    if (next.status !== mod.status) {
      if (next.status === "COMPLETED") {
        await notifyUsers(tx, await hqRecipients(tx, store.state), {
          type: "module_completed",
          message: `${store.name}: ${label} marked Completed — waiting for HQ approval.`,
          storeId,
          storeModuleId: mod.id,
        });
      } else if (next.status === "BLOCKED") {
        await notifyUsers(tx, await hqRecipients(tx, store.state), {
          type: "module_blocked",
          message: `${store.name}: ${label} is Blocked — ${next.blockerReason}`,
          storeId,
          storeModuleId: mod.id,
        });
      }
    }
    await recalcStoreStatus(tx, storeId, user.id);
    return updated;
  });
}

/** POST /api/modules/:id/approve and /reject — HQ decision. Reject needs a comment. */
export const DecisionInput = z.object({ comment: z.string().trim().max(2000).optional().nullable() });

export async function decideModule(user: CurrentUser, moduleId: string, decision: "approve" | "reject", raw: unknown) {
  const { store, mod } = await getModuleById(user, moduleId);
  if (!can.approveModules(user, store)) throw forbidden("Only HQ can approve or reject modules.");
  if (!canBeApproved(mod)) {
    throw badRequest(`Only modules marked Completed and waiting for approval can be ${decision === "approve" ? "approved" : "rejected"} (this one is ${MODULE_STATUS_LABELS[mod.status]}).`);
  }
  const { comment } = DecisionInput.parse(raw ?? {});
  if (decision === "reject" && !comment) throw badRequest("Add a comment explaining what needs to change.", { comment: "Required when rejecting" });

  const template = await prisma.moduleTemplate.findUniqueOrThrow({ where: { moduleType: mod.moduleType } });
  return prisma.$transaction(async (tx) => {
    await tx.storeModule.update({
      where: { id: mod.id },
      data:
        decision === "approve"
          ? { approvalStatus: "APPROVED", approvedById: user.id, approvedAt: new Date(), approvalComment: comment || null }
          : // Spec: a rejected module goes back to In Progress, with HQ's comment shown to the owner.
            { approvalStatus: "REJECTED", status: "IN_PROGRESS", approvedById: user.id, approvedAt: new Date(), approvalComment: comment },
    });
    await logActivity(tx, {
      userId: user.id,
      storeId: store.id,
      storeModuleId: mod.id,
      action: decision === "approve" ? "module.approved" : "module.rejected",
      newValue: { comment: comment || null },
    });
    await notifyUsers(tx, [store.ownerId], {
      type: decision === "approve" ? "module_approved" : "module_rejected",
      message:
        decision === "approve"
          ? `${store.name}: ${template.displayName} was approved by HQ.`
          : `${store.name}: ${template.displayName} was rejected by HQ — ${comment}`,
      storeId: store.id,
      storeModuleId: mod.id,
    });
    await recalcStoreStatus(tx, store.id, user.id);
  });
}
