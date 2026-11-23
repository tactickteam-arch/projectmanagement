import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { setFinalDesign } from "@/lib/services/files";

/** POST /api/attachments/:id/final — approve and lock this version as the final design. */
export async function POST(_req: Request, ctx: RouteContext<"/api/attachments/[id]/final">) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
    const { id } = await ctx.params;
    return NextResponse.json(await setFinalDesign(user, id, true));
  });
}

/** DELETE /api/attachments/:id/final — unlock the final design so a new version can be uploaded. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/attachments/[id]/final">) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN", "REGIONAL_MANAGER", "TEAM_MEMBER"]);
    const { id } = await ctx.params;
    return NextResponse.json(await setFinalDesign(user, id, false));
  });
}
