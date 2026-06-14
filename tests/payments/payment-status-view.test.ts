import { describe, expect, it } from "vitest";
import { defaultPaymentProfile, PAYMENT_STATUSES } from "@/lib/payments/profile";
import {
  paymentStatusView,
  TIMELINE_STAGES,
} from "@/components/onboarding/payments/state";

/**
 * Phase 9.5 — the Payment Setup state machine. Every one of the five statuses
 * must render a complete, valid view-model (so the UI needs no rewrite when
 * Route ships), and the publish warning must follow money-truth.
 */
describe("paymentStatusView — all five states render", () => {
  it("returns a complete, valid view for every status", () => {
    for (const status of PAYMENT_STATUSES) {
      const view = paymentStatusView({ ...defaultPaymentProfile(), status });
      expect(view.badgeLabel, status).toBeTruthy();
      expect(view.headline, status).toBeTruthy();
      expect(view.sub, status).toBeTruthy();
      expect(["neutral", "pending", "success", "danger"]).toContain(view.badgeTone);
      expect(TIMELINE_STAGES).toContain(view.timelineStage);
      expect(typeof view.showPublishWarning).toBe("boolean");
    }
  });

  it("not_started is the default and shows 'Not Connected'", () => {
    const view = paymentStatusView(defaultPaymentProfile());
    expect(view.badgeLabel).toBe("Not Connected");
    expect(view.badgeTone).toBe("neutral");
    expect(view.timelineStage).toBe("onboarding");
  });
});

describe("paymentStatusView — publish warning follows money-truth", () => {
  it("shows the warning whenever payouts are not yet enabled", () => {
    for (const status of PAYMENT_STATUSES) {
      const view = paymentStatusView({ ...defaultPaymentProfile(), status });
      // active is the only status whose canonical view clears the warning
      const expected = status !== "active";
      expect(view.showPublishWarning, status).toBe(expected);
    }
  });

  it("never warns once payouts_enabled is true, regardless of status", () => {
    for (const status of PAYMENT_STATUSES) {
      const view = paymentStatusView({
        ...defaultPaymentProfile(),
        status,
        payoutsEnabled: true,
      });
      expect(view.showPublishWarning, status).toBe(false);
    }
  });

  it("active reaches the 'live' timeline stage and a success badge", () => {
    const view = paymentStatusView({ ...defaultPaymentProfile(), status: "active" });
    expect(view.timelineStage).toBe("live");
    expect(view.badgeTone).toBe("success");
    expect(view.showPublishWarning).toBe(false);
  });
});
