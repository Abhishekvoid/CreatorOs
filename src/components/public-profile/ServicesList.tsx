import type { PublicService } from "@/lib/public-profile";
import ServiceCard from "./ServiceCard";

/** All of a creator's bookable services. Empty-state when none exist yet. */
export default function ServicesList({ handle, services }: { handle: string; services: PublicService[] }) {
  if (services.length === 0) {
    return (
      <section id="services" className="py-[clamp(48px,7vw,80px)]">
        <div className="mx-auto max-w-[1160px] px-6">
          <div className="grid place-items-center rounded-[26px] border-[1.5px] border-dashed border-line-2 py-16 text-center">
            <p className="text-[15px] font-semibold text-muted">No services available to book yet.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="py-[clamp(48px,7vw,80px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <h2 className="mb-[clamp(24px,4vw,40px)] text-[clamp(24px,3.4vw,34px)] font-bold tracking-[-0.025em]">
          Book a session
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.id} handle={handle} service={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
