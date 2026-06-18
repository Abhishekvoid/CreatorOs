import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { getCreatorBookings, getCreatorBookingDetail } from "@/lib/bookings";
import { applySchema, makePool, seedBooking, seedCreator } from "./helpers";

/**
 * Creator bookings query layer — grouping correctness + owner isolation.
 *
 * Pins the three things that matter: bookings land in the right group
 * (upcoming/past/cancelled), abandoned attempts (pending/expired) never show,
 * and a creator can never read another creator's booking by id.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

async function setStatus(id: string, status: string): Promise<void> {
  await pool.query(`update public.bookings set status = $2 where id = $1`, [id, status]);
}

async function seedPaymentOrder(
  bookingId: string,
  status: string,
  amountPaise: number,
): Promise<void> {
  await pool.query(
    `insert into public.payment_orders (correlation_id, booking_id, provider, amount_paise, status)
     values (gen_random_uuid(), $1, 'test', $2, $3)`,
    [bookingId, amountPaise, status],
  );
}

const FUTURE = { start: "2100-01-01T10:00:00.000Z", end: "2100-01-01T10:30:00.000Z" };
const FUTURE_LATER = { start: "2100-02-01T10:00:00.000Z", end: "2100-02-01T10:30:00.000Z" };
const PAST = { start: "2020-01-01T10:00:00.000Z", end: "2020-01-01T10:30:00.000Z" };

describe("getCreatorBookings — grouping", () => {
  it("groups confirmed-by-slot and cancelled, excluding pending/expired", async () => {
    const creator = await seedCreator(pool);
    const upcoming = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    const past = await seedBooking(pool, { creatorId: creator, slotStart: PAST.start, slotEnd: PAST.end });
    const cancelled = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    const expired = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    // a 5th stays payment_pending (seedBooking default)
    await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    await setStatus(upcoming, "confirmed");
    await setStatus(past, "confirmed");
    await setStatus(cancelled, "cancelled");
    await setStatus(expired, "expired");

    const groups = await getCreatorBookings(creator, pool);
    expect(groups.upcoming.map((b) => b.id)).toEqual([upcoming]);
    expect(groups.past.map((b) => b.id)).toEqual([past]);
    expect(groups.cancelled.map((b) => b.id)).toEqual([cancelled]);
    // pending + expired appear in no group
    const allIds = [...groups.upcoming, ...groups.past, ...groups.cancelled].map((b) => b.id);
    expect(allIds).not.toContain(expired);
  });

  it("orders upcoming soonest-first", async () => {
    const creator = await seedCreator(pool);
    const later = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE_LATER.start, slotEnd: FUTURE_LATER.end });
    const sooner = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    await setStatus(later, "confirmed");
    await setStatus(sooner, "confirmed");

    const { upcoming } = await getCreatorBookings(creator, pool);
    expect(upcoming.map((b) => b.id)).toEqual([sooner, later]);
  });

  it("returns empty groups for a creator with no bookings", async () => {
    const creator = await seedCreator(pool);
    const groups = await getCreatorBookings(creator, pool);
    expect(groups).toEqual({ upcoming: [], past: [], cancelled: [] });
  });
});

describe("getCreatorBookings — isolation", () => {
  it("never returns another creator's bookings", async () => {
    const me = await seedCreator(pool);
    const other = await seedCreator(pool);
    const mine = await seedBooking(pool, { creatorId: me, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    const theirs = await seedBooking(pool, { creatorId: other, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    await setStatus(mine, "confirmed");
    await setStatus(theirs, "confirmed");

    const groups = await getCreatorBookings(me, pool);
    expect(groups.upcoming.map((b) => b.id)).toEqual([mine]);
    expect(groups.upcoming.map((b) => b.id)).not.toContain(theirs);
  });
});

describe("getCreatorBookingDetail", () => {
  it("returns booking info plus the latest payment order", async () => {
    const creator = await seedCreator(pool);
    const id = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end, amountPaise: 149900 });
    await setStatus(id, "confirmed");
    await seedPaymentOrder(id, "captured", 149900);

    const detail = await getCreatorBookingDetail(creator, id, pool);
    expect(detail?.id).toBe(id);
    expect(detail?.status).toBe("confirmed");
    expect(detail?.amountPaise).toBe(149900);
    expect(detail?.payment).toEqual({ status: "captured", amountPaise: 149900, currency: "INR" });
  });

  it("returns null payment when no payment order exists", async () => {
    const creator = await seedCreator(pool);
    const id = await seedBooking(pool, { creatorId: creator, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    const detail = await getCreatorBookingDetail(creator, id, pool);
    expect(detail?.payment).toBeNull();
  });

  it("returns null for a booking owned by another creator (no cross-creator access)", async () => {
    const me = await seedCreator(pool);
    const other = await seedCreator(pool);
    const theirs = await seedBooking(pool, { creatorId: other, slotStart: FUTURE.start, slotEnd: FUTURE.end });
    await setStatus(theirs, "confirmed");

    const detail = await getCreatorBookingDetail(me, theirs, pool);
    expect(detail).toBeNull();
  });

  it("returns null for a non-existent booking id", async () => {
    const creator = await seedCreator(pool);
    const detail = await getCreatorBookingDetail(creator, "00000000-0000-0000-0000-000000000000", pool);
    expect(detail).toBeNull();
  });
});
