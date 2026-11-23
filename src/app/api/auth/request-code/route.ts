import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { CODE_RESEND_MS, CODE_TTL_MS, hashLoginCode, loginMode, newLoginCode } from "@/lib/auth/login-code";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/services/email-alerts";

const Body = z.object({ email: z.email().transform((e) => e.trim().toLowerCase()) });

/** POST /api/auth/request-code — e-mails a 6-digit sign-in code. The answer is the same whether or
 * not the account exists, so it cannot be used to find out who has an account. */
export async function POST(request: Request) {
  try {
    if (loginMode() !== "code") return NextResponse.json({ error: "Sign in with your password." }, { status: 400 });
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid e-mail address." }, { status: 400 });
    const { email } = parsed.data;
    const sentMsg = { ok: true, message: `If ${email} has an account, a sign-in code is on its way. It is valid for 10 minutes.` };

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, isActive: true, loginCodeSentAt: true } });
    if (!user || !user.isActive) return NextResponse.json(sentMsg);
    if (user.loginCodeSentAt && Date.now() - user.loginCodeSentAt.getTime() < CODE_RESEND_MS) {
      return NextResponse.json({ error: "A code was just sent. Wait a minute before asking for a new one." }, { status: 429 });
    }
    const code = newLoginCode();
    await prisma.user.update({
      where: { id: user.id },
      data: { loginCodeHash: hashLoginCode(code, user.id, process.env.SESSION_SECRET as string), loginCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS), loginCodeSentAt: new Date(), loginCodeAttempts: 0 },
    });
    const sent = await sendEmail({
      to: email,
      subject: `${code} is your Store Launch Tracker sign-in code`,
      text: `Hello ${user.name},\n\nYour sign-in code is ${code}. It is valid for 10 minutes.\n\nIf you did not ask for it, ignore this e-mail.\n\n${appUrl()}\n— Store Launch Tracker, Sangeetha Mobiles`,
      html: `<p>Hello ${user.name.replace(/</g, "&lt;")},</p><p>Your sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It is valid for 10 minutes. If you did not ask for it, ignore this e-mail.</p><p style="color:#666">Store Launch Tracker · Sangeetha Mobiles</p>`,
    });
    if (!sent && process.env.NODE_ENV !== "production") console.info(`[login code] ${email}: ${code}`);
    return NextResponse.json(sentMsg);
  } catch (error) {
    return errorResponse(error);
  }
}
