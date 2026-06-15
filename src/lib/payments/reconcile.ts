import type { PoolClient } from "pg";
import { expireToReconciliation } from "@/lib/booking";
import { pgErrorCode, withTransaction } from "@/lib/db/pool";
import {
  getPaymentProvider,
  type PaymentProvider,
  type ProviderOrderStatus,
  type ProviderPaymentStatus,
} from "./provider";

/**
 * Reconciliation Sweep (Phase 6) — the correctness guarantee behind the webhook
 * fast path. For each pending_reconciliation lock whose order is still
 * unresolved, it asks the provider what actually happened and emits a
 * DETERMINISTIC reconciliation event into payment_events. It writes no business
 * truth: bookings / booking_locks / payment_orders / notification_queue are
 * never touched here. The Phase 5 processor consumes the emitted event and is
 * the sole writer that ultimately confirms or releases. Timer expiry never
 * frees a slot; only reconciliation.failed (through the processor) can.
 */

export type SweepCounts = {
  examined: number;
  captured: number;
  failed: number;
  skipped: number;
  duplicates: number;
};

type ReconTarget = {
  lock_id: string;
  booking_id: string;
  correlation_id: string;
  payment_order_id: string;
  provider_order_id: string;
  provider_payment_id: string | null;
};

type ResolvedState = "captured" | "failed" | "expired" | "unknown";

/**
 * Map provider status to a verdict. Anything not definitive stays `unknown`.
 * Exported (additively) so Phase 8 recovery can reuse the exact same
 * classification — behaviour of the sweep is unchanged.
 */
export function classifyProviderState(order: ProviderOrderStatus, payment: ProviderPaymentStatus | null): ResolvedState {
  const o = order.status?.toLowerCase();
  const p = payment?.status?.toLowerCase();
  if (p === "captured" || o === "paid" || o === "captured") return "captured";
  if (p === "failed" || o === "failed") return "failed";
  if (o === "expired" || p === "expired") return "expired";
  return "unknown";
}

/**
 * Claim the next pending_reconciliation lock whose order is still unresolved,
 * excluding lock ids already examined in this run (so an `unknown` target
 * doesn't head-of-line-block — it is retried on the next sweep cycle).
 * FOR UPDATE OF bl SKIP LOCKED lets overlapping sweeps run without contention.
 */
async function claimNextTarget(client: PoolClient, examined: string[]): Promise<ReconTarget | null> {
  const { rows } = await client.query<ReconTarget>(
    `select bl.id as lock_id, b.id as booking_id, b.correlation_id,
            po.id as payment_order_id, po.provider_order_id, po.provider_payment_id
       from public.booking_locks bl
       join public.bookings b        on b.id = bl.booking_id
       join public.payment_orders po on po.booking_id = b.id
      where bl.status = 'pending_reconciliation'
        and po.status in ('created', 'pending')
        and bl.id <> all($1::uuid[])
      order by bl.created_at
      for update of bl skip locked
      limit 1`,
    [examined],
  );
  return rows[0] ?? null;
}

type TargetOutcome = "captured" | "failed" | "skipped" | "duplicate";

export async function reconcileSweep(
  opts: { provider?: PaymentProvider; limit?: number } = {},
): Promise<SweepCounts> {
  const provider = opts.provider ?? getPaymentProvider();
  const limit = opts.limit ?? 100;
  const counts: SweepCounts = { examined: 0, captured: 0, failed: 0, skipped: 0, duplicates: 0 };
  const examined: string[] = [];

  for (let i = 0; i < limit; i++) {
    const outcome = await withTransaction<TargetOutcome | null>(async (client) => {
      const target = await claimNextTarget(client, examined);
      if (!target) return null;
      examined.push(target.lock_id);

      const order = await provider.getOrderStatus(target.provider_order_id);
      const payment = target.provider_payment_id
        ? await provider.getPaymentStatus(target.provider_payment_id)
        : null;
      const state = classifyProviderState(order, payment);
      if (state === "unknown") return "skipped"; // never guess; retry next cycle

      const resolution = state === "captured" ? "captured" : "failed";
      const eventType = `reconciliation.${resolution}`;
      const providerEventId = `recon:${target.provider_order_id}:${resolution}`;
      const payload = JSON.stringify({ order, payment, classified: state });

      try {
        await client.query(
          `insert into public.payment_events
             (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
           values ($1, 'reconciliation', $2, $3, $4, $5::jsonb)`,
          [target.correlation_id, eventType, providerEventId, target.payment_order_id, payload],
        );
        return resolution;
      } catch (err) {
        // a concurrent/earlier sweep already emitted this exact verdict
        if (pgErrorCode(err) === "23505") return "duplicate";
        throw err;
      }
    });

    if (outcome === null) break;
    counts.examined++;
    if (outcome === "captured") counts.captured++;
    else if (outcome === "failed") counts.failed++;
    else if (outcome === "skipped") counts.skipped++;
    else counts.duplicates++;
  }

  return counts;
}

export type ReconcileTickCounts = SweepCounts & { expired: number };

/**
 * One reconciliation tick = the two timer-driven steps the cron must run in
 * order: FIRST age expired holds (active → pending_reconciliation) via
 * expireToReconciliation, THEN sweep those targets against the provider.
 *
 * The reconcile cron calls THIS, never reconcileSweep directly. The sweep only
 * looks at locks already in pending_reconciliation, so without the expire step
 * an abandoned hold's lock stays `active` forever — its slot never reconciles
 * and stays permanently blocked, and the booking is stuck `payment_pending`.
 * Keeping both steps here preserves Rule 5 (timer expiry never frees a slot; it
 * only moves the lock to pending_reconciliation for the sweep + processor to
 * resolve) and keeps the route a thin adapter.
 */
export async function reconcileTick(
  opts: { provider?: PaymentProvider; limit?: number } = {},
): Promise<ReconcileTickCounts> {
  const { expired } = await expireToReconciliation();
  const counts = await reconcileSweep(opts);
  return { ...counts, expired: expired.length };
}
