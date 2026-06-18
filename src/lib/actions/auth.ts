"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign the creator out and return them to the login page. Used by the
 * dashboard Shell's account menu. Safe to call when Supabase isn't configured
 * (local dev) — it just redirects.
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
