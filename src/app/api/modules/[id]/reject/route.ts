import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { decideModule } from "@/lib/services/modules";

/** POST /api/modules/:id/reject — HQ rejects with a comment; module returns to In Progress. */
export async function POST(request: Request, ctx: RouteContext<"/api/modules/[id]/reject">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await decideModule(user, id, "reject", await request.json().catch(() => ({})));
    return NextResponse.json({ ok: true });
  });
}
