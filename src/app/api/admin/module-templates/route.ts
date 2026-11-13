import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { updateTargetLaunchOffset } from "@/lib/services/admin";
import { getTargetLaunchOffsetDays } from "@/lib/settings";

/** GET /api/admin/module-templates */
export async function GET() {
  return handle(async () => {
    await requireApiUser(["SUPER_ADMIN"]);
    const templates = await prisma.moduleTemplate.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ templates, targetLaunchOffsetDays: await getTargetLaunchOffsetDays() });
  });
}

/** PATCH /api/admin/module-templates — { targetLaunchOffsetDays } */
export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN"]);
    const body = (await readJson(request)) as { targetLaunchOffsetDays?: unknown };
    await updateTargetLaunchOffset(user, { days: body?.targetLaunchOffsetDays });
    return NextResponse.json({ ok: true });
  });
}
