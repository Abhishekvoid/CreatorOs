import type { PaymentProfile, PaymentProfileStatus } from "@/lib/payments/profile";

/**
 * The Payment Setup state machine — the single, PURE source of truth for how
 * each of the five payment statuses renders. Kept JSX-free so it is trivially
 * unit-tested and so all five states (only `not_started` is reachable today)
 * are fully defined now, no rewrite when Route onboarding ships.
 */

/** Drives the badge colour family in PaymentStatusBadge. */
export type BadgeTone = "neutral" | "pending" | "success" | "danger";

/** The three macro stages of the payout timeline. */
export const TIMELINE_STAGES = ["onboarding", "verification", "live"] as const;
export type TimelineStage = (typeof TIMELINE_STAGES)[number];

export type PaymentStatusView = {
  /** Short label inside the status pill, e.g. "Not Connected". */
  badgeLabel: string;
  badgeTone: BadgeTone;
  /** One-line headline describing where the creator stands. */
  headline: string;
  /** Supporting sentence under the headline. */
  sub: string;
  /** Which timeline stage is currently active/reached. */
  timelineStage: TimelineStage;
  /**
   * Whether to show the "payouts not active yet" warning by the publish CTA.
   * True whenever the creator cannot yet receive money.
   */
  showPublishWarning: boolean;
};

const VIEWS: Record<PaymentProfileStatus, PaymentStatusView> = {
  not_started: {
    badgeLabel: "Not Connected",
    badgeTone: "neutral",
    headline: "Creator payouts are currently being prepared.",
    sub: "Your booking page works today. Direct payouts arrive with Razorpay Route soon.",
    timelineStage: "onboarding",
    showPublishWarning: true,
  },
  pending_route: {
    badgeLabel: "Setting up",
    badgeTone: "pending",
    headline: "Your payout account is being created.",
    sub: "Add your account details to continue Razorpay Route onboarding.",
    timelineStage: "onboarding",
    showPublishWarning: true,
  },
  pending_verification: {
    badgeLabel: "Under review",
    badgeTone: "pending",
    headline: "Your details are being verified.",
    sub: "Razorpay is reviewing your KYC. Payouts switch on once you're verified.",
    timelineStage: "verification",
    showPublishWarning: true,
  },
  active: {
    badgeLabel: "Payouts active",
    badgeTone: "success",
    headline: "You're set up to receive payouts.",
    sub: "Booking payments now settle directly to your account.",
    timelineStage: "live",
    showPublishWarning: false,
  },
  rejected: {
    badgeLabel: "Action needed",
    badgeTone: "danger",
    headline: "We couldn't verify your payout account.",
    sub: "Your details didn't pass verification. Restart onboarding to try again.",
    timelineStage: "onboarding",
    showPublishWarning: true,
  },
};

/**
 * Resolve the view for a payment profile. `payouts_enabled` overrides the
 * status for the warning specifically: money truth wins, so a verified account
 * never shows the "payouts not active" warning even if status lagged behind.
 */
export function paymentStatusView(profile: PaymentProfile): PaymentStatusView {
  const view = VIEWS[profile.status];
  return profile.payoutsEnabled ? { ...view, showPublishWarning: false } : view;
}
