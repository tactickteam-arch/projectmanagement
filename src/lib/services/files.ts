import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { notifyUsers, teamRecipients } from "@/lib/notify";
import { getModuleById } from "@/lib/services/modules";
import { getStoreForUser } from "@/lib/services/stores";
import { detectFileType, detectVideoType, MAX_UPLOAD_BYTES, storage } from "@/lib/storage";
import { DESIGN_APPROVER } from "@/lib/teams";
import type { FieldDef } from "@/modules/types";

const Tag = z
  .string()
  .regex(/^[a-z0-9_]{1,40}$/, "Invalid attachment tag")
  .default("document");

type Tx = Prisma.TransactionClient;
export type FileLink = { storeId: string; storeModuleId: string; tag: string; uploadedById: string; snagId?: string; siteUpdateId?: string };

/** Reads the "file" part of an upload and checks its real type (from the content, not the name). */
export async function readUpload(form: FormData, opts: { allowVideo?: boolean } = {}) {
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Choose a file to upload.");
  if (file.size === 0) throw badRequest("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError(413, "Files can be at most 10 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectFileType(buf) ?? (opts.allowVideo ? detectVideoType(buf) : null);
  if (!type) {
    throw new AppError(415, opts.allowVideo ? "Only photos (JPG, PNG, WebP), PDF and videos (MP4, MOV, WebM) are accepted." : "Only JPG, PNG, WebP photos and PDF documents are accepted.");
  }
  const fileName = (file.name || `upload.${type.ext}`).replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  return { buf, type, fileName };
}

/** Stores the bytes, then runs `write` (which creates the attachment row) in a transaction; removes the bytes if it fails. */
export async function storeFile<T>(upload: Awaited<ReturnType<typeof readUpload>>, link: FileLink, write: (tx: Tx, data: Prisma.AttachmentUncheckedCreateInput) => Promise<T>) {
  const key = `${link.storeId}/${link.storeModuleId}/${randomUUID()}.${upload.type.ext}`;
  await storage.put(key, upload.buf);
  try {
    return await prisma.$transaction((tx) =>
      write(tx, {
        storeModuleId: link.storeModuleId,
        snagId: link.snagId ?? null,
        siteUpdateId: link.siteUpdateId ?? null,
        fileUrl: key,
        fileType: upload.type.mime,
        fileName: upload.fileName,
        sizeBytes: upload.buf.length,
        tag: link.tag,
        uploadedById: link.uploadedById,
      }),
    );
  } catch (e) {
    await storage.remove(key);
    throw e;
  }
}

function designField(fieldSchema: unknown, tag: string | null): FieldDef | undefined {
  return ((fieldSchema ?? []) as FieldDef[]).find((f) => f.type === "file" && f.design && (f.attachmentTag ?? "document") === (tag ?? "document"));
}

/** POST /api/modules/:id/attachments — multipart form: file, tag. */
export async function uploadAttachment(user: CurrentUser, moduleId: string, form: FormData) {
  const { store, mod } = await getModuleById(user, moduleId);
  const template = await prisma.moduleTemplate.findUniqueOrThrow({ where: { moduleType: mod.moduleType } });
  if (!can.editModule(user, store, template)) throw forbidden("Only the team that owns this step can upload files.");
  if (mod.status === "COMPLETED" && mod.approvalStatus === "APPROVED") {
    throw conflict("This step is done and approved; files can no longer be changed.");
  }
  const tag = Tag.parse(form.get("tag") ?? undefined);
  const design = designField(template.fieldSchema, tag);
  if (design) {
    const final = await prisma.attachment.findFirst({ where: { storeModuleId: mod.id, tag, approvedAt: { not: null }, snagId: null, siteUpdateId: null } });
    if (final) throw conflict(`The final ${design.label.toLowerCase()} is approved and locked. Ask the design approver to unlock it before uploading a new version.`);
  }
  const upload = await readUpload(form);

  return storeFile(upload, { storeId: store.id, storeModuleId: mod.id, tag, uploadedById: user.id }, async (tx, data) => {
    const att = await tx.attachment.create({ data });
    await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: mod.id, action: "attachment.added", newValue: { fileName: upload.fileName, tag } });
    if (design) {
      const version = await tx.attachment.count({ where: { storeModuleId: mod.id, tag, snagId: null, siteUpdateId: null } });
      const recipients = (await teamRecipients(tx, store, [DESIGN_APPROVER])).filter((id) => id !== user.id);
      await notifyUsers(tx, recipients, {
        type: "design_uploaded",
        message: `${store.name}: ${design.label} version ${version} uploaded — please review and approve the final one.`,
        storeId: store.id,
        storeModuleId: mod.id,
      });
    }
    return att;
  });
}

