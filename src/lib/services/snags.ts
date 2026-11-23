import "server-only";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDateOnly, parseDateOnly, todayInIndia } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { hqRecipients, notifyUsers, teamRecipients } from "@/lib/notify";
import { readUpload, storeFile } from "@/lib/services/files";
import { getStoreForUser } from "@/lib/services/stores";
import { storage } from "@/lib/storage";
import { STORE_OWNER_TEAM, TEAM_KEYS, teamLabel } from "@/lib/teams";
import { KEY_HANDOVER, SOFT_LAUNCH } from "@/modules";

/**
 * Snag list (decided 21 Nov 2026): defects found at key handover or before the soft launch. Each
 * has a photo, the department that fixes it and a deadline. The department uploads an "after"
 * photo or video and marks it fixed; the person who logged it, RK or HQ closes it after seeing the
 * fix, or sends it back. The soft launch cannot be completed while any snag is not closed.
 */
export const SNAG_STAGES = { KEY_HANDOVER: "At key handover", PRE_LAUNCH: "Before soft launch" } as const;
export type SnagStage = keyof typeof SNAG_STAGES;
const STAGE_MODULE: Record<SnagStage, string> = { KEY_HANDOVER: KEY_HANDOVER, PRE_LAUNCH: SOFT_LAUNCH };
export const SNAG_TEAMS = [STORE_OWNER_TEAM, ...TEAM_KEYS] as const;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-30");

export const CreateSnagInput = z.object({
  stage: z.enum(["KEY_HANDOVER", "PRE_LAUNCH"]),
  title: z.string().trim().min(3, "Describe the snag in a few words").max(200),
  details: z.string().trim().max(2000).optional().nullable(),
  team: z.string().refine((t) => (SNAG_TEAMS as readonly string[]).includes(t), "Choose who fixes it"),
  dueDate: ymd,
});

async function snagFor(user: CurrentUser, snagId: string) {
  const snag = await prisma.snag.findUnique({ where: { id: snagId } });
  if (!snag) throw notFound("Snag not found");
  const store = await getStoreForUser(user, snag.storeId);
  return { snag, store };
}

async function stageModule(storeId: string, stage: string) {
  const mod = await prisma.storeModule.findUnique({ where: { storeId_moduleType: { storeId, moduleType: STAGE_MODULE[stage as SnagStage] ?? SOFT_LAUNCH } } });
  if (!mod) throw notFound("Step not found");
  return mod;
}

/** Store page list: newest first, open ones on top, with their photos and videos. */
export async function listSnags(user: CurrentUser, storeId: string) {
  const store = await getStoreForUser(user, storeId);
  const rows = await prisma.snag.findMany({
    where: { storeId },
    orderBy: [{ raisedAt: "desc" }],
    include: {
      raisedBy: { select: { name: true } },
      fixedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      attachments: { orderBy: { uploadedAt: "asc" }, select: { id: true, fileType: true, fileName: true, tag: true, sizeBytes: true, uploadedAt: true, uploadedById: true } },
    },
  });
  const today = formatDateOnly(todayInIndia());
  const order = { OPEN: 0, FIXED: 1, CLOSED: 2 } as const;
  return rows
    .map((s) => {
      const due = s.dueDate ? formatDateOnly(s.dueDate) : null;
      return {
        id: s.id,
        stage: s.stage as SnagStage,
        title: s.title,
        details: s.details,
        team: s.team,
        teamLabel: teamLabel(s.team),
        dueDate: due,
        overdue: s.status !== "CLOSED" && !!due && due < today,
        status: s.status,
        raisedBy: s.raisedBy.name,
        raisedAt: s.raisedAt.toISOString(),
        fixedBy: s.fixedBy?.name ?? null,
        fixedAt: s.fixedAt?.toISOString() ?? null,
        fixNote: s.fixNote,
        closedBy: s.closedBy?.name ?? null,
        closedAt: s.closedAt?.toISOString() ?? null,
        returnNote: s.returnNote,
        before: s.attachments.filter((a) => a.tag === "snag_before").map((a) => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })),
        after: s.attachments.filter((a) => a.tag === "snag_after").map((a) => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })),
        canFix: s.status !== "CLOSED" && can.fixSnag(user, store, s),
        canClose: s.status === "FIXED" && can.closeSnag(user, store, s),
        canDelete: s.status === "OPEN" && (user.role === "SUPER_ADMIN" || (s.raisedById === user.id && !s.fixedAt)),
        canAddBefore: s.status === "OPEN" && (user.role === "SUPER_ADMIN" || s.raisedById === user.id),
      };
    })
    .sort((a, b) => order[a.status] - order[b.status]);
}
export type SnagView = Awaited<ReturnType<typeof listSnags>>[number];

