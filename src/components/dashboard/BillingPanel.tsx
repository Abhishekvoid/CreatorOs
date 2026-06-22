"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cancelProAction, upgradeToProAction } from "@/lib/actions/billing";
import type { BillingOverview } from "@/lib/billing/overview";

/**
 * Billing surface (V1): plan + status + usage + one action. The plan is NEVER
 * set from the client — Upgrade kicks off Razorpay checkout and the page then
 * shows "activating…" until the subscription.activated webhook flips the plan
 * server-side (same discipline as bookings). No invoices, no history.
 */

const PRO_PRICE = "₹499";
// Only what we actually deliver today. Adding a benefit here is a promise — keep
// this list honest until the feature is built and plan-gated.
const PRO_BENEFITS = ["Unlimited bookings every month", "Unlimited services"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** Label for the next monthly quota reset (1st of next month, IST). */
function nextResetLabel(): string {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "numeric", year: "numeric" }).formatToParts(new Date());
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 1)).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

export default function BillingPanel({ overview }: { overview: BillingOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isActivating = overview.status === "pending";

  // While a subscription is activating, poll for the webhook-driven flip to Pro.
  useEffect(() => {
    if (!isActivating) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [isActivating, router]);

  function onUpgrade() {
    setError(null);
    startTransition(async () => {
      const res = await upgradeToProAction();
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        router.refresh();
      }
    });
  }

  function onCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelProAction();
      if (!res.success) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  const isPro = overview.plan === "pro";

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[22px] font-extrabold tracking-tight">Billing</h1>
        <p className="mt-1 text-[13.5px] font-medium text-muted">
          {isPro
            ? "You're on Pro — everything unlocked. You keep 100% of every booking."
            : "You keep 100% of every booking — CreatorOS never takes a commission. Free covers 5 bookings a month."}
        </p>
      </header>

      {/* current plan + status */}
      <section className="rounded-[24px] border border-line bg-paper p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-black tracking-tight">{isPro ? "Pro" : "Free"}</span>
              {isPro && (
                <span className="rounded-full bg-green/12 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green">
                  Active
                </span>
              )}
              {isActivating && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/12 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber">
                  <Loader2 className="size-3 animate-spin" strokeWidth={2.5} /> Activating
                </span>
              )}
            </div>
            {isPro && overview.currentPeriodEnd && (
              <p className="mt-1 text-[13px] font-semibold text-muted">Renews {fmtDate(overview.currentPeriodEnd)}</p>
            )}
          </div>
          {isPro && !isActivating && (
            <button
              onClick={onCancel}
              disabled={pending}
              className="rounded-full border border-line px-4 py-2 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-cream-2 disabled:opacity-50"
            >
              Cancel plan
            </button>
          )}
        </div>

        {isActivating && (
          <p className="mt-4 rounded-xl bg-cream-2 px-4 py-3 text-[13px] font-medium text-ink-2">
            We&apos;re waiting for your payment to confirm. This page updates automatically — no need to refresh.
          </p>
        )}
      </section>

      {/* usage — always shown for Free so quota is visible before the wall */}
      {!isPro && (
        <section className="rounded-[24px] border border-line bg-paper p-6 shadow-soft">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-faint">
            This month <span className="text-muted">· resets {nextResetLabel()}</span>
          </h2>
          <UsageRow
            label="Bookings"
            used={overview.usage.confirmedThisMonth}
            limit={overview.usage.bookingLimit}
            atLimit={overview.usage.atBookingLimit}
          />
          <UsageRow label="Services" used={overview.usage.services} limit={overview.usage.serviceLimit} atLimit={overview.usage.services >= overview.usage.serviceLimit} />
        </section>
      )}

      {/* upgrade card — the focus of V1 billing */}
      {!isPro && (
        <section className="glow-tr relative overflow-hidden rounded-[24px] border border-[#2E2A21] bg-linear-165 from-[#211E17] to-[#191712] p-6 text-cream shadow-card">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber" strokeWidth={2} />
            <h2 className="text-[18px] font-black tracking-tight">Upgrade to Pro</h2>
          </div>
          <p className="mt-1 text-[13.5px] font-medium text-[#B5B0A4]">
            {PRO_PRICE}
            <span className="text-[#8E897D]">/month · cancel anytime</span>
          </p>
          <p className="mt-1.5 text-[12.5px] font-medium text-[#8E897D]">
            You always keep 100% of your booking revenue — we never take a cut.
          </p>
          <ul className="mt-4 grid gap-2">
            {PRO_BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-[13.5px] font-medium">
                <Check className="size-[18px] shrink-0 text-green" /> {b}
              </li>
            ))}
          </ul>
          <button
            onClick={onUpgrade}
            disabled={pending || isActivating}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cream py-3 text-[14px] font-extrabold text-ink transition-transform duration-200 hover:scale-[1.01] disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> : null}
            {pending ? "Starting…" : `Upgrade to Pro — ${PRO_PRICE}/mo`}
          </button>
          <p className="mt-2 text-center text-[11.5px] font-medium text-[#8E897D]">
            Auto-renews monthly via UPI. Cancel anytime, no questions.
          </p>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-terra/30 bg-terra/8 px-4 py-3 text-[13px] font-semibold text-terra-deep">
          {error}
        </p>
      )}
    </div>
  );
}

function UsageRow({ label, used, limit, atLimit }: { label: string; used: number; limit: number; atLimit: boolean }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const remaining = limit > 0 ? Math.max(0, limit - used) : -1;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-[13.5px] font-bold">
        <span>{label}</span>
        <span className={atLimit ? "text-terra-deep" : "text-ink-2"}>
          {used} / {limit}
          {atLimit ? " · limit reached" : remaining > 0 ? ` · ${remaining} left` : ""}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-2">
        <div className={`h-full rounded-full ${atLimit ? "bg-terra" : "bg-ink"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
