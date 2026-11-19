import { ClipboardCheck, ListTodo, Lock, Zap } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ModuleStatusBadge, OverdueBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { approvalsQueue, myTasks } from "@/lib/queries";
import { teamLabel, teamsLabel } from "@/lib/teams";
import { cn } from "@/lib/utils";

export const metadata = { title: "My tasks" };

/** Department view: the launch steps my teams fill in, across every store I can see. */
export default async function TasksPage() {
  const user = await requirePageUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
  const [{ items, teamsWithSteps, records }, approvals] = await Promise.all([myTasks(user), approvalsQueue(user)]);
  const ready = items.filter((i) => i.waitingFor.length === 0 && !(i.status === "COMPLETED" && i.approvalStatus === "PENDING"));
  const submitted = items.filter((i) => i.status === "COMPLETED" && i.approvalStatus === "PENDING");
  const later = items.filter((i) => i.waitingFor.length > 0 && i.status === "NOT_STARTED");
  const myApprovals = user.role === "SUPER_ADMIN" ? [] : approvals;

  return (
    <>
      <PageHeader
        title="My tasks"
        description={user.teams.length ? `Launch steps for ${teamsLabel(user.teams)}, across the stores you can see.` : "You are not in a team yet. Ask HQ to add you to one in Settings."}
      />

      {myApprovals.length > 0 && (
        <Card className="mb-6 gap-0 border-amber-300 bg-amber-50 py-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="flex items-center gap-2 font-medium text-amber-950">
              <ClipboardCheck className="size-4" aria-hidden /> {myApprovals.length} step{myApprovals.length === 1 ? "" : "s"} waiting for your approval
            </p>
            <Button asChild size="sm" variant="outline" className="bg-card">
              <Link href="/hq/approvals">Open approvals</Link>
            </Button>
          </div>
        </Card>
      )}

      {records.length > 0 && (
        <Card className="mb-6 gap-0 overflow-hidden border-sky-200 bg-sky-50/60 py-0">
          <p className="flex items-center gap-2 px-4 pt-3 font-medium text-sky-950">
            <Zap className="size-4" aria-hidden /> {records.length} record{records.length === 1 ? "" : "s"} to make after an approval
          </p>
          <ul className="divide-y">
            {records.map((r) => (
              <li key={r.id}>
                <Link href={`/stores/${r.store.id}/modules/${r.moduleType}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-sky-100/60">
                  <span>
                    <span className="font-medium">{r.pendingText}</span>
                    <span className="block text-sm text-muted-foreground">
                      {r.store.name} · <span className="font-mono text-xs">{r.store.storeCode}</span> · {r.displayName} approved
                    </span>
                  </span>
                  <span className="text-sm font-medium text-primary">Record {r.label.toLowerCase()} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {teamsWithSteps.length === 0 && myApprovals.length === 0 && records.length === 0 ? (
        <EmptyState icon={<ListTodo className="size-8" />} title="No steps for your teams">
          {user.teams.length ? `None of the launch steps is filled in by ${teamsLabel(user.teams)}.` : "Teams decide which launch steps you work on."}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <Section title="To do now" hint="Earlier steps are done, so these can be worked on." rows={ready} empty="Nothing to do right now." />
          {submitted.length > 0 && <Section title="Sent for approval" hint="Waiting for the approving team." rows={submitted} />}
          {later.length > 0 && <Section title="Coming up" hint="These start when the earlier steps are done." rows={later} muted />}
        </div>
      )}
    </>
  );
}

type Row = Awaited<ReturnType<typeof myTasks>>["items"][number];

function Section({ title, hint, rows, empty, muted }: { title: string; hint: string; rows: Row[]; empty?: string; muted?: boolean }) {
  return (
    <section>
      <h2 className="font-semibold">
        {title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
      </h2>
      <p className="mb-2 text-sm text-muted-foreground">{hint}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Card className={cn("gap-0 overflow-hidden py-0", muted && "opacity-80")}>
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/stores/${r.store.id}/modules/${r.moduleType}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="mr-1.5 font-mono text-xs text-muted-foreground">{r.code}</span>
                      {r.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {r.store.name} · <span className="font-mono text-xs">{r.store.storeCode}</span> · {r.store.city}
                    </p>
                    {r.approvalStatus === "REJECTED" && r.approvalComment && r.status !== "COMPLETED" && (
                      <p className="mt-1 text-xs text-amber-800">
                        Sent back{r.approverTeam ? ` by ${teamLabel(r.approverTeam)}` : ""}: “{r.approvalComment}”
                      </p>
                    )}
                    {r.status === "BLOCKED" && r.blockerReason && <p className="mt-1 text-xs text-red-700">Blocked: {r.blockerReason}</p>}
                    {r.waitingFor.length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" aria-hidden /> Starts after {r.waitingFor.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {r.plannedEnd && <span>Due {formatDate(r.plannedEnd)}</span>}
                    <OverdueBadge days={r.daysOverdue} />
                    <ModuleStatusBadge status={r.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
