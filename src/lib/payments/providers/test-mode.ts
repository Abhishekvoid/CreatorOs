import { randomUUID } from "node:crypto";
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
export class TestModeProvider implements PaymentProvider {
  getProviderName(): string {
    return "razorpay_test";
  }

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret) {
      const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
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

  // ---- placeholders (real implementations arrive in Phase 4+) ----
  verifyWebhookSignature(_input: WebhookVerifyInput): boolean {
    throw new NotImplementedError("TestModeProvider.verifyWebhookSignature");
  }

  async getOrderStatus(_orderId: string): Promise<ProviderOrderStatus> {
    throw new NotImplementedError("TestModeProvider.getOrderStatus");
  }

  async getPaymentStatus(_paymentId: string): Promise<ProviderPaymentStatus> {
    throw new NotImplementedError("TestModeProvider.getPaymentStatus");
  }

  async refundPayment(_input: RefundInput): Promise<ProviderRefund> {
    throw new NotImplementedError("TestModeProvider.refundPayment");
  }
}
