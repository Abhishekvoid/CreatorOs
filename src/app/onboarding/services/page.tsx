import type { Metadata } from "next";
import PublishMoment from "@/components/onboarding/PublishMoment";

export const metadata: Metadata = {
  title: "Your page is live | CreatorOS",
  description: "Your CreatorOS page is published and ready to earn — share it to get your first booking.",
};

/**
 * Onboarding completion: the publish signature moment. (The services
 * builder slots in before this screen when it ships.)
 */
export default function OnboardingPublishPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden py-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 420px at 50% 0%, oklch(94.5% 0.028 165 / 0.6), transparent 60%), radial-gradient(640px 400px at 85% 50%, oklch(95.5% 0.025 45 / 0.7), transparent 60%)",
        }}
      />
      <PublishMoment />
    </main>
  );
}
