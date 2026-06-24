import type { CreatorNotification } from "@/lib/notifications/queue";
import { notificationTypeLabel } from "@/lib/notifications/queue";
import { formatSlot } from "./format";

/** Queue status → pill styling + label. Colored text pills (the dashboard's
 *  convention — no glyphs). Only the live four states; others degrade gracefully. */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: string; label: string }> = {
    sent: { tone: "bg-green-soft text-green-deep", label: "Sent" },
    pending: { tone: "bg-[#FDF3DF] text-[#9A6A14]", label: "Pending" },
    processing: { tone: "bg-[#FDF3DF] text-[#9A6A14]", label: "Sending" },
    dead_letter: { tone: "bg-[#FBEAE7] text-[#B3261E]", label: "Failed" },
    failed: { tone: "bg-[#FBEAE7] text-[#B3261E]", label: "Failed" },
  };
  const s = map[status] ?? { tone: "bg-cream-2 text-muted", label: status };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide ${s.tone}`}>
      {s.label}
    </span>
  );
}

function Row({ n }: { n: CreatorNotification }) {
  const created = formatSlot(n.createdAt);
  const failed = n.status === "dead_letter" || n.status === "failed";
  return (
    <div className="-mx-2.5 flex items-center gap-3.5 rounded-2xl px-2.5 py-3.5 max-sm:flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-extrabold tracking-tight">{notificationTypeLabel(n.type)}</div>
        <div className="truncate text-[12.5px] font-semibold text-muted">
          {created.day}
          {n.attemptCount > 0 && ` · Attempt ${n.attemptCount}`}
          {failed && n.lastError ? ` · ${n.lastError}` : ""}
        </div>
      </div>
      <StatusPill status={n.status} />
    </div>
  );
}

export default function NotificationsList({ notifications }: { notifications: CreatorNotification[] }) {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Recent notifications">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold tracking-tight">Recent notifications</h2>
        {notifications.length > 0 && (
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11.5px] font-bold text-muted">{notifications.length}</span>
        )}
      </div>
      {notifications.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-cream px-4 py-6 text-center text-[13px] font-semibold text-muted">
          No notifications yet. They&rsquo;ll appear here as bookings and summaries go out.
        </p>
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-line">
          {notifications.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </div>
      )}
    </section>
  );
}
