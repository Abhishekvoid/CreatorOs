import type { Metadata } from "next";
import CheckoutNav from "@/components/booking/CheckoutNav";
import DemoBanner from "@/components/DemoBanner";
import PaymentFlow from "@/components/booking/PaymentFlow";

export const metadata: Metadata = {
  title: "Payment — Book with Meera Shah | CreatorOS",
  description: "Complete your booking with UPI, card or net banking. Secured by Razorpay.",
};

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; t?: string }>;
}) {
  const { d, t } = await searchParams;
  return (
    <>
      <DemoBanner />
      <CheckoutNav backHref="/meera/book" backLabel="Back to booking" />
      <main className="relative min-h-screen overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 420px at 85% 0%, rgba(242,163,60,.10), transparent 60%), radial-gradient(640px 400px at 5% 18%, rgba(226,85,44,.06), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1000px] px-6 pb-[clamp(56px,8vw,96px)] pt-[140px]">
          <div className="h-anim mb-7" style={{ animationDelay: "0.05s" }}>
            <div className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-terra-deep">Step 2 of 2</div>
            <h1 className="mt-1.5 text-[clamp(24px,3.2vw,32px)] font-black tracking-[-0.02em]">
              Complete your <span className="font-serif italic font-normal text-grad">payment.</span>
            </h1>
          </div>
          <div className="h-anim" style={{ animationDelay: "0.15s" }}>
            <PaymentFlow d={d} t={t} />
          </div>
        </div>
      </main>
    </>
  );
}
