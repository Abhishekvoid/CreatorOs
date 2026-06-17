# Launch Checklist

What stands between today and a real beta creator taking a real booking and
getting paid. Assume real money — do not check a box you haven't verified.

_Last reviewed: 2026-06-17._

## ✅ Done

- **Publish & share path** — eligibility gate (handle + service + availability),
  "You're Live" moment (copy / view / WhatsApp), public `/{handle}` page (404s
  on draft/unknown), DB-backed dashboard status strip. See `publish-flow.md`.
- **Payment core** — checkout, server-side orders, webhook ingestion + signature
  verification, append-only event ledger, Processor Worker, reconciliation,
  booking confirmation, CI provider boundary. See `payment-architecture.md`.
- **Production deploy** — verified live on Vercel.

## 🔴 Blockers (must fix before any real creator)

1. **No cron scheduler.** `vercel.json` has `crons: []`, so
   `/api/cron/process-events`, `/reconcile`, and `/notifications` never run
   automatically. Consequences:
   - Payments confirm **only** on manual `curl` → a paying client is left hanging.
   - `reconcileTick` never runs → expired holds never age → **slots leak**
     (the code path `expireToReconciliation` is correctly wired into
     `reconcileTick`; it just never fires).
   - **Fix:** external scheduler (e.g. Upstash QStash) hitting each endpoint on a
     cadence with the `CRON_SECRET`.
2. **Test → live Razorpay keys.** `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are
   test-mode. Swap to live keys, and re-verify `RAZORPAY_WEBHOOK_SECRET` matches
   the **live** dashboard webhook character-for-character across dashboard ↔
   Vercel ↔ local.
3. **`creator_payment_profiles` missing on the live DB.** Schema Part 9 exists in
   `supabase/schema.sql` but (per ops notes) was not applied to production.
   **Apply and verify it exists before launch.**
4. **Notifications are console-only.** `ConsoleNotificationProvider` logs and
   reports success — there is **no** real WhatsApp/email delivery. Clients and
   creators receive nothing. Wire a real provider behind the existing
   `NotificationProvider` seam, or explicitly accept "no notifications" for beta.

## 🟠 Before scaling past the first creator

- **Razorpay Route (payouts).** Not live → creators cannot receive money; funds
  sit in the platform account. `payouts_enabled = false` everywhere. Fine for a
  hand-settled first creator; required before real onboarding.

## 🟡 Verification gaps (close before sign-off)

- **DB integration suite not run.** `tests/db/*` require a local Supabase
  (`supabase start`) and have not been executed in CI/this environment. They are
  the main safety net for `publishProfile`'s DB queries and the payment state
  machine. Run them green before launch.
- **Manual end-to-end publish walkthrough** on production (logged in): publish
  with no availability is blocked → add availability → publish → "View profile" +
  real URL show → dashboard strip reads Live.
- **Lint debt (non-blocking):** 14 pre-existing `no-html-link-for-pages` errors
  in `src/components/profile/*` (the `/meera` demo) make `npm run lint` red; the
  build is unaffected. 1 pre-existing `tsc` error in
  `tests/db/phase3-orchestrator.test.ts`.

## First-beta go/no-go

- [ ] Scheduler live; processor + reconcile + notifications fire on a cadence
- [ ] Live Razorpay keys + webhook secret verified across all 3 environments
- [ ] `creator_payment_profiles` applied & verified on production
- [ ] Real notification provider wired (or "no notifications" accepted in writing)
- [ ] `tests/db/*` run green against a real Postgres
- [ ] Manual publish → book → confirm walkthrough passes with a live test payment
- [ ] Payout plan for the first creator decided (hand-settle until Route is live)
