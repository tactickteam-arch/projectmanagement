import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { diff, logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { addDays, formatDateOnly, parseDateOnly, todayInIndia } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { stateName } from "@/lib/india-states";
import {
  afterActionSchema,
  approvalAfterSave,
  canBeApproved,
  checkModuleRules,
  detailsSchema,
  missingBeforeComplete,
  missingPrerequisites,
  sopCheckErrors,
} from "@/lib/module-rules";
import { hqRecipients, notifyUsers, teamRecipients, teamRecipientsFor } from "@/lib/notify";
import { planFrom, rolloutTarget } from "@/lib/scheduling";
import { getStoreForUser, recalcStoreStatus } from "@/lib/services/stores";
import { getTargetLaunchOffsetDays } from "@/lib/settings";
import { isApproved, isDone, MODULE_STATUS_LABELS } from "@/lib/status";
import { HIDDEN_VALUE, TEAM_KEYS, teamLabel, teamsLabel } from "@/lib/teams";
import { AFTER_KEY_TYPES, getModuleDefinition, KEY_HANDOVER, LOCATION_FILING, MODULE_DEFINITIONS, SOFT_LAUNCH } from "@/modules";
import type { FieldDef, StoreSource } from "@/modules/types";

type Tx = Prisma.TransactionClient;
type StoreRow = {
  id: string;
  name: string;
  storeCode: string;
  state: string;
  ownerId: string;
  address: string | null;
  carpetAreaSqft: number | null;
  createdAt: Date;
  keyHandoverDate: Date | null;
  expectedKeyDate: Date | null;
  targetLaunchDate: Date | null;
};

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

/** Store master values shown on steps (e.g. MOU point 2 "Branch code"). */
export function storeValue(store: { name: string; storeCode: string; state: string; address: string | null; carpetAreaSqft: number | null }, src: StoreSource): string | number | null {
  switch (src) {
    case "name":
      return store.name;
    case "storeCode":
      return store.storeCode;
    case "state":
      return stateName(store.state);
    case "address":
      return store.address;
    case "carpetAreaSqft":
      return store.carpetAreaSqft;
  }
}

/** Fills the store-sourced fields of a step's details from the store record. */
function withStoreValues(fields: FieldDef[], details: Record<string, unknown>, store: StoreRow): Record<string, unknown> {
  const out = { ...details };
  for (const f of fields) if (f.fromStore) out[f.key] = storeValue(store, f.fromStore) ?? null;
  return out;
}

/** Hides KYC values in the activity log. */
function maskSensitive(fields: FieldDef[], details: unknown): unknown {
  if (!details || typeof details !== "object") return details;
  const out = { ...(details as Record<string, unknown>) };
  for (const f of fields) if (f.sensitive && out[f.key] !== undefined && out[f.key] !== null) out[f.key] = "•••• (hidden)";
  return out;
}

const whoCanEdit = (editTeams: string[]) => (editTeams.length ? teamsLabel(editTeams) : "HQ");

async function siblingsOf(db: Pick<typeof prisma, "storeModule">, storeId: string) {
  return db.storeModule.findMany({ where: { storeId }, select: { moduleType: true, status: true, approvalStatus: true, details: true, actualEnd: true } });
}

/** PATCH /api/stores/:id/modules/:moduleType — the step's team updates common + specific fields. */
export async function updateModule(user: CurrentUser, storeId: string, moduleType: string, raw: unknown) {
  const { store, mod } = await getModuleByType(user, storeId, moduleType);
  const template = await templateFor(moduleType);
  const def = getModuleDefinition(moduleType);
  if (!can.editModule(user, store, template)) throw forbidden(`Only ${whoCanEdit(template.editTeams)} can update this step.`);
  const input = UpdateModuleInput.parse(raw);
  const fields = template.fieldSchema as unknown as FieldDef[];

  let details: Record<string, unknown> = (mod.details ?? {}) as Record<string, unknown>;
  if (input.details) {
    // KYC values the user may not see come back as the "hidden" marker: keep what is stored.
    for (const f of fields) if (f.sensitive && input.details[f.key] === HIDDEN_VALUE) delete input.details[f.key];
    const parsed = detailsSchema(fields).safeParse(input.details);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[`details.${issue.path.join(".")}`] = issue.message;
      throw badRequest(Object.values(fieldErrors)[0] ?? "Some fields are not valid.", fieldErrors);
    }
    details = { ...details, ...parsed.data };
  }
  details = withStoreValues(fields, details, store);

  const pick = <T>(v: T | undefined, cur: T) => (v === undefined ? cur : v);
  const next = {
    status: input.status ?? mod.status,
    blockerReason: pick(input.blockerReason, mod.blockerReason),
    plannedStart: pick(input.plannedStart, mod.plannedStart),
    plannedEnd: pick(input.plannedEnd, mod.plannedEnd),
    actualStart: pick(input.actualStart, mod.actualStart),
    actualEnd: pick(input.actualEnd, mod.actualEnd),
  };
  if (mod.status === "COMPLETED" && mod.approvalStatus === "PENDING" && next.status === "COMPLETED" && template.approverTeam) {
    throw conflict(`This step is waiting for ${teamLabel(template.approverTeam)} approval. Reopen it to make changes.`);
  }
  if (next.status !== "BLOCKED") next.blockerReason = null;
  // Starting work records the actual start, if nobody entered one.
  if (next.status !== "NOT_STARTED" && !next.actualStart && mod.status === "NOT_STARTED") next.actualStart = todayInIndia();

  const siblings = await siblingsOf(prisma, storeId);
  const names = await displayNames();
  const completing = next.status === "COMPLETED" && mod.status !== "COMPLETED";
  const uploadedTags = completing ? (await prisma.attachment.findMany({ where: { storeModuleId: mod.id }, select: { tag: true } })).map((a) => a.tag ?? "document") : [];
  const errors = checkModuleRules({
    moduleType,
    current: mod,
    next,
    missingPrerequisites: missingPrerequisites(moduleType, siblings).map((t) => names[t] ?? t),
    missingBeforeComplete: missingBeforeComplete(moduleType, siblings).map((t) => names[t] ?? t),
    photoCount: completing ? await countCountingPhotos(mod.id, template.photoTag) : 0,
    minPhotos: completing ? template.minPhotos : 0,
    fields,
    details,
    uploadedTags,
    sopProblems: completing ? sopCheckErrors(def?.checks, { areaSqft: store.carpetAreaSqft, details, siblings }) : [],
    requireActualEnd: def?.requireActualEnd,
  });
  if (Object.keys(errors).length) {
    const message = errors.status ?? errors.sop ?? errors.tasks ?? errors.required ?? errors.actualEnd ?? errors.photos ?? Object.values(errors)[0];
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
    details: details as Prisma.InputJsonObject,
    approvalStatus: approval.approvalStatus,
    ...(approval.submitted ? { completedAt: new Date(), approvalComment: null, approvedBy: { disconnect: true }, approvedAt: null } : {}),
    ...(approval.autoApproved ? { approvedBy: { connect: { id: user.id } }, approvedAt: new Date() } : {}),
    updatedBy: { connect: { id: user.id } },
  };

  return prisma.$transaction(async (tx) => {
    const updated = await tx.storeModule.update({ where: { id: mod.id }, data });
    const before = { ...mod, details: maskSensitive(fields, mod.details) } as unknown as Record<string, unknown>;
    const afterView = {
      ...next,
      vendorName: data.vendorName,
      vendorPhone: data.vendorPhone,
      estCost: data.estCost,
      actualCost: data.actualCost,
      remarks: data.remarks,
      details: maskSensitive(fields, details),
    };
    const d = diff(before, afterView as Record<string, unknown>);
    if (d) await logActivity(tx, { userId: user.id, storeId, storeModuleId: mod.id, action: "module.updated", ...d });

    // MOU point 11: the expected key date drives the T-7 work (until the keys are received).
    if (moduleType === LOCATION_FILING && !store.keyHandoverDate) {
      const expected = typeof details.keyHandoverDate === "string" ? parseDateOnly(details.keyHandoverDate) : null;
      if (expected) await setExpectedKeyDate(tx, store, expected, user.id);
    }

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
        await afterApproved(tx, store, moduleType, mod.id, user.id);
        if (isDone({ ...updated, details })) await afterStepDone(tx, store, moduleType, user.id);
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

/** POST /api/modules/:id/approve and /reject — decision by the step's approver team (or HQ). Sending back needs a comment. */
export const DecisionInput = z.object({ comment: z.string().trim().max(2000).optional().nullable() });

export async function decideModule(user: CurrentUser, moduleId: string, decision: "approve" | "reject", raw: unknown) {
  const { store, mod } = await getModuleById(user, moduleId);
  const template = await templateFor(mod.moduleType);
  const def = getModuleDefinition(mod.moduleType);
  if (!can.approveModule(user, store, template)) {
    throw forbidden(template.approverTeam ? `Only ${teamLabel(template.approverTeam)} (or HQ) can approve this step.` : "This step has no approver; its team marks it done.");
  }
  if (!canBeApproved(mod)) {
    throw badRequest(`Only steps marked Completed and waiting for approval can be ${decision === "approve" ? "approved" : "sent back"} (this one is ${MODULE_STATUS_LABELS[mod.status]}).`);
  }
  const { comment } = DecisionInput.parse(raw ?? {});
  if (decision === "reject" && !comment) throw badRequest("Add a comment explaining what needs to change.", { comment: "Required when sending back" });

  const details = (mod.details ?? {}) as Record<string, unknown>;
  if (decision === "approve") {
    if (mod.moduleType === KEY_HANDOVER && typeof details.handoverDate !== "string") {
      throw badRequest("The handover date is missing. Send the step back so the handover date can be entered.");
    }
    // The SOP checks are enforced again at approval (zero-exception gates: power load before
    // leadership approval, sign board one week before the keys).
    const problems = sopCheckErrors(def?.checks, { areaSqft: store.carpetAreaSqft, details, siblings: await siblingsOf(prisma, store.id) });
    if (problems.length) throw badRequest(`Cannot approve: ${problems.join(" ")}`);
  }

  const approver = template.approverTeam ? teamLabel(template.approverTeam) : "HQ";
  return prisma.$transaction(async (tx) => {
    const updated = await tx.storeModule.update({
      where: { id: mod.id },
      data:
        decision === "approve"
          ? { approvalStatus: "APPROVED", approvedById: user.id, approvedAt: new Date(), approvalComment: comment || null }
          : // Sent back: the step goes back to In Progress, with the approver's comment shown to its team.
            { approvalStatus: "REJECTED", status: "IN_PROGRESS", approvedById: user.id, approvedAt: new Date(), approvalComment: comment },
    });
    await logActivity(tx, {
      userId: user.id,
      storeId: store.id,
      storeModuleId: mod.id,
      action: decision === "approve" ? "module.approved" : "module.rejected",
      newValue: { comment: comment || null, as: approver },
    });
    const editors = await teamRecipients(tx, store, template.editTeams);
    await notifyUsers(tx, editors.filter((id) => id !== user.id), {
      type: decision === "approve" ? "module_approved" : "module_rejected",
      message:
        decision === "approve"
          ? `${store.name}: ${template.displayName} was approved by ${approver}.`
          : `${store.name}: ${template.displayName} was sent back by ${approver} — ${comment}`,
      storeId: store.id,
      storeModuleId: mod.id,
    });
    if (decision === "approve") {
      await afterApproved(tx, store, mod.moduleType, mod.id, user.id);
      if (isDone(updated)) await afterStepDone(tx, store, mod.moduleType, user.id);
    }
    await recalcStoreStatus(tx, store.id, user.id);
  });
}

/** After approval: ask the teams that record the follow-ups (HO payment, APX PO) to do so. */
async function afterApproved(tx: Tx, store: StoreRow, moduleType: string, moduleId: string, userId: string) {
  const def = getModuleDefinition(moduleType);
  for (const a of def?.afterApproval ?? []) {
    await notifyUsers(tx, (await teamRecipients(tx, store, a.teams)).filter((id) => id !== userId), {
      type: "after_approval",
      message: `${store.name}: ${def?.displayName} approved — next: ${a.pendingText.replace(/^Step \d+ — /, "")}. Record it in the tracker.`,
      storeId: store.id,
      storeModuleId: moduleId,
    });
  }
}

/** Slide 10 week 1: "Intimation to internal teams, brands & NBFCs" once Boss + CEO approve the site. */
const INTIMATION_TEAMS = TEAM_KEYS.filter((t) => t !== "LEADERSHIP");

/**
 * What the system does when a step is done (approved with its gating records, or marked green):
 *  - Location filing: the internal teams are intimated about the new store.
 *  - Key handover: the handover date becomes Day 0 — on-site work, department tracks and the soft
 *    launch are scheduled from it, the target launch is set, and every Stage 6 department is notified.
 *  - Soft launch: the soft launch date is recorded on the store.
 *  - Any step: the teams of the steps that can now start are told so.
 */
async function afterStepDone(tx: Tx, storeIn: StoreRow, moduleType: string, userId: string) {
  const store = (await tx.store.findUniqueOrThrow({ where: { id: storeIn.id } })) as StoreRow;
  const modules = await tx.storeModule.findMany({ where: { storeId: store.id } });
  const templates = await tx.moduleTemplate.findMany();
  const tpl = (t: string) => templates.find((x) => x.moduleType === t);
  const self = modules.find((m) => m.moduleType === moduleType);
  const details = (self?.details ?? {}) as Record<string, unknown>;
  const notified = new Set<string>();

  if (moduleType === LOCATION_FILING) {
    const ids = (await teamRecipients(tx, store, INTIMATION_TEAMS)).filter((id) => id !== userId);
    await notifyUsers(tx, ids, {
      type: "intimation",
      message: `New store approved by Boss + CEO: ${store.name} (${store.storeCode}). Expected keys ${store.expectedKeyDate ? formatDate(formatDateOnly(store.expectedKeyDate)) : "to be confirmed"}.`,
      storeId: store.id,
    });
  }

  if (moduleType === KEY_HANDOVER && typeof details.handoverDate === "string") {
    const day0 = parseDateOnly(details.handoverDate);
    const offset = await getTargetLaunchOffsetDays(tx);
    const created = parseDateOnly(formatDateOnly(store.createdAt));
    const autoTarget = !store.targetLaunchDate || formatDateOnly(store.targetLaunchDate) === formatDateOnly(rolloutTarget(created));
    await tx.store.update({ where: { id: store.id }, data: { keyHandoverDate: day0, ...(autoTarget ? { targetLaunchDate: addDays(day0, offset) } : {}) } });
    const plan = planFrom("handover", day0, templates);
    for (const p of plan) {
      const m = modules.find((x) => x.moduleType === p.moduleType);
      if (m && m.status === "NOT_STARTED") await tx.storeModule.update({ where: { id: m.id }, data: { plannedStart: p.plannedStart, plannedEnd: p.plannedEnd } });
    }
    await logActivity(tx, { userId, storeId: store.id, storeModuleId: self?.id, action: "key_handover.accepted", newValue: { keyHandoverDate: details.handoverDate } });

    const after = AFTER_KEY_TYPES.map(tpl).filter((t) => t !== undefined);
    const supportOf = (t: string) => getModuleDefinition(t)?.supportTeams ?? [];
    const recipients = await teamRecipientsFor(tx, store, after.flatMap((t) => [...t.editTeams, ...supportOf(t.moduleType)]));
    const withKeys = modules.map((x) => (x.moduleType === KEY_HANDOVER ? { ...x, status: "COMPLETED" as const, approvalStatus: "APPROVED" as const } : x));
    const notes: Prisma.NotificationCreateManyInput[] = [];
    for (const template of after) {
      const m = modules.find((x) => x.moduleType === template.moduleType);
      const p = plan.find((x) => x.moduleType === template.moduleType);
      if (!m || m.status !== "NOT_STARTED" || template.moduleType === SOFT_LAUNCH) continue;
      const d = getModuleDefinition(template.moduleType);
      const ready = missingPrerequisites(template.moduleType, withKeys).length === 0;
      const name = `${d?.code && d.code !== "6" ? `${d.code} ` : ""}${template.displayName}`;
      const when = p ? `, planned ${formatDate(formatDateOnly(p.plannedStart))} – ${formatDate(formatDateOnly(p.plannedEnd))}` : "";
      const message = `${store.name}: keys received on ${formatDate(details.handoverDate)} (Day 0). ${ready ? "Start" : "Coming up after the earlier on-site step:"} ${name}${when}.`;
      for (const id of new Set(recipients([...template.editTeams, ...supportOf(template.moduleType)]))) {
        if (id !== userId) notes.push({ userId: id, type: "setup_start", message, storeId: store.id, storeModuleId: m.id });
      }
      notified.add(template.moduleType);
    }
    if (notes.length) await tx.notification.createMany({ data: notes });
  }

  if (moduleType === SOFT_LAUNCH && typeof details.softLaunchDate === "string") {
    await tx.store.update({ where: { id: store.id }, data: { actualLaunchDate: parseDateOnly(details.softLaunchDate) } });
    const ids = [...(await hqRecipients(tx, store.state)), ...(await teamRecipients(tx, store, ["LEADERSHIP", "RK", "STORE_OWNER", "SALES", "BH", "ASM", "STATE_ADMIN"]))];
    await notifyUsers(tx, [...new Set(ids)].filter((id) => id !== userId), {
      type: "soft_launch",
      message: `${store.name} (${store.storeCode}) soft launched on ${formatDate(details.softLaunchDate)}.`,
      storeId: store.id,
    });
  }

  // Steps unlocked by this one.
  const doneNow = modules.map((x) => (x.moduleType === moduleType ? { ...x, status: "COMPLETED" as const, approvalStatus: "APPROVED" as const } : x));
  for (const next of MODULE_DEFINITIONS) {
    if (notified.has(next.moduleType) || !next.requires.includes(moduleType)) continue;
    const m = modules.find((x) => x.moduleType === next.moduleType);
    const template = tpl(next.moduleType);
    if (!m || !template || m.status !== "NOT_STARTED" || missingPrerequisites(next.moduleType, doneNow).length) continue;
    await notifyUsers(tx, (await teamRecipients(tx, store, template.editTeams)).filter((id) => id !== userId), {
      type: "step_unlocked",
      message:
        next.moduleType === SOFT_LAUNCH
          ? `${store.name}: all departments are green — the soft launch audit can start.`
          : `${store.name}: ${template.displayName} can start now — ${tpl(moduleType)?.displayName ?? moduleType} is done.`,
      storeId: store.id,
      storeModuleId: m.id,
    });
  }
}

/** Sets the expected key date and re-plans the T-7 work and the handover (steps not started). */
export async function setExpectedKeyDate(tx: Tx, store: { id: string; expectedKeyDate: Date | null }, d: Date, userId: string | null) {
  if (store.expectedKeyDate && store.expectedKeyDate.getTime() === d.getTime()) return;
  await tx.store.update({ where: { id: store.id }, data: { expectedKeyDate: d, preKeyNotifiedFor: null } });
  const templates = await tx.moduleTemplate.findMany();
  for (const p of planFrom("expectedKey", d, templates)) {
    await tx.storeModule.updateMany({ where: { storeId: store.id, moduleType: p.moduleType, status: "NOT_STARTED" }, data: { plannedStart: p.plannedStart, plannedEnd: p.plannedEnd } });
  }
  await logActivity(tx, {
    userId,
    storeId: store.id,
    action: "store.expected_keys",
    oldValue: { expectedKeyDate: store.expectedKeyDate ? formatDateOnly(store.expectedKeyDate) : null },
    newValue: { expectedKeyDate: formatDateOnly(d) },
  });
}

/** POST /api/modules/:id/after-approval — { action, values }: HO records the token advance payment,
 * Accounts / Purchase record the APX PO number. */
export const AfterApprovalInput = z.object({ action: z.string().min(1).max(40), values: z.record(z.string(), z.unknown()) });

export async function recordAfterApproval(user: CurrentUser, moduleId: string, raw: unknown) {
  const { store, mod } = await getModuleById(user, moduleId);
  const def = getModuleDefinition(mod.moduleType);
  const { action: key, values } = AfterApprovalInput.parse(raw);
  const action = def?.afterApproval?.find((a) => a.key === key);
  if (!def || !action) throw notFound("Nothing to record for this step.");
  if (!can.recordAfterApproval(user, store, action.teams)) throw forbidden(`Only ${teamsLabel(action.teams)} can record the ${action.label.toLowerCase()}.`);
  if (!isApproved(mod)) throw conflict(`The ${action.label.toLowerCase()} can be recorded once ${def.displayName} is approved.`);
  const parsed = afterActionSchema(action.fields).safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "value")] = issue.message;
    throw badRequest(Object.values(fieldErrors)[0] ?? "Some fields are not valid.", fieldErrors);
  }
  const data = parsed.data as Record<string, unknown>;
  const missing = action.fields.filter((f) => f.required && (data[f.key] === null || data[f.key] === undefined || data[f.key] === ""));
  if (missing.length) throw badRequest(`${missing[0].label} is required`, Object.fromEntries(missing.map((f) => [f.key, `${f.label} is required`])));

  const details = (mod.details ?? {}) as Record<string, unknown>;
  const wasDone = isDone(mod);
  const nextDetails = { ...details, [key]: { ...data, recordedBy: user.name, recordedAt: new Date().toISOString() } };
  const paid = key === "payment" && typeof data.paidAmount === "number" ? { actualCost: data.paidAmount } : {};
  await prisma.$transaction(async (tx) => {
    const updated = await tx.storeModule.update({ where: { id: mod.id }, data: { details: nextDetails as Prisma.InputJsonObject, ...paid } });
    await logActivity(tx, {
      userId: user.id,
      storeId: store.id,
      storeModuleId: mod.id,
      action: "module.after_approval",
      oldValue: { [action.label]: (details[key] as Prisma.InputJsonValue | undefined) ?? null },
      newValue: { [action.label]: data as Prisma.InputJsonObject },
    });
    await notifyUsers(tx, (await hqRecipients(tx, store.state, { includeRegional: false })).filter((id) => id !== user.id), {
      type: "after_approval_done",
      message: `${store.name}: ${action.doneText}${key === "apxPo" ? ` — ${String(data.apxPoNumber ?? "")}` : ""}.`,
      storeId: store.id,
      storeModuleId: mod.id,
    });
    if (!wasDone && isDone(updated)) await afterStepDone(tx, store, mod.moduleType, user.id);
    await recalcStoreStatus(tx, store.id, user.id);
  });
}
