import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { updateTemplate } from "@/lib/services/admin";

/** PATCH /api/admin/module-templates/:type — default offsets/duration, branding items. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/module-templates/[type]">) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN"]);
    const { type } = await ctx.params;
    await updateTemplate(user, type, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
