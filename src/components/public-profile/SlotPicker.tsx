"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

/** IST day bounds [from, to) in UTC ISO for a picked civil date. */
const IST_OFFSET_MS = 330 * 60_000;
function istDayBounds(d: Date): { from: string; to: string } {
  const startUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - IST_OFFSET_MS;
  return { from: new Date(startUtc).toISOString(), to: new Date(startUtc + 86_400_000).toISOString() };
}

function istTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .toLowerCase();
}

export type Slot = { slotStart: string; slotEnd: string };

/**
 * Fetches and shows the creator's open slots for the selected date. Availability
 * comes from the Booking Service (which reads booking_locks — Rule 5), so
 * occupied and pending-reconciliation slots never appear here.
 */
export default function SlotPicker({
  handle,
  serviceId,
  date,
  selected,
  onSelect,
}: {
  handle: string;
  serviceId: string;
  date: Date | null;
  selected: Slot | null;
  onSelect: (s: Slot) => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return; // the early-return render below shows the prompt; slots is unused
    const { from, to } = istDayBounds(date);
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the skeleton before the async fetch
    setLoading(true);
    fetch(`/api/creators/${handle}/slots?serviceId=${encodeURIComponent(serviceId)}&from=${from}&to=${to}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d: { slots?: Slot[] }) => setSlots(d.slots ?? []))
      .catch(() => {
        if (!ctrl.signal.aborted) setSlots([]);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [handle, serviceId, date]);

  if (!date) {
    return (
      <div className="grid place-items-center rounded-2xl border-[1.5px] border-dashed border-line-2 py-10 text-center">
        <p className="text-[14px] font-semibold text-muted">Pick a date to see open times.</p>
      </div>
    );
  }

  if (loading || slots === null) {
    return <div className="h-[120px] animate-pulse rounded-2xl bg-cream-2" aria-hidden="true" />;
  }

  if (slots.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border-[1.5px] border-dashed border-line-2 py-10 text-center">
        <p className="text-[14px] font-semibold text-muted">No open slots that day — try another date.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((s) => {
        const sel = selected?.slotStart === s.slotStart;
        return (
          <button
            key={s.slotStart}
            type="button"
            onClick={() => onSelect(s)}
            aria-pressed={sel}
            className={`rounded-[14px] border-[1.5px] px-3 py-3 text-[13.5px] font-semibold transition-all ${
              sel ? "border-ink bg-ink text-cream" : "cursor-pointer border-line bg-paper text-ink-2 hover:border-terra hover:text-terra-deep"
            }`}
          >
            {istTime(s.slotStart)}
            {sel && <Check className="ml-1 inline size-3.5 align-[-2px]" strokeWidth={3} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
