# Phase 9 — Payment Setup UI & Route Readiness — Completion Report

**Date:** 2026-06-14
**Branch:** `feat/payments-booking`
**Scope:** Payment Setup layer that prepares CreatorOS for Razorpay Route
onboarding and future creator payouts. **No** payouts, settlement, balances,
earnings, withdrawals, commissions, refunds, or subscriptions were built. The
frozen Phase 1–8 money architecture was **not** modified.

---

## What was built

### 9.1 — Payment Profile model (migration)
`supabase/schema.sql` → new **Part 9** (additive, idempotent):
`creator_payment_profiles` with `creator_id` (unique → one profile per creator),
`status` (CHECK over the 5 allowed states, default `not_started`),
`route_account_id`, `kyc_status`, `payouts_enabled` (default false),
`notify_requested_at` (backs the Notify CTA), `created_at`/`updated_at`.
Index on `status`; `updated_at` trigger reuses `public.set_updated_at()`.

**RLS — owner-scoped & private:** select/insert/update only where
`auth.uid() = creator_id`, and crucially **no public-read policy** (unlike
`services`/`availability`) — payout status is private.

### 9.1b — Domain model + server actions
- `src/lib/payments/profile.ts` — pure types: `PAYMENT_STATUSES`,
  `PaymentProfileStatus`, `PaymentProfile`, `defaultPaymentProfile()`.
- `src/lib/actions/payment-profile.ts` — `getPaymentProfile()` (read-only;
  synthesises `not_started` when none), `requestPayoutNotification()` (upsert on
  `creator_id`, stamps `notify_requested_at`).

### 9.2 + 9.5 — Payment Setup UI + 5-state machine
`src/components/onboarding/payments/`:
- `state.ts` — **pure** status→view-model map covering all 5 states; the single
  source of truth (`paymentStatusView`). `payouts_enabled` overrides the publish
  warning (money-truth wins).
- `PaymentStatusBadge.tsx`, `PayoutTimeline.tsx` (Onboarding → Verification →
  Payouts live), `RouteComingSoonBanner.tsx`, `PaymentSetupCard.tsx` (client
  orchestrator: current-state card, "What works today", Notify CTA, Publish CTA
  + warning).
- `src/app/onboarding/payments/page.tsx` — rewritten from the placeholder to the
  real Payment Setup experience (Step 5 chrome, ambient wash to match the
  availability step).

### 9.3 — Publish flow integration
- `publishProfile()` already gates only on an active bookable service and does
  **not** reference payments — left unchanged (exactly the required behaviour).
- The payments page now carries the **"Publish my page"** CTA → `/onboarding/
  publish`. This also closes a latent trap: previously `AvailabilityForm` →
  `/onboarding/payments` (placeholder) never set `completed_steps.payments`, so
  returning creators looped there forever and `/onboarding/publish` was only
  reachable by typing the URL.
- Warning shown whenever payouts aren't enabled: *"Payments are not yet enabled.
  You can publish your page and accept test bookings, but creator payouts are
  not active."*

### 9.4 — Route readiness layer (abstraction only)
`src/lib/payments/route/` — **account onboarding** (distinct from the existing
settlement `RouteProvider`):
- `types.ts` — interfaces only (`RouteOnboarding`, inputs/outputs).
- `service.ts` — `RouteOnboardingService`; `createLinkedAccount`,
  `getAccountStatus`, `generateOnboardingLink` all throw `NotImplementedError`
  (reusing the existing error). Nothing calls these yet.

---

## Tests (added)
- `tests/db/phase9-payment-profile.test.ts` — one-profile-per-creator (`23505`),
  status CHECK (`23514` + all 5 valid), defaults, `updated_at` trigger, RLS
  (enabled + owner-scoped select/insert/update, no public-read policy).
- `tests/payments/route-layer.test.ts` — every Route method throws
  `NotImplementedError`.
- `tests/payments/payment-status-view.test.ts` — all 5 states render a complete
  view-model; publish warning shown unless payouts enabled.

---

## Verification (evidence)

| Check | Result |
|-------|--------|
| `npm test` | **115 passed / 14 files** (incl. 16 new Phase 9 tests) |
| `npm run build` | **Compiled successfully**; `/onboarding/payments` present |
| `npm run lint` (Phase 9 files) | **exit 0 — clean** |
| `npm run lint` (whole repo) | 14 pre-existing errors (`no-html-link-for-pages`
  on `/meera/` demo links), **unchanged** by Phase 9; 0 new |
| Frozen-module diff guard | **empty** — processor / reconcile / ingest /
  provider / providers / webhooks / notifications / cron all untouched |

### Screenshots — all 5 states
`docs/verification/phase9-screenshots/` (captured via a temporary dev-only
preview route, since removed):
- `not_started.png` (the only state reachable today) — "Not Connected", warning + publish CTA
- `pending_route.png`
- `pending_verification.png`
- `active.png` — green "Payouts active" badge, completed timeline, **no** warning
- `rejected.png`

---

## Constraints honoured
- Did **not** modify the Phase 1–8 payment architecture (webhooks, processor,
  reconcile, notification worker, monitoring, recovery, the 6 frozen tables, the
  `PaymentProvider` boundary).
- Did **not** build payout transfers, settlement, balances, earnings charts,
  withdrawals, commissions, refunds, or subscriptions.
- No real Razorpay Route calls — the readiness layer is stubs only.

**Stopping here for review, as requested.**
