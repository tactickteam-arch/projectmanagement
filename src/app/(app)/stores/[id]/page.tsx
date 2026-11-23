import { CalendarClock, CalendarDays, ClipboardCheck, KeyRound, ListTodo, MapPin, User, Zap } from "lucide-react";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { FileGallery } from "@/components/file-list";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { LaunchFlow } from "@/components/launch-flow";
import { StatusBadge } from "@/components/status-badge";
import { EditStoreDialog, StatusOverride } from "@/components/store-actions";
import { SitePhotos } from "@/components/site-photos";
import { SnagPanel } from "@/components/snag-panel";
import { Timeline } from "@/components/timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePageUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDateOnly, todayInIndia } from "@/lib/dates";
import { formatDate, formatINR } from "@/lib/format";
import { stateName } from "@/lib/india-states";
import { getStoreDetailForPage, type StoreDetail } from "@/lib/queries";
import { listSiteUpdates, siteUpdateSteps } from "@/lib/services/site-updates";
import { listSnags, SNAG_TEAMS } from "@/lib/services/snags";
import type { AccessSubject } from "@/lib/auth/access";
import { interiorsBudget, shiftDate } from "@/lib/sop-rules";
import { teamLabel } from "@/lib/teams";
import { cn } from "@/lib/utils";

export const metadata = { title: "Store" };

