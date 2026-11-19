import { ArrowDown, ArrowRight, CalendarClock, Check, ChevronRight, Circle, Clock, KeyRound, Lock, Rocket, Zap } from "lucide-react";
import Link from "next/link";
import type { AccessSubject } from "@/lib/auth/access";
import { can } from "@/lib/auth/permissions";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ModuleView, StoreDetail } from "@/lib/queries";
import { shiftDate } from "@/lib/sop-rules";
import { teamLabel, teamsLabel } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { DoneBy } from "@/modules/types";
import { DecisionButtons } from "./decision-buttons";
import { ModuleStatusBadge, OverdueBadge } from "./status-badge";

/** Colours of the flow: who does a step, approvals and system actions. */
export const DONE_BY_STYLE: Record<DoneBy, { box: string; label: string }> = {
  SANGEETHA: { box: "border-indigo-300 bg-indigo-50 text-indigo-900", label: "Done by Sangeetha" },
  STORE_OWNER: { box: "border-rose-300 bg-rose-50 text-rose-900", label: "Done by store owner" },
  BOTH: { box: "border-emerald-300 bg-emerald-50 text-emerald-900", label: "Sangeetha + store owner" },
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
      {item(DONE_BY_STYLE.BOTH.box, "Sangeetha + store owner")}
      {item(APPROVAL_BOX, "Approval gate")}
      {item("border-sky-200 bg-sky-100", "System action")}
      {item("border-emerald-400 bg-emerald-50", "Done / green")}
    </div>
  );
}

export const stepHref = (storeId: string, m: { moduleType: string }) => `/stores/${storeId}/modules/${m.moduleType}`;
const tasksOf = (m: ModuleView) => m.fields.filter((f) => f.type === "task");
const pendingApproval = (m: ModuleView) => m.status === "COMPLETED" && m.approvalStatus === "PENDING";

/** The store's launch along the New Outlet Launch SOP (slide 2): stages 1–3 and 5 as approval
 * gates, 4 alongside 3–5, the T-7 work before the keys, stage 6 (strict on-site order and the eight
 * department tracks), the all-departments-green gate and 7 · Soft launch. */
