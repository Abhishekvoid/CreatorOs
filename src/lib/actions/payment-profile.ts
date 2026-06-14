"use server";

import {
  defaultPaymentProfile,
  type PaymentProfile,
  type PaymentProfileStatus,
} from "@/lib/payments/profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side access to the creator's payment-onboarding profile
 * (creator_payment_profiles). Mirrors lib/actions/profile.ts: reads never
 * write, and a creator who has never started onboarding gets a synthetic
 * `not_started` default rather than a forced insert.
 */

type PaymentProfileRow = {
  status: PaymentProfileStatus;
  route_account_id: string | null;
  kyc_status: string | null;
  payouts_enabled: boolean;
  notify_requested_at: string | null;
};

const PROFILE_COLUMNS =
  "status, route_account_id, kyc_status, payouts_enabled, notify_requested_at";

function fromRow(row: PaymentProfileRow): PaymentProfile {
  return {
    status: row.status,
    routeAccountId: row.route_account_id,
    kycStatus: row.kyc_status,
    payoutsEnabled: row.payouts_enabled,
    notifyRequestedAt: row.notify_requested_at,
  };
}

/**
 * The creator's payment profile, or the `not_started` default when none exists
 * yet (or Supabase isn't configured / the user isn't signed in). Never writes.
 */
export async function getPaymentProfile(): Promise<PaymentProfile> {
  if (!isSupabaseConfigured) return defaultPaymentProfile();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return defaultPaymentProfile();

  const { data: row } = await supabase
    .from("creator_payment_profiles")
    .select(PROFILE_COLUMNS)
    .eq("creator_id", user.id)
    .maybeSingle<PaymentProfileRow>();

  return row ? fromRow(row) : defaultPaymentProfile();
}

/**
 * Record that the creator wants to be notified when creator payouts launch.
 * Upserts on creator_id (the unique key), stamping notify_requested_at; the
 * status stays `not_started` — this is interest, not onboarding.
 */
export async function requestPayoutNotification(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured) return { success: false, error: "Supabase isn't configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  const { error } = await supabase
    .from("creator_payment_profiles")
    .upsert(
      { creator_id: user.id, notify_requested_at: new Date().toISOString() },
      { onConflict: "creator_id" },
    );
  if (error) return { success: false, error: error.message };
  return { success: true };
}
