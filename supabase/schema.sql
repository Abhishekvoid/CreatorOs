-- CreatorOS — profiles table + RLS
-- Run once in the Supabase SQL editor (or via supabase db push).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique
    check (handle ~ '^[a-z0-9_]{3,30}$')
    check (handle not in (
      'admin','api','dashboard','login','signup','pricing','demo',
      'meera','blog','help','app','www','mail','support'
    )),
  display_name text,
  headline text,
  bio text,
  avatar_url text,
  -- 1 = handle, 2 = profile, 3 = services; anything higher = onboarding done
  onboarding_step smallint not null default 2,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public pages (creatoros.in/{handle}) need anonymous reads; the handle
-- availability check relies on this too.
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Part 2 — full onboarding flow (run after Part 1)
-- Profile fields, services, availability, avatar storage and the
-- onboarding_step → completed_steps migration. Everything is
-- idempotent; safe to re-run.
-- ============================================================

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists title text,
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists avatar_url text,
  add column if not exists languages text[] default '{}',
  add column if not exists experience_highlights text[] default '{}',
  add column if not exists social_links jsonb default '{}',
  add column if not exists whatsapp_number text,
  add column if not exists gst_enabled boolean default false,
  add column if not exists gstin text,
  add column if not exists razorpay_key_id text,
  add column if not exists keys_verified_at timestamptz,
  add column if not exists handle_changed_at timestamptz,
  add column if not exists theme_color text default '#f97316',
  add column if not exists completed_steps jsonb default '{}';

-- Backfill completed_steps from the legacy step counter. Branch order
-- matters: >= 3 must be tested before >= 2 or it can never match.
-- onboarding_step stays in place until all redirect logic is confirmed
-- on completed_steps; it gets dropped in a follow-up migration.
update public.profiles
  set completed_steps = case
    when onboarding_step >= 3 then '{"handle": true, "profile": true}'::jsonb
    when onboarding_step >= 2 then '{"handle": true}'::jsonb
    else '{}'::jsonb
  end
  where completed_steps is null or completed_steps = '{}'::jsonb;

create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles (id) on delete cascade not null,
  type text not null default 'booking'
    check (type in ('booking', 'product', 'link')),
  title text not null,
  description text,
  price_paise integer not null default 0 check (price_paise >= 0),
  duration_minutes integer,
  meeting_link text,
  compare_at_paise integer,
  icon_name text default 'Target',
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists services_profile_id_idx on public.services (profile_id);

create table if not exists public.availability (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles (id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean default true,
  check (start_time < end_time)
);

create index if not exists availability_profile_id_idx on public.availability (profile_id);

-- RLS — same pattern as profiles: public read, owner-only writes.
alter table public.services enable row level security;
drop policy if exists "Services are public" on public.services;
create policy "Services are public" on public.services
  for select using (true);
drop policy if exists "Owners manage services" on public.services;
create policy "Owners manage services" on public.services
  for all using (auth.uid() = profile_id);

alter table public.availability enable row level security;
drop policy if exists "Availability is public" on public.availability;
create policy "Availability is public" on public.availability
  for select using (true);
drop policy if exists "Owners manage availability" on public.availability;
create policy "Owners manage availability" on public.availability
  for all using (auth.uid() = profile_id);

-- Avatar storage: public bucket, owners write only their own file
-- (object name is <auth.uid()>.jpg).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are public" on storage.objects;
create policy "Avatar images are public" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);
drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);

-- ============================================================
-- Part 3 — availability replace function
-- A plpgsql body runs as one transaction: the delete and insert
-- land together or not at all. SECURITY INVOKER, so the caller's
-- RLS policies on availability still apply.
-- ============================================================

