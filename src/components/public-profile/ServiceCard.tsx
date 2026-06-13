import Link from "next/link";
import { SERVICE_ICON_MAP } from "@/components/profile/icons/service_icons";
import type { PublicService } from "@/lib/public-profile";

/** Rupees from paise, Indian grouping. */
export const inr = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");

/**
 * One bookable service. Data-driven (no Meera/demo data). Links into the real
 * booking flow at /[handle]/book?service={id}. `featured` gives the hero
 * treatment used as the profile header's booking card.
 */
export default function ServiceCard({
  handle,
  service,
  featured = false,
}: {
  handle: string;
  service: PublicService;
  featured?: boolean;
}) {
  const Icon = SERVICE_ICON_MAP[service.iconName ?? "Target"] ?? SERVICE_ICON_MAP.Target;
  const bookHref = `/${handle}/book?service=${service.id}`;
  const meta = [
    service.durationMinutes ? `${service.durationMinutes} min` : null,
    "Google Meet",
  ].filter(Boolean) as string[];

  return (
    <div
      className={`relative flex h-full flex-col rounded-[26px] border border-line bg-paper p-6.5 ${
        featured ? "shadow-pop" : "shadow-soft transition-all duration-400 hover:-translate-y-1.5 hover:shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream-2">
          <Icon className="size-6 text-ink" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <div className="text-right">
          {service.compareAtPaise && service.compareAtPaise > service.pricePaise && (
            <s className="block text-[13px] font-semibold text-faint">{inr(service.compareAtPaise)}</s>
          )}
          <b className="text-[24px] font-black leading-none tracking-tight">{inr(service.pricePaise)}</b>
        </div>
      </div>

      <h3 className="mt-4 text-[19px] font-extrabold tracking-tight">{service.title}</h3>
      {service.description && (
        <p className="mt-1.5 flex-1 text-sm font-medium leading-relaxed text-muted">{service.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {meta.map((m) => (
          <span key={m} className="rounded-full border border-line bg-cream px-2.5 py-1 text-[12px] font-bold text-ink-2">
            {m}
          </span>
        ))}
      </div>

      <Link href={bookHref} className={`btn ${featured ? "btn-grad" : "btn-primary"} mt-5 w-full`}>
        Book for {inr(service.pricePaise)} <span className="arr">→</span>
      </Link>
    </div>
  );
}
