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
