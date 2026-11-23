import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** E-mail sign-in codes: 6 digits, valid 10 minutes, 5 tries, a new one at most once a minute. */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_RESEND_MS = 60 * 1000;

export function newLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Only this hash is stored; it is tied to the user so a code cannot be reused for another account. */
export function hashLoginCode(code: string, userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

export type CodeState = { loginCodeHash: string | null; loginCodeExpiresAt: Date | null; loginCodeAttempts: number };

export function checkLoginCode(state: CodeState, code: string, userId: string, secret: string, now = new Date()): "ok" | "wrong" | "expired" | "locked" | "none" {
  if (!state.loginCodeHash || !state.loginCodeExpiresAt) return "none";
  if (state.loginCodeExpiresAt.getTime() < now.getTime()) return "expired";
  if (state.loginCodeAttempts >= CODE_MAX_ATTEMPTS) return "locked";
  if (!/^\d{6}$/.test(code)) return "wrong";
  const a = Buffer.from(hashLoginCode(code, userId, secret), "hex");
  const b = Buffer.from(state.loginCodeHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "wrong";
}

/**
 * How people sign in. "code": e-mail code only (decided 21 Nov 2026) — on once e-mail sending is set
 * up, or with LOGIN_MODE=code (development: the code is printed to the server console).
 * "password": until then. Demo accounts (…test) keep their password while DEMO_PASSWORD_LOGIN=1.
 */
export function loginMode(env: Record<string, string | undefined> = process.env): "code" | "password" {
  if (env.LOGIN_MODE === "code" || env.LOGIN_MODE === "password") return env.LOGIN_MODE;
  return env.EMAIL_FROM && env.RESEND_API_KEY ? "code" : "password";
}

export function passwordAllowedFor(email: string, env: Record<string, string | undefined> = process.env): boolean {
  if (loginMode(env) === "password") return true;
  return env.DEMO_PASSWORD_LOGIN === "1" && /\.test$/i.test(email);
}
