import { createHash } from "node:crypto";
import { getPool, pgErrorCode } from "@/lib/db/pool";
import { getPaymentProvider } from "@/lib/payments";
import { extractSubscriptionId } from "./classify";

/**
 * Billing Webhook Ingestor — the subscription analogue of the payments
 * ingestor. Intentionally minimal: verify authenticity, enrich from a
 * READ-ONLY subscriptions lookup, persist ONE immutable billing_events row,
 * acknowledge. It writes no other table and performs NO state transition —
 * those belong to the billing processor.
 *
 * Authenticity reuses the payments provider's verifier: Razorpay signs every
 * webhook with the same RAZORPAY_WEBHOOK_SECRET, so there is one HMAC check for
 * both ledgers and we never duplicate that logic.
 */

export type BillingIngestInput = {
  rawBody: string;
  signature: string | null;
  eventId: string | null;
};

export type BillingIngestResult =
  | { status: "ok"; providerEventId: string; razorpaySubscriptionId: string | null; creatorId: string | null }
  | { status: "duplicate" }
  | { status: "invalid_signature" };

type Payload = { event?: unknown };

export async function ingestBillingWebhook(input: BillingIngestInput): Promise<BillingIngestResult> {
  // authenticity — same secret as payments; reject bad/absent signatures.
  const provider = getPaymentProvider();
  if (!input.signature || !provider.verifyWebhookSignature({ payload: input.rawBody, signature: input.signature })) {
    return { status: "invalid_signature" };
  }

  const payload = JSON.parse(input.rawBody) as Payload;
  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  const razorpaySubscriptionId = extractSubscriptionId(payload as Parameters<typeof extractSubscriptionId>[0]);
  const providerEventId = input.eventId ?? createHash("sha256").update(input.rawBody).digest("hex");

  // READ-ONLY enrichment: link to the creator if we already know this sub.
  // Writing subscriptions is forbidden here — that's the processor's job.
  let creatorId: string | null = null;
  if (razorpaySubscriptionId) {
    const { rows } = await getPool().query<{ creator_id: string }>(
      `select creator_id from public.subscriptions where razorpay_subscription_id = $1`,
      [razorpaySubscriptionId],
    );
    creatorId = rows[0]?.creator_id ?? null;
  }

  // persist the immutable ledger row — the ONLY write the ingestor performs.
  try {
    await getPool().query(
      `insert into public.billing_events
         (creator_id, event_source, event_type, provider_event_id, razorpay_subscription_id, payload)
       values ($1, 'webhook', $2, $3, $4, $5::jsonb)`,
      [creatorId, eventType, providerEventId, razorpaySubscriptionId, input.rawBody],
    );
  } catch (err) {
    if (pgErrorCode(err) === "23505") return { status: "duplicate" };
    throw err;
  }

  return { status: "ok", providerEventId, razorpaySubscriptionId, creatorId };
}
