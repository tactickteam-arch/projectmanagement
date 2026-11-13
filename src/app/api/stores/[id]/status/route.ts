import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { overrideStatus } from "@/lib/services/stores";

/** POST /api/stores/:id/status — HQ sets On Hold / Dropped, or back to automatic. */
export async function POST(request: Request, ctx: RouteContext<"/api/stores/[id]/status">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await overrideStatus(user, id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