/** POST /api/stores/:id/snags — log a snag (photos are uploaded right after, tag snag_before). */
export async function createSnag(user: CurrentUser, storeId: string, raw: unknown) {
  const store = await getStoreForUser(user, storeId);
  if (!can.raiseSnag(user, store)) throw forbidden();
  if (store.actualLaunchDate) throw conflict("This store has already launched.");
  const input = CreateSnagInput.parse(raw);
  const mod = await stageModule(storeId, input.stage);
  return prisma.$transaction(async (tx) => {
    const snag = await tx.snag.create({
      data: { storeId, stage: input.stage, title: input.title, details: input.details || null, team: input.team, dueDate: parseDateOnly(input.dueDate), raisedById: user.id },
    });
    await logActivity(tx, { userId: user.id, storeId, storeModuleId: mod.id, action: "snag.raised", newValue: { title: input.title, team: teamLabel(input.team), due: input.dueDate } });
    const recipients = [...(await teamRecipients(tx, store, [input.team])), ...(await hqRecipients(tx, store.state, { includeRegional: false }))];
    await notifyUsers(tx, recipients.filter((id) => id !== user.id), {
      type: "snag_raised",
      message: `${store.name}: new snag (${SNAG_STAGES[input.stage].toLowerCase()}) for ${teamLabel(input.team)} — "${input.title}", fix by ${formatDate(input.dueDate)}.`,
      storeId,
      storeModuleId: mod.id,
    });
    return snag;
  });
}

/** POST /api/snags/:id/files — multipart (file, tag snag_before | snag_after). Photos or short videos. */
export async function uploadSnagFile(user: CurrentUser, snagId: string, form: FormData) {
  const { snag, store } = await snagFor(user, snagId);
  if (snag.status === "CLOSED") throw conflict("This snag is closed.");
  const tag = form.get("tag") === "snag_after" ? "snag_after" : "snag_before";
  if (tag === "snag_before" && user.role !== "SUPER_ADMIN" && snag.raisedById !== user.id) throw forbidden("Only the person who logged the snag adds its photos.");
  if (tag === "snag_after" && !can.fixSnag(user, store, snag)) throw forbidden(`Only ${teamLabel(snag.team)} (or the person who logged it) uploads the fix.`);
  const upload = await readUpload(form, { allowVideo: true });
  const mod = await stageModule(snag.storeId, snag.stage);
  return storeFile(upload, { storeId: store.id, storeModuleId: mod.id, tag, snagId: snag.id, uploadedById: user.id }, (tx, data) => tx.attachment.create({ data }));
}

export const FixSnagInput = z.object({ note: z.string().trim().max(1000).optional().nullable() });

