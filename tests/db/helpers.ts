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

/** Apply the whole schema. Safe to call repeatedly — every statement is idempotent. */
export async function applySchema(pool: Pool): Promise<void> {
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
