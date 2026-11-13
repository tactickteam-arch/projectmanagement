import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { badRequest } from "@/lib/errors";
import { uploadAttachment } from "@/lib/services/files";

/** POST /api/modules/:id/attachments — multipart upload (fields: file, tag). */
export async function POST(request: Request, ctx: RouteContext<"/api/modules/[id]/attachments">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const form = await request.formData().catch(() => {
      throw badRequest("Upload must be multipart/form-data.");
    });
    const att = await uploadAttachment(user, id, form);
    return NextResponse.json({ id: att.id }, { status: 201 });
  });
}
