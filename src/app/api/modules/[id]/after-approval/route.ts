import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { recordAfterApproval } from "@/lib/services/modules";

/** POST /api/modules/:id/after-approval — { action, values }: HO records the token advance payment, Accounts / Purchase the APX PO. */
export async function POST(request: Request, ctx: RouteContext<"/api/modules/[id]/after-approval">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await recordAfterApproval(user, id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
