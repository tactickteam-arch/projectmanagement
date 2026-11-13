import { SignJWT, jwtVerify } from "jose";

/** Spec: "JWT sessions". The token carries only the user id; role and active status
 * are re-read from the database on every request (see dal.ts). */

export const SESSION_COOKIE = "sgm_session";
/** Session length — not specified in the spec (REQUIREMENTS.md Q-SESSION-LENGTH). */
export const SESSION_HOURS = 8;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());
  return { token, expiresAt };
}

/** Returns the user id from a valid, unexpired token, otherwise null. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
