import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { ingestWebhook } from "@/lib/payments/ingest";
import { processPendingEvents } from "@/lib/payments";
import { loadCreatorPage, getConfirmedBooking } from "@/lib/public-profile";
import { initiateBooking, getCreatorSlots, getBookingStatus } from "@/lib/booking-initiate";
import { applySchema, makePool, seedCreator, seedAvailabilityWindow, insertLock, uniqueSlot, istToUtcISO, istWeekday } from "./helpers";

/**
 * Milestone — First Real Booking, end-to-end against real Postgres (no mocks).
 *
 * Exercises the server-only lib functions the UI is a thin shell over:
 * loadCreatorPage / getCreatorSlots / initiateBooking / getBookingStatus /
 * getConfirmedBooking. Confirmation flows ONLY through the frozen Phase 4
 * ingestor → Phase 5 processor — the browser never confirms.
 */

const WEBHOOK_SECRET = "milestone_test_webhook_secret";

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
  delete process.env.PAYMENT_PROVIDER; // test mode → synthetic order, no network
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterAll(async () => {
  await pool.end();
});

async function seedPublishedCreator(opts: { withService?: boolean } = {}): Promise<{
  creatorId: string;
  handle: string;
  serviceId: string | null;
}> {
  const creatorId = await seedCreator(pool);
  const { rows: [{ handle }] } = await pool.query<{ handle: string }>(
    `select handle from public.profiles where id = $1`,
    [creatorId],
  );
  await pool.query(
    `update public.profiles set is_published = true, display_name = 'Test Creator', title = 'Coach' where id = $1`,
    [creatorId],
  );
  let serviceId: string | null = null;
  if (opts.withService !== false) {
    const { rows } = await pool.query<{ id: string }>(
      `insert into public.services (profile_id, type, title, description, price_paise, duration_minutes, is_active)
       values ($1, 'booking', 'Strategy Call', 'A focused session', 149900, 60, true)
       returning id`,
      [creatorId],
    );
    serviceId = rows[0].id;
  }
  return { creatorId, handle, serviceId };
}

/** A Razorpay-shaped, correctly-signed captured webhook for a provider order. */
function signedCapturedWebhook(providerOrderId: string): { rawBody: string; signature: string; eventId: string } {
  const rawBody = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { order_id: providerOrderId } } },
  });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return { rawBody, signature, eventId: `evt_${randomUUID().slice(0, 12)}` };
}

// =========================================================================

describe("public creator page", () => {
  it("(1) loads a published creator and its services from the database", async () => {
    const { handle, serviceId } = await seedPublishedCreator();
    const page = await loadCreatorPage(handle);
    expect(page).not.toBeNull();
    expect(page!.creator.handle).toBe(handle);
    expect(page!.creator.name).toBe("Test Creator");
    expect(page!.services).toHaveLength(1);
    expect(page!.services[0].id).toBe(serviceId);
    expect(page!.services[0].pricePaise).toBe(149900);
  });

  it("(2) returns null for a missing handle", async () => {
    expect(await loadCreatorPage("definitely_not_a_handle")).toBeNull();
  });

  it("(2b) returns null for an unpublished handle", async () => {
    const creatorId = await seedCreator(pool); // is_published defaults false
    const { rows: [{ handle }] } = await pool.query<{ handle: string }>(
      `select handle from public.profiles where id = $1`,
      [creatorId],
    );
    expect(await loadCreatorPage(handle)).toBeNull();
  });
});

describe("slot availability (Rule 5 — reads booking_locks)", () => {
  // a fixed far-future IST civil day, with one 3-hour window → 3 one-hour slots
  const Y = 2100, M = 1, D = 4;
  const weekday = istWeekday(Y, M, D);
  const from = istToUtcISO(Y, M, D, 0, 0);
  const to = istToUtcISO(Y, M, D + 1, 0, 0);
  const nineAm = istToUtcISO(Y, M, D, 9, 0);
  const tenAm = istToUtcISO(Y, M, D, 10, 0);

  it("lists every open slot when nothing is booked", async () => {
    const { creatorId, handle, serviceId } = await seedPublishedCreator();
    await seedAvailabilityWindow(pool, creatorId, weekday, "09:00", "12:00");
    const slots = await getCreatorSlots({ handle, serviceId: serviceId!, from, to });
    expect(slots.map((s) => s.slotStart)).toEqual([nineAm, tenAm, istToUtcISO(Y, M, D, 11, 0)]);
  });

  it("(7) hides a slot occupied by an active lock", async () => {
    const { creatorId, handle, serviceId } = await seedPublishedCreator();
    await seedAvailabilityWindow(pool, creatorId, weekday, "09:00", "12:00");
    await insertLock(pool, { creatorId, slotStart: nineAm, slotEnd: tenAm, status: "active" });
    const slots = await getCreatorSlots({ handle, serviceId: serviceId!, from, to });
    const starts = slots.map((s) => s.slotStart);
    expect(starts).not.toContain(nineAm);
    expect(starts).toHaveLength(2);
  });

  it("(8) hides a slot held in pending_reconciliation", async () => {
    const { creatorId, handle, serviceId } = await seedPublishedCreator();
    await seedAvailabilityWindow(pool, creatorId, weekday, "09:00", "12:00");
    await insertLock(pool, { creatorId, slotStart: nineAm, slotEnd: tenAm, status: "pending_reconciliation" });
    const slots = await getCreatorSlots({ handle, serviceId: serviceId!, from, to });
    expect(slots.map((s) => s.slotStart)).not.toContain(nineAm);
  });
});

