"use server";

import type { DayWindow } from "@/lib/slots";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Weekly availability persistence. Saves replace every row for the creator
 * atomically via the replace_availability() Postgres function (a plpgsql
 * function body is a single transaction), so a failed save can never leave
 * a half-written week behind.
 */

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

/** null = never saved (the form should offer the Mon–Fri default). */
export async function getAvailability(): Promise<DayWindow[] | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows, error } = await supabase
    .from("availability")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("profile_id", user.id)
    .returns<AvailabilityRow[]>();

  // A read failure (or null/empty) returns null so the form falls back to the
  // first-time default *for display* without crashing. Crucially, the form
  // only persists those defaults on an explicit edit or Continue — never
  // automatically — so a transient read error can't overwrite a saved week.
  if (error) {
    console.error("getAvailability: read failed —", error.message);
    return null;
  }
  if (!rows || rows.length === 0) return null;

  return rows.map((r) => ({
    dayOfWeek: r.day_of_week,
    startTime: r.start_time.slice(0, 5), // time columns come back as "HH:MM:SS"
    endTime: r.end_time.slice(0, 5),
    isActive: r.is_active,
  }));
}

export async function saveAvailability(
  windows: DayWindow[],
  opts?: { complete?: boolean },
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: "Supabase isn't configured" };

  for (const w of windows) {
    if (w.isActive && w.startTime >= w.endTime)
      return { success: false, error: "Start time must be before end time" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  const { error } = await supabase.rpc("replace_availability", {
    slots: windows.map((w) => ({
      day_of_week: w.dayOfWeek,
      start_time: w.startTime,
      end_time: w.endTime,
      is_active: w.isActive,
    })),
  });
  if (error) return { success: false, error: error.message };

  if (opts?.complete) {
    const { data: row } = await supabase
      .from("profiles")
      .select("completed_steps")
      .eq("id", user.id)
      .maybeSingle<{ completed_steps: Record<string, boolean> | null }>();
    const { error: stepError } = await supabase
      .from("profiles")
      .update({ completed_steps: { ...(row?.completed_steps ?? {}), availability: true } })
      .eq("id", user.id);
    if (stepError) return { success: false, error: stepError.message };
  }

  return { success: true };
}
