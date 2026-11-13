import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { notFound } from "@/lib/errors";
import { getStoreDetail } from "@/lib/queries";
import { updateModule } from "@/lib/services/modules";

/** GET /api/stores/:id/modules/:moduleType */
export async function GET(_req: Request, ctx: RouteContext<"/api/stores/[id]/modules/[moduleType]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id, moduleType } = await ctx.params;
    const store = await getStoreDetail(user, id);
    const m = store.modules.find((x) => x.moduleType === moduleType);
    if (!m) throw notFound("Module not found");
    return NextResponse.json(m);
  });
}

/** PATCH /api/stores/:id/modules/:moduleType — owner updates the module. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/stores/[id]/modules/[moduleType]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id, moduleType } = await ctx.params;
    await updateModule(user, id, moduleType, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
