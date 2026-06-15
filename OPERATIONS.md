# Operations

## Cron / background workers

The payments + booking system relies on four background endpoints. Their worker
logic is unchanged — only **how they are scheduled** differs in deployment.

### Why there are no `vercel.json` crons

Vercel's **Hobby** plan only permits **daily** cron jobs, but these workers need
sub-daily cadence (every 1–5 minutes for the hot path). Running them only once a
day would defeat their purpose, so the `vercel.json` `crons` array is empty and
the endpoints are driven by an **external scheduler** instead (e.g. GitHub
Actions, cron-job.org, EasyCron, Upstash QStash, or a paid Vercel plan).

### Endpoints

All four are `GET` and protected by `CRON_SECRET` (see `src/lib/cron-auth.ts`).
A request is authorized only if it presents the secret as **either**:

- `Authorization: Bearer <CRON_SECRET>`, **or**
- `x-cron-secret: <CRON_SECRET>`

If `CRON_SECRET` is unset the endpoints **fail closed** (every request → `401`).

| Endpoint | Suggested cadence | Purpose |
|----------|-------------------|---------|
| `/api/cron/process-events` | every 1 min | drain `payment_events` → apply booking state |
| `/api/cron/notifications`  | every 1 min | send queued confirmations/reminders |
| `/api/cron/reconcile`      | every 5 min | resolve pending/expired locks against the provider |
| `/api/cron/integrity`      | hourly      | integrity / drift checks |

### Invoking manually or from an external scheduler

```bash
BASE="https://<your-deployment>.vercel.app"

# Bearer form
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/process-events"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/notifications"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/reconcile"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/integrity"

# x-cron-secret form (equivalent)
curl -fsS -H "x-cron-secret: $CRON_SECRET" "$BASE/api/cron/process-events"
```

Set the same `CRON_SECRET` value in your deployment's environment variables and
in the external scheduler's request headers.

#### Example: GitHub Actions

A ready-to-use fallback workflow lives at `.github/workflows/cron.yml` (5-minute
cadence, `$0`). Set repo secrets `CRON_SECRET` and `DEPLOY_ORIGIN`.

### Primary scheduler: Upstash QStash

`scripts/qstash/create-schedules.sh` registers the four schedules (per-minute hot
path, retries + DLQ). QStash forwards `Authorization: Bearer <CRON_SECRET>` via
the `Upstash-Forward-Authorization` header, so the endpoint auth is unchanged.
Creating QStash schedules is a **Level 2** action (paid/cloud resource) — get
approval first. Run GitHub Actions OR QStash as primary; running both is safe
(workers are idempotent) but doubles invocations.

### Note: `/api/cron/reconcile` runs a full tick

The reconcile endpoint calls `reconcileTick()`, which **ages expired holds first**
(`expireToReconciliation`: `active` → `pending_reconciliation`) **then** sweeps
them against the provider. Earlier it called only the sweep, so abandoned-checkout
holds stayed `active` forever and their slots never freed. Keep both steps wired.

## Monitoring

Run periodically (or read `/api/cron/integrity` for the invariant set). Thresholds
are tuned for low pre-launch volume.

| Metric | SQL `where` | Expected | Warn | Critical |
|--------|-------------|----------|------|----------|
| Unprocessed events | `processed=false` | 0–few | ≥1 >2 min | see stale |
| **Stale events** | `processed=false and created_at < now()-interval '5 minutes'` | **0** | ≥1 | sustained ≥1 → **scheduler down** |
| Unlinked events | `payment_order_id is null` | 0 | ≥1 | ≥3 |
| Expired active locks | `status='active' and expires_at < now()` | 0 | ≥1 >15 min | sustained → reconcile tick broken |
| Dead-letter notifs | `status='dead_letter'` (notification_queue) | 0 | ≥1 | ≥5 |
| Stuck processing notifs | `status='processing' and processing_expires_at < now()` | 0 | ≥1 >5 min | sustained |

`stale events > 5 min` is the single most important alarm — it is the direct
"the scheduler stopped" signal behind the original payment-confirmation incident.

## Manual recovery / runbook

If the scheduler is down, drain everything by hand (idempotent, safe to repeat):

```bash
BASE="https://creator-os-one-coral.vercel.app"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/process-events"  # confirm/cancel bookings
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/reconcile"       # age + reconcile holds
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/notifications"   # send queued notifications
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/integrity"       # verify invariants (expect {"passed":true})
```

## Test-harness safety

`tests/db/*` DROP and recreate the `public` schema. `tests/db/helpers.ts` refuses
to do this unless `SUPABASE_DB_URL` points at a loopback host or
`ALLOW_DESTRUCTIVE_TEST_DB=1` is set. **Never** run the DB tests with
`SUPABASE_DB_URL` set to a production DSN.
