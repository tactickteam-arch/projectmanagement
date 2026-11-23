import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { createSnag, listSnags } from "@/lib/services/snags";

/** GET /api/stores/:id/snags — the store's snag list. */
export async function GET(_req: Request, ctx: RouteContext<"/api/stores/[id]/snags">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    return NextResponse.json({ snags: await listSnags(user, id) });
  });
}

/** POST /api/stores/:id/snags — log a snag. */
export async function POST(request: Request, ctx: RouteContext<"/api/stores/[id]/snags">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const snag = await createSnag(user, id, await readJson(request));
    return NextResponse.json({ id: snag.id }, { status: 201 });
  });
}
