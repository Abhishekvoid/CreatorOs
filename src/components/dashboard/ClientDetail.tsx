import Link from "next/link";
import type { ClientBooking, ClientDetail as ClientDetailData } from "@/lib/clients";
import { buildRebookPath, buildWhatsAppUrl, clientWhatsAppMessage } from "@/lib/client-actions";
import { formatRupees, formatSlot } from "./format";
import { StatusBadge } from "./BookingsList";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="shrink-0 text-[12.5px] font-semibold text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-[13.5px] font-bold tracking-tight">{children}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-cream px-4 py-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[18px] font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

function HistoryRow({ b }: { b: ClientBooking }) {
  const { day, time } = formatSlot(b.slotStart);
  return (
    <Link
      href={`/dashboard/bookings/${b.id}`}
      className="-mx-2.5 flex items-center gap-3.5 rounded-2xl px-2.5 py-3 transition-colors duration-200 hover:bg-cream"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-extrabold tracking-tight">{b.serviceTitle?.trim() || "Booking"}</div>
        <div className="truncate text-[12px] font-semibold text-muted">
          {day} · {time}
        </div>
      </div>
      <div className="shrink-0 text-[13px] font-bold">{formatRupees(b.amountPaise)}</div>
      <StatusBadge status={b.status} />
    </Link>
  );
}

export default function ClientDetail({
  client,
  creatorName,
  creatorHandle,
}: {
  client: ClientDetailData;
  creatorName: string;
  creatorHandle: string;
}) {
  const name = client.name?.trim() || "Guest";
  const since = client.firstBookingAt ? formatSlot(client.firstBookingAt).day : null;

  // Creator-controlled actions. WhatsApp opens a prefilled chat; rebook
  // deep-links into the public booking flow with this client's details
  // prefilled. Both are built from data already authorized on this page.
  const whatsappUrl = buildWhatsAppUrl(client.whatsapp, clientWhatsAppMessage(client.name, creatorName));
  const rebookPath = buildRebookPath(creatorHandle, {
    name: client.name,
    email: client.email,
    phone: client.whatsapp,
    service: client.lastServiceId,
  });

  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <Link href="/dashboard/clients" className="text-[13px] font-bold text-muted transition-colors duration-200 hover:text-ink">
        ← Clients
      </Link>

      {/* profile */}
      <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Client profile">
        <h1 className="text-[18px] font-bold tracking-tight">{name}</h1>
        <div className="mt-4">
          <Field label="WhatsApp">{client.whatsapp}</Field>
          <Field label="Email">{client.email?.trim() || "—"}</Field>
          {since && <Field label="Client since">{since}</Field>}
        </div>
        <div className="mt-5 flex gap-3 max-sm:flex-col">
          <Stat label="Lifetime spend" value={formatRupees(client.lifetimeSpendPaise)} />
          <Stat label="Bookings" value={String(client.bookingCount)} />
        </div>

        {/* creator-controlled actions */}
        <div className="mt-5 flex flex-wrap gap-3">
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Message on WhatsApp
            </a>
          ) : (
            <span
              aria-disabled="true"
              title="No WhatsApp number on file"
              className="btn btn-primary cursor-not-allowed opacity-50 saturate-50"
            >
              Message on WhatsApp
            </span>
          )}
          <a href={rebookPath} target="_blank" rel="noopener noreferrer" className="btn btn-grad">
            Book Another Session
          </a>
        </div>
      </section>

      {/* booking history */}
      <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Booking history">
        <h2 className="text-[16px] font-bold tracking-tight">Booking history</h2>
        {client.bookings.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-cream px-4 py-6 text-center text-[13px] font-semibold text-muted">
            No bookings to show.
          </p>
        ) : (
          <div className="mt-3 flex flex-col">
            {client.bookings.map((b) => (
              <HistoryRow key={b.id} b={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