create or replace function public.replace_availability(slots jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.availability where profile_id = auth.uid();
  insert into public.availability (profile_id, day_of_week, start_time, end_time, is_active)
  select
    auth.uid(),
    (s->>'day_of_week')::int,
    (s->>'start_time')::time,
    (s->>'end_time')::time,
    coalesce((s->>'is_active')::boolean, true)
  from jsonb_array_elements(slots) as s;
end;
$$;

-- ============================================================
-- Part 4 — Payments & Booking System (frozen architecture)
--
-- Internal money infrastructure. The Processor Worker is the ONLY
-- component permitted to mutate bookings.status / booking_locks.status /
-- payment_orders.status. Webhooks, cron jobs, admin tools, notification
-- workers, API routes and server actions must NOT; they emit events and
-- the processor applies them.
--
-- Every record in this part carries correlation_id — the single forensic
-- key from which a booking's entire lifecycle is reconstructable. No
-- payment-system record may exist without one (all are NOT NULL).
--
-- All six tables are service-role only: RLS enabled, zero policies, and
-- all privileges revoked from anon/authenticated. The service role (used
-- by server-side workers) bypasses RLS.
-- ============================================================

-- ---- bookings -------------------------------------------------------
-- DEFINED HERE (no prior bookings table existed). The booking a customer
-- creates. State machine (only the Processor mutates status):
--   payment_pending --capture--> confirmed
--   payment_pending --failure/expiry--> cancelled / expired
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  creator_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid references public.services (id) on delete set null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'payment_pending'
    check (status in ('payment_pending', 'confirmed', 'cancelled', 'expired')),
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',
  customer_name text,
  customer_email text,
  customer_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slot_end > slot_start)
);
create index if not exists bookings_correlation_idx on public.bookings (correlation_id);
create index if not exists bookings_creator_slot_idx on public.bookings (creator_id, slot_start);

-- ---- booking_locks --------------------------------------------------
-- Slot concurrency control. RULE 5: availability is computed from THIS
-- table ONLY, never from bookings. Timer expiry NEVER releases a slot —
-- it moves the lock to pending_reconciliation for the sweep to resolve.
-- Only a verified provider failure may release a lock.
create table if not exists public.booking_locks (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  booking_id uuid references public.bookings (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'pending_reconciliation', 'confirmed', 'released')),
  expires_at timestamptz not null,
  released_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- MANDATORY. At most one LIVE lock per creator+slot, where "live" means
-- active, awaiting reconciliation, or confirmed. Released locks fall out
-- of the predicate so the slot frees up. This partial unique index is the
-- hard, database-level guarantee against double-booking: a losing race
-- insert fails with SQLSTATE 23505.
create unique index if not exists booking_lock_active_slot_idx
  on public.booking_locks (creator_id, slot_start)
  where status in ('active', 'pending_reconciliation', 'confirmed');

create index if not exists booking_locks_correlation_idx on public.booking_locks (correlation_id);
create index if not exists booking_locks_pending_recon_idx
  on public.booking_locks (expires_at) where status = 'pending_reconciliation';
create index if not exists booking_locks_active_expiry_idx
  on public.booking_locks (expires_at) where status = 'active';

-- ---- payment_orders -------------------------------------------------
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  provider text not null,
  provider_order_id text unique,
  provider_payment_id text unique,
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in ('created', 'pending', 'captured', 'failed', 'expired', 'refunded')),
  creator_account_id text,
  captured_at timestamptz,
  failed_at timestamptz,
  -- the payment_events row that last drove this order's state (FK added
  -- below, once payment_events exists — the two tables reference each other)
  caused_by_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_orders_correlation_idx on public.payment_orders (correlation_id);
create index if not exists payment_orders_booking_idx on public.payment_orders (booking_id);
create index if not exists payment_orders_status_idx on public.payment_orders (status);

