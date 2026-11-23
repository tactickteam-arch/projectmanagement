import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { markSnagFixed } from "@/lib/services/snags";

/** POST /api/snags/:id/fixed — the department marks the snag fixed (after photo/video uploaded). */
export async function POST(request: Request, ctx: RouteContext<"/api/snags/[id]/fixed">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await markSnagFixed(user, id, await readJson(request).catch(() => ({})));
    return NextResponse.json({ ok: true });
  });
}
