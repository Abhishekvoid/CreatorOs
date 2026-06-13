import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";
import { runIntegrityChecks } from "@/lib/payments/integrity";

/**
 * Integrity cron endpoint — a thin, read-only HTTP adapter. It runs the
 * invariant checks and reports whether the system passed. No writes, no
 * recovery. Authorized via the shared cron secret (also enforced by the proxy).
 *
 * Per spec, `violations` is the count (0) when healthy and the violation array
 * when not.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    const result = await runIntegrityChecks();
    return new Response(
      JSON.stringify({ passed: result.passed, violations: result.passed ? 0 : result.violations }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch {
    return new Response(JSON.stringify({ error: "integrity check failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
