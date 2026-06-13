# Phase 7 — Notification Worker (design)

Date: 2026-06-13
Branch: `feat/payments-booking`
Status: draft — awaiting review

## Purpose

Notification delivery is **downstream of truth**. Money correctness (bookings,
booking_locks, payment_orders, payment_events, reconciliation) is already solved
in Phases 1–6.1. This phase solves only **eventual notification delivery**: drain
the `notification_queue` rows the Processor Worker enqueues, hand each to a
pluggable provider, and drive a retry/dead-letter state machine — without ever
touching business truth.

```
payment_events
   ↓  Processor Worker (Phase 5, SOLE writer of truth) — enqueues
notification_queue
   ↓  Notification Worker (Phase 7) — claims, sends, retries
Notification Provider (Console for now)
   ↓
sent / pending(retry) / dead_letter
```

The Notification Worker is **NOT** a source of truth. A provider outage may delay
notifications; it may never affect payment/booking confirmation or lock state.

## What already exists (do not change)

- `public.notification_queue` (schema.sql) already has: `id`, `correlation_id`,
  `booking_id`, `type`, `channel` (`whatsapp|email`), `payload`, `status`
  (`pending|processing|sent|failed|dead_letter`), `attempt_count`,
  `processing_expires_at`, `next_attempt_at` (default `now()`), `sent_at`,
  `created_at`.
- Claimable index `notification_queue_claimable_idx (next_attempt_at) where
  status in ('pending','processing')`.
- Identity unique index `(booking_id, type)` — the Processor's re-enqueue on a
  replayed event is already a structural no-op. The worker never inserts, so
  "retries don't create new rows" holds by construction.
- The Phase 5 Processor enqueues four rows per resolved booking
  (`creator_/client_` × `confirmation/cancellation`), channel `whatsapp`. The
  worker treats `type`/`payload` opaquely.

## Required schema change (additive, idempotent — the only one)

Requirement 5 mandates persisting `last_error`; the column does not exist yet.
Add a small **Part 7** block to `supabase/schema.sql`:

```sql
alter table public.notification_queue
  add column if not exists last_error text;

-- reaper lookup: stuck 'processing' rows past their lease
create index if not exists notification_queue_stuck_idx
  on public.notification_queue (processing_expires_at) where status = 'processing';
```

No other Phase 1–6.1 schema or behaviour changes.

## Architecture

```
src/lib/notifications/provider.ts   -- NotificationProvider interface + ConsoleNotificationProvider
src/lib/notifications/worker.ts     -- processNotifications, reapStuckNotifications
src/app/api/cron/notifications/route.ts -- thin adapter, CRON_SECRET-protected
src/lib/notifications/index.ts      -- public surface (optional, mirrors payments/index.ts)
```

Mirrors the Phase 5/6 shape: a claiming worker over Postgres via
`@/lib/db/pool` (`withTransaction`, `pgErrorCode`), a thin nodejs cron route
guarded by the existing `isCronAuthorized` / `cronUnauthorized`, and a provider
injected for tests (the Phase 6 `reconcileSweep({ provider })` seam).

### 1. Provider boundary (`provider.ts`)

```ts
export type NotificationMessage = {
  id: string;
  correlationId: string;
  bookingId: string | null;
  type: string;
  channel: "whatsapp" | "email";
  payload: Record<string, unknown>;
};

export type NotificationResult =
  | { ok: true }
  | { ok: false; error: string };

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<NotificationResult>;
}

export class ConsoleNotificationProvider implements NotificationProvider { /* logs, returns { ok: true } */ }

export function getNotificationProvider(): NotificationProvider; // Console today
```

No WhatsApp / Meta SDK. Future providers (WhatsApp Cloud API, email) plug into
the interface only — same boundary discipline as `PaymentProvider`. A provider
may throw or return `{ ok: false }`; both are treated as a delivery failure by
the worker (the worker never lets a provider error escape into truth).

### 2 + 3 + 5. Worker & state machine (`worker.ts`)

State machine (rows are **never deleted**):

```
pending → processing → sent
pending → processing → failed → pending   (reschedule, backoff)
pending → processing → dead_letter         (attempts exhausted)
```

Delivery is split into **two committed transactions with the provider call in
between, outside any held lock** — this is what guarantees a provider outage
never holds a DB lock on truth-adjacent rows:

1. **Claim + lease (txn 1).** One atomic statement:

   ```sql
   with claimed as (
     select id from public.notification_queue
      where status = 'pending' and next_attempt_at <= now()
      order by next_attempt_at
      for update skip locked
      limit 1
   )
   update public.notification_queue q
      set status = 'processing',
          processing_expires_at = now() + interval '120 seconds'
     from claimed
    where q.id = claimed.id
   returning q.id, q.type, q.channel, q.payload, q.booking_id,
             q.correlation_id, q.attempt_count;
   ```

   `FOR UPDATE SKIP LOCKED` means concurrent workers never claim the same row.
   `attempt_count` is **not** incremented here (see decision 1).

2. **Send.** `await provider.send(message)` — outside any transaction.

3. **Record outcome (txn 2),** every write guarded by `where id = $1 and status
   = 'processing'` so a reaped/concurrently-changed row is never clobbered:
   - **success** → `status='sent', sent_at=now(), processing_expires_at=null,
     last_error=null`.
   - **failure** → `attempt_count = attempt_count + 1`, then:
     - if a backoff delay exists for the new `attempt_count` →
       `status='pending', next_attempt_at = now() + delay, last_error=$err,
       processing_expires_at=null` (**failed → pending**),
     - else → `status='dead_letter', last_error=$err,
       processing_expires_at=null`.