-- ---- payment_events -------------------------------------------------
-- IMMUTABLE append-only ledger. Only (processed, processed_at) may ever
-- change; no row may be deleted — both enforced by trigger below.
-- Duplicate provider deliveries collapse on the (event_source,
-- provider_event_id) unique constraint, so re-delivery is a no-op insert.
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  event_source text not null check (event_source in ('webhook', 'reconciliation', 'manual')),
  event_type text not null,
  provider_event_id text not null,
  payment_order_id uuid references public.payment_orders (id) on delete restrict,
  payload jsonb not null default '{}',
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_source, provider_event_id)
);
create index if not exists payment_events_correlation_idx on public.payment_events (correlation_id);
-- the processor claims oldest-first among unprocessed rows
create index if not exists payment_events_unprocessed_idx
  on public.payment_events (created_at) where processed = false;

-- close the circular reference now that payment_events exists
alter table public.payment_orders
  drop constraint if exists payment_orders_caused_by_event_fkey;
alter table public.payment_orders
  add constraint payment_orders_caused_by_event_fkey
  foreign key (caused_by_event_id) references public.payment_events (id) on delete set null;

-- ---- notification_queue ---------------------------------------------
create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  booking_id uuid references public.bookings (id) on delete cascade,
  type text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  payload jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
  attempt_count integer not null default 0,
  processing_expires_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_queue_correlation_idx on public.notification_queue (correlation_id);
-- claimable jobs for the notification worker (FOR UPDATE SKIP LOCKED)
create index if not exists notification_queue_claimable_idx
  on public.notification_queue (next_attempt_at) where status in ('pending', 'processing');
-- Notification identity: at most one row per (booking, type). The processor's
-- recipient is encoded in `type` (creator_/client_ × confirmation/cancellation),
-- so this makes a replayed event's enqueue a structural no-op
-- (insert ... on conflict (booking_id, type) do nothing).
create unique index if not exists notification_queue_identity_idx
  on public.notification_queue (booking_id, type);

-- ============================================================
-- Part 7 — Notification Worker support (additive, idempotent)
-- The Notification Worker (Phase 7) drains notification_queue rows the
-- Processor enqueued and drives a retry/dead-letter state machine. It is
-- downstream of truth and may modify ONLY notification_queue. These two
-- additions to the existing notification_queue support that worker:
--   * last_error  — the most recent provider failure, persisted on retry/DL.
--   * a reaper index — find stuck 'processing' rows past their lease quickly.
-- ============================================================
alter table public.notification_queue
  add column if not exists last_error text;

-- the reaper claims rows whose processing lease has lapsed
create index if not exists notification_queue_stuck_idx
  on public.notification_queue (processing_expires_at) where status = 'processing';

