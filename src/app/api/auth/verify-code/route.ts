import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { homePathFor } from "@/lib/auth/dal";
import { checkLoginCode, CODE_MAX_ATTEMPTS, loginMode } from "@/lib/auth/login-code";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const Body = z.object({ email: z.email().transform((e) => e.trim().toLowerCase()), code: z.string().trim().max(12) });

/** POST /api/auth/verify-code — signs in with the e-mailed code (one use, 10 minutes, 5 tries). */
export async function POST(request: Request) {
  try {
    if (loginMode() !== "code") return NextResponse.json({ error: "Sign in with your password." }, { status: 400 });
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code from the e-mail." }, { status: 400 });
    const { email, code } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, isActive: true, loginCodeHash: true, loginCodeExpiresAt: true, loginCodeAttempts: true },
    });
    const wrong = NextResponse.json({ error: "That code is not right. Check the latest e-mail, or ask for a new code." }, { status: 401 });
    if (!user || !user.isActive) return wrong;
    const secret = process.env.SESSION_SECRET as string;
    const pre = checkLoginCode(user, "", user.id, secret);
    if (pre === "expired" || pre === "none") return NextResponse.json({ error: "This code has expired. Ask for a new one." }, { status: 401 });
    const locked = NextResponse.json({ error: `Too many tries (${CODE_MAX_ATTEMPTS}). Ask for a new code.` }, { status: 429 });
    if (pre === "locked") return locked;
    // Count this try before checking the code, atomically, so parallel guesses cannot get past the limit.
    const counted = await prisma.user.updateMany({
      where: { id: user.id, loginCodeHash: user.loginCodeHash, loginCodeAttempts: { lt: CODE_MAX_ATTEMPTS } },
      data: { loginCodeAttempts: { increment: 1 } },
    });
    if (counted.count !== 1) return locked;
    const result = checkLoginCode({ ...user, loginCodeAttempts: 0 }, code.replace(/\s/g, ""), user.id, secret);
    if (result !== "ok") return wrong;
    // One use only: clear the code; only one request can win this update.
    const used = await prisma.user.updateMany({ where: { id: user.id, loginCodeHash: user.loginCodeHash }, data: { loginCodeHash: null, loginCodeExpiresAt: null, loginCodeAttempts: 0 } });
    if (used.count !== 1) return wrong;
    await setSessionCookie(user.id);
    return NextResponse.json({ redirectTo: homePathFor(user.role) });
  } catch (error) {
    return errorResponse(error);
  }
}
