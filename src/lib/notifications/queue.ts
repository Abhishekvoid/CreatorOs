import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Notification observability read layer — READ-ONLY, owner-scoped.
 *
 * notification_queue is service-role only, so (exactly like bookings.ts /
 * clients.ts / dashboard.ts) this reads through the service-role `pg` pool and
 * pins every query to a single creator_id. A creator only ever sees their own
 * notifications; there is no cross-creator visibility and no per-id route.
 *
 * It surfaces only columns that already exist — no invented fields, no message
 * content, no actions. Pure observability: "what happened to my notifications?"
 */

export type CreatorNotification = {
  id: string;
  type: string;
  status: string; // pending | processing | sent | dead_letter
  attemptCount: number;
  createdAt: string; // ISO
  sentAt: string | null; // ISO, when delivered
  lastError: string | null;
};

const RECENT_LIMIT = 20;

function iso(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

/**
 * The creator's most recent notifications, newest first. Capped at the last 20
 * — no pagination, search or filters by design.
 */
export async function getCreatorNotifications(
  creatorId: string,
  db: Executor = getPool(),
): Promise<CreatorNotification[]> {
  const { rows } = await db.query(
    `select id, type, status, attempt_count, created_at, sent_at, last_error
       from public.notification_queue
      where creator_id = $1
      order by created_at desc
      limit ${RECENT_LIMIT}`,
    [creatorId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    type: String(r.type),
    status: String(r.status),
    attemptCount: Number(r.attempt_count ?? 0),
    createdAt: iso(r.created_at) as string,
    sentAt: iso(r.sent_at),
    lastError: r.last_error ?? null,
  }));
}

const TYPE_LABELS: Record<string, string> = {
  monthly_summary: "Monthly Summary",
  client_confirmation: "Booking Confirmation",
  creator_confirmation: "Booking Confirmation",
  client_cancellation: "Booking Cancellation",
  creator_cancellation: "Booking Cancellation",
  creator_plan_limit: "Plan Limit Warning",
};

/** A human label for a queue type; unknown types degrade to Title Case. */
export function notificationTypeLabel(type: string): string {
  return (
    TYPE_LABELS[type] ??
    type
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}
