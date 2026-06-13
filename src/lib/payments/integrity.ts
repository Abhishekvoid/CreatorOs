import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Integrity Worker (Phase 8) — READ-ONLY. A set of invariant checks that must
 * each return zero rows on a correct system. A check contributes a violation
 * only when it returns rows; the system is `passed` iff there are none. It
 * performs no writes — it verifies, it never repairs.
 */

export type IntegrityViolation = {
  /** stable identifier for the invariant */
  check: string;
  description: string;
  count: number;
  /** up to 10 offending keys, for triage */
  samples: string[];
};

/**
 * Each check selects offending rows aliased to a single text `key`. They encode
 * the invariants frozen in Phases 1–7; check 7 verifies the
 * booking_lock_active_slot_idx guarantee from the data side.
 */
const CHECKS: Array<{ check: string; description: string; sql: string }> = [
  {
    check: "confirmed_booking_unconfirmed_lock",
    description: "A confirmed booking whose lock is not confirmed.",
    sql: `select b.id::text as key
            from public.bookings b
            join public.booking_locks bl on bl.booking_id = b.id
           where b.status = 'confirmed' and bl.status <> 'confirmed'`,
  },
  {
    check: "confirmed_lock_unconfirmed_booking",
    description: "A confirmed lock with no confirmed booking.",
    sql: `select bl.id::text as key
            from public.booking_locks bl
            left join public.bookings b on b.id = bl.booking_id
           where bl.status = 'confirmed' and (b.id is null or b.status <> 'confirmed')`,
  },
  {
    check: "captured_order_unconfirmed_booking",
    description: "A captured order whose booking is not confirmed.",
    sql: `select po.id::text as key
            from public.payment_orders po
            join public.bookings b on b.id = po.booking_id
           where po.status = 'captured' and b.status <> 'confirmed'`,
  },
  {
    check: "broken_caused_by_chain",
    description: "A resolved order without a valid processed caused_by event.",
    sql: `select po.id::text as key
            from public.payment_orders po
           where po.status in ('captured', 'failed')
             and (po.caused_by_event_id is null
                  or not exists (
                    select 1 from public.payment_events e
                     where e.id = po.caused_by_event_id and e.processed))`,
  },
  {
    check: "notification_missing_booking",
    description: "A notification referencing a booking that does not exist.",
    sql: `select n.id::text as key
            from public.notification_queue n
            left join public.bookings b on b.id = n.booking_id
           where n.booking_id is not null and b.id is null`,
  },
  {
    check: "active_lock_cancelled_booking",
    description: "An active lock whose booking is cancelled.",
    sql: `select bl.id::text as key
            from public.booking_locks bl
            join public.bookings b on b.id = bl.booking_id
           where bl.status = 'active' and b.status = 'cancelled'`,
  },
  {
    check: "duplicate_live_occupancy",
    description: "More than one live lock for the same creator + slot.",
    sql: `select (creator_id::text || '@' || slot_start::text) as key
            from public.booking_locks
           where status in ('active', 'pending_reconciliation', 'confirmed')
           group by creator_id, slot_start
          having count(*) > 1`,
  },
];

export async function runIntegrityChecks(
  db: Executor = getPool(),
): Promise<{ passed: boolean; violations: IntegrityViolation[] }> {
  const violations: IntegrityViolation[] = [];
  for (const { check, description, sql } of CHECKS) {
    const { rows } = await db.query<{ key: string }>(sql);
    if (rows.length > 0) {
      violations.push({
        check,
        description,
        count: rows.length,
        samples: rows.slice(0, 10).map((r) => r.key),
      });
    }
  }
  return { passed: violations.length === 0, violations };
}
