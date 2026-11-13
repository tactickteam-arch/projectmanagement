import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { listNotifications, markRead, unreadCount } from "@/lib/services/notifications";

/** GET /api/notifications */
export async function GET() {
  return handle(async () => {
    const user = await requireApiUser();
    const [items, unread] = await Promise.all([listNotifications(user), unreadCount(user)]);
    return NextResponse.json({ items, unread });
  });
}

/** PATCH /api/notifications — mark read: { ids: [...] } or { all: true } */
export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const body = z.object({ ids: z.array(z.uuid()).max(200).optional(), all: z.boolean().optional() }).parse(await readJson(request));
    await markRead(user, body.all ? "all" : (body.ids ?? []));
    return NextResponse.json({ ok: true });
  });
}
