import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { badRequest } from "@/lib/errors";
import { uploadSnagFile } from "@/lib/services/snags";

/** POST /api/snags/:id/files — multipart upload (file, tag snag_before | snag_after). */
export async function POST(request: Request, ctx: RouteContext<"/api/snags/[id]/files">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const form = await request.formData().catch(() => {
      throw badRequest("Upload must be multipart/form-data.");
    });
    const att = await uploadSnagFile(user, id, form);
    return NextResponse.json({ id: att.id }, { status: 201 });
  });
}
