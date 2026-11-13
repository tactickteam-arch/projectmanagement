import { redirect } from "next/navigation";
import { Comments } from "@/components/comments";
import { DecisionButtons } from "@/components/decision-buttons";
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
import { listComments } from "@/lib/services/comments";
import { notFound } from "next/navigation";

export const metadata = { title: "Module" };

export default async function ModulePage({ params }: PageProps<"/stores/[id]/modules/[moduleType]">) {
  const user = await requirePageUser();
  const { id, moduleType } = await params;
  const store = await getStoreDetailForPage(user, id);
  const m = store.modules.find((x) => x.moduleType === moduleType);
  if (!m) notFound();
  if (m.isMilestone) redirect(`/stores/${id}/key-handover`);

  const isOwner = can.editModules(user, store);
  const canApprove = can.approveModules(user, store);
  const comments = (await listComments(user, m.id)).map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));
  const editableFiles = isOwner && !(m.status === "COMPLETED");
  const files = (tag: string) => m.attachments.filter((a) => a.tag === tag);
  const countingPhotos = m.attachments.filter((a) => a.fileType.startsWith("image/") && (!m.photoTag || a.tag === m.photoTag)).length;
  const fileFields = m.fields.filter((f) => f.type === "file");
  const hasChecklist = m.fields.some((f) => f.type === "checklist");
  const home = user.role === "STORE_OWNER" ? { label: "My stores", href: "/owner" } : { label: "Dashboard", href: "/hq" };

  return (
    <>
      <PageHeader
        crumbs={[home, { label: store.name, href: `/stores/${store.id}` }, { label: m.displayName }]}
        title={m.displayName}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <ModuleStatusBadge status={m.status} />
            <ApprovalBadge status={m.approvalStatus} show={m.status === "COMPLETED" || m.approvalStatus !== "PENDING"} />
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
          <AlertTitle>Rejected by HQ{m.approvedBy ? ` (${m.approvedBy})` : ""}</AlertTitle>
          <AlertDescription className="text-amber-900">“{m.approvalComment}”</AlertDescription>
        </Alert>
      )}
      {m.approvalStatus === "APPROVED" && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50">
          <AlertTitle>
            Approved by {m.approvedBy ?? "HQ"} on {formatDateTime(m.approvedAt)}
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
            <ModuleForm storeId={store.id} m={m} keyHandoverDate={store.keyHandoverDate} countingPhotos={countingPhotos} />
          ) : (
            <ReadOnlyModule m={m} />
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos &amp; documents</CardTitle>
              <p className="text-xs text-muted-foreground">
                {m.minPhotos} photo{m.minPhotos > 1 ? "s" : ""} required to mark Completed
                {m.photoTag === "photo_final" ? " (final store photos)" : ""} · {countingPhotos} uploaded. JPG, PNG, WebP or PDF, up to 10 MB.
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
              {hasChecklist && (
                <Uploader moduleId={m.id} tag="photo_branding_item" label="Branding item photos" files={files("photo_branding_item")} canEdit={editableFiles} photosOnly />
              )}
              <Uploader moduleId={m.id} tag="photo_before" label="Photos — before" files={files("photo_before")} canEdit={editableFiles} photosOnly />
              <Uploader moduleId={m.id} tag="photo_during" label="Photos — during" files={files("photo_during")} canEdit={editableFiles} photosOnly />
              <Uploader moduleId={m.id} tag="photo_after" label="Photos — after" files={files("photo_after")} canEdit={editableFiles} photosOnly />
              <Uploader moduleId={m.id} tag="invoice" label="Invoices & documents" files={[...files("invoice"), ...files("document")]} canEdit={editableFiles} />
              {isOwner && m.status === "COMPLETED" && <p className="text-xs text-muted-foreground">Files are locked while the module is Completed.</p>}
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

function ReadOnlyModule({ m }: { m: ModuleView }) {
  const row = (k: string, v: string) => (
    <div key={k}>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm">{v}</dd>
    </div>
  );
  return (
    <>
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
              .filter((f) => f.type !== "file")
              .map((f) =>
                f.type === "checklist" ? (
                  <div key={f.key} className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="mt-1">
                      {Array.isArray(m.details[f.key]) && (m.details[f.key] as unknown[]).length ? (
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                              <th className="py-1 font-medium">Item</th>
                              <th className="py-1 font-medium">Qty</th>
                              <th className="py-1 font-medium">Received</th>
                              <th className="py-1 font-medium">Installed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(m.details[f.key] as Record<string, unknown>[]).map((r, i) => (
                              <tr key={i} className="border-t">
                                <td className="py-1">{String(r.itemName ?? "")}</td>
                                <td className="py-1">{r.quantity === null || r.quantity === undefined ? "—" : String(r.quantity)}</td>
                                <td className="py-1">{r.received ? "Yes" : "No"}</td>
                                <td className="py-1">{r.installed ? "Yes" : "No"}</td>
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
