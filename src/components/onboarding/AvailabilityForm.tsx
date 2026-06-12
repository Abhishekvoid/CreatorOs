"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhoneFrame from "./PhoneFrame";
import PreviewPane from "./PreviewPane";
import { toHeaderData } from "./PhonePreview";
import ProfileHeader from "../profile/ProfileHeader";
import ServiceCard from "../profile/ServiceCard";
import { saveAvailability } from "@/lib/actions/availability";
import type { ServiceDraft } from "@/lib/actions/service";
import type { CreatorDraft } from "@/lib/creator";
import {
  DAY_NAMES,
  DAY_ORDER,
  defaultWindows,
  formatTime,
  nextSlots,
  TIME_OPTIONS,
  type DayWindow,
} from "@/lib/slots";

function TimeSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="field w-auto cursor-pointer !px-3 !py-2 text-[13.5px] tabular-nums"
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {formatTime(t)}
        </option>
      ))}
    </select>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`hit-44 relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ease-soft ${
        on ? "bg-ink" : "bg-line-2"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-paper shadow-soft transition-[left] duration-200 ease-soft ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AvailabilityForm({
  initial,
  profile,
  service,
}: {
  initial: DayWindow[] | null;
  profile: CreatorDraft;
  service: ServiceDraft | null;
}) {
  const router = useRouter();
  const [windows, setWindows] = useState<DayWindow[]>(initial ?? defaultWindows);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">("idle");

  const rowError = (w: DayWindow) =>
    w.isActive && w.startTime >= w.endTime ? "End time must be after the start." : null;
  const allValid = windows.every((w) => !rowError(w));
  const allOff = windows.every((w) => !w.isActive);
  const slots = nextSlots(windows);

  /* autosave, debounced 800ms — held while any row is invalid */
  useEffect(() => {
    if (saveState !== "dirty" || !allValid) return;
    const t = setTimeout(async () => {
      const res = await saveAvailability(windows);
      if (res.success) setSaveState("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [windows, saveState, allValid]);

  function patch(dayOfWeek: number, p: Partial<DayWindow>) {
    setWindows((ws) => ws.map((w) => (w.dayOfWeek === dayOfWeek ? { ...w, ...p } : w)));
    setSaveState("dirty");
  }

  async function onContinue() {
    if (!allValid) return; // the offending row already shows its error
    const res = await saveAvailability(windows, { complete: true });
    if (!res.success) return;
    router.push("/onboarding/payments");
  }

  return (
    <div className="grid items-start gap-12 lg:grid-cols-[45fr_55fr]">
      {/* ---------------- left: the weekly schedule ---------------- */}
      <div className="flex flex-col">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-[13.5px] font-semibold tracking-tight">Weekly hours</span>
          <span className="text-[12px] font-bold text-faint">Asia/Kolkata · IST</span>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-line bg-paper">
          {DAY_ORDER.map((day, i) => {
            const w = windows.find((x) => x.dayOfWeek === day)!;
            const error = rowError(w);
            return (
              <div key={day} className={i > 0 ? "border-t border-line" : undefined}>
                <div className="flex min-h-[58px] items-center gap-4 px-4 py-2.5">
                  <Toggle
                    on={w.isActive}
                    onChange={(v) => patch(day, { isActive: v })}
                    label={`${DAY_NAMES[day]} availability`}
                  />
                  <span className={`w-[88px] text-[14px] font-bold ${w.isActive ? "text-ink" : "text-faint"}`}>
                    {DAY_NAMES[day]}
                  </span>
                  {w.isActive ? (
                    <div className="ml-auto flex items-center gap-2">
                      <TimeSelect
                        value={w.startTime}
                        onChange={(v) => patch(day, { startTime: v })}
                        label={`${DAY_NAMES[day]} start time`}
                      />
                      <span className="text-[13px] font-semibold text-faint">–</span>
                      <TimeSelect
                        value={w.endTime}
                        onChange={(v) => patch(day, { endTime: v })}
                        label={`${DAY_NAMES[day]} end time`}
                      />
                    </div>
                  ) : (
                    <span className="ml-auto pr-1 text-[13px] font-semibold text-faint">Unavailable</span>
                  )}
                </div>
                {error && (
                  <p className="px-4 pb-2.5 pl-[72px] text-[12px] font-semibold text-terra-deep">{error}</p>
                )}
              </div>
            );
          })}
        </div>

        {allOff && (
          <p className="mt-4 rounded-[14px] bg-[oklch(96%_0.03_85)] px-4 py-3 text-[13px] font-semibold text-[#9A6A14]">
            No available slots — clients won&rsquo;t be able to book you.
          </p>
        )}

        {/* ---------------- continue ---------------- */}
        <div className="mt-8 flex items-center gap-4 border-t border-line pt-6">
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
        <p className="mt-4 text-[13px] font-medium text-muted">
          One window per day keeps the wizard quick — fine-tune from your dashboard anytime.
        </p>
      </div>

      {/* ---------------- right: the full page, slots live ---------------- */}
      <PreviewPane>
        <PhoneFrame handle={profile.handle || "you"} scrollable scrollTo="#preview-service">
          <ProfileHeader
            creator={toHeaderData(profile)}
            coldStart
            stacked
            compactTop
            serviceSlot={
              service ? (
                <div id="preview-service">
                  <ServiceCard
                    service={service}
                    slots={
                      slots.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {slots.map((label) => (
                            <span key={label} className="slot pointer-events-none">
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : undefined
                    }
                  />
                  {slots.length === 0 && (
                    <p className="mt-3 text-center text-[12.5px] font-semibold text-muted">No slots yet</p>
                  )}
                </div>
              ) : undefined
            }
          />
        </PhoneFrame>
      </PreviewPane>
    </div>
  );
}
