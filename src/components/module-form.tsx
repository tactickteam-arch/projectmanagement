"use client";

import { CheckCircle2, Loader2, Lock, Save, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ModuleStatus } from "@/generated/prisma/enums";
import { api, ApiError } from "@/lib/client-api";
import type { ModuleView } from "@/lib/queries";
import { teamLabel } from "@/lib/teams";
import { DynamicField } from "./dynamic-field";

/** Form of one launch step, for the team that owns it: points, common fields and config-driven
 * fields; save a draft, or mark Completed (sent to the approver, or green when there is none). */
export function ModuleForm({ storeId, m, countingPhotos }: { storeId: string; m: ModuleView; countingPhotos: number }) {
  const router = useRouter();
  const approver = m.approverTeam ? teamLabel(m.approverTeam) : null;
  const locked = m.done;
  const awaiting = m.status === "COMPLETED" && m.approvalStatus === "PENDING";
  const prereqLocked = m.waitingFor.length > 0 && m.status === "NOT_STARTED";
  const disabled = locked || awaiting || prereqLocked;

  const [status, setStatus] = useState<ModuleStatus>(m.status === "COMPLETED" ? "IN_PROGRESS" : m.status);
  const [common, setCommon] = useState({
    blockerReason: m.blockerReason ?? "",
    plannedStart: m.plannedStart ?? "",
    plannedEnd: m.plannedEnd ?? "",
    actualStart: m.actualStart ?? "",
    actualEnd: m.actualEnd ?? "",
    vendorName: m.vendorName ?? "",
    vendorPhone: m.vendorPhone ?? "",
    estCost: m.estCost === null ? "" : String(m.estCost),
    actualCost: m.actualCost === null ? "" : String(m.actualCost),
    remarks: m.remarks ?? "",
  });
  const [details, setDetails] = useState<Record<string, unknown>>(m.details ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "complete" | "reopen" | null>(null);

  const fields = useMemo(() => m.fields.filter((f) => f.type !== "file" && f.type !== "task"), [m.fields]);
  const tasks = useMemo(() => m.fields.filter((f) => f.type === "task"), [m.fields]);
  const visible = (f: (typeof fields)[number]) => !f.showWhen || details[f.showWhen.key] === f.showWhen.equals;
  const set = (k: keyof typeof common) => (e: { target: { value: string } }) => setCommon((c) => ({ ...c, [k]: e.target.value }));

  async function save(kind: "save" | "complete" | "reopen") {
    const nextStatus: ModuleStatus = kind === "complete" ? "COMPLETED" : kind === "reopen" ? "IN_PROGRESS" : status;
    setBusy(kind);
    setErrors({});
    const body =
      kind === "reopen"
        ? { status: nextStatus }
        : {
            status: nextStatus,
            blockerReason: nextStatus === "BLOCKED" ? common.blockerReason : null,
            plannedStart: common.plannedStart || null,
            plannedEnd: common.plannedEnd || null,
            actualStart: common.actualStart || null,
            actualEnd: common.actualEnd || null,
            vendorName: common.vendorName,
            vendorPhone: common.vendorPhone,
            estCost: common.estCost === "" ? null : Number(common.estCost),
            actualCost: common.actualCost === "" ? null : Number(common.actualCost),
            remarks: common.remarks,
            details: Object.fromEntries(Object.entries(details).filter(([k]) => m.fields.some((f) => f.key === k && f.type !== "file"))),
          };
    try {
      await api(`/api/stores/${storeId}/modules/${m.moduleType}`, { method: "PATCH", body });
      toast.success(kind === "complete" ? (approver ? `Marked Completed — sent to ${approver} for approval` : "Marked done — this step is green") : kind === "reopen" ? "Step reopened" : "Saved");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        toast.error(e.message);
      } else toast.error("Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {locked && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <Lock className="size-4" />
          <AlertTitle>{approver ? `Approved by ${approver}` : "Done"}</AlertTitle>
          <AlertDescription>This step is done and locked.</AlertDescription>
        </Alert>
      )}
      {awaiting && (
        <Alert className="border-sky-200 bg-sky-50">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Completed — waiting for {approver ?? "HQ"} approval</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Fields are read-only while {approver ?? "HQ"} reviews. Reopen it if you need to change something.</span>
            <Button size="sm" variant="outline" onClick={() => save("reopen")} disabled={!!busy}>
              {busy === "reopen" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Reopen
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {prereqLocked && (
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Waiting for {m.waitingFor.join(", ")}</AlertTitle>
          <AlertDescription>
            {m.step === 6
              ? "Department tracks start once RK accepts the key handover — every department is notified then."
              : `This step can start once ${m.waitingFor.join(", ")} ${m.waitingFor.length > 1 ? "are" : "is"} done.`}
          </AlertDescription>
        </Alert>
      )}

      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Points</CardTitle>
            <CardDescription>Tick each point when it is done. All points must be ticked to {approver ? "send the step for approval" : "mark the step done"}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {tasks.map((f) => (
              <DynamicField key={f.key} field={f} value={details[f.key]} onChange={(v) => setDetails((d) => ({ ...d, [f.key]: v }))} error={errors[`details.${f.key}`]} disabled={disabled} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status &amp; schedule</CardTitle>
          {m.step === 6 && <CardDescription>Planned dates are filled from the key handover date (Day 0); you can change them.</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ModuleStatus)} disabled={disabled}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Use “{approver ? "Mark Completed" : "Mark done"}” below when the work is done.</p>
            {errors.status && <p className="text-xs text-destructive">{errors.status}</p>}
          </div>
          {status === "BLOCKED" && (
            <div className="space-y-1.5">
              <Label htmlFor="blocker">Blocker reason (required)</Label>
              <Textarea id="blocker" value={common.blockerReason} onChange={set("blockerReason")} disabled={disabled} rows={2} />
              {errors.blockerReason && <p className="text-xs text-destructive">{errors.blockerReason}</p>}
            </div>
          )}
          <DateField id="ps" label="Planned start" value={common.plannedStart} onChange={set("plannedStart")} disabled={disabled} />
          <DateField id="pe" label="Planned end" value={common.plannedEnd} onChange={set("plannedEnd")} disabled={disabled} error={errors.plannedEnd} />
          <DateField id="as" label="Actual start" value={common.actualStart} onChange={set("actualStart")} disabled={disabled} />
          <DateField id="ae" label="Actual end" value={common.actualEnd} onChange={set("actualEnd")} disabled={disabled} error={errors.actualEnd} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor &amp; cost</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vn">Vendor name</Label>
            <Input id="vn" value={common.vendorName} onChange={set("vendorName")} disabled={disabled} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vp">Vendor phone</Label>
            <Input id="vp" type="tel" value={common.vendorPhone} onChange={set("vendorPhone")} disabled={disabled} />
          </div>
          <MoneyField id="ec" label="Estimated cost" value={common.estCost} onChange={set("estCost")} disabled={disabled} error={errors.estCost} />
          <MoneyField id="ac" label="Actual cost" value={common.actualCost} onChange={set("actualCost")} disabled={disabled} error={errors.actualCost} />
        </CardContent>
      </Card>

      {fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{m.displayName} details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {fields.filter(visible).map((f) => (
              <DynamicField
                key={f.key}
                field={f}
                value={details[f.key]}
                onChange={(v) => setDetails((d) => ({ ...d, [f.key]: v }))}
                error={errors[`details.${f.key}`]}
                disabled={disabled}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={common.remarks} onChange={set("remarks")} disabled={disabled} rows={3} aria-label="Remarks" />
        </CardContent>
      </Card>

      {!disabled && (
        <div className="sticky bottom-16 z-20 -mx-4 border-t bg-card/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-lg md:border">
          {[errors.tasks, errors.photos].filter(Boolean).map((e) => (
            <p key={e} className="mb-2 text-sm text-destructive">
              {e}
            </p>
          ))}
          {Object.entries(errors)
            .filter(([k]) => k.startsWith("details.") && !tasks.some((t) => `details.${t.key}` === k))
            .map(([k, e]) => (
              <p key={k} className="mb-2 text-sm text-destructive">
                {e}
              </p>
            ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {tasks.length > 0 && (
                <>
                  Points done: <strong>{tasks.filter((t) => details[t.key] === true).length}</strong> of {tasks.length}
                  {m.minPhotos > 0 ? " · " : ""}
                </>
              )}
              {m.minPhotos > 0 && (
                <>
                  Photos: <strong className={countingPhotos >= m.minPhotos ? "text-emerald-700" : "text-foreground"}>{countingPhotos}</strong> of {m.minPhotos} required
                </>
              )}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="outline" className="h-11 flex-1 sm:h-9" onClick={() => save("save")} disabled={!!busy}>
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
              </Button>
              <Button className="h-11 flex-1 sm:h-9" onClick={() => save("complete")} disabled={!!busy}>
                {busy === "complete" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {approver ? `Mark Completed · send to ${approver}` : "Mark done (green)"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DateField({ id, label, value, onChange, disabled, error }: { id: string; label: string; value: string; onChange: (e: { target: { value: string } }) => void; disabled?: boolean; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={onChange} disabled={disabled} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function MoneyField({ id, label, value, onChange, disabled, error }: { id: string; label: string; value: string; onChange: (e: { target: { value: string } }) => void; disabled?: boolean; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
        <Input id={id} type="number" inputMode="decimal" min={0} value={value} onChange={onChange} disabled={disabled} className="pl-7" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
