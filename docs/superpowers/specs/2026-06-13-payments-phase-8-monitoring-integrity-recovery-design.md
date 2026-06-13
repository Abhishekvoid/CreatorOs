# Phase 8 — Monitoring, Integrity & Recovery (design)

Date: 2026-06-13
Branch: `feat/payments-booking`
Status: draft — awaiting review

## Purpose

Money correctness is complete (Phases 1–7). Phase 8 is the **operational layer**:
visibility, verification, monitoring, and *safe* recovery — without ever
mutating truth directly. The Processor Worker remains the sole writer of
`bookings` / `booking_locks` / `payment_orders`. All recovery flows by **creating
work** (re-queuing an event, emitting a reconciliation event, re-pending a
notification) that the existing workers consume on their own schedule.

Hard constraints (unchanged): no new payment states, no new money-moving logic,
no changes to payment-flow or booking-state transitions. Health, integrity, and
dashboard code is strictly **read-only**. Recovery code writes only to the
work/audit lanes (`payment_events.processed`, new `payment_events`,
`notification_queue`, `recovery_actions`) — never to the three truth tables.

## What already exists (reuse, do not change behaviour)

- `recovery_actions` table (schema Part 4): `id, correlation_id, actor_id,
  action_type CHECK in ('replay_event','retry_reconciliation','retry_notification'),
  target_type, target_id, reason, created_at`, plus an **append-only guard
  trigger** (UPDATE/DELETE forbidden). The CHECK already makes
  `mark_paid`/`confirm_booking`/`release_lock`/`delete_event`/`edit_event`
  unrepresentable. Phase 1 tests assert this.
- `payment_events` immutability guard allows toggling only `(processed,
  processed_at)` — exactly what a replay needs; no row is ever deleted.
- `reconcile.ts` deterministic emit + `(event_source, provider_event_id)`
  dedup; `processor.ts` state-guarded, idempotent application; the
  `PaymentProvider` injection seam.
- Cron pattern: `isCronAuthorized` / `cronUnauthorized` + `proxy.ts` blanket on
  `/api/cron/*`.

## Required schema change (additive, idempotent — Part 8)

Section D lists `performed_by` and `payload`, which the current table lacks. Add
them additively (keep the existing columns; `actor_id` stays as a legacy alias —
see decision 1):

```sql
alter table public.recovery_actions
  add column if not exists performed_by uuid,   -- operator; null = system/automated
  add column if not exists payload jsonb not null default '{}';
```

No other schema changes. `correlation_id`, `target_type`, `target_id` stay
NOT NULL (every recovery target yields all three).

## Section A — Health Service (`src/lib/payments/health.ts`)

`getPaymentHealth(): Promise<PaymentHealth>` — read-only, a handful of aggregate
queries (no writes). Shapes exactly as specified:

- `funnel`: `bookingsStarted` = `count(bookings)`; `ordersCreated` =
  `count(payment_orders)`; `paymentsCaptured` = orders `status='captured'`;
  `bookingsConfirmed` = bookings `status='confirmed'`; `notificationsQueued` =
  `count(notification_queue)`; `notificationsSent` = queue `status='sent'`.
- `backlog`: `unprocessedEvents` = events `processed=false`;
  `pendingReconciliation` = locks `status='pending_reconciliation'`;
  `pendingNotifications` = queue `status='pending'`; `deadLetterNotifications` =
  queue `status='dead_letter'`.
- `lag` (seconds, `null` when the set is empty):
  - `oldestUnprocessedEventSeconds` = `now() - min(created_at)` over
    `processed=false`.
  - `oldestPendingReconciliationSeconds` = `now() - min(expires_at)` over
    `pending_reconciliation` locks (how long overdue — decision 4).
  - `oldestPendingNotificationSeconds` = `now() - min(created_at)` over
    `pending` queue rows.

## Section B — Integrity Worker (`src/lib/payments/integrity.ts`)

`runIntegrityChecks(): Promise<{ passed: boolean; violations: IntegrityViolation[] }>`.

```ts
type IntegrityViolation = {
  check: string;        // stable id, e.g. "confirmed_booking_unconfirmed_lock"
  description: string;
  count: number;
  samples: string[];    // up to N offending ids, for triage
};
```

Each check is a read-only `select`; a check contributes a violation only when it
returns rows. `passed = violations.length === 0`.

