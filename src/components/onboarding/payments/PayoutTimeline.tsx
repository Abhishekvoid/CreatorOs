import { TIMELINE_STAGES, type TimelineStage } from "./state";

/**
 * A quiet three-step vertical timeline of the road to creator payouts:
 * Onboarding → Verification → Payouts live. No charts, no numbers — it just
 * shows where the creator is. Steps before the active one read as done, the
 * active one is highlighted, later ones are faint and upcoming.
 */
const STEPS: { stage: TimelineStage; title: string; detail: string }[] = [
  {
    stage: "onboarding",
    title: "Route onboarding",
    detail: "Connect a Razorpay Route account to receive payouts.",
  },
  {
    stage: "verification",
    title: "Verification",
    detail: "Razorpay verifies your details (KYC).",
  },
  {
    stage: "live",
    title: "Payouts live",
    detail: "Booking payments settle directly to you.",
  },
];

export default function PayoutTimeline({ active }: { active: TimelineStage }) {
  const activeIndex = TIMELINE_STAGES.indexOf(active);

  return (
    <ol className="flex flex-col">
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        const last = i === STEPS.length - 1;
        return (
          <li key={step.stage} className="flex gap-3.5">
            {/* marker + connector rail */}
            <div className="flex flex-col items-center">
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                  done
                    ? "border-green-soft bg-green-soft text-green-deep"
                    : current
                      ? "border-ink bg-ink text-cream"
                      : "border-line-2 bg-paper text-faint"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {!last && (
                <span
                  className={`my-1 w-px flex-1 ${done ? "bg-green-soft" : "bg-line"}`}
                  aria-hidden="true"
                />
              )}
            </div>
            {/* label */}
            <div className={last ? "pb-0" : "pb-5"}>
              <div
                className={`text-[14px] font-bold tracking-tight ${
                  current ? "text-ink" : done ? "text-green-deep" : "text-faint"
                }`}
              >
                {step.title}
              </div>
              <p className="mt-0.5 text-[12.5px] font-medium text-muted">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
