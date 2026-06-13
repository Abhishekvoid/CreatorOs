# Phase 6 — Reconciliation Sweep (design)

Date: 2026-06-13
Branch: `feat/payments-booking`
Status: draft — awaiting review

## Purpose

Reconciliation is the **correctness guarantee** behind the webhook fast path. A
payment that succeeds but whose webhook never arrives must still converge to the
truth. The sweep asks the provider what actually happened and emits a
**deterministic reconciliation event**; it never writes business truth itself.

```
expireToReconciliation (timer)  ─▶  lock: active → pending_reconciliation
reconciliation sweep            ─▶  ask provider ─▶ emit reconciliation.{captured,failed}
processor worker (Phase 5)      ─▶  consume event ─▶ confirm / release  (SOLE writer)
```

The sweep writes **only** `payment_events`. It never touches `bookings`,
`booking_locks`, `payment_orders`, or `notification_queue`. The Phase 5
Processor Worker remains the sole writer of truth — and it already classifies
`(reconciliation, reconciliation.captured)` → captured and
`(reconciliation, reconciliation.failed)` → failed, so Phase 6 only has to emit.

## Invariants obeyed (from Phase 1–5)

- **Rule 5 / lock-release:** timer expiry NEVER frees a slot. A lock leaves
  `pending_reconciliation` only when a `reconciliation.failed` event flows
  through the processor. The sweep itself never releases a lock.
- **Sole writer:** all `bookings`/`booking_locks`/`payment_orders`/
  `notification_queue` mutation stays in the processor.
- **Structural dedup:** duplicate emissions collide on
  `payment_events unique(event_source, provider_event_id)` and become no-ops.
- **Provider boundary:** only `src/lib/payments/providers/*` import the Razorpay
  SDK; the sweep depends on the `PaymentProvider` interface only.

## Architecture

- `src/lib/payments/reconcile.ts`
  - `reconcileSweep(opts?: { provider?: PaymentProvider; limit?: number }): Promise<SweepCounts>`
  - internal: target claim query, `classifyProviderState`, deterministic emit.
- `src/app/api/cron/reconcile/route.ts` — thin HTTP adapter; invokes the sweep,
  returns counts. No business logic, no SQL.
- `getPaymentProvider()` default; tests inject a `provider` double (same seam as
  Phase 3 `initiate(input, { provider })`).

### Target set & claiming

```sql
select bl.id as lock_id, b.id as booking_id, b.correlation_id,
       po.id as payment_order_id, po.provider_order_id, po.provider_payment_id
  from public.booking_locks bl
  join public.bookings b        on b.id = bl.booking_id
  join public.payment_orders po on po.booking_id = b.id
 where bl.status = 'pending_reconciliation'
   and po.status in ('created', 'pending')      -- still unresolved
   and bl.id <> all($1::uuid[])                 -- exclude already-examined this run
 order by bl.created_at
 for update of bl skip locked
 limit 1;
```

- `FOR UPDATE OF bl SKIP LOCKED` lets overlapping sweep executions run without
  double-claiming a lock row.
- The `<> all($examined)` exclusion prevents head-of-line-blocking inside one
  sweep: an `unknown` target is left untouched but not re-selected this run
  (it is retried on the *next* sweep cycle). Mirrors how the processor avoids
  re-scanning unlinked events.

### Per-target transaction

One transaction per target (claim → provider query → emit). Loop until no
claimable target remains or `limit` is reached. The provider call happens inside
the transaction; volumes are low (cron), and the deterministic event id makes
even a redundant call harmless.

### Provider query & classification (Requirement 2 & 4)

Through the abstraction only:

```
order   = await provider.getOrderStatus(provider_order_id)
payment = provider_payment_id ? await provider.getPaymentStatus(provider_payment_id) : null
```

`classifyProviderState(order, payment) → 'captured' | 'failed' | 'expired' | 'unknown'`:

| provider signal | result |
|---|---|
| payment.status `captured`, or order.status `paid`/`captured` | captured |
| payment.status `failed`, or order.status `failed` | failed |
| order/payment status `expired` | expired |
| anything else (`created`, `attempted`, `authorized`, …) | unknown |

