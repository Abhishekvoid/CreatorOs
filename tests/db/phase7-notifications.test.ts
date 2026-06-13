import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { initiate, processPendingEvents } from "@/lib/payments";
import {
  processNotifications,
  reapStuckNotifications,
  claimAndLease,
} from "@/lib/notifications/worker";
import type { NotificationProvider } from "@/lib/notifications/provider";
import { withTransaction } from "@/lib/db/pool";
import { applySchema, makePool, seedBooking, seedCreator, uniqueSlot } from "./helpers";

/**
 * Phase 7 — Notification Worker against real Postgres (no mocks).
 *
 * The worker drains notification_queue rows the Processor enqueued, hands each to
 * an injected provider double, and drives the pending → processing → sent /
 * failed(retry) / dead_letter state machine. It is downstream of truth: a
 * provider outage may delay delivery but must never touch bookings,
 * booking_locks, payment_orders, or payment_events.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
  delete process.env.PAYMENT_PROVIDER; // test mode → synthetic order, no network
});

afterAll(async () => {
  await pool.end();
});

afterEach(async () => {
  // Neutralise any non-terminal queue rows so the next test's global
  // processNotifications() only acts on its own freshly-seeded rows.
  await pool.query(
    `update public.notification_queue set status = 'sent'
      where status in ('pending', 'processing', 'failed')`,
  );
});

// ---- provider doubles ----------------------------------------------------
const okProvider: NotificationProvider = { send: async () => ({ ok: true }) };
function failProvider(error = "provider rejected"): NotificationProvider {
  return { send: async () => ({ ok: false, error }) };
}
const throwingProvider: NotificationProvider = {
  send: async () => {
    throw new Error("provider connection refused");
  },
};
/** Provider that records how many times send() was actually invoked. */
function countingProvider(): { provider: NotificationProvider; calls: () => number } {
  let calls = 0;
  return { provider: { send: async () => { calls++; return { ok: true }; } }, calls: () => calls };
}

// ---- seeding / inspection ------------------------------------------------
type QueuedRow = {
  status: string;
  attempt_count: number;
  last_error: string | null;
  next_attempt_at: string;
  sent_at: string | null;
  processing_expires_at: string | null;
};

