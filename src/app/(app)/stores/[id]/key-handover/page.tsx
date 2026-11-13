import { notFound } from "next/navigation";
import { displayValue } from "@/lib/field-display";
import { KeyHandoverForm } from "@/components/key-handover-form";
import { PageHeader } from "@/components/page-header";
import { Uploader } from "@/components/uploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";
import { getStoreDetailForPage } from "@/lib/queries";
import { getTargetLaunchOffsetDays } from "@/lib/settings";

export const metadata = { title: "Key handover" };

export default async function KeyHandoverPage({ params }: PageProps<"/stores/[id]/key-handover">) {
  const user = await requirePageUser();
  const { id } = await params;
  const store = await getStoreDetailForPage(user, id);
  const m = store.modules.find((x) => x.isMilestone);
  if (!m) notFound();
  const token = store.modules.find((x) => x.moduleType === "TOKEN_ADVANCE");
  const isOwner = can.editModules(user, store);
  const tokenDone = token?.status === "COMPLETED";
  const photos = m.attachments.filter((a) => a.tag === (m.photoTag ?? "photo_handover"));
  const fitout = store.modules.filter((x) => !x.isMilestone && x.plannedStart);
  const offset = await getTargetLaunchOffsetDays();
  const home = user.role === "STORE_OWNER" ? { label: "My stores", href: "/owner" } : { label: "Dashboard", href: "/hq" };

  return (
    <>
      <PageHeader
        crumbs={[home, { label: store.name, href: `/stores/${store.id}` }, { label: "Key handover" }]}
        title="Key handover"
        description="Milestone, Day 0: the handover date schedules every fit-out module."
      />
      {!tokenDone && (
        <Alert className="mb-4">
          <AlertTitle>Not available yet</AlertTitle>
          <AlertDescription>Key handover cannot be entered before Token Advance is Completed.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{store.keyHandoverDate ? `Keys received ${formatDate(store.keyHandoverDate)}` : "Record the handover"}</CardTitle>
              <CardDescription>
                Fit-out modules get planned dates from their default offsets (HQ Settings). Target launch defaults to Day {offset} if not already set.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isOwner && tokenDone ? (
                <KeyHandoverForm
                  storeId={store.id}
                  isCorrection={!!store.keyHandoverDate}
                  photoCount={photos.length}
                  minPhotos={m.minPhotos}
                  initial={{
                    handoverDate: store.keyHandoverDate ?? "",
                    receivedBy: (m.details.receivedBy as string) ?? "",
                    premisesCondition: (m.details.premisesCondition as string) ?? "",
                    repairNotes: (m.details.repairNotes as string) ?? "",
                  }}
                />
              ) : (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Handover date</dt>
                    <dd>{formatDate(store.keyHandoverDate)}</dd>
                  </div>
                  {m.fields
                    .filter((f) => f.type !== "file")
                    .map((f) => (
                      <div key={f.key}>
                        <dt className="text-xs text-muted-foreground">{f.label}</dt>
                        <dd>{displayValue(f, m.details[f.key])}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </CardContent>
          </Card>
          {fitout.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fit-out schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {fitout.map((x) => (
                    <li key={x.id} className="flex justify-between gap-3 py-2">
                      <span>{x.displayName}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatDate(x.plannedStart)} – {formatDate(x.plannedEnd)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photos at handover</CardTitle>
            <CardDescription>Minimum {m.minPhotos} photos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Uploader moduleId={m.id} tag={m.photoTag ?? "photo_handover"} label="Handover photos" files={photos} canEdit={isOwner && tokenDone} photosOnly />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
