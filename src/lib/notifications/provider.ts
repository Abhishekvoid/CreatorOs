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
 */
export type NotificationResult = { ok: true } | { ok: false; error: string };

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
 * Resolve the active notification provider. Console-only for now; a future
 * env switch selects a real provider without any caller knowing which is live.
 */
export function getNotificationProvider(): NotificationProvider {
  return new ConsoleNotificationProvider();
}
