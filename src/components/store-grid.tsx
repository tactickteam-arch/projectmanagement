import { KeyRound } from "lucide-react";
import Link from "next/link";
import { MODULE_STATUS_LABELS } from "@/lib/status";
import type { StoreSummary } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MODULE_SHORT_LABELS, MODULE_DEFINITIONS } from "@/modules";
import { MODULE_STATUS_STYLE, StatusBadge } from "./status-badge";
import { ProgressBar } from "./progress-bar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/** Spec: Store × module grid — one row per store, one coloured cell per module
 * (green Completed, yellow In Progress, red Blocked, grey Not Started, red outline when overdue). */
export function StoreGrid({ stores, names }: { stores: StoreSummary[]; names: Record<string, string> }) {
  const columns = MODULE_DEFINITIONS.map((m) => m.moduleType);
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="sticky left-0 z-10 min-w-60 bg-muted/95 px-4 py-2.5 font-medium">Store</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Progress</th>
            {columns.map((c) => (
              <th key={c} className="px-1 py-2.5 text-center font-medium" title={names[c]}>
                {MODULE_SHORT_LABELS[c] ?? c}
              </th>
            ))}
            <th className="px-3 py-2.5 font-medium">Target launch</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                <Link href={`/stores/${s.id}`} className="block font-medium hover:underline">
                  {s.name}
                </Link>
                <span className="font-mono text-[11px] text-muted-foreground">{s.storeCode}</span>
                <span className="text-[11px] text-muted-foreground"> · {s.city} · {s.ownerName}</span>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={s.overallStatus} />
              </td>
              <td className="w-32 px-3 py-2.5">
                <div className="mb-1 text-xs tabular-nums text-muted-foreground">
                  {s.approvedCount}/7 · {s.progressPercent}%
                </div>
                <ProgressBar value={s.progressPercent} label={`${s.name} progress`} />
              </td>
              {columns.map((type) => {
                const c = s.cells.find((x) => x.moduleType === type);
                if (!c) return <td key={type} />;
                const st = MODULE_STATUS_STYLE[c.status];
                const milestone = type === "KEY_HANDOVER";
                const pending = c.status === "COMPLETED" && c.approvalStatus === "PENDING" && !milestone;
                const label = `${names[type] ?? type}: ${milestone ? (c.status === "COMPLETED" ? "Keys received" : "Not yet") : MODULE_STATUS_LABELS[c.status]}${pending ? " — awaiting HQ approval" : ""}${c.approvalStatus === "APPROVED" && !milestone ? " — approved" : ""}${c.overdue ? ` — ${c.daysOverdue} days overdue` : ""}`;
                return (
                  <td key={type} className="px-1 py-2.5 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={milestone ? `/stores/${s.id}/key-handover` : `/stores/${s.id}/modules/${type}`}
                          aria-label={`${s.name} — ${label}`}
                          className={cn(
                            "relative mx-auto grid h-7 w-12 place-items-center rounded",
                            st.cell,
                            c.overdue && "ring-2 ring-status-blocked ring-offset-1",
                          )}
                        >
                          {milestone ? <KeyRound className="size-3.5" aria-hidden /> : <st.Icon className="size-3.5" aria-hidden />}
                          {pending && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-sky-500 ring-2 ring-card" aria-hidden />}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                {s.actualLaunchDate ? (
                  <span>Launched {formatDate(s.actualLaunchDate)}</span>
                ) : (
                  formatDate(s.targetLaunchDate)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GridLegend() {
  const item = (cls: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block h-3 w-5 rounded-sm", cls)} aria-hidden />
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {item("bg-status-completed", "Completed")}
      {item("bg-status-progress", "In Progress")}
      {item("bg-status-blocked", "Blocked")}
      {item("bg-status-notstarted", "Not Started")}
      {item("bg-status-notstarted ring-2 ring-status-blocked", "Overdue")}
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-full bg-sky-500" aria-hidden />
        Awaiting HQ approval
      </span>
    </div>
  );
}
