import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";
import { processPendingEvents } from "@/lib/payments";

/**
 * Processor Worker cron endpoint — a thin HTTP adapter. It drains the
 * payment_events ledger through the Phase 5 Processor (the sole writer of
 * truth), applying captured/failed transitions and queuing notifications. No
 * SQL or business logic here. Authorized via the shared cron secret (also
 * enforced by the proxy for all /api/cron/*).
 *
 * This is the scheduled trigger the webhook fast path depends on: the Phase 4
 * ingestor only appends events; this advances them to confirmed/cancelled.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    const summary = await processPendingEvents();
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "process failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
