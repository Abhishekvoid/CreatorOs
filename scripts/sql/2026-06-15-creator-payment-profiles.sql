-- ============================================================
-- Apply: public.creator_payment_profiles (Phase 9)
--
-- Standalone, idempotent extract of supabase/schema.sql lines ~477–514. The
-- live project (sksavzlmlbuxfbchdjef) is missing this table, which breaks the
-- onboarding payment-setup step. Safe to run multiple times.
--
-- HOW TO APPLY (requires human approval — Level 2):
--   Supabase SQL editor → paste this file → Run
--   (or: psql "$SUPABASE_DB_URL" -f scripts/sql/2026-06-15-creator-payment-profiles.sql)
--
-- ROLLBACK (destructive — Level 3, only if intentionally reverting Phase 9):
--   drop table if exists public.creator_payment_profiles cascade;
-- ============================================================

create table if not exists public.creator_payment_profiles (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.profiles (id) on delete cascade,
  status text not null default 'not_started'
    check (status in (
      'not_started', 'pending_route', 'pending_verification', 'active', 'rejected'
    )),
  route_account_id text,
  kyc_status text,
  payouts_enabled boolean not null default false,
  notify_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_payment_profiles_status_idx
  on public.creator_payment_profiles (status);

drop trigger if exists creator_payment_profiles_set_updated_at on public.creator_payment_profiles;
create trigger creator_payment_profiles_set_updated_at
  before update on public.creator_payment_profiles
  for each row execute function public.set_updated_at();

-- RLS — owner-scoped and PRIVATE (no public select; payment status is the
-- creator's own business).
alter table public.creator_payment_profiles enable row level security;
drop policy if exists "Owners read own payment profile" on public.creator_payment_profiles;
create policy "Owners read own payment profile" on public.creator_payment_profiles
  for select using (auth.uid() = creator_id);
drop policy if exists "Owners insert own payment profile" on public.creator_payment_profiles;
create policy "Owners insert own payment profile" on public.creator_payment_profiles
  for insert with check (auth.uid() = creator_id);
drop policy if exists "Owners update own payment profile" on public.creator_payment_profiles;
create policy "Owners update own payment profile" on public.creator_payment_profiles
  for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- Verify (should return the table with rowsecurity = true):
-- select relname, relrowsecurity from pg_class
--   where relname = 'creator_payment_profiles';
