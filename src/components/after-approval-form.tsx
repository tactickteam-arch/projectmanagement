"use client";

import { Check, Loader2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/client-api";
import { displayValue } from "@/lib/field-display";
import { formatDateTime } from "@/lib/format";
import type { FieldDef } from "@/modules/types";
import { DynamicField } from "./dynamic-field";

export interface AfterActionView {
  key: string;
  label: string;
  pendingText: string;
  doneText: string;
  gate?: boolean;
  fields: FieldDef[];
  teamsLabel: string;
  record: (Record<string, unknown> & { recordedBy?: string; recordedAt?: string }) | null;
  canRecord: boolean;
}

/** A record made after approval by another team (SOP slide 5: HO pays the token advance; the PO is
 * raised in APX). Shown to everyone; the responsible team (or HQ) can record or correct it. */
export function AfterApprovalForm({ moduleId, action, approved }: { moduleId: string; action: AfterActionView; approved: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(action.fields.map((f) => [f.key, action.record?.[f.key] ?? null])));
  const [editing, setEditing] = useState(!action.record);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api(`/api/modules/${moduleId}/after-approval`, { body: { action: action.key, values } });
      toast.success(`${action.label} recorded`);
      setEditing(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else toast.error("Could not save");
    } finally {
      setBusy(false);
    }
  }

  const done = !!action.record;
  return (
    <Card className={done ? "gap-3 border-emerald-200 bg-emerald-50/60" : "gap-3 border-sky-200 bg-sky-50/60"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          {done ? <Check className="size-4 text-emerald-700" aria-hidden /> : <Zap className="size-4 text-sky-700" aria-hidden />} {done ? action.doneText : action.pendingText}
        </CardTitle>
        <CardDescription>
          {action.teamsLabel}
          {action.gate ? " · the step turns green once this is recorded" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!approved ? (
          <p className="text-sm text-muted-foreground">Recorded after the step is approved.</p>
        ) : done && !editing ? (
          <div className="space-y-2">
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              {action.fields.map((f) => (
                <div key={f.key}>
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="font-medium">{displayValue(f, action.record?.[f.key])}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Recorded by {action.record?.recordedBy ?? "—"}
              {action.record?.recordedAt ? `, ${formatDateTime(action.record.recordedAt)}` : ""}
            </p>
            {action.canRecord && (
              <Button size="sm" variant="outline" className="bg-card" onClick={() => setEditing(true)}>
                Correct
              </Button>
            )}
          </div>
        ) : action.canRecord ? (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            {action.fields.map((f) => (
              <DynamicField key={f.key} field={f} value={values[f.key]} onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))} error={errors[f.key]} idPrefix={`aa-${action.key}`} />
            ))}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" className="h-9" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />} {done ? "Save correction" : `Record ${action.label.toLowerCase()}`}
              </Button>
              {done && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : (
          <p className="text-sm">Waiting for {action.teamsLabel} to record the {action.label.toLowerCase()}.</p>
        )}
      </CardContent>
    </Card>
  );
}
