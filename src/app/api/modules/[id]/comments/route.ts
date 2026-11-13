import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { addComment, listComments } from "@/lib/services/comments";

/** GET /api/modules/:id/comments */
export async function GET(_req: Request, ctx: RouteContext<"/api/modules/[id]/comments">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    return NextResponse.json({ comments: await listComments(user, id) });
  });
}

/** POST /api/modules/:id/comments */
export async function POST(request: Request, ctx: RouteContext<"/api/modules/[id]/comments">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const c = await addComment(user, id, await readJson(request));
    return NextResponse.json({ id: c.id }, { status: 201 });
  });
}
