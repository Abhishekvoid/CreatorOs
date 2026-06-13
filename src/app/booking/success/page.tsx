import type { Metadata } from "next";
import Link from "next/link";
import BookingSuccess from "@/components/booking/BookingSuccess";
import DemoBanner from "@/components/DemoBanner";
import { LogoMark } from "@/components/ui";
import { getConfirmedBooking } from "@/lib/public-profile";

export const metadata: Metadata = {
  title: "Booking confirmed | CreatorOS",
  description: "Your session is booked.",
};

function istDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Success screen. With a `c` (correlationId) it renders the REAL confirmed
 * booking, sourced from the database (never the Razorpay callback). The legacy
 * `d/t/id` query keeps the /meera demo's success screen working.
 */
export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; d?: string; t?: string; id?: string }>;
}) {
  const { c, d, t, id } = await searchParams;

  if (c) {
    const booking = await getConfirmedBooking(c);
    return (
      <main className="relative min-h-screen overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(720px 420px at 50% 0%, rgba(23,138,91,.09), transparent 60%), radial-gradient(640px 400px at 85% 30%, rgba(242,163,60,.08), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[560px] px-6 pb-[clamp(64px,9vw,110px)] pt-[clamp(72px,10vw,110px)] text-center">
          {booking ? (
            <>
              <div className="mx-auto grid size-[88px] place-items-center rounded-full bg-green shadow-[0_18px_44px_-12px_rgba(23,138,91,.55)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" className="size-11" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h1 className="mt-7 text-[clamp(30px,4.4vw,42px)] font-black leading-[1.08] tracking-[-0.025em]">
                Booking confirmed.
                <br />
                <span className="font-serif italic font-normal text-grad">See you there.</span>
              </h1>
              <p className="mt-3.5 text-[15.5px] font-medium text-muted">
                Your {booking.serviceTitle ?? "session"} with {booking.creatorName} is locked in.
              </p>

              <div className="mt-8 overflow-hidden rounded-[26px] border border-line bg-paper text-left shadow-card">
                <dl className="flex flex-col">
                  {[
                    ["Booking ID", booking.bookingId],
                    ["Service", booking.serviceTitle ?? "—"],
                    ["Creator", booking.creatorName],
                    ["When", istDateTime(booking.slotStart)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line px-6 py-4 last:border-0">
                      <dt className="text-[13px] font-semibold text-muted">{k}</dt>
                      <dd className="text-right text-[14px] font-bold tracking-tight">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <p className="mt-6 text-[13px] font-medium text-muted">
                A WhatsApp confirmation and calendar invite are on their way.
              </p>
              <Link href={`/${booking.creatorHandle}`} className="btn btn-ghost btn-lg mt-6">
                Back to {booking.creatorName}&rsquo;s page
              </Link>
            </>
          ) : (
            <>
              <span className="mx-auto mb-6 block size-10 animate-spin rounded-full border-[3px] border-cream-2 border-t-terra" aria-hidden="true" />
              <h1 className="text-[clamp(24px,3.4vw,32px)] font-black tracking-[-0.02em]">Still confirming…</h1>
              <p className="mt-3 font-medium text-muted">
                Your booking isn&rsquo;t confirmed just yet. If you completed payment, this page will be ready shortly — your WhatsApp
                confirmation arrives the moment it is.
              </p>
            </>
          )}
          <footer className="pt-12">
            <Link href="/" className="mx-auto flex w-max items-center gap-2 text-[13px] font-bold text-muted transition-colors hover:text-ink">
              <LogoMark className="size-[20px] rounded-[7px]" />
              Powered by CreatorOS
            </Link>
          </footer>
        </div>
      </main>
    );
  }

  // legacy /meera demo success
  return (
    <main className="relative min-h-screen overflow-hidden">
      <DemoBanner />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 420px at 50% 0%, rgba(23,138,91,.09), transparent 60%), radial-gradient(640px 400px at 85% 30%, rgba(242,163,60,.08), transparent 60%)",
        }}
      />
      <div className="relative pt-9">
        <BookingSuccess d={d} t={t} id={id} />
        <footer className="pb-9">
          <Link href="/" className="group/logo mx-auto flex w-max items-center gap-2 text-[13px] font-bold text-muted transition-colors hover:text-ink">
            <LogoMark className="size-[20px] rounded-[7px]" />
            Powered by CreatorOS
          </Link>
        </footer>
      </div>
    </main>
  );
}
