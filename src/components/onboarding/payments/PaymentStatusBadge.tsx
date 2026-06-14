import type { BadgeTone } from "./state";

/**
 * The payment status pill — a small dot plus an uppercase label, coloured by
 * tone. Reuses the .badge typography token; tones map onto the brand palette
 * (neutral = quiet grey, pending = amber, success = green = money, danger =
 * terra). Presentational only.
 */
const TONES: Record<BadgeTone, { wrap: string; dot: string }> = {
  neutral: { wrap: "bg-cream-2 text-muted", dot: "bg-faint" },
  pending: { wrap: "bg-[oklch(94%_0.05_75)] text-[oklch(50%_0.1_70)]", dot: "bg-amber" },
  success: { wrap: "bg-green-soft text-green-deep", dot: "bg-green" },
  danger: { wrap: "bg-[oklch(94%_0.025_45)] text-terra-deep", dot: "bg-terra" },
};

export default function PaymentStatusBadge({
  tone,
  label,
}: {
  tone: BadgeTone;
  label: string;
}) {
  const t = TONES[tone];
  return (
    <span className={`badge inline-flex items-center gap-1.5 ${t.wrap}`}>
      <span className={`size-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
