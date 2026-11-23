"use client";

import { AlertTriangle, CheckCircle2, Link2, Loader2, Lock, Save, ShieldCheck, Undo2 } from "lucide-react";
import Link from "next/link";
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
import { formatDate } from "@/lib/format";
import type { ModuleView } from "@/lib/queries";
import { acProblems, acRequirement, powerLoadProblems, preKeyProblems, requiredLoadKw, shiftDate } from "@/lib/sop-rules";
import { teamLabel } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { FieldDef } from "@/modules/types";
import { DynamicField } from "./dynamic-field";
import { DesignVersions } from "./design-versions";
import { Uploader } from "./uploader";

export interface PreKeyState {
  signBoard: { done: boolean; completedOn: string | null };
  materials: { done: boolean; completedOn: string | null };
}

const visible = (f: FieldDef, d: Record<string, unknown>) => !f.showWhen || d[f.showWhen.key] === f.showWhen.equals;

/** One SOP step, for the teams that fill it in (or read-only for everyone else): points, the
 * step's sheet grouped by section, files, schedule; save a draft, or mark Completed (sent to the
 * approver, or green when there is none). */
export function ModuleForm({
  storeId,
  m,
  areaSqft,
  preKey,
  readOnly,
}: {
  storeId: string;
  m: ModuleView;
  areaSqft: number | null;
  preKey?: PreKeyState;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const approver = m.approverTeam ? teamLabel(m.approverTeam) : null;
  const awaiting = m.status === "COMPLETED" && m.approvalStatus === "PENDING";
  const prereqLocked = m.waitingFor.length > 0 && m.status === "NOT_STARTED";
  const locked = m.status === "COMPLETED" && m.approvalStatus === "APPROVED";
  const disabled = !!readOnly || locked || awaiting || prereqLocked;
  const filesEditable = !readOnly && !locked && !awaiting && !prereqLocked;

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

  const tasks = useMemo(() => m.fields.filter((f) => f.type === "task" && !f.section), [m.fields]);
  const sections = useMemo(() => {
    const out: { title: string; fields: FieldDef[] }[] = [];
    for (const f of m.fields) {
      if (f.type === "task" && !f.section) continue;
      const title = f.section ?? (f.type === "file" ? "Documents & photos" : `${m.displayName} details`);
      let s = out.find((x) => x.title === title);
      if (!s) out.push((s = { title, fields: [] }));
      s.fields.push(f);
    }
    return out;
  }, [m.fields, m.displayName]);
  const allTasks = m.fields.filter((f) => f.type === "task");
  const files = (tag: string) => m.attachments.filter((a) => a.tag === tag);
  const set = (k: keyof typeof common) => (e: { target: { value: string } }) => setCommon((c) => ({ ...c, [k]: e.target.value }));
  const setField = (k: string) => (v: unknown) => setDetails((d) => ({ ...d, [k]: v }));
  const showVendor = ["prekey", "site", "track", "parallel"].includes(m.group) || m.vendorName || m.estCost !== null || m.actualCost !== null;
  const otherTags = new Set(m.fields.filter((f) => f.type === "file").map((f) => f.attachmentTag ?? "document"));
  const otherFiles = m.attachments.filter((a) => !otherTags.has(a.tag ?? "document"));

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
            details: Object.fromEntries(Object.entries(details).filter(([k]) => m.fields.some((f) => f.key === k && f.type !== "file" && !f.fromStore))),
          };
    try {
      await api(`/api/stores/${storeId}/modules/${m.moduleType}`, { method: "PATCH", body });
      toast.success(kind === "complete" ? (approver ? `Sent to ${approver} for approval` : "Marked done — this step is green") : kind === "reopen" ? "Step reopened" : "Saved");
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

  const summaryErrors = [errors.status, errors.sop, errors.required, errors.tasks, errors.actualEnd, errors.photos].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {awaiting && !readOnly && (
        <Alert className="border-sky-200 bg-sky-50">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Completed — waiting for {approver ?? "HQ"} approval</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Fields are read-only while {approver ?? "HQ"} reviews. Reopen the step to change something.</span>
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
            {m.group === "track" || m.group === "site"
              ? "Stage 6 starts on Day 0, when RK accepts the key handover. On site, each step starts when the one before it is done."
              : `This step can start once ${m.waitingFor.join(", ")} ${m.waitingFor.length > 1 ? "are" : "is"} done.`}
          </AlertDescription>
        </Alert>
      )}

      <SopPanel m={m} details={details} areaSqft={areaSqft} preKey={preKey} />

      {m.completeAfter.length > 0 && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Link2 className="size-4" aria-hidden /> Linked steps
            </CardTitle>
            <CardDescription>These steps are part of this one and must be done before it can be marked {approver ? "Completed" : "green"}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {m.completeAfter.map((c) => (
                <li key={c.moduleType} className="flex items-center gap-2">
                  <span className={c.done ? "text-emerald-700" : "text-muted-foreground"}>{c.done ? "✓" : "○"}</span>
                  <Link href={`/stores/${storeId}/modules/${c.moduleType}`} className="hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{c.done ? "done" : "not done yet"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Points</CardTitle>
            {!disabled && <CardDescription>Tick each point when it is done. All points must be ticked to {approver ? "send the step for approval" : "mark the step done"}.</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-1">
            {tasks.map((f) => (
              <DynamicField key={f.key} field={f} value={details[f.key]} onChange={setField(f.key)} error={errors[`details.${f.key}`]} disabled={disabled} />
            ))}
          </CardContent>
        </Card>
      )}

      {sections.map((s) => {
        const sectionTasks = s.fields.filter((f) => f.type === "task");
        const rest = s.fields.filter((f) => f.type !== "task" && visible(f, details));
        return (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sectionTasks.length > 0 && (
                <div className="space-y-1">
                  {sectionTasks.map((f) => (
                    <DynamicField key={f.key} field={f} value={details[f.key]} onChange={setField(f.key)} error={errors[`details.${f.key}`]} disabled={disabled} />
                  ))}
                </div>
              )}
              {rest.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {rest.map((f) =>
                    f.type === "file" && f.design ? (
                      <div key={f.key} className="sm:col-span-2">
                        <DesignVersions
                          moduleId={m.id}
                          tag={f.attachmentTag ?? "document"}
                          label={f.label}
                          files={files(f.attachmentTag ?? "document")}
                          canEdit={filesEditable}
                          canApprove={m.canApproveDesign}
                          stepClosed={locked || awaiting}
                          required={f.required}
                          error={errors[`file.${f.attachmentTag ?? "document"}`]}
                        />
                        {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
                      </div>
                    ) : f.type === "file" ? (
                      <div key={f.key} className="sm:col-span-2">
                        <Uploader
                          moduleId={m.id}
                          tag={f.attachmentTag ?? "document"}
                          label={`${f.sr !== undefined ? `${f.sr}. ` : ""}${f.label}`}
                          files={files(f.attachmentTag ?? "document")}
                          canEdit={filesEditable}
                          photosOnly={(f.attachmentTag ?? "").startsWith("photo")}
                          required={f.required}
                          error={errors[`file.${f.attachmentTag ?? "document"}`]}
                        />
                      </div>
                    ) : (
                      <DynamicField key={f.key} field={f} value={details[f.key]} onChange={setField(f.key)} error={errors[`details.${f.key}`]} disabled={disabled} />
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status &amp; schedule</CardTitle>
          <CardDescription>Planned dates follow the 13-week chart{m.group === "track" || m.group === "site" ? " from Day 0 (key handover)" : m.group === "prekey" && m.code !== "Q" ? " back from the expected key date" : ""}; you can change them.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {!readOnly && (
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
              {!disabled && <p className="text-xs text-muted-foreground">Use “{approver ? "Mark Completed" : "Mark done"}” below when the work is done.</p>}
              {errors.status && <p className="text-xs text-destructive">{errors.status}</p>}
            </div>
          )}
          {status === "BLOCKED" && !readOnly && (
            <div className="space-y-1.5">
              <Label htmlFor="blocker">Blocker reason (required)</Label>
              <Textarea id="blocker" value={common.blockerReason} onChange={set("blockerReason")} disabled={disabled} rows={2} />
              {errors.blockerReason && <p className="text-xs text-destructive">{errors.blockerReason}</p>}
            </div>
          )}
          <DateField id="ps" label="Planned start" value={common.plannedStart} onChange={set("plannedStart")} disabled={disabled} />
          <DateField id="pe" label="Planned end (due)" value={common.plannedEnd} onChange={set("plannedEnd")} disabled={disabled} error={errors.plannedEnd} />
          <DateField id="as" label="Actual start" value={common.actualStart} onChange={set("actualStart")} disabled={disabled} />
          <DateField id="ae" label={m.requireActualEnd ? "Actual end (finished on) *" : "Actual end"} value={common.actualEnd} onChange={set("actualEnd")} disabled={disabled} error={errors.actualEnd} />
        </CardContent>
      </Card>

      {showVendor && (
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
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remarks &amp; other files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={common.remarks} onChange={set("remarks")} disabled={disabled} rows={3} aria-label="Remarks" placeholder={disabled ? "" : "Notes for the team and approver"} />
          <Uploader moduleId={m.id} tag="document" label="Other photos & documents" files={otherFiles} canEdit={filesEditable} />
        </CardContent>
      </Card>

      {!disabled && (
        <div className="sticky bottom-16 z-20 -mx-4 border-t bg-card/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-lg md:border">
          {summaryErrors.map((e) => (
            <p key={e} className="mb-2 flex items-start gap-1.5 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {e}
            </p>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {allTasks.length > 0 && (
                <>
                  Points done: <strong>{allTasks.filter((t) => details[t.key] === true).length}</strong> of {allTasks.length}
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

/** Live SOP checks for this step: power load (slide 4), AC sizing (slide 8), T-7 rule (slide 6). */
function SopPanel({ m, details, areaSqft, preKey }: { m: ModuleView; details: Record<string, unknown>; areaSqft: number | null; preKey?: PreKeyState }) {
  const rows: { title: string; need: string; problems: string[] }[] = [];
  if (m.checks.includes("powerLoad")) {
    const need = areaSqft ? requiredLoadKw(areaSqft) : null;
    rows.push({
      title: "3-phase power load (slide 4)",
      need: need
        ? `${areaSqft?.toLocaleString("en-IN")} sq ft store → at least ${need.kw} kW sanctioned, 3-phase only${need.beyondTable ? " (above 3,000 sq ft the table ends; 30 kW is the minimum — confirm with HO)" : ""}.`
        : "Add the store size (carpet area) under Store info.",
      problems: powerLoadProblems(areaSqft, details.powerSupply, details.powerCapacityKw ?? details.sanctionedLoadKw).filter((p) => !p.startsWith("Enter the store size")),
    });
  }
  if (m.checks.includes("acSizing")) {
    const need = areaSqft ? acRequirement(areaSqft) : null;
    rows.push({
      title: "AC type & tonnage (slide 8)",
      need: need ? `${areaSqft?.toLocaleString("en-IN")} sq ft store → ${need.type}, at least ${need.minTons} ton in total (1 ton per 150 sq ft, rounded up), 4 sq mm 4-core cable.` : "Add the store size (carpet area) under Store info.",
      problems: acProblems(areaSqft, details.acType, details.acTonnage).filter((p) => !p.startsWith("Enter the store size")),
    });
  }
  if (m.checks.includes("preKeyT7") && preKey) {
    const handover = typeof details.handoverDate === "string" ? details.handoverDate : null;
    rows.push({
      title: "T-7 rule (slide 6)",
      need: handover
        ? `Handover on ${formatDate(handover)} → the external sign board and material ordering must be done by ${formatDate(shiftDate(handover, -7))}.`
        : "The external sign board must be completed and all materials ordered one week before the key handover.",
      problems: preKeyProblems(handover, preKey.signBoard, preKey.materials),
    });
  }
  if (!rows.length) return null;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <ShieldCheck className="size-4" aria-hidden /> SOP checks
        </CardTitle>
        <CardDescription>Checked automatically — the step cannot be completed or approved while a check fails.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.title} className={cn("rounded-md border p-3 text-sm", r.problems.length ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
            <p className="font-medium">
              {r.problems.length ? "✗" : "✓"} {r.title}
            </p>
            <p className="text-muted-foreground">{r.need}</p>
            {r.problems.map((p) => (
              <p key={p} className="mt-1 text-red-800">
                {p}
              </p>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
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
