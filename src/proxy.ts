import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

/**
 * Optimistic check only: sends visitors without a valid session token to /login.
 * Real authorization (active user, role, store scope) happens in the Data Access
 * Layer on every page and API call — see src/lib/auth/dal.ts.
 */
export async function proxy(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/hq/:path*", "/owner/:path*", "/stores/:path*", "/notifications/:path*"],
};
