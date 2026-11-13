import { Ban, Check, CircleDashed, Clock, Loader, X } from "lucide-react";
import type { ApprovalStatus, ModuleStatus, OverallStatus } from "@/generated/prisma/enums";
import { APPROVAL_STATUS_LABELS, MODULE_STATUS_LABELS, OVERALL_STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

const OVERALL: Record<OverallStatus, string> = {
  LOCATION_FINALISED: "bg-slate-100 text-slate-700 ring-slate-200",
  TOKEN_PAID: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  KEYS_RECEIVED: "bg-sky-50 text-sky-800 ring-sky-200",
  FITOUT_IN_PROGRESS: "bg-amber-50 text-amber-800 ring-amber-200",
  READY_FOR_LAUNCH: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  LAUNCHED: "bg-emerald-600 text-white ring-emerald-600",
  ON_HOLD: "bg-orange-50 text-orange-800 ring-orange-200",
  DROPPED: "bg-zinc-200 text-zinc-700 ring-zinc-300",
};

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

/** Overall store status — always text + colour, never colour alone. */
export function StatusBadge({ status, className }: { status: OverallStatus | null; className?: string }) {
  if (!status) return <span className={cn(pill, "bg-gray-50 text-gray-600 ring-gray-200", className)}>Not yet finalised</span>;
  return <span className={cn(pill, OVERALL[status], className)}>{OVERALL_STATUS_LABELS[status]}</span>;
}

export const MODULE_STATUS_STYLE: Record<ModuleStatus, { cell: string; pill: string; Icon: typeof Check }> = {
  COMPLETED: { cell: "bg-status-completed text-white", pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: Check },
  IN_PROGRESS: { cell: "bg-status-progress text-amber-950", pill: "bg-amber-50 text-amber-800 ring-amber-200", Icon: Loader },
  BLOCKED: { cell: "bg-status-blocked text-white", pill: "bg-red-50 text-red-700 ring-red-200", Icon: Ban },
  NOT_STARTED: { cell: "bg-status-notstarted text-slate-600", pill: "bg-slate-50 text-slate-600 ring-slate-200", Icon: CircleDashed },
};

export function ModuleStatusBadge({ status, className }: { status: ModuleStatus; className?: string }) {
  const s = MODULE_STATUS_STYLE[status];
  return (
    <span className={cn(pill, s.pill, className)}>
      <s.Icon className="size-3" aria-hidden />
      {MODULE_STATUS_LABELS[status]}
    </span>
  );
}

export function ApprovalBadge({ status, show }: { status: ApprovalStatus; show: boolean }) {
  if (!show) return null;
  const style =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "REJECTED"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-sky-50 text-sky-800 ring-sky-200";
  const Icon = status === "APPROVED" ? Check : status === "REJECTED" ? X : Clock;
  return (
    <span className={cn(pill, style)}>
      <Icon className="size-3" aria-hidden />
      HQ: {APPROVAL_STATUS_LABELS[status]}
    </span>
  );
}

export function OverdueBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  return (
    <span className={cn(pill, "bg-red-600 text-white ring-red-600")}>
      <Clock className="size-3" aria-hidden />
      {days} day{days === 1 ? "" : "s"} overdue
    </span>
  );
}
