import { describe, expect, it } from "vitest";
import {
  buildRebookPath,
  buildWhatsAppUrl,
  clientWhatsAppMessage,
} from "@/lib/client-actions";

/**
 * Client actions (WhatsApp + Rebook) — pure URL/message builders.
 *
 * These are the only logic the two CTAs carry; the components just render their
 * output. Kept dependency-free so they unit-test under the node runtime with no
 * DOM. Owner-scoping is enforced upstream (the detail page 404s cross-creator);
 * that boundary is covered by the DB suite.
 */

describe("clientWhatsAppMessage", () => {
  it("fills the name and creator into the template", () => {
    const msg = clientWhatsAppMessage("Asha Rao", "Meera Kapoor");
    expect(msg).toContain("Hi Asha Rao,");
    expect(msg).toContain("Would you like to book another session?");
    expect(msg.trimEnd().endsWith("Meera Kapoor")).toBe(true);
  });

  it("falls back to a neutral greeting when the name is blank", () => {
    expect(clientWhatsAppMessage("", "Meera")).toContain("Hi there,");
    expect(clientWhatsAppMessage(null, "Meera")).toContain("Hi there,");
  });
});

describe("buildWhatsAppUrl", () => {
  it("(1) builds a wa.me URL with digits-only number and an encoded message", () => {
    const url = buildWhatsAppUrl("+91 98765 43210", "Hi Asha,\nbook again?");
    expect(url).toBe("https://wa.me/919876543210?text=Hi%20Asha%2C%0Abook%20again%3F");
  });

  it("strips +, spaces and dashes from the number", () => {
    expect(buildWhatsAppUrl("+91-98765-43210", "x")).toBe("https://wa.me/919876543210?text=x");
  });

  it("(2) returns null when the number has no digits", () => {
    expect(buildWhatsAppUrl("", "x")).toBeNull();
    expect(buildWhatsAppUrl("   ", "x")).toBeNull();
    expect(buildWhatsAppUrl("---", "x")).toBeNull();
    expect(buildWhatsAppUrl(null, "x")).toBeNull();
  });
});

describe("buildRebookPath", () => {
  it("(3) deep-links into the creator booking flow with the handle", () => {
    const path = buildRebookPath("meera", { name: "Asha", email: "a@x.com", phone: "+919812345678" });
    expect(path.startsWith("/meera/book?")).toBe(true);
  });

  it("(4) round-trips the prefill values through query params", () => {
    const path = buildRebookPath("meera", {
      name: "Asha Rao",
      email: "asha@example.com",
      phone: "+91 98765 43210",
    });
    const qs = new URLSearchParams(path.split("?")[1]);
    expect(qs.get("name")).toBe("Asha Rao");
    expect(qs.get("email")).toBe("asha@example.com");
    expect(qs.get("phone")).toBe("+91 98765 43210");
  });

  it("omits blank/missing fields rather than sending empty params", () => {
    const path = buildRebookPath("meera", { name: "Asha", email: null, phone: "" });
    const qs = new URLSearchParams(path.split("?")[1]);
    expect(qs.get("name")).toBe("Asha");
    expect(qs.has("email")).toBe(false);
    expect(qs.has("phone")).toBe(false);
  });
});
