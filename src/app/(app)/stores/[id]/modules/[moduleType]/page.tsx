import { Comments } from "@/components/comments";
import { AfterApprovalForm } from "@/components/after-approval-form";
import { DecisionButtons } from "@/components/decision-buttons";
import { DONE_BY_STYLE } from "@/components/launch-flow";
import { displayValue } from "@/lib/field-display";
import { ModuleForm } from "@/components/module-form";
import { PageHeader } from "@/components/page-header";
import { ApprovalBadge, ModuleStatusBadge, OverdueBadge } from "@/components/status-badge";
import { Uploader } from "@/components/uploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { getStoreDetailForPage, type ModuleView } from "@/lib/queries";
import { teamLabel, teamsLabel } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { listComments } from "@/lib/services/comments";
import { notFound } from "next/navigation";

export const metadata = { title: "Step" };

export default async function ModulePage({ params }: PageProps<"/stores/[id]/modules/[moduleType]">) {
  const user = await requirePageUser();
  const { id, moduleType } = await params;
  const store = await getStoreDetailForPage(user, id);
  const m = store.modules.find((x) => x.moduleType === moduleType);
  if (!m) notFound();

  const isOwner = can.editModule(user, store, m);
  const canApprove = can.approveModule(user, store, m);
  const approver = m.approverTeam ? teamLabel(m.approverTeam) : null;
  const comments = (await listComments(user, m.id)).map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));
  const editableFiles = isOwner && !(m.status === "COMPLETED");
  const files = (tag: string) => m.attachments.filter((a) => a.tag === tag);
  const countingPhotos = m.attachments.filter((a) => a.fileType.startsWith("image/") && (!m.photoTag || a.tag === m.photoTag)).length;
  const fileFields = m.fields.filter((f) => f.type === "file");
  const home = user.role === "STORE_OWNER" ? { label: "My stores", href: "/owner" } : user.role === "TEAM_MEMBER" ? { label: "My tasks", href: "/tasks" } : { label: "Dashboard", href: "/hq" };
  const afterValue = m.afterApproval ? ((m.details[m.afterApproval.key] as string | undefined) ?? null) : null;

  return (
    <>
      <PageHeader
        crumbs={[home, { label: store.name, href: `/stores/${store.id}` }, { label: m.displayName }]}
        title={`${m.step} · ${m.displayName}`}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <ModuleStatusBadge status={m.status} />
            <ApprovalBadge status={m.approvalStatus} show={!!approver && (m.status === "COMPLETED" || m.approvalStatus !== "PENDING")} approver={approver} />
            <OverdueBadge days={m.daysOverdue} />
            <span className="text-xs">
              {store.storeCode} · last updated {formatDateTime(m.updatedAt)}
              {m.updatedBy ? ` by ${m.updatedBy}` : ""}
            </span>
          </span>
        }
        actions={canApprove && m.status === "COMPLETED" && m.approvalStatus === "PENDING" ? <DecisionButtons moduleId={m.id} moduleName={m.displayName} size="default" /> : null}
      />

      {m.approvalStatus === "REJECTED" && m.approvalComment && (
        <Alert className="mb-4 border-amber-300 bg-amber-50">
          <AlertTitle>
            Sent back by {approver ?? "HQ"}
            {m.approvedBy ? ` (${m.approvedBy})` : ""}
          </AlertTitle>
          <AlertDescription className="text-amber-900">“{m.approvalComment}”</AlertDescription>
        </Alert>
      )}
      {m.done && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50">
          <AlertTitle>
            {approver ? `Approved by ${m.approvedBy ?? approver} (${approver})` : `Marked done by ${m.approvedBy ?? teamsLabel(m.editTeams)}`} on {formatDateTime(m.approvedAt)}
          </AlertTitle>
          {m.approvalComment && <AlertDescription>“{m.approvalComment}”</AlertDescription>}
        </Alert>
      )}
      {m.status === "BLOCKED" && m.blockerReason && !isOwner && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTitle>Blocked</AlertTitle>
          <AlertDescription className="text-red-800">{m.blockerReason}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {isOwner ? (
            <ModuleForm storeId={store.id} m={m} countingPhotos={countingPhotos} />
          ) : (
            <ReadOnlyModule m={m} />
          )}
        </div>
        <div className="space-y-4">
          <StepInfo m={m} approver={approver} />
          {m.afterApproval && m.done && (
            <AfterApprovalForm
              moduleId={m.id}
              label={m.afterApproval.label}
              title={afterValue ? m.afterApproval.doneText : m.afterApproval.pendingText}
              value={afterValue}
              canEdit={can.recordAfterApproval(user, store, m.afterApproval.teams)}
              teams={teamsLabel(m.afterApproval.teams)}
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos &amp; documents</CardTitle>
              <p className="text-xs text-muted-foreground">
                {m.minPhotos > 0 ? `${m.minPhotos} photo${m.minPhotos > 1 ? "s" : ""} required to mark Completed · ${countingPhotos} uploaded. ` : "No photos required. "}
                JPG, PNG, WebP or PDF, up to 10 MB.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {fileFields.map((f) => (
                <Uploader
                  key={f.key}
                  moduleId={m.id}
                  tag={f.attachmentTag ?? "document"}
                  label={f.label}
                  files={files(f.attachmentTag ?? "document")}
                  canEdit={editableFiles}
                  photosOnly={(f.attachmentTag ?? "").startsWith("photo")}
                />
              ))}
              <Uploader moduleId={m.id} tag="photo_before" label="Photos — before" files={files("photo_before")} canEdit={editableFiles} photosOnly />
              <Uploader moduleId={m.id} tag="photo_during" label="Photos — during" files={files("photo_during")} canEdit={editableFiles} photosOnly />
              <Uploader moduleId={m.id} tag="photo_after" label="Photos — after" files={files("photo_after")} canEdit={editableFiles} photosOnly />
              <Uploader moduleId={m.id} tag="invoice" label="Invoices & documents" files={[...files("invoice"), ...files("document")]} canEdit={editableFiles} />
              {isOwner && m.status === "COMPLETED" && <p className="text-xs text-muted-foreground">Files are locked while the step is Completed.</p>}
            </CardContent>
          </Card>
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

function StepInfo({ m, approver }: { m: ModuleView; approver: string | null }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Step {m.step} in the launch flow</CardTitle>
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
        <p>
          <span className="text-muted-foreground">{approver ? "Approval:" : "Owner:"}</span> {approver ?? teamsLabel(m.editTeams)} — {m.approvalNote}
        </p>
        {m.requires.length > 0 && (
          <p>
            <span className="text-muted-foreground">Starts after:</span> {m.requires.join(", ")}
            {m.waitingFor.length > 0 && <span className="ml-1 text-amber-700">(waiting for {m.waitingFor.join(", ")})</span>}
          </p>
        )}
        {m.notes.map((n) => (
          <p key={n} className="text-muted-foreground">
            {n}
          </p>
        ))}
        {m.systemAction && <p className="rounded bg-sky-100 px-2 py-1 text-xs text-sky-900">{m.systemAction}</p>}
      </CardContent>
    </Card>
  );
}

function ReadOnlyModule({ m }: { m: ModuleView }) {
  const row = (k: string, v: string) => (
    <div key={k}>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm">{v}</dd>
    </div>
  );
  const tasks = m.fields.filter((f) => f.type === "task");
  return (
    <>
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Points</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {tasks.map((t) => (
                <li key={t.key} className="flex items-center gap-2">
                  <span className={m.details[t.key] === true ? "text-emerald-700" : "text-muted-foreground"}>{m.details[t.key] === true ? "✓" : "○"}</span>
                  {t.label}
                  {t.owner && <span className="text-xs text-muted-foreground">{t.owner}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status, schedule &amp; cost</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {row("Planned", m.plannedStart ? `${formatDate(m.plannedStart)} – ${formatDate(m.plannedEnd)}` : "—")}
            {row("Actual", m.actualStart ? `${formatDate(m.actualStart)} – ${m.actualEnd ? formatDate(m.actualEnd) : "ongoing"}` : "—")}
            {row("Vendor", [m.vendorName, m.vendorPhone].filter(Boolean).join(" · ") || "—")}
            {row("Estimated / actual cost", `${formatINR(m.estCost)} / ${formatINR(m.actualCost)}`)}
            {row("Completed on", m.completedAt ? formatDateTime(m.completedAt) : "—")}
            {row("Remarks", m.remarks || "—")}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.displayName} details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {m.fields
              .filter((f) => f.type !== "file" && f.type !== "task")
              .filter((f) => !f.showWhen || m.details[f.showWhen.key] === f.showWhen.equals)
              .map((f) =>
                f.type === "checklist" ? (
                  <div key={f.key} className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="mt-1">
                      {Array.isArray(m.details[f.key]) && (m.details[f.key] as unknown[]).length ? (
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                              {(f.itemFields ?? []).map((c) => (
                                <th key={c.key} className="py-1 font-medium">
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(m.details[f.key] as Record<string, unknown>[]).map((r, i) => (
                              <tr key={i} className="border-t">
                                {(f.itemFields ?? []).map((c) => (
                                  <td key={c.key} className="py-1 pr-2">
                                    {displayValue(c, r[c.key])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                ) : (
                  row(f.label + (f.unit && !["number"].includes(f.type) ? ` (${f.unit})` : ""), displayValue(f, m.details[f.key]))
                ),
              )}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
