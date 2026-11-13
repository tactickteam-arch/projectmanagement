import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { reassignOwner } from "@/lib/services/stores";

/** PATCH /api/stores/:id/owner — SuperAdmin assigns the store to another owner. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/stores/[id]/owner">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await reassignOwner(user, id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
