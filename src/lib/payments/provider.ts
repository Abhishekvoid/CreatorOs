import { TestModeProvider } from "./providers/test-mode";
import { RouteProvider } from "./providers/route";

/**
 * The payment provider boundary. ALL payment logic depends only on this
 * interface — no module outside lib/payments/providers/* may import a
 * provider SDK directly (enforced by tests/provider-boundary.test.ts).
 *
 * Today we run on standard Razorpay Test Mode (TestModeProvider). Razorpay
 * Route requires platform KYC we don't have yet, so RouteProvider is a
 * compile-safe stub. Switching is an env var; no caller knows which is live.
 */

export type CreateOrderInput = {
  amountPaise: number;
  currency: string;
  correlationId: string;
  /** opaque provider receipt — we pass the booking id */
  receipt?: string;
};

export type ProviderOrder = {
  orderId: string;
  amountPaise: number;
  currency: string;
  status: string;
};

export type WebhookVerifyInput = {
  payload: string;
  signature: string;
};

export type ProviderOrderStatus = {
  orderId: string;
  status: string;
  amountPaise: number;
};

export type ProviderPaymentStatus = {
  paymentId: string;
  orderId: string | null;
  status: string;
  amountPaise: number;
};

export type RefundInput = {
  paymentId: string;
  amountPaise?: number;
  correlationId: string;
};

export type ProviderRefund = {
  refundId: string;
  status: string;
};

export interface PaymentProvider {
  /** stable identifier persisted to payment_orders.provider */
  getProviderName(): string;
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  verifyWebhookSignature(input: WebhookVerifyInput): boolean;
  getOrderStatus(orderId: string): Promise<ProviderOrderStatus>;
  getPaymentStatus(paymentId: string): Promise<ProviderPaymentStatus>;
  refundPayment(input: RefundInput): Promise<ProviderRefund>;
}

/**
 * Resolve the active provider from PAYMENT_PROVIDER (test | route),
 * defaulting to test. Not cached, so the value is always current — and so
 * tests can flip the env between calls.
 */
export function getPaymentProvider(): PaymentProvider {
  const which = (process.env.PAYMENT_PROVIDER ?? "test").toLowerCase();
  return which === "route" ? new RouteProvider() : new TestModeProvider();
}
