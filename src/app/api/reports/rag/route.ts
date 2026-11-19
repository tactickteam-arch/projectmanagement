import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { xlsxResponse } from "@/lib/excel";
import { stateName } from "@/lib/india-states";
import { ragReport } from "@/lib/queries";
import { OVERALL_STATUS_LABELS, RAG_LABELS, type Rag } from "@/lib/status";
import { STAGE_COLUMNS } from "@/modules";
import type { OverallStatus } from "@/generated/prisma/enums";

const label = (r: Rag | null) => (r ? RAG_LABELS[r] : "—");

/** GET /api/reports/rag — weekly RAG rollout tracker (SOP slide 11); ?format=xlsx. */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
    const rows = await ragReport(user);
    if (new URL(request.url).searchParams.get("format") === "xlsx") {
      return xlsxResponse("weekly-rag.xlsx", [
        {
          name: "Weekly RAG",
          columns: [
            { header: "Store code", key: "code", width: 20 },
            { header: "Store", key: "store", width: 28 },
            { header: "City", key: "city" },
            { header: "State", key: "state" },
            { header: "Status", key: "status", width: 22 },
            { header: "RAG", key: "rag", width: 8 },
            ...STAGE_COLUMNS.map((c) => ({ header: c.label, key: `s${c.key}`, width: 10 })),
            { header: "Keys expected", key: "expected", width: 14 },
            { header: "Keys received", key: "keys", width: 14 },
            { header: "Target launch", key: "target", width: 14 },
            { header: "Needs attention", key: "attention", width: 70 },
          ],
          rows: rows.map((r) => ({
            code: r.storeCode,
            store: r.name,
            city: r.city,
            state: stateName(r.state),
            status: r.overallStatus ? OVERALL_STATUS_LABELS[r.overallStatus as OverallStatus] : "Location filing",
            rag: label(r.rag),
            ...Object.fromEntries(r.stages.map((s) => [`s${s.key}`, label(s.rag)])),
            expected: r.expectedKeyDate,
            keys: r.keyHandoverDate,
            target: r.targetLaunchDate,
            attention: r.attention.map((a) => `${label(a.rag)}: ${a.code} ${a.displayName}${a.daysOverdue ? ` (${a.daysOverdue}d overdue)` : ""}`).join("; "),
          })),
        },
      ]);
    }
    return NextResponse.json({ rows });
  });
}
