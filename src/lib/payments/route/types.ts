/**
 * Razorpay Route ACCOUNT-ONBOARDING boundary — interfaces only.
 *
 * Distinct from lib/payments/providers/route.ts (the PaymentProvider that does
 * split settlement on orders). This layer is about getting a creator a Route
 * linked account in the first place: create it, check its KYC status, and hand
 * the creator an onboarding link.
 *
 * Route requires platform KYC/approval CreatorOS does not have yet, so this is
 * pure preparation — see service.ts, where every method throws
 * NotImplementedError. Nothing in the app calls these yet.
 */

/** What we send Razorpay to open a linked account for a creator. */
export type LinkedAccountInput = {
  creatorId: string;
  email: string;
  /** legal/display name for the account */
  name: string;
  /** E.164, optional at creation */
  phone?: string;
};

/** A Route linked account as Razorpay returns it. */
export type LinkedAccount = {
  routeAccountId: string;
  status: string;
};

/** The current KYC/activation state of a linked account. */
export type RouteAccountStatus = {
  routeAccountId: string;
  /** Razorpay activation status, surfaced as-is. */
  kycStatus: string;
  /** Whether Razorpay has enabled payouts/settlements for this account. */
  payoutsEnabled: boolean;
};

/** A hosted onboarding link the creator follows to complete KYC. */
export type OnboardingLink = {
  url: string;
  /** ISO timestamp after which the link is no longer valid. */
  expiresAt: string;
};

/**
 * The account-onboarding operations the future Route rollout will implement.
 * Today every method is unimplemented (see RouteOnboardingService).
 */
export interface RouteOnboarding {
  createLinkedAccount(input: LinkedAccountInput): Promise<LinkedAccount>;
  getAccountStatus(routeAccountId: string): Promise<RouteAccountStatus>;
  generateOnboardingLink(routeAccountId: string): Promise<OnboardingLink>;
}
