import { describe, expect, it } from "vitest";
import { notificationTypeLabel } from "@/lib/notifications/queue";

/**
 * Friendly labels for the observability page — pure mapping, no DB.
 */
describe("notificationTypeLabel", () => {
  it("(2) maps queue types to human labels", () => {
    expect(notificationTypeLabel("monthly_summary")).toBe("Monthly Summary");
    expect(notificationTypeLabel("client_confirmation")).toBe("Booking Confirmation");
    expect(notificationTypeLabel("creator_confirmation")).toBe("Booking Confirmation");
    expect(notificationTypeLabel("client_cancellation")).toBe("Booking Cancellation");
    expect(notificationTypeLabel("creator_cancellation")).toBe("Booking Cancellation");
    expect(notificationTypeLabel("creator_plan_limit")).toBe("Plan Limit Warning");
  });

  it("falls back to a readable title for unknown types", () => {
    expect(notificationTypeLabel("some_new_type")).toBe("Some New Type");
  });
});
