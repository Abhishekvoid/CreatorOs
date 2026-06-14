/**
 * The creator payment-onboarding profile — the creator-facing model that
 * tracks Razorpay Route readiness. This is deliberately separate from the
 * frozen money infrastructure (bookings / payment_orders / payment_events…):
 * those are service-role only and the Processor owns their state, whereas this
 * row is owned and read by the creator during onboarding.
 *
 * Pure types only — no I/O. The server actions in
 * lib/actions/payment-profile.ts read/write it; the onboarding UI renders it.
 */

/**
 * The five lifecycle states, in order. Only `not_started` is reachable today
 * (Route onboarding isn't live); the rest exist so the UI state machine is
 * complete now and needs no rewrite when Route ships.
 *   not_started          — no Route onboarding begun (the only live state)
 *   pending_route        — linked account created, awaiting creator details
 *   pending_verification — submitted to Razorpay, KYC under review
 *   active               — verified; payouts_enabled flips true
 *   rejected             — KYC failed; creator must redo onboarding
 */
export const PAYMENT_STATUSES = [
  "not_started",
  "pending_route",
  "pending_verification",
  "active",
  "rejected",
] as const;

export type PaymentProfileStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentProfile = {
  status: PaymentProfileStatus;
  /** Razorpay Route linked-account id, once one exists. */
  routeAccountId: string | null;
  /** Razorpay KYC stage label, surfaced as-is when present. */
  kycStatus: string | null;
  /** The single source of truth for "can this creator receive money". */
  payoutsEnabled: boolean;
  /** Set when the creator opts into the "notify me when payouts launch" list. */
  notifyRequestedAt: string | null;
};

/** The default for a creator who has never started payment onboarding. */
export function defaultPaymentProfile(): PaymentProfile {
  return {
    status: "not_started",
    routeAccountId: null,
    kycStatus: null,
    payoutsEnabled: false,
    notifyRequestedAt: null,
  };
}
