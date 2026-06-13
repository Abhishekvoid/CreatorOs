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
 * Razorpay Route provider — for split settlements to creator-linked accounts.
 * Route requires platform KYC/approval we don't have yet, so this is a
 * compile-safe stub implementing the full interface; every method throws
 * NotImplementedError. getProviderName works so provider selection is testable.
 * When Route access lands, this file (and test-mode.ts) are the only places
 * that change.
 */
export class RouteProvider implements PaymentProvider {
  getProviderName(): string {
    return "razorpay_route";
  }

  async createOrder(_input: CreateOrderInput): Promise<ProviderOrder> {
    throw new NotImplementedError("RouteProvider.createOrder");
  }

  verifyWebhookSignature(_input: WebhookVerifyInput): boolean {
    throw new NotImplementedError("RouteProvider.verifyWebhookSignature");
  }

  async getOrderStatus(_orderId: string): Promise<ProviderOrderStatus> {
    throw new NotImplementedError("RouteProvider.getOrderStatus");
  }

  async getPaymentStatus(_paymentId: string): Promise<ProviderPaymentStatus> {
    throw new NotImplementedError("RouteProvider.getPaymentStatus");
  }

  async refundPayment(_input: RefundInput): Promise<ProviderRefund> {
    throw new NotImplementedError("RouteProvider.refundPayment");
  }
}
