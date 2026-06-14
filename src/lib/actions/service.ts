"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Persistence for the wizard's single booking service. The wizard edits
 * exactly one row (the oldest booking-type service for this creator);
 * additional services are a dashboard feature.
 */

export type ServiceDraft = {
  iconName: string;
  title: string;
  description: string;
  durationMinutes: number;
  pricePaise: number;
  compareAtPaise: number | null;
  meetingLink: string;
};

type ServiceRow = {
  id: string;
  icon_name: string | null;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  price_paise: number;
  compare_at_paise: number | null;
  meeting_link: string | null;
};

export async function getServiceDraft(): Promise<ServiceDraft | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("services")
    .select("id, icon_name, title, description, duration_minutes, price_paise, compare_at_paise, meeting_link")
    .eq("profile_id", user.id)
    .eq("type", "booking")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<ServiceRow>();
  if (!row) return null;

  return {
    iconName: row.icon_name ?? "Target",
    title: row.title ?? "",
    description: row.description ?? "",
    durationMinutes: row.duration_minutes ?? 60,
    pricePaise: row.price_paise ?? 0,
    compareAtPaise: row.compare_at_paise,
    meetingLink: row.meeting_link ?? "",
  };
}

export async function saveServiceDraft(
  draft: ServiceDraft,
  opts?: { complete?: boolean },
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: "Supabase isn't configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  // Drafts save loosely; Continue re-validates what the client checked.
  if (opts?.complete) {
    if (!draft.title.trim()) return { success: false, error: "Title is required" };
    if (!draft.description.trim()) return { success: false, error: "Description is required" };
    if (draft.pricePaise < 100) return { success: false, error: "Minimum price is ₹1" };
    if (draft.compareAtPaise != null && draft.compareAtPaise <= draft.pricePaise)
      return { success: false, error: "Compare-at price must be higher than the price" };
    if (!/^https?:\/\/.+\..+/.test(draft.meetingLink.trim()))
      return { success: false, error: "Meeting link must be a valid URL" };
  }

  const values = {
    icon_name: draft.iconName,
    title: draft.title,
    description: draft.description,
    duration_minutes: draft.durationMinutes,
    price_paise: Math.max(0, Math.round(draft.pricePaise)),
    compare_at_paise: draft.compareAtPaise,
    meeting_link: draft.meetingLink,
    type: "booking" as const,
    is_active: true,
  };

  // One stable wizard row: update the oldest booking service or create it.
  const { data: existing } = await supabase
    .from("services")
    .select("id")
    .eq("profile_id", user.id)
    .eq("type", "booking")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  const { error } = existing
    ? await supabase.from("services").update(values).eq("id", existing.id)
    : await supabase.from("services").insert({ ...values, profile_id: user.id, sort_order: 0 });
  if (error) return { success: false, error: error.message };

  if (opts?.complete) {
    const { data: row } = await supabase
      .from("profiles")
      .select("completed_steps")
      .eq("id", user.id)
      .maybeSingle<{ completed_steps: Record<string, boolean> | null }>();
    const { error: stepError } = await supabase
      .from("profiles")
      .update({ completed_steps: { ...(row?.completed_steps ?? {}), service: true } })
      .eq("id", user.id);
    if (stepError) return { success: false, error: stepError.message };
  }

  return { success: true };
}