async function seedQueued(opts: { type?: string } = {}): Promise<{
  id: string;
  bookingId: string;
  correlationId: string;
}> {
  const creator = await seedCreator(pool);
  const slot = uniqueSlot();
  const correlationId = randomUUID();
  const bookingId = await seedBooking(pool, {
    creatorId: creator,
    slotStart: slot.start,
    slotEnd: slot.end,
    correlationId,
  });
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.notification_queue
       (correlation_id, booking_id, type, channel, payload, status, attempt_count, next_attempt_at)
     values ($1, $2, $3, 'whatsapp', '{}'::jsonb, 'pending', 0, now())
     returning id`,
    [correlationId, bookingId, opts.type ?? "client_confirmation"],
  );
  return { id: rows[0].id, bookingId, correlationId };
}

async function getRow(id: string): Promise<QueuedRow> {
  const { rows } = await pool.query<QueuedRow>(
    `select status, attempt_count, last_error, next_attempt_at, sent_at, processing_expires_at
       from public.notification_queue where id = $1`,
    [id],
  );
  return rows[0];
}

async function makeDue(id: string): Promise<void> {
  await pool.query(
    `update public.notification_queue set next_attempt_at = now() - interval '1 second' where id = $1`,
    [id],
  );
}

async function count(table: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`select count(*)::text as n from public.${table}`);
  return Number(rows[0].n);
}

// =========================================================================

describe("notification worker — delivery state machine", () => {
  it("(1) success path: pending → sent", async () => {
    const n = await seedQueued();
    const summary = await processNotifications({ provider: okProvider });
    expect(summary).toMatchObject({ processed: 1, sent: 1, failed: 0, dead_letter: 0 });

    const row = await getRow(n.id);
    expect(row.status).toBe("sent");
    expect(row.sent_at).not.toBeNull();
    expect(row.processing_expires_at).toBeNull();
    expect(row.last_error).toBeNull();
  });

  it("(2) retry path: failed → pending with backoff, not reclaimed until due", async () => {
    const n = await seedQueued();
    const summary = await processNotifications({ provider: failProvider("smtp 500") });
    expect(summary).toMatchObject({ processed: 1, sent: 0, failed: 1, dead_letter: 0 });

    const row = await getRow(n.id);
    expect(row.status).toBe("pending");
    expect(row.attempt_count).toBe(1);
    expect(row.last_error).toBe("smtp 500");
    expect(row.processing_expires_at).toBeNull();
    // first backoff is +1 minute → next_attempt_at is well in the future
    expect(new Date(row.next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 30_000);

    // a follow-up cycle must NOT reclaim it (still backing off)
    const again = await processNotifications({ provider: okProvider });
    expect(again.processed).toBe(0);
    expect((await getRow(n.id)).status).toBe("pending");
  });

  it("a thrown provider error is treated as a delivery failure", async () => {
    const n = await seedQueued();
    const summary = await processNotifications({ provider: throwingProvider });
    expect(summary).toMatchObject({ processed: 1, failed: 1 });
    const row = await getRow(n.id);
    expect(row.status).toBe("pending");
    expect(row.attempt_count).toBe(1);
    expect(row.last_error).toContain("connection refused");
  });

  it("(3) dead-letter path: the 5th failed attempt exhausts the schedule", async () => {
    const n = await seedQueued();
    // backoff schedule has 4 delays [1,5,15,60]; the 5th failure dead-letters.
    for (let attempt = 1; attempt <= 5; attempt++) {
      await makeDue(n.id);
      const summary = await processNotifications({ provider: failProvider() });
      const row = await getRow(n.id);
      expect(row.attempt_count).toBe(attempt);
      if (attempt < 5) {
        expect(summary).toMatchObject({ processed: 1, failed: 1, dead_letter: 0 });
        expect(row.status).toBe("pending");
      } else {
        expect(summary).toMatchObject({ processed: 1, failed: 0, dead_letter: 1 });
        expect(row.status).toBe("dead_letter");
      }
    }
    // dead-lettered rows are no longer claimable
    await makeDue(n.id);
    expect((await processNotifications({ provider: okProvider })).processed).toBe(0);
  });
});

describe("notification worker — crash & concurrency", () => {
  it("(4) crash recovery: an expired processing row is reaped back to pending", async () => {
    const n = await seedQueued();
    const claimed = await withTransaction((c) => claimAndLease(c));
    expect(claimed?.id).toBe(n.id);
    expect((await getRow(n.id)).status).toBe("processing");

    // lease lapses, then the reaper recovers it
    await pool.query(
      `update public.notification_queue set processing_expires_at = now() - interval '1 second' where id = $1`,
      [n.id],
    );
    const { requeued } = await reapStuckNotifications();
    expect(requeued).toBeGreaterThanOrEqual(1);

    const row = await getRow(n.id);
    expect(row.status).toBe("pending");
    expect(row.attempt_count).toBe(0); // a crash consumes no retry
    expect(row.processing_expires_at).toBeNull();
  });

  it("explicit crash → reap → recover: worker A dies, worker B delivers exactly once", async () => {
    const n = await seedQueued();

    // Worker A claims + leases (commits), then "dies" before writing an outcome.
    const clientA = await pool.connect();
    let claimedId: string | undefined;
    try {
      await clientA.query("begin");
      const claimed = await claimAndLease(clientA);
      claimedId = claimed?.id;
      await clientA.query("commit");
    } finally {
      clientA.release();
    }
    expect(claimedId).toBe(n.id);
    expect((await getRow(n.id)).status).toBe("processing");

    // A never returns. Its lease expires; the reaper returns the row to pending.
    await pool.query(
      `update public.notification_queue set processing_expires_at = now() - interval '1 second' where id = $1`,
      [n.id],
    );
    const reap = await reapStuckNotifications();
    expect(reap.requeued).toBeGreaterThanOrEqual(1);
    expect((await getRow(n.id)).status).toBe("pending");

    // Worker B picks it up and delivers.
    const b = countingProvider();
    const summary = await processNotifications({ provider: b.provider });
    expect(summary).toMatchObject({ processed: 1, sent: 1 });
    expect(b.calls()).toBe(1); // delivered exactly once

    const row = await getRow(n.id);
    expect(row.status).toBe("sent");
    expect(row.attempt_count).toBe(0); // A's crash did not burn an attempt

    // exactly one SENT notification exists for this booking
    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from public.notification_queue where booking_id = $1 and status = 'sent'`,
      [n.bookingId],
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  it("(5) duplicate workers: FOR UPDATE SKIP LOCKED hands the row to exactly one", async () => {
    const n = await seedQueued();
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      await c1.query("begin");
      await c2.query("begin");
      const a = await claimAndLease(c1);
      const b = await claimAndLease(c2); // row locked by c1 → SKIP LOCKED yields nothing
      expect(a?.id).toBe(n.id);
      expect(b).toBeNull();
      await c1.query("commit");
      await c2.query("commit");
    } finally {
      c1.release();
      c2.release();
    }
    expect((await getRow(n.id)).status).toBe("processing");
  });
});

