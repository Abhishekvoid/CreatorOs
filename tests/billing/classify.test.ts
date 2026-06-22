import { describe, expect, it } from "vitest";
import { classifyWebhookEvent } from "@/lib/billing/classify";

/**
 * Decision A — the webhook routing predicate. This is the ONLY place the
 * payments and billing ledgers can cross-contaminate, so it gets dedicated
 * coverage. The contract: a subscription id routes to billing (even when an
 * order id is also present, as on a subscription charge); an order id alone
 * routes to payments; neither routes nowhere (we never guess).
 */

// A subscription charge: Razorpay sends BOTH a subscription entity and a
// payment entity (with an order_id). Must route to billing.
const subscriptionCharged = {
  event: "subscription.charged",
  payload: {
    subscription: { entity: { id: "sub_ABC123" } },
    payment: { entity: { id: "pay_1", order_id: "order_sub_99" } },
  },
};

// A subscription auto-charge that failed: payment.failed carrying the sub id.
const subscriptionPaymentFailed = {
  event: "payment.failed",
  payload: {
    payment: { entity: { id: "pay_2", order_id: "order_sub_100", subscription_id: "sub_ABC123" } },
  },
};

// A booking order that failed: payment.failed with only an order id.
const bookingPaymentFailed = {
  event: "payment.failed",
  payload: { payment: { entity: { id: "pay_3", order_id: "order_booking_7" } } },
};

// A booking order captured: only an order id.
const bookingPaymentCaptured = {
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_4", order_id: "order_booking_8" } } },
};

// Malformed: neither a subscription id nor an order id.
const malformed = { event: "payment.failed", payload: { payment: { entity: { id: "pay_5" } } } };

describe("classifyWebhookEvent (Decision A)", () => {
  it("routes subscription.charged to billing", () => {
    expect(classifyWebhookEvent(subscriptionCharged)).toBe("billing");
  });

  it("routes a subscription payment.failed to billing (sub id beats order id)", () => {
    expect(classifyWebhookEvent(subscriptionPaymentFailed)).toBe("billing");
  });

  it("routes a booking payment.failed to payments", () => {
    expect(classifyWebhookEvent(bookingPaymentFailed)).toBe("payments");
  });

  it("routes a booking payment.captured to payments", () => {
    expect(classifyWebhookEvent(bookingPaymentCaptured)).toBe("payments");
  });

  it("routes an event with neither id nowhere (unknown — never guess)", () => {
    expect(classifyWebhookEvent(malformed)).toBe("unknown");
    expect(classifyWebhookEvent({})).toBe("unknown");
  });
});
