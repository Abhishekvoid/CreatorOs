"use server";

import { cancelPro, startProUpgrade } from "@/lib/billing/subscribe";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Thin "use server" wrappers over the billing subscription core, scoped to the
 * signed-in creator. The UI calls these; all idempotency / money-safety lives in
 * lib/billing/subscribe.ts. No generic failures — every path returns a typed,
 * actionable result.
 */

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function upgradeToProAction(): Promise<
  { success: true; checkoutUrl: string | null } | { success: false; error: string }
> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Please sign in to upgrade." };
  try {
    const result = await startProUpgrade(userId);
    return { success: true, checkoutUrl: result.checkoutUrl };
  } catch (err) {
    console.error("[billing] upgrade failed", err);
    return { success: false, error: "We couldn't start your upgrade. Please try again." };
  }
}

export async function cancelProAction(): Promise<{ success: boolean; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Please sign in." };
  try {
    await cancelPro(userId);
    return { success: true };
  } catch (err) {
    console.error("[billing] cancel failed", err);
    return { success: false, error: "We couldn't cancel right now. Please try again." };
  }
}
