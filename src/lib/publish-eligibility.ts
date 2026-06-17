/**
 * The publish gate, as a pure function so the rules are testable without a
 * database. A creator may go live only when their page is genuinely bookable:
 *
 *   1. a claimed handle (creatoros.in/{handle} must resolve),
 *   2. at least one active booking service (something to buy),
 *   3. at least one active availability window (a slot to book).
 *
 * Rules are checked in wizard order, so the FIRST failure decides the message
 * and the step to send the creator back to — they fix one thing, retry, and
 * fall through to the next gap if any. publishProfile() supplies the counts.
 */

export type PublishEligibilityInput = {
  hasHandle: boolean;
  serviceCount: number;
  availabilityCount: number;
};

export type PublishBlocker = "handle" | "service" | "availability";

export type PublishEligibility =
  | { ok: true }
  | { ok: false; blocker: PublishBlocker; error: string; redirectTo: string };

const RULES: {
  blocker: PublishBlocker;
  satisfied: (i: PublishEligibilityInput) => boolean;
  error: string;
  redirectTo: string;
}[] = [
  {
    blocker: "handle",
    satisfied: (i) => i.hasHandle,
    error: "Claim your handle before publishing.",
    redirectTo: "/onboarding/handle",
  },
  {
    blocker: "service",
    satisfied: (i) => i.serviceCount >= 1,
    error: "Add at least one bookable service before publishing.",
    redirectTo: "/onboarding/service",
  },
  {
    blocker: "availability",
    satisfied: (i) => i.availabilityCount >= 1,
    error: "Add at least one available time before publishing — a live page with no slots can't take bookings.",
    redirectTo: "/onboarding/availability",
  },
];

export function evaluatePublishEligibility(input: PublishEligibilityInput): PublishEligibility {
  for (const rule of RULES) {
    if (!rule.satisfied(input)) {
      return { ok: false, blocker: rule.blocker, error: rule.error, redirectTo: rule.redirectTo };
    }
  }
  return { ok: true };
}
