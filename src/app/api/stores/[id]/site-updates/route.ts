import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { createSiteUpdate, listSiteUpdates } from "@/lib/services/site-updates";

/** GET /api/stores/:id/site-updates — daily site photos, newest first. */
export async function GET(_req: Request, ctx: RouteContext<"/api/stores/[id]/site-updates">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    return NextResponse.json({ updates: await listSiteUpdates(user, id) });
  });
}

/** POST /api/stores/:id/site-updates — { moduleType, note }: today's update; photos follow. */
export async function POST(request: Request, ctx: RouteContext<"/api/stores/[id]/site-updates">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const u = await createSiteUpdate(user, id, await readJson(request));
    return NextResponse.json({ id: u.id }, { status: 201 });
  });
}
