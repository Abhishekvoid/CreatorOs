# Phase 4 — Webhook Ingestor (design)

Date: 2026-06-13
Branch: `feat/payments-booking`
Status: approved, pre-implementation

## Purpose

Provide a single HTTP endpoint that receives Razorpay webhook deliveries and does
exactly three things:

1. Verify the webhook signature.
2. Persist an immutable event row into `payment_events`.
3. Acknowledge receipt (HTTP 200).

The ingestor is intentionally "stupid": it is an **ingestion endpoint, not a
business-logic endpoint**. It records that something was reported by the provider.
It interprets nothing.

## Non-goals (hard constraints)

Phase 4 MUST NOT, in any code path:

- write to `bookings`, `booking_locks`, `payment_orders`, or `notification_queue`
- release a lock or confirm a booking/payment
- send a notification
- perform reconciliation, retry, or health-monitoring logic

The **only** table written in Phase 4 is `payment_events`. The only side effect is
acknowledging receipt. All state transitions are owned by Phase 5. If any business
state change appears in this phase, it is a bug and must be removed.

## Existing constraints this design relies on

From `supabase/schema.sql` (already present — no schema change in Phase 4):

- `payment_events(id, correlation_id NOT NULL, event_source, event_type,
  provider_event_id, payment_order_id NULL → payment_orders, payload jsonb,
  processed, processed_at, created_at)`.
- `event_source` check: `('webhook','reconciliation','manual')` — we always write
  `'webhook'`.
- `unique (event_source, provider_event_id)` — duplicate provider deliveries
  collapse to a no-op insert. **Idempotency is structural**, not application logic.
- Immutability trigger: only `(processed, processed_at)` may change; deletes are
  forbidden. The ingestor only ever INSERTs.
- Strict RLS (service-role only). Server code uses the direct `pg` pool
  (`getPool()`), which bypasses RLS — same access path as the Phase 3 orchestrator.
- Provider boundary: only `src/lib/payments/providers/*` may import the Razorpay
  SDK (enforced by `tests/provider-boundary.test.ts`). Signature verification must
  therefore live in the provider, never in the route handler.

## Architecture — thin route + ingestor function

Mirrors Phase 3, where the orchestrator lives in `initiate.ts` and the route is a
thin adapter. Two units:

### 1. `src/app/api/webhooks/razorpay/route.ts` (HTTP adapter only)

- `export const runtime = "nodejs"` (needs `crypto` + `pg`; not edge).
- `POST` handler:
  - read the **raw** request body as text (`await request.text()`) — signature is
    computed over raw bytes; never parse-then-reparse.
  - read the `x-razorpay-signature` and `x-razorpay-event-id` headers.
  - call `ingestWebhook({ rawBody, signature, eventId })`.
  - map the result to a status code (see Response semantics). No business logic,
    no DB calls, no Razorpay SDK in this file.

### 2. `src/lib/payments/ingest.ts` (`ingestWebhook` — the real work)

Plain async function, testable without HTTP (the way Phase 3 tests call
`initiate()` directly). Steps:

1. `provider = getPaymentProvider()`.
2. `if (!provider.verifyWebhookSignature({ payload: rawBody, signature }))` →
   return `{ status: "invalid_signature" }`. Nothing is read or written.
3. Parse `rawBody` as JSON. Extract:
   - `event_type` ← payload `event` (e.g. `"payment.captured"`).
   - provider `order_id` ← from the event entity
     (`payload.payload.payment.entity.order_id`, or
     `payload.payload.order.entity.id` for order events).
4. **Read-only** linkage resolution (no write to `payment_orders`):
   `select id, correlation_id from payment_orders where provider_order_id = $1`.
   - found → `correlation_id = row.correlation_id`, `payment_order_id = row.id`
     (linked).
   - not found → `correlation_id = randomUUID()`, `payment_order_id = NULL`
     (**unlinked** — see below). Never drop the event.
5. INSERT one row into `payment_events`
   (`event_source = 'webhook'`, `provider_event_id = eventId`, `event_type`,
   `correlation_id`, `payment_order_id`, `payload = <parsed jsonb>`). On a
   `23505` unique violation (duplicate delivery) → swallow, treat as success.
   - `provider_event_id` is NOT NULL. Razorpay always sends `x-razorpay-event-id`;
     if it is ever absent, fall back to the (hex) signature, which is deterministic
     over the body — this keeps the column populated and preserves meaningful
     dedup (identical bodies collapse). Verification has already passed at this
     point, so the signature is trustworthy as a key.
6. Return `{ status: "ok" }` (or `{ status: "duplicate" }` — both ack 200).

### "Unlinked" marker — no schema change

`payment_order_id IS NULL` **is** the unlinked marker. The raw provider `order_id`
is preserved inside `payload`, so Phase 5 can resolve and link later. The generated
`correlation_id` exists only to satisfy NOT-NULL for genuinely orphan events; for
linked events the booking's real `correlation_id` is used.

### Signature verification — `TestModeProvider.verifyWebhookSignature`

Replaces the current `NotImplementedError` stub:

- `expected = HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)` in hex.
- constant-time compare (`crypto.timingSafeEqual`) against the supplied signature.
- if `RAZORPAY_WEBHOOK_SECRET` is unset → return `false` (cannot verify ⇒ reject).
- `RouteProvider.verifyWebhookSignature` remains a throwing stub (Phase 4 runs on
  test mode; Route arrives later behind its production guard).

## Response semantics

| Situation | Persisted? | HTTP |
|---|---|---|
| Missing/!valid signature | no | **400** |
| Valid + new event | yes (1 row) | **200** |
| Valid + duplicate delivery (23505) | no-op | **200** |
| Valid + linkage not found | yes, `payment_order_id NULL` | **200** |

Rationale: a bad signature is un-genuine input and must not be acknowledged or
stored. Everything validly signed is recorded and acked, even if it can't be linked
yet — dropping a genuine provider event would lose forensic truth.

## Data flow

```
Razorpay ──POST raw body + headers──▶ route.ts (adapter)
                                         │ rawBody, signature, eventId
                                         ▼
                                    ingestWebhook()
                                         │ verify sig (provider, test-mode HMAC)
                                         │ parse, extract order_id + event_type
                                         │ SELECT payment_orders (READ ONLY)
                                         ▼
                                    INSERT payment_events  ◀── only write
                                         │
                                         ▼
                                    200 ack  (400 if signature invalid)
```

## Testing (real local Postgres, no mocks — matching Phase 3)

Positive:
- valid signature + matching order → exactly one `payment_events` row, linked
  (`payment_order_id` set, `correlation_id` = the order's).
- valid signature + no matching order → one row, **unlinked**
  (`payment_order_id IS NULL`), provider `order_id` retained in `payload`.
- duplicate delivery (same `event_id`) → second call is a no-op, still one row.

Signature:
- invalid signature → `invalid_signature` / 400, **zero** rows written.
- missing `RAZORPAY_WEBHOOK_SECRET` → verification fails (reject).

Negative / forbidden-list (the Phase 4 equivalent of the provider-boundary gate):
- after ingest, row counts for `bookings`, `booking_locks`, `payment_orders`,
  `notification_queue` are **unchanged**.
- no booking/lock status transitions occur.

Boundary:
- `tests/provider-boundary.test.ts` still passes (no Razorpay import outside
  `providers/*`).

## Files touched

- `src/app/api/webhooks/razorpay/route.ts` (new)
- `src/lib/payments/ingest.ts` (new)
- `src/lib/payments/providers/test-mode.ts` (implement `verifyWebhookSignature`)
- `tests/db/phase4-webhook.test.ts` (new)
- no schema changes
