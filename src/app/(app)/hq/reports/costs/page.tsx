import { Download } from "lucide-react";
import Link from "next/link";
import { CostChart } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { formatINR } from "@/lib/format";
import { costReport } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { MODULE_SHORT_LABELS } from "@/modules";

export const metadata = { title: "Cost report" };

function Variance({ est, actual }: { est: number; actual: number }) {
  if (!est && !actual) return <span className="text-muted-foreground">—</span>;
  const v = actual - est;
  return <span className={cn("tabular-nums", v > 0 && "text-red-600", v < 0 && "text-emerald-700")}>{`${v > 0 ? "+" : ""}${formatINR(v)}`}</span>;
}

export default async function CostsPage() {
  const user = await requirePageUser(["SUPER_ADMIN", "REGIONAL_MANAGER"]);
  const r = await costReport(user);
  const est = r.stores.reduce((t, s) => t + s.est, 0);
  const actual = r.stores.reduce((t, s) => t + s.actual, 0);
  const modules = r.modules.filter((m) => m.moduleType !== "KEY_HANDOVER");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/hq" }, { label: "Cost report" }]}
        title="Cost report"
        description="Estimated vs actual cost per store and per module, from the cost fields on each module."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/reports/costs?format=xlsx">
              <Download className="size-4" /> Export to Excel
            </a>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Estimated (all stores)" value={formatINR(est)} />
        <StatCard label="Actual (all stores)" value={formatINR(actual)} />
        <StatCard label="Variance" value={<Variance est={est} actual={actual} />} hint="Actual minus estimated; modules without both values count as 0" />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">By module</CardTitle>
        </CardHeader>
        <CardContent>
          <CostChart data={modules.map((m) => ({ label: MODULE_SHORT_LABELS[m.moduleType] ?? m.displayName, est: m.est, actual: m.actual }))} />
        </CardContent>
      </Card>
      <Card className="mt-6 overflow-hidden py-0">
        <CardHeader className="pt-5">
          <CardTitle className="text-base">By store</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Store</th>
                <th className="px-4 py-2.5 text-right font-medium">Estimated</th>
                <th className="px-4 py-2.5 text-right font-medium">Actual</th>
                <th className="px-4 py-2.5 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {r.stores.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/stores/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">{s.storeCode}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(s.est)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(s.actual)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Variance est={s.est} actual={s.actual} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
