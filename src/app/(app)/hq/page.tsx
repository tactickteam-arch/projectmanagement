import { AlertTriangle, Ban, ClipboardCheck, Download, IndianRupee, Rocket, Store } from "lucide-react";
import Link from "next/link";
import { PipelineChart } from "@/components/charts";
import { DashboardFilters } from "@/components/dashboard-filters";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { GridLegend, StoreGrid } from "@/components/store-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OverallStatus } from "@/generated/prisma/enums";
import { requirePageUser } from "@/lib/auth/dal";
import { formatINR } from "@/lib/format";
import { dashboardSummary, listStoreSummaries, storeOwnersInScope, templateNames, type StoreFilters } from "@/lib/queries";
import { OVERALL_STATUS_LABELS, OVERALL_STATUS_ORDER } from "@/lib/status";

export const metadata = { title: "Dashboard" };

const SORTS = ["code", "name", "progress", "launch", "overdue"] as const;

export default async function HqDashboard({ searchParams }: PageProps<"/hq">) {
  const user = await requirePageUser(["SUPER_ADMIN", "REGIONAL_MANAGER"]);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const status = str("status");
  const sort = str("sort");
  const filters: StoreFilters = {
    q: str("q"),
    state: str("state"),
    city: str("city"),
    status: status === "NONE" || (status && status in OverallStatus) ? (status as StoreFilters["status"]) : undefined,
    ownerId: str("ownerId"),
    launchMonth: str("launchMonth"),
    sort: SORTS.includes(sort as (typeof SORTS)[number]) ? (sort as StoreFilters["sort"]) : undefined,
  };

  const [summary, stores, allStores, owners, names] = await Promise.all([
    dashboardSummary(user),
    listStoreSummaries(user, filters),
    listStoreSummaries(user),
    storeOwnersInScope(user),
    templateNames(),
  ]);
  const cities = [...new Set(allStores.map((s) => s.city))].sort();
  const exportQs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  exportQs.set("format", "xlsx");

  const chartData = [
    ...OVERALL_STATUS_ORDER.map((s) => ({ label: OVERALL_STATUS_LABELS[s], count: summary.byStatus.find((b) => b.status === s)?.count ?? 0 })),
    { label: "Not yet finalised", count: summary.byStatus.find((b) => b.status === "NONE")?.count ?? 0 },
  ].filter((d) => d.count > 0);

  return (
    <>
      <PageHeader
        title="Store launch dashboard"
        description={user.role === "REGIONAL_MANAGER" ? `Stores in your region (${user.regionStates.join(", ")}).` : "All new stores across India."}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={`/api/stores?${exportQs.toString()}`}>
              <Download className="size-4" /> Export to Excel
            </a>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Stores in pipeline" value={summary.pipeline} hint="Not yet launched or dropped" icon={<Store className="size-4" />} />
        <StatCard label="Launched this month" value={summary.launchedThisMonth} icon={<Rocket className="size-4" />} tone="success" />
        <StatCard
          label="Delayed stores"
          value={summary.delayedStores}
          hint="With an overdue module"
          icon={<AlertTriangle className="size-4" />}
          tone={summary.delayedStores ? "danger" : "default"}
          href="/hq/reports/delays"
        />
        <StatCard
          label="Blocked stores"
          value={summary.blockedStores}
          hint="With a blocked module"
          icon={<Ban className="size-4" />}
          tone={summary.blockedStores ? "warning" : "default"}
          href="/hq?sort=overdue"
        />
        <StatCard
          label="Total spend (actual)"
          value={formatINR(summary.actualSpend, true)}
          hint={`Estimated ${formatINR(summary.estSpend, true)}`}
          icon={<IndianRupee className="size-4" />}
          href="/hq/reports/costs"
        />
        <StatCard label="Awaiting approval" value={summary.pendingApprovals} hint="Modules marked Completed" icon={<ClipboardCheck className="size-4" />} href="/hq/approvals" />
      </div>

      <div className="mt-6 space-y-6">
        <section aria-labelledby="grid-title" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="grid-title" className="font-semibold">
              Store × module status <span className="text-sm font-normal text-muted-foreground">({stores.length} of {allStores.length})</span>
            </h2>
            <GridLegend />
          </div>
          <DashboardFilters owners={owners} cities={cities} />
          {stores.length ? (
            <StoreGrid stores={stores} names={names} />
          ) : (
            <EmptyState title="No stores match these filters">Try clearing a filter or searching for a different store.</EmptyState>
          )}
        </section>
        <aside className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline by stage</CardTitle>
            </CardHeader>
            <CardContent>{chartData.length ? <PipelineChart data={chartData} /> : <p className="text-sm text-muted-foreground">No stores yet.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Needs attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {allStores
                .filter((s) => s.overdueCount || s.blockedCount)
                .slice(0, 6)
                .map((s) => (
                  <Link key={s.id} href={`/stores/${s.id}`} className="block rounded-md border p-2.5 hover:bg-muted/40">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.overdueCount && `${s.overdueCount} overdue`, s.blockedCount && `${s.blockedCount} blocked`].filter(Boolean).join(" · ")}
                    </p>
                  </Link>
                ))}
              {!allStores.some((s) => s.overdueCount || s.blockedCount) && <p className="text-muted-foreground">Nothing overdue or blocked.</p>}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
