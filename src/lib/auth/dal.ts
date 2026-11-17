import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { readSessionUserId } from "./session";

/** Narrow user shape handed to pages and route handlers. Never includes the password hash. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  regionStates: string[];
  teams: string[];
}

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Data Access Layer: resolves the signed-in user from the session cookie and the
 * database. Deactivated or deleted users are treated as signed out immediately.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await readSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, regionStates: true, teams: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, regionStates: user.regionStates, teams: user.teams };
}

/** For pages: redirect to /login when signed out, to the home page when the role is not allowed. */
export async function requirePageUser(roles?: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

/** For API route handlers: throws AuthError (401/403) — convert with authErrorResponse(). */
export async function requireApiUser(roles?: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Not signed in");
  if (roles && !roles.includes(user.role)) throw new AuthError(403, "You do not have access to this action");
  return user;
}

export function homePathFor(role: Role): string {
  return role === "STORE_OWNER" ? "/owner" : role === "TEAM_MEMBER" ? "/tasks" : "/hq";
}
