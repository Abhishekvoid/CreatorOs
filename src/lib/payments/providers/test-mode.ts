import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { NotImplementedError } from "../errors";
import type {
  CreateOrderInput,
  PaymentProvider,
  ProviderOrder,
  ProviderOrderStatus,
  ProviderPaymentStatus,
  ProviderRefund,
  RefundInput,
  WebhookVerifyInput,
} from "../provider";

/**
 * Standard Razorpay Test Mode. This is the ONLY place (besides route.ts)
 * permitted to import the Razorpay SDK.
 *
 * createOrder talks to Razorpay when RAZORPAY_KEY_ID/SECRET are configured;
 * with no keys (CI / local-without-keys) it returns a deterministic synthetic
 * test order so the booking flow is exercisable end-to-end without a network
 * dependency. The remaining methods are honest placeholders until Phase 4+.
 */
/** A Razorpay SDK client when keys are configured, else null (keyless test mode). */
function razorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
}

export class TestModeProvider implements PaymentProvider {
  getProviderName(): string {
    return "razorpay_test";
  }

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const client = razorpayClient();
    if (client) {
      const order = await client.orders.create({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: { correlation_id: input.correlationId },
      });
      return {
        orderId: order.id,
        amountPaise: Number(order.amount),
        currency: order.currency,
        status: String(order.status),
      };
    }

    // keyless test mode — synthetic, deterministic-shaped order id
    return {
      orderId: `order_test_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
      amountPaise: input.amountPaise,
      currency: input.currency,
      status: "created",
    };
  }

  /**
   * Verify a Razorpay webhook: HMAC-SHA256 of the RAW body keyed by
   * RAZORPAY_WEBHOOK_SECRET, constant-time compared to the supplied signature.
   * No secret (or no signature) means we cannot vouch for authenticity, so we
   * return false — the ingestor rejects with 400 and persists nothing.
   */
  verifyWebhookSignature(input: WebhookVerifyInput): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !input.signature) return false;
    const expected = createHmac("sha256", secret).update(input.payload).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(input.signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Fetch live order state from Razorpay (the reconciliation source of truth).
   * Returns the provider's native status token ('created' | 'attempted' |
   * 'paid'); the sweep's classifier interprets it. Keyless mode has no real
   * order to fetch, so it cannot reconcile and throws.
   */
  async getOrderStatus(orderId: string): Promise<ProviderOrderStatus> {
    const client = razorpayClient();
    if (!client) throw new NotImplementedError("TestModeProvider.getOrderStatus (no Razorpay keys)");
    const order = await client.orders.fetch(orderId);
    return { orderId: order.id, status: String(order.status), amountPaise: Number(order.amount) };
  }

  /** Fetch live payment state from Razorpay (status 'captured' | 'failed' | …). */
  async getPaymentStatus(paymentId: string): Promise<ProviderPaymentStatus> {
    const client = razorpayClient();
    if (!client) throw new NotImplementedError("TestModeProvider.getPaymentStatus (no Razorpay keys)");
    const payment = await client.payments.fetch(paymentId);
    return {
      paymentId: payment.id,
      orderId: (payment.order_id as string | null) ?? null,
      status: String(payment.status),
      amountPaise: Number(payment.amount),
    };
  }

  async refundPayment(_input: RefundInput): Promise<ProviderRefund> {
    throw new NotImplementedError("TestModeProvider.refundPayment");
  }
}
