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
