"use client";

import { useState } from "react";

export type Customer = { name: string; email: string; phone: string };

/**
 * Client details + the pay CTA. It collects the customer and hands them up; the
 * orchestrator does the initiate + checkout. `ready` gates on a chosen slot.
 */
export default function BookingForm({
  ready,
  processing,
  error,
  ctaLabel,
  onSubmit,
  initial,
}: {
  ready: boolean;
  processing: boolean;
  error: string | null;
  ctaLabel: string;
  onSubmit: (c: Customer) => void;
  /** Optional prefill (e.g. a creator rebooking a known client). Editable. */
  initial?: Partial<Customer>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");

  const filled = name.trim() && email.trim() && phone.trim();
  const canSubmit = ready && !processing && Boolean(filled);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      }}
      className="flex flex-col gap-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Full name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ananya Sharma" autoComplete="name" required />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Email address</span>
        <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" required />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">WhatsApp number</span>
        <input className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" required />
        <span className="mt-1.5 block text-[12px] font-semibold text-muted">Confirmation &amp; reminders arrive here.</span>
      </label>

      {error && <p className="text-[13px] font-semibold text-terra-deep">{error}</p>}

      <button type="submit" aria-disabled={!canSubmit} className={`btn btn-grad btn-lg w-full ${!canSubmit ? "cursor-not-allowed opacity-50 saturate-50" : ""}`}>
        {processing ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
            Opening secure checkout…
          </>
        ) : (
          ctaLabel
        )}
      </button>
      <p className="text-center text-[12px] font-semibold text-muted">
        {ready ? "You'll complete payment via Razorpay." : "Pick a date and time to continue."}
      </p>
    </form>
  );
}
