import { CheckCircle2, Download } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { ragReport } from "@/lib/queries";
import { RAG_LABELS, type Rag } from "@/lib/status";
import { cn } from "@/lib/utils";
import { STAGE_COLUMNS } from "@/modules";
import type { OverallStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Weekly RAG" };

const RAG_CLS: Record<Rag, string> = {
  R: "bg-red-600 text-white",
  A: "bg-amber-400 text-amber-950",
  G: "bg-emerald-600 text-white",
};

function RagDot({ rag, title }: { rag: Rag | null; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-grid h-6 min-w-6 place-items-center rounded px-1 text-[11px] font-bold", rag ? RAG_CLS[rag] : "bg-muted text-muted-foreground")}
      aria-label={`${title ? `${title}: ` : ""}${rag ? RAG_LABELS[rag] : "Not reached"}`}
    >
      {rag ?? "–"}
    </span>
  );
}

/** SOP slide 11: consolidated weekly RAG (Red / Amber / Green) rollout tracker. */
export default async function RagPage() {
  const user = await requirePageUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
  const rows = await ragReport(user);
  const count = (r: Rag) => rows.filter((x) => x.rag === r).length;
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/hq" }, { label: "Weekly RAG" }]}
        title="Weekly RAG rollout tracker"
        description="Every active store by SOP stage. Red: overdue or blocked. Amber: due within 3 days, late to start, or waiting for an approval. Green: done or on track. Circulated every Monday to State Admin, ASM, SH/BH, Legal, Marketing and HO."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/reports/rag?format=xlsx">
              <Download className="size-4" /> Export to Excel
            </a>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {(["R", "A", "G"] as Rag[]).map((r) => (
          <span key={r} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <RagDot rag={r} /> <strong className="tabular-nums">{count(r)}</strong> {RAG_LABELS[r].toLowerCase()} store{count(r) === 1 ? "" : "s"}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-8" />} title="No active stores" />
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Store</th>
                  <th className="px-2 py-2.5 text-center font-medium">RAG</th>
                  {STAGE_COLUMNS.map((c) => (
                    <th key={c.key} className="px-1 py-2.5 text-center text-[11px] font-medium" title={c.title}>
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 font-medium">Needs attention</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b align-top last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/stores/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {r.storeCode} · {r.city}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <StatusBadge status={r.overallStatus as OverallStatus | null} />
                        <span>
                          {r.done}/{r.total} steps
                        </span>
                        <span>{r.keyHandoverDate ? `Keys ${formatDate(r.keyHandoverDate)}` : r.expectedKeyDate ? `Keys exp. ${formatDate(r.expectedKeyDate)}` : "Keys: date not set yet"}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <RagDot rag={r.rag} title="Store" />
                    </td>
                    {r.stages.map((s) => (
                      <td key={s.key} className="px-1 py-3 text-center">
                        <RagDot rag={s.rag} title={s.title} />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {r.attention.length === 0 ? (
                        <span className="text-xs text-muted-foreground">On track</span>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {r.attention.slice(0, 4).map((a) => (
                            <li key={a.moduleType} className="flex items-start gap-1.5">
                              <RagDot rag={a.rag} />
                              <Link href={`/stores/${r.id}/modules/${a.moduleType}`} className="hover:underline">
                                {a.code} {a.displayName}
                                <span className="text-muted-foreground">
                                  {a.daysOverdue > 0 ? ` · ${a.daysOverdue} day${a.daysOverdue === 1 ? "" : "s"} overdue` : a.plannedEnd ? ` · due ${formatDate(a.plannedEnd)}` : ""}
                                  {a.waitingFor.length ? ` · waiting for ${a.waitingFor.join(", ")}` : ""}
                                  {a.status === "COMPLETED" ? " · awaiting approval / record" : ""}
                                  {a.blockerReason ? ` · blocked: ${a.blockerReason}` : ""}
                                </span>
                              </Link>
                            </li>
                          ))}
                          {r.attention.length > 4 && <li className="text-muted-foreground">+{r.attention.length - 4} more</li>}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
