import "server-only";

/**
 * True when a state-changing request comes from this site (Origin, or Referer as a fallback,
 * matches the Host). Route handlers that change data call this; server actions get Next's own check.
 */
export function sameOrigin(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/**
 * Reads a JSON body of at most `maxBytes`. Returns null for a body that is too large or not JSON
 * (the caller's schema check then refuses it).
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return null;
  const text = await request.text().catch(() => "");
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}
