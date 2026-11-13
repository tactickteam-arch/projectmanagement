import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { getStoreDetail } from "@/lib/queries";
import { updateStore } from "@/lib/services/stores";

/** GET /api/stores/:id — store detail. */
export async function GET(_req: Request, ctx: RouteContext<"/api/stores/[id]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    return NextResponse.json(await getStoreDetail(user, id));
  });
}

/** PATCH /api/stores/:id — update master fields. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/stores/[id]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await updateStore(user, id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
