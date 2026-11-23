import "server-only";
import { prisma } from "@/lib/db";

/**
 * File storage abstraction. The demo keeps file contents in the database (table file_blobs):
 * free, no extra account, and it works on serverless hosting (Vercel) where local disk is
 * not persistent. Swap in an S3 / Supabase Storage driver later without touching callers.
 * Files are never served directly — only through /api/files/:id after an access check.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const databaseStorage: StorageDriver = {
  async put(key, data) {
    await prisma.fileBlob.upsert({ where: { key }, create: { key, data: new Uint8Array(data) }, update: { data: new Uint8Array(data) } });
  },
  async get(key) {
    const row = await prisma.fileBlob.findUnique({ where: { key } });
    if (!row) throw new Error("File not found in storage");
    return Buffer.from(row.data);
  },
  async remove(key) {
    await prisma.fileBlob.deleteMany({ where: { key } });
  },
};

export const storage: StorageDriver = databaseStorage;

/** Spec allows 10 MB; on Vercel the request body limit is ~4.5 MB, so the browser shrinks photos first. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Allowed upload types, detected from file content (not the client-supplied name/type). */
export function detectFileType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: "png" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

/** Short phone videos (snag fixes): MP4 / MOV (ISO "ftyp" box) and WebM. */
export function detectVideoType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    return brand === "qt  " ? { mime: "video/quicktime", ext: "mov" } : { mime: "video/mp4", ext: "mp4" };
  }
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: "video/webm", ext: "webm" };
  return null;
}

export function isImageType(mime: string): boolean {
  return mime.startsWith("image/");
}
