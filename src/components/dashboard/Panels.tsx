import Link from "next/link";
import type { ActivityItem, UpcomingBooking } from "@/lib/dashboard";
import { formatRupees, formatSlot, initials, timeAgo } from "./format";

function PanelIcon({ d, className = "size-[18px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d.split("|").map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

/* ---------------- upcoming sessions ---------------- */
export function UpcomingBookings({
  bookings,
  isPublished,
}: {
  bookings: UpcomingBooking[];
  isPublished: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Upcoming sessions">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold tracking-tight">Upcoming sessions</h2>
        <Link href="/dashboard/bookings" className="text-[12.5px] font-bold text-muted transition-colors duration-200 hover:text-ink">
          View all →
        </Link>
      </div>

      {bookings.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-cream px-4 py-6 text-center text-[13px] font-semibold text-muted">
          {isPublished
            ? "Your first booking will appear here."
            : "Publish your profile to start receiving bookings."}
        </p>
      ) : (
        <div className="mt-3 flex flex-col">
          {bookings.map((b) => {
            const { day, time } = formatSlot(b.slotStart);
            const name = b.customerName?.trim() || "Guest";
            return (
              <div
                key={b.id}
                className="-mx-2.5 flex items-center gap-3.5 rounded-2xl px-2.5 py-3.5 transition-colors duration-200 hover:bg-cream max-sm:flex-wrap"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream-2 text-[13px] font-extrabold text-ink-2">
                  {initials(b.customerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-extrabold tracking-tight">{name}</div>
                  <div className="truncate text-[12.5px] font-semibold text-muted">
                    {b.serviceTitle?.trim() || "Booking"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-extrabold">{day}</div>
                  <div className="text-[12px] font-semibold text-muted">{time}</div>
                </div>
                <span className="shrink-0 rounded-full bg-green-soft px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-green-deep">
                  Confirmed
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------- quick actions ---------------- */
/* Only actions that lead to real, built surfaces. No no-op buttons. */
export function QuickActions({
  handle,
  isPublished,
}: {
  handle: string | null;
  isPublished: boolean;
}) {
  const actions: { label: string; href: string; external?: boolean; d: string }[] = [
    { label: "Create service", href: "/onboarding/service", d: "M12 5v14M5 12h14" },
    { label: "Edit profile", href: "/onboarding/profile", d: "M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" },
    { label: "Manage availability", href: "/onboarding/availability", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7.5V12l3 2" },
  ];
  if (isPublished && handle) {
    actions.push({
      label: "View public profile",
      href: `/${handle}`,
      external: true,
      d: "M14 4h6v6|M20 4l-9 9|M19 13.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5h5.5",
    });
  }

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Quick actions">
      <h2 className="text-[16px] font-bold tracking-tight">Quick actions</h2>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-2">
        {actions.map((a) => {
          const className =
            "flex items-center gap-2.5 rounded-2xl border border-line bg-paper px-3.5 py-3 text-left text-[13px] font-bold text-ink-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink hover:text-ink hover:shadow-soft";
          const inner = (
            <>
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-cream-2 text-ink-2">
                <PanelIcon d={a.d} className="size-4" />
              </span>
              {a.label}
            </>
          );
          return a.external ? (
            <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer" className={className}>
              {inner}
            </a>
          ) : (
            <Link key={a.label} href={a.href} className={className}>
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- activity feed ---------------- */
/* Sourced only from real booking timestamps; green marks money landed. */
function activityText(a: ActivityItem) {
  const who = a.customerName?.trim();
  if (a.kind === "booking_confirmed") {
    const amount = a.amountPaise != null ? formatRupees(a.amountPaise) : null;
    return (
      <>
        Payment received{amount && <> — <b className="font-semibold text-green-deep">{amount}</b></>}
        {who && <> from {who}</>}
      </>
    );
  }
  return (
    <>
      New booking{who && <> — {who}</>}
      {a.serviceTitle?.trim() && <>, <b className="font-semibold">{a.serviceTitle.trim()}</b></>}
    </>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Recent activity">
      <h2 className="text-[16px] font-bold tracking-tight">Activity</h2>
      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-cream px-4 py-6 text-center text-[13px] font-semibold text-muted">
          Activity will appear here after your first booking.
        </p>
      ) : (
        <ul className="relative mt-4 flex flex-col gap-4.5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
          {items.map((a, i) => (
            <li key={`${a.kind}-${a.ts}-${i}`} className="relative pl-6">
              <span
                className={`absolute left-0 top-1 size-[11px] rounded-full border-2 border-paper ${
                  a.kind === "booking_confirmed" ? "bg-green" : "bg-line-2"
                }`}
              />
              <div className="text-[13px] font-medium leading-snug text-ink-2">{activityText(a)}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-faint">{timeAgo(a.ts)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
