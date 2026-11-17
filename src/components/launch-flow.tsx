import { ArrowDown, ArrowRight, Check, ChevronRight, Circle, Clock, Lock, Rocket, Zap } from "lucide-react";
import Link from "next/link";
import type { AccessSubject } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ModuleView, StoreDetail } from "@/lib/queries";
import { teamLabel, teamsLabel } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { DoneBy } from "@/modules/types";
import { DecisionButtons } from "./decision-buttons";
import { ModuleStatusBadge, OverdueBadge } from "./status-badge";

/** Colours of the flow legend: who does a step, approvals and system actions. */
export const DONE_BY_STYLE: Record<DoneBy, { box: string; label: string }> = {
  SANGEETHA: { box: "border-indigo-300 bg-indigo-50 text-indigo-900", label: "Done by Sangeetha" },
  STORE_OWNER: { box: "border-rose-300 bg-rose-50 text-rose-900", label: "Done by store owner" },
  BOTH: { box: "border-emerald-300 bg-emerald-50 text-emerald-900", label: "Both" },
};
const APPROVAL_BOX = "border-amber-300 bg-amber-50 text-amber-950";
const SYSTEM_CHIP = "bg-sky-100 text-sky-900";

export function FlowLegend() {
  const item = (cls: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block size-3.5 rounded-sm border", cls)} aria-hidden />
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {item(DONE_BY_STYLE.SANGEETHA.box, "Done by Sangeetha")}
      {item(DONE_BY_STYLE.STORE_OWNER.box, "Done by store owner")}
      {item(DONE_BY_STYLE.BOTH.box, "Both")}
      {item(APPROVAL_BOX, "Approval")}
      {item("border-sky-200 bg-sky-100", "System action")}
    </div>
  );
}

const stepHref = (storeId: string, m: ModuleView) => `/stores/${storeId}/modules/${m.moduleType}`;
const tasksOf = (m: ModuleView) => m.fields.filter((f) => f.type === "task");

/** The store's launch, laid out like the "New outlet launch: user flow": steps 1–5, the eight
 * department tracks of step 6, all departments green, and 7 · Soft launch. */
export function LaunchFlow({ store, user }: { store: StoreDetail; user: AccessSubject }) {
  const pre = store.modules.filter((m) => m.step < 6);
  const tracks = store.modules.filter((m) => m.step === 6);
  const green = tracks.filter((t) => t.done).length;
  const allDone = store.modules.every((m) => m.done);

  return (
    <div className="space-y-3">
      <FlowLegend />
      <ol className="space-y-0">
        {pre.map((m, i) => (
          <li key={m.id}>
            {i > 0 && <Connector />}
            <StepRow m={m} store={store} user={user} />
          </li>
        ))}
      </ol>
      <Connector />
      <section className="rounded-xl border-2 border-dashed p-3 sm:p-4" aria-labelledby="step6">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <StepNumber n={6} />
          <h3 id="step6" className="font-semibold">
            Store setup · departments work in parallel
          </h3>
          <span className="text-sm text-muted-foreground">
            Each department owns its track and marks it green when done · {green} of {tracks.length} green
          </span>
        </div>
        {!store.keyHandoverDate && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden /> Starts when RK accepts the key handover (step 5). Every department is notified then.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tracks.map((m) => (
            <TrackCard key={m.id} m={m} storeId={store.id} />
          ))}
        </div>
      </section>
      <Connector />
      <div className={cn("mx-auto max-w-xl rounded-xl border px-4 py-3 text-center", allDone ? "border-emerald-400 bg-emerald-50" : APPROVAL_BOX)}>
        <p className="font-semibold">All departments green</p>
        <p className="text-sm opacity-80">
          Every track completed and approved · {store.approvedCount} of {store.totalSteps} steps done
        </p>
      </div>
      <Connector />
      <div
        className={cn(
          "mx-auto flex max-w-xl items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 text-center text-lg font-semibold",
          store.actualLaunchDate ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-900",
        )}
      >
        <Rocket className="size-5" aria-hidden />
        7 · Soft launch
        <span className="text-sm font-normal">
          {store.actualLaunchDate ? `— launched ${formatDate(store.actualLaunchDate)}` : store.targetLaunchDate ? `— target ${formatDate(store.targetLaunchDate)}` : ""}
        </span>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-1 text-muted-foreground/60" aria-hidden>
      <ArrowDown className="size-4" />
    </div>
  );
}

