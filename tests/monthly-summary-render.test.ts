import { describe, expect, it } from "vitest";
import { renderMonthlySummaryMessage, type MonthlySummary } from "@/lib/monthly-summary";

const base: MonthlySummary = {
  creatorId: "c1",
  periodStart: "2026-06-01T00:00:00.000Z",
  periodMonth: "2026-06",
  periodLabel: "June",
  revenuePaise: 1850000,
  bookings: 12,
  repeatClients: 4,
  topService: "Career Consultation",
};

describe("renderMonthlySummaryMessage", () => {
  it("renders the short summary with rupee formatting", () => {
    const msg = renderMonthlySummaryMessage(base);
    expect(msg).toContain("June Summary");
    expect(msg).toContain("Revenue: ₹18,500");
    expect(msg).toContain("Bookings: 12");
    expect(msg).toContain("Repeat Clients: 4");
    expect(msg).toContain("Top Service:");
    expect(msg).toContain("Career Consultation");
  });

  it("omits the Top Service block when there is no top service", () => {
    const msg = renderMonthlySummaryMessage({ ...base, topService: null });
    expect(msg).not.toContain("Top Service:");
    expect(msg).toContain("Revenue: ₹18,500");
  });
});
