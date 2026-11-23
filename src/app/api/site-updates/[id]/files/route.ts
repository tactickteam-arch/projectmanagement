import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { badRequest } from "@/lib/errors";
import { uploadSiteUpdatePhoto } from "@/lib/services/site-updates";

/** POST /api/site-updates/:id/files — multipart photo upload (file). */
export async function POST(request: Request, ctx: RouteContext<"/api/site-updates/[id]/files">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const form = await request.formData().catch(() => {
      throw badRequest("Upload must be multipart/form-data.");
    });
    const att = await uploadSiteUpdatePhoto(user, id, form);
    return NextResponse.json({ id: att.id }, { status: 201 });
  });
}
