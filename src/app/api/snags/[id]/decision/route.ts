import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { decideSnag } from "@/lib/services/snags";

/** POST /api/snags/:id/decision — { decision: "close" | "send_back", note }. */
export async function POST(request: Request, ctx: RouteContext<"/api/snags/[id]/decision">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await decideSnag(user, id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
