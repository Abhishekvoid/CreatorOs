/**
 * Webhook routing predicate (Decision A) — the SINGLE place the payments and
 * billing ledgers can cross-contaminate, so it is named, pure, and dedicated-
 * tested.
 *
 * Razorpay delivers every event (booking orders AND subscription charges) to
 * one URL with one signature secret. We route by INSPECTING the payload, never
 * by trusting the event name alone, because `payment.failed` fires for both a
 * booking order and a subscription auto-charge:
 *
 *   - a subscription id present  → billing ledger   (ingestBillingWebhook)
 *   - else an order id present   → payments ledger   (existing ingestWebhook)
 *   - neither                    → do NOT guess: persist to neither ledger
 *
 * Subscription id is checked FIRST: a subscription charge event carries both a
 * subscription entity and a payment entity (with an order_id), and it must go
 * to billing.
 */

export type WebhookRoute = "billing" | "payments" | "unknown";

type Entity = { [k: string]: unknown };
type WebhookPayload = {
  payload?: {
    subscription?: { entity?: Entity };
    payment?: { entity?: Entity };
    order?: { entity?: Entity };
  };
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** The subscription id from either the subscription entity or a sub-linked payment. */
export function extractSubscriptionId(payload: WebhookPayload): string | null {
  return (
    str(payload.payload?.subscription?.entity?.id) ??
    str(payload.payload?.payment?.entity?.subscription_id)
  );
}

/** The provider order id from either a payment or an order event. */
export function extractOrderId(payload: WebhookPayload): string | null {
  return str(payload.payload?.payment?.entity?.order_id) ?? str(payload.payload?.order?.entity?.id);
}

/** Route a parsed webhook payload to a ledger. Pure; no side effects. */
export function classifyWebhookEvent(payload: WebhookPayload): WebhookRoute {
  if (extractSubscriptionId(payload)) return "billing";
  if (extractOrderId(payload)) return "payments";
  return "unknown";
}
