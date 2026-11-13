/** Expected, user-facing errors from business rules. Route handlers turn these into JSON. */
export class AppError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 413 | 415,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new AppError(404, what);
export const forbidden = (msg = "You do not have access to this action") => new AppError(403, msg);
export const badRequest = (msg: string, fieldErrors?: Record<string, string>) => new AppError(400, msg, fieldErrors);
export const conflict = (msg: string) => new AppError(409, msg);
