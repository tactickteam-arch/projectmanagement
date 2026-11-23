import { daysBetween, formatDateOnly, parseDateOnly, todayInIndia } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import type { ModuleView } from "@/lib/queries";
import { cn } from "@/lib/utils";

const AFTER_KEY_GROUPS = new Set(["track", "site", "launch"]);

/**
 * Planned vs actual dates for all 21 steps on one date axis (a Gantt chart), split into the steps
 * before the keys and the Stage 6 & 7 steps from Day 0. Markers: today, keys (Day 0, or expected),
 * target launch.
 */
export function Timeline({
  modules,
  handover,
  expectedKey,
  targetLaunch,
  today,
}: {
  modules: ModuleView[];
  handover: string | null;
  expectedKey: string | null;
  targetLaunch: string | null;
  today: string;
}) {
  const endOf = (m: ModuleView) => m.actualEnd ?? (m.done && m.completedAt ? formatDateOnly(todayInIndia(new Date(m.completedAt))) : m.actualStart ? today : null);
  const rows = modules.filter((m) => (m.plannedStart && m.plannedEnd) || m.actualStart);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No dates planned yet.</p>;

  const keyDate = handover ?? expectedKey;
  const dates = [keyDate, targetLaunch, today, ...rows.flatMap((m) => [m.plannedStart, m.plannedEnd, m.actualStart, endOf(m)])].filter(Boolean) as string[];
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const span = Math.max(1, daysBetween(parseDateOnly(min), parseDateOnly(max)) + 1);
  const pos = (d: string) => (daysBetween(parseDateOnly(min), parseDateOnly(d)) / span) * 100;
  const width = (a: string, b: string) => Math.max(1.5, ((daysBetween(parseDateOnly(a), parseDateOnly(b)) + 1) / span) * 100);

  const markers = [
    { date: today, label: "Today", className: "bg-foreground/70" },
    keyDate && { date: keyDate, label: handover ? "Keys (Day 0)" : "Keys expected", className: "bg-amber-500" },
    targetLaunch && { date: targetLaunch, label: "Target launch", className: "bg-emerald-600" },
  ].filter(Boolean) as { date: string; label: string; className: string }[];

  const sections = [
    { title: "Before the keys", items: rows.filter((m) => !AFTER_KEY_GROUPS.has(m.group)) },
    { title: handover ? "From Day 0 (keys received)" : "From Day 0 — planned from the expected key date", items: rows.filter((m) => AFTER_KEY_GROUPS.has(m.group)) },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <Legend swatch="h-2 w-5 rounded-sm bg-slate-300">Planned</Legend>
        <Legend swatch="h-2 w-5 rounded-sm bg-sky-500">In progress</Legend>
        <Legend swatch="h-2 w-5 rounded-sm bg-emerald-600">Done</Legend>
        <Legend swatch="h-2 w-5 rounded-sm bg-red-500">Late</Legend>
        {markers.map((k) => (
          <Legend key={k.label} swatch={cn("h-3 w-0.5", k.className)}>
            {k.label}: {formatDate(k.date)}
          </Legend>
        ))}
      </div>
      {sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.title}</h3>
          {s.items.map((m) => {
            const actualEnd = endOf(m);
            const tone = m.overdue ? "bg-red-500" : m.done ? "bg-emerald-600" : "bg-sky-500";
            return (
              <div key={m.id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-xs sm:grid-cols-[15rem_1fr]">
                <div className="truncate" title={`${m.code} · ${m.displayName}`}>
                  <span className="tabular-nums text-muted-foreground">{m.code}</span> {m.displayName}
                  {m.done && <span className="ml-1 text-emerald-700">· done</span>}
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
                      className={cn("absolute bottom-1 h-2 rounded-sm", tone, !m.done && !m.actualEnd && !m.overdue && "opacity-80")}
                      style={{ left: `${pos(m.actualStart)}%`, width: `${width(m.actualStart, actualEnd)}%` }}
                      title={`Actual ${formatDate(m.actualStart)} – ${m.done || m.actualEnd ? formatDate(actualEnd) : "ongoing"}`}
                    />
                  )}
                  {markers.map((k) => (
                    <div key={k.label} className={cn("absolute inset-y-0 w-0.5", k.className)} style={{ left: `${pos(k.date)}%` }} aria-hidden />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        {formatDate(min)} → {formatDate(max)}
      </p>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block", swatch)} aria-hidden /> {children}
    </span>
  );
}