describe("booking initiate", () => {
  it("(3) creates a payment order (created) and a lock (active), priced from the service", async () => {
    const { handle, serviceId } = await seedPublishedCreator();
    const slot = uniqueSlot();
    const out = await initiateBooking({
      creatorHandle: handle,
      serviceId: serviceId!,
      slotStart: slot.start,
      customerName: "Ada Client",
      customerEmail: "ada@example.com",
      customerPhone: "+919876543210",
    });
    expect(out.amount).toBe(149900);
    expect(out.orderId).toBeTruthy();
    expect(out.correlationId).toBeTruthy();

    const order = await pool.query<{ status: string }>(
      `select status from public.payment_orders where correlation_id = $1`,
      [out.correlationId],
    );
    expect(order.rows[0].status).toBe("created");
    const lock = await pool.query<{ status: string }>(
      `select status from public.booking_locks where correlation_id = $1`,
      [out.correlationId],
    );
    expect(lock.rows[0].status).toBe("active");
  });

  it("rejects an unknown handle", async () => {
    await expect(
      initiateBooking({
        creatorHandle: "nobody_here",
        serviceId: randomUUID(),
        slotStart: uniqueSlot().start,
        customerName: "X",
        customerEmail: "x@example.com",
        customerPhone: "+910000000000",
      }),
    ).rejects.toThrow();
  });
});

describe("confirming + success are read-only and authority-free", () => {
  it("(4) the browser callback path cannot confirm — status stays payment_pending", async () => {
    const { handle, serviceId } = await seedPublishedCreator();
    const slot = uniqueSlot();
    const out = await initiateBooking({
      creatorHandle: handle, serviceId: serviceId!, slotStart: slot.start,
      customerName: "A", customerEmail: "a@example.com", customerPhone: "+919000000000",
    });
    // the confirming screen only ever READS status; reading must never mutate
    expect((await getBookingStatus(out.correlationId))!.status).toBe("payment_pending");
    expect((await getBookingStatus(out.correlationId))!.status).toBe("payment_pending");
    expect(await getConfirmedBooking(out.correlationId)).toBeNull();
    // and nothing ever drove a capture
    const ev = await pool.query(`select count(*)::int as n from public.payment_events where correlation_id = $1`, [out.correlationId]);
    expect(ev.rows[0].n).toBe(0);
  });

  it("(5)(6) status flips to confirmed and success data appears only after the processor runs", async () => {
    const { handle, serviceId } = await seedPublishedCreator();
    const slot = uniqueSlot();
    const out = await initiateBooking({
      creatorHandle: handle, serviceId: serviceId!, slotStart: slot.start,
      customerName: "A", customerEmail: "a@example.com", customerPhone: "+919000000000",
    });

    expect((await getBookingStatus(out.correlationId))!.status).toBe("payment_pending");
    expect(await getConfirmedBooking(out.correlationId)).toBeNull();

    await ingestWebhook(signedCapturedWebhook(out.orderId));
    await processPendingEvents();

    expect((await getBookingStatus(out.correlationId))!.status).toBe("confirmed");
    const confirmed = await getConfirmedBooking(out.correlationId);
    expect(confirmed).not.toBeNull();
    expect(confirmed!.serviceTitle).toBe("Strategy Call");
    expect(confirmed!.creatorHandle).toBe(handle);
  });
});

describe("full happy path (test mode, webhook confirms)", () => {
  it("(9) publish → initiate → signed webhook → processor → confirmed booking, no DB edits", async () => {
    const { handle, serviceId } = await seedPublishedCreator();
    const slot = uniqueSlot();

    const out = await initiateBooking({
      creatorHandle: handle, serviceId: serviceId!, slotStart: slot.start,
      customerName: "Ravi", customerEmail: "ravi@example.com", customerPhone: "+919812345678",
    });
    expect((await getBookingStatus(out.correlationId))!.status).toBe("payment_pending");

    const result = await ingestWebhook(signedCapturedWebhook(out.orderId));
    expect(result.status).toBe("ok");

    await processPendingEvents();

    const status = await getBookingStatus(out.correlationId);
    expect(status!.status).toBe("confirmed");

    const confirmed = await getConfirmedBooking(out.correlationId);
    expect(confirmed).toMatchObject({
      bookingId: status!.bookingId,
      serviceTitle: "Strategy Call",
      creatorHandle: handle,
      creatorName: "Test Creator",
    });
    expect(confirmed!.slotStart).toBeTruthy();
  });
});
