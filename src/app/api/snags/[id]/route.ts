import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { deleteSnag } from "@/lib/services/snags";

/** DELETE /api/snags/:id — remove a snag logged by mistake. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/snags/[id]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await deleteSnag(user, id);
    return NextResponse.json({ ok: true });
  });
}