export function LaunchFlow({ store, user }: { store: StoreDetail; user: AccessSubject }) {
  const by = (t: string) => store.modules.find((m) => m.moduleType === t);
  const gate = (t: string) => by(t);
  const legal = by("LEGAL_STATUTORY");
  const preKey = store.modules.filter((m) => m.group === "prekey");
  const site = store.modules.filter((m) => m.group === "site");
  const tracks = store.modules.filter((m) => m.group === "track");
  const signBoard = by("SIGN_BOARD");
  const soft = by("SOFT_LAUNCH");
  const green = tracks.filter((t) => t.done).length;
  const keysFor = store.keyHandoverDate ?? store.expectedKeyDate;
  const t7 = keysFor ? shiftDate(keysFor, -7) : null;

  return (
    <div className="space-y-3">
      <FlowLegend />
      <ol className="space-y-0">
        {["LOCATION_FILING", "LANDLORD_CHECK", "TOKEN_ADVANCE"].map((t, i) => {
          const m = gate(t);
          return m ? (
            <li key={t}>
              {i > 0 && <Connector />}
              <StepRow m={m} store={store} user={user} />
            </li>
          ) : null;
        })}
      </ol>

      {legal && (
        <section className="rounded-xl border-2 border-dashed border-indigo-200 p-3 sm:p-4" aria-label="Stage 4 runs alongside stages 3 to 5">
          <p className="mb-2 text-xs font-medium tracking-wide text-indigo-800 uppercase">Runs alongside stages 3 – 5</p>
          <StepRow m={legal} store={store} user={user} />
        </section>
      )}

      <Connector />
      <section className="rounded-xl border-2 border-amber-300 bg-amber-50/40 p-3 sm:p-4" aria-labelledby="t7">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="grid h-7 shrink-0 place-items-center rounded-full bg-amber-500 px-2 text-xs font-bold text-white" aria-hidden>
            T-7
          </span>
          <h3 id="t7" className="font-semibold">
            Before the keys · one week ahead
          </h3>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <CalendarClock className="size-3.5" aria-hidden />
            {store.keyHandoverDate
              ? `Keys received ${formatDate(store.keyHandoverDate)}`
              : store.expectedKeyDate
                ? `Keys expected ${formatDate(store.expectedKeyDate)} · due by ${formatDate(t7)}${store.daysToExpectedKeys !== null ? ` · ${store.daysToExpectedKeys >= 0 ? `${store.daysToExpectedKeys} day${store.daysToExpectedKeys === 1 ? "" : "s"} to keys` : `${-store.daysToExpectedKeys} day${store.daysToExpectedKeys === -1 ? "" : "s"} past the expected date`}` : ""}`
                : "Enter the expected key date in the location filing (point 11)"}
          </span>
        </div>
        <p className="mb-3 text-xs text-amber-900">Zero-exception gate: no key handover without the external sign board completed and all materials ordered one week before.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {preKey.map((m) => (
            <CompactCard key={m.id} m={m} storeId={store.id} user={user} store={store} />
          ))}
        </div>
      </section>

      <Connector />
      {gate("KEY_HANDOVER") && <StepRow m={gate("KEY_HANDOVER")!} store={store} user={user} />}

      <Connector />
      <section className="rounded-xl border-2 border-dashed p-3 sm:p-4" aria-labelledby="stage6">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <StepNumber code="6" done={green === tracks.length && tracks.length > 0} />
          <h3 id="stage6" className="font-semibold">
            Parallel store setup · all departments
          </h3>
          <span className="text-sm text-muted-foreground">
            {green} of {tracks.length} departments green
          </span>
        </div>
        {!store.keyHandoverDate && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden /> Starts on Day 0, when RK accepts the key handover. The system notifies every department then.
          </p>
        )}
        {store.keyHandoverDate && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <KeyRound className="size-3.5" aria-hidden /> Day 0: {formatDate(store.keyHandoverDate)}
            {store.daysSinceHandover !== null ? ` · day ${store.daysSinceHandover}` : ""}
          </p>
        )}

        <h4 className="mt-2 text-sm font-medium">On site — strict 5-step order</h4>
        <p className="mb-2 text-xs text-muted-foreground">Each step starts when the one before it is done, to prevent rework.</p>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[signBoard, ...site].filter((m): m is ModuleView => !!m).map((m, i) => (
            <li key={m.id} className="relative">
              {i > 0 && <ArrowRight className="absolute top-1/2 -left-2.5 hidden size-3 -translate-y-1/2 text-muted-foreground/60 lg:block" aria-hidden />}
              <SiteChip m={m} storeId={store.id} />
            </li>
          ))}
        </ol>

        <h4 className="mt-5 text-sm font-medium">Department tracks — each marks its track green</h4>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tracks.map((m) => (
            <TrackCard key={m.id} m={m} storeId={store.id} />
          ))}
        </div>
      </section>

      <Connector />
      <div className={cn("mx-auto max-w-xl rounded-xl border px-4 py-3 text-center", green === tracks.length && tracks.length > 0 ? "border-emerald-400 bg-emerald-50 text-emerald-950" : APPROVAL_BOX)}>
        <p className="font-semibold">Gate: all departments green</p>
        <p className="text-sm opacity-80">
          {green} of {tracks.length} tracks green · {store.approvedCount} of {store.totalSteps} steps done
        </p>
      </div>
      <Connector />
      {soft && <StepRow m={soft} store={store} user={user} />}
      {store.actualLaunchDate && (
        <div className="mx-auto flex max-w-xl items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-600 px-4 py-3 text-center font-semibold text-white">
          <Rocket className="size-5" aria-hidden /> Soft launched {formatDate(store.actualLaunchDate)}
        </div>
      )}
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

export function StepNumber({ code, done }: { code: string; done?: boolean }) {
  return (
    <span
      className={cn("grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-1.5 text-xs font-semibold", done ? "bg-emerald-600 text-white" : "bg-foreground text-background")}
      aria-hidden
    >
      {done ? <Check className="size-4" /> : code}
    </span>
  );
}