| # | Check | Query (essence) |
|---|---|---|
| 1 | Confirmed booking w/o confirmed lock | `bookings b join booking_locks bl on bl.booking_id=b.id where b.status='confirmed' and bl.status<>'confirmed'` |
| 2 | Confirmed lock w/o confirmed booking | `booking_locks bl left join bookings b on b.id=bl.booking_id where bl.status='confirmed' and (b.id is null or b.status<>'confirmed')` |
| 3 | Captured order w/o confirmed booking | `payment_orders po join bookings b on b.id=po.booking_id where po.status='captured' and b.status<>'confirmed'` |
| 4 | Broken caused-by chain | `payment_orders po where po.status in ('captured','failed') and (po.caused_by_event_id is null or not exists (select 1 from payment_events e where e.id=po.caused_by_event_id and e.processed))` |
| 5 | Notification → missing booking | `notification_queue n left join bookings b on b.id=n.booking_id where n.booking_id is not null and b.id is null` |
| 6 | Active lock on cancelled booking | `booking_locks bl join bookings b on b.id=bl.booking_id where bl.status='active' and b.status='cancelled'` |
| 7 | Duplicate live occupancy | `booking_locks where status in ('active','pending_reconciliation','confirmed') group by creator_id, slot_start having count(*)>1` |

Check 4 reads "a processed event whose chain is broken" as: any resolved order
must carry a `caused_by_event_id` pointing at an existing, processed event (no
dangling/missing provenance). Check 7 verifies the `booking_lock_active_slot_idx`
guarantee from the data side (must always be zero).

## Section C — Integrity Cron (`/api/cron/integrity`)

Thin nodejs adapter, `isCronAuthorized` → `cronUnauthorized`, mirroring
reconcile/notifications. Body matches the spec's two shapes literally:

```jsonc
{ "passed": true,  "violations": 0 }          // healthy: count (0)
{ "passed": false, "violations": [ ... ] }     // unhealthy: the violation array
```

i.e. `violations = passed ? 0 : result.violations` (decision 5).

## Section D/E — Recovery (`src/lib/payments/recovery.ts`)

Three exports. Each runs in **one transaction**: write the `recovery_actions`
audit row, perform the action, return — atomic, so a failed action rolls back its
own audit. **None invokes the Processor inline** — recovery only *creates work*;
the Processor/Notification workers consume it on their own schedule (this is what
keeps Test 7 true: the three truth tables are untouched by a recovery call).

Common options: `{ performedBy?: string; reason?: string }`. A "not found"
target throws a new `RecoveryError` (added to `errors.ts`).

### `replayEvent(eventId, opts?)`
- Audit: `action_type='replay_event'`, `target_type='payment_event'`,
  `target_id=eventId`, `correlation_id` from the event.
- Action: `update payment_events set processed=false, processed_at=null where
  id=$1` (allowed by the immutability guard). The Processor re-claims and
  re-applies idempotently (state-guarded → no double-confirm). **No booking
  state touched here.**
- Returns `{ recoveryActionId, eventId }`.

### `retryReconciliation(orderId, opts?)`  (opts also `{ provider? }`)
- Audit: `action_type='retry_reconciliation'`, `target_type='payment_order'`,
  `target_id=orderId`, `correlation_id` from the order.
- Action: ask the provider for the order's true state and **emit a deterministic
  reconciliation event** into `payment_events` — exactly the Phase 6 contract
  (`reconciliation.{captured,failed}`, id `recon:{provider_order_id}:{resolution}`,
  `on conflict do nothing`). `unknown`/non-definitive ⇒ emit nothing (never
  guess). **It writes no `bookings`/`booking_locks`/`payment_orders`.** The
  Processor consumes the event and performs any confirm/release.
- Returns `{ recoveryActionId, emitted: 'captured'|'failed'|'none', eventId? }`.
- Classifier reused from reconcile (decision 2).

### `retryNotification(notificationId, opts?)`
- Audit: `action_type='retry_notification'`, `target_type='notification_queue'`,
  `target_id=notificationId`, `correlation_id` from the row.
- Action: `update notification_queue set status='pending', next_attempt_at=now(),
  processing_expires_at=null where id=$1`. "Moves back to pending. Nothing else."
  (attempt_count reset — decision 3.)
- Returns `{ recoveryActionId, notificationId }`.

**Forbidden actions** (`mark_paid`, `confirm_booking`, `release_lock`,
`delete_event`, `edit_event`) are not implemented and are unrepresentable in the
`action_type` CHECK. A test asserts the CHECK rejects them.

