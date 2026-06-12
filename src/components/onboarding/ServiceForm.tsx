"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Field from "./Field";
import PhoneFrame from "./PhoneFrame";
import PreviewPane from "./PreviewPane";
import ServiceCard from "../profile/ServiceCard";
import { SERVICE_ICON_MAP } from "../profile/icons/service_icons";
import { saveServiceDraft, type ServiceDraft } from "@/lib/actions/service";

/** Exactly twelve choices — enough range, zero paralysis. */
const ICON_CHOICES = [
  "Target", "Video", "BookOpen", "MessageCircle", "Dumbbell", "Star",
  "Briefcase", "Heart", "Music", "Palette", "Calculator", "Globe",
];
const DURATIONS = [15, 30, 45, 60, 90];
const MIN_PRICE_PAISE = 49 * 100;

export function emptyServiceDraft(): ServiceDraft {
  return {
    iconName: "Target",
    title: "",
    description: "",
    durationMinutes: 60,
    pricePaise: 0,
    compareAtPaise: null,
    meetingLink: "",
  };
}

/** Whole rupees in, paise out; anything non-numeric becomes null. */
function rupeesToPaise(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) * 100 : null;
}

function paiseToRupeeString(paise: number | null): string {
  return paise ? String(Math.round(paise / 100)) : "";
}

