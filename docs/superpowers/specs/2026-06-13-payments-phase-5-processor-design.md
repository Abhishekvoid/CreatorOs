# Phase 5 — Payment Processor Worker (design)

Date: 2026-06-13
Branch: `feat/payments-booking`
Status: approved, pre-implementation

## Purpose

The Processor Worker is the **sole writer of business truth**. It consumes the
immutable `payment_events` ledger and is the ONLY component permitted to mutate
`bookings`, `booking_locks`, `payment_orders`, or write `notification_queue`.

```
payment_events  ──▶  processor  ──▶  business state (+ queued notifications)
```

Out of scope (later phases): reconciliation (Phase 6), notification *delivery*
(Phase 7), monitoring (Phase 8). Phase 5 only queues notifications; it sends
nothing.

## Architecture

- `src/lib/payments/processor.ts`
  - `processPendingEvents(opts?: { limit?: number }): Promise<ProcessSummary>` —
    the worker entry point.
  - `claimNext(client)` and `applyEvent(client, event)` — the two primitives the
    loop is built from, exported so concurrency and rollback are testable at the
    seam (both are real functions used by the loop, not test-only shims).
- Reuses `confirmBooking` / `releaseLock` from `src/lib/booking/locks.ts`, which
  already perform the state-guarded booking+lock transitions and accept a
  `PoolClient` so they run inside the processor's transaction.

## Claiming (Rule 7)

One event per transaction. Claim with row locking so concurrent workers never
double-process:

```sql
select id, event_source, event_type, payment_order_id, correlation_id
  from public.payment_events
 where processed = false
   and payment_order_id is not null   -- unlinked events are left for Phase 8
 order by created_at
 for update skip locked
 limit 1;
```

`payment_order_id is not null` keeps the worker from head-of-line-blocking on an
orphan: unlinked events are never claimed, so they keep `processed=false` /
`processed_at=null` as an anomaly bucket (Phase 8 red-alert =
`processed=false and payment_order_id is null`). The processor never opens a
second resolution path — linkage stays the ingestor's responsibility.

The loop: repeatedly open a transaction, `claimNext`, `applyEvent`, commit;
stop when no claimable row remains or `limit` is reached.

## Per-event transaction (Rules 6 & 8)

For each claimed event, in ONE transaction, apply every step as a
**state-guarded** statement (never a blind update). Any throw rolls the whole
transaction back; the event stays `processed=false` for a later retry (Rule 6).

Classification — frozen `(event_source, event_type)` table:

| source | type | outcome |
|---|---|---|
| webhook | payment.captured | captured |
| webhook | order.paid | captured |
| reconciliation | reconciliation.captured | captured |
| webhook | payment.failed | failed |
| reconciliation | reconciliation.failed | failed |
| *any other pair* | — | unknown |

`unknown` ⇒ mark processed, no business transition.

### Captured flow

1. `payment_orders`: `created|pending → captured`, set `captured_at = now()` and
   `caused_by_event_id = <event.id>` (provenance), guarded on the source status.
2. `confirmBooking({ bookingId }, client)` → lock `active|pending_reconciliation
   → confirmed`, booking `payment_pending → confirmed` (both guarded).
3. Notifications — state-predicated INSERT … SELECT (see below), recipients
   creator + client, types `creator_confirmation` / `client_confirmation`.
4. `payment_events.processed = true, processed_at = now()`.

### Failed flow

1. `payment_orders`: `created|pending → failed`, set `failed_at = now()` and
   `caused_by_event_id`, guarded.
2. `releaseLock({ bookingId }, client)` → lock `active|pending_reconciliation →
   released`, booking `payment_pending → cancelled` (both guarded).
3. Notifications — `creator_cancellation` / `client_cancellation`.
4. mark processed.

`booking_id` is resolved by reading `payment_orders` (`payment_order_id` →
`booking_id`) inside the transaction.

## Notification idempotency (structural, two guarantees)

Schema delta this phase: `unique (booking_id, type)` on `notification_queue`
(recipient encoded into `type`; no new column, no expression index). Insert is
both **state-predicated** and **conflict-safe**:

```sql
insert into public.notification_queue (correlation_id, booking_id, type, channel, payload)
select b.correlation_id, b.id, 'client_confirmation', 'whatsapp', $2::jsonb
  from public.bookings b
 where b.id = $1 and b.status = 'confirmed'
on conflict (booking_id, type) do nothing;
```

- the `where b.status = 'confirmed'` predicate ties the notification to the
  single source of truth → an out-of-order FAILED-after-CAPTURED produces zero
  cancellation rows (booking isn't `cancelled`), so no contradictory message;
- `unique (booking_id, type)` + `on conflict do nothing` → replaying the same
  event inserts no duplicate pair.

No `rowCount`/control-flow gate — correctness flows from the guards and the
constraint, consistent with how locks and `payment_events` enforce invariants.
`channel = 'whatsapp'` (auto-capture WhatsApp confirmations); recipient/template
detail rides in `payload`.

## Idempotency & ordering, summarized

- **Replay** (same event ×N): every transition is guarded → no-ops after the
  first; notifications dedupe on the unique constraint → exactly one pair.
- **Out-of-order** (FAILED after CAPTURED): order guard (`created|pending`),
  booking guard (`payment_pending`), lock guard, and the notification state
  predicate all match zero rows → no downgrade, no notifications. Event is still
  marked processed (examined, no-op).
- **Auto-capture**: `payment.captured` and `order.paid` are capture-equivalent;
  whichever lands second is absorbed by the guards.

## Required tests (real local Postgres, no mocks)

1. PAYMENT_CAPTURED → booking confirmed, lock confirmed, order captured
   (+`caused_by_event_id` set), event processed.
2. PAYMENT_FAILED → booking cancelled, lock released, order failed, processed.
3. Replay PAYMENT_CAPTURED ×3 → one confirmation pair, transitions stable.
4. FAILED after CAPTURED → no downgrade (stays captured/confirmed), no
   cancellation notifications.
5. Crash before commit (throw inside the transaction) → event unprocessed,
   bookings / booking_locks / payment_orders / notification_queue all unchanged.
6. Two concurrent workers (`FOR UPDATE SKIP LOCKED`) → event processed once.
7. Unknown event → processed=true, zero business changes.
8. Captured flow inserts notification rows, but nothing is sent (queue rows only;
   `status = 'pending'`).

## Acceptance

The processor is the only component that mutates `bookings`, `booking_locks`,
`payment_orders`, or writes `notification_queue`. All truth flows
`payment_events → processor → business state`.

## Files

- `src/lib/payments/processor.ts` (new)
- `src/lib/payments/index.ts` (export `processPendingEvents`)
- `supabase/schema.sql` (`unique (booking_id, type)` on `notification_queue`)
- `tests/db/phase5-processor.test.ts` (new)
