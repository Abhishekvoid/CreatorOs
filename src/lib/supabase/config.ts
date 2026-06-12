/**
 * Single source of truth for Supabase env. NEXT_PUBLIC_ vars are inlined at
 * build time, so this module is safe on both server and client. While the
 * keys are blank (pre-setup), `isSupabaseConfigured` lets every surface
 * degrade gracefully instead of crashing.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
