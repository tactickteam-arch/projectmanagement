import { daysBetween, parseDateOnly } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { ModuleView } from "@/lib/queries";

/** Planned vs actual dates for the fit-out modules (spec: HQ store detail timeline). */
export function Timeline({ modules, handover, targetLaunch, today }: { modules: ModuleView[]; handover: string | null; targetLaunch: string | null; today: string }) {
  const rows = modules.filter((m) => m.plannedStart || m.actualStart);
  if (!handover || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">The timeline appears once the key handover date is recorded — fit-out modules are scheduled from it.</p>;
  }
  const dates = [handover, targetLaunch, today, ...rows.flatMap((m) => [m.plannedStart, m.plannedEnd, m.actualStart, m.actualEnd])].filter(Boolean) as string[];
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const span = Math.max(1, daysBetween(parseDateOnly(min), parseDateOnly(max)) + 1);
  const pos = (d: string) => (daysBetween(parseDateOnly(min), parseDateOnly(d)) / span) * 100;
  const width = (a: string, b: string) => Math.max(1.5, ((daysBetween(parseDateOnly(a), parseDateOnly(b)) + 1) / span) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-5 rounded-sm bg-slate-300" aria-hidden /> Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-5 rounded-sm bg-primary" aria-hidden /> Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-foreground" aria-hidden /> Today
        </span>
        <span>
          Day 0 (keys): {formatDate(handover)} · Target launch: {formatDate(targetLaunch)}
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((m) => {
          const actualEnd = m.actualEnd ?? (m.actualStart ? today : null);
          return (
            <div key={m.id} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 text-xs sm:grid-cols-[14rem_1fr]">
              <div className="truncate" title={m.displayName}>
                {m.displayName}
                {m.overdue && <span className="ml-1 font-medium text-red-600">· {m.daysOverdue}d late</span>}
              </div>
              <div className="relative h-7 rounded bg-muted/60">
                {m.plannedStart && m.plannedEnd && (
                  <div
                    className="absolute top-1 h-2 rounded-sm bg-slate-300"
                    style={{ left: `${pos(m.plannedStart)}%`, width: `${width(m.plannedStart, m.plannedEnd)}%` }}
                    title={`Planned ${formatDate(m.plannedStart)} – ${formatDate(m.plannedEnd)}`}
                  />
                )}
                {m.actualStart && actualEnd && (
                  <div
                    className={`absolute bottom-1 h-2 rounded-sm ${m.overdue ? "bg-red-500" : "bg-primary"} ${m.actualEnd ? "" : "opacity-60"}`}
                    style={{ left: `${pos(m.actualStart)}%`, width: `${width(m.actualStart, actualEnd)}%` }}
                    title={`Actual ${formatDate(m.actualStart)} – ${m.actualEnd ? formatDate(m.actualEnd) : "ongoing"}`}
                  />
                )}
                <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${pos(today)}%` }} aria-hidden />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {formatDate(min)} → {formatDate(max)}
      </p>
    </div>
  );
}
