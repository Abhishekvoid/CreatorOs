import { RazorpayBillingProvider } from "@/lib/payments/providers/billing";

/**
 * The billing (subscription) provider boundary — the subscription analogue of
 * the payments PaymentProvider. ALL subscription logic depends only on this
 * interface; the Razorpay SDK is imported solely inside
 * lib/payments/providers/* (enforced by tests/provider-boundary.test.ts), so
 * the SDK-backed implementation lives there even though the interface lives
 * here with the rest of the billing module.
 *
 * Webhook signature verification is intentionally NOT part of this surface:
 * Razorpay signs every webhook (payments and subscriptions alike) with the same
 * RAZORPAY_WEBHOOK_SECRET, so the single endpoint verifies once via the existing
 * payments provider and never duplicates that logic here.
 */

export type CreateSubscriptionInput = {
  /** Razorpay plan id for Pro (env RAZORPAY_PRO_PLAN_ID) */
  planId: string;
  /** our creator id — passed in Razorpay notes so the webhook is correlatable */
  creatorId: string;
  /** number of billing cycles to authorize; defaults to a long horizon */
  totalCount?: number;
};

export type ProviderSubscription = {
  subscriptionId: string;
  /** Razorpay-native status ('created' | 'authenticated' | 'active' | …) */
  status: string;
  /** hosted checkout URL the client is redirected to (null in synthetic mode) */
  shortUrl: string | null;
  /** unix seconds of the current paid period end, when Razorpay reports it */
  currentPeriodEnd: number | null;
};

export type CancelSubscriptionInput = {
  subscriptionId: string;
  /** true = cancel at cycle end (keep Pro until period end); false = immediate */
  atCycleEnd?: boolean;
};

export interface BillingProvider {
  /** stable identifier persisted to subscriptions for diagnostics */
  getProviderName(): string;
  createSubscription(input: CreateSubscriptionInput): Promise<ProviderSubscription>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<ProviderSubscription>;
  getSubscription(subscriptionId: string): Promise<ProviderSubscription>;
}

/**
 * Resolve the active billing provider. Today this is always Razorpay
 * (subscriptions run on standard Razorpay, not Route), so there is a single
 * implementation; the factory exists for symmetry with getPaymentProvider and
 * so tests can inject a fake.
 */
export function getBillingProvider(): BillingProvider {
  return new RazorpayBillingProvider();
}
