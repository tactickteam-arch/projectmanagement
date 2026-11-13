import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { deleteAttachment } from "@/lib/services/files";

/** DELETE /api/attachments/:id */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await deleteAttachment(user, id);
    return NextResponse.json({ ok: true });
  });
}
