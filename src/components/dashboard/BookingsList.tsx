import Link from "next/link";
import type { BookingListItem, GroupedBookings } from "@/lib/bookings";
import { formatRupees, formatSlot, initials } from "./format";

/** Booking status → pill styling + label. Shared with the detail view. */
export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    confirmed: "bg-green-soft text-green-deep",
    cancelled: "bg-[#FBEAE7] text-[#B3261E]",
    expired: "bg-cream-2 text-muted",
    payment_pending: "bg-[#FDF3DF] text-[#9A6A14]",
  };
  const label: Record<string, string> = {
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    expired: "Expired",
    payment_pending: "Pending",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide ${
        tone[status] ?? "bg-cream-2 text-muted"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}

function BookingRow({ b }: { b: BookingListItem }) {
  const { day, time } = formatSlot(b.slotStart);
  const name = b.customerName?.trim() || "Guest";
  return (
    <Link
      href={`/dashboard/bookings/${b.id}`}
      className="-mx-2.5 flex items-center gap-3.5 rounded-2xl px-2.5 py-3.5 transition-colors duration-200 hover:bg-cream max-sm:flex-wrap"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream-2 text-[13px] font-extrabold text-ink-2">
        {initials(b.customerName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-extrabold tracking-tight">{name}</div>
        <div className="truncate text-[12.5px] font-semibold text-muted">{b.serviceTitle?.trim() || "Booking"}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-extrabold">{day}</div>
        <div className="text-[12px] font-semibold text-muted">{time}</div>
      </div>
      <div className="shrink-0 text-right max-sm:order-3">
        <div className="text-[13px] font-bold">{formatRupees(b.amountPaise)}</div>
      </div>
      <StatusBadge status={b.status} />
    </Link>
  );
}

function Section({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: BookingListItem[];
}) {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label={title}>
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
        {items.length > 0 && (
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11.5px] font-bold text-muted">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-cream px-4 py-6 text-center text-[13px] font-semibold text-muted">{empty}</p>
      ) : (
        <div className="mt-3 flex flex-col">
          {items.map((b) => (
            <BookingRow key={b.id} b={b} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function BookingsList({ groups }: { groups: GroupedBookings }) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Upcoming" empty="No upcoming bookings." items={groups.upcoming} />
      <Section title="Past" empty="No completed bookings yet." items={groups.past} />
      <Section title="Cancelled" empty="No cancelled bookings." items={groups.cancelled} />
    </div>
  );
}
