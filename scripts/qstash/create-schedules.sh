#!/usr/bin/env bash
# Create the four CreatorOS cron schedules in Upstash QStash.
#
# QStash issues authenticated HTTPS GETs to the existing /api/cron/* endpoints.
# The Upstash-Forward-Authorization header is passed through to the endpoint as
# `Authorization: Bearer <CRON_SECRET>`, so the app's auth model is unchanged.
#
# Prereqs (NOT committed — supply at run time; creating paid/cloud resources is
# a Level 2 action requiring approval):
#   export QSTASH_TOKEN=...        # from Upstash console (setup-time only)
#   export CRON_SECRET=...         # SAME value as the Vercel env var
#   export BASE=https://creator-os-one-coral.vercel.app
#
# Re-running creates duplicate schedules; list/remove via the QStash console or
# GET/DELETE https://qstash.upstash.io/v2/schedules.
set -euo pipefail

: "${QSTASH_TOKEN:?set QSTASH_TOKEN}"
: "${CRON_SECRET:?set CRON_SECRET}"
: "${BASE:?set BASE (deployment origin)}"

# endpoint:cron  (cadences mirror the original vercel.json, recovered from 459dd84^)
schedules=(
  "process-events:* * * * *"   # hot path — drain payment_events
  "notifications:* * * * *"    # drain notification_queue
  "reconcile:*/5 * * * *"      # age expired holds + sweep provider truth
  "integrity:0 * * * *"        # hourly invariant checks
)

for entry in "${schedules[@]}"; do
  path="${entry%%:*}"
  cron="${entry#*:}"
  echo "→ scheduling /api/cron/${path}  ('${cron}')"
  curl -fsS -X POST "https://qstash.upstash.io/v2/schedules/${BASE}/api/cron/${path}" \
    -H "Authorization: Bearer ${QSTASH_TOKEN}" \
    -H "Upstash-Cron: ${cron}" \
    -H "Upstash-Method: GET" \
    -H "Upstash-Forward-Authorization: Bearer ${CRON_SECRET}" \
    -H "Upstash-Retries: 3"
  echo
done

echo "Done. Verify in the QStash console that 4 schedules are active and returning 200."
