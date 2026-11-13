import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { getModuleById } from "@/lib/services/modules";
import { getStoreForUser } from "@/lib/services/stores";
import { detectFileType, MAX_UPLOAD_BYTES, storage } from "@/lib/storage";

const Tag = z
  .string()
  .regex(/^[a-z0-9_]{1,40}$/, "Invalid attachment tag")
  .default("document");

/** POST /api/modules/:id/attachments — multipart form: file, tag. */
export async function uploadAttachment(user: CurrentUser, moduleId: string, form: FormData) {
  const { store, mod } = await getModuleById(user, moduleId);
  if (!can.uploadFiles(user, store)) throw forbidden("Only the store owner can upload files.");
  if (mod.status === "COMPLETED" && mod.approvalStatus === "APPROVED") {
    throw conflict("This module is approved by HQ; files can no longer be changed.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Choose a file to upload.");
  if (file.size === 0) throw badRequest("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError(413, "Files can be at most 10 MB.");
  const tag = Tag.parse(form.get("tag") ?? undefined);

  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectFileType(buf);
  if (!type) throw new AppError(415, "Only JPG, PNG, WebP photos and PDF documents are accepted.");

  const key = `${store.id}/${mod.id}/${randomUUID()}.${type.ext}`;
  await storage.put(key, buf);
  const fileName = (file.name || `upload.${type.ext}`).replace(/[^\w.\- ()]/g, "_").slice(0, 120);

  try {
    return await prisma.$transaction(async (tx) => {
      const att = await tx.attachment.create({
        data: { storeModuleId: mod.id, fileUrl: key, fileType: type.mime, fileName, sizeBytes: buf.length, tag, uploadedById: user.id },
      });
      await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: mod.id, action: "attachment.added", newValue: { fileName, tag } });
      return att;
    });
  } catch (e) {
    await storage.remove(key);
    throw e;
  }
}

/** DELETE /api/attachments/:id — owner removes a file from a module that is not yet approved. */
export async function deleteAttachment(user: CurrentUser, attachmentId: string) {
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { storeModule: true } });
  if (!att) throw notFound("File not found");
  const store = await getStoreForUser(user, att.storeModule.storeId);
  if (!can.uploadFiles(user, store)) throw forbidden();
  const m = att.storeModule;
  if (m.status === "COMPLETED" && m.approvalStatus !== "REJECTED") {
    throw conflict("Files cannot be removed from a module that is Completed. Change its status first.");
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
