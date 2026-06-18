import Link from "next/link";
import type { BookingDetail as BookingDetailData } from "@/lib/bookings";
import { formatRupees, formatSlot } from "./format";
import { StatusBadge } from "./BookingsList";

/** payment_orders.status → human label for the read-only payment row. */
function paymentLabel(status: string): string {
  const map: Record<string, string> = {
    captured: "Paid",
    created: "Awaiting payment",
    pending: "Pending",
    failed: "Failed",
    expired: "Expired",
    refunded: "Refunded",
  };
  return map[status] ?? status;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="shrink-0 text-[12.5px] font-semibold text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-[13.5px] font-bold tracking-tight">{children}</span>
    </div>
  );
}

export default function BookingDetail({ detail }: { detail: BookingDetailData }) {
  const start = formatSlot(detail.slotStart);
  const end = formatSlot(detail.slotEnd);
  const hasCustomer = Boolean(detail.customerName || detail.customerEmail || detail.customerPhone);

  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <Link href="/dashboard/bookings" className="text-[13px] font-bold text-muted transition-colors duration-200 hover:text-ink">
        ← Bookings
      </Link>

      {/* booking info */}
      <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Booking information">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[18px] font-bold tracking-tight">Booking details</h1>
          <StatusBadge status={detail.status} />
        </div>
        <div className="mt-4">
          <Field label="Service">{detail.serviceTitle?.trim() || "Booking"}</Field>
          <Field label="Date">{start.day}</Field>
          <Field label="Time">
            {start.time} – {end.time}
          </Field>
          <Field label="Booking ID">
            <span className="font-mono text-[12px]">{detail.id}</span>
          </Field>
        </div>
      </section>

      {/* payment info */}
      <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Payment information">
        <h2 className="text-[16px] font-bold tracking-tight">Payment</h2>
        <div className="mt-4">
          <Field label="Status">
            {detail.payment ? paymentLabel(detail.payment.status) : "No payment recorded"}
          </Field>
          <Field label="Amount">{formatRupees(detail.payment?.amountPaise ?? detail.amountPaise)}</Field>
        </div>
      </section>

      {/* customer info — only when captured; honest placeholder otherwise */}
      <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Customer information">
        <h2 className="text-[16px] font-bold tracking-tight">Customer</h2>
        {hasCustomer ? (
          <div className="mt-4">
            <Field label="Name">{detail.customerName?.trim() || "—"}</Field>
            <Field label="Email">{detail.customerEmail?.trim() || "—"}</Field>
            <Field label="Phone">{detail.customerPhone?.trim() || "—"}</Field>
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-cream px-4 py-6 text-center text-[13px] font-semibold text-muted">
            No customer details were captured for this booking.
          </p>
        )}
      </section>
    </div>
  );
}
