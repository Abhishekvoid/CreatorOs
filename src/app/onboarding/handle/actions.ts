"use server";

import { redirect } from "next/navigation";
import { HANDLE_RE, RESERVED_HANDLES } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type HandleStatus = "available" | "taken" | "reserved" | "invalid" | "error";

/** Debounced availability check. Reserved names are blocked here even if the client check is bypassed. */
export async function checkHandle(handle: string): Promise<HandleStatus> {
  if (!HANDLE_RE.test(handle)) return "invalid";
  if (RESERVED_HANDLES.has(handle)) return "reserved";
  if (!isSupabaseConfigured) return "error";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("handle")
    .eq("handle", handle)
    .maybeSingle();

  if (error) return "error";
  return data ? "taken" : "available";
}

export type ClaimError = "taken" | "reserved" | "invalid" | "config" | "error";

/**
 * Claims the handle: INSERT the profiles row and advance to step 2.
 * The DB unique constraint is the real arbiter — if someone claimed the
 * handle between the availability check and the click, the insert fails
 * with 23505 and the UI shows "Just taken — try another".
 */
export async function claimHandle(handle: string): Promise<{ error: ClaimError } | undefined> {
  if (!HANDLE_RE.test(handle)) return { error: "invalid" };
  if (RESERVED_HANDLES.has(handle)) return { error: "reserved" };
  if (!isSupabaseConfigured) return { error: "config" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    handle,
    onboarding_step: 2,
    is_published: false,
  });

  if (error) {
    if (error.code === "23505") {
      // pkey collision means this creator already has a profile — move on.
      if (error.message.includes("profiles_pkey")) redirect("/onboarding/profile");
      return { error: "taken" };
    }
    return { error: "error" };
  }

  redirect("/onboarding/profile");
}
