import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { diff, logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { addDays, formatDateOnly, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { approvalAfterSave, canBeApproved, checkModuleRules, detailsSchema, missingPrerequisites } from "@/lib/module-rules";
import { hqRecipients, notifyUsers, teamRecipients, teamRecipientsFor } from "@/lib/notify";
import { planModulesFromHandover } from "@/lib/scheduling";
import { getStoreForUser, recalcStoreStatus } from "@/lib/services/stores";
import { getTargetLaunchOffsetDays } from "@/lib/settings";
import { isApproved, MODULE_STATUS_LABELS } from "@/lib/status";
import { teamLabel, teamsLabel } from "@/lib/teams";
import { getModuleDefinition, KEY_HANDOVER, MODULE_DEFINITIONS, SETUP_TRACK_TYPES } from "@/modules";
import type { FieldDef } from "@/modules/types";

type Tx = Prisma.TransactionClient;
type StoreRow = { id: string; name: string; storeCode: string; state: string; ownerId: string; keyHandoverDate: Date | null; targetLaunchDate: Date | null };

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

/** Loads a store step by store + type, after the store access check. */
export async function getModuleByType(user: CurrentUser, storeId: string, moduleType: string) {
  const store = await getStoreForUser(user, storeId);
  const mod = await prisma.storeModule.findUnique({ where: { storeId_moduleType: { storeId, moduleType } } });
  if (!mod) throw notFound("Step not found");
  return { store, mod };
}

/** Loads a store step by id, after the store access check. */
export async function getModuleById(user: CurrentUser, moduleId: string) {
  const mod = await prisma.storeModule.findUnique({ where: { id: moduleId } });
  if (!mod) throw notFound("Step not found");
  const store = await getStoreForUser(user, mod.storeId);
  return { store, mod };
}

export async function countCountingPhotos(storeModuleId: string, photoTag: string | null): Promise<number> {
  return prisma.attachment.count({
    where: { storeModuleId, fileType: { startsWith: "image/" }, ...(photoTag ? { tag: photoTag } : {}) },
  });
}

async function templateFor(moduleType: string) {
  const t = await prisma.moduleTemplate.findUnique({ where: { moduleType } });
  if (!t) throw notFound("Step not found");
  return t;
}

export async function displayNames(): Promise<Record<string, string>> {
  const rows = await prisma.moduleTemplate.findMany({ select: { moduleType: true, displayName: true } });
  return Object.fromEntries(rows.map((r) => [r.moduleType, r.displayName]));
}

const whoCanEdit = (editTeams: string[]) => (editTeams.length ? teamsLabel(editTeams) : "HQ");

/** PATCH /api/stores/:id/modules/:moduleType — the step's team updates common + specific fields. */
export async function updateModule(user: CurrentUser, storeId: string, moduleType: string, raw: unknown) {
  const { store, mod } = await getModuleByType(user, storeId, moduleType);
  const template = await templateFor(moduleType);
  if (!can.editModule(user, store, template)) throw forbidden(`Only ${whoCanEdit(template.editTeams)} can update this step.`);
  const input = UpdateModuleInput.parse(raw);
  const fields = template.fieldSchema as unknown as FieldDef[];

  let details: Record<string, unknown> | undefined;
  if (input.details) {
    const parsed = detailsSchema(fields).safeParse(input.details);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[`details.${issue.path.join(".")}`] = issue.message;
      throw badRequest("Some fields are not valid.", fieldErrors);
    }
    details = { ...((mod.details ?? {}) as Record<string, unknown>), ...parsed.data };
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

  const siblings = await prisma.storeModule.findMany({ where: { storeId }, select: { moduleType: true, status: true, approvalStatus: true } });
  const names = await displayNames();
  const errors = checkModuleRules({
    moduleType,
    current: mod,
    next,
    missingPrerequisites: missingPrerequisites(moduleType, siblings).map((t) => names[t] ?? t),
    photoCount: next.status === "COMPLETED" ? await countCountingPhotos(mod.id, template.photoTag) : 0,
    minPhotos: template.minPhotos,
    fields,
    details: details ?? ((mod.details ?? {}) as Record<string, unknown>),
  });
  if (Object.keys(errors).length) {
    const message = errors.status ?? errors.tasks ?? errors.photos ?? Object.values(errors)[0];
    throw new AppError(400, message, errors);
  }

  const approval = approvalAfterSave(mod, next.status, template.approverTeam !== null);
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
    ...(approval.autoApproved ? { approvedBy: { connect: { id: user.id } }, approvedAt: new Date() } : {}),
    updatedBy: { connect: { id: user.id } },
  };

  return prisma.$transaction(async (tx) => {
    const updated = await tx.storeModule.update({ where: { id: mod.id }, data });
    const before = { ...mod, details: mod.details } as unknown as Record<string, unknown>;
    const afterView = { ...next, vendorName: data.vendorName, vendorPhone: data.vendorPhone, estCost: data.estCost, actualCost: data.actualCost, remarks: data.remarks, ...(details ? { details: data.details } : {}) };
    const d = diff(before, afterView as Record<string, unknown>);
    if (d) await logActivity(tx, { userId: user.id, storeId, storeModuleId: mod.id, action: "module.updated", ...d });

    const label = template.displayName;
    if (next.status !== mod.status) {
      if (next.status === "COMPLETED" && template.approverTeam) {
        const recipients = [...(await teamRecipients(tx, store, [template.approverTeam])), ...(await hqRecipients(tx, store.state, { includeRegional: false }))];
        await notifyUsers(tx, recipients.filter((id) => id !== user.id), {
          type: "module_completed",
          message: `${store.name}: ${label} marked Completed — waiting for ${teamLabel(template.approverTeam)} approval.`,
          storeId,
          storeModuleId: mod.id,
        });
      } else if (next.status === "COMPLETED") {
        await logActivity(tx, { userId: user.id, storeId, storeModuleId: mod.id, action: "module.done", newValue: { by: teamsLabel(template.editTeams) } });
        await notifyUsers(tx, (await hqRecipients(tx, store.state)).filter((id) => id !== user.id), {
          type: "module_done",
          message: `${store.name}: ${label} is done (green).`,
          storeId,
          storeModuleId: mod.id,
        });
        await afterStepDone(tx, store, moduleType, user.id);
      } else if (next.status === "BLOCKED") {
        await notifyUsers(tx, (await hqRecipients(tx, store.state)).filter((id) => id !== user.id), {
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

/** POST /api/modules/:id/approve and /reject — decision by the step's approver team (or HQ). Reject needs a comment. */
export const DecisionInput = z.object({ comment: z.string().trim().max(2000).optional().nullable() });

export async function decideModule(user: CurrentUser, moduleId: string, decision: "approve" | "reject", raw: unknown) {
  const { store, mod } = await getModuleById(user, moduleId);
  const template = await templateFor(mod.moduleType);
  if (!can.approveModule(user, store, template)) {
    throw forbidden(template.approverTeam ? `Only ${teamLabel(template.approverTeam)} (or HQ) can approve this step.` : "This step has no approver; its team marks it done.");
  }
  if (!canBeApproved(mod)) {
    throw badRequest(`Only steps marked Completed and waiting for approval can be ${decision === "approve" ? "approved" : "rejected"} (this one is ${MODULE_STATUS_LABELS[mod.status]}).`);
  }
  const { comment } = DecisionInput.parse(raw ?? {});
  if (decision === "reject" && !comment) throw badRequest("Add a comment explaining what needs to change.", { comment: "Required when rejecting" });

  // Accepting the key handover needs the handover date: it becomes Day 0 for the setup tracks.
  const details = (mod.details ?? {}) as Record<string, unknown>;
  if (decision === "approve" && mod.moduleType === KEY_HANDOVER && typeof details.handoverDate !== "string") {
    throw badRequest("The handover date is missing. Reject the step so the handover date can be entered.");
  }

  const approver = template.approverTeam ? teamLabel(template.approverTeam) : "HQ";
  return prisma.$transaction(async (tx) => {
    await tx.storeModule.update({
      where: { id: mod.id },
      data:
        decision === "approve"
          ? { approvalStatus: "APPROVED", approvedById: user.id, approvedAt: new Date(), approvalComment: comment || null }
          : // A rejected step goes back to In Progress, with the approver's comment shown to its team.
            { approvalStatus: "REJECTED", status: "IN_PROGRESS", approvedById: user.id, approvedAt: new Date(), approvalComment: comment },
    });
    await logActivity(tx, {
      userId: user.id,
      storeId: store.id,
      storeModuleId: mod.id,
      action: decision === "approve" ? "module.approved" : "module.rejected",
      newValue: { comment: comment || null, as: approver },
    });
    const editors = await teamRecipients(tx, store, [...template.editTeams, "STORE_OWNER"]);
    await notifyUsers(tx, editors.filter((id) => id !== user.id), {
      type: decision === "approve" ? "module_approved" : "module_rejected",
      message:
        decision === "approve"
          ? `${store.name}: ${template.displayName} was approved by ${approver}.`
          : `${store.name}: ${template.displayName} was sent back by ${approver} — ${comment}`,
      storeId: store.id,
      storeModuleId: mod.id,
    });
    if (decision === "approve") await afterStepDone(tx, store, mod.moduleType, user.id);
    await recalcStoreStatus(tx, store.id, user.id);
  });
}

/**
 * What the system does when a step is done (approved, or marked green by its team):
 *  - Key received: the handover date becomes Day 0 — department tracks are scheduled from it,
 *    the target launch is set if empty, and every department is notified to start step 6.
 *  - Token advance: Accounts / Purchase are asked to raise the PO in APX.
 *  - Any step: teams of the steps that can now start are told so.
 */
async function afterStepDone(tx: Tx, store: StoreRow, moduleType: string, userId: string) {
  const modules = await tx.storeModule.findMany({ where: { storeId: store.id } });
  const templates = await tx.moduleTemplate.findMany();
  const tpl = (t: string) => templates.find((x) => x.moduleType === t);
  const def = getModuleDefinition(moduleType);

  if (moduleType === KEY_HANDOVER) {
    const handover = modules.find((m) => m.moduleType === KEY_HANDOVER);
    const raw = (handover?.details as Record<string, unknown> | null)?.handoverDate;
    if (typeof raw === "string") {
      const day0 = parseDateOnly(raw);
      const offset = await getTargetLaunchOffsetDays(tx);
      await tx.store.update({
        where: { id: store.id },
        data: { keyHandoverDate: day0, ...(store.targetLaunchDate ? {} : { targetLaunchDate: addDays(day0, offset) }) },
      });
      const plan = planModulesFromHandover(day0, templates);
      for (const p of plan) {
        const m = modules.find((x) => x.moduleType === p.moduleType);
        if (m && m.status === "NOT_STARTED") await tx.storeModule.update({ where: { id: m.id }, data: { plannedStart: p.plannedStart, plannedEnd: p.plannedEnd } });
      }
      await logActivity(tx, { userId, storeId: store.id, storeModuleId: handover?.id, action: "key_handover.accepted", newValue: { keyHandoverDate: raw } });
      const trackTemplates = SETUP_TRACK_TYPES.map(tpl).filter((t) => t !== undefined);
      const recipients = await teamRecipientsFor(tx, store, trackTemplates.flatMap((t) => t.editTeams));
      const notes: Prisma.NotificationCreateManyInput[] = [];
      for (const template of trackTemplates) {
        const m = modules.find((x) => x.moduleType === template.moduleType);
        const p = plan.find((x) => x.moduleType === template.moduleType);
        if (!m || m.status !== "NOT_STARTED") continue;
        const message = `${store.name}: keys received on ${formatDate(raw)} — start ${template.displayName} (step 6)${p ? `, planned ${formatDate(formatDateOnly(p.plannedStart))} – ${formatDate(formatDateOnly(p.plannedEnd))}` : ""}.`;
        for (const id of new Set(recipients(template.editTeams))) {
          if (id !== userId) notes.push({ userId: id, type: "setup_start", message, storeId: store.id, storeModuleId: m.id });
        }
      }
      if (notes.length) await tx.notification.createMany({ data: notes });
    }
  }

  if (def?.afterApproval) {
    const m = modules.find((x) => x.moduleType === moduleType);
    await notifyUsers(tx, (await teamRecipients(tx, store, def.afterApproval.teams)).filter((id) => id !== userId), {
      type: "after_approval",
      message: `${store.name}: ${def.displayName} approved — ${def.afterApproval.pendingText.replace(/^After approval:\s*/i, "")} and record the ${def.afterApproval.label}.`,
      storeId: store.id,
      storeModuleId: m?.id,
    });
  }

  // Steps unlocked by this one (department tracks were already told above).
  for (const next of MODULE_DEFINITIONS) {
    if (!next.requires.includes(moduleType) || (moduleType === KEY_HANDOVER && SETUP_TRACK_TYPES.includes(next.moduleType))) continue;
    const m = modules.find((x) => x.moduleType === next.moduleType);
    const template = tpl(next.moduleType);
    if (!m || !template || m.status !== "NOT_STARTED" || missingPrerequisites(next.moduleType, modules).length) continue;
    await notifyUsers(tx, (await teamRecipients(tx, store, template.editTeams)).filter((id) => id !== userId), {
      type: "step_unlocked",
      message: `${store.name}: ${template.displayName} can start now — ${tpl(moduleType)?.displayName ?? moduleType} is done.`,
      storeId: store.id,
      storeModuleId: m.id,
    });
  }
}

/** POST /api/modules/:id/after-approval — e.g. record the APX PO number once Token advance is approved. */
export const AfterApprovalInput = z.object({ value: z.string().trim().min(1, "Enter a value").max(60) });

export async function recordAfterApproval(user: CurrentUser, moduleId: string, raw: unknown) {
  const { store, mod } = await getModuleById(user, moduleId);
  const def = getModuleDefinition(mod.moduleType);
  if (!def?.afterApproval) throw notFound("Nothing to record for this step.");
  if (!can.recordAfterApproval(user, store, def.afterApproval.teams)) throw forbidden(`Only ${teamsLabel(def.afterApproval.teams)} can record the ${def.afterApproval.label}.`);
  if (!isApproved(mod)) throw conflict(`The ${def.afterApproval.label} can be recorded once ${def.displayName} is approved.`);
  const { value } = AfterApprovalInput.parse(raw);
  const details = (mod.details ?? {}) as Record<string, unknown>;
  await prisma.$transaction(async (tx) => {
    await tx.storeModule.update({ where: { id: mod.id }, data: { details: { ...details, [def.afterApproval!.key]: value } as Prisma.InputJsonObject } });
    await logActivity(tx, {
      userId: user.id,
      storeId: store.id,
      storeModuleId: mod.id,
      action: "module.after_approval",
      oldValue: { [def.afterApproval!.key]: (details[def.afterApproval!.key] as string | undefined) ?? null },
      newValue: { [def.afterApproval!.key]: value },
    });
  });
}
