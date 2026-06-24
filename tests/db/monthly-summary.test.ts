import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { initiate } from "@/lib/payments";
import { processPendingEvents } from "@/lib/payments/processor";
import { enqueueMonthlySummaries, generateMonthlySummary } from "@/lib/monthly-summary";
import { applySchema, makePool, seedCreator, uniqueSlot } from "./helpers";

/**
 * Monthly Income Summary — metrics generator against real Postgres.
 *
 * Revenue mirrors the dashboard's source of truth (confirmed bookings, keyed on
 * confirmation time = updated_at). Tests seed bookings in the current real month
 * (their updated_at = now) and ask for the summary with `now` set to the FOLLOWING
 * month, so the "previous month" window lands on the seeded data deterministically.
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

/** A `now` in the month AFTER the seeded bookings, so prev-month window = this month. */
function nextMonthNow(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 15, 12, 0, 0));
}

type Customer = { name?: string; email?: string; phone?: string };

async function seedService(creatorId: string, title: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.services (profile_id, type, title, price_paise, is_active)
     values ($1, 'booking', $2, 149900, true) returning id`,
    [creatorId, title],
  );
  return rows[0].id;
}

let off = 0;
async function confirmBooking(opts: {
  creatorId: string;
  amountPaise: number;
  customer: Customer;
  serviceId?: string | null;
}): Promise<void> {
  const slot = uniqueSlot(off++);
  const out = await initiate({
    creatorId: opts.creatorId,
    serviceId: opts.serviceId ?? null,
    slotStart: slot.start,
    slotEnd: slot.end,
    amountPaise: opts.amountPaise,
    customer: opts.customer,
  });
  await pool.query(
    `insert into public.payment_events
       (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
     values ($1, 'webhook', 'payment.captured', $2, $3, '{}'::jsonb)`,
    [out.correlationId, `evt_${randomUUID().slice(0, 12)}`, out.paymentOrderId],
  );
  await processPendingEvents();
}

const C = (n: number): Customer => ({ name: `Client ${n}`, email: `c${n}@x.com`, phone: `+9190000000${n}` });

describe("generateMonthlySummary — metrics", () => {
  it("(1)+(2) sums confirmed revenue and counts confirmed bookings for the previous month", async () => {
    const creator = await seedCreator(pool);
    await confirmBooking({ creatorId: creator, amountPaise: 100000, customer: C(1) });
    await confirmBooking({ creatorId: creator, amountPaise: 50000, customer: C(2) });

    const s = await generateMonthlySummary(creator, pool, { now: nextMonthNow() });
    expect(s.revenuePaise).toBe(150000);
    expect(s.bookings).toBe(2);
  });

  it("(3) counts repeat clients — distinct phones with >= 2 confirmed bookings in the month", async () => {
    const creator = await seedCreator(pool);
    // C(1): two bookings → repeat. C(2): one booking → not.
    await confirmBooking({ creatorId: creator, amountPaise: 10000, customer: C(1) });
    await confirmBooking({ creatorId: creator, amountPaise: 10000, customer: C(1) });
    await confirmBooking({ creatorId: creator, amountPaise: 10000, customer: C(2) });

    const s = await generateMonthlySummary(creator, pool, { now: nextMonthNow() });
    expect(s.bookings).toBe(3);
    expect(s.repeatClients).toBe(1);
  });

  it("(4) picks the most-booked service, deterministic tie-break", async () => {
    const creator = await seedCreator(pool);
    const svcA = await seedService(creator, "Career Consultation");
    const svcB = await seedService(creator, "Quick Chat");
    await confirmBooking({ creatorId: creator, amountPaise: 10000, customer: C(1), serviceId: svcA });
    await confirmBooking({ creatorId: creator, amountPaise: 10000, customer: C(2), serviceId: svcA });
    await confirmBooking({ creatorId: creator, amountPaise: 10000, customer: C(3), serviceId: svcB });

    const s = await generateMonthlySummary(creator, pool, { now: nextMonthNow() });
    expect(s.topService).toBe("Career Consultation");
  });

  it("(5) empty month → zeros and null top service, never throws", async () => {
    const creator = await seedCreator(pool);
    const s = await generateMonthlySummary(creator, pool, { now: nextMonthNow() });
    expect(s.revenuePaise).toBe(0);
    expect(s.bookings).toBe(0);
    expect(s.repeatClients).toBe(0);
    expect(s.topService).toBeNull();
  });

  it("(8) is creator-scoped — another creator's bookings never leak in", async () => {
    const a = await seedCreator(pool);
    const b = await seedCreator(pool);
    await confirmBooking({ creatorId: a, amountPaise: 100000, customer: C(1) });
    await confirmBooking({ creatorId: b, amountPaise: 999000, customer: C(2) });

    const s = await generateMonthlySummary(a, pool, { now: nextMonthNow() });
    expect(s.revenuePaise).toBe(100000);
    expect(s.bookings).toBe(1);
  });
});

async function setWhatsApp(creatorId: string, number: string): Promise<void> {
  await pool.query(`update public.profiles set whatsapp_number = $2 where id = $1`, [creatorId, number]);
}

async function summaryRows(creatorId: string) {
  const { rows } = await pool.query(
    `select type, channel, payload, dedup_key
       from public.notification_queue
      where dedup_key like $1
      order by dedup_key`,
    [`monthly_summary:${creatorId}:%`],
  );
  return rows;
}

describe("enqueueMonthlySummaries — queue integration", () => {
  it("(6) inserts one whatsapp notification for an active creator with a number", async () => {
    const creator = await seedCreator(pool);
    await setWhatsApp(creator, "+919812345678");
    await confirmBooking({ creatorId: creator, amountPaise: 100000, customer: C(1) });

    const { enqueued } = await enqueueMonthlySummaries(pool, { now: nextMonthNow() });
    expect(enqueued).toBeGreaterThanOrEqual(1);

    const rows = await summaryRows(creator);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("monthly_summary");
    expect(rows[0].channel).toBe("whatsapp");
    expect(typeof rows[0].payload.text).toBe("string");
    expect(rows[0].payload.text).toContain("Revenue:");
  });

  it("(7) a second run does not duplicate the message (dedup_key)", async () => {
    const creator = await seedCreator(pool);
    await setWhatsApp(creator, "+919812345678");
    await confirmBooking({ creatorId: creator, amountPaise: 100000, customer: C(1) });

    await enqueueMonthlySummaries(pool, { now: nextMonthNow() });
    await enqueueMonthlySummaries(pool, { now: nextMonthNow() });

    expect(await summaryRows(creator)).toHaveLength(1);
  });

  it("skips creators with no WhatsApp number and creators with no activity", async () => {
    const noNumber = await seedCreator(pool);
    await confirmBooking({ creatorId: noNumber, amountPaise: 100000, customer: C(1) });

    const noActivity = await seedCreator(pool);
    await setWhatsApp(noActivity, "+910000000000");

    await enqueueMonthlySummaries(pool, { now: nextMonthNow() });
    expect(await summaryRows(noNumber)).toHaveLength(0);
    expect(await summaryRows(noActivity)).toHaveLength(0);
  });

  it("(8) each creator gets only their own metrics — no cross-creator aggregation", async () => {
    const a = await seedCreator(pool);
    const b = await seedCreator(pool);
    await setWhatsApp(a, "+919811111111");
    await setWhatsApp(b, "+919822222222");
    await confirmBooking({ creatorId: a, amountPaise: 100000, customer: C(1) });
    await confirmBooking({ creatorId: b, amountPaise: 700000, customer: C(2) });

    await enqueueMonthlySummaries(pool, { now: nextMonthNow() });

    const [ra] = await summaryRows(a);
    const [rb] = await summaryRows(b);
    expect(ra.payload.revenuePaise).toBe(100000);
    expect(rb.payload.revenuePaise).toBe(700000);
  });
});
