import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { deleteSiteUpdate } from "@/lib/services/site-updates";

/** DELETE /api/site-updates/:id — remove an update posted by mistake. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/site-updates/[id]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await deleteSiteUpdate(user, id);
    return NextResponse.json({ ok: true });
  });
}
