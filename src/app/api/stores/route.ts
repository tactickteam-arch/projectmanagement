import { NextResponse } from "next/server";
import { z } from "zod";
import { OverallStatus } from "@/generated/prisma/enums";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { stateName } from "@/lib/india-states";
import { INR_FORMAT, xlsxResponse } from "@/lib/excel";
import { listStoreSummaries } from "@/lib/queries";
import { createStore } from "@/lib/services/stores";
import { OVERALL_STATUS_LABELS } from "@/lib/status";

const Filters = z.object({
  q: z.string().trim().max(100).optional(),
  state: z.string().regex(/^[A-Z]{2}$/).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  status: z.union([z.enum(OverallStatus), z.literal("NONE")]).optional(),
  ownerId: z.uuid().optional(),
  launchMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  sort: z.enum(["code", "name", "progress", "launch", "overdue"]).optional(),
  format: z.enum(["json", "xlsx"]).optional(),
});

/** GET /api/stores — stores visible to the signed-in user; filters; ?format=xlsx exports. */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const parsed = Filters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Invalid filter values." }, { status: 400 });
    const { format, ...filters } = parsed.data;
    const stores = await listStoreSummaries(user, filters);
    if (format === "xlsx") {
      return xlsxResponse("stores.xlsx", [
        {
          name: "Stores",
          columns: [
            { header: "Store code", key: "code", width: 20 },
            { header: "Name", key: "name", width: 30 },
            { header: "City", key: "city" },
            { header: "State", key: "state" },
            { header: "Store owner", key: "owner", width: 28 },
            { header: "Overall status", key: "status", width: 20 },
            { header: "Progress %", key: "progress", width: 12 },
            { header: "Steps done (of 13)", key: "approved", width: 14 },
            { header: "Keys received", key: "handover", width: 14 },
            { header: "Target launch", key: "target", width: 14 },
            { header: "Soft launch", key: "actual", width: 14 },
            { header: "Overdue steps", key: "overdue", width: 12 },
            { header: "Blocked steps", key: "blocked", width: 12 },
            { header: "Estimated cost", key: "est", numFmt: INR_FORMAT },
            { header: "Actual cost", key: "act", numFmt: INR_FORMAT },
          ],
          rows: stores.map((s) => ({
            code: s.storeCode,
            name: s.name,
            city: s.city,
            state: stateName(s.state),
            owner: s.ownerName,
            status: s.overallStatus ? OVERALL_STATUS_LABELS[s.overallStatus] : "Location filing",
            progress: s.progressPercent,
            approved: s.approvedCount,
            handover: s.keyHandoverDate,
            target: s.targetLaunchDate,
            actual: s.actualLaunchDate,
            overdue: s.overdueCount,
            blocked: s.blockedCount,
            est: s.estCost,
            act: s.actualCost,
          })),
        },
      ]);
    }
    return NextResponse.json({ stores });
  });
}

/** POST /api/stores — create store (creates its modules from templates). */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const store = await createStore(user, await readJson(request));
    return NextResponse.json({ id: store.id, storeCode: store.storeCode }, { status: 201 });
  });
}
