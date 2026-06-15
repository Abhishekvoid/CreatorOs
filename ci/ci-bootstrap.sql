-- ============================================================
-- CI-ONLY Supabase primitive shim — NOT a production artifact.
--
-- The DB test suite (tests/db/*) assumes a Supabase database: supabase/schema.sql
-- references auth.users, auth.uid(), storage.{buckets,objects} and the
-- anon/authenticated/service_role roles, and tests/db/helpers.ts inserts into
-- auth.users. A bare Postgres service container has none of these.
--
-- This creates the minimal STRUCTURAL subset so the schema applies and the suite
-- runs. It does NOT emulate Supabase Auth/Storage behavior — tests run as the
-- postgres superuser and exercise the public-schema business logic (locks,
-- reconcile, processor), which is identical to production. RLS is bypassed in CI
-- exactly as it is under local `supabase start`, so fidelity for the logic under
-- test is unchanged.
--
-- applySchema() drops/recreates ONLY the `public` schema, so these auth/storage
-- objects and roles persist across the per-file resets.
-- ============================================================

-- 1) Roles the schema grants/revokes against.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- 2) auth schema + minimal users table (cols helpers.ts inserts) + auth.uid().
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text,
  role text,
  email text
);

-- Mirror Supabase's auth.uid(): the current request's JWT subject, NULL when
-- unset (the CI case — no test sets a JWT claim). Only needs to EXIST so the
-- RLS policy expressions in schema.sql can be created.
create or replace function auth.uid() returns uuid
  language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- 3) storage schema + minimal buckets/objects (cols used by schema.sql policies).
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);

-- Let the Supabase roles use these schemas (enough for the suite).
grant usage on schema auth, storage to anon, authenticated, service_role;
