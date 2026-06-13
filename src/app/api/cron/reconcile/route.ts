import { reconcileSweep } from "@/lib/payments/reconcile";

/**
 * Reconciliation cron endpoint — a thin HTTP adapter. It invokes the sweep and
 * returns its counts. No SQL, no business logic: the sweep only emits
 * reconciliation events, and the Processor Worker (its own schedule) consumes
 * them.
 */
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
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
