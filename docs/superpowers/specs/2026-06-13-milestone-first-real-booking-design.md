# Milestone — First Real Booking (design)

Date: 2026-06-13
Branch: `feat/payments-booking`
Status: draft — awaiting review

## Purpose

Wire the frozen payment architecture (Phases 1–8) to a real, end-to-end UX: a
creator publishes a dynamic profile at `creatoros.in/{handle}`, a client picks a
real slot, pays via Razorpay test mode, and the booking becomes `confirmed`
through the existing webhook/sweep → Processor pipeline — with no manual DB
edits.

### Frozen-architecture guarantees (non-negotiable)

- The **browser never confirms**. The only backend write the UI triggers is
  Phase 3 `initiate` (creates booking + lock + provider order). Confirmation
  flows exclusively through Phase 4 webhook / Phase 6 sweep → Phase 5 Processor.
- The **confirming** and **success** screens are READ-ONLY polls of our own
  backend. They never call Razorpay, never mark paid.
- **Availability reads `booking_locks`** (Rule 5) via the existing
  `getAvailability` — `active` / `pending_reconciliation` / `confirmed` locks are
  already excluded, so occupied and pending-reconciliation slots are hidden for
  free.
- No changes to `payment_orders`, `payment_events`, `booking_locks`, the
  Processor, Sweep, Notification Worker, or Integrity/Recovery. No new payment
  states.

## Data access model

Two read paths already exist and we use both as-is:

- **Public profile data** (`profiles`, `services`, `availability`) is
  RLS-public-read → Supabase server client (anon), SSR-friendly.
- **Booking/payment internals** (`booking_locks`, `bookings`, `payment_orders`)
  are service-role only → the existing `@/lib/db/pool` (direct Postgres). All
  slot/lock/status reads go through server-only lib functions and route
  handlers, never the browser.

To keep everything testable against real Postgres (the repo's only test style),
**all logic lives in server-only lib functions**; route handlers and React
components are thin shells over them.

---

## Phase A — Dynamic public creator page

`src/app/[handle]/page.tsx` (server component):

- `loadCreatorPage(handle)` (new, `src/lib/public-profile.ts`): resolve the
  profile by handle (published only), load its active `services`. Returns
  `null` when the handle doesn't exist or isn't published → page calls
  `notFound()`.
- Renders the real creator via the **already prop-driven `ProfileHeader`**
  (`creator={...}` mapped from the row) plus a new lean, data-driven
  `ServicesList` (each service → title, price, duration, a "Book" link to
  `/[handle]/book?service={id}`). No Meera data, no fake metrics/marketing.
- `/meera` demo stays untouched as the marketing showcase (decision 2).

Availability is fetched interactively in the booking flow (below), not on the
profile page.

## Phase B — Booking initiate API

`src/app/api/bookings/initiate/route.ts` → thin adapter over
`initiateBooking(input)` (new, `src/lib/booking-initiate.ts`):

Input: `{ creatorHandle, serviceId, slotStart, customerName, customerEmail, customerPhone }`.

1. Resolve `creatorHandle` → `creator_id` (published profile) — 404 if missing.
2. Load the `service` (must belong to the creator, be active, type `booking`) —
   derive `amountPaise = service.price_paise` and `slotEnd = slotStart +
   service.duration_minutes`. **Amount/duration come from the DB, never the
   client.**
3. Call Phase 3 `initiate({ creatorId, serviceId, slotStart, slotEnd,
   amountPaise, customer })`.
4. Return `{ correlationId, orderId, amount, key }` where `key` is the public
   Razorpay key (`process.env.RAZORPAY_KEY_ID`, or `""` in keyless mode).

No confirmation logic. A losing slot race surfaces as `SlotUnavailableError` →
409.

## Phase C — Slot selection UI (`src/components/public-profile/`)

New, lean, data-driven components (the Meera `BookingFlow` is a demo artifact we
leave alone — decision 2):

- `ServicesList` / `ServiceCard` — render the creator's services (profile page
  and booking entry).
- `AvailabilityCalendar` — pick a date (IST), real month nav.
- `SlotPicker` — fetches `GET /api/creators/[handle]/slots?serviceId=&from=&to=`
  → `getCreatorSlots(...)` (new) which calls `getAvailability` with
  `slotMinutes = service.duration_minutes`. Occupied / pending-reconciliation
  slots are already absent (Rule 5).
- `BookingForm` — name / email / phone; on submit POSTs Phase B, then opens
  Razorpay checkout (Phase D).
- `BookingSummary` — service / creator / slot / price recap alongside the form.

Page: `src/app/[handle]/book/page.tsx`.

## Phase D — Razorpay checkout (test mode)

On a successful `initiate` response, load `checkout.js` and open the Razorpay
widget with `{ key, order_id: orderId, amount, prefill }`. On the widget's
success/dismiss callbacks we **only navigate** to the confirming screen with the
`correlationId` — we never treat the callback as authority (decision 1 covers
the keyless-dev path). `TestModeProvider` only; Route is untouched.

## Phase E — Confirming screen (`/[handle]/book/confirming`)

`src/app/[handle]/book/confirming/page.tsx` + a small client poller. After
checkout it polls `GET /api/bookings/status?correlationId=...` →
`getBookingStatus(correlationId)` (new, read-only): returns
`{ status, bookingId }` from `bookings`.

- `payment_pending` → keep polling ("confirming your payment…").
- `confirmed` → redirect to success.
- `cancelled`/`expired` → failure state.

Never queries Razorpay; never writes. Confirmation arrives only because a
webhook/sweep drove the Processor.

