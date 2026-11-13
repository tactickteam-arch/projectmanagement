import { AlertTriangle, ChevronRight, KeyRound, Plus, Store } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { stateName } from "@/lib/india-states";
import { listStoreSummaries } from "@/lib/queries";

export const metadata = { title: "My stores" };

export default async function OwnerHome() {
  const user = await requirePageUser(["STORE_OWNER"]);
  const stores = await listStoreSummaries(user);

  return (
    <>
      <PageHeader
        title="My stores"
        description={`${stores.length} store${stores.length === 1 ? "" : "s"} assigned to you`}
        actions={
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/stores/new">
              <Plus className="size-4" /> Add store
            </Link>
          </Button>
        }
      />
      {stores.length === 0 ? (
        <EmptyState icon={<Store className="size-8" />} title="No stores yet">
          <Link href="/stores/new" className="text-primary underline">
            Add your first store
          </Link>{" "}
          to start tracking its setup.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {stores.map((s) => (
            <li key={s.id}>
              <Link href={`/stores/${s.id}`} className="block rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-foreground/20 active:bg-muted/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.city}, {stateName(s.state)}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{s.storeCode}</p>
                  </div>
                  <StatusBadge status={s.overallStatus} />
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>{s.approvedCount} of 7 modules approved</span>
                    <span className="font-medium tabular-nums text-foreground">{s.progressPercent}%</span>
                  </div>
                  <ProgressBar value={s.progressPercent} label={`${s.name} progress`} className="h-2" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <KeyRound className="size-3.5" aria-hidden />
                    {s.daysSinceHandover !== null ? `${s.daysSinceHandover} days since key handover` : s.actualLaunchDate ? `Launched ${formatDate(s.actualLaunchDate)}` : "Keys not received yet"}
                  </span>
                  {s.overdueCount > 0 && (
                    <span className="flex items-center gap-1 font-medium text-red-600">
                      <AlertTriangle className="size-3.5" aria-hidden /> {s.overdueCount} overdue
                    </span>
                  )}
                  {s.blockedCount > 0 && <span className="font-medium text-red-600">{s.blockedCount} blocked</span>}
                  <ChevronRight className="ml-auto size-4" aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
