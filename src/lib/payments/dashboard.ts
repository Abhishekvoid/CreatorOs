import { getPool, type Executor } from "@/lib/db/pool";
import { getPaymentHealth, type PaymentHealth } from "./health";
import { runIntegrityChecks } from "./integrity";

/**
 * Monitoring Dashboard Data (Phase 8) — READ-ONLY aggregation composed from the
 * health service, the integrity worker, and a notification breakdown. No writes,
 * no mutations, no recovery actions.
 */

export type DashboardData = {
  funnel: PaymentHealth["funnel"];
  health: { backlog: PaymentHealth["backlog"]; lag: PaymentHealth["lag"] };
  integrity: { passed: boolean; violationCount: number };
  notifications: {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    dead_letter: number;
  };
  reconciliation: { pending: number; oldestSeconds: number | null };
};

export async function getDashboardData(db: Executor = getPool()): Promise<DashboardData> {
  const health = await getPaymentHealth(db);
  const integrity = await runIntegrityChecks(db);

  const { rows } = await db.query(`
    select
      count(*) filter (where status = 'pending')     as pending,
      count(*) filter (where status = 'processing')  as processing,
      count(*) filter (where status = 'sent')        as sent,
      count(*) filter (where status = 'failed')      as failed,
      count(*) filter (where status = 'dead_letter') as dead_letter
    from public.notification_queue
  `);
  const n = rows[0];

  return {
    funnel: health.funnel,
    health: { backlog: health.backlog, lag: health.lag },
    integrity: { passed: integrity.passed, violationCount: integrity.violations.length },
    notifications: {
      pending: Number(n.pending ?? 0),
      processing: Number(n.processing ?? 0),
      sent: Number(n.sent ?? 0),
      failed: Number(n.failed ?? 0),
      dead_letter: Number(n.dead_letter ?? 0),
    },
    reconciliation: {
      pending: health.backlog.pendingReconciliation,
      oldestSeconds: health.lag.oldestPendingReconciliationSeconds,
    },
  };
}
