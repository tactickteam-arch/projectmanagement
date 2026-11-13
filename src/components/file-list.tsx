import { FileText } from "lucide-react";
import { formatBytes, formatDateTime } from "@/lib/format";

export interface FileItem {
  id: string;
  fileType: string;
  fileName: string;
  tag: string | null;
  sizeBytes: number;
  uploadedAt: string;
}

export const TAG_LABELS: Record<string, string> = {
  photo_before: "Before",
  photo_during: "During",
  photo_after: "After",
  photo_handover: "Handover photo",
  photo_final: "Final store photo",
  photo_frontage: "Frontage",
  photo_interior: "Interior",
  photo_branding_item: "Branding item",
  invoice: "Invoice",
  receipt: "Receipt",
  agreement: "Agreement",
  design: "Design file",
  permit: "Permit",
  document: "Document",
};

/** Thumbnails for photos and rows for documents; all served via the access-checked /api/files route. */
export function FileGallery({ files, empty = "No files yet." }: { files: FileItem[]; empty?: string }) {
  if (!files.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const images = files.filter((f) => f.fileType.startsWith("image/"));
  const docs = files.filter((f) => !f.fileType.startsWith("image/"));
  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((f) => (
            <li key={f.id}>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-md border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${f.id}`} alt={`${TAG_LABELS[f.tag ?? ""] ?? "Photo"}: ${f.fileName}`} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              </a>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{TAG_LABELS[f.tag ?? ""] ?? f.tag ?? "Photo"}</p>
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && (
        <ul className="divide-y rounded-md border">
          {docs.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                {f.fileName}
              </a>
              <span className="hidden text-xs text-muted-foreground sm:inline">{TAG_LABELS[f.tag ?? ""] ?? f.tag}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(f.sizeBytes)}</span>
              <span className="hidden text-xs text-muted-foreground md:inline">{formatDateTime(f.uploadedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
