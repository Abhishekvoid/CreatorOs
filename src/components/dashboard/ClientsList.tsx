import Link from "next/link";
import type { ClientListItem } from "@/lib/clients";
import { formatRupees, formatSlot, initials } from "./format";

function ClientRow({ c }: { c: ClientListItem }) {
  const name = c.name?.trim() || "Guest";
  const last = c.lastBookingAt ? formatSlot(c.lastBookingAt) : null;
  return (
    <Link
      href={`/dashboard/clients/${c.id}`}
      className="-mx-2.5 flex items-center gap-3.5 rounded-2xl px-2.5 py-3.5 transition-colors duration-200 hover:bg-cream max-sm:flex-wrap"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream-2 text-[13px] font-extrabold text-ink-2">
        {initials(c.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-extrabold tracking-tight">{name}</div>
        <div className="truncate text-[12.5px] font-semibold text-muted">{c.whatsapp}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-extrabold">{formatRupees(c.lifetimeSpendPaise)}</div>
        <div className="text-[12px] font-semibold text-muted">
          {c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"}
        </div>
      </div>
      <div className="shrink-0 text-right max-sm:order-3">
        <div className="text-[12px] font-semibold text-muted">{last ? last.day : "—"}</div>
      </div>
    </Link>
  );
}

export default function ClientsList({ clients }: { clients: ClientListItem[] }) {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Clients">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold tracking-tight">All clients</h2>
        {clients.length > 0 && (
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11.5px] font-bold text-muted">{clients.length}</span>
        )}
      </div>
      {clients.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-cream px-4 py-6 text-center text-[13px] font-semibold text-muted">
          No clients yet. Every confirmed booking adds one automatically.
        </p>
      ) : (
        <div className="mt-3 flex flex-col">
          {clients.map((c) => (
            <ClientRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}