`processNotifications(opts?: { limit?: number; provider?: NotificationProvider })`
loops claim→send→record up to `limit` (default 100, mirrors the processor) until
no claimable row remains. Returns `{ processed, sent, failed, dead_letter }`.

> Signature note (decision 3): the requirement reads `processNotifications(limit?)`.
> I follow the established Phase 6 `reconcileSweep(opts?)` convention so tests can
> inject a provider double, keeping `limit` optional. Flagged for review.

### Retry policy (Requirement 5)

```ts
const BACKOFF_MINUTES = [1, 5, 15, 60]; // indexed by the just-failed attempt
```

| failed `attempt_count` | action |
|---|---|
| 1 | pending, +1 min |
| 2 | pending, +5 min |
| 3 | pending, +15 min |
| 4 | pending, +60 min |
| 5 (no delay left) | **dead_letter** |

`last_error`, `attempt_count`, `next_attempt_at` are persisted on every failure.

### 4. Timeout recovery (`reapStuckNotifications`)

```sql
update public.notification_queue
   set status = 'pending', processing_expires_at = null
 where status = 'processing' and processing_expires_at < now()
returning id;
```

Returns `{ requeued }`. A worker that crashes after claim (txn 1) but before
recording an outcome (txn 2) leaves a `processing` row; once its lease expires
the reaper returns it to `pending` and it is retried. Because `attempt_count` is
incremented only on a *recorded* failure (decision 1), a crash does **not**
consume a retry — notifications are never stranded forever, and never
prematurely dead-lettered by a crash loop.

### 6. Cron endpoint (`/api/cron/notifications`)

Thin nodejs adapter, identical shape to `/api/cron/reconcile`: guard with
`isCronAuthorized` → `cronUnauthorized`, else reap then process and merge counts.
Already blanket-protected by `proxy.ts` (`/api/cron/:path*`).

```jsonc
// 200
{ "processed": 0, "sent": 0, "failed": 0, "dead_letter": 0, "requeued": 0 }
```

`requeued` comes from `reapStuckNotifications()` (run first); the rest from
`processNotifications()`. No SQL, no business logic in the route.

### 7. Hard invariant

The worker's only SQL targets `public.notification_queue` (claim/lease, outcome,
reap). It never references `bookings`, `booking_locks`, `payment_orders`, or
`payment_events`. Proven by test 6 below (count + status snapshots unchanged).

## Tests (real local Postgres, no mocks; injected provider double) — `tests/db/phase7-notifications.test.ts`

A `seedQueued()` helper seeds a creator + booking and inserts one `pending`
`notification_queue` row. A `fakeProvider(...)` double returns `{ ok: true }`,
`{ ok: false, error }`, or throws, per test.

1. **Success path** — pending → `processNotifications` → `sent`, `sent_at` set,
   counts `{ processed:1, sent:1 }`.
2. **Retry path** — failing provider → row back to `pending`,
   `attempt_count=1`, `next_attempt_at ≈ now()+1min`, `last_error` set,
   counts `{ failed:1 }`. (A second cycle won't reclaim it until due — assert
   `next_attempt_at` in the future.)
3. **Dead-letter path** — drive failures past the schedule (force
   `attempt_count`/`next_attempt_at`) until the 5th failed attempt →
   `dead_letter`, counts `{ dead_letter:1 }`; row still present.
4. **Crash recovery** — claim+lease one row (txn 1 only), backdate
   `processing_expires_at`, `reapStuckNotifications()` → row `pending`,
   `attempt_count` unchanged, `{ requeued:1 }`.
5. **Duplicate workers** — two pg clients each `begin` + run the claim CTE on a
   single pending row; exactly one gets the row, the other gets zero
   (FOR UPDATE SKIP LOCKED).
6. **Truth isolation** — snapshot row counts + statuses of `bookings`,
   `booking_locks`, `payment_orders`, `payment_events` before/after a full
   reap+process cycle (incl. a failure and a dead-letter); all unchanged. Only
   `notification_queue` mutates.
7. **Queue replay** — across multiple process/retry cycles the
   `notification_queue` row count is constant; the worker only `update`s, never
   `insert`s. (Complements the Processor's identity-index no-op.)

Cron auth for the new route is covered by extending `tests/cron-auth.test.ts`
(401 without credentials; `proxy` already blankets `/api/cron/*`).

## Decisions for review

1. **`attempt_count` increments on recorded failure, not on claim** — so a
   crash (reaped) costs no retry. Trade-off: `attempt_count` counts failed
   deliveries, so a first-try success leaves it `0`.
2. **Max attempts = 5 sends** — `BACKOFF_MINUTES = [1,5,15,60]` defines four
   retry delays; the 5th failed attempt (no remaining delay) dead-letters. This
   reads the schedule literally ("Attempt 4 → +60 min", then dead_letter).
   Alternative: dead-letter after 4 attempts (3 delays). Confirm.
3. **`processNotifications(opts?)`** object signature vs positional `limit?` —
   chosen for provider injection, consistent with `reconcileSweep`.
4. **Processing lease = 120s** (`processing_expires_at`). Configurable constant;
   must exceed worst-case provider latency.
5. **Channel** stays as-enqueued (`whatsapp`); Console provider ignores it.

## Files

- `supabase/schema.sql` — add Part 7: `last_error` column + reaper index (additive)
- `src/lib/notifications/provider.ts` (new)
- `src/lib/notifications/worker.ts` (new)
- `src/lib/notifications/index.ts` (new, optional public surface)
- `src/app/api/cron/notifications/route.ts` (new)
- `tests/db/phase7-notifications.test.ts` (new)
- `tests/cron-auth.test.ts` (extend for the new route)
- no changes to Phase 1–6.1 code/behaviour
```