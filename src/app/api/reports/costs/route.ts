import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { INR_FORMAT, xlsxResponse } from "@/lib/excel";
import { costReport } from "@/lib/queries";

/** GET /api/reports/costs — estimated vs actual per store and per module; ?format=xlsx. */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
    const report = await costReport(user);
    if (new URL(request.url).searchParams.get("format") === "xlsx") {
      const types = report.modules.map((m) => m.moduleType);
      return xlsxResponse("cost-report.xlsx", [
        {
          name: "By store",
          columns: [
            { header: "Store code", key: "code", width: 20 },
            { header: "Store", key: "name", width: 30 },
            { header: "City", key: "city" },
            { header: "Estimated", key: "est", numFmt: INR_FORMAT },
            { header: "Actual", key: "actual", numFmt: INR_FORMAT },
            { header: "Variance (actual − est.)", key: "var", numFmt: INR_FORMAT, width: 22 },
            ...types.flatMap((t) => [
              { header: `${report.moduleNames[t]} est.`, key: `${t}_e`, numFmt: INR_FORMAT },
              { header: `${report.moduleNames[t]} actual`, key: `${t}_a`, numFmt: INR_FORMAT },
            ]),
          ],
          rows: report.stores.map((s) => ({
            code: s.storeCode,
            name: s.name,
            city: s.city,
            est: s.est,
            actual: s.actual,
            var: s.actual - s.est,
            ...Object.fromEntries(types.flatMap((t) => [[`${t}_e`, s.modules[t]?.est ?? 0], [`${t}_a`, s.modules[t]?.actual ?? 0]])),
          })),
        },
        {
          name: "By step",
          columns: [
            { header: "Step", key: "name", width: 34 },
            { header: "Estimated", key: "est", numFmt: INR_FORMAT },
            { header: "Actual", key: "actual", numFmt: INR_FORMAT },
            { header: "Variance (actual − est.)", key: "var", numFmt: INR_FORMAT, width: 22 },
          ],
          rows: report.modules.map((m) => ({ name: m.displayName, est: m.est, actual: m.actual, var: m.actual - m.est })),
        },
      ]);
    }
    return NextResponse.json(report);
  });
}
