"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The confirming screen. The browser callback is NOT authority — after checkout
 * we land here and POLL our own backend for the booking's real status, which
 * only changes when a webhook/sweep drives the Processor. We never query
 * Razorpay and never mark anything paid.
 */
type Phase = "confirming" | "confirmed" | "failed" | "slow";

export default function ConfirmingPoller({ correlationId }: { correlationId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("confirming");

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const MAX_TRIES = 40; // ~80s at 2s

    async function tick() {
      if (cancelled) return;
      tries += 1;
      try {
        const res = await fetch(`/api/bookings/status?correlationId=${encodeURIComponent(correlationId)}`, { cache: "no-store" });
        const data = (await res.json()) as { status?: string };
        if (cancelled) return;
        if (data.status === "confirmed") {
          setPhase("confirmed");
          router.push(`/booking/success?c=${encodeURIComponent(correlationId)}`);
          return;
        }
        if (data.status === "cancelled" || data.status === "expired") {
          setPhase("failed");
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (tries >= MAX_TRIES) {
        setPhase("slow");
        return;
      }
      setTimeout(tick, 2000);
    }

    const t = setTimeout(tick, 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [correlationId, router]);

  return (
    <div className="mx-auto max-w-[520px] px-6 py-24 text-center">
      {phase === "failed" ? (
        <>
          <h1 className="text-[clamp(24px,3.4vw,32px)] font-black tracking-[-0.02em]">Payment didn&rsquo;t go through</h1>
          <p className="mt-3 font-medium text-muted">No charge was confirmed and the slot has been released. You can try booking again.</p>
        </>
      ) : phase === "slow" ? (
        <>
          <h1 className="text-[clamp(24px,3.4vw,32px)] font-black tracking-[-0.02em]">Still confirming…</h1>
          <p className="mt-3 font-medium text-muted">
            This is taking longer than usual. If you completed payment, your confirmation will arrive shortly on WhatsApp — you can
            safely close this page.
          </p>
        </>
      ) : (
        <>
          <span className="mx-auto mb-6 block size-10 animate-spin rounded-full border-[3px] border-cream-2 border-t-terra" aria-hidden="true" />
          <h1 className="text-[clamp(24px,3.4vw,32px)] font-black tracking-[-0.02em]">
            Confirming your <span className="font-serif italic font-normal text-grad">payment…</span>
          </h1>
          <p className="mt-3 font-medium text-muted">Hang tight — we&rsquo;re confirming your booking. This usually takes a few seconds.</p>
        </>
      )}
    </div>
  );
}
