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

/**
 * The wizard, in order. completed_steps on the profiles row is a jsonb map
 * of these keys to true; a creator resumes at the first key that isn't set.
 * (The legacy onboarding_step integer still exists in the DB but nothing
 * reads it anymore — it gets dropped in a follow-up migration.)
 */
export const ONBOARDING_STEPS = [
  { key: "handle", route: "/onboarding/handle" },
  { key: "profile", route: "/onboarding/profile" },
  { key: "services", route: "/onboarding/services" },
  { key: "availability", route: "/onboarding/availability" },
  { key: "payments", route: "/onboarding/payments" },
] as const;

export type CompletedSteps = Partial<Record<string, boolean>>;

export type ProfileRouteRow = {
  completed_steps: CompletedSteps | null;
  is_published: boolean | null;
};

/** Columns every redirect decision needs — keep selects in sync via this. */
export const PROFILE_ROUTE_COLUMNS = "completed_steps, is_published";

/** Where a signed-in creator belongs, given their profiles row (or lack of one). */
export function destinationFor(profile: ProfileRouteRow | null): string {
  if (!profile) return "/onboarding/handle";
  if (profile.is_published) return "/dashboard";
  const done = profile.completed_steps ?? {};
  for (const step of ONBOARDING_STEPS) {
    if (!done[step.key]) return step.route;
  }
  return "/onboarding/publish";
}

/** Fetches the profiles row and resolves the redirect in one call. */
export async function postAuthDestination(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_ROUTE_COLUMNS)
    .eq("id", userId)
    .maybeSingle<ProfileRouteRow>();
  return destinationFor(profile);
}
