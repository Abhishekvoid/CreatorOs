import type { Metadata } from "next";
import Link from "next/link";
import BookingSuccess from "@/components/booking/BookingSuccess";
import DemoBanner from "@/components/DemoBanner";
import { LogoMark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Booking confirmed | CreatorOS",
  description: "Your session is booked. Meeting link, calendar invite and reminders are on their way.",
};

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; t?: string; id?: string }>;
}) {
  const { d, t, id } = await searchParams;
  return (
    // the one product screen with settle-in choreography: check draws, content follows
    <main className="relative min-h-screen overflow-hidden">
      <DemoBanner />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 420px at 50% 0%, rgba(23,138,91,.09), transparent 60%), radial-gradient(640px 400px at 85% 30%, rgba(242,163,60,.08), transparent 60%)",
        }}
      />
      {/* pt-9 clears the fixed DemoBanner */}
      <div className="relative pt-9">
        <BookingSuccess d={d} t={t} id={id} />
        <footer className="pb-9">
          <Link
            href="/"
            className="group/logo mx-auto flex w-max items-center gap-2 text-[13px] font-bold text-muted transition-colors hover:text-ink"
          >
            <LogoMark className="size-[20px] rounded-[7px]" />
            Powered by CreatorOS
          </Link>
        </footer>
      </div>
    </main>
  );
}
