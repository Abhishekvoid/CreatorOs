import { randomUUID } from "node:crypto";
import { acquireLock, releaseLock } from "@/lib/booking";
import { getPool, withTransaction } from "@/lib/db/pool";
import { OrderCreationError } from "./errors";
import { getPaymentProvider, type PaymentProvider, type ProviderOrder } from "./provider";

/**
 * Payment Orchestrator. Initiates a booking flow:
 *   1. generate correlation_id
 *   2. create booking row            ┐ one transaction — succeed together,
 *   3. acquire lock (Booking Service)┘ so a lost slot race leaves no orphans
 *   4. create provider order         (AFTER the tx; compensate on failure)
 *   5. insert payment_orders (status=created)
 *   6. return checkout payload
 *
 * It does NOTHING else: no payment/booking confirmation, no lock-status
 * change, no payment_events, no notifications, no webhooks. Those are later
 * phases.
 */

export type InitiateInput = {
  creatorId: string;
  serviceId?: string | null;
  slotStart: string; // ISO timestamptz
  slotEnd: string; // ISO timestamptz
  amountPaise: number;
  currency?: string;
  customer?: { name?: string; email?: string; phone?: string };
};

export type CheckoutPayload = {
  correlationId: string;
  bookingId: string;
  paymentOrderId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  providerName: string;
};

export async function initiate(
  input: InitiateInput,
  opts: { provider?: PaymentProvider } = {},
): Promise<CheckoutPayload> {
  const provider = opts.provider ?? getPaymentProvider();
  const correlationId = randomUUID();
  const currency = input.currency ?? "INR";

  // (2)+(3) booking + lock, atomically. acquireLock throws SlotUnavailableError
  // on a duplicate live slot (23505); the throw rolls the whole tx back, so the
  // just-inserted booking never persists — no orphan booking, no orphan lock.
  const bookingId = await withTransaction(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `insert into public.bookings
         (correlation_id, creator_id, service_id, slot_start, slot_end,
          amount_paise, currency, customer_name, customer_email, customer_phone)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id`,
      [
        correlationId,
        input.creatorId,
        input.serviceId ?? null,
        input.slotStart,
        input.slotEnd,
        input.amountPaise,
        currency,
        input.customer?.name ?? null,
        input.customer?.email ?? null,
        input.customer?.phone ?? null,
      ],
    );
    const id = rows[0].id;
    await acquireLock(
      { creatorId: input.creatorId, slotStart: input.slotStart, slotEnd: input.slotEnd, bookingId: id, correlationId },
      c,
    );
    return id;
  });

  // (4) provider order — strictly after the booking+lock tx commits. On
  // failure, compensate (release lock -> released, booking -> cancelled) and
  // surface a domain error. No payment_orders row is written.
  let order: ProviderOrder;
  try {
    order = await provider.createOrder({ amountPaise: input.amountPaise, currency, correlationId, receipt: bookingId });
  } catch (err) {
    await releaseLock({ bookingId });
    throw new OrderCreationError(correlationId, err);
  }

  // (5) payment_orders row — status 'created', carrying the same correlation_id
  const { rows } = await getPool().query<{ id: string }>(
    `insert into public.payment_orders
       (correlation_id, booking_id, provider, provider_order_id, amount_paise, currency, status)
     values ($1, $2, $3, $4, $5, $6, 'created')
     returning id`,
    [correlationId, bookingId, provider.getProviderName(), order.orderId, input.amountPaise, currency],
  );

  // (6) checkout payload — nothing else
  return {
    correlationId,
    bookingId,
    paymentOrderId: rows[0].id,
    orderId: order.orderId,
    amountPaise: order.amountPaise,
    currency: order.currency,
    providerName: provider.getProviderName(),
  };
}
