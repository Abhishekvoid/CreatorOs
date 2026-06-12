import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared auth + onboarding routing logic. Isomorphic: the OAuth callback
 * route, the proxy and the client-side OTP flow all resolve a creator's
 * post-auth destination through the same function so the redirect rules
 * can never drift apart.
 */

/** Handles we own as routes or never want squatted. Mirrored in supabase/schema.sql. */
export const RESERVED_HANDLES = new Set([
  "admin", "api", "dashboard", "login", "signup", "pricing", "demo",
  "meera", "blog", "help", "app", "www", "mail", "support",
]);

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
export const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

/** Lowercase, strip everything outside a-z 0-9 _, cap the length. */
export function sanitizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, HANDLE_MAX);
}

/** Wizard step → route. Steps: 1 handle, 2 profile, 3 services. */
export function onboardingRoute(step: number | null | undefined): string {
  switch (step) {
    case 1:
      return "/onboarding/handle";
    case 2:
      return "/onboarding/profile";
    case 3:
      return "/onboarding/services";
    default:
      return "/dashboard";
  }
}

export type ProfileRouteRow = {
  onboarding_step: number | null;
  is_published: boolean | null;
};

/** Where a signed-in creator belongs, given their profiles row (or lack of one). */
export function destinationFor(profile: ProfileRouteRow | null): string {
  if (!profile) return "/onboarding/handle";
  if (profile.is_published) return "/dashboard";
  return onboardingRoute(profile.onboarding_step);
}

/** Fetches the profiles row and resolves the redirect in one call. */
export async function postAuthDestination(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_step, is_published")
    .eq("id", userId)
    .maybeSingle<ProfileRouteRow>();
  return destinationFor(profile);
}
