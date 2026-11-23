"use client";

import { CheckCircle2, FileText, Loader2, Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client-api";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { FileItem } from "./file-list";
import { Uploader } from "./uploader";

/**
 * A design kept in versions (store layout, sign board design). The team uploads each new version;
 * the design approver (Sumanth) approves one as final, which locks the design until it is unlocked.
 */
export function DesignVersions({
  moduleId,
  tag,
  label,
  files,
  canEdit,
  canApprove,
  stepClosed,
  required,
  error,
}: {
  moduleId: string;
  tag: string;
  label: string;
  files: FileItem[];
  canEdit: boolean;
  canApprove: boolean;
  stepClosed: boolean;
  required?: boolean;
  error?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const final = files.find((f) => f.approvedAt);
  const versions = files.map((f, i) => ({ ...f, version: i + 1 })).reverse();

  async function decide(id: string, lock: boolean) {
    setBusy(id);
    try {
      await api(`/api/attachments/${id}/final`, { method: lock ? "POST" : "DELETE" });
      toast.success(lock ? "Approved as the final design" : "Design unlocked");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update the design");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {final ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Final {label.toLowerCase()} approved by {final.approvedBy?.name ?? "the design approver"} on {formatDateTime(final.approvedAt as string)}. Locked: no new versions until it is unlocked.
          </span>
        </div>
      ) : (
        files.length > 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Waiting for the design approver to approve the final version.
          </p>
        )
      )}
      {final ? (
        <p className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive"> *</span>} <span className="font-normal text-muted-foreground">({files.length} version{files.length === 1 ? "" : "s"})</span>
        </p>
      ) : (
        <Uploader
          moduleId={moduleId}
          tag={tag}
          label={`${label} — upload each new version`}
          files={[]}
          canEdit={canEdit}
          required={required}
          error={files.length === 0 ? error : undefined}
          hideEmpty={files.length > 0}
        />
      )}
      {!final && error && files.length > 0 && <p className="text-xs text-destructive">{error}</p>}
      {versions.length > 0 && (
        <ul className="divide-y rounded-md border">
          {versions.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-sm">
              <span className="w-8 shrink-0 font-medium tabular-nums text-muted-foreground">v{f.version}</span>
              {f.fileType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${f.id}`} alt="" className="size-10 shrink-0 rounded border object-cover" loading="lazy" />
              ) : (
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline" title={f.fileName}>
                {f.fileName}
              </a>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(f.uploadedAt)} · {formatBytes(f.sizeBytes)}
              </span>
              {f.approvedAt ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="size-3.5" /> Final
                </Badge>
              ) : null}
              {canApprove && !stepClosed && (
                f.approvedAt ? (
                  <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => decide(f.id, false)}>
                    {busy === f.id ? <Loader2 className="size-4 animate-spin" /> : <LockOpen className="size-4" />} Unlock
                  </Button>
                ) : (
                  !final && (
                    <Button type="button" size="sm" disabled={!!busy} onClick={() => decide(f.id, true)}>
                      {busy === f.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve as final
                    </Button>
                  )
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
