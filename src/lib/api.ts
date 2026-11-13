import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth/dal";
import { AppError } from "./errors";

/** Turns thrown errors from route handlers into JSON responses without leaking internals.
 * Next.js control-flow errors (redirect, dynamic-rendering bail-outs) are re-thrown. */
export function errorResponse(error: unknown): NextResponse {
  unstable_rethrow(error);
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) fieldErrors[issue.path.join(".") || "_"] = issue.message;
    return NextResponse.json({ error: "Some fields are not valid.", fieldErrors }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Wraps a route handler body with error handling. */
export async function handle(fn: () => Promise<NextResponse | Response>): Promise<NextResponse | Response> {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, "Request body must be JSON.");
  }
}
