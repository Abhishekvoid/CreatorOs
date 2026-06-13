/**
 * Cron endpoint authorization (Phase 6.1). Every /api/cron/* request must prove
 * it carries the shared secret, supplied either as
 * `Authorization: Bearer <CRON_SECRET>` or the `x-cron-secret` header.
 *
 * Pure and dependency-free (no node:crypto) so it runs unchanged in the Edge
 * middleware runtime and in Node route handlers. If CRON_SECRET is not
 * configured, every request is denied — fail closed.
 */

/** Constant-time string comparison (Edge-safe; avoids node:crypto). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function presentedSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (token) return token;
  }
  const header = req.headers.get("x-cron-secret");
  if (header && header.trim()) return header.trim();
  return null;
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // not configured → deny everything
  const presented = presentedSecret(req);
  return presented !== null && safeEqual(presented, secret);
}

export function cronUnauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
