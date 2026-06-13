import { cronUnauthorized, isCronAuthorized } from "@/lib/cron-auth";
import { processNotifications, reapStuckNotifications } from "@/lib/notifications/worker";

/**
 * Notification worker cron endpoint — a thin HTTP adapter. It first reaps rows
 * stranded by a crashed worker (processing → pending), then drains the queue
 * through the provider. No SQL, no business logic here. Authorized via the
 * shared cron secret (also enforced by the proxy for all /api/cron/*).
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    const { requeued } = await reapStuckNotifications();
    const { processed, sent, failed, dead_letter } = await processNotifications();
    return new Response(JSON.stringify({ processed, sent, failed, dead_letter, requeued }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "notifications failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
