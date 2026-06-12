import { redirect } from "next/navigation";
import { destinationFor, PROFILE_ROUTE_COLUMNS, type ProfileRouteRow } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Entry point for onboarding: routes by the profiles row. No row yet →
 * claim a handle; mid-wizard → current step; published → dashboard.
 */
export default async function OnboardingIndex() {
  if (!isSupabaseConfigured) redirect("/onboarding/profile");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_ROUTE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<ProfileRouteRow>();

  redirect(destinationFor(profile));
}
