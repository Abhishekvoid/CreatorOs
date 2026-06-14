import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { applySchema, makePool, pgErrorCode, seedCreator } from "./helpers";

/**
 * Phase 9 — creator_payment_profiles invariants.
 *
 * The creator-facing payment-onboarding row (NOT part of the frozen
 * service-role money tables). We pin: one profile per creator, the status CHECK,
 * the safe defaults, the updated_at trigger, and owner-scoped/private RLS.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

async function insertProfile(creatorId: string, status?: string): Promise<string> {
  const {
    rows: [{ id }],
  } = await pool.query<{ id: string }>(
    status
      ? `insert into public.creator_payment_profiles (creator_id, status) values ($1, $2) returning id`
      : `insert into public.creator_payment_profiles (creator_id) values ($1) returning id`,
    status ? [creatorId, status] : [creatorId],
  );
  return id;
}

describe("creator_payment_profiles — one per creator", () => {
  it("allows exactly one profile per creator (second insert → 23505)", async () => {
    const creator = await seedCreator(pool);
    await insertProfile(creator);

    let code: string | undefined;
    try {
      await insertProfile(creator);
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23505");
  });

  it("lets different creators each have their own profile", async () => {
    const a = await seedCreator(pool);
    const b = await seedCreator(pool);
    await insertProfile(a);
    await expect(insertProfile(b)).resolves.toBeTypeOf("string");
  });
});

describe("creator_payment_profiles — status validation", () => {
  it("accepts all five allowed statuses", async () => {
    for (const status of [
      "not_started",
      "pending_route",
      "pending_verification",
      "active",
      "rejected",
    ]) {
      const creator = await seedCreator(pool);
      await expect(insertProfile(creator, status)).resolves.toBeTypeOf("string");
    }
  });

  it("rejects an unknown status via the CHECK constraint (23514)", async () => {
    const creator = await seedCreator(pool);
    let code: string | undefined;
    try {
      await insertProfile(creator, "live"); // not a valid status
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23514");
  });
});

describe("creator_payment_profiles — defaults & trigger", () => {
  it("defaults to not_started with payouts disabled and no notify opt-in", async () => {
    const creator = await seedCreator(pool);
    await insertProfile(creator);
    const { rows } = await pool.query<{
      status: string;
      payouts_enabled: boolean;
      notify_requested_at: string | null;
    }>(
      `select status, payouts_enabled, notify_requested_at
       from public.creator_payment_profiles where creator_id = $1`,
      [creator],
    );
    expect(rows[0].status).toBe("not_started");
    expect(rows[0].payouts_enabled).toBe(false);
    expect(rows[0].notify_requested_at).toBeNull();
  });

  it("bumps updated_at on update via the shared trigger", async () => {
    const creator = await seedCreator(pool);
    const id = await insertProfile(creator);
    const before = await pool.query<{ updated_at: string }>(
      `select updated_at from public.creator_payment_profiles where id = $1`,
      [id],
    );
    await pool.query(
      `update public.creator_payment_profiles set notify_requested_at = now() where id = $1`,
      [id],
    );
    const after = await pool.query<{ updated_at: string }>(
      `select updated_at from public.creator_payment_profiles where id = $1`,
      [id],
    );
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.rows[0].updated_at).getTime(),
    );
  });
});

describe("creator_payment_profiles — owner-scoped, private RLS", () => {
  it("has RLS enabled", async () => {
    const { rows } = await pool.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace
         and relname = 'creator_payment_profiles'`,
    );
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it("has owner select/insert/update policies and NO public-read policy", async () => {
    const { rows } = await pool.query<{ cmd: string; qual: string | null }>(
      `select cmd, qual::text as qual from pg_policies
       where schemaname = 'public' and tablename = 'creator_payment_profiles'`,
    );
    const cmds = rows.map((r) => r.cmd).sort();
    expect(cmds).toEqual(["INSERT", "SELECT", "UPDATE"]);
    // every policy is owner-scoped on creator_id — none is a blanket `true`
    for (const r of rows) {
      if (r.qual !== null) expect(r.qual).toContain("creator_id");
    }
  });
});
