import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HandleClaim from "@/components/onboarding/HandleClaim";
import { LogoMark } from "@/components/ui";
import { destinationFor, type ProfileRouteRow } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Claim your link | CreatorOS",
  description: "Choose your creatoros.in handle — the one link you'll share everywhere.",
};

/**
 * Wizard step 1: the claim. Deliberately bare — no wizard chrome, no back,
 * no skip. A creator who already has a profiles row can never re-claim;
 * they're forwarded to wherever they actually are.
 */
export default async function HandleClaimPage() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_step, is_published")
        .eq("id", user.id)
        .maybeSingle<ProfileRouteRow>();
      if (profile) {
        const destination = destinationFor(profile);
        if (destination !== "/onboarding/handle") redirect(destination);
      }
    }
  }

  return (
    <main data-register="product" className="grid min-h-screen place-items-center px-6 py-14">
      <div className="w-full max-w-[640px] text-center">
        <LogoMark className="mx-auto size-[34px] rounded-[11px]" />

        <h1 className="mt-8 text-[clamp(34px,6vw,48px)] font-black leading-[1.05] tracking-[-0.025em]">
          Claim <span className="font-serif italic font-normal text-grad">your link.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-[440px] text-[clamp(15px,1.6vw,16.5px)] font-medium text-muted">
          This is the URL you&rsquo;ll share everywhere. Choose carefully — you can change it
          once in 90 days.
        </p>

        <div className="mt-10">
          <HandleClaim />
        </div>
      </div>
    </main>
  );
}
