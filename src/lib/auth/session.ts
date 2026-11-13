import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, verifySessionToken } from "./token";

export async function setSessionCookie(userId: string): Promise<void> {
  const { token, expiresAt } = await signSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // HTTPS-only in production. COOKIE_SECURE=false allows a plain-http local demo (e.g. a phone on the same Wi-Fi).
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSessionUserId(): Promise<string | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}