/** POST /api/snags/:id/fixed — the department marks it fixed; needs an "after" photo or video. */
export async function markSnagFixed(user: CurrentUser, snagId: string, raw: unknown) {
  const { snag, store } = await snagFor(user, snagId);
  if (!can.fixSnag(user, store, snag)) throw forbidden(`Only ${teamLabel(snag.team)} (or the person who logged it) can mark this snag fixed.`);
  if (snag.status !== "OPEN") throw conflict(snag.status === "FIXED" ? "Already marked fixed — waiting to be checked." : "This snag is closed.");
  const input = FixSnagInput.parse(raw ?? {});
  const after = await prisma.attachment.count({ where: { snagId, tag: "snag_after" } });
  if (!after) throw badRequest("Upload an \"after\" photo or video of the fix first.", { after: "Upload a photo or video of the fix" });
  const mod = await stageModule(snag.storeId, snag.stage);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.snag.update({ where: { id: snagId }, data: { status: "FIXED", fixedById: user.id, fixedAt: new Date(), fixNote: input.note || null } });
    await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: mod.id, action: "snag.fixed", newValue: { title: snag.title } });
    const rk = await teamRecipients(tx, store, ["RK"]);
    await notifyUsers(tx, [snag.raisedById, ...rk].filter((id) => id !== user.id), {
      type: "snag_fixed",
      message: `${store.name}: snag "${snag.title}" marked fixed by ${user.name} — check the photo or video and close it.`,
      storeId: store.id,
      storeModuleId: mod.id,
    });
    return updated;
  });
}

export const CloseSnagInput = z.object({ decision: z.enum(["close", "send_back"]), note: z.string().trim().max(1000).optional().nullable() });

/** POST /api/snags/:id/decision — close after seeing the fix, or send it back with a reason. */
export async function decideSnag(user: CurrentUser, snagId: string, raw: unknown) {
  const { snag, store } = await snagFor(user, snagId);
  if (!can.closeSnag(user, store, snag)) throw forbidden("Only the person who logged the snag, RK or HQ can close it.");
  if (snag.status !== "FIXED") throw conflict("Only a snag marked fixed can be closed or sent back.");
  const input = CloseSnagInput.parse(raw);
  if (input.decision === "send_back" && !input.note) throw badRequest("Say what is still wrong.", { note: "Say what is still wrong" });
  const mod = await stageModule(snag.storeId, snag.stage);
  return prisma.$transaction(async (tx) => {
    const closing = input.decision === "close";
    const updated = await tx.snag.update({
      where: { id: snagId },
      data: closing ? { status: "CLOSED", closedById: user.id, closedAt: new Date() } : { status: "OPEN", returnNote: input.note ?? null, fixedAt: null, fixedById: null },
    });
    await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: mod.id, action: closing ? "snag.closed" : "snag.sent_back", newValue: { title: snag.title, note: input.note ?? null } });
    const team = await teamRecipients(tx, store, [snag.team]);
    await notifyUsers(tx, [...team, ...(snag.fixedById ? [snag.fixedById] : [])].filter((id) => id !== user.id), {
      type: closing ? "snag_closed" : "snag_sent_back",
      message: closing ? `${store.name}: snag "${snag.title}" closed by ${user.name}.` : `${store.name}: snag "${snag.title}" sent back by ${user.name} — ${input.note}`,
      storeId: store.id,
      storeModuleId: mod.id,
    });
    return updated;
  });
}

/** DELETE /api/snags/:id — logged by mistake: the person who logged it (before any fix) or HQ. */
export async function deleteSnag(user: CurrentUser, snagId: string) {
  const { snag, store } = await snagFor(user, snagId);
  if (user.role !== "SUPER_ADMIN" && (snag.raisedById !== user.id || snag.fixedAt || snag.status !== "OPEN")) throw forbidden("Only the person who logged it can remove it, before it is fixed.");
  const files = await prisma.attachment.findMany({ where: { snagId }, select: { fileUrl: true } });
  const mod = await stageModule(snag.storeId, snag.stage);
  await prisma.$transaction(async (tx) => {
    await tx.snag.delete({ where: { id: snagId } });
    await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: mod.id, action: "snag.removed", oldValue: { title: snag.title } });
  });
  for (const f of files) await storage.remove(f.fileUrl);
}