function StepNumber({ n, done }: { n: number; done?: boolean }) {
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold", done ? "bg-emerald-600 text-white" : "bg-foreground text-background")} aria-hidden>
      {done ? <Check className="size-4" /> : n}
    </span>
  );
}

function StepRow({ m, store, user }: { m: ModuleView; store: StoreDetail; user: AccessSubject }) {
  const style = DONE_BY_STYLE[m.doneBy];
  const tasks = tasksOf(m);
  const half = Math.ceil(tasks.length / 2);
  const canApprove = can.approveModule(user, store, m) && m.status === "COMPLETED" && m.approvalStatus === "PENDING";
  const afterValue = m.afterApproval ? (m.details[m.afterApproval.key] as string | undefined) : undefined;

  return (
    <div className="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)_15rem] md:items-stretch md:gap-3">
      <div className={cn("flex items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-semibold md:py-4", style.box)}>
        <span>
          {m.doneByLabel.split(",")[0]}
          {m.doneByLabel.includes(",") && <span className="block text-xs font-normal">{m.doneByLabel.split(",").slice(1).join(",").trim()}</span>}
        </span>
      </div>

      <Link href={stepHref(store.id, m)} className={cn("group block rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-foreground/25 sm:p-4", m.overdue && "border-red-300")}>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <StepNumber n={m.step} done={m.done} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-semibold group-hover:underline">
              {m.displayName} <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </p>
            <p className="text-sm text-muted-foreground">{m.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!m.done && <ModuleStatusBadge status={m.status} />}
            <OverdueBadge days={m.daysOverdue} />
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="mt-2 grid gap-x-6 sm:grid-cols-2 sm:pl-10">
            {[tasks.slice(0, half), tasks.slice(half)].map((col, ci) => (
              <ul key={ci} className="space-y-1 text-sm">
                {col.map((t) => (
                  <TaskLine key={t.key} done={m.details[t.key] === true} label={t.label} owner={t.owner} />
                ))}
              </ul>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5 sm:pl-10">
          {m.notes.map((n) => (
            <span key={n} className="text-xs text-muted-foreground">
              · {n}
            </span>
          ))}
          {m.afterApproval && (
            <span className={cn("rounded px-2 py-0.5 text-xs", SYSTEM_CHIP)}>
              {afterValue ? `${m.afterApproval.doneText}: ${afterValue}` : m.afterApproval.pendingText}
            </span>
          )}
          {m.systemAction && (
            <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs", SYSTEM_CHIP)}>
              <Zap className="size-3" aria-hidden />
              {m.systemAction}
              {m.done ? " ✓" : ""}
            </span>
          )}
          {m.waitingFor.length > 0 && m.status === "NOT_STARTED" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden /> Starts after {m.waitingFor.join(", ")}
            </span>
          )}
          {m.moduleType === "KEY_HANDOVER" && typeof m.details.handoverDate === "string" && (
            <span className="text-xs text-muted-foreground">· Handover date {formatDate(m.details.handoverDate)}</span>
          )}
        </div>
        {m.status === "BLOCKED" && m.blockerReason && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800 sm:ml-10">Blocked: {m.blockerReason}</p>}
      </Link>

      <div className="relative">
        <ArrowRight className="absolute top-1/2 -left-3 hidden size-3 -translate-y-1/2 text-muted-foreground/60 md:block" aria-hidden />
        <ApprovalBox m={m} canApprove={canApprove} />
      </div>
    </div>
  );
}

function TaskLine({ done, label, owner }: { done: boolean; label: string; owner?: string }) {
  return (
    <li className="flex items-start gap-1.5">
      {done ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-label="Done" /> : <Circle className="mt-1 size-2.5 shrink-0 fill-current text-muted-foreground/50" aria-label="Open" />}
      <span className={cn(done && "text-muted-foreground")}>
        {label}
        {owner && <span className="ml-1.5 text-xs text-muted-foreground">{owner}</span>}
      </span>
    </li>
  );
}

function ApprovalBox({ m, canApprove }: { m: ModuleView; canApprove: boolean }) {
  if (!m.approverTeam) {
    return (
      <div className={cn("h-full rounded-xl border p-3", APPROVAL_BOX)}>
        <p className="text-[11px] font-medium tracking-wide uppercase opacity-70">Owner</p>
        <p className="font-semibold">{teamsLabel(m.editTeams)}</p>
        <p className="text-sm opacity-80">{m.approvalNote}</p>
        <p className="mt-1.5 text-xs font-medium">{m.done ? "✓ Done" : m.status === "NOT_STARTED" ? "Not started" : "In progress"}</p>
      </div>
    );
  }
  const pending = m.status === "COMPLETED" && m.approvalStatus === "PENDING";
  return (
    <div className={cn("h-full rounded-xl border p-3", m.done ? "border-emerald-300 bg-emerald-50 text-emerald-950" : APPROVAL_BOX)}>
      <p className="text-[11px] font-medium tracking-wide uppercase opacity-70">Approval</p>
      <p className="font-semibold">{teamLabel(m.approverTeam)}</p>
      <p className="text-sm opacity-80">{m.approvalNote}</p>
      <p className="mt-1.5 text-xs font-medium">
        {m.done ? (
          <>
            ✓ Approved{m.approvedBy ? ` by ${m.approvedBy}` : ""}
            {m.approvedAt ? `, ${formatDateTime(m.approvedAt)}` : ""}
          </>
        ) : pending ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden /> Waiting for approval
          </span>
        ) : m.approvalStatus === "REJECTED" ? (
          <span className="text-red-700">Sent back{m.approvalComment ? `: “${m.approvalComment}”` : ""}</span>
        ) : (
          "Not submitted yet"
        )}
      </p>
      {canApprove && (
        <div className="mt-2">
          <DecisionButtons moduleId={m.id} moduleName={m.displayName} />
        </div>
      )}
    </div>
  );
}

function TrackCard({ m, storeId }: { m: ModuleView; storeId: string }) {
  const tasks = tasksOf(m);
  return (
    <Link
      href={stepHref(storeId, m)}
      className={cn(
        "group block rounded-lg border bg-card p-3 transition-colors hover:border-foreground/25",
        m.done && "border-emerald-400 bg-emerald-50",
        m.status === "BLOCKED" && "border-red-300",
        m.overdue && "ring-2 ring-red-300",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold group-hover:underline">{m.displayName}</p>
          <p className="text-xs font-medium text-indigo-700">{m.doneByLabel}</p>
        </div>
        {m.done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
            <Check className="size-3" aria-hidden /> Green
          </span>
        ) : (
          <ModuleStatusBadge status={m.status} />
        )}
      </div>
      <ul className="mt-2 space-y-0.5 text-sm">
        {tasks.map((t) => (
          <TaskLine key={t.key} done={m.details[t.key] === true} label={t.label} />
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {m.plannedStart ? (
          <span>
            Planned {formatDate(m.plannedStart)} – {formatDate(m.plannedEnd)}
          </span>
        ) : (
          <span>Scheduled from the key handover date</span>
        )}
        <OverdueBadge days={m.daysOverdue} />
      </div>
      {m.status === "BLOCKED" && m.blockerReason && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">Blocked: {m.blockerReason}</p>}
    </Link>
  );
}