function StepRow({ m, store, user }: { m: ModuleView; store: StoreDetail; user: AccessSubject }) {
  const style = DONE_BY_STYLE[m.doneBy];
  const tasks = tasksOf(m);
  const ticked = tasks.filter((t) => m.details[t.key] === true).length;
  const canApprove = can.approveModule(user, store, m) && pendingApproval(m);

  return (
    <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)_15rem] md:items-stretch md:gap-3">
      <div className={cn("flex items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-semibold md:py-4", style.box)}>{m.doneByLabel}</div>

      <Link href={stepHref(store.id, m)} className={cn("group block rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-foreground/25 sm:p-4", m.overdue && "border-red-300", m.done && "border-emerald-300")}>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <StepNumber code={m.code} done={m.done} />
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
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:pl-10">
          {tasks.length > 0 && (
            <span className={cn(ticked === tasks.length && "text-emerald-700")}>
              {ticked} of {tasks.length} points done
            </span>
          )}
          {m.plannedEnd && !m.done && <span>Due {formatDate(m.plannedEnd)}</span>}
          {m.moduleType === "KEY_HANDOVER" && typeof m.details.handoverDate === "string" && <span>Handover {formatDate(m.details.handoverDate)}</span>}
          {m.moduleType === "SOFT_LAUNCH" && typeof m.details.softLaunchDate === "string" && <span>Soft launch {formatDate(m.details.softLaunchDate)}</span>}
          {m.waitingFor.length > 0 && m.status === "NOT_STARTED" && (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden /> Starts after {m.waitingFor.join(", ")}
            </span>
          )}
        </div>
        {(m.afterActions.length > 0 || m.systemAction) && (
          <div className="mt-2 flex flex-wrap gap-1.5 sm:pl-10">
            {m.afterActions.map((a) => (
              <span key={a.key} className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs", a.record ? "bg-emerald-100 text-emerald-900" : SYSTEM_CHIP)}>
                {a.record ? <Check className="size-3" aria-hidden /> : <Zap className="size-3" aria-hidden />}
                {a.record ? a.doneText : a.pendingText}
              </span>
            ))}
            {m.systemAction && (
              <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs", SYSTEM_CHIP)}>
                <Zap className="size-3" aria-hidden />
                {m.systemAction}
                {m.done ? " ✓" : ""}
              </span>
            )}
          </div>
        )}
        {m.status === "BLOCKED" && m.blockerReason && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800 sm:ml-10">Blocked: {m.blockerReason}</p>}
      </Link>

      <div className="relative">
        <ArrowRight className="absolute top-1/2 -left-3 hidden size-3 -translate-y-1/2 text-muted-foreground/60 md:block" aria-hidden />
        <ApprovalBox m={m} canApprove={canApprove} />
      </div>
    </div>
  );
}

function TaskLine({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-1.5">
      {done ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-label="Done" /> : <Circle className="mt-1 size-2.5 shrink-0 fill-current text-muted-foreground/50" aria-label="Open" />}
      <span className={cn(done && "text-muted-foreground")}>{label}</span>
    </li>
  );
}

