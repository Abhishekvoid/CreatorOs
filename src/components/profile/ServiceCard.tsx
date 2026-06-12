import { SERVICE_ICON_MAP } from "./icons/service_icons";

/**
 * The one public service card. It renders on real creator pages
 * (/[handle], when it ships) and — fed live form state — inside the
 * onboarding previews. One component, zero replicas: what creators see
 * while editing is exactly what clients get.
 *
 * Cold-start by design: no stats row, no reviews, no badges. Those appear
 * only once a creator has real bookings, and they're additions to this
 * card, not a different card.
 */

export type PublicService = {
  iconName: string;
  title: string;
  description: string;
  durationMinutes: number;
  pricePaise: number;
  compareAtPaise?: number | null;
};

export function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

export default function ServiceCard({
  service,
  slots,
  bookHref,
}: {
  service: PublicService;
  /** slot chips (or availability placeholder) rendered between meta and CTA */
  slots?: React.ReactNode;
  /** real pages pass the booking route; previews omit it for an inert CTA */
  bookHref?: string;
}) {
  const Icon = SERVICE_ICON_MAP[service.iconName] ?? SERVICE_ICON_MAP.Target;
  const price = formatRupees(service.pricePaise);
  const hasCompare =
    service.compareAtPaise != null && service.compareAtPaise > service.pricePaise;
  const cta = (
    <>
      Book for {price} <span className="arr">→</span>
    </>
  );

  return (
    <div className="relative rounded-[26px] border border-line bg-paper p-6 shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#FCE9E1]">
          <Icon className="h-6 w-6 text-[#1f1a17]" strokeWidth={1.8} />
        </div>
        <div className="text-right">
          {hasCompare && (
            <s className="block text-[13px] font-semibold text-faint">
              {formatRupees(service.compareAtPaise!)}
            </s>
          )}
          <b className="text-[26px] font-black leading-none tracking-tight">{price}</b>
        </div>
      </div>

      <h2 className="mt-4 text-[19px] font-extrabold tracking-tight">
        {service.title.trim() || "Your service"}
      </h2>
      {service.description.trim() && (
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted">
          {service.description}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {[`${service.durationMinutes} min`, "Google Meet"].map((m) => (
          <span
            key={m}
            className="rounded-full border border-line bg-cream px-2.5 py-1 text-[12px] font-bold text-ink-2"
          >
            {m}
          </span>
        ))}
      </div>

      {slots && <div className="mt-5">{slots}</div>}

      {bookHref ? (
        <a href={bookHref} className="btn btn-primary mt-5 w-full">
          {cta}
        </a>
      ) : (
        <span className="btn btn-primary pointer-events-none mt-5 w-full">{cta}</span>
      )}
      <p className="mt-3.5 text-center text-[12px] font-semibold text-muted">
        Pay via UPI · instant confirmation on WhatsApp
      </p>
    </div>
  );
}
