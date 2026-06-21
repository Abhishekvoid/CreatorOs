import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";
import { processPendingBillingEvents, reconcileBillingExpiries } from "@/lib/billing";

/**
 * Billing Processor cron endpoint — a thin HTTP adapter, the subscription
 * analogue of /api/cron/process-events. Each tick it (1) drains the
 * billing_events ledger through the processor (the sole writer of subscription
 * truth), then (2) runs the reconciliation sweep that downgrades subscriptions
 * whose paid period has lapsed (the step no webhook fires for). No SQL or
 * business logic here. Authorized via the shared cron secret (also enforced by
 * the proxy for all /api/cron/*).
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    const drained = await processPendingBillingEvents();
    const swept = await reconcileBillingExpiries();
    return new Response(JSON.stringify({ ...drained, ...swept }), {
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