export default async function StorePage({ params }: PageProps<"/stores/[id]">) {
  const user = await requirePageUser();
  const { id } = await params;
  const store = await getStoreDetailForPage(user, id);
  const today = formatDateOnly(todayInIndia());
  const snags = await listSnags(user, id);
  const siteUpdates = await listSiteUpdates(user, id);
  const photoSteps = await siteUpdateSteps(user, store);
  const openSnags = snags.filter((s) => s.status !== "CLOSED").length;
  const snagTeams = SNAG_TEAMS.map((k) => ({ key: k, label: teamLabel(k) }));
  const setup = store.modules;
  const moduleNames = Object.fromEntries(store.modules.map((m) => [m.id, m.displayName]));
  const allFiles = store.modules.flatMap((m) => m.attachments.map((a) => ({ ...a, module: m.displayName })));
  const estTotal = setup.reduce((t, m) => t + (m.estCost ?? 0), 0);
  const actTotal = setup.reduce((t, m) => t + (m.actualCost ?? 0), 0);
  const interiors = interiorsBudget(store.modules);
  const home = user.role === "STORE_OWNER" ? { label: "My stores", href: "/owner" } : user.role === "TEAM_MEMBER" ? { label: "My tasks", href: "/tasks" } : { label: "Dashboard", href: "/hq" };

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
            <p className="mt-1.5 text-xs text-muted-foreground">
              {store.approvedCount} of {store.totalSteps} steps done
            </p>
          </CardContent>
        </Card>
        {store.keyHandoverDate ? (
          <Card className="gap-2 py-4">
            <CardContent className="px-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <KeyRound className="size-3.5" /> Keys received (Day 0)
              </p>
              <p className="mt-1 text-lg font-semibold">{formatDate(store.keyHandoverDate)}</p>
              <p className="text-xs text-muted-foreground">
                {store.daysSinceHandover !== null ? `Day ${store.daysSinceHandover} of the setup clock` : "Store launched"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className={cn("gap-2 py-4", store.daysToExpectedKeys !== null && store.daysToExpectedKeys <= 7 && "border-amber-300 bg-amber-50/60")}>
            <CardContent className="px-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarClock className="size-3.5" /> Keys expected
              </p>
              <p className="mt-1 text-lg font-semibold">{formatDate(store.expectedKeyDate)}</p>
              <p className="text-xs text-muted-foreground">
                {store.expectedKeyDate
                  ? `T-7: sign board & materials by ${formatDate(shiftDate(store.expectedKeyDate, -7))}${store.daysToExpectedKeys !== null ? ` · ${store.daysToExpectedKeys >= 0 ? `${store.daysToExpectedKeys} day${store.daysToExpectedKeys === 1 ? "" : "s"} to go` : `${-store.daysToExpectedKeys} day${store.daysToExpectedKeys === -1 ? "" : "s"} late`}` : ""}`
                  : "From MOU point 11 (location filing)"}
              </p>
            </CardContent>
          </Card>
        )}
        <Card className="gap-2 py-4">
          <CardContent className="px-4">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" /> Launch
            </p>
            <p className="mt-1 text-lg font-semibold">{store.actualLaunchDate ? formatDate(store.actualLaunchDate) : formatDate(store.targetLaunchDate)}</p>
            <p className="text-xs text-muted-foreground">{store.actualLaunchDate ? `Soft launched (target ${formatDate(store.targetLaunchDate)})` : "Target soft launch date"}</p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardContent className="px-4">
            <p className="text-sm text-muted-foreground">Cost (actual / estimated)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatINR(actTotal)}</p>
            <p className="text-xs text-muted-foreground">of {formatINR(estTotal)} estimated</p>
            {interiors.quote !== null && (
              <p className={cn("mt-1 text-xs", interiors.over > 0 ? "font-medium text-red-600" : "text-muted-foreground")}>
                Interiors {formatINR(interiors.actual)} of {formatINR(interiors.quote)} quote
                {interiors.over > 0 && ` · ${formatINR(interiors.over)} over`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <YourActions store={store} user={user} />

      <Tabs defaultValue="flow" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="flow">Launch flow</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="snags">Snags{openSnags ? ` (${openSnags} open)` : ""}</TabsTrigger>
          <TabsTrigger value="site">Site photos</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="files">Files ({allFiles.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="info">Store info</TabsTrigger>
        </TabsList>

        <TabsContent value="flow" className="mt-4">
          <LaunchFlow store={store} user={user} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All 21 steps: planned vs actual</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline modules={store.modules} handover={store.keyHandoverDate} expectedKey={store.expectedKeyDate} targetLaunch={store.targetLaunchDate} today={today} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snags" className="mt-4">
          <SnagPanel storeId={store.id} snags={snags} canRaise={!store.actualLaunchDate} teams={snagTeams} defaultDue={shiftDate(today, 3)} defaultStage={store.keyHandoverDate && (store.daysSinceHandover ?? 0) > 3 ? "PRE_LAUNCH" : "KEY_HANDOVER"} />
        </TabsContent>

        <TabsContent value="site" className="mt-4">
          <SitePhotos
            storeId={store.id}
            updates={siteUpdates}
            steps={photoSteps}
            today={today}
            status={
              !store.keyHandoverDate
                ? "Daily site photos start once the keys are received."
                : store.actualLaunchDate
                  ? "The store has launched; site photos are closed."
                  : "Only Manju and the departments doing the on-site work post site photos."
            }
          />
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <Card className="py-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Step</th>
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
                <Info k="Keys expected (MOU point 11)" v={formatDate(store.expectedKeyDate)} />
                <Info k="Keys received (Day 0)" v={formatDate(store.keyHandoverDate)} />
                <Info k="Soft launch" v={formatDate(store.actualLaunchDate)} />
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

/** What the signed-in user can do on this store now: steps their team fills in that are ready,
 * and steps waiting for their approval. */
function YourActions({ store, user }: { store: StoreDetail; user: AccessSubject }) {
  const toDo = store.modules.filter((m) => !m.done && m.waitingFor.length === 0 && m.status !== "COMPLETED" && can.editModule(user, store, m));
  const toApprove = store.modules.filter((m) => m.status === "COMPLETED" && m.approvalStatus === "PENDING" && can.approveModule(user, store, m));
  const toRecord = store.modules.flatMap((m) =>
    m.status === "COMPLETED" && m.approvalStatus === "APPROVED" ? m.afterActions.filter((a) => !a.record && a.canRecord).map((a) => ({ m, a })) : [],
  );
  // SuperAdmin can act on every step; only show them approvals plus a short list.
  const list = user.role === "SUPER_ADMIN" ? toDo.slice(0, 4) : toDo;
  if (!list.length && !toApprove.length && !toRecord.length) return null;
  return (
    <Alert className="mt-4 border-sky-200 bg-sky-50">
      <ListTodo className="size-4" />
      <AlertTitle>Your next actions</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 flex flex-wrap gap-2">
          {toApprove.map((m) => (
            <li key={m.id}>
              <Link href={`/stores/${store.id}/modules/${m.moduleType}`} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100">
                <ClipboardCheck className="size-3.5" aria-hidden /> Approve: {m.code} · {m.displayName}
                {m.approverTeam ? ` (as ${teamLabel(m.approverTeam)})` : ""}
              </Link>
            </li>
          ))}
          {toRecord.map(({ m, a }) => (
            <li key={`${m.id}-${a.key}`}>
              <Link href={`/stores/${store.id}/modules/${m.moduleType}`} className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-950 hover:bg-sky-200">
                <Zap className="size-3.5" aria-hidden /> Record: {a.label}
              </Link>
            </li>
          ))}
          {list.map((m) => (
            <li key={m.id}>
              <Link href={`/stores/${store.id}/modules/${m.moduleType}`} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent">
                {m.code} · {m.displayName}
                {m.approvalStatus === "REJECTED" ? " — sent back" : m.status === "NOT_STARTED" ? " — ready to start" : ""}
              </Link>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
