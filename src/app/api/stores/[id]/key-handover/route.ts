import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { recordKeyHandover } from "@/lib/services/stores";

/** POST /api/stores/:id/key-handover — record handover and auto-schedule fit-out modules. */
export async function POST(request: Request, ctx: RouteContext<"/api/stores/[id]/key-handover">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await recordKeyHandover(user, id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
