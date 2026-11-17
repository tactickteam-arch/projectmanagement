import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StoreMapLoader } from "@/components/store-map-loader";
import type { OverallStatus } from "@/generated/prisma/enums";
import { requirePageUser } from "@/lib/auth/dal";
import { listStoreSummaries } from "@/lib/queries";
import { OVERALL_STATUS_LABELS } from "@/lib/status";

export const metadata = { title: "Map view" };

const COLORS: Record<OverallStatus | "NONE", string> = {
  NONE: "#9ca3af",
  LOCATION_FINALISED: "#64748b",
  PREMISES_CLEARED: "#8b5cf6",
  TOKEN_PAID: "#6366f1",
  KEYS_RECEIVED: "#0ea5e9",
  FITOUT_IN_PROGRESS: "#f59e0b",
  READY_FOR_LAUNCH: "#10b981",
  LAUNCHED: "#047857",
  ON_HOLD: "#f97316",
  DROPPED: "#52525b",
};

export default async function MapPage() {
  const user = await requirePageUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
  const stores = await listStoreSummaries(user);
  const pinned = stores.filter((s) => s.lat !== null && s.lng !== null);
  const missing = stores.filter((s) => s.lat === null || s.lng === null);
  const used = [...new Set(stores.map((s) => s.overallStatus ?? "NONE"))];

  return (
    <>
      <PageHeader title="Map view" description={`${pinned.length} store${pinned.length === 1 ? "" : "s"} pinned. Map data © OpenStreetMap contributors.`} />
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {used.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-full" style={{ background: COLORS[s] }} aria-hidden />
            {s === "NONE" ? "Location filing" : OVERALL_STATUS_LABELS[s]}
          </span>
        ))}
      </div>
      <StoreMapLoader
        stores={pinned.map((s) => ({
          id: s.id,
          name: s.name,
          storeCode: s.storeCode,
          city: s.city,
          lat: s.lat as number,
          lng: s.lng as number,
          progress: s.progressPercent,
          statusLabel: s.overallStatus ? OVERALL_STATUS_LABELS[s.overallStatus] : "Location filing",
          color: COLORS[s.overallStatus ?? "NONE"],
        }))}
      />
      {missing.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Not on the map (no pin yet):{" "}
          {missing.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`/stores/${s.id}`} className="underline">
                {s.name}
              </Link>
            </span>
          ))}
        </p>
      )}
    </>
  );
}
