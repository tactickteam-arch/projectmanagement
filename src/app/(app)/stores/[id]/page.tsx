import { CalendarDays, ChevronRight, KeyRound, MapPin, MessageSquare, Paperclip, User } from "lucide-react";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { DecisionButtons } from "@/components/decision-buttons";
import { FileGallery } from "@/components/file-list";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { ApprovalBadge, ModuleStatusBadge, OverdueBadge, StatusBadge } from "@/components/status-badge";
import { EditStoreDialog, StatusOverride } from "@/components/store-actions";
import { Timeline } from "@/components/timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePageUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDateOnly, todayInIndia } from "@/lib/dates";
import { formatDate, formatINR } from "@/lib/format";
import { stateName } from "@/lib/india-states";
import { getStoreDetailForPage, type ModuleView } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Store" };

export default async function StorePage({ params }: PageProps<"/stores/[id]">) {
  const user = await requirePageUser();
  const { id } = await params;
  const store = await getStoreDetailForPage(user, id);
  const isOwner = can.editModules(user, store);
  const canApprove = can.approveModules(user, store);
  const today = formatDateOnly(todayInIndia());
  const setup = store.modules.filter((m) => !m.isMilestone);
  const handover = store.modules.find((m) => m.isMilestone);
  const token = store.modules.find((m) => m.moduleType === "TOKEN_ADVANCE");
  const moduleNames = Object.fromEntries(store.modules.map((m) => [m.id, m.displayName]));
  const allFiles = store.modules.flatMap((m) => m.attachments.map((a) => ({ ...a, module: m.displayName })));
  const estTotal = setup.reduce((t, m) => t + (m.estCost ?? 0), 0);
  const actTotal = setup.reduce((t, m) => t + (m.actualCost ?? 0), 0);
  const home = user.role === "STORE_OWNER" ? { label: "My stores", href: "/owner" } : { label: "Dashboard", href: "/hq" };

  return (
    <>
      <PageHeader
        crumbs={[home, { label: store.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {store.name} <StatusBadge status={store.overallStatus} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">{store.storeCode}</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {[store.area, store.city, stateName(store.state)].filter(Boolean).join(", ")}
            </span>
            <span className="flex items-center gap-1">
              <User className="size-3.5" aria-hidden />
              {store.owner.name}
            </span>
          </span>
        }
        actions={
          <>
            {can.overrideStatus(user) && <StatusOverride storeId={store.id} status={store.overallStatus} />}
            {can.editStoreMaster(user, store) && <EditStoreDialog store={store} />}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardContent className="px-4">
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{store.progressPercent}%</p>
            <ProgressBar value={store.progressPercent} label="Store progress" className="mt-2" />
            <p className="mt-1.5 text-xs text-muted-foreground">{store.approvedCount} of 7 modules approved by HQ</p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardContent className="px-4">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <KeyRound className="size-3.5" /> Key handover (Day 0)
            </p>
            <p className="mt-1 text-lg font-semibold">{formatDate(store.keyHandoverDate)}</p>
            <p className="text-xs text-muted-foreground">
              {store.daysSinceHandover !== null ? `${store.daysSinceHandover} day${store.daysSinceHandover === 1 ? "" : "s"} since handover` : store.actualLaunchDate ? "Store launched" : "Keys not received yet"}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardContent className="px-4">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" /> Launch
            </p>
            <p className="mt-1 text-lg font-semibold">{store.actualLaunchDate ? formatDate(store.actualLaunchDate) : formatDate(store.targetLaunchDate)}</p>
            <p className="text-xs text-muted-foreground">{store.actualLaunchDate ? `Launched (target ${formatDate(store.targetLaunchDate)})` : "Target launch date"}</p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardContent className="px-4">
            <p className="text-sm text-muted-foreground">Cost (actual / estimated)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatINR(actTotal)}</p>
            <p className="text-xs text-muted-foreground">of {formatINR(estTotal)} estimated</p>
          </CardContent>
        </Card>
      </div>

      {isOwner && <NextStep store={store} token={token} handover={handover} />}

      <Tabs defaultValue="modules" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="files">Files ({allFiles.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="info">Store info</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-4 space-y-2">
          {store.modules.map((m) => (
            <ModuleRow key={m.id} m={m} storeId={store.id} canApprove={canApprove} keyHandoverDate={store.keyHandoverDate} />
          ))}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planned vs actual</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline modules={setup} handover={store.keyHandoverDate} targetLaunch={store.targetLaunchDate} today={today} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <Card className="py-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Module</th>
                    <th className="px-4 py-2.5 font-medium">Vendor</th>
                    <th className="px-4 py-2.5 text-right font-medium">Estimated</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actual</th>
                    <th className="px-4 py-2.5 text-right font-medium">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {setup.map((m) => {
                    const v = m.actualCost !== null && m.estCost !== null ? m.actualCost - m.estCost : null;
                    return (
                      <tr key={m.id} className="border-b">
                        <td className="px-4 py-2">{m.displayName}</td>
                        <td className="px-4 py-2 text-muted-foreground">{m.vendorName ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatINR(m.estCost)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatINR(m.actualCost)}</td>
                        <td className={cn("px-4 py-2 text-right tabular-nums", v !== null && v > 0 && "text-red-600", v !== null && v < 0 && "text-emerald-700")}>
                          {v === null ? "—" : `${v > 0 ? "+" : ""}${formatINR(v)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className="px-4 py-2.5" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(estTotal)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(actTotal)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(actTotal - estTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-4 space-y-5">
          {store.modules
            .filter((m) => m.attachments.length)
            .map((m) => (
              <section key={m.id}>
                <h3 className="mb-2 text-sm font-medium">{m.displayName}</h3>
                <FileGallery files={m.attachments} />
              </section>
            ))}
          {!allFiles.length && <p className="text-sm text-muted-foreground">No photos or documents uploaded yet.</p>}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent>
              <ActivityList entries={store.activity} moduleNames={moduleNames} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Info k="Store code" v={store.storeCode} />
                <Info k="Store name" v={store.name} />
                <Info k="Store type" v={store.storeType === "OWN" ? "Own" : store.storeType === "FRANCHISE" ? "Franchise" : "—"} />
                <Info k="State" v={stateName(store.state)} />
                <Info k="City" v={store.city} />
                <Info k="Area" v={store.area} />
                <Info k="PIN code" v={store.pincode} />
                <Info k="Full address" v={store.address} />
                <Info k="Latitude, longitude" v={store.lat !== null && store.lng !== null ? `${store.lat}, ${store.lng}` : null} />
                <Info k="Carpet area" v={store.carpetAreaSqft ? `${store.carpetAreaSqft.toLocaleString("en-IN")} sq ft` : null} />
                <Info k="Floor" v={store.floor ? store.floor[0] + store.floor.slice(1).toLowerCase() : null} />
                <Info k="Store owner" v={`${store.owner.name} · ${store.owner.email}${store.owner.phone ? ` · ${store.owner.phone}` : ""}`} />
                <Info k="Target launch" v={formatDate(store.targetLaunchDate)} />
                <Info k="Key handover" v={formatDate(store.keyHandoverDate)} />
                <Info k="Actual launch" v={formatDate(store.actualLaunchDate)} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Info({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5">{v || "—"}</dd>
    </div>
  );
}

function ModuleRow({ m, storeId, canApprove, keyHandoverDate }: { m: ModuleView; storeId: string; canApprove: boolean; keyHandoverDate: string | null }) {
  const href = m.isMilestone ? `/stores/${storeId}/key-handover` : `/stores/${storeId}/modules/${m.moduleType}`;
  const pending = !m.isMilestone && m.status === "COMPLETED" && m.approvalStatus === "PENDING";
  const photos = m.attachments.filter((a) => a.fileType.startsWith("image/")).length;
  return (
    <div className={cn("rounded-lg border bg-card p-3 sm:p-4", m.overdue && "border-red-300", m.isMilestone && "bg-sky-50/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={href} className="group min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium group-hover:underline">
            {m.isMilestone && <KeyRound className="size-4 text-sky-700" aria-hidden />}
            {m.displayName}
            {m.isMilestone && <span className="text-xs font-normal text-muted-foreground">milestone · Day 0</span>}
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {m.isMilestone ? (
              <span className="text-xs text-muted-foreground">{keyHandoverDate ? `Keys received ${formatDate(keyHandoverDate)}` : "Keys not received yet"}</span>
            ) : (
              <>
                <ModuleStatusBadge status={m.status} />
                <ApprovalBadge status={m.approvalStatus} show={m.status === "COMPLETED" || m.approvalStatus !== "PENDING"} />
                <OverdueBadge days={m.daysOverdue} />
              </>
            )}
          </div>
        </Link>
        {canApprove && pending && <DecisionButtons moduleId={m.id} moduleName={m.displayName} />}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {m.plannedStart && (
          <span>
            Planned {formatDate(m.plannedStart)} – {formatDate(m.plannedEnd)}
          </span>
        )}
        {m.actualStart && (
          <span>
            Actual {formatDate(m.actualStart)} – {m.actualEnd ? formatDate(m.actualEnd) : "ongoing"}
          </span>
        )}
        {m.vendorName && <span>Vendor: {m.vendorName}</span>}
        <span className="flex items-center gap-1">
          <Paperclip className="size-3" aria-hidden /> {photos}/{m.minPhotos} photo{m.minPhotos > 1 ? "s" : ""} min
        </span>
        {m.commentCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" aria-hidden /> {m.commentCount}
          </span>
        )}
      </div>
      {m.status === "BLOCKED" && m.blockerReason && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">Blocked: {m.blockerReason}</p>}
      {m.approvalStatus === "REJECTED" && m.approvalComment && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
          HQ: “{m.approvalComment}”{m.approvedBy ? ` — ${m.approvedBy}` : ""}
        </p>
      )}
    </div>
  );
}

function NextStep({ store, token, handover }: { store: { id: string; keyHandoverDate: string | null; overallStatus: string | null }; token?: ModuleView; handover?: ModuleView }) {
  if (!store.keyHandoverDate && token?.status === "COMPLETED" && handover) {
    return (
      <Alert className="mt-4 border-sky-200 bg-sky-50">
        <KeyRound className="size-4" />
        <AlertTitle>Next: record the key handover</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>Token Advance is complete. Enter the handover date — fit-out modules are scheduled automatically from it.</span>
          <Button asChild size="sm">
            <Link href={`/stores/${store.id}/key-handover`}>Record key handover</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!store.keyHandoverDate) {
    return (
      <Alert className="mt-4">
        <KeyRound className="size-4" />
        <AlertTitle>Before fit-out</AlertTitle>
        <AlertDescription>Complete Store Location and Token Advance. Key handover can be recorded once Token Advance is Completed.</AlertDescription>
      </Alert>
    );
  }
  return null;
}
