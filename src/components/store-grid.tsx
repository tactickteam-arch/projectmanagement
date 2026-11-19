import { Ban, Check, CircleDashed, Clock, Loader } from "lucide-react";
import Link from "next/link";
import type { StageCell, StoreSummary } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STAGE_COLUMNS } from "@/modules";
import { StatusBadge } from "./status-badge";
import { ProgressBar } from "./progress-bar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const CELL: Record<StageCell["state"], { cls: string; Icon: typeof Check; text: string }> = {
  done: { cls: "bg-status-completed text-white", Icon: Check, text: "Done" },
  progress: { cls: "bg-status-progress text-amber-950", Icon: Loader, text: "In progress" },
  pending: { cls: "bg-sky-500 text-white", Icon: Clock, text: "Waiting for approval / a record" },
  blocked: { cls: "bg-status-blocked text-white", Icon: Ban, text: "Blocked" },
  notstarted: { cls: "bg-status-notstarted text-slate-600", Icon: CircleDashed, text: "Not started" },
};

/** Store × SOP stage grid — one row per store, one cell per stage (1, 2, 3, 4, T-7, 5, 6 on site,
 * 6 departments, 7). Stages with several steps show "done of total". Red outline = overdue. */
export function StoreGrid({ stores }: { stores: StoreSummary[]; names?: Record<string, string> }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
      <table className="w-full min-w-[1050px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="sticky left-0 z-10 min-w-60 bg-muted/95 px-4 py-2.5 font-medium">Store</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Progress</th>
            {STAGE_COLUMNS.map((c) => (
              <th key={c.key} className="px-1 py-2.5 text-center text-[11px] leading-tight font-medium" title={c.title}>
                {c.label}
              </th>
            ))}
            <th className="px-3 py-2.5 font-medium">Keys · launch</th>
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
                <span className="text-[11px] text-muted-foreground">
                  {" "}
                  · {s.city} · {s.ownerName}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={s.overallStatus} />
              </td>
              <td className="w-32 px-3 py-2.5">
                <div className="mb-1 text-xs tabular-nums text-muted-foreground">
                  {s.approvedCount}/{s.totalSteps} · {s.progressPercent}%
                </div>
                <ProgressBar value={s.progressPercent} label={`${s.name} progress`} />
              </td>
              {STAGE_COLUMNS.map((c) => {
                const cell = s.stages.find((x) => x.key === c.key);
                if (!cell || cell.total === 0) return <td key={c.key} />;
                const st = CELL[cell.state];
                const label = `${c.title}: ${st.text}${cell.total > 1 ? ` (${cell.done} of ${cell.total} done)` : ""}${cell.overdue ? ` — ${cell.overdue} overdue` : ""}`;
                const href = cell.firstOpen ? `/stores/${s.id}/modules/${cell.firstOpen}` : `/stores/${s.id}`;
                return (
                  <td key={c.key} className="px-1 py-2.5 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={href}
                          aria-label={`${s.name} — ${label}`}
                          className={cn("relative mx-auto grid h-7 w-12 place-items-center rounded text-[11px] font-semibold tabular-nums", st.cls, cell.overdue > 0 && "ring-2 ring-status-blocked ring-offset-1")}
                        >
                          {cell.total > 1 && cell.state !== "done" ? (
                            <span>
                              {cell.done}/{cell.total}
                            </span>
                          ) : (
                            <st.Icon className="size-3.5" aria-hidden />
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                {s.actualLaunchDate ? (
                  <span className="font-medium text-emerald-700">Launched {formatDate(s.actualLaunchDate)}</span>
                ) : (
                  <span className="block">
                    {s.keyHandoverDate ? `Keys ${formatDate(s.keyHandoverDate)}` : s.expectedKeyDate ? `Keys exp. ${formatDate(s.expectedKeyDate)}` : "Keys: date not set yet"}
                    <span className="block text-muted-foreground">Target {formatDate(s.targetLaunchDate)}</span>
                  </span>
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
      {item("bg-status-completed", "Done")}
      {item("bg-status-progress", "In progress")}
      {item("bg-sky-500", "Waiting for approval / record")}
      {item("bg-status-blocked", "Blocked")}
      {item("bg-status-notstarted", "Not started")}
      {item("bg-status-notstarted ring-2 ring-status-blocked", "Overdue")}
      <span>“2/5” = steps done in that stage</span>
    </div>
  );
}
