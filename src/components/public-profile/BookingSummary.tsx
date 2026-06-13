import type { PublicService } from "@/lib/public-profile";
import { inr } from "./ServiceCard";
import type { Slot } from "./SlotPicker";

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function istTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .toLowerCase();
}

/** Read-only recap of the in-progress booking. */
export default function BookingSummary({
  creatorName,
  service,
  date,
  slot,
}: {
  creatorName: string;
  service: PublicService;
  date: Date | null;
  slot: Slot | null;
}) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-line bg-paper shadow-soft">
      <div className="border-b border-line bg-cream px-6 py-4">
        <div className="text-[15px] font-extrabold tracking-tight">{creatorName}</div>
        <div className="truncate text-[12px] font-semibold text-muted">{service.title}</div>
      </div>
      <div className="p-6">
        <dl className="flex flex-col gap-2.5 text-[13.5px]">
          {[
            ["Date", date ? dateLabel(date) : "Not selected"],
            ["Time", slot ? `${istTime(slot.slotStart)} IST` : "Not selected"],
            ["Duration", service.durationMinutes ? `${service.durationMinutes} minutes` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold text-muted">{k}</dt>
              <dd className="font-semibold tracking-tight">{v}</dd>
            </div>
          ))}
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3.5">
            <dt className="text-[14.5px] font-bold">Total</dt>
            <dd className="text-[24px] font-bold tracking-tight">{inr(service.pricePaise)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-muted">
          Secured by <b className="text-ink">Razorpay</b>
        </div>
      </div>
    </div>
  );
}
