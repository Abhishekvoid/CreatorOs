# Verification — First Real Razorpay Payment

Date: 2026-06-14
Goal: prove the production payment flow end-to-end on the **live Supabase project**
using **Razorpay test keys**, with a real webhook. Stop after the first success.

> Status: **IN PROGRESS — awaiting live run.** Evidence sections below are
> placeholders to be filled with REAL outputs (no fabrication). Failures get
> logged verbatim.

---

## 0. Prerequisites

### Env (`.env.local`, local run — or Vercel project env if deploying)
Already present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

**Add:**
```
SUPABASE_DB_URL=postgresql://postgres:<pw>@<host>:5432/postgres   # live project (Settings → Database → Connection string)
CRON_SECRET=<a strong random string>
```
- Confirm `RAZORPAY_KEY_ID` starts with `rzp_test_` (test mode).
- `RAZORPAY_WEBHOOK_SECRET` must equal the secret you set on the Razorpay webhook (step 2).

### Public URL for the webhook (pick one)
- **Local + tunnel:** `npm run build && npm run start`, then
  `cloudflared tunnel --url http://localhost:3000` (or ngrok). Use the printed
  `https://…` URL as `<BASE>`.
- **Vercel deploy:** push the branch, set all env vars (incl. `SUPABASE_DB_URL`,
  `CRON_SECRET`) in the Vercel project. `<BASE>` = the deployment URL. The
  `vercel.json` crons then run `process-events` every minute automatically.

---

## 1. Confirm the payments schema is applied to the live project

Run in the Supabase SQL editor:

```sql
-- 1a. payment-system tables present?
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('bookings','booking_locks','payment_orders',
                      'payment_events','notification_queue','recovery_actions')
 order by table_name;   -- expect 6 rows

-- 1b. Phase 7/8 columns present?
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='notification_queue' and column_name='last_error') as nq_last_error,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='recovery_actions' and column_name='performed_by') as ra_performed_by;
  -- expect 1, 1
```

**If anything is missing**, apply the payment sections of `supabase/schema.sql` —
copy everything from the `-- Part 4 — Payments & Booking System` header to the
end of the file into the SQL editor and run it. Those sections are fully
idempotent (`create table if not exists`, `add column if not exists`,
`create index if not exists`, `create or replace`). Do **not** re-run Part 1
(the original `profiles` policies aren't idempotent and are already applied).

> Evidence (paste 1a + 1b output):
> ```
> (paste here)
> ```

---

## 2. Configure the Razorpay webhook

Razorpay Dashboard (test mode) → Settings → Webhooks → Add:
- **URL:** `<BASE>/api/webhooks/razorpay`
- **Secret:** the exact value of `RAZORPAY_WEBHOOK_SECRET`
- **Active events:** `payment.captured` (optionally `order.paid`)
- Save → it should show "Active".

> Evidence: screenshot of the webhook config (secret redacted).

---

## 3. Create a ₹1 test service, availability, and publish a profile

Use your real signed-up profile (so it has a valid handle). In the SQL editor:

```sql
-- 3a. find your profile
select id, handle, display_name, is_published
  from public.profiles order by created_at desc limit 5;

-- 3b. (replace :pid) — ₹1 = 100 paise, 30-min session
insert into public.services
  (profile_id, type, title, description, price_paise, duration_minutes, is_active, sort_order)
values (:pid, 'booking', '₹1 Test Session', 'Production smoke test', 100, 30, true, 0)
returning id;

-- 3c. availability so slots appear (every day 09:00–18:00 IST)
insert into public.availability (profile_id, day_of_week, start_time, end_time, is_active)
select :pid, gs, '09:00', '18:00', true from generate_series(0,6) gs;

-- 3d. publish
update public.profiles set is_published = true where id = :pid;
```

> Evidence: the `handle` and the new service `id`.

---

## 4. Execute the booking flow (browser)

1. Open `<BASE>/<handle>` → the public page renders profile + the ₹1 service.
   **(screenshot)**
2. Click **Book** → pick a date and an open time slot. **(screenshot)**
3. Fill name / email / WhatsApp → **Continue**. This POSTs `/api/bookings/initiate`.
4. The Razorpay checkout opens (real test widget, because `RAZORPAY_KEY_ID` is set).
   Pay with a **test instrument**:
   - UPI success VPA: `success@razorpay`
   - or test card `4111 1111 1111 1111`, any future expiry, any CVV.
   **(screenshot of the checkout)**
5. On success you land on `/<handle>/book/confirming?c=<correlationId>` which polls
   the backend. Note the `correlationId` from the URL. **(screenshot)**

> Evidence: `correlationId = ____`

---

## 5. Trigger the Processor

- **Vercel:** the `process-events` cron runs every minute — just wait. Or invoke now:
- **Manual (either env):**
  ```
  curl -s -H "Authorization: Bearer <CRON_SECRET>" <BASE>/api/cron/process-events
  ```
  Expect `{"processed":N}` with N ≥ 1.

> Evidence (curl response): `____`

The confirming screen should then redirect to `/booking/success?c=<correlationId>`.

---

## 6. Verify the chain in the database

One-shot trace (replace `:cid` with the correlationId):

```sql
select 'booking'      as artifact, id::text, status,                                          created_at from public.bookings           where correlation_id = :cid
union all
select 'lock',          id::text, status,                                                     created_at from public.booking_locks      where correlation_id = :cid
union all
select 'payment_order', id::text, status,                                                     created_at from public.payment_orders     where correlation_id = :cid
union all
select 'payment_event', id::text, event_source||':'||event_type||(case when processed then ' [processed]' else ' [unprocessed]' end), created_at from public.payment_events where correlation_id = :cid
union all
select 'notification',  id::text, type||' / '||status,                                        created_at from public.notification_queue where correlation_id = :cid
order by created_at;
```

Expected end state:

| artifact | expected status |
|---|---|
| booking | `confirmed` |
| lock | `confirmed` |
| payment_order | `captured` |
| payment_event | `webhook:payment.captured [processed]` |
| notification (×2) | `creator_confirmation` / `client_confirmation`, `pending` (or `sent` if the notifications cron ran) |

> Evidence (paste the trace output):
> ```
> (paste here)
> ```

---

## Verification checklist (filled from real evidence)

| # | Checkpoint | Status | Evidence |
|---|---|---|---|
| 1 | payment_order created | ⬜ | step 6 trace |
| 2 | webhook received | ⬜ | Razorpay dashboard delivery + server log |
| 3 | payment_event inserted | ⬜ | step 6 trace |
| 4 | processor confirmed booking | ⬜ | step 5 curl + step 6 trace |
| 5 | notification queued | ⬜ | step 6 trace |
| 6 | success page rendered | ⬜ | step 4/5 screenshot |

## Screenshots
- [ ] public profile page
- [ ] slot selection
- [ ] Razorpay checkout (test mode)
- [ ] confirming screen
- [ ] success page

## Logs
- [ ] webhook delivery (Razorpay dashboard) + `/api/webhooks/razorpay` server log
- [ ] `process-events` response

## Failures encountered
- (log any here, verbatim)
```