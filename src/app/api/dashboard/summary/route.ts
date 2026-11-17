import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { dashboardSummary, listStoreSummaries } from "@/lib/queries";

/** GET /api/dashboard/summary — summary cards + store × module grid. */
export async function GET() {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
    const [summary, stores] = await Promise.all([dashboardSummary(user), listStoreSummaries(user)]);
    return NextResponse.json({ summary, grid: stores.map((s) => ({ id: s.id, storeCode: s.storeCode, name: s.name, cells: s.cells })) });
  });
}
