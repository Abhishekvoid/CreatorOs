import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  acquireLock,
  confirmBooking,
  expireToReconciliation,
  getAvailability,
  releaseLock,
  SlotUnavailableError,
} from "@/lib/booking";
import {
  applySchema,
  expireLockNow,
  istToUtcISO,
  istWeekday,
  lockStatus,
  makePool,
  seedAvailabilityWindow,
  seedBooking,
  seedCreator,
} from "./helpers";

/**
 * Phase 2 — Booking Service against real Postgres (no mocks).
 * Verifies the lock state machine, the "expiry never frees a slot" rule,
 * and RULE 5 (availability reads booking_locks only).
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

// A fixed future IST day with a 10:00–18:00 window → 8 hourly candidate slots.
const Y = 2099;
const M = 6;
const D = 15;
const WEEKDAY = istWeekday(Y, M, D);
const DAY_FROM = istToUtcISO(Y, M, D, 0, 0);
const DAY_TO = istToUtcISO(Y, M, D + 1, 0, 0);

async function creatorWithWindow(): Promise<string> {
  const creator = await seedCreator(pool);
  await seedAvailabilityWindow(pool, creator, WEEKDAY, "10:00", "18:00");
  return creator;
}

async function starts(creatorId: string): Promise<string[]> {
  const slots = await getAvailability({ creatorId, from: DAY_FROM, to: DAY_TO, slotMinutes: 60 });
  return slots.map((s) => s.slotStart);
}

describe("acquireLock — the insert is the check", () => {
  it("(1) two simultaneous acquireLock for one creator+slot: exactly one succeeds", async () => {
    const creator = await seedCreator(pool);
    const slotStart = istToUtcISO(Y, M, D, 11, 0);
    const slotEnd = istToUtcISO(Y, M, D, 12, 0);
    const b1 = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });
    const b2 = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });

    const results = await Promise.allSettled([
      acquireLock({ creatorId: creator, slotStart, slotEnd, bookingId: b1, correlationId: crypto.randomUUID() }),
      acquireLock({ creatorId: creator, slotStart, slotEnd, bookingId: b2, correlationId: crypto.randomUUID() }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(SlotUnavailableError);
  });

  it("(2) different creators may lock the same slot time", async () => {
    const c1 = await seedCreator(pool);
    const c2 = await seedCreator(pool);
    const slotStart = istToUtcISO(Y, M, D, 11, 0);
    const slotEnd = istToUtcISO(Y, M, D, 12, 0);
    const b1 = await seedBooking(pool, { creatorId: c1, slotStart, slotEnd });
    const b2 = await seedBooking(pool, { creatorId: c2, slotStart, slotEnd });

    await expect(
      acquireLock({ creatorId: c1, slotStart, slotEnd, bookingId: b1, correlationId: crypto.randomUUID() }),
    ).resolves.toHaveProperty("id");
    await expect(
      acquireLock({ creatorId: c2, slotStart, slotEnd, bookingId: b2, correlationId: crypto.randomUUID() }),
    ).resolves.toHaveProperty("id");
  });

  it("(7) a duplicate lock surfaces a domain error, not a raw pg exception", async () => {
    const creator = await seedCreator(pool);
    const slotStart = istToUtcISO(Y, M, D, 15, 0);
    const slotEnd = istToUtcISO(Y, M, D, 16, 0);
    const b1 = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });
    const b2 = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });
    await acquireLock({ creatorId: creator, slotStart, slotEnd, bookingId: b1, correlationId: crypto.randomUUID() });

    await expect(
      acquireLock({ creatorId: creator, slotStart, slotEnd, bookingId: b2, correlationId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });
});

describe("expiry & release", () => {
  it("(3) expireToReconciliation moves active→pending_reconciliation; slot stays blocked", async () => {
    const creator = await creatorWithWindow();
    const slotStart = istToUtcISO(Y, M, D, 13, 0);
    const slotEnd = istToUtcISO(Y, M, D, 14, 0);
    const booking = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });
    const { id: lockId } = await acquireLock({
      creatorId: creator,
      slotStart,
      slotEnd,
      bookingId: booking,
      correlationId: crypto.randomUUID(),
    });

    expect(await starts(creator)).not.toContain(slotStart); // blocked while active

    await expireLockNow(pool, lockId);
    const { expired } = await expireToReconciliation();
    expect(expired).toContain(lockId);
    expect(await lockStatus(pool, lockId)).toBe("pending_reconciliation");

    expect(await starts(creator)).not.toContain(slotStart); // STILL blocked — never freed
  });

  it("(4) releaseLock frees the slot for availability", async () => {
    const creator = await creatorWithWindow();
    const slotStart = istToUtcISO(Y, M, D, 14, 0);
    const slotEnd = istToUtcISO(Y, M, D, 15, 0);
    const booking = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });
    const { id: lockId } = await acquireLock({
      creatorId: creator,
      slotStart,
      slotEnd,
      bookingId: booking,
      correlationId: crypto.randomUUID(),
    });

    expect(await starts(creator)).not.toContain(slotStart);

    const res = await releaseLock({ bookingId: booking });
    expect(res.lockReleased).toBe(true);
    expect(await lockStatus(pool, lockId)).toBe("released");

    expect(await starts(creator)).toContain(slotStart); // released → bookable again
  });
});

describe("confirmBooking — state-guarded", () => {
  it("(5a) active → confirmed", async () => {
    const creator = await seedCreator(pool);
    const slotStart = istToUtcISO(Y, M, D, 16, 0);
    const slotEnd = istToUtcISO(Y, M, D, 17, 0);
    const booking = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });
    const { id: lockId } = await acquireLock({
      creatorId: creator,
      slotStart,
      slotEnd,
      bookingId: booking,
      correlationId: crypto.randomUUID(),
    });

    const res = await confirmBooking({ bookingId: booking });
    expect(res.lockConfirmed).toBe(true);
    expect(res.bookingConfirmed).toBe(true);
    expect(await lockStatus(pool, lockId)).toBe("confirmed");
  });

  it("(5b) pending_reconciliation → confirmed", async () => {
    const creator = await seedCreator(pool);
    const slotStart = istToUtcISO(Y, M, D, 17, 0);
    const slotEnd = istToUtcISO(Y, M, D, 18, 0);
    const booking = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });
    const { id: lockId } = await acquireLock({
      creatorId: creator,
      slotStart,
      slotEnd,
      bookingId: booking,
      correlationId: crypto.randomUUID(),
    });
    await expireLockNow(pool, lockId);
    await expireToReconciliation();
    expect(await lockStatus(pool, lockId)).toBe("pending_reconciliation");

    const res = await confirmBooking({ bookingId: booking });
    expect(res.lockConfirmed).toBe(true);
    expect(await lockStatus(pool, lockId)).toBe("confirmed");
  });

  it("does not confirm a released lock (no illegal transition)", async () => {
    const creator = await seedCreator(pool);
    const slotStart = istToUtcISO(Y, M, D, 10, 0);
    const slotEnd = istToUtcISO(Y, M, D, 11, 0);
    const booking = await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });
    const { id: lockId } = await acquireLock({
      creatorId: creator,
      slotStart,
      slotEnd,
      bookingId: booking,
      correlationId: crypto.randomUUID(),
    });
    await releaseLock({ bookingId: booking });

    const res = await confirmBooking({ bookingId: booking });
    expect(res.lockConfirmed).toBe(false);
    expect(await lockStatus(pool, lockId)).toBe("released");
  });
});

describe("RULE 5 — availability reads booking_locks only", () => {
  it("(6) a bookings row with no lock does not block availability", async () => {
    const creator = await creatorWithWindow();
    const slotStart = istToUtcISO(Y, M, D, 12, 0);
    const slotEnd = istToUtcISO(Y, M, D, 13, 0);

    // a booking exists at this slot, but NO lock — availability must ignore it
    await seedBooking(pool, { creatorId: creator, slotStart, slotEnd });

    expect(await starts(creator)).toContain(slotStart);
  });

  it("generates the full window when nothing is locked", async () => {
    const creator = await creatorWithWindow();
    const all = await starts(creator);
    expect(all).toHaveLength(8); // 10:00..17:00 hourly
    expect(all[0]).toBe(istToUtcISO(Y, M, D, 10, 0));
    expect(all.at(-1)).toBe(istToUtcISO(Y, M, D, 17, 0));
  });
});
