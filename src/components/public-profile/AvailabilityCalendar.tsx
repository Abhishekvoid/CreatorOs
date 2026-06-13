"use client";

import { useEffect, useState } from "react";

/**
 * A lean date picker (IST). It only picks a civil date; whether a date has open
 * slots is determined by the server (SlotPicker fetches them). Past dates are
 * disabled. Two months of forward range.
 */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function AvailabilityCalendar({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const [today, setToday] = useState<Date | null>(null);
  // gate on mount so SSR and client agree
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToday(startOfDay(new Date())), []);
  const [offset, setOffset] = useState(0);

  if (!today) return <div className="h-[316px] animate-pulse rounded-2xl bg-cream-2" aria-hidden="true" />;

  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const lead = (view.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[15.5px] font-bold tracking-tight">
          {view.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </div>
        <div className="flex gap-1.5">
          {[
            { dir: -1, label: "Previous month" },
            { dir: 1, label: "Next month" },
          ].map((b) => {
            const disabled = b.dir === -1 ? offset === 0 : offset === 2;
            return (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                disabled={disabled}
                onClick={() => setOffset(offset + b.dir)}
                className={`grid size-8 place-items-center rounded-full border border-line text-ink-2 transition-all ${
                  disabled ? "cursor-default opacity-35" : "cursor-pointer hover:border-ink"
                }`}
              >
                {b.dir === -1 ? "‹" : "›"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`x${i}`} />;
          const open = d >= today;
          const sel = selected !== null && sameDay(d, selected);
          return (
            <button
              key={d.getTime()}
              type="button"
              disabled={!open}
              onClick={() => onSelect(d)}
              aria-pressed={sel}
              className={`grid aspect-square place-items-center rounded-[12px] text-[13.5px] font-semibold transition-all ${
                sel ? "bg-ink text-cream" : open ? "cursor-pointer text-ink hover:bg-cream-2" : "cursor-default text-faint/60"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
