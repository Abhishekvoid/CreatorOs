import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  applySchema,
  insertLock,
  makePool,
  pgErrorCode,
  seedCreator,
  uniqueSlot,
} from "./helpers";

/**
 * Phase 1 — schema invariants for the payments/booking system.
 *
 * The headline guarantee (per spec): two active locks for the same
 * creator+slot must fail with 23505. We also pin the surrounding
 * invariants the rest of the system leans on: the partial-unique
 * predicate, the immutable ledger, and the append-only audit log.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("booking_locks — double-booking guard", () => {
  it("rejects a second ACTIVE lock for the same creator+slot with 23505", async () => {
    const creator = await seedCreator(pool);
    const slot = uniqueSlot();

    await insertLock(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end });

    let code: string | undefined;
    try {
      await insertLock(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end });
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23505");
  });

  it("treats pending_reconciliation and confirmed as live (also blocked, 23505)", async () => {
    for (const held of ["pending_reconciliation", "confirmed"] as const) {
      const creator = await seedCreator(pool);
      const slot = uniqueSlot();
      await insertLock(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end, status: held });

      let code: string | undefined;
      try {
        await insertLock(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end });
      } catch (err) {
        code = pgErrorCode(err);
      }
      expect(code, `a ${held} lock must occupy the slot`).toBe("23505");
    }
  });

  it("a RELEASED lock frees the slot for a new active lock", async () => {
    const creator = await seedCreator(pool);
    const slot = uniqueSlot();
    await insertLock(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end, status: "released" });

    // should NOT throw — released locks fall out of the partial unique predicate
    await expect(
      insertLock(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end }),
    ).resolves.toBeTypeOf("string");
  });

  it("different creators may hold the same slot time independently", async () => {
    const a = await seedCreator(pool);
    const b = await seedCreator(pool);
    const slot = uniqueSlot();
    await insertLock(pool, { creatorId: a, slotStart: slot.start, slotEnd: slot.end });
    await expect(
      insertLock(pool, { creatorId: b, slotStart: slot.start, slotEnd: slot.end }),
    ).resolves.toBeTypeOf("string");
  });
});

describe("payment_events — immutable append-only ledger", () => {
  async function insertEvent(source = "webhook", providerEventId = `evt_${crypto.randomUUID()}`) {
    const {
      rows: [{ id }],
    } = await pool.query<{ id: string }>(
      `insert into public.payment_events
         (correlation_id, event_source, event_type, provider_event_id)
       values (gen_random_uuid(), $1, 'payment.captured', $2)
       returning id`,
      [source, providerEventId],
    );
    return id;
  }

  it("allows updating only (processed, processed_at)", async () => {
    const id = await insertEvent();
    await expect(
      pool.query(`update public.payment_events set processed = true, processed_at = now() where id = $1`, [id]),
    ).resolves.toBeTruthy();
  });

  it("rejects mutating any other column", async () => {
    const id = await insertEvent();
    let code: string | undefined;
    let raised = false;
    try {
      await pool.query(`update public.payment_events set payload = '{"x":1}' where id = $1`, [id]);
    } catch (err) {
      raised = true;
      code = pgErrorCode(err);
    }
    expect(raised).toBe(true);
    expect(code).toBe("P0001"); // raise_exception
  });

  it("rejects deletes", async () => {
    const id = await insertEvent();
    await expect(pool.query(`delete from public.payment_events where id = $1`, [id])).rejects.toThrow();
  });

  it("collapses duplicate deliveries on (event_source, provider_event_id)", async () => {
    const dupId = `evt_dup_${crypto.randomUUID()}`;
    await insertEvent("webhook", dupId);
    let code: string | undefined;
    try {
      await insertEvent("webhook", dupId);
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23505");
  });
});

describe("recovery_actions — append-only, safe-actions-only", () => {
  async function insertAction(actionType: string) {
    return pool.query(
      `insert into public.recovery_actions
         (correlation_id, action_type, target_type, target_id)
       values (gen_random_uuid(), $1, 'payment_event', gen_random_uuid())`,
      [actionType],
    );
  }

  it("accepts the three permitted action types", async () => {
    for (const a of ["replay_event", "retry_reconciliation", "retry_notification"]) {
      await expect(insertAction(a)).resolves.toBeTruthy();
    }
  });

  it("forbids destructive action types via check constraint (23514)", async () => {
    for (const a of ["mark_paid", "mark_confirmed", "release_lock", "delete_event"]) {
      let code: string | undefined;
      try {
        await insertAction(a);
      } catch (err) {
        code = pgErrorCode(err);
      }
      expect(code, `${a} must be rejected`).toBe("23514");
    }
  });

  it("rejects updates and deletes (fully append-only)", async () => {
    const {
      rows: [{ id }],
    } = await pool.query<{ id: string }>(
      `insert into public.recovery_actions (correlation_id, action_type, target_type, target_id)
       values (gen_random_uuid(), 'replay_event', 'payment_event', gen_random_uuid()) returning id`,
    );
    await expect(pool.query(`update public.recovery_actions set reason = 'x' where id = $1`, [id])).rejects.toThrow();
    await expect(pool.query(`delete from public.recovery_actions where id = $1`, [id])).rejects.toThrow();
  });
});

describe("RLS — internal money tables are service-role only", () => {
  it("has RLS enabled on all six tables", async () => {
    const { rows } = await pool.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace
         and relname in ('bookings','booking_locks','payment_orders','payment_events','notification_queue','recovery_actions')`,
    );
    expect(rows).toHaveLength(6);
    for (const r of rows) expect(r.relrowsecurity, `${r.relname} must have RLS enabled`).toBe(true);
  });

  it("grants no privileges to anon/authenticated on those tables", async () => {
    const { rows } = await pool.query<{ count: string }>(
      `select count(*)::text as count
       from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee in ('anon','authenticated')
         and table_name in ('bookings','booking_locks','payment_orders','payment_events','notification_queue','recovery_actions')`,
    );
    expect(rows[0].count).toBe("0");
  });
});
