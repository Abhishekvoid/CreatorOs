import { getPool } from "@/lib/db/pool";
import { getBillingProvider, type BillingProvider } from "./provider";

/**
 * Subscription lifecycle actions a creator triggers: start a Pro upgrade and
 * cancel. These WRITE the subscriptions row's initial 'pending' state (the
 * created-but-not-activated marker) and the Razorpay subscription id; the
 * billing processor owns every subsequent transition (pending → active →
 * expired). Entitlement (plan='pro') is granted ONLY by the processor on
 * subscription.activated — never optimistically here.
 *
 * Decision D (money safety): a double-click must never create two Razorpay
 * subscriptions. Two guards: a per-creator transaction advisory lock serializes
 * concurrent calls, and inside it we re-check for an in-flight ('pending') or
 * live ('active') subscription and short-circuit. creator_id UNIQUE on
 * subscriptions is the database-level backstop.
 */

export type UpgradeResult = {
  status: "created" | "existing";
  subscriptionId: string;
  /** hosted Razorpay checkout URL (null when reusing an in-flight subscription) */
  checkoutUrl: string | null;
};

/** Razorpay plan id for Pro. Must be configured in any environment that bills. */
function proPlanId(): string {
  return process.env.RAZORPAY_PRO_PLAN_ID ?? "";
}

export async function startProUpgrade(
  creatorId: string,
  opts: { provider?: BillingProvider } = {},
): Promise<UpgradeResult> {
  const provider = opts.provider ?? getBillingProvider();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    // serialize concurrent upgrades for THIS creator (double-click / double-tab)
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [creatorId]);

    // Decision D guard: an in-flight or live subscription short-circuits — never
    // create a second Razorpay subscription.
    const { rows: existing } = await client.query<{ razorpay_subscription_id: string | null; status: string }>(
      `select razorpay_subscription_id, status from public.subscriptions where creator_id = $1`,
      [creatorId],
    );
    const current = existing[0];
    if (current?.razorpay_subscription_id && (current.status === "pending" || current.status === "active")) {
      await client.query("commit");
      return { status: "existing", subscriptionId: current.razorpay_subscription_id, checkoutUrl: null };
    }

    // create at Razorpay, then persist the 'pending' row (plan stays 'free' until
    // the activated webhook grants Pro). Re-subscription after expiry/cancel
    // overwrites the prior row via ON CONFLICT (creator_id).
    const sub = await provider.createSubscription({ planId: proPlanId(), creatorId });
    await client.query(
      `insert into public.subscriptions
         (creator_id, razorpay_subscription_id, razorpay_plan_id, status, plan)
       values ($1, $2, $3, 'pending', 'free')
       on conflict (creator_id) do update
         set razorpay_subscription_id = excluded.razorpay_subscription_id,
             razorpay_plan_id = excluded.razorpay_plan_id,
             status = 'pending',
             plan = 'free',
             current_period_end = null,
             cancel_at_period_end = false,
             updated_at = now()`,
      [creatorId, sub.subscriptionId, proPlanId()],
    );
    await client.query("commit");
    return { status: "created", subscriptionId: sub.subscriptionId, checkoutUrl: sub.shortUrl };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Bare cancel (V1): tell Razorpay to stop charging at cycle end. No dunning,
 * winback, or cancel-at-period-end UX. When Razorpay stops charging, the daily
 * expiry sweep downgrades the creator to free once current_period_end passes;
 * the subscription.cancelled webhook (if sent) is handled by the processor.
 */
export async function cancelPro(
  creatorId: string,
  opts: { provider?: BillingProvider } = {},
): Promise<{ status: "requested" | "noop" }> {
  const provider = opts.provider ?? getBillingProvider();
  const { rows } = await getPool().query<{ razorpay_subscription_id: string | null }>(
    `select razorpay_subscription_id from public.subscriptions
      where creator_id = $1 and status in ('pending', 'active')`,
    [creatorId],
  );
  const subscriptionId = rows[0]?.razorpay_subscription_id;
  if (!subscriptionId) return { status: "noop" };
  await provider.cancelSubscription({ subscriptionId, atCycleEnd: true });
  return { status: "requested" };
}