`unknown` ⇒ **leave untouched, no event, retry next sweep. Never guess.**

### Deterministic emission (Requirement 3 & 6)

| classified | event_type | provider_event_id |
|---|---|---|
| captured | `reconciliation.captured` | `recon:{provider_order_id}:captured` |
| failed | `reconciliation.failed` | `recon:{provider_order_id}:failed` |
| expired | `reconciliation.failed` | `recon:{provider_order_id}:failed` |

Insert into `payment_events`: `event_source='reconciliation'`, the type/id above,
`payment_order_id` set (so the processor claims it), `correlation_id` from the
booking, `payload` = a snapshot of the provider response. On `23505` (duplicate
sweep) → swallow, count as `duplicate`. Repeated reconciliation of the same
order/status therefore yields exactly one row.

### Counts returned

`SweepCounts = { examined, captured, failed, skipped, duplicates }`
- `examined`: targets claimed and inspected
- `captured` / `failed`: new reconciliation events emitted
- `skipped`: unknown provider state (left for next cycle)
- `duplicates`: emission collided on the unique constraint (harmless no-op)

### Endpoint (Requirement 6)

`GET /api/cron/reconcile` (`runtime = "nodejs"`): calls `reconcileSweep()`,
returns the counts as JSON. It invokes only the sweep — the Processor Worker
runs on its own (Phase 5) and consumes emitted events; chaining the two is out of
scope for this endpoint per Requirement 6. No SQL, no business logic in the
route.

## Decisions (resolved in review)

1. **TestModeProvider.getOrderStatus / getPaymentStatus — implement now.**
   Wire both to the Razorpay SDK (`orders.fetch` / `payments.fetch`) when keys
   are configured, returning the provider's status token (the classifier reads
   `paid`/`captured`/`failed`/`expired`/…). Keyless mode cannot reconcile a
   synthetic order, so it throws `NotImplementedError`. This keyed integration
   path is **not** exercised by the test suite (no Razorpay keys in CI) — the
   sweep logic is proven via an injected provider double instead. Stated openly.
2. **Endpoint scope — sweep only.** `/api/cron/reconcile` invokes
   `reconcileSweep()` and returns its counts; the Processor Worker runs on its
   own schedule and consumes emitted events. Matches Requirement 6 literally.

## Tests (real local Postgres, no mocks; injected provider double)

1. **Missing-webhook recovery:** booking `payment_pending`, lock
   `pending_reconciliation`, provider → captured ⇒ sweep emits
   `reconciliation.captured`; processor consumes ⇒ booking `confirmed`, lock
   `confirmed`.
2. **Verified failure release:** provider → failed ⇒ sweep emits
   `reconciliation.failed`; processor consumes ⇒ lock `released`, booking
   `cancelled`.
3. **Overlapping sweeps:** run the sweep twice ⇒ exactly one reconciliation
   event (second is a `duplicate`).
4. **Unknown provider state:** provider → `attempted` ⇒ no event emitted, order
   still unresolved, lock still `pending_reconciliation`.
5. **Sweep never writes truth:** before/after counts of `bookings`,
   `booking_locks`, `payment_orders`, `notification_queue` unchanged across a
   sweep; only `payment_events` grows.
6. **Deterministic ids:** reconciling the same order/status repeatedly produces
   exactly one event row (deterministic `provider_event_id`).
7. **EXPIRED → reconciliation.failed** (state-rule coverage).

## Acceptance

A successful payment whose webhook never arrives becomes `confirmed` via
Sweep → `reconciliation.captured` → Processor Worker. A payment may remain
unresolved (unknown). A payment is never guessed.

## Files

- `src/lib/payments/reconcile.ts` (new)
- `src/app/api/cron/reconcile/route.ts` (new)
- `src/lib/payments/providers/test-mode.ts` (implement status methods — pending decision 1)
- `src/lib/payments/index.ts` (export `reconcileSweep`)
- `tests/db/phase6-reconcile.test.ts` (new)
- no schema changes
