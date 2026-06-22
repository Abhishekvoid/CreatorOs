import { randomUUID } from "node:crypto";
import Razorpay from "razorpay";
import { NotImplementedError } from "../errors";
import type {
  BillingProvider,
  CancelSubscriptionInput,
  CreateSubscriptionInput,
  ProviderSubscription,
} from "@/lib/billing/provider";

/**
 * Razorpay subscription provider. This and the other files in this directory
 * are the ONLY places permitted to import the Razorpay SDK (provider boundary).
 *
 * With RAZORPAY_KEY_ID/SECRET configured it talks to Razorpay's Subscriptions
 * API; with no keys (CI / local-without-keys) it returns deterministic
 * synthetic subscriptions so the upgrade/cancel flow is exercisable end-to-end
 * without a network dependency — mirroring TestModeProvider for orders.
 */
function razorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
}

function toProviderSubscription(sub: {
  id: string;
  status: string;
  short_url?: string | null;
  current_end?: number | null;
}): ProviderSubscription {
  return {
    subscriptionId: sub.id,
    status: String(sub.status),
    shortUrl: sub.short_url ?? null,
    currentPeriodEnd: typeof sub.current_end === "number" ? sub.current_end : null,
  };
}

export class RazorpayBillingProvider implements BillingProvider {
  getProviderName(): string {
    return "razorpay";
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<ProviderSubscription> {
    const client = razorpayClient();
    if (client) {
      const sub = await client.subscriptions.create({
        plan_id: input.planId,
        total_count: input.totalCount ?? 120, // ~10 years of monthly cycles
        customer_notify: 1,
        notes: { creator_id: input.creatorId },
      });
      return toProviderSubscription(sub as Parameters<typeof toProviderSubscription>[0]);
    }

    // keyless synthetic mode — deterministic-shaped subscription id, no network
    return {
      subscriptionId: `sub_test_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
      status: "created",
      shortUrl: `https://rzp.test/subscriptions/checkout`,
      currentPeriodEnd: null,
    };
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<ProviderSubscription> {
    const client = razorpayClient();
    if (client) {
      // Razorpay: cancel_at_cycle_end=1 keeps the sub active until period end.
      const sub = await client.subscriptions.cancel(
        input.subscriptionId,
        input.atCycleEnd ?? true,
      );
      return toProviderSubscription(sub as Parameters<typeof toProviderSubscription>[0]);
    }
    // synthetic: cancellation acknowledged, still active until period end
    return {
      subscriptionId: input.subscriptionId,
      status: input.atCycleEnd === false ? "cancelled" : "active",
      shortUrl: null,
      currentPeriodEnd: null,
    };
  }

  async getSubscription(subscriptionId: string): Promise<ProviderSubscription> {
    const client = razorpayClient();
    if (!client) throw new NotImplementedError("RazorpayBillingProvider.getSubscription (no Razorpay keys)");
    const sub = await client.subscriptions.fetch(subscriptionId);
    return toProviderSubscription(sub as Parameters<typeof toProviderSubscription>[0]);
  }
}
