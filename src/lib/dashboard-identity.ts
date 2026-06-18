import { redirect } from "next/navigation";
import type { ShellCreator } from "@/components/dashboard/Shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * The authenticated creator identity every dashboard page needs: the signed-in
 * user id (for owner-scoped data queries) and the ShellCreator the layout
 * renders. Centralised here so the dashboard, bookings list and booking detail
 * pages share one auth + redirect path instead of copying it.
 *
 * Returns null only when Supabase isn't configured (local dev) — callers then
 * render neutral empty states rather than mock data.
 */

export type DashboardIdentity = { userId: string; creator: ShellCreator };

type ProfileRow = {
  handle: string | null;
  is_published: boolean | null;
  display_name: string | null;
  avatar_url: string | null;
};

export async function getDashboardIdentity(): Promise<DashboardIdentity | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, is_published, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  if (!profile?.handle) redirect("/onboarding/handle");

  return {
    userId: user.id,
    creator: {
      name: profile.display_name?.trim() || profile.handle,
      email: user.email ?? "",
      avatarUrl: profile.avatar_url,
      handle: profile.handle,
      isPublished: Boolean(profile.is_published),
    },
  };
}
