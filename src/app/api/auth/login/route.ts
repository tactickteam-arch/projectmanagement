import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { homePathFor } from "@/lib/auth/dal";
import { passwordAllowedFor } from "@/lib/auth/login-code";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const LoginBody = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1).max(200),
});

// bcrypt hash of a random, discarded value. Compared against when the e-mail is unknown,
// so response time does not reveal which accounts exist.
const DUMMY_HASH = "$2b$12$3w4MrSJYwq7CSxmnGkrTr.dnmWYDF8bvi6ETjlBwffpphfQkcIiN.";

/** POST /api/auth/login — e-mail and password. Switched off once sign-in by e-mail code is on
 * (decided 21 Nov 2026), except demo accounts while DEMO_PASSWORD_LOGIN=1. */
export async function POST(request: Request) {
  try {
    const parsed = LoginBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid e-mail address and password." }, { status: 400 });
    }
    const { email, password } = parsed.data;
    if (!passwordAllowedFor(email)) {
      return NextResponse.json({ error: "Passwords are no longer used. Sign in with a code sent to your e-mail." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, passwordHash: true, isActive: true },
    });
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk || !user.isActive) {
      return NextResponse.json({ error: "Incorrect e-mail or password, or the account is deactivated." }, { status: 401 });
    }

    await setSessionCookie(user.id);
    return NextResponse.json({ redirectTo: homePathFor(user.role) });
  } catch (error) {
    return errorResponse(error);
  }
}
