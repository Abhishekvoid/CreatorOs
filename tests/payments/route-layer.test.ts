import { describe, expect, it } from "vitest";
import { NotImplementedError } from "@/lib/payments/errors";
import { RouteOnboardingService } from "@/lib/payments/route/service";

/**
 * Phase 9.4 — the Route account-onboarding layer is preparation only. Every
 * method must throw NotImplementedError; nothing wires up real Razorpay Route
 * calls yet.
 */
describe("RouteOnboardingService — stub throws NotImplementedError", () => {
  const svc = new RouteOnboardingService();

  it("createLinkedAccount throws NotImplementedError", async () => {
    await expect(
      svc.createLinkedAccount({ creatorId: "c1", email: "a@b.com", name: "A" }),
    ).rejects.toBeInstanceOf(NotImplementedError);
  });

  it("getAccountStatus throws NotImplementedError", async () => {
    await expect(svc.getAccountStatus("acc_1")).rejects.toBeInstanceOf(NotImplementedError);
  });

  it("generateOnboardingLink throws NotImplementedError", async () => {
    await expect(svc.generateOnboardingLink("acc_1")).rejects.toBeInstanceOf(NotImplementedError);
  });
});
