import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { initiate } from "@/lib/payments";
import { processPendingEvents } from "@/lib/payments/processor";
import { getCreatorClientDetail, getCreatorClients } from "@/lib/clients";
import { applySchema, makePool, seedCreator, uniqueSlot } from "./helpers";

/**
 * Phase 2 Client CRM (FR-40/FR-41) against real Postgres (no mocks).
 *
 * Confirmed bookings must automatically build a creator-owned customer
 * database: one client per (creator, WhatsApp), with booking_count and
 * lifetime_spend accumulating, idempotent under replay, and strictly isolated
 * per creator. Everything is driven through the real path — the orchestrator
 * (initiate) emits a booking+order, a captured payment_event is appended, and
 * the Processor applies it — never by writing clients directly.
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

type Customer = { name?: string; email?: string; phone?: string };

async function insertCapturedEvent(correlationId: string, paymentOrderId: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.payment_events
       (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
     values ($1, 'webhook', 'payment.captured', $2, $3, '{}'::jsonb)
     returning id`,
    [correlationId, `evt_${randomUUID().slice(0, 12)}`, paymentOrderId],
  );
  return rows[0].id;
}

/** Seed an active booking service for a creator; returns its id. */
async function seedService(creatorId: string, title: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.services (profile_id, type, title, price_paise, is_active)
     values ($1, 'booking', $2, 149900, true)
     returning id`,
    [creatorId, title],
  );
  return rows[0].id;
}

/** Initiate a booking, append a captured event, drain the processor → confirmed. */
async function confirmBooking(opts: {
  creatorId: string;
  amountPaise: number;
  customer: Customer;
  slotOffset?: number;
  serviceId?: string | null;
}): Promise<{ bookingId: string; eventId: string }> {
  const slot = uniqueSlot(opts.slotOffset ?? 0);
  const out = await initiate({
    creatorId: opts.creatorId,
    serviceId: opts.serviceId ?? null,
    slotStart: slot.start,
    slotEnd: slot.end,
    amountPaise: opts.amountPaise,
    customer: opts.customer,
  });
  const eventId = await insertCapturedEvent(out.correlationId, out.paymentOrderId);
  await processPendingEvents();
  return { bookingId: out.bookingId, eventId };
}

async function clientByPhone(creatorId: string, phone: string) {
  const { rows } = await pool.query(
    `select id, name, whatsapp, email, booking_count, lifetime_spend_paise,
            first_booking_at, last_booking_at
       from public.clients where creator_id = $1 and whatsapp = $2`,
    [creatorId, phone],
  );
  return rows[0] ?? null;
}

const CUSTOMER: Customer = { name: "Asha Rao", email: "asha@example.com", phone: "+919812345678" };

describe("client CRM — creation & accumulation", () => {
  it("(1) creates a client on the first confirmed booking", async () => {
    const creator = await seedCreator(pool);
    await confirmBooking({ creatorId: creator, amountPaise: 149900, customer: CUSTOMER });

    const c = await clientByPhone(creator, CUSTOMER.phone!);
    expect(c).not.toBeNull();
    expect(c.name).toBe("Asha Rao");
    expect(c.email).toBe("asha@example.com");
    expect(Number(c.booking_count)).toBe(1);
    expect(Number(c.lifetime_spend_paise)).toBe(149900);
    expect(c.first_booking_at).not.toBeNull();
    expect(c.last_booking_at).not.toBeNull();
  });

  it("(2)+(4) a repeat booking updates the same client and increments booking_count", async () => {
    const creator = await seedCreator(pool);
    await confirmBooking({ creatorId: creator, amountPaise: 100000, customer: CUSTOMER, slotOffset: 0 });
    await confirmBooking({ creatorId: creator, amountPaise: 200000, customer: CUSTOMER, slotOffset: 5 });

    const { rows } = await pool.query(
      `select count(*)::int as n from public.clients where creator_id = $1 and whatsapp = $2`,
      [creator, CUSTOMER.phone],
    );
    expect(rows[0].n).toBe(1); // same client, not a duplicate row

    const c = await clientByPhone(creator, CUSTOMER.phone!);
    expect(Number(c.booking_count)).toBe(2);
  });

  it("(3) lifetime spend accumulates across confirmed bookings", async () => {
    const creator = await seedCreator(pool);
    await confirmBooking({ creatorId: creator, amountPaise: 149900, customer: CUSTOMER, slotOffset: 0 });
    await confirmBooking({ creatorId: creator, amountPaise: 50000, customer: CUSTOMER, slotOffset: 5 });
    await confirmBooking({ creatorId: creator, amountPaise: 25000, customer: CUSTOMER, slotOffset: 10 });

    const c = await clientByPhone(creator, CUSTOMER.phone!);
    expect(Number(c.lifetime_spend_paise)).toBe(224900);
    expect(Number(c.booking_count)).toBe(3);
  });
});

describe("client CRM — idempotency", () => {
  it("(5) replaying the same captured event does not double-count", async () => {
    const creator = await seedCreator(pool);
    const { eventId } = await confirmBooking({ creatorId: creator, amountPaise: 149900, customer: CUSTOMER });

    // Force a genuine re-application of the same event three times.
    for (let i = 0; i < 3; i++) {
      await pool.query(`update public.payment_events set processed = false, processed_at = null where id = $1`, [eventId]);
      await processPendingEvents();
    }

    const c = await clientByPhone(creator, CUSTOMER.phone!);
    expect(Number(c.booking_count)).toBe(1);
    expect(Number(c.lifetime_spend_paise)).toBe(149900);
  });
});

describe("client CRM — creator isolation", () => {
  it("(6) the same WhatsApp number under two creators yields two independent clients", async () => {
    const creatorA = await seedCreator(pool);
    const creatorB = await seedCreator(pool);
    await confirmBooking({ creatorId: creatorA, amountPaise: 100000, customer: CUSTOMER });
    await confirmBooking({ creatorId: creatorB, amountPaise: 300000, customer: CUSTOMER });

    const a = await clientByPhone(creatorA, CUSTOMER.phone!);
    const b = await clientByPhone(creatorB, CUSTOMER.phone!);
    expect(a.id).not.toBe(b.id);
    expect(Number(a.lifetime_spend_paise)).toBe(100000);
    expect(Number(b.lifetime_spend_paise)).toBe(300000);

    // A creator's list only ever contains their own clients.
    const listA = await getCreatorClients(creatorA, pool);
    expect(listA.every((c) => c.whatsapp === CUSTOMER.phone)).toBe(true);
    expect(listA).toHaveLength(1);
  });
});

describe("client CRM — detail authorization", () => {
  it("(7) a creator cannot read another creator's client by id", async () => {
    const creatorA = await seedCreator(pool);
    const creatorB = await seedCreator(pool);
    await confirmBooking({ creatorId: creatorA, amountPaise: 100000, customer: CUSTOMER });

    const [clientA] = await getCreatorClients(creatorA, pool);
    expect(clientA).toBeDefined();

    // Owner sees it, with booking history.
    const ownView = await getCreatorClientDetail(creatorA, clientA.id, pool);
    expect(ownView).not.toBeNull();
    expect(ownView!.bookings.length).toBe(1);
    expect(ownView!.bookings[0].status).toBe("confirmed");

    // Creator B asking for A's client id gets null (→ 404), never a leak.
    const crossView = await getCreatorClientDetail(creatorB, clientA.id, pool);
    expect(crossView).toBeNull();
  });
});

describe("client CRM — last booked service (rebook)", () => {
  it("(rebook-1) lastServiceId is the most recently booked confirmed service, creator-scoped", async () => {
    const creator = await seedCreator(pool);
    const svcA = await seedService(creator, "Strategy call");
    const svcB = await seedService(creator, "Deep dive");

    // Two confirmed bookings; the second is booked later (created_at desc wins).
    await confirmBooking({ creatorId: creator, amountPaise: 100000, customer: CUSTOMER, slotOffset: 0, serviceId: svcA });
    await confirmBooking({ creatorId: creator, amountPaise: 200000, customer: CUSTOMER, slotOffset: 5, serviceId: svcB });

    const [client] = await getCreatorClients(creator, pool);
    const detail = await getCreatorClientDetail(creator, client.id, pool);
    expect(detail!.lastServiceId).toBe(svcB);
  });

  it("(rebook-5) a deleted service leaves lastServiceId null (booking.service_id → null)", async () => {
    const creator = await seedCreator(pool);
    const svc = await seedService(creator, "One-off");
    await confirmBooking({ creatorId: creator, amountPaise: 100000, customer: CUSTOMER, serviceId: svc });

    // Deleting the service nulls the booking's service_id (on delete set null).
    await pool.query(`delete from public.services where id = $1`, [svc]);

    const [client] = await getCreatorClients(creator, pool);
    const detail = await getCreatorClientDetail(creator, client.id, pool);
    expect(detail!.lastServiceId).toBeNull();
  });
});
