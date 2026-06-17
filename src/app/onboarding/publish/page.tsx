import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PublishMoment from "@/components/onboarding/PublishMoment";
import { publishProfile } from "@/lib/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Your page is live | CreatorOS",
  description: "Your CreatorOS page is published and ready to earn — share it to get your first booking.",
};

/**
 * Onboarding completion: publish the page (is_published=true), then the publish
 * signature moment. Publishing is gated (handle + bookable service + an
 * availability window); if the creator is missing one, we send them back to the
 * exact step that fixes it rather than failing generically.
 */
export default async function OnboardingPublishPage() {
  let handle: string | undefined;
  if (isSupabaseConfigured) {
    const result = await publishProfile();
    if (!result.success) redirect(result.redirectTo ?? "/onboarding/service");
    handle = result.handle;
  }
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden py-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 420px at 50% 0%, oklch(94.5% 0.028 165 / 0.6), transparent 60%), radial-gradient(640px 400px at 85% 50%, oklch(95.5% 0.025 45 / 0.7), transparent 60%)",
        }}
      />
      <PublishMoment handle={handle} />
    </main>
  );
}
