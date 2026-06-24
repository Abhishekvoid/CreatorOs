/**
 * The notification provider boundary (Phase 7). ALL notification delivery
 * depends only on this interface — the worker never imports a concrete
 * messaging SDK (WhatsApp Cloud API, Meta, email, …) directly. Future
 * providers plug in here, mirroring the PaymentProvider seam.
 *
 * Today we ship ConsoleNotificationProvider: it logs the payload and reports
 * success. There is deliberately no WhatsApp/Meta integration yet.
 */

export type NotificationMessage = {
  /** notification_queue row id */
  id: string;
  correlationId: string;
  bookingId: string | null;
  type: string;
  channel: "whatsapp" | "email";
  payload: Record<string, unknown>;
};

/**
 * A delivery either succeeded or failed with a reason. The worker treats both
 * a returned `{ ok: false }` and a thrown error as a delivery failure — a
 * provider can never push an error into business truth.
 *
 * `retryable` lets a provider distinguish a transient failure (timeout, 5xx,
 * rate limit) from a permanent one (a 4xx the request will never satisfy, or a
 * malformed message). Omitted/true → the worker backs off and retries as
 * before; explicit false → the worker dead-letters immediately (re-sending the
 * same request can't succeed). This keeps the existing queue semantics intact
 * for every current caller, which never sets it.
 */
export type NotificationResult = { ok: true } | { ok: false; error: string; retryable?: boolean };

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<NotificationResult>;
}

/** Logs the payload and reports success. No external integration. */
export class ConsoleNotificationProvider implements NotificationProvider {
  async send(message: NotificationMessage): Promise<NotificationResult> {
    console.log("[notification]", {
      id: message.id,
      correlationId: message.correlationId,
      bookingId: message.bookingId,
      type: message.type,
      channel: message.channel,
      payload: message.payload,
    });
    return { ok: true };
  }
}

/**
 * Real delivery via the WhatsApp Cloud API (Meta). Type-agnostic: it sends from
 * a uniform payload contract — `payload.to` (recipient number) and
 * `payload.text` (message body) — so it never branches on notification type.
 * Producers populate those two fields; this class only knows how to POST them.
 *
 * Failure mapping the worker relies on:
 *   • missing to/text → permanent (re-sending can't fix a malformed message)
 *   • timeout / network error → retryable
 *   • 429 or 5xx → retryable
 *   • other 4xx → permanent
 * The access token and message payload are never logged and never placed in the
 * returned error (only the HTTP status), so secrets/PII can't leak downstream.
 */
export type RealProviderConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class RealNotificationProvider implements NotificationProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  constructor(private readonly config: RealProviderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.endpoint = `https://graph.facebook.com/${config.apiVersion ?? "v21.0"}/${config.phoneNumberId}/messages`;
  }

  async send(message: NotificationMessage): Promise<NotificationResult> {
    const to = String(message.payload.to ?? "").replace(/\D/g, "");
    const text = typeof message.payload.text === "string" ? message.payload.text : "";
    if (!to || !text) {
      return { ok: false, error: "missing recipient or text", retryable: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
        signal: controller.signal,
      });
      if (res.ok) return { ok: true };
      const retryable = res.status === 429 || res.status >= 500;
      // status only — never the response body, which can echo the payload.
      return { ok: false, error: `whatsapp ${res.status}`, retryable };
    } catch (err) {
      // timeout / network error — transient, safe to retry.
      const reason = err instanceof Error ? err.name : "network error";
      return { ok: false, error: `whatsapp request failed: ${reason}`, retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Resolve the active notification provider. Env-gated: the real WhatsApp
 * provider activates only when both credentials are present; otherwise we fall
 * back to console logging, so a misconfigured or local environment never makes
 * real sends. The worker is agnostic to which is live.
 */
export function getNotificationProvider(): NotificationProvider {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (accessToken && phoneNumberId) {
    return new RealNotificationProvider({ accessToken, phoneNumberId, apiVersion: process.env.WHATSAPP_API_VERSION });
  }
  return new ConsoleNotificationProvider();
}
