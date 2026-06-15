import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

/**
 * Test harness for the payments/booking schema. Connects to the local
 * Supabase Postgres (default `supabase start` DSN) and applies the full,
 * idempotent supabase/schema.sql before the suite. Tests run as the
 * `postgres` superuser, which bypasses RLS — fine for invariant tests
 * (the partial unique index and DB triggers fire regardless of RLS).
 */

export const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function makePool(): Pool {
  return new Pool({ connectionString: DB_URL, max: 8 });
}

/**
 * Safety interlock. applySchema DROPs and recreates the public schema, which is
 * catastrophic if DB_URL ever points at a real deployment — and SUPABASE_DB_URL
 * is a production DSN in .env.local. Refuse to run the destructive reset unless
 * the target host is local (loopback) or the operator has explicitly opted in
 * via ALLOW_DESTRUCTIVE_TEST_DB=1. Never set that flag against production.
 */
const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);

function assertDestructiveResetAllowed(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }
  if (LOCAL_DB_HOSTS.has(host) || process.env.ALLOW_DESTRUCTIVE_TEST_DB === "1") return;
  throw new Error(
    `Refusing to DROP/recreate the public schema against non-local DB host "${host}". ` +
      `tests/db/* reset the database destructively. Point SUPABASE_DB_URL at a local Postgres ` +
      `(e.g. supabase start), or set ALLOW_DESTRUCTIVE_TEST_DB=1 to override — NEVER against production.`,
  );
}

/**
 * Apply the whole schema to a pristine `public`. We reset the schema first
 * because parts of schema.sql (the original profiles policies) use bare
 * `create policy` and aren't re-runnable from an already-applied state.
 * Local Postgres is test-only (the app talks to the remote project), so a
 * reset is safe and gives every run a clean, deterministic database.
 */
export async function applySchema(pool: Pool): Promise<void> {
  assertDestructiveResetAllowed(DB_URL);
  await pool.query(`
    drop schema if exists public cascade;
    create schema public;
    grant usage on schema public to anon, authenticated, service_role;
    grant all on schema public to postgres, service_role;
  `);
  const sql = readFileSync(resolve(process.cwd(), "supabase/schema.sql"), "utf8");
  await pool.query(sql);
}

let creatorSeq = 0;

/**
 * Seed a creator: an auth.users row (profiles.id FKs to it) plus a profiles
 * row with a valid, unique handle. Returns the creator id.
 */
export async function seedCreator(pool: Pool): Promise<string> {
  const n = ++creatorSeq;
  const handle = `tc_${Date.now().toString(36)}_${n}`.slice(0, 30).toLowerCase();
  const {
    rows: [{ id }],
  } = await pool.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
             'authenticated', 'authenticated', $1)
     returning id`,
    [`${handle}@test.local`],
  );
  await pool.query(`insert into public.profiles (id, handle) values ($1, $2)`, [id, handle]);
  return id;
}

export type LockInput = {
  creatorId: string;
  slotStart: string; // ISO
  slotEnd: string; // ISO
  status?: "active" | "pending_reconciliation" | "confirmed" | "released";
  correlationId?: string;
  expiresAt?: string;
};

/** Insert a booking_locks row. Throws the raw pg error (with `.code`) on conflict. */
export async function insertLock(db: Pool | PoolClient, lock: LockInput): Promise<string> {
  const {
    rows: [{ id }],
  } = await db.query<{ id: string }>(
    `insert into public.booking_locks
       (correlation_id, creator_id, slot_start, slot_end, status, expires_at)
     values (coalesce($1, gen_random_uuid()), $2, $3, $4, $5, coalesce($6, now() + interval '10 minutes'))
     returning id`,
    [
      lock.correlationId ?? null,
      lock.creatorId,
      lock.slotStart,
      lock.slotEnd,
      lock.status ?? "active",
      lock.expiresAt ?? null,
    ],
  );
  return id;
}

/** A unique slot far in the future so tests never collide on the partial unique index. */
export function uniqueSlot(offsetMinutes = 0): { start: string; end: string } {
  const base = new Date(Date.UTC(2100, 0, 1) + (creatorSeq * 1000 + offsetMinutes) * 60_000);
  const end = new Date(base.getTime() + 30 * 60_000);
  return { start: base.toISOString(), end: end.toISOString() };
}

/** Narrow an unknown thrown value to a pg error code. */
export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

/** Seed a bookings row; returns its id. */
export async function seedBooking(
  pool: Pool,
  input: {
    creatorId: string;
    slotStart: string;
    slotEnd: string;
    amountPaise?: number;
    correlationId?: string;
  },
): Promise<string> {
  const {
    rows: [{ id }],
  } = await pool.query<{ id: string }>(
    `insert into public.bookings
       (correlation_id, creator_id, slot_start, slot_end, amount_paise)
     values (coalesce($1, gen_random_uuid()), $2, $3, $4, $5)
     returning id`,
    [input.correlationId ?? null, input.creatorId, input.slotStart, input.slotEnd, input.amountPaise ?? 149900],
  );
  return id;
}

/** Seed one active weekly availability window (IST wall-clock) for a creator. */
export async function seedAvailabilityWindow(
  pool: Pool,
  creatorId: string,
  dayOfWeek: number,
  start: string,
  end: string,
): Promise<void> {
  await pool.query(
    `insert into public.availability (profile_id, day_of_week, start_time, end_time, is_active)
     values ($1, $2, $3, $4, true)`,
    [creatorId, dayOfWeek, start, end],
  );
}

/** Read a lock's current status by id. */
export async function lockStatus(pool: Pool, id: string): Promise<string | null> {
  const { rows } = await pool.query<{ status: string }>(
    `select status from public.booking_locks where id = $1`,
    [id],
  );
  return rows[0]?.status ?? null;
}

/** Backdate a lock's expires_at so an expiry sweep will pick it up. */
export async function expireLockNow(pool: Pool, id: string): Promise<void> {
  await pool.query(`update public.booking_locks set expires_at = now() - interval '1 minute' where id = $1`, [id]);
}

const IST_OFFSET_MIN = 330;

/** UTC ISO string for an IST wall-clock instant — mirrors the service's conversion. */
export function istToUtcISO(year: number, month1: number, day: number, hh: number, mm = 0): string {
  return new Date(Date.UTC(year, month1 - 1, day, hh, mm) - IST_OFFSET_MIN * 60_000).toISOString();
}

/** Weekday (0=Sun..6=Sat) of an IST civil date. */
export function istWeekday(year: number, month1: number, day: number): number {
  return new Date(Date.UTC(year, month1 - 1, day)).getUTCDay();
}