## Phase F — Success page (`/booking/success`)

Rework to read truth: `getConfirmedBooking(correlationId)` (new) returns the
booking + service + creator only when `status='confirmed'`; otherwise the page
redirects back to confirming. Displays booking id, service, creator,
date/time — sourced from the DB, never the Razorpay callback. (The Meera
`BookingSuccess` demo component is left for the demo path; the real page renders
from data.)

## Phase G — Publish flow

`publishProfile()` server action (new, in `src/lib/actions/profile.ts`): set
`is_published = true` for the signed-in user; revalidate. The onboarding publish
step calls it before showing `PublishMoment`, whose URL already points at
`creatoros.in/{handle}` → now a live dynamic route. (`PublishMoment` is
unchanged beyond ensuring publish has run.)

---

## How confirmation closes without manual intervention (decision 1)

- **Primary (webhook):** Razorpay test mode → webhook to the Phase 4 ingestor →
  `payment_events` → Processor → `confirmed`. Needs a reachable URL
  (prod domain, or a tunnel in dev) and `RAZORPAY_WEBHOOK_SECRET`.
- **Backstop (reconciliation):** the Phase 6 sweep polls the provider and emits
  `reconciliation.captured` for unresolved orders → Processor. (Requires real
  keys so the order is fetchable.)
- **Keyless local dev:** a synthetic order can't be paid in the real widget nor
  fetched by the sweep. See decision 1 for the proposed gated dev simulator.

## Tests (real Postgres; lib-fn + route-handler level, matching repo style)

`tests/db/milestone-booking.test.ts` (+ a couple of route-handler assertions):

1. **Creator page loads** — seed a published creator + services; `loadCreatorPage(handle)` returns them.
2. **Missing handle → 404** — `loadCreatorPage('nope')` returns `null` (and an unpublished handle returns `null`).
3. **Initiate creates order + lock** — `initiateBooking(...)` → a `payment_orders` row (`created`) and a `booking_locks` row (`active`) exist for the booking; returned `amount` equals the service price.
4. **Checkout callback cannot confirm** — after `initiate`, `getBookingStatus` reports `payment_pending`; passing Razorpay-shaped params changes nothing; there is no UI-reachable write that confirms.
5. **Confirming waits for status** — `getBookingStatus` is `payment_pending` pre-processing; after a captured event flows through the Processor it becomes `confirmed`.
6. **Confirmed reaches success** — `getConfirmedBooking` returns `null` while pending and the full record once `confirmed`.
7. **Occupied slot hidden** — seed an `active` lock over a slot; `getCreatorSlots` omits it.
8. **Pending-reconciliation slot hidden** — seed a `pending_reconciliation` lock; `getCreatorSlots` omits it.
9. **Full happy path** — `initiateBooking` → drive the **real Phase 4 ingestor** with a signed `payment.captured` webhook → `processPendingEvents` → `getConfirmedBooking` returns the confirmed booking. No DB edits.

React components and the Razorpay widget are not unit-tested (the repo has no
browser/component test harness); they are thin shells over the tested lib
functions and verified manually.

## Decisions (resolved in review)

1. **Keyless-dev confirmation — gated dev webhook simulator.** Primary path is
   real Razorpay test keys (webhook + sweep, both frozen). For local dev,
   `POST /api/dev/simulate-webhook` (gated to `NODE_ENV !== 'production'` AND the
   test provider) emits a correctly-**signed** payload to the **existing Phase 4
   ingestor** — the browser still never confirms; a real webhook path does. It
   adds zero new confirm logic.
2. **Meera demo / UI reuse — keep + build fresh.** `/meera` stays a standalone
   marketing/demo surface; `Services`, `BookingFlow`, `PaymentFlow` are NOT
   refactored into production infra. Fresh, lean, data-driven components live in
   **`src/components/public-profile/`**: `ServicesList`, `ServiceCard`,
   `AvailabilityCalendar`, `SlotPicker`, `BookingForm`, `BookingSummary`. Reuse
   only the already-data-driven `ProfileHeader`.
3. **Endpoint keying — `correlationId`** (opaque, returned by `initiate`), not
   `bookingId`.
4. **Publish gating — require ≥1 service.** `publishProfile` sets
   `is_published=true` only when the creator has at least one active `booking`
   service; otherwise it returns an error the onboarding step surfaces. A
   published page is therefore always bookable.

## Files (new unless noted)

- `src/lib/public-profile.ts` — `loadCreatorPage`, `getConfirmedBooking`
- `src/lib/booking-initiate.ts` — `initiateBooking`, `getCreatorSlots`, `getBookingStatus`
- `src/app/[handle]/page.tsx`, `src/app/[handle]/book/page.tsx`, `src/app/[handle]/book/confirming/page.tsx`
- `src/app/api/bookings/initiate/route.ts`, `src/app/api/bookings/status/route.ts`, `src/app/api/creators/[handle]/slots/route.ts`
- `src/app/api/dev/simulate-webhook/route.ts` (decision 1, gated)
- `src/components/public-profile/ServicesList.tsx`, `ServiceCard.tsx`, `AvailabilityCalendar.tsx`, `SlotPicker.tsx`, `BookingForm.tsx`, `BookingSummary.tsx`, `ConfirmingPoller.tsx`
- `src/app/booking/success/page.tsx` — reworked to read confirmed booking
- `src/lib/actions/profile.ts` — add `publishProfile`; onboarding publish wiring
- `tests/db/milestone-booking.test.ts`
- no changes to Phase 1–8 code/behaviour
```