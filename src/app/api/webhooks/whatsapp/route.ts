/**
 * WhatsApp Cloud API webhook (Meta) — the inbound counterpart to our outbound
 * RealNotificationProvider. Infrastructure only: it answers Meta's verification
 * handshake and ingests delivery-status / incoming-message callbacks. It does
 * NOT build chat, an inbox, or sync status into notification_queue — future
 * processing, if any, happens asynchronously downstream.
 *
 * Design mirrors the Razorpay route (src/app/api/webhooks/razorpay/route.ts):
 * Node runtime, raw text read, and a resilient POST that NEVER throws on an odd
 * payload — Meta disables a subscription that keeps erroring, so we ack fast and
 * swallow anything we don't recognise.
 *
 * Privacy invariant: we log ONLY event kind, message id and status. Phone
 * numbers, message text and the verify/access token never reach a log line.
 */
export const runtime = "nodejs";

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * GET — Meta verification flow. On subscription Meta calls the callback URL with
 * hub.mode=subscribe, hub.verify_token (our shared secret) and hub.challenge.
 * We echo the challenge verbatim only when the token matches; otherwise 403.
 * The token is compared, never logged.
 */
export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge !== null) {
    console.info("[whatsapp-webhook] verification handshake ok");
    return text(200, challenge);
  }

  console.warn("[whatsapp-webhook] verification rejected", { mode });
  return text(403, "Forbidden");
}

/** A log-safe projection of one webhook event — never carries text or numbers. */
export type EventSummary =
  | { kind: "status"; messageId: string; status: string }
  | { kind: "incoming"; messageId: string; messageType: string }
  | { kind: "unsupported"; field: string };

type WhatsAppChange = {
  field?: unknown;
  value?: {
    statuses?: Array<{ id?: unknown; status?: unknown }>;
    messages?: Array<{ id?: unknown; type?: unknown }>;
  };
};

type WhatsAppPayload = {
  object?: unknown;
  entry?: Array<{ id?: unknown; changes?: WhatsAppChange[] }>;
};

/** True only for the canonical Cloud API envelope; anything else is malformed. */
export function isWhatsAppPayload(payload: unknown): payload is WhatsAppPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as WhatsAppPayload).object === "whatsapp_business_account" &&
    Array.isArray((payload as WhatsAppPayload).entry)
  );
}

/**
 * Reduce a (validated) payload to log-safe summaries. Statuses and incoming
 * messages contribute id + kind only; any other change field is recorded as
 * `unsupported` so it is visible in monitoring without being acted upon. Pure
 * and side-effect free, so it is unit-testable without HTTP.
 */
export function summarizeEvents(payload: WhatsAppPayload): EventSummary[] {
  const out: EventSummary[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];

      for (const s of statuses) {
        out.push({ kind: "status", messageId: String(s.id ?? ""), status: String(s.status ?? "") });
      }
      for (const m of messages) {
        out.push({ kind: "incoming", messageId: String(m.id ?? ""), messageType: String(m.type ?? "") });
      }
      if (statuses.length === 0 && messages.length === 0) {
        out.push({ kind: "unsupported", field: String(change.field ?? "unknown") });
      }
    }
  }
  return out;
}

/**
 * POST — ingest Meta callbacks. We validate the content type and the envelope
 * shape (rejecting genuinely malformed deliveries with 400), then ack 200
 * immediately. No DB, no external call, no heavy work blocks the response.
 * Unrecognised-but-well-formed events are summarised as `unsupported` and
 * ignored — never thrown.
 */
export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(400, { error: "unsupported content type" });
  }

  const rawBody = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "malformed payload" });
  }

  if (!isWhatsAppPayload(parsed)) {
    return json(400, { error: "malformed payload" });
  }

  // Best-effort, log-safe observability. Wrapped so a logging fault can never
  // turn a delivered webhook into a Meta retry storm.
  try {
    for (const event of summarizeEvents(parsed)) {
      console.info("[whatsapp-webhook] event", event);
    }
  } catch {
    // ignore — acking matters more than the log line
  }

  return json(200, { status: "received" });
}
