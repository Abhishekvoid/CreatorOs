import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";
import { reconcileSweep } from "@/lib/payments/reconcile";

/**
 * Reconciliation cron endpoint — a thin HTTP adapter. It invokes the sweep and
 * returns its counts. No SQL, no business logic: the sweep only emits
 * reconciliation events, and the Processor Worker (its own schedule) consumes
 * them. Authorized via the shared cron secret (also enforced by middleware).
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    const counts = await reconcileSweep();
    return new Response(JSON.stringify(counts), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "reconcile failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