export function ApprovalBox({ m, canApprove }: { m: ModuleView; canApprove: boolean }) {
  if (!m.approverTeam) {
    return (
      <div className={cn("h-full rounded-xl border p-3", m.done ? "border-emerald-300 bg-emerald-50 text-emerald-950" : APPROVAL_BOX)}>
        <p className="text-[11px] font-medium tracking-wide uppercase opacity-70">{m.group === "launch" ? "Gate" : "Owner"}</p>
        <p className="font-semibold">{m.group === "launch" ? "All departments green" : teamsLabel(m.editTeams)}</p>
        <p className="text-sm opacity-80">{m.approvalNote}</p>
        <p className="mt-1.5 text-xs font-medium">{m.done ? "✓ Done" : m.status === "NOT_STARTED" ? "Not started" : m.status === "BLOCKED" ? "Blocked" : "In progress"}</p>
      </div>
    );
  }
  const gatesOpen = m.status === "COMPLETED" && m.approvalStatus === "APPROVED" && m.pendingGates.length > 0;
  return (
    <div className={cn("h-full rounded-xl border p-3", m.done ? "border-emerald-300 bg-emerald-50 text-emerald-950" : APPROVAL_BOX)}>
      <p className="text-[11px] font-medium tracking-wide uppercase opacity-70">Approval</p>
      <p className="font-semibold">{teamLabel(m.approverTeam)}</p>
      <p className="text-sm opacity-80">{m.approvalNote}</p>
      <p className="mt-1.5 text-xs font-medium">
        {m.status === "COMPLETED" && m.approvalStatus === "APPROVED" ? (
          <>
            ✓ Approved{m.approvedBy ? ` by ${m.approvedBy}` : ""}
            {m.approvedAt ? `, ${formatDateTime(m.approvedAt)}` : ""}
            {gatesOpen && <span className="mt-1 block text-sky-800">Next: {m.afterActions.find((a) => a.key === m.pendingGates[0])?.pendingText}</span>}
          </>
        ) : pendingApproval(m) ? (
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

function CompactCard({ m, storeId, store, user }: { m: ModuleView; storeId: string; store: StoreDetail; user: AccessSubject }) {
  const tasks = tasksOf(m);
  const ticked = tasks.filter((t) => m.details[t.key] === true).length;
  const canApprove = can.approveModule(user, store, m) && pendingApproval(m);
  return (
    <div className={cn("rounded-lg border bg-card p-3", m.done && "border-emerald-400 bg-emerald-50", m.overdue && !m.done && "ring-2 ring-red-300")}>
      <Link href={stepHref(storeId, m)} className="group block">
        <div className="flex items-start gap-2">
          <StepNumber code={m.code} done={m.done} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold group-hover:underline">{m.displayName}</p>
            <p className="text-xs text-indigo-700">{m.doneByLabel}</p>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{m.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {m.done ? (
            <span className="font-medium text-emerald-700">✓ Done{m.actualEnd ? ` ${formatDate(m.actualEnd)}` : ""}</span>
          ) : (
            <>
              <ModuleStatusBadge status={m.status} />
              {tasks.length > 0 && (
                <span>
                  {ticked}/{tasks.length} points
                </span>
              )}
              {m.plannedEnd && <span>Due {formatDate(m.plannedEnd)}</span>}
              <OverdueBadge days={m.daysOverdue} />
            </>
          )}
        </div>
        {m.approverTeam && !m.done && (
          <p className="mt-1.5 text-xs text-amber-900">
            Approval: {teamLabel(m.approverTeam)}
            {pendingApproval(m) ? " — waiting" : m.approvalStatus === "REJECTED" ? " — sent back" : ""}
          </p>
        )}
        {m.waitingFor.length > 0 && m.status === "NOT_STARTED" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden /> Starts after {m.waitingFor.join(", ")}
          </p>
        )}
      </Link>
      {canApprove && (
        <div className="mt-2">
          <DecisionButtons moduleId={m.id} moduleName={m.displayName} />
        </div>
      )}
    </div>
  );
}

function SiteChip({ m, storeId }: { m: ModuleView; storeId: string }) {
  return (
    <Link
      href={stepHref(storeId, m)}
      className={cn(
        "group flex h-full flex-col rounded-lg border bg-card p-2.5 transition-colors hover:border-foreground/25",
        m.done && "border-emerald-400 bg-emerald-50",
        m.status === "BLOCKED" && "border-red-300",
        m.overdue && !m.done && "ring-2 ring-red-300",
      )}
    >
      <span className="flex items-center gap-2">
        <StepNumber code={m.code} done={m.done} />
        <span className="text-sm font-medium group-hover:underline">{m.displayName}</span>
      </span>
      <span className="mt-1.5 text-xs text-muted-foreground">
        {m.done
          ? `✓ Done${m.actualEnd ? ` ${formatDate(m.actualEnd)}` : ""}`
          : m.waitingFor.length && m.status === "NOT_STARTED"
            ? `After ${m.waitingFor.join(", ")}`
            : m.status === "NOT_STARTED"
              ? "Ready to start"
              : m.status === "BLOCKED"
                ? "Blocked"
                : "In progress"}
      </span>
      {m.code === "6·1" && <span className="mt-0.5 text-[11px] text-amber-800">Pre-key (T-7)</span>}
      {!m.done && m.plannedEnd && <span className="mt-0.5 text-[11px] text-muted-foreground">Due {formatDate(m.plannedEnd)}</span>}
    </Link>
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
        m.overdue && !m.done && "ring-2 ring-red-300",
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
        {m.completeAfter.map((c) => (
          <TaskLine key={c.moduleType} done={c.done} label={c.name} />
        ))}
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
          <span>Planned from Day 0</span>
        )}
        <OverdueBadge days={m.daysOverdue} />
      </div>
      {m.status === "BLOCKED" && m.blockerReason && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">Blocked: {m.blockerReason}</p>}
    </Link>
  );
}
