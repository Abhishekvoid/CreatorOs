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

```yaml
# .github/workflows/cron.yml
on:
  schedule:
    - cron: "*/5 * * * *"   # GitHub Actions min granularity is ~5 min
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - run: |
          for path in process-events notifications reconcile integrity; do
            curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
              "https://<your-deployment>.vercel.app/api/cron/$path"
          done
```
