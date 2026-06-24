import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { initiate } from "@/lib/payments";
import { processPendingEvents } from "@/lib/payments/processor";
import { processNotifications } from "@/lib/notifications/worker";
import type { NotificationMessage, NotificationProvider } from "@/lib/notifications/provider";
import { enqueueMonthlySummaries } from "@/lib/monthly-summary";
import { applySchema, makePool, seedCreator, uniqueSlot } from "./helpers";

/**
 * Real delivery wiring — drives the existing worker with provider doubles and
 * verifies (a) producers now populate the uniform to+text contract the real
 * provider needs, and (b) the worker's new permanent-failure path dead-letters
 * immediately. No network; the WhatsApp HTTP itself is unit-tested separately.
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

afterEach(async () => {
  await pool.query(
    `update public.notification_queue set status = 'sent'
      where status in ('pending', 'processing', 'failed')`,
  );
});

/** Provider double that records every message it is asked to send. */
function capturingProvider(): { provider: NotificationProvider; sent: NotificationMessage[] } {
  const sent: NotificationMessage[] = [];
  return { provider: { send: async (m) => { sent.push(m); return { ok: true }; } }, sent };
}

const permanentProvider: NotificationProvider = {
  send: async () => ({ ok: false, error: "whatsapp 400", retryable: false }),
};

async function rowStatus(id: string): Promise<{ status: string; attempt_count: number }> {
  const { rows } = await pool.query(
    `select status, attempt_count from public.notification_queue where id = $1`,
    [id],
  );
  return rows[0];
}

async function confirmBooking(creator: string, customer: { name: string; email: string; phone: string }): Promise<string> {
  const slot = uniqueSlot();
  const out = await initiate({
    creatorId: creator,
    slotStart: slot.start,
    slotEnd: slot.end,
    amountPaise: 149900,
    customer,
  });
  await pool.query(
    `insert into public.payment_events
       (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
     values ($1, 'webhook', 'payment.captured', $2, $3, '{}'::jsonb)`,
    [out.correlationId, `evt_${randomUUID().slice(0, 12)}`, out.paymentOrderId],
  );
  await processPendingEvents();
  return out.bookingId;
}

describe("notification delivery — payload contract", () => {
  it("(booking confirmation) carries the client's number and rendered text", async () => {
    const creator = await seedCreator(pool);
    await pool.query(`update public.profiles set display_name = 'Meera' where id = $1`, [creator]);
    await confirmBooking(creator, { name: "Asha", email: "asha@x.com", phone: "+919812345678" });

    const cap = capturingProvider();
    await processNotifications({ provider: cap.provider });

    const client = cap.sent.find((m) => m.type === "client_confirmation");
    expect(client).toBeDefined();
    expect(client!.payload.to).toBe("+919812345678");
    expect(String(client!.payload.text)).toContain("confirmed");
    expect(String(client!.payload.text)).toContain("Meera");
  });

  it("(monthly summary) carries the creator's number and summary text", async () => {
    const creator = await seedCreator(pool);
    await pool.query(`update public.profiles set whatsapp_number = '+919800000000' where id = $1`, [creator]);
    await confirmBooking(creator, { name: "Asha", email: "asha@x.com", phone: "+919812345678" });

    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15, 12));
    await enqueueMonthlySummaries(pool, { now: next });

    const cap = capturingProvider();
    await processNotifications({ provider: cap.provider });

    const monthly = cap.sent.find((m) => m.type === "monthly_summary");
    expect(monthly).toBeDefined();
    expect(monthly!.payload.to).toBe("+919800000000");
    expect(String(monthly!.payload.text)).toContain("Revenue:");
  });
});

describe("notification delivery — permanent failure", () => {
  it("a permanent (non-retryable) failure dead-letters immediately", async () => {
    const creator = await seedCreator(pool);
    const slot = uniqueSlot();
    const correlationId = randomUUID();
    const bookingId = (
      await pool.query<{ id: string }>(
        `insert into public.bookings (correlation_id, creator_id, slot_start, slot_end, amount_paise)
         values ($1, $2, $3, $4, 10000) returning id`,
        [correlationId, creator, slot.start, slot.end],
      )
    ).rows[0].id;
    const { rows } = await pool.query<{ id: string }>(
      `insert into public.notification_queue (correlation_id, booking_id, type, channel, payload, status)
       values ($1, $2, 'client_confirmation', 'whatsapp', '{}'::jsonb, 'pending') returning id`,
      [correlationId, bookingId],
    );
    const id = rows[0].id;

    const summary = await processNotifications({ provider: permanentProvider });
    expect(summary).toMatchObject({ processed: 1, dead_letter: 1, failed: 0 });

    const row = await rowStatus(id);
    expect(row.status).toBe("dead_letter");
    expect(row.attempt_count).toBe(1); // no backoff schedule consumed
  });
});
