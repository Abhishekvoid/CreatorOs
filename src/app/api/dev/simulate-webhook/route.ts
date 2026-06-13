import { createHmac, randomUUID } from "node:crypto";
import { processPendingEvents } from "@/lib/payments";
import { ingestWebhook } from "@/lib/payments/ingest";
import { getPool } from "@/lib/db/pool";

/**
 * DEV-ONLY webhook simulator. In keyless/local test mode a synthetic order can
 * neither be paid in the real Razorpay widget nor fetched by the reconciliation
 * sweep, so there is no way to close the loop. This emits a correctly-SIGNED
 * Razorpay-shaped webhook to the EXISTING Phase 4 ingestor and then runs the
 * Processor — exactly what a real webhook + cron would do. The browser still
 * never confirms; a verified webhook does.
 *
 * Hard-gated OFF in production and whenever the live provider is Route. It
 * requires RAZORPAY_WEBHOOK_SECRET so the signature genuinely verifies — no
 * signature bypass exists.
 */
export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function disabled(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if ((process.env.PAYMENT_PROVIDER ?? "test").toLowerCase() === "route") return true;
  return false;
}

export async function POST(request: Request): Promise<Response> {
  if (disabled()) return json(404, { error: "not found" });

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return json(500, { error: "RAZORPAY_WEBHOOK_SECRET must be set to simulate a signed webhook" });

  let body: { correlationId?: string; eventType?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  if (!body.correlationId) return json(400, { error: "correlationId required" });
  const eventType = body.eventType ?? "payment.captured";

  const { rows } = await getPool().query<{ provider_order_id: string | null }>(
    `select provider_order_id from public.payment_orders where correlation_id = $1 limit 1`,
    [body.correlationId],
  );
  const providerOrderId = rows[0]?.provider_order_id;
  if (!providerOrderId) return json(404, { error: "no order for correlationId" });

  const rawBody = JSON.stringify({ event: eventType, payload: { payment: { entity: { order_id: providerOrderId } } } });
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

  const result = await ingestWebhook({ rawBody, signature, eventId: `evt_dev_${randomUUID().slice(0, 12)}` });
  // run the Processor inline so the confirming screen flips promptly (the cron
  // would do this on its own schedule). The Processor remains the sole writer.
  await processPendingEvents();

  return json(200, { ingest: result.status });
}
