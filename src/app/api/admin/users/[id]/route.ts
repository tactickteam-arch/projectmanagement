import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { updateUser } from "@/lib/services/admin";

/** PATCH /api/admin/users/:id — activate/deactivate, regions, reset password. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN"]);
    const { id } = await ctx.params;
    await updateUser(user, id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}
