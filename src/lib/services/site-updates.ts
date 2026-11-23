import "server-only";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDateOnly, todayInIndia } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { readUpload, storeFile } from "@/lib/services/files";
import { getStoreForUser } from "@/lib/services/stores";
import { storage } from "@/lib/storage";
import { AFTER_KEY_TYPES } from "@/modules";

/**
 * Daily site photos (decided 21 Nov 2026): from the day the keys are received until the launch,
 * Manju (right "Posts daily site photos") and the department doing the work post photos of the
 * day's progress, against the step they show.
 */
export const CreateSiteUpdateInput = z.object({
  moduleType: z.string().refine((t) => AFTER_KEY_TYPES.includes(t), "Choose the work the photos show"),
  note: z.string().trim().max(1000).optional().nullable(),
});

/** Steps the user may post photos for on this store (empty = may not post). */
export async function siteUpdateSteps(user: CurrentUser, store: { ownerId: string; state: string; keyHandoverDate: unknown; actualLaunchDate: unknown }) {
  if (!store.keyHandoverDate || store.actualLaunchDate) return [];
  const templates = await prisma.moduleTemplate.findMany({ where: { moduleType: { in: [...AFTER_KEY_TYPES] } }, orderBy: { sortOrder: "asc" } });
  return templates.filter((t) => can.postSitePhotos(user, store, t)).map((t) => ({ moduleType: t.moduleType, displayName: t.displayName }));
}

/** Store page: updates grouped by day, newest first. */
export async function listSiteUpdates(user: CurrentUser, storeId: string) {
  await getStoreForUser(user, storeId);
  const rows = await prisma.siteUpdate.findMany({
    where: { storeId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { name: true } },
      storeModule: { select: { moduleType: true } },
      attachments: { orderBy: { uploadedAt: "asc" }, select: { id: true, fileType: true, fileName: true, tag: true, sizeBytes: true, uploadedAt: true } },
    },
  });
  const names = Object.fromEntries((await prisma.moduleTemplate.findMany({ select: { moduleType: true, displayName: true } })).map((t) => [t.moduleType, t.displayName]));
  return rows.map((u) => ({
    id: u.id,
    date: formatDateOnly(u.date),
    step: names[u.storeModule.moduleType] ?? u.storeModule.moduleType,
    note: u.note,
    by: u.createdBy.name,
    mine: u.createdById === user.id,
    createdAt: u.createdAt.toISOString(),
    photos: u.attachments.map((a) => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })),
  }));
}
export type SiteUpdateView = Awaited<ReturnType<typeof listSiteUpdates>>[number];

/** POST /api/stores/:id/site-updates — today's update for one step; photos are uploaded right after. */
export async function createSiteUpdate(user: CurrentUser, storeId: string, raw: unknown) {
  const store = await getStoreForUser(user, storeId);
  const input = CreateSiteUpdateInput.parse(raw);
  if (!store.keyHandoverDate) throw conflict("Daily site photos start once the keys are received.");
  if (store.actualLaunchDate) throw conflict("This store has already launched.");
  const template = await prisma.moduleTemplate.findUnique({ where: { moduleType: input.moduleType } });
  if (!template) throw notFound("Step not found");
  if (!can.postSitePhotos(user, store, template)) throw forbidden(`Only Manju or the department doing ${template.displayName} posts these photos.`);
  const mod = await prisma.storeModule.findUnique({ where: { storeId_moduleType: { storeId, moduleType: input.moduleType } } });
  if (!mod) throw notFound("Step not found");
  return prisma.$transaction(async (tx) => {
    const u = await tx.siteUpdate.create({ data: { storeId, storeModuleId: mod.id, date: todayInIndia(), note: input.note || null, createdById: user.id } });
    await logActivity(tx, { userId: user.id, storeId, storeModuleId: mod.id, action: "site_update.added", newValue: { step: template.displayName, note: input.note ?? null } });
    return u;
  });
}

async function updateFor(user: CurrentUser, id: string) {
  const u = await prisma.siteUpdate.findUnique({ where: { id }, include: { storeModule: { select: { id: true } } } });
  if (!u) throw notFound("Update not found");
  const store = await getStoreForUser(user, u.storeId);
  if (user.role !== "SUPER_ADMIN" && u.createdById !== user.id) throw forbidden("Only the person who posted this update can change it.");
  return { u, store };
}

/** POST /api/site-updates/:id/files — a photo for the update (same day only). */
export async function uploadSiteUpdatePhoto(user: CurrentUser, id: string, form: FormData) {
  const { u, store } = await updateFor(user, id);
  if (formatDateOnly(u.date) !== formatDateOnly(todayInIndia())) throw conflict("Photos can only be added on the day of the update. Post a new update for today.");
  const upload = await readUpload(form);
  if (!upload.type.mime.startsWith("image/")) throw badRequest("Only photos are accepted here.");
  return storeFile(upload, { storeId: store.id, storeModuleId: u.storeModuleId, tag: "photo_site", siteUpdateId: u.id, uploadedById: user.id }, (tx, data) => tx.attachment.create({ data }));
}

/** DELETE /api/site-updates/:id — posted by mistake. */
export async function deleteSiteUpdate(user: CurrentUser, id: string) {
  const { u, store } = await updateFor(user, id);
  const files = await prisma.attachment.findMany({ where: { siteUpdateId: id }, select: { fileUrl: true } });
  await prisma.$transaction(async (tx) => {
    await tx.siteUpdate.delete({ where: { id } });
    await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: u.storeModuleId, action: "site_update.removed" });
  });
  for (const f of files) await storage.remove(f.fileUrl);
}
