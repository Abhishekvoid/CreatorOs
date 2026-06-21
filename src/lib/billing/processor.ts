import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db/pool";

/**
 * Billing Processor — the subscription analogue of the payments processor, and
 * the SOLE writer of subscription truth. It consumes the immutable
 * billing_events ledger and is the only component (besides the upgrade action's
 * initial 'pending' insert) permitted to mutate subscriptions / profiles.plan.
 *
 * Each event is applied in ONE transaction with state-guarded statements; any
 * failure rolls the whole transaction back and leaves the event unprocessed for
 * a later retry. Replays and out-of-order deliveries are absorbed by the guards
 * (status guards + a never-regress GREATEST on current_period_end).
 *
 * INVARIANT: every transition syncs profiles.plan ← subscriptions.plan inside
 * the same transaction, so the denormalized hot-path cache can never drift from
 * the source of truth.
 */

export type ClaimableBillingEvent = {
  id: string;
  event_type: string;
  razorpay_subscription_id: string;
  payload: { payload?: { subscription?: { entity?: { current_end?: unknown } } } };
};

type Transition = "activate" | "charge" | "fail" | "cancel" | "unknown";

/** Frozen event_type → transition map. Everything else is a no-op (mark processed). */
function classify(eventType: string): Transition {
  switch (eventType) {
    case "subscription.activated":
      return "activate";
    case "subscription.charged":
      return "charge";
    case "subscription.cancelled":
      return "cancel";
    case "payment.failed":
      return "fail";
    default:
      return "unknown";
  }
}

/** current_end (unix seconds) from the event payload, when Razorpay sends it. */
function periodEndEpoch(event: ClaimableBillingEvent): number | null {
  const v = event.payload?.payload?.subscription?.entity?.current_end;
  return typeof v === "number" ? v : null;
}

/**
 * Claim the oldest unprocessed, LINKED billing event (one whose subscription id
 * is known) with a row lock. FOR UPDATE SKIP LOCKED guarantees at-most-one
 * worker claims any given event.
 */
export async function claimNextBilling(client: PoolClient): Promise<ClaimableBillingEvent | null> {
  const { rows } = await client.query<ClaimableBillingEvent>(
    `select id, event_type, razorpay_subscription_id, payload
       from public.billing_events
      where processed = false
        and razorpay_subscription_id is not null
      order by created_at
      for update skip locked
      limit 1`,
  );
  return rows[0] ?? null;
}

async function markProcessed(client: PoolClient, eventId: string): Promise<void> {
  await client.query(
    `update public.billing_events set processed = true, processed_at = now() where id = $1`,
    [eventId],
  );
}

/** Sync the denormalized profiles.plan cache to the subscription's plan (same txn). */
async function syncProfilePlan(client: PoolClient, subId: string): Promise<void> {
  await client.query(
    `update public.profiles p set plan = s.plan
       from public.subscriptions s
      where s.razorpay_subscription_id = $1 and p.id = s.creator_id`,
    [subId],
  );
}

/**
 * Apply one claimed billing event inside the caller's transaction. Every write
 * is state-guarded so re-applying (or applying a superseded event) is a no-op.
 */
export async function applyBillingEvent(client: PoolClient, event: ClaimableBillingEvent): Promise<Transition> {
  const transition = classify(event.event_type);
  const subId = event.razorpay_subscription_id;

  // linked subscription must exist (it was created by the upgrade action). If
  // it vanished, don't crash the worker — mark processed and move on.
  const { rows } = await client.query<{ id: string }>(
    `select id from public.subscriptions where razorpay_subscription_id = $1`,
    [subId],
  );
  if (!rows[0] || transition === "unknown") {
    await markProcessed(client, event.id);
    return rows[0] ? "unknown" : "unknown";
  }

  const newEnd = periodEndEpoch(event);

  if (transition === "activate" || transition === "charge") {
    // grant/keep Pro; never resurrect a lapsed (expired) subscription; never
    // regress current_period_end on an out-of-order delivery.
    await client.query(
      `update public.subscriptions
          set status = 'active',
              plan = 'pro',
              current_period_end = greatest(
                coalesce(current_period_end, to_timestamp(0)),
                coalesce(to_timestamp($2::double precision), current_period_end, to_timestamp(0))
              ),
              updated_at = now()
        where razorpay_subscription_id = $1
          and status <> 'expired'`,
      [subId, newEnd],
    );
  } else if (transition === "fail") {
    // a charge failed → past_due; KEEP plan='pro' through dunning. Don't touch a
    // terminal (cancelled/expired) subscription.
    await client.query(
      `update public.subscriptions
          set status = 'past_due', updated_at = now()
        where razorpay_subscription_id = $1
          and status in ('pending', 'trial', 'active', 'past_due')`,
      [subId],
    );
  } else {
    // cancel → mark cancelled and flag cancel-at-period-end, but KEEP plan='pro'
    // until the period actually lapses (the reconciliation sweep downgrades).
    await client.query(
      `update public.subscriptions
          set status = 'cancelled', cancel_at_period_end = true, updated_at = now()
        where razorpay_subscription_id = $1
          and status in ('pending', 'trial', 'active', 'past_due')`,
      [subId],
    );
  }

  await syncProfilePlan(client, subId);
  await markProcessed(client, event.id);
  return transition;
}

export type BillingProcessSummary = { processed: number };

/**
 * Drain claimable billing events, one transaction per event, up to `limit`.
 * Safe to run from multiple workers concurrently (SKIP LOCKED).
 */
export async function processPendingBillingEvents(opts: { limit?: number } = {}): Promise<BillingProcessSummary> {
  const limit = opts.limit ?? 100;
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const claimed = await withTransaction(async (client) => {
      const event = await claimNextBilling(client);
      if (!event) return false;
      await applyBillingEvent(client, event);
      return true;
    });
    if (!claimed) break;
    processed++;
  }
  return { processed };
}

export type BillingReconcileSummary = { expired: number };

/**
 * Reconciliation sweep — the safety net no webhook provides: flip a
 * subscription to expired/free ONLY once its paid period has actually lapsed.
 * This is what downgrades a cancelled creator (who keeps Pro until period end)
 * and catches an active/past_due subscription whose renewal never charged.
 * Both tables move atomically in one data-modifying CTE.
 */
export async function reconcileBillingExpiries(): Promise<BillingReconcileSummary> {
  const { rows } = await withTransaction((client) =>
    client.query<{ creator_id: string }>(
      `with lapsed as (
         update public.subscriptions
            set status = 'expired', plan = 'free', updated_at = now()
          where status in ('active', 'past_due', 'cancelled')
            and current_period_end is not null
            and current_period_end < now()
          returning creator_id
       )
       update public.profiles p set plan = 'free'
         from lapsed l
        where p.id = l.creator_id
        returning p.id as creator_id`,
    ),
  );
  return { expired: rows.length };
}
