# WhatsApp Cloud API Webhook

Inbound webhook for Meta's WhatsApp Cloud API. Counterpart to the outbound
`RealNotificationProvider`. **Infrastructure only** — it answers Meta's
verification handshake and acknowledges delivery-status / incoming-message
callbacks. It does not implement chat, an inbox, message history, or sync status
into `notification_queue`.

- Route: `src/app/api/webhooks/whatsapp/route.ts`
- Production callback URL: `https://creator-os-one-coral.vercel.app/api/webhooks/whatsapp`
- Works unchanged on Vercel Preview deployments (the URL is resolved from the
  request, not hard-coded; only the env vars must be present).

## Behaviour

| Method | Case | Response |
|--------|------|----------|
| GET | `hub.mode=subscribe` + matching `hub.verify_token` | `200` echoing `hub.challenge` (plain text) |
| GET | wrong/missing token or mode | `403` |
| POST | valid WhatsApp envelope (statuses / messages / unknown change) | `200 {"status":"received"}` immediately |
| POST | non-`application/json` content type | `400` |
| POST | unparseable body | `400` |
| POST | wrong-shape JSON (not `object:"whatsapp_business_account"`) | `400` |

Well-formed-but-unsupported change fields are logged as `unsupported` and
ignored — never thrown. The handler does no DB work and makes no external calls,
so it returns fast and never holds Meta waiting.

## Logging & privacy

Logs carry **only** event kind, message id, and status. Phone numbers, message
text, and the verify/access tokens are never logged. The pure `summarizeEvents`
projection is what gets logged, and it cannot carry PII by construction.

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `WHATSAPP_VERIFY_TOKEN` | yes | Shared secret compared against `hub.verify_token` on GET verification. |
| `WHATSAPP_ACCESS_TOKEN` | yes (outbound) | Meta Graph API bearer token — used by the outbound provider, not this route. |
| `WHATSAPP_PHONE_NUMBER_ID` | yes (outbound) | Meta phone number id — outbound provider. |
| `WHATSAPP_API_VERSION` | no | Graph API version; defaults to `v21.0`. |

This route reads only `WHATSAPP_VERIFY_TOKEN`. The others are documented here so
the WhatsApp config lives in one place.

## Meta dashboard configuration (manual, after deploy)

1. **Meta App Dashboard → WhatsApp → Configuration → Webhook → Edit.**
2. **Callback URL:** `https://creator-os-one-coral.vercel.app/api/webhooks/whatsapp`
   (or the Preview deployment URL when testing a preview).
3. **Verify token:** paste the exact value of `WHATSAPP_VERIFY_TOKEN` from the
   target environment's Vercel env vars. Meta immediately issues a GET to
   confirm; it must echo the challenge → "Verified".
4. **Subscribe to webhook fields:** at minimum `messages`. This single field
   delivers both incoming messages and message-status callbacks (sent /
   delivered / read / failed).
5. Ensure the Vercel environment has `WHATSAPP_VERIFY_TOKEN` set **before**
   clicking Verify (Production and any Preview env you verify against). Without
   it the GET returns 403 and Meta reports verification failed.

No restart or migration is required — the route is stateless.
