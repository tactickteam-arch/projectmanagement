import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { createUser, listUsers } from "@/lib/services/admin";

/** GET /api/admin/users */
export async function GET() {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN"]);
    return NextResponse.json({ users: await listUsers(user) });
  });
}

/** POST /api/admin/users */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser(["SUPER_ADMIN"]);
    return NextResponse.json(await createUser(user, await readJson(request)), { status: 201 });
  });
}
