"use client";

import { Camera, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client-api";
import { formatBytes } from "@/lib/format";
import type { FileItem } from "./file-list";

// Hosting limit: Vercel accepts request bodies up to ~4.5 MB. Photos are shrunk in the browser first.
const MAX = 4.3 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** Resizes large photos (max 2000 px, JPEG) so phone camera images upload quickly on mobile data. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Upload photos/documents for one tag. Uses the phone camera when available (capture). */
export function Uploader({
  moduleId,
  tag,
  label,
  files,
  canEdit,
  photosOnly,
  hint,
  required,
  error,
}: {
  moduleId: string;
  tag: string;
  label: string;
  files: FileItem[];
  canEdit: boolean;
  photosOnly?: boolean;
  hint?: string;
  required?: boolean;
  error?: string;
}) {
  const router = useRouter();
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    let ok = 0;
    for (const original of Array.from(list)) {
      const file = await shrinkImage(original);
      if (file.size > MAX) {
        toast.error(`${original.name} is too large (max 4 MB per file on this hosting)`);
        continue;
      }
      setBusy(file.name);
      const form = new FormData();
      form.set("file", file);
      form.set("tag", tag);
      try {
        await api(`/api/modules/${moduleId}/attachments`, { form });
        ok++;
      } catch (e) {
        toast.error(e instanceof ApiError ? `${file.name}: ${e.message}` : `${file.name}: upload failed`);
      }
    }
    setBusy(null);
    if (camRef.current) camRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
    if (ok) {
      toast.success(`${ok} file${ok > 1 ? "s" : ""} uploaded`);
      router.refresh();
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await api(`/api/attachments/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove the file");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive"> *</span>} <span className="font-normal text-muted-foreground">({files.length})</span>
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
            <input ref={fileRef} type="file" accept={photosOnly ? "image/jpeg,image/png,image/webp" : ACCEPT} multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            <Button type="button" size="sm" variant="outline" onClick={() => camRef.current?.click()} disabled={!!busy}>
              <Camera className="size-4" /> Camera
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {photosOnly ? "Photos" : "Files"}
            </Button>
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && files.length === 0 && <p className="text-xs text-destructive">{error}</p>}
      {files.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {files.map((f) => (
            <li key={f.id} className="relative">
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border bg-muted">
                {f.fileType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${f.id}`} alt={f.fileName} className="aspect-square w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-[11px]">
                    <FileText className="size-6 text-muted-foreground" />
                    <span className="line-clamp-2 break-all">{f.fileName}</span>
                  </span>
                )}
              </a>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={f.fileName}>{f.fileType.startsWith("image/") ? `${f.fileName} · ` : ""}{formatBytes(f.sizeBytes)}</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  disabled={!!busy}
                  className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label={`Remove ${f.fileName}`}
                >
                  {busy === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{canEdit ? "Nothing uploaded yet." : "No files."}</p>
      )}
      {busy && !files.some((f) => f.id === busy) && <p className="text-xs text-muted-foreground">Uploading {busy}…</p>}
    </div>
  );
}
