import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { POST } from "@/app/api/bookings/initiate/route";
import {
  canAcceptBooking,
  canCreateService,
  confirmedBookingsThisMonth,
  enqueueCreatorLimitNudges,
  FREE_BOOKINGS_PER_MONTH,
} from "@/lib/billing/enforcement";
import { applySchema, makePool, seedCreator } from "../db/helpers";

/**
 * Plan enforcement gate (Decision C count semantics + Decision B client block).
 * Real Postgres, no mocks. The high-stakes properties: only CONFIRMED bookings
 * in the IST calendar month count; the client block never leaks plan/limit; the
 * creator nudge is idempotent.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
  delete process.env.PAYMENT_PROVIDER;
});

afterAll(async () => {
  await pool.end();
});

/** Insert a booking with an explicit status and an optional SQL created_at expression. */
async function insertBooking(
  creatorId: string,
  opts: { status?: string; createdAtSql?: string } = {},
): Promise<string> {
  const createdAt = opts.createdAtSql ?? "now()";
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.bookings
       (correlation_id, creator_id, slot_start, slot_end, amount_paise, status, created_at)
     values (gen_random_uuid(), $1, now(), now() + interval '30 minutes', 149900, $2, ${createdAt})
     returning id`,
    [creatorId, opts.status ?? "confirmed"],
  );
  return rows[0].id;
}

async function setPlan(creatorId: string, plan: "free" | "pro"): Promise<void> {
  await pool.query(`update public.profiles set plan = $2 where id = $1`, [creatorId, plan]);
}

const IST_MONTH_START = `((date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata')`;

describe("Decision C — confirmed-this-month count", () => {
  it("counts only confirmed bookings in the current IST month", async () => {
    const creator = await seedCreator(pool);
    await insertBooking(creator, { status: "confirmed" });
    await insertBooking(creator, { status: "confirmed" });
    await insertBooking(creator, { status: "confirmed" });
    // not money made → must NOT count
    await insertBooking(creator, { status: "payment_pending" });
    await insertBooking(creator, { status: "cancelled" });
    await insertBooking(creator, { status: "expired" });
    expect(await confirmedBookingsThisMonth(creator, pool)).toBe(3);
  });

  it("excludes confirmed bookings from a previous month", async () => {
    const creator = await seedCreator(pool);
    await insertBooking(creator, { status: "confirmed" }); // this month
    await insertBooking(creator, { status: "confirmed", createdAtSql: "now() - interval '40 days'" });
    expect(await confirmedBookingsThisMonth(creator, pool)).toBe(1);
  });

  it("buckets by the IST civil month boundary, not UTC", async () => {
    const creator = await seedCreator(pool);
    // exactly at the IST month start → in-month (>= start)
    await insertBooking(creator, { status: "confirmed", createdAtSql: IST_MONTH_START });
    // one second before the IST month start → previous month
    await insertBooking(creator, { status: "confirmed", createdAtSql: `${IST_MONTH_START} - interval '1 second'` });
    expect(await confirmedBookingsThisMonth(creator, pool)).toBe(1);
  });
});

describe("Decision B / gate — canAcceptBooking", () => {
  it("free creator: allowed under the limit, blocked at it", async () => {
    const creator = await seedCreator(pool);
    for (let i = 0; i < FREE_BOOKINGS_PER_MONTH - 1; i++) await insertBooking(creator, { status: "confirmed" });
    expect(await canAcceptBooking(creator, pool)).toBe(true); // 4 confirmed
    await insertBooking(creator, { status: "confirmed" }); // 5th
    expect(await canAcceptBooking(creator, pool)).toBe(false);
  });

  it("pro creator: unrestricted past the free limit", async () => {
    const creator = await seedCreator(pool);
    await setPlan(creator, "pro");
    for (let i = 0; i < FREE_BOOKINGS_PER_MONTH + 5; i++) await insertBooking(creator, { status: "confirmed" });
    expect(await canAcceptBooking(creator, pool)).toBe(true);
  });
});

describe("Decision B — client-facing block is neutral (no plan/limit leak)", () => {
  it("returns 403 with WhatsApp fallback and zero plan vocabulary", async () => {
    const creator = await seedCreator(pool);
    await pool.query(`update public.profiles set is_published = true, whatsapp_number = '+919812345678' where id = $1`, [creator]);
    const { rows } = await pool.query<{ handle: string }>(`select handle from public.profiles where id = $1`, [creator]);
    for (let i = 0; i < FREE_BOOKINGS_PER_MONTH; i++) await insertBooking(creator, { status: "confirmed" });

    const res = await POST(
      new Request("http://localhost/api/bookings/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creatorHandle: rows[0].handle,
          serviceId: randomUUID(), // gate blocks before service resolution
          slotStart: new Date(Date.now() + 86_400_000).toISOString(),
          customerName: "A",
          customerEmail: "a@b.com",
          customerPhone: "+910000000000",
        }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("bookings_unavailable");
    expect(body.whatsappNumber).toBe("+919812345678");
    // the visitor must never see WHY — no plan vocabulary anywhere in the response
    expect(JSON.stringify(body)).not.toMatch(/limit|plan|pro\b|free|tier|upgrade|subscription/i);
  });
});

describe("gate — canCreateService (max 1 on free)", () => {
  it("free: allowed at 0 services, blocked at 1", async () => {
    const creator = await seedCreator(pool);
    expect(await canCreateService(creator, pool)).toBe(true);
    await pool.query(
      `insert into public.services (profile_id, title, price_paise, is_active) values ($1, 'S', 50000, true)`,
      [creator],
    );
    expect(await canCreateService(creator, pool)).toBe(false);
  });

  it("pro: unrestricted", async () => {
    const creator = await seedCreator(pool);
    await setPlan(creator, "pro");
    for (let i = 0; i < 3; i++)
      await pool.query(
        `insert into public.services (profile_id, title, price_paise, is_active) values ($1, $2, 50000, true)`,
        [creator, `S${i}`],
      );
    expect(await canCreateService(creator, pool)).toBe(true);
  });
});

describe("creator limit nudge — idempotent enqueue", () => {
  async function nudgeCountFor(creatorId: string): Promise<number> {
    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from public.notification_queue nq
         join public.bookings b on b.id = nq.booking_id
        where b.creator_id = $1 and nq.type = 'creator_plan_limit'`,
      [creatorId],
    );
    return Number(rows[0].n);
  }

  it("enqueues exactly one nudge for a free creator at the limit, and never again", async () => {
    const creator = await seedCreator(pool);
    for (let i = 0; i < FREE_BOOKINGS_PER_MONTH; i++) await insertBooking(creator, { status: "confirmed" });

    // The sweep is global (nudges every qualifying creator), so assert per-creator
    // rather than on the run-wide count, which other tests' creators also affect.
    await enqueueCreatorLimitNudges(pool);
    expect(await nudgeCountFor(creator)).toBe(1);

    // a second sweep adds nothing new anywhere — idempotent via unique(booking_id, type)
    expect((await enqueueCreatorLimitNudges(pool)).enqueued).toBe(0);
    expect(await nudgeCountFor(creator)).toBe(1);

    const { rows } = await pool.query<{ payload: { recipient: string } }>(
      `select nq.payload from public.notification_queue nq
         join public.bookings b on b.id = nq.booking_id
        where b.creator_id = $1 and nq.type = 'creator_plan_limit'`,
      [creator],
    );
    expect(rows[0].payload.recipient).toBe("creator");
  });

  it("does not nudge an under-limit free creator, nor a pro creator over the limit", async () => {
    const under = await seedCreator(pool);
    for (let i = 0; i < FREE_BOOKINGS_PER_MONTH - 1; i++) await insertBooking(under, { status: "confirmed" });
    const pro = await seedCreator(pool);
    await setPlan(pro, "pro");
    for (let i = 0; i < FREE_BOOKINGS_PER_MONTH + 2; i++) await insertBooking(pro, { status: "confirmed" });

    await enqueueCreatorLimitNudges(pool);
    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from public.notification_queue nq
         join public.bookings b on b.id = nq.booking_id
        where b.creator_id = any($1) and nq.type = 'creator_plan_limit'`,
      [[under, pro]],
    );
    expect(Number(rows[0].n)).toBe(0);
  });
});
