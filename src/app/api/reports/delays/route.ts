import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { xlsxResponse } from "@/lib/excel";
import { stateName } from "@/lib/india-states";
import { delaysReport } from "@/lib/queries";
import { MODULE_STATUS_LABELS } from "@/lib/status";

/** GET /api/reports/delays — overdue modules sorted by days overdue; ?format=xlsx. */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
    const rows = await delaysReport(user);
    if (new URL(request.url).searchParams.get("format") === "xlsx") {
      return xlsxResponse("delays-report.xlsx", [
        {
          name: "Overdue steps",
          columns: [
            { header: "Store code", key: "code", width: 20 },
            { header: "Store", key: "store", width: 30 },
            { header: "City", key: "city" },
            { header: "State", key: "state" },
            { header: "Store owner", key: "owner", width: 28 },
            { header: "Step", key: "module", width: 32 },
            { header: "Status", key: "status" },
            { header: "Planned end", key: "end", width: 14 },
            { header: "Days overdue", key: "days", width: 12 },
            { header: "Blocker reason", key: "blocker", width: 40 },
          ],
          rows: rows.map((r) => ({
            code: r.store.storeCode,
            store: r.store.name,
            city: r.store.city,
            state: stateName(r.store.state),
            owner: r.store.ownerName,
            module: r.displayName,
            status: MODULE_STATUS_LABELS[r.status],
            end: r.plannedEnd,
            days: r.daysOverdue,
            blocker: r.blockerReason,
          })),
        },
      ]);
    }
    return NextResponse.json({ rows });
  });
}
