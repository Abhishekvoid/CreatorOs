"use server";

import { type CreatorDraft, emptyDraft, toE164 } from "@/lib/creator";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side persistence for the onboarding profile draft — the Supabase
 * replacement for the old localStorage profileStore. Owns exactly the
 * profile fields; handle, completed_steps (except the profile flag set on
 * Continue) and is_published have their own actions.
 */

type ProfileDraftRow = {
  handle: string | null;
  display_name: string | null;
  title: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  languages: string[] | null;
  experience_highlights: string[] | null;
  social_links: Record<string, string> | null;
  whatsapp_number: string | null;
};

const DRAFT_COLUMNS =
  "handle, display_name, title, bio, location, avatar_url, languages, experience_highlights, social_links, whatsapp_number";

/** E.164 back into the form's code/number split. Indian numbers are exact;
    other codes fall back to "last 10 digits are the number". */
function parseWhatsapp(stored: string | null): { code: string; number: string } {
  if (!stored) return { code: "91", number: "" };
  const indian = stored.match(/^\+91([6-9]\d{9})$/);
  if (indian) return { code: "91", number: indian[1] };
  const other = stored.match(/^\+(\d{1,3})(\d{10})$/);
  if (other) return { code: other[1], number: other[2] };
  return { code: "91", number: stored.replace(/^\+91/, "").replace(/\D/g, "") };
}

export async function getProfileDraft(): Promise<CreatorDraft> {
  const empty = emptyDraft();
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: row } = await supabase
    .from("profiles")
    .select(DRAFT_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<ProfileDraftRow>();
  if (!row) return empty;

  const { code, number } = parseWhatsapp(row.whatsapp_number);
  return {
    ...empty,
    handle: row.handle ?? "",
    name: row.display_name ?? "",
    title: row.title ?? "",
    bio: row.bio ?? "",
    avatar: row.avatar_url,
    highlights: row.experience_highlights ?? [],
    whatsappCode: code,
    whatsappNumber: number,
    languages: row.languages ?? [],
    location: row.location ?? "",
    socials: { ...empty.socials, ...(row.social_links ?? {}) },
  };
}

export async function saveProfileDraft(
  draft: CreatorDraft,
  opts?: { complete?: boolean },
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: "Supabase isn't configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  const update: Record<string, unknown> = {
    display_name: draft.name,
    title: draft.title,
    bio: draft.bio,
    location: draft.location,
    avatar_url: draft.avatar,
    languages: draft.languages,
    experience_highlights: draft.highlights,
    social_links: draft.socials,
    whatsapp_number: draft.whatsappNumber
      ? toE164(draft.whatsappCode, draft.whatsappNumber)
      : null,
  };

  // The profile step is complete only when Continue passes validation —
  // never on autosave. Read-merge-write is safe: the row belongs to one user.
  if (opts?.complete) {
    const { data: row } = await supabase
      .from("profiles")
      .select("completed_steps")
      .eq("id", user.id)
      .maybeSingle<{ completed_steps: Record<string, boolean> | null }>();
    update.completed_steps = { ...(row?.completed_steps ?? {}), profile: true };
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Publish the creator's page: flip is_published=true so creatoros.in/{handle}
 * goes live. Gated — a creator must have at least one active bookable service,
 * so a published page is always bookable.
 */
export async function publishProfile(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: "Supabase isn't configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("type", "booking")
    .eq("is_active", true);
  if (!count || count < 1) {
    return { success: false, error: "Add at least one bookable service before publishing." };
  }

  const { error } = await supabase.from("profiles").update({ is_published: true }).eq("id", user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Uploads the cropped avatar (400px JPEG data URL) to the public `avatars`
 * bucket and returns its URL. If storage isn't reachable (bucket missing,
 * offline dev) the data URL itself is returned and lives inline in
 * avatar_url — nothing is ever lost.
 */
export async function uploadAvatar(dataUrl: string): Promise<string> {
  if (!isSupabaseConfigured) return dataUrl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return dataUrl;

  const match = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) return dataUrl;
  const [, contentType, base64] = match;

  const path = `${user.id}.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, Buffer.from(base64, "base64"), { contentType, upsert: true });
  if (error) return dataUrl;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // cache-bust so a re-crop shows immediately despite the stable object name
  return `${data.publicUrl}?v=${Date.now()}`;
}
