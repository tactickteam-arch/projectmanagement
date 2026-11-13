import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { decideModule } from "@/lib/services/modules";

/** POST /api/modules/:id/approve — HQ approves a Completed module. */
export async function POST(request: Request, ctx: RouteContext<"/api/modules/[id]/approve">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await decideModule(user, id, "approve", await request.json().catch(() => ({})));
    return NextResponse.json({ ok: true });
  });
}
