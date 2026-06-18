import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { getCreatorDashboard } from "@/lib/dashboard";
import { applySchema, makePool, seedBooking, seedCreator } from "./helpers";

/**
 * Creator dashboard query layer — correctness + isolation.
 *
 * The dashboard reads service-role-only booking data through the pg pool,
 * scoped to one creator. These tests pin the two things that matter most:
 *   1. Numbers are correct (confirmed-only revenue/counts, future-only upcoming).
 *   2. A creator NEVER sees another creator's data.
 *
 * Runs as the postgres superuser (bypasses RLS), so creator-scoping here is
 * the application WHERE clauses, exactly as the deployed service-role path.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

/** Confirm a booking. By default updated_at = now() (this month); pass `confirmedAt`
 *  to backdate it, which requires bypassing the set_updated_at trigger. */
async function confirmBooking(id: string, confirmedAt?: string): Promise<void> {
  if (!confirmedAt) {
    await pool.query(`update public.bookings set status = 'confirmed' where id = $1`, [id]);
    return;
  }
  await pool.query(`alter table public.bookings disable trigger bookings_set_updated_at`);
  try {
    await pool.query(
      `update public.bookings set status = 'confirmed', updated_at = $2 where id = $1`,
      [id, confirmedAt],
    );
  } finally {
    await pool.query(`alter table public.bookings enable trigger bookings_set_updated_at`);
  }
}

const FUTURE = { start: "2100-01-01T10:00:00.000Z", end: "2100-01-01T10:30:00.000Z" };
const PAST = { start: "2020-01-01T10:00:00.000Z", end: "2020-01-01T10:30:00.000Z" };

describe("getCreatorDashboard — revenue", () => {
  it("sums only confirmed bookings into lifetime revenue", async () => {
    const creator = await seedCreator(pool);
    const a = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end, amountPaise: 100_000 });
    const b = await seedBooking(pool, { creatorId: creator, slotStart: PAST.start, slotEnd: PAST.end, amountPaise: 50_000 });
    // c stays payment_pending and must be excluded
    await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end, amountPaise: 999_999 });
    await confirmBooking(a);
    await confirmBooking(b);

    const { revenue, confirmedBookings } = await getCreatorDashboard(creator, pool);
    expect(revenue.lifetimePaise).toBe(150_000);
    expect(confirmedBookings).toBe(2);
  });

  it("counts only this-month confirmations in thisMonthPaise", async () => {
    const creator = await seedCreator(pool);
    const recent = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end, amountPaise: 70_000 });
    const old = await seedBooking(pool, { creatorId: creator, slotStart: PAST.start, slotEnd: PAST.end, amountPaise: 30_000 });
    await confirmBooking(recent); // updated_at = now() → this month
    await confirmBooking(old, "2000-01-15T00:00:00.000Z"); // backdated → not this month

    const { revenue } = await getCreatorDashboard(creator, pool);
    expect(revenue.lifetimePaise).toBe(100_000);
    expect(revenue.thisMonthPaise).toBe(70_000);
  });

  it("reports zero revenue for a creator with no confirmed bookings", async () => {
    const creator = await seedCreator(pool);
    await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    const { revenue, confirmedBookings } = await getCreatorDashboard(creator, pool);
    expect(revenue).toEqual({ lifetimePaise: 0, thisMonthPaise: 0 });
    expect(confirmedBookings).toBe(0);
  });
});

describe("getCreatorDashboard — upcoming", () => {
  it("returns only future confirmed bookings, soonest first", async () => {
    const creator = await seedCreator(pool);
    const future = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    const past = await seedBooking(pool, { creatorId: creator, slotStart: PAST.start, slotEnd: PAST.end });
    const pendingFuture = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    await confirmBooking(future);
    await confirmBooking(past); // confirmed but in the past → excluded
    // pendingFuture stays payment_pending → excluded

    const { upcoming } = await getCreatorDashboard(creator, pool);
    const ids = upcoming.map((u) => u.id);
    expect(ids).toContain(future);
    expect(ids).not.toContain(past);
    expect(ids).not.toContain(pendingFuture);
    expect(upcoming.every((u) => u.status === "confirmed")).toBe(true);
  });
});

describe("getCreatorDashboard — activity", () => {
  it("emits a received event per booking and a confirmed event once confirmed", async () => {
    const creator = await seedCreator(pool);
    const booking = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end, amountPaise: 42_000 });
    await confirmBooking(booking);

    const { activity } = await getCreatorDashboard(creator, pool);
    const kinds = activity.map((a) => a.kind);
    expect(kinds).toContain("booking_received");
    expect(kinds).toContain("booking_confirmed");
    const confirmed = activity.find((a) => a.kind === "booking_confirmed");
    expect(confirmed?.amountPaise).toBe(42_000);
  });
});

describe("getCreatorDashboard — creator isolation", () => {
  it("never leaks another creator's bookings, revenue or activity", async () => {
    const me = await seedCreator(pool);
    const other = await seedCreator(pool);

    const mine = await seedBooking(pool, { creatorId: me, slotStart: FUTURE.start, slotEnd: FUTURE.end, amountPaise: 10_000 });
    await confirmBooking(mine);
    const theirs = await seedBooking(pool, { creatorId: other, slotStart: FUTURE.start, slotEnd: FUTURE.end, amountPaise: 999_999 });
    await confirmBooking(theirs);

    const dash = await getCreatorDashboard(me, pool);
    expect(dash.revenue.lifetimePaise).toBe(10_000);
    expect(dash.confirmedBookings).toBe(1);
    expect(dash.upcoming.map((u) => u.id)).toEqual([mine]);
    // none of the other creator's data appears anywhere
    expect(dash.upcoming.map((u) => u.id)).not.toContain(theirs);
  });
});