/** On blur: add https:// if missing, then demand something URL-shaped. */
function normalizeLink(raw: string): string {
  const v = raw.trim();
  if (!v || /^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function isValidLink(value: string): boolean {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export default function ServiceForm({
  initial,
  handle,
}: {
  initial: ServiceDraft | null;
  handle: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ServiceDraft>(initial ?? emptyServiceDraft);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">("idle");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  /* autosave, debounced 800ms — same contract as the profile step */
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(async () => {
      const res = await saveServiceDraft(draft);
      if (res.success) setSaveState("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [draft, saveState]);

  function update(patch: Partial<ServiceDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setSaveState("dirty");
  }

  function blur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  const errors = {
    title: !draft.title.trim() ? "Give your service a name clients recognise." : null,
    description: !draft.description.trim() ? "A short description is required." : null,
    price:
      draft.pricePaise <= 0
        ? "Set your price — minimum ₹49."
        : draft.pricePaise < MIN_PRICE_PAISE
          ? "Minimum price is ₹49."
          : null,
    compareAt:
      draft.compareAtPaise != null && draft.compareAtPaise <= draft.pricePaise
        ? "Must be higher than your price."
        : null,
    meetingLink: !draft.meetingLink.trim()
      ? "Required — clients receive this after they pay."
      : !isValidLink(draft.meetingLink)
        ? "Paste a full link, like https://meet.google.com/abc-defg-hij"
        : null,
  };

  const show = (key: keyof typeof errors) => (submitted || touched[key] ? errors[key] : null);

  async function onContinue() {
    setSubmitted(true);
    const firstBad = (Object.keys(errors) as (keyof typeof errors)[]).find((k) => errors[k]);
    if (firstBad) {
      document.getElementById(`field-${firstBad}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const res = await saveServiceDraft(draft, { complete: true });
    if (!res.success) return; // stay put; autosave keeps the draft safe
    router.push("/onboarding/availability");
  }

  const descLen = draft.description.length;

  return (
    <div className="grid items-start gap-12 lg:grid-cols-[45fr_55fr]">
      {/* ---------------- left: the form ---------------- */}
      <div className="flex flex-col gap-8">
        <Field id="icon" label="Icon">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Service icon">
            {ICON_CHOICES.map((name) => {
              const Icon = SERVICE_ICON_MAP[name];
              const on = draft.iconName === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={name}
                  onClick={() => update({ iconName: name })}
                  className={`grid size-12 place-items-center rounded-2xl border transition-all duration-150 ease-soft ${
                    on
                      ? "border-ink bg-ink text-cream"
                      : "border-line bg-paper text-ink-2 hover:border-ink"
                  }`}
                >
                  <Icon className="h-5.5 w-5.5" strokeWidth={1.8} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </Field>

        <Field id="title" label="Title" required error={show("title")}>
          <input
            id="title"
            className="field"
            maxLength={60}
            placeholder="1:1 Strategy Call"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            onBlur={() => blur("title")}
          />
        </Field>

        <Field
          id="description"
          label="Description"
          required
          error={show("description")}
          counter={
            <span className={`text-[12px] font-bold tabular-nums ${descLen >= 160 ? "text-amber" : "text-faint"}`}>
              {descLen}/200
            </span>
          }
        >
          <textarea
            id="description"
            className="field min-h-[100px] resize-none"
            maxLength={200}
            placeholder="What they get and what they leave with. Outcomes sell better than agendas."
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            onBlur={() => blur("description")}
          />
        </Field>

        <Field id="duration" label="Duration">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Session duration">
            {DURATIONS.map((d) => {
              const on = draft.durationMinutes === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ durationMinutes: d })}
                  className={`hit-44 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums transition-all duration-150 ease-soft ${
                    on ? "border-ink bg-ink text-cream" : "border-line bg-paper text-ink-2 hover:border-ink"
                  }`}
                >
                  {d} min
                </button>
              );
            })}
          </div>
        </Field>

        <Field id="price" label="Price" required helper="You receive 100% — 0% commission." error={show("price")}>
          <div className="flex items-center overflow-hidden rounded-[14px] border-[1.5px] border-line bg-paper transition-colors focus-within:border-ink">
            <span className="select-none border-r border-line px-3.5 py-[11px] text-[15px] font-semibold text-muted">₹</span>
            <input
              id="price"
              type="text"
              inputMode="numeric"
              className="w-full bg-transparent px-3.5 py-[11px] text-[14.5px] font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-muted"
              placeholder="1,499"
              value={paiseToRupeeString(draft.pricePaise)}
              onChange={(e) => update({ pricePaise: rupeesToPaise(e.target.value) ?? 0 })}
              onBlur={() => blur("price")}
            />
          </div>
        </Field>

        <Field
          id="compareAt"
          label="Compare-at price"
          helper="Optional — shows as ₹X,XXX crossed out above your price."
          error={show("compareAt")}
        >
          <div className="flex items-center overflow-hidden rounded-[14px] border-[1.5px] border-line bg-paper transition-colors focus-within:border-ink">
            <span className="select-none border-r border-line px-3.5 py-[11px] text-[15px] font-semibold text-muted">₹</span>
            <input
              id="compareAt"
              type="text"
              inputMode="numeric"
              className="w-full bg-transparent px-3.5 py-[11px] text-[14.5px] font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-muted"
              placeholder="1,999"
              value={paiseToRupeeString(draft.compareAtPaise)}
              onChange={(e) => update({ compareAtPaise: rupeesToPaise(e.target.value) })}
              onBlur={() => blur("compareAt")}
            />
          </div>
        </Field>

        <Field
          id="meetingLink"
          label="Where sessions happen"
          required
          helper="Your Google Meet or Zoom room link. Sent to clients automatically after payment."
          error={show("meetingLink")}
        >
          <input
            id="meetingLink"
            type="url"
            className="field"
            placeholder="https://meet.google.com/abc-defg-hij"
            value={draft.meetingLink}
            onChange={(e) => update({ meetingLink: e.target.value })}
            onBlur={(e) => {
              const normalized = normalizeLink(e.target.value);
              if (normalized !== e.target.value) update({ meetingLink: normalized });
              blur("meetingLink");
            }}
          />
        </Field>

        {/* ---------------- continue ---------------- */}
        <div className="mt-2 flex items-center gap-4 border-t border-line pt-6">
          <button type="button" onClick={onContinue} className="btn btn-grad btn-lg">
            Continue <span className="arr">→</span>
          </button>
          <span
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 text-[13px] font-bold text-green transition-opacity duration-500 ${
              saveState === "saved" ? "opacity-100" : "opacity-0"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Saved
          </span>
        </div>
        <p className="-mt-4 text-[13px] font-medium text-muted">
          Add more from your dashboard after you go live.
        </p>
      </div>

      {/* ---------------- right: live preview ---------------- */}
      <PreviewPane>
        <PhoneFrame handle={handle}>
          <div className="px-6 pb-10 pt-14">
            <ServiceCard
              service={draft}
              slots={
                <div className="rounded-[18px] border-2 border-dashed border-line-2 bg-paper/70 px-4 py-3.5">
                  <p className="text-[12.5px] font-bold text-muted">Set your availability — next step</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 opacity-45" aria-hidden="true">
                    {["11:00 am", "2:30 pm", "5:00 pm"].map((t) => (
                      <span key={t} className="slot pointer-events-none">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        </PhoneFrame>
      </PreviewPane>
    </div>
  );
}
