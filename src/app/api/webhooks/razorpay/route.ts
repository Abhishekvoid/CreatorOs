import { ingestWebhook } from "@/lib/payments/ingest";
import { ingestBillingWebhook } from "@/lib/billing/ingest";
import { classifyWebhookEvent } from "@/lib/billing/classify";

/**
 * Razorpay webhook endpoint — a thin HTTP adapter for BOTH ledgers. Razorpay
 * delivers booking-order events and subscription events to this one URL with
 * one signature secret, so the route classifies the payload (Decision A) and
 * dispatches:
 *   - billing   → ingestBillingWebhook (subscription ledger)
 *   - payments  → ingestWebhook        (booking ledger — UNTOUCHED)
 *   - unknown   → persist to neither; log + alert; ack 200 (never guess)
 * No database access and no business logic live here.
 */
export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");

  // Classify on the parsed payload. A body we can't parse can't be routed →
  // treat as unknown (persist nothing), the same as an event with neither id.
  let route: ReturnType<typeof classifyWebhookEvent> = "unknown";
  try {
    route = classifyWebhookEvent(JSON.parse(rawBody));
  } catch {
    route = "unknown";
  }

  try {
    if (route === "billing") {
      const result = await ingestBillingWebhook({ rawBody, signature, eventId });
      if (result.status === "invalid_signature") return json(400, { error: "invalid signature" });
      return json(200, { status: result.status, ledger: "billing" });
    }

    if (route === "payments") {
      const result = await ingestWebhook({ rawBody, signature, eventId });
      if (result.status === "invalid_signature") return json(400, { error: "invalid signature" });
      return json(200, { status: result.status });
    }

    // Neither a subscription nor an order id: do NOT guess which ledger. Persist
    // nothing, surface it for monitoring, and ack so Razorpay stops retrying.
    console.error("[webhook] unroutable Razorpay event — persisted to neither ledger", {
      eventId,
      bodyPreview: rawBody.slice(0, 200),
    });
    return json(200, { status: "ignored", ledger: "none" });
  } catch {
    return json(500, { error: "ingest failed" });
  }
}
