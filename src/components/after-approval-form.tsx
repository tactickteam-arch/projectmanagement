"use client";

import { Loader2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client-api";

/** System action after approval, e.g. "PO raised in APX": the responsible team records the reference. */
export function AfterApprovalForm({ moduleId, label, title, value, canEdit, teams }: { moduleId: string; label: string; title: string; value: string | null; canEdit: boolean; teams: string }) {
  const router = useRouter();
  const [v, setV] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/modules/${moduleId}/after-approval`, { body: { value: v } });
      toast.success(`${label} saved`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-3 border-sky-200 bg-sky-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Zap className="size-4 text-sky-700" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <form onSubmit={submit} className="flex flex-wrap gap-2">
            <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={label} aria-label={label} className="max-w-56 bg-card" required />
            <Button type="submit" size="sm" className="h-9" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} {value ? "Update" : "Save"}
            </Button>
            {error && <p className="w-full text-xs text-destructive">{error}</p>}
          </form>
        ) : (
          <p className="text-sm">
            {value ? (
              <>
                {label}: <strong>{value}</strong>
              </>
            ) : (
              `Waiting for ${teams} to record the ${label}.`
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
