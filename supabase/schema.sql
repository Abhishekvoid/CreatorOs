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
