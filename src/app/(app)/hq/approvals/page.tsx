import { ClipboardCheck, Paperclip } from "lucide-react";
import Link from "next/link";
import { DecisionButtons } from "@/components/decision-buttons";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { daysBetween, todayInIndia } from "@/lib/dates";
import { formatDateTime, formatINR } from "@/lib/format";
import { approvalsQueue } from "@/lib/queries";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const user = await requirePageUser(["SUPER_ADMIN", "REGIONAL_MANAGER"]);
  const rows = await approvalsQueue(user);
  const canDecide = user.role === "SUPER_ADMIN";
  const today = todayInIndia();

  return (
    <>
      <PageHeader
        title="Approvals queue"
        description={`Modules marked Completed and waiting for HQ approval, oldest first.${canDecide ? "" : " Regional Managers can review and comment; approval is HQ-only for now."}`}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="size-8" />} title="Nothing waiting for approval">
          New submissions appear here when a store owner marks a module Completed.
        </EmptyState>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul className="divide-y">
            {rows.map((r) => {
              const waiting = daysBetween(new Date(r.submittedAt), today);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/stores/${r.store.id}/modules/${r.moduleType}`} className="font-medium hover:underline">
                      {r.displayName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/stores/${r.store.id}`} className="hover:underline">
                        {r.store.name}
                      </Link>{" "}
                      · <span className="font-mono text-xs">{r.store.storeCode}</span> · {r.store.city}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>
                        Submitted {formatDateTime(r.submittedAt)}
                        {r.submittedBy ? ` by ${r.submittedBy}` : ""}
                      </span>
                      {waiting > 0 && <span className={waiting >= 3 ? "font-medium text-amber-700" : ""}>waiting {waiting} day{waiting === 1 ? "" : "s"}</span>}
                      <span className="flex items-center gap-1">
                        <Paperclip className="size-3" /> {r.attachments} file{r.attachments === 1 ? "" : "s"}
                      </span>
                      {r.actualCost !== null && <span>Actual cost {formatINR(r.actualCost)}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/stores/${r.store.id}/modules/${r.moduleType}`} className="text-sm text-primary hover:underline">
                      Review
                    </Link>
                    {canDecide && <DecisionButtons moduleId={r.id} moduleName={r.displayName} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
