import { describe, expect, it } from "vitest";
import { evaluatePublishEligibility } from "@/lib/publish-eligibility";

/**
 * Pure publish-gate rules. A creator may go live only when their page is
 * actually bookable: a claimed handle, at least one active booking service,
 * and at least one active availability window. The first failing rule (in
 * wizard order) decides the message and where to send them back to.
 */
describe("evaluatePublishEligibility", () => {
  const ready = { hasHandle: true, serviceCount: 1, availabilityCount: 1 };

  it("is eligible when handle, a service and availability all exist", () => {
    expect(evaluatePublishEligibility(ready)).toEqual({ ok: true });
  });

  it("blocks on a missing handle first, sending back to the handle step", () => {
    const result = evaluatePublishEligibility({ ...ready, hasHandle: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocker).toBe("handle");
      expect(result.redirectTo).toBe("/onboarding/handle");
    }
  });

  it("blocks when there is no bookable service", () => {
    const result = evaluatePublishEligibility({ ...ready, serviceCount: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocker).toBe("service");
      expect(result.redirectTo).toBe("/onboarding/service");
    }
  });

  it("blocks when there is no availability window", () => {
    const result = evaluatePublishEligibility({ ...ready, availabilityCount: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocker).toBe("availability");
      expect(result.redirectTo).toBe("/onboarding/availability");
    }
  });

  it("reports the earliest blocker (handle) when several are missing", () => {
    const result = evaluatePublishEligibility({
      hasHandle: false,
      serviceCount: 0,
      availabilityCount: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.blocker).toBe("handle");
  });

  it("treats negative/garbage counts as zero (defensive)", () => {
    const result = evaluatePublishEligibility({
      hasHandle: true,
      serviceCount: -1,
      availabilityCount: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.blocker).toBe("service");
  });
});