-- ---- recovery_actions -----------------------------------------------
-- Append-only audit log of operator recovery actions. The only permitted
-- action_types are the three safe ones; mark-paid / mark-confirmed /
-- release-lock / delete-event / edit-ledger are intentionally absent and
-- cannot be represented. Updates and deletes are blocked by trigger.
create table if not exists public.recovery_actions (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  actor_id uuid,  -- null = automated/system actor
  action_type text not null
    check (action_type in ('replay_event', 'retry_reconciliation', 'retry_notification')),
  target_type text not null,
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists recovery_actions_correlation_idx on public.recovery_actions (correlation_id);

-- ============================================================
-- Part 8 — Recovery audit fields (additive, idempotent)
-- The Phase 8 Recovery Service appends one recovery_actions row per operator
-- action. Section D names performed_by (the operator; legacy actor_id stays as
-- a nullable alias) and payload (action detail). The action_type CHECK above
-- already makes mark_paid / confirm_booking / release_lock / delete_event /
-- edit_event unrepresentable, and the append-only guard below blocks any
-- update/delete — so this audit log can never be rewritten.
-- ============================================================
alter table public.recovery_actions
  add column if not exists performed_by uuid,
  add column if not exists payload jsonb not null default '{}';

-- ---- updated_at triggers (reuse public.set_updated_at) --------------
drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists payment_orders_set_updated_at on public.payment_orders;
create trigger payment_orders_set_updated_at
  before update on public.payment_orders
  for each row execute function public.set_updated_at();

-- ---- immutability guards --------------------------------------------
-- payment_events: only (processed, processed_at) may change; never delete.
create or replace function public.payment_events_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'payment_events is append-only: deletes are forbidden';
  end if;
  if new.id is distinct from old.id
     or new.correlation_id is distinct from old.correlation_id
     or new.event_source is distinct from old.event_source
     or new.event_type is distinct from old.event_type
     or new.provider_event_id is distinct from old.provider_event_id
     or new.payment_order_id is distinct from old.payment_order_id
     or new.payload is distinct from old.payload
     or new.created_at is distinct from old.created_at then
    raise exception 'payment_events is immutable except (processed, processed_at)';
  end if;
  return new;
end;
$$;
drop trigger if exists payment_events_guard_update on public.payment_events;
create trigger payment_events_guard_update
  before update on public.payment_events
  for each row execute function public.payment_events_guard();
drop trigger if exists payment_events_guard_delete on public.payment_events;
create trigger payment_events_guard_delete
  before delete on public.payment_events
  for each row execute function public.payment_events_guard();

-- recovery_actions: fully append-only.
create or replace function public.recovery_actions_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'recovery_actions is append-only: % is forbidden', tg_op;
end;
$$;
drop trigger if exists recovery_actions_guard_update on public.recovery_actions;
create trigger recovery_actions_guard_update
  before update on public.recovery_actions
  for each row execute function public.recovery_actions_guard();
drop trigger if exists recovery_actions_guard_delete on public.recovery_actions;
create trigger recovery_actions_guard_delete
  before delete on public.recovery_actions
  for each row execute function public.recovery_actions_guard();

-- ---- strict RLS: service role only ----------------------------------
-- Enable RLS with zero policies (denies anon/authenticated) and revoke
-- all direct grants from them. Server-side workers use the service role,
-- which bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'bookings', 'booking_locks', 'payment_orders',
    'payment_events', 'notification_queue', 'recovery_actions'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('revoke all on public.%I from anon, authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
  end loop;
end;
$$;

-- ============================================================
-- Part 9 — Payment Setup & Route readiness (additive, idempotent)
--
-- The creator-facing payment ONBOARDING profile. This is NOT part of the
-- frozen money infrastructure above (those six tables are service-role only
-- and the Processor owns their state). This row is owned and read by the
-- creator themselves during onboarding to track Razorpay Route readiness.
--
-- Razorpay Route is not live yet: client payments work, but creators cannot
-- receive payouts. status starts (and today only ever is) 'not_started'; the
-- other four states exist so the UI/state machine needs no rewrite when Route
-- onboarding ships. payouts_enabled is the single source of truth for whether
-- a creator can actually receive money — false until Route goes live.
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
  -- backs the "Notify me when payouts launch" CTA; null = not opted in
  notify_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- creator_id is already unique (one profile per creator); this index serves
-- the status reporting query the future Route rollout will run.
create index if not exists creator_payment_profiles_status_idx
  on public.creator_payment_profiles (status);

drop trigger if exists creator_payment_profiles_set_updated_at on public.creator_payment_profiles;
create trigger creator_payment_profiles_set_updated_at
  before update on public.creator_payment_profiles
  for each row execute function public.set_updated_at();

-- RLS — owner-scoped and PRIVATE. Unlike services/availability (publicly
-- readable for the public profile page), payment status is the creator's own
-- business: no public select policy. Same ownership predicate otherwise.
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

-- ============================================================
-- Part 10 — Billing & Subscriptions (additive, idempotent)
--
-- CreatorOS's OWN subscription revenue (Free vs Pro). This is unrelated to the
-- frozen money infrastructure (Parts 4-8) and to Route payouts (Part 9): those
-- concern money flowing from a creator's CUSTOMERS to the creator. This concerns
-- the creator paying CreatorOS ₹499/mo for Pro.
--
-- It MIRRORS the frozen payments architecture on its own tables rather than
-- reusing it:
--   * billing_events is an append-only ledger (immutability trigger), exactly
--     like payment_events.
--   * subscriptions is the source of truth, written ONLY by the billing
--     processor (and the upgrade action's initial 'pending' insert), exactly as
--     payment_orders is owned by the payments orchestrator + processor.
--   * profiles.plan is a denormalized read cache the booking hot path reads
--     instead of joining subscriptions on every booking attempt; the processor
--     updates it in the SAME transaction as the subscriptions row, so it can
--     never drift from the source of truth.
-- The payments tables, payment_events and the existing ingest path are NOT
-- touched by anything in this part.
-- ============================================================

-- ---- profiles.plan --------------------------------------------------
-- Denormalized entitlement cache (hot path: enforcement reads this, never joins
-- subscriptions on a booking attempt). 'free' until the processor grants 'pro'.
alter table public.profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'pro'));

-- ---- subscriptions (SOURCE OF TRUTH) --------------------------------
-- One row per creator (creator_id UNIQUE — the database-level guard that, with
-- the upgrade action's pre-check, makes a double-click unable to create two
-- Razorpay subscriptions). Written only by the service role (billing processor +
-- upgrade server action via the pg pool); the creator reads their own row.
--
-- status lifecycle:
--   pending    — Razorpay subscription created, not yet activated (the upgrade
--                action's initial insert; analogous to payment_orders 'created')
--   trial      — RESERVED, unused today (no free trial); kept so adding trials
--                later needs no constraint change
--   active     — charged & current; plan='pro'
--   past_due   — a charge failed; plan stays 'pro' through dunning
--   cancelled  — cancel requested; KEEPS plan='pro' until current_period_end
--   expired    — period lapsed; plan flipped back to 'free'
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.profiles (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'pending'
    check (status in ('pending', 'trial', 'active', 'past_due', 'cancelled', 'expired')),
  razorpay_subscription_id text unique,
  razorpay_plan_id text,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- the reconciliation sweep finds subscriptions whose paid period has lapsed
create index if not exists subscriptions_period_end_idx
  on public.subscriptions (current_period_end)
  where status in ('active', 'past_due', 'cancelled');

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---- billing_events (APPEND-ONLY LEDGER) ----------------------------
-- Immutable, append-only — mirror of payment_events. Only (processed,
-- processed_at) may ever change; no row may be deleted. Duplicate provider
-- deliveries collapse on (event_source, provider_event_id), so re-delivery is a
-- no-op insert. The billing processor is the only consumer.
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles (id) on delete set null,
  event_source text not null check (event_source in ('webhook', 'reconciliation', 'manual')),
  event_type text not null,
  provider_event_id text not null,
  razorpay_subscription_id text,
  payload jsonb not null default '{}',
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_source, provider_event_id)
);
-- the processor claims oldest-first among unprocessed rows
create index if not exists billing_events_unprocessed_idx
  on public.billing_events (created_at) where processed = false;
create index if not exists billing_events_subscription_idx
  on public.billing_events (razorpay_subscription_id);

-- ---- immutability guard (mirror of payment_events_guard) ------------
-- only (processed, processed_at) may change; never delete.
create or replace function public.billing_events_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'billing_events is append-only: deletes are forbidden';
  end if;
  if new.id is distinct from old.id
     or new.creator_id is distinct from old.creator_id
     or new.event_source is distinct from old.event_source
     or new.event_type is distinct from old.event_type
     or new.provider_event_id is distinct from old.provider_event_id
     or new.razorpay_subscription_id is distinct from old.razorpay_subscription_id
     or new.payload is distinct from old.payload
     or new.created_at is distinct from old.created_at then
    raise exception 'billing_events is immutable except (processed, processed_at)';
  end if;
  return new;
end;
$$;
drop trigger if exists billing_events_guard_update on public.billing_events;
create trigger billing_events_guard_update
  before update on public.billing_events
  for each row execute function public.billing_events_guard();
drop trigger if exists billing_events_guard_delete on public.billing_events;
create trigger billing_events_guard_delete
  before delete on public.billing_events
  for each row execute function public.billing_events_guard();

-- ---- RLS ------------------------------------------------------------
-- subscriptions: owner-readable and PRIVATE (the creator reads their own plan on
-- /dashboard/billing). Writes are service-role only — the upgrade action and the
-- processor both write through the pg pool, never the authenticated client.
alter table public.subscriptions enable row level security;
drop policy if exists "Owners read own subscription" on public.subscriptions;
create policy "Owners read own subscription" on public.subscriptions
  for select using (auth.uid() = creator_id);
revoke insert, update, delete on public.subscriptions from anon, authenticated;
grant all on public.subscriptions to service_role;

-- billing_events: service-role only (RLS on, zero policies, grants revoked) —
-- exactly like the payment ledger.
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
grant all on public.billing_events to service_role;

-- ============================================================
-- Part 11 — Client CRM (additive, idempotent)
--
-- FR-40/FR-41: every CONFIRMED booking automatically builds the creator's
-- own customer database — no manual entry. The customer's identity already
-- lives on the bookings row (customer_name / customer_phone / customer_email,
-- all required at the booking API); this table is the per-creator aggregate.
--
-- `clients` is DOWNSTREAM OF TRUTH, written ONLY by the Processor (Part 4) in
-- the SAME transaction as the booking's payment_pending -> confirmed flip —
-- exactly as the processor owns notification_queue. It mutates nothing in the
-- frozen money infrastructure; the processor remains the sole source of truth.
--
-- Like the booking/payment tables, it is service-role only: the dashboard
-- reads it through the creator-scoped pg query layer (src/lib/clients.ts), the
-- same path /dashboard/bookings already uses. No public/authenticated access.
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  name text,
  -- the WhatsApp number the customer booked with (bookings.customer_phone).
  -- Identity key WITH creator_id: the same number under a different creator is
  -- a different client, and creator isolation is preserved.
  whatsapp text not null,
  email text,
  booking_count integer not null default 0 check (booking_count >= 0),
  -- accumulator across every confirmed booking; bigint because the running
  -- total can exceed a single booking's integer amount_paise range.
  lifetime_spend_paise bigint not null default 0 check (lifetime_spend_paise >= 0),
  first_booking_at timestamptz,
  last_booking_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one client per creator+number; also the upsert conflict target that makes
  -- a replayed confirmation a no-op increment rather than a duplicate row.
  unique (creator_id, whatsapp)
);
create index if not exists clients_creator_idx on public.clients (creator_id);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- Backfill: derive clients from bookings already confirmed before this table
-- existed. Idempotent — `on conflict do nothing` plus the fact that re-running
-- against an already-populated table changes nothing (the aggregate is
-- recomputed wholesale from the source bookings each run, then only inserted
-- where a client row is still absent). Only confirmed bookings with a non-null
-- phone count, mirroring the live upsert's guard.
insert into public.clients
  (creator_id, name, whatsapp, email, booking_count, lifetime_spend_paise, first_booking_at, last_booking_at)
select
  b.creator_id,
  (array_agg(b.customer_name order by b.created_at desc)
     filter (where b.customer_name is not null and b.customer_name <> ''))[1],
  b.customer_phone,
  (array_agg(b.customer_email order by b.created_at desc)
     filter (where b.customer_email is not null and b.customer_email <> ''))[1],
  count(*),
  coalesce(sum(b.amount_paise), 0),
  min(b.created_at),
  max(b.created_at)
from public.bookings b
where b.status = 'confirmed'
  and b.customer_phone is not null
group by b.creator_id, b.customer_phone
on conflict (creator_id, whatsapp) do nothing;

-- service-role only: RLS on, zero policies, grants revoked from anon/
-- authenticated. Same model as the bookings table.
alter table public.clients enable row level security;
revoke all on public.clients from anon, authenticated;
grant all on public.clients to service_role;
