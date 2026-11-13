/** Browser-side helper for calling the app's JSON API with consistent error handling. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
      headers: init.form ? undefined : { "Content-Type": "application/json" },
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string> };
  if (!res.ok) {
    // Session expired: a full reload to /login clears all client state on purpose.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (res.status === 401) window.location.href = "/login";
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.fieldErrors ?? {});
  }
  return data as T;
}
