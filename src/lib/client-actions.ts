/**
 * Client actions — pure builders for the two creator-controlled CRM CTAs on the
 * client detail page: "Message on WhatsApp" and "Book Another Session".
 *
 * Dependency-free on purpose: no DOM, no network, no DB. The components only
 * render what these return. Owner-scoping lives upstream (the detail page 404s
 * on a cross-creator client id), so nothing here ever sees another creator's
 * data — it only formats values already authorized for display.
 */

/** The prefilled WhatsApp message; {{name}} / {{creator_name}} filled in. */
export function clientWhatsAppMessage(clientName: string | null | undefined, creatorName: string): string {
  const name = clientName?.trim() || "there";
  return `Hi ${name},

Hope you're doing well.

Would you like to book another session?

---

${creatorName}`;
}

/**
 * A wa.me deep link that opens WhatsApp (desktop or mobile) with the message
 * prefilled. The number is reduced to digits only (wa.me wants no +, spaces or
 * dashes). Returns null when the number carries no digits, so the caller can
 * disable the CTA instead of producing a broken link.
 */
export function buildWhatsAppUrl(
  number: string | null | undefined,
  message: string,
): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export type RebookPrefill = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * A deep link into the creator's public booking flow with the customer's known
 * details prefilled as query params. Blank/missing fields are omitted entirely
 * (no empty params). The public book page treats these purely as prefill — it
 * never looks anything up — so the link exposes nothing beyond the values the
 * owning creator already put into it.
 */
export function buildRebookPath(handle: string, prefill: RebookPrefill): string {
  const qs = new URLSearchParams();
  for (const key of ["name", "email", "phone"] as const) {
    const value = prefill[key]?.trim();
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/${handle}/book?${query}` : `/${handle}/book`;
}
