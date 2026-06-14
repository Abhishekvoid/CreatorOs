"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "@/components/ui";
import { requestPayoutNotification } from "@/lib/actions/payment-profile";
import type { PaymentProfile } from "@/lib/payments/profile";
import PaymentStatusBadge from "./PaymentStatusBadge";
import PayoutTimeline from "./PayoutTimeline";
import RouteComingSoonBanner from "./RouteComingSoonBanner";
import { paymentStatusView } from "./state";

/**
 * The Payment Setup experience — the onboarding "Payments" step, rendered for
 * any of the five payment statuses (only `not_started` is reachable today). It
 * tells the truth: client payments work, creator payouts are being prepared,
 * and the creator can publish + accept test bookings now. No fake balances,
 * earnings or analytics.
 *
 * Two actions live here:
 *  - "Notify me when payouts launch" → persists interest (notify_requested_at).
 *  - "Publish my page" → /onboarding/publish (which runs publishProfile() and
 *    shows the publish moment). Publishing is NEVER blocked by payouts.
 */

const WORKS_TODAY = ["Booking system", "Client payments", "Appointment confirmations"];

export default function PaymentSetupCard({ profile }: { profile: PaymentProfile }) {
  const router = useRouter();
  const view = paymentStatusView(profile);
  const [notified, setNotified] = useState(Boolean(profile.notifyRequestedAt));
  const [publishing, startPublish] = useTransition();
  const [, startNotify] = useTransition();

  function onNotify() {
    setNotified(true); // optimistic — interest is low-stakes
    startNotify(async () => {
      const res = await requestPayoutNotification();
      if (!res.success) setNotified(false);
    });
  }

  function onPublish() {
    startPublish(() => {
      router.push("/onboarding/publish");
    });
  }

  return (
    <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-[1fr_360px]">
      {/* ---------------- left: current state ---------------- */}
      <div className="flex flex-col gap-7">
        <div className="rounded-[22px] border border-line bg-paper p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12.5px] font-semibold uppercase tracking-[0.07em] text-muted">
                Payout status
              </div>
              <h2 className="mt-2 text-[19px] font-bold leading-snug tracking-[-0.01em]">
                {view.headline}
              </h2>
            </div>
            <PaymentStatusBadge tone={view.badgeTone} label={view.badgeLabel} />
          </div>
          <p className="mt-2 max-w-[46ch] text-[14px] font-medium text-muted">{view.sub}</p>

          {/* what works today */}
          <div className="mt-6 border-t border-line pt-5">
            <div className="text-[12px] font-bold uppercase tracking-[0.07em] text-green-deep">
              What works today
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {WORKS_TODAY.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
                  <Check className="size-[18px] shrink-0 text-green" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <RouteComingSoonBanner />

        {/* notify CTA */}
        <div>
          <button
            type="button"
            onClick={onNotify}
            disabled={notified}
            className={`btn btn-lg ${notified ? "btn-ghost !cursor-default" : "btn-ghost"}`}
            aria-live="polite"
          >
            {notified ? (
              <>
                <Check className="size-[18px] shrink-0 text-green" />
                You&rsquo;re on the list
              </>
            ) : (
              "Notify me when payouts launch"
            )}
          </button>
          <p className="mt-2.5 text-[12.5px] font-medium text-faint">
            {notified
              ? "We’ll email you the moment creator payouts go live."
              : "We’ll let you know the moment Razorpay Route onboarding opens."}
          </p>
        </div>
      </div>

      {/* ---------------- right: timeline + publish ---------------- */}
      <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
        <div className="rounded-[22px] border border-line bg-paper p-6">
          <div className="mb-5 text-[12.5px] font-semibold uppercase tracking-[0.07em] text-muted">
            The road to payouts
          </div>
          <PayoutTimeline active={view.timelineStage} />
        </div>

        {/* publish — never blocked by payouts */}
        <div className="rounded-[22px] border border-line bg-cream/50 p-6">
          {view.showPublishWarning && (
            <div className="mb-4 flex gap-3 rounded-[14px] border border-[oklch(88%_0.06_75)] bg-[oklch(96.5%_0.03_80)] p-3.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-px size-[18px] shrink-0 text-[oklch(58%_0.12_70)]"
                aria-hidden="true"
              >
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
              <p className="text-[12.5px] font-medium leading-relaxed text-ink-2">
                Payments are not yet enabled. You can publish your page and accept test bookings, but
                creator payouts are not active.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="btn btn-grad btn-lg w-full justify-center"
          >
            {publishing ? "Publishing…" : "Publish my page"}{" "}
            {!publishing && <span className="arr">→</span>}
          </button>
          <p className="mt-3 text-center text-[12.5px] font-medium text-muted">
            Your services and availability are saved.
          </p>
        </div>
      </aside>
    </div>
  );
}
