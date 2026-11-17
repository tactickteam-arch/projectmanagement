import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { recordAfterApproval } from "@/lib/services/modules";

/** POST /api/modules/:id/after-approval — { value }: e.g. the APX PO number after Token advance is approved. */
export async function POST(request: Request, ctx: RouteContext<"/api/modules/[id]/after-approval">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await recordAfterApproval(user, id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
