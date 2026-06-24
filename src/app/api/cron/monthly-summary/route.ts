import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";
import { enqueueMonthlySummaries } from "@/lib/monthly-summary";

/**
 * Monthly income summary cron endpoint — a thin HTTP adapter. Enqueues the
 * previous month's summary into notification_queue for each active creator; the
 * existing notification worker (/api/cron/notifications) delivers them. Idempotent
 * via dedup_key, so a re-fired or retried monthly run never double-sends. No
 * business logic here. Authorized via the shared cron secret (also enforced by
 * the proxy for all /api/cron/*). Scheduled once a month by QStash.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    const { enqueued } = await enqueueMonthlySummaries();
    return new Response(JSON.stringify({ enqueued }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "monthly summary failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
