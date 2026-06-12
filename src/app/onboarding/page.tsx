import { redirect } from "next/navigation";

/**
 * Entry point for onboarding. The profile step rehydrates any saved draft
 * client-side, so resuming creators land exactly where they left off.
 * Once more steps exist, this can route by the stored onboarding_step.
 */
export default function OnboardingIndex() {
  redirect("/onboarding/profile");
}
