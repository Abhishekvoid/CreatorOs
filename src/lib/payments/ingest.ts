import { createHash, randomUUID } from "node:crypto";
import { getPool, pgErrorCode } from "@/lib/db/pool";
import { getPaymentProvider } from "./provider";

/**
 * Webhook Ingestor (Phase 4). Intentionally minimal: verify authenticity,
 * enrich the event from a READ-ONLY payment_orders lookup, persist ONE
 * immutable payment_events row, acknowledge. It writes no other table and
 * performs NO state transition — those belong to Phase 5.
 */

export type IngestInput = {
  /** the exact bytes the signature was computed over */
  rawBody: string;
  /** x-razorpay-signature header (may be absent) */
  signature: string | null;
  /** x-razorpay-event-id header (may be absent → we fall back to sha256(rawBody)) */
  eventId: string | null;
};

export type IngestResult =
  | { status: "ok"; providerEventId: string; correlationId: string; paymentOrderId: string | null }
  | { status: "duplicate" }
  | { status: "invalid_signature" };

type WebhookPayload = {
  event?: unknown;
  payload?: {
    payment?: { entity?: { order_id?: unknown } };
    order?: { entity?: { id?: unknown } };
  };
};

/** Recover the provider order id from either a payment or an order event. */
function extractProviderOrderId(payload: WebhookPayload): string | null {
  const fromPayment = payload.payload?.payment?.entity?.order_id;
  const fromOrder = payload.payload?.order?.entity?.id;
  const id = typeof fromPayment === "string" ? fromPayment : fromOrder;
  return typeof id === "string" ? id : null;
}

export async function ingestWebhook(input: IngestInput): Promise<IngestResult> {
  // (1)+(2) authenticity. No signature or a bad one ⇒ reject; read/write nothing.
  const provider = getPaymentProvider();
  if (!input.signature || !provider.verifyWebhookSignature({ payload: input.rawBody, signature: input.signature })) {
    return { status: "invalid_signature" };
  }

  // (3) enrichment inputs from the raw payload
  const payload = JSON.parse(input.rawBody) as WebhookPayload;
  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  const providerOrderId = extractProviderOrderId(payload);
  const providerEventId = input.eventId ?? createHash("sha256").update(input.rawBody).digest("hex");

  // (4)+(5) READ-ONLY lookup. Writing payment_orders is forbidden in Phase 4.
  let correlationId: string | null = null;
  let paymentOrderId: string | null = null;
  if (providerOrderId) {
    const { rows } = await getPool().query<{ id: string; correlation_id: string }>(
      `select id, correlation_id from public.payment_orders where provider_order_id = $1`,
      [providerOrderId],
    );
    if (rows[0]) {
      paymentOrderId = rows[0].id;
      correlationId = rows[0].correlation_id;
    }
  }
  // enrichment may fail (unlinked event); never drop a genuine signed event.
  // payment_order_id stays NULL and the raw order id remains in the payload.
  if (!correlationId) correlationId = randomUUID();

  // (6) persist the immutable ledger row — the ONLY write Phase 4 performs.
  try {
    await getPool().query(
      `insert into public.payment_events
         (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
       values ($1, 'webhook', $2, $3, $4, $5::jsonb)`,
      [correlationId, eventType, providerEventId, paymentOrderId, input.rawBody],
    );
  } catch (err) {
    // duplicate delivery collapses on unique(event_source, provider_event_id)
    if (pgErrorCode(err) === "23505") return { status: "duplicate" };
    throw err;
  }

  return { status: "ok", providerEventId, correlationId, paymentOrderId };
}