## Section F — Dashboard (`src/lib/payments/dashboard.ts`)

`getDashboardData(): Promise<DashboardData>` — read-only composition over the
above:

```ts
{
  funnel: health.funnel,
  health: { backlog: health.backlog, lag: health.lag },
  integrity: { passed: boolean; violationCount: number },   // summary of runIntegrityChecks
  notifications: { pending, processing, sent, failed, dead_letter },  // counts by status
  reconciliation: { pending: number; oldestSeconds: number | null },
}
```

No writes, no recovery calls, no mutations. (Integrity is read-only, so composing
its summary here is safe.)

## Section G — Tests (`tests/db/phase8-monitoring.test.ts`, real Postgres)

1. **Integrity clean** — seed a healthy confirmed flow (initiate → capture event
   → processor); all 7 checks return zero; `passed=true`.
2. **Corrupted booking/lock** — force a confirmed booking with a non-confirmed
   lock (direct SQL, bypassing the processor); check 1 (and/or 2) fires;
   `passed=false`.
3. **Captured order w/o confirmed booking** — force `payment_orders.status=
   'captured'` while booking stays `payment_pending`; check 3 fires.
4. **replayEvent** → a `recovery_actions` row exists (`action_type='replay_event'`)
   and the event is back to `processed=false`.
5. **retryReconciliation** (injected provider → `paid`) → `recovery_actions` row
   (`retry_reconciliation`) and a `reconciliation.captured` event emitted.
6. **retryNotification** → `recovery_actions` row (`retry_notification`) and the
   queue row back to `pending`.
7. **Recovery never mutates truth** — before/after snapshots (counts + statuses)
   of `bookings`, `booking_locks`, `payment_orders` identical across all three
   recovery calls; only work/audit lanes change.
8. **Dashboard read-only** — truth-table snapshots identical before/after
   `getDashboardData()` (and `getPaymentHealth()`, `runIntegrityChecks()`).
9. **Cron protected** — `GET /api/cron/integrity` returns 401 without
   `CRON_SECRET` (extend `tests/cron-auth.test.ts`; proxy already blankets it).

Plus a guard test: the `recovery_actions.action_type` CHECK rejects
`mark_paid`/`confirm_booking`/`release_lock`/`delete_event`/`edit_event`.

## Decisions for review

1. **recovery_actions columns** — add `performed_by` + `payload` additively and
   leave the legacy `actor_id` in place (recovery writes `performed_by`).
   Alternative: rename `actor_id → performed_by` (touches Phase 1 schema; riskier).
   Recommend additive.
2. **retryReconciliation reuses the reconcile classifier** — additively `export`
   `classifyProviderState` from `reconcile.ts` (behaviour-preserving; Phase 6
   tests stay green) rather than duplicating the map in `recovery.ts`. Recommend
   the export. Confirm it's acceptable to add an export to a Phase 6 file.
3. **retryNotification resets `attempt_count` to 0** — so an operator retry of a
   `dead_letter` row gets a fresh retry budget (otherwise it re-dead-letters on
   the next failure). The spec says "Moves back to pending. Nothing else."; I
   read "nothing else" as "no other state machine," and treat the reset as part
   of a meaningful retry. Confirm, or keep `attempt_count` untouched.
4. **Reconciliation lag** uses `now() - min(expires_at)` (overdue-ness) rather
   than `created_at`. Confirm.
5. **Integrity cron `violations` field** is polymorphic per the spec (`0` when
   healthy, array when not). Following the spec literally.

## Files

- `supabase/schema.sql` — Part 8: `recovery_actions.performed_by` + `payload` (additive)
- `src/lib/payments/health.ts` (new)
- `src/lib/payments/integrity.ts` (new)
- `src/lib/payments/recovery.ts` (new)
- `src/lib/payments/dashboard.ts` (new)
- `src/lib/payments/errors.ts` — add `RecoveryError`
- `src/lib/payments/reconcile.ts` — additively export `classifyProviderState` (decision 2)
- `src/lib/payments/index.ts` — export the new read/recovery surface
- `src/app/api/cron/integrity/route.ts` (new)
- `tests/db/phase8-monitoring.test.ts` (new)
- `tests/cron-auth.test.ts` (extend for `/api/cron/integrity`)
- no payment-flow / booking-transition / payment-state changes
```