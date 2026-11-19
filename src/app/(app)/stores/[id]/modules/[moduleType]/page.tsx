import { notFound } from "next/navigation";
import Link from "next/link";
import { AfterApprovalForm } from "@/components/after-approval-form";
import { Comments } from "@/components/comments";
import { DecisionButtons } from "@/components/decision-buttons";
import { DONE_BY_STYLE } from "@/components/launch-flow";
import { ModuleForm, type PreKeyState } from "@/components/module-form";
import { PageHeader } from "@/components/page-header";
import { ApprovalBadge, ModuleStatusBadge, OverdueBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { displayValue } from "@/lib/field-display";
import { formatDateTime } from "@/lib/format";
import { getStoreDetailForPage, type ModuleView, type StoreDetail } from "@/lib/queries";
import { listComments } from "@/lib/services/comments";
import { teamLabel, teamsLabel } from "@/lib/teams";
import { cn } from "@/lib/utils";

export const metadata = { title: "Step" };

export default async function ModulePage({ params }: PageProps<"/stores/[id]/modules/[moduleType]">) {
  const user = await requirePageUser();
  const { id, moduleType } = await params;
  const store = await getStoreDetailForPage(user, id);
  const m = store.modules.find((x) => x.moduleType === moduleType);
  if (!m) notFound();

  const canEdit = can.editModule(user, store, m);
  const canApprove = can.approveModule(user, store, m);
  const approver = m.approverTeam ? teamLabel(m.approverTeam) : null;
  const comments = (await listComments(user, m.id)).map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));
  const home = user.role === "STORE_OWNER" ? { label: "My stores", href: "/owner" } : user.role === "TEAM_MEMBER" ? { label: "My tasks", href: "/tasks" } : { label: "Dashboard", href: "/hq" };
  const approved = m.status === "COMPLETED" && m.approvalStatus === "APPROVED";
  const pending = m.status === "COMPLETED" && m.approvalStatus === "PENDING";
  const preKey = preKeyState(store);

  return (
    <>
      <PageHeader
        crumbs={[home, { label: store.name, href: `/stores/${store.id}` }, { label: m.displayName }]}
        title={`${m.code} · ${m.displayName}`}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {m.done ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">✓ Done</span>
            ) : (
              <ModuleStatusBadge status={m.status} />
            )}
            <ApprovalBadge status={m.approvalStatus} show={!!approver && !m.done && (m.status === "COMPLETED" || m.approvalStatus !== "PENDING")} approver={approver} />
            <OverdueBadge days={m.daysOverdue} />
            <span className="text-xs">
              {store.storeCode} · last updated {formatDateTime(m.updatedAt)}
              {m.updatedBy ? ` by ${m.updatedBy}` : ""}
            </span>
          </span>
        }
        actions={canApprove && pending ? <DecisionButtons moduleId={m.id} moduleName={m.displayName} size="default" /> : null}
      />

      {m.approvalStatus === "REJECTED" && m.approvalComment && m.status !== "COMPLETED" && (
        <Alert className="mb-4 border-amber-300 bg-amber-50">
          <AlertTitle>
            Sent back by {approver ?? "HQ"}
            {m.approvedBy ? ` (${m.approvedBy})` : ""}
          </AlertTitle>
          <AlertDescription className="text-amber-900">“{m.approvalComment}”</AlertDescription>
        </Alert>
      )}
      {approved && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50">
          <AlertTitle>
            {approver ? `Approved by ${m.approvedBy ?? approver} (${approver})` : `Marked done by ${m.approvedBy ?? teamsLabel(m.editTeams)}`} on {formatDateTime(m.approvedAt)}
          </AlertTitle>
          <AlertDescription>
            {m.approvalComment ? `“${m.approvalComment}” · ` : ""}
            {m.pendingGates.length > 0 ? `Not green yet — waiting for: ${m.afterActions.filter((a) => m.pendingGates.includes(a.key)).map((a) => a.label.toLowerCase()).join(", ")}.` : "This step is done and locked."}
          </AlertDescription>
        </Alert>
      )}
      {pending && canApprove && (
        <Alert className="mb-4 border-amber-300 bg-amber-50">
          <AlertTitle>Waiting for your approval{approver ? ` as ${approver}` : ""}</AlertTitle>
          <AlertDescription className="text-amber-900">{m.approvalNote}. Review the details below, then approve or send it back with a comment.</AlertDescription>
        </Alert>
      )}
      {m.status === "BLOCKED" && m.blockerReason && !canEdit && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTitle>Blocked</AlertTitle>
          <AlertDescription className="text-red-800">{m.blockerReason}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {m.review && <ReviewPanel m={m} storeId={store.id} />}
          <ModuleForm storeId={store.id} m={m} areaSqft={store.carpetAreaSqft} preKey={preKey} readOnly={!canEdit} />
        </div>
        <div className="space-y-4">
          <StepInfo m={m} approver={approver} />
          {m.afterActions.map((a) => (
            <AfterApprovalForm key={a.key} moduleId={m.id} approved={approved} action={{ ...a, teamsLabel: teamsLabel(a.teams) }} />
          ))}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <Comments moduleId={m.id} comments={comments} currentUserId={user.id} canComment={can.comment(user, store)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Sign board and material ordering status for the T-7 rule (key handover step). */
function preKeyState(store: StoreDetail): PreKeyState {
  const of = (t: string) => {
    const x = store.modules.find((m) => m.moduleType === t);
    return { done: !!x?.done, completedOn: x?.actualEnd ?? null };
  };
  return { signBoard: of("SIGN_BOARD"), materials: of("MATERIAL_ORDERING") };
}

function StepInfo({ m, approver }: { m: ModuleView; approver: string | null }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Stage {m.stage} of the SOP</CardTitle>
        <p className="text-sm text-muted-foreground">{m.summary}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className={cn("mr-2 inline-block rounded border px-1.5 py-0.5 text-xs font-medium", DONE_BY_STYLE[m.doneBy].box)}>{DONE_BY_STYLE[m.doneBy].label}</span>
          {m.doneByLabel}
        </p>
        <p>
          <span className="text-muted-foreground">Filled in by:</span> {teamsLabel(m.editTeams)}
        </p>
        {m.supportTeams.length > 0 && (
          <p>
            <span className="text-muted-foreground">Support:</span> {teamsLabel(m.supportTeams)}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">{approver ? "Approval:" : m.group === "launch" ? "Gate:" : "Owner:"}</span> {approver ?? (m.group === "launch" ? "All departments green" : teamsLabel(m.editTeams))} — {m.approvalNote}
        </p>
        {m.requires.length > 0 && (
          <p>
            <span className="text-muted-foreground">Starts after:</span> {m.requires.join(", ")}
            {m.waitingFor.length > 0 && <span className="ml-1 text-amber-700">(waiting for {m.waitingFor.join(", ")})</span>}
          </p>
        )}
        {m.notes.map((n) => (
          <p key={n} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-950">
            {n}
          </p>
        ))}
        {m.systemAction && <p className="rounded bg-sky-100 px-2 py-1 text-xs text-sky-900">{m.systemAction}</p>}
      </CardContent>
    </Card>
  );
}

/** Values of an earlier step shown for review (e.g. Accounts verifies the MOU sheet's terms and KYC). */
function ReviewPanel({ m, storeId }: { m: ModuleView; storeId: string }) {
  if (!m.review) return null;
  return (
    <Card className="gap-3 border-indigo-200">
      <CardHeader>
        <CardTitle className="text-base">{m.review.title}</CardTitle>
        <CardDescription>
          From{" "}
          <Link href={`/stores/${storeId}/modules/${m.review.fromType}`} className="underline">
            the location filing
          </Link>
          . Change them there if they are wrong.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {m.review.items.map(({ field, value }) => (
            <div key={field.key} className={field.type === "longtext" ? "sm:col-span-2" : ""}>
              <dt className="text-xs text-muted-foreground">
                {field.sr !== undefined ? `${field.sr}. ` : ""}
                {field.label}
              </dt>
              <dd className="mt-0.5 whitespace-pre-line">{displayValue(field, value)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
