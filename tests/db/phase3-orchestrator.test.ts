import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { getPaymentProvider, initiate, OrderCreationError } from "@/lib/payments";
import type { PaymentProvider } from "@/lib/payments";
import { SlotUnavailableError } from "@/lib/booking";
import { applySchema, makePool, seedCreator } from "./helpers";

/**
 * Phase 3 — Payment Orchestrator against real Postgres (no mocks).
 * Confirms initiate() wires booking+lock+order under one correlation_id,
 * compensates cleanly on provider failure, wins/loses slot races without
 * orphans, selects the provider by env, and never touches payment_events.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

const SLOT_START = "2099-07-01T10:00:00.000Z";
const SLOT_END = "2099-07-01T11:00:00.000Z";
const AMOUNT = 149900;

async function countWhere(table: string, col: string, val: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `select count(*)::text as n from public.${table} where ${col} = $1`,
    [val],
  );
  return Number(rows[0].n);
}

describe("initiate() — happy path", () => {
  it("(1) creates booking + lock + payment_order under one correlation_id", async () => {
    const creator = await seedCreator(pool);
    const out = await initiate({ creatorId: creator, slotStart: SLOT_START, slotEnd: SLOT_END, amountPaise: AMOUNT });

    const booking = await pool.query<{ correlation_id: string; status: string }>(
      `select correlation_id, status from public.bookings where id = $1`,
      [out.bookingId],
    );
    const lock = await pool.query<{ correlation_id: string; status: string }>(
      `select correlation_id, status from public.booking_locks where booking_id = $1`,
      [out.bookingId],
    );
    const order = await pool.query<{ correlation_id: string; status: string; provider_order_id: string }>(
      `select correlation_id, status, provider_order_id from public.payment_orders where booking_id = $1`,
      [out.bookingId],
    );

    expect(booking.rows).toHaveLength(1);
    expect(lock.rows).toHaveLength(1);
    expect(order.rows).toHaveLength(1);

    // all three carry the SAME correlation_id, equal to the returned one
    const ids = new Set([
      out.correlationId,
      booking.rows[0].correlation_id,
      lock.rows[0].correlation_id,
      order.rows[0].correlation_id,
    ]);
    expect(ids.size).toBe(1);

    // start states only — orchestrator confirms nothing
    expect(booking.rows[0].status).toBe("payment_pending");
    expect(lock.rows[0].status).toBe("active");
    expect(order.rows[0].status).toBe("created");
    expect(order.rows[0].provider_order_id).toBe(out.orderId);
  });

  it("(7) never writes payment_events", async () => {
    const creator = await seedCreator(pool);
    await initiate({ creatorId: creator, slotStart: "2099-07-02T10:00:00.000Z", slotEnd: "2099-07-02T11:00:00.000Z", amountPaise: AMOUNT });
    const { rows } = await pool.query<{ n: string }>(`select count(*)::text as n from public.payment_events`);
    expect(rows[0].n).toBe("0");
  });
});

describe("initiate() — provider failure compensates", () => {
  it("(2) releases lock, cancels booking, writes no payment_order", async () => {
    const creator = await seedCreator(pool);
    const failing: PaymentProvider = {
      getProviderName: () => "razorpay_test",
      createOrder: async () => {
        throw new Error("simulated provider outage");
      },
      verifyWebhookSignature: () => false,
      getOrderStatus: async () => {
        throw new Error("n/a");
      },
      getPaymentStatus: async () => {
        throw new Error("n/a");
      },
      refundPayment: async () => {
        throw new Error("n/a");
      },
    };

    await expect(
      initiate(
        { creatorId: creator, slotStart: "2099-07-03T10:00:00.000Z", slotEnd: "2099-07-03T11:00:00.000Z", amountPaise: AMOUNT },
        { provider: failing },
      ),
    ).rejects.toBeInstanceOf(OrderCreationError);

    // fresh creator → exactly one booking/lock for it; assert their terminal states
    const booking = await pool.query<{ id: string; status: string }>(
      `select id, status from public.bookings where creator_id = $1`,
      [creator],
    );
    const lock = await pool.query<{ status: string }>(
      `select status from public.booking_locks where creator_id = $1`,
      [creator],
    );
    expect(booking.rows).toHaveLength(1);
    expect(booking.rows[0].status).toBe("cancelled");
    expect(lock.rows[0].status).toBe("released");
    expect(await countWhere("payment_orders", "booking_id", booking.rows[0].id)).toBe(0);
  });
});

describe("initiate() — duplicate slot race", () => {
  it("(3) one initiate succeeds, one fails, no orphans", async () => {
    const creator = await seedCreator(pool);
    const slotStart = "2099-07-04T10:00:00.000Z";
    const slotEnd = "2099-07-04T11:00:00.000Z";

    const results = await Promise.allSettled([
      initiate({ creatorId: creator, slotStart, slotEnd, amountPaise: AMOUNT }),
      initiate({ creatorId: creator, slotStart, slotEnd, amountPaise: AMOUNT }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(SlotUnavailableError);

    // loser's booking rolled back with its lock — exactly one of each persists
    expect(await countWhere("bookings", "creator_id", creator)).toBe(1);
    expect(await countWhere("booking_locks", "creator_id", creator)).toBe(1);
  });
});

describe("provider selection by env", () => {
  it("(4) TestModeProvider when PAYMENT_PROVIDER is unset", () => {
    const prev = process.env.PAYMENT_PROVIDER;
    delete process.env.PAYMENT_PROVIDER;
    try {
      expect(getPaymentProvider().getProviderName()).toBe("razorpay_test");
    } finally {
      if (prev !== undefined) process.env.PAYMENT_PROVIDER = prev;
    }
  });

  it("(5) RouteProvider when PAYMENT_PROVIDER=route", () => {
    const prev = process.env.PAYMENT_PROVIDER;
    process.env.PAYMENT_PROVIDER = "route";
    try {
      expect(getPaymentProvider().getProviderName()).toBe("razorpay_route");
    } finally {
      if (prev === undefined) delete process.env.PAYMENT_PROVIDER;
      else process.env.PAYMENT_PROVIDER = prev;
    }
  });

  it("(6) route is blocked in production unless RAZORPAY_ROUTE_ENABLED is set", () => {
    const prevProvider = process.env.PAYMENT_PROVIDER;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevRouteFlag = process.env.RAZORPAY_ROUTE_ENABLED;
    process.env.PAYMENT_PROVIDER = "route";
    process.env.NODE_ENV = "production";
    delete process.env.RAZORPAY_ROUTE_ENABLED;
    try {
      expect(() => getPaymentProvider()).toThrow(/Route onboarding/);

      process.env.RAZORPAY_ROUTE_ENABLED = "1";
      expect(getPaymentProvider().getProviderName()).toBe("razorpay_route");
    } finally {
      restore("PAYMENT_PROVIDER", prevProvider);
      restore("NODE_ENV", prevNodeEnv);
      restore("RAZORPAY_ROUTE_ENABLED", prevRouteFlag);
    }
  });
});

function restore(key: string, prev: string | undefined): void {
  if (prev === undefined) delete process.env[key];
  else process.env[key] = prev;
}