describe("notification worker — truth isolation & replay", () => {
  it("(6) truth isolation: a full reap+process cycle leaves the truth tables untouched", async () => {
    // Build real truth: a confirmed booking with enqueued notifications.
    const creator = await seedCreator(pool);
    const slot = uniqueSlot();
    const out = await initiate({
      creatorId: creator,
      slotStart: slot.start,
      slotEnd: slot.end,
      amountPaise: 149900,
    });
    await pool.query(
      `insert into public.payment_events
         (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
       values ($1, 'webhook', 'payment.captured', $2, $3, '{}'::jsonb)`,
      [out.correlationId, `evt_${randomUUID().slice(0, 12)}`, out.paymentOrderId],
    );
    await processPendingEvents(); // confirms booking + enqueues notifications

    const truth = async () => ({
      bookings: await count("bookings"),
      booking_locks: await count("booking_locks"),
      payment_orders: await count("payment_orders"),
      payment_events: await count("payment_events"),
      bookingStatus: (await pool.query<{ status: string }>(
        `select status from public.bookings where id = $1`,
        [out.bookingId],
      )).rows[0].status,
      lockStatus: (await pool.query<{ status: string }>(
        `select status from public.booking_locks where booking_id = $1`,
        [out.bookingId],
      )).rows[0].status,
      orderStatus: (await pool.query<{ status: string }>(
        `select status from public.payment_orders where id = $1`,
        [out.paymentOrderId],
      )).rows[0].status,
    });

    const before = await truth();

    // Exercise the worker hard: a reap, a failing delivery, and a successful one.
    await reapStuckNotifications();
    await processNotifications({ provider: failProvider() });
    await processNotifications({ provider: okProvider }); // backed-off rows simply aren't due

    expect(await truth()).toEqual(before);
  });

  it("(7) queue replay: retries never insert new rows — the worker only updates", async () => {
    const n = await seedQueued();
    const before = await count("notification_queue");

    await processNotifications({ provider: failProvider() }); // attempt 1 → pending
    await makeDue(n.id);
    await processNotifications({ provider: failProvider() }); // attempt 2 → pending
    await makeDue(n.id);
    await processNotifications({ provider: okProvider }); // → sent

    expect(await count("notification_queue")).toBe(before);
    const row = await getRow(n.id);
    expect(row.status).toBe("sent");
    expect(row.attempt_count).toBe(2);
  });
});
