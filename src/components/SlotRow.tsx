"use client";

import { useState } from "react";

export type Slot = { time: string; taken?: boolean };

export default function SlotRow({ slots, initial }: { slots: Slot[]; initial: number }) {
  const [selected, setSelected] = useState(initial);

  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((s, i) => (
        <button
          key={s.time}
          type="button"
          disabled={s.taken}
          onClick={() => setSelected(i)}
          className={`slot ${s.taken ? "slot-taken" : ""} ${selected === i ? "slot-sel" : ""}`}
        >
          {s.time}
          {selected === i && " ✓"}
        </button>
      ))}
    </div>
  );
}
