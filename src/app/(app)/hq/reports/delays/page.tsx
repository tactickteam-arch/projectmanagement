import { CheckCircle2, Download } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ModuleStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { delaysReport } from "@/lib/queries";
import { teamsLabel } from "@/lib/teams";

export const metadata = { title: "Delays report" };

export default async function DelaysPage() {
  const user = await requirePageUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
  const rows = await delaysReport(user);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/hq" }, { label: "Delays report" }]}
        title="Delays report"
        description="Overdue SOP steps — planned end date has passed and the step is not Completed — sorted by days overdue. The owning team gets a delay alert every day."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/reports/delays?format=xlsx">
              <Download className="size-4" /> Export to Excel
            </a>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-8" />} title="No overdue steps" />
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-right font-medium">Days overdue</th>
                  <th className="px-4 py-2.5 font-medium">Step · owner</th>
                  <th className="px-4 py-2.5 font-medium">Store</th>
                  <th className="px-4 py-2.5 font-medium">Store owner</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Planned end</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b align-top last:border-0">
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block min-w-10 rounded bg-red-600 px-2 py-0.5 text-center text-xs font-semibold text-white tabular-nums">{r.daysOverdue}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/stores/${r.store.id}/modules/${r.moduleType}`} className="font-medium hover:underline">
                        <span className="mr-1 font-mono text-xs text-muted-foreground">{r.code}</span>
                        {r.displayName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{teamsLabel(r.ownerTeams)}</p>
                      {r.waitingFor.length > 0 && <p className="mt-0.5 text-xs text-amber-700">Still waiting for {r.waitingFor.join(", ")}</p>}
                      {r.blockerReason && <p className="mt-0.5 text-xs text-red-700">Blocked: {r.blockerReason}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/stores/${r.store.id}`} className="hover:underline">
                        {r.store.name}
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {r.store.storeCode} · {r.store.city}
                      </p>
                    </td>
                    <td className="px-4 py-3">{r.store.ownerName}</td>
                    <td className="px-4 py-3">
                      <ModuleStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.plannedEnd)}</td>
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