/** POST / DELETE /api/attachments/:id/final — the design approver locks (or unlocks) the final version of a design. */
export async function setFinalDesign(user: CurrentUser, attachmentId: string, final: boolean) {
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { storeModule: true } });
  if (!att || att.snagId || att.siteUpdateId) throw notFound("File not found");
  const store = await getStoreForUser(user, att.storeModule.storeId);
  if (!can.approveDesign(user, store)) throw forbidden("Only the design approver can approve the final design.");
  const template = await prisma.moduleTemplate.findUniqueOrThrow({ where: { moduleType: att.storeModule.moduleType } });
  const design = designField(template.fieldSchema, att.tag);
  if (!design) throw badRequest("This file is not a design.");
  const m = att.storeModule;
  if (m.status === "COMPLETED" && m.approvalStatus !== "REJECTED") {
    throw conflict(`${template.displayName} is already Completed. Reopen it first to change the final design.`);
  }
  if (!final && !att.approvedAt) return { ok: true };
  await prisma.$transaction(async (tx) => {
    if (final) {
      await tx.attachment.updateMany({ where: { storeModuleId: m.id, tag: att.tag, approvedAt: { not: null }, snagId: null, siteUpdateId: null }, data: { approvedAt: null, approvedById: null } });
      await tx.attachment.update({ where: { id: att.id }, data: { approvedAt: new Date(), approvedById: user.id } });
    } else {
      await tx.attachment.update({ where: { id: att.id }, data: { approvedAt: null, approvedById: null } });
    }
    await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: m.id, action: final ? "design.approved" : "design.unlocked", newValue: { fileName: att.fileName, design: design.label } });
    const recipients = (await teamRecipients(tx, store, template.editTeams)).filter((id) => id !== user.id);
    await notifyUsers(tx, recipients, {
      type: final ? "design_approved" : "design_unlocked",
      message: final
        ? `${store.name}: final ${design.label.toLowerCase()} approved by ${user.name} (${att.fileName}).`
        : `${store.name}: ${design.label} unlocked by ${user.name} — upload a new version.`,
      storeId: store.id,
      storeModuleId: m.id,
    });
  });
  return { ok: true };
}

/** DELETE /api/attachments/:id — the step's team removes a file from a step that is not yet approved.
 * Snag and site-photo files are removed by the person who uploaded them (or HQ). */
export async function deleteAttachment(user: CurrentUser, attachmentId: string) {
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { storeModule: true, snag: { select: { status: true } } } });
  if (!att) throw notFound("File not found");
  const store = await getStoreForUser(user, att.storeModule.storeId);
  const m = att.storeModule;
  if (att.snagId || att.siteUpdateId) {
    if (user.role !== "SUPER_ADMIN" && att.uploadedById !== user.id) throw forbidden("Only the person who uploaded this file can remove it.");
    if (att.snag?.status === "CLOSED") throw conflict("This snag is closed; its photos can no longer be changed.");
  } else {
    const template = await prisma.moduleTemplate.findUniqueOrThrow({ where: { moduleType: m.moduleType } });
    if (!can.editModule(user, store, template)) throw forbidden();
    if (m.status === "COMPLETED" && m.approvalStatus !== "REJECTED") {
      throw conflict("Files cannot be removed from a step that is Completed. Reopen it first.");
    }
    if (att.approvedAt) throw conflict("This is the approved final design. The design approver must unlock it first.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: att.id } });
    await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: m.id, action: "attachment.removed", oldValue: { fileName: att.fileName, tag: att.tag } });
  });
  await storage.remove(att.fileUrl);
}

/** GET /api/files/:id — streams a file after the store access check. */
export async function readAttachment(user: CurrentUser, attachmentId: string) {
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { storeModule: { select: { storeId: true } } } });
  if (!att) throw notFound("File not found");
  await getStoreForUser(user, att.storeModule.storeId);
  try {
    return { att, data: await storage.get(att.fileUrl) };
  } catch {
    throw notFound("File is missing from storage");
  }
}
