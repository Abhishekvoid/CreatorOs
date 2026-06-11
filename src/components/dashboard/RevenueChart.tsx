"use client";

import { useState } from "react";

type Range = "7d" | "30d" | "90d" | "12m";

const DATA: Record<Range, { points: number[]; total: string; delta: string; labels: string[] }> = {
  "7d": {
    points: [3.1, 1.8, 4.2, 2.9, 5.4, 4.6, 6.2],
    total: "₹6,300",
    delta: "↑ 9% vs last week",
    labels: ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Today"],
  },
  "30d": {
    points: [2.2, 3.4, 2.8, 4.1, 3.6, 5.2, 4.4, 5.8, 5.1, 6.4, 5.9, 7.2],
    total: "₹24,500",
    delta: "↑ 18% vs last month",
    labels: ["13 May", "28 May", "12 Jun"],
  },
  "90d": {
    points: [1.4, 2.1, 1.8, 2.9, 2.4, 3.6, 3.1, 4.4, 4.0, 5.3, 4.9, 6.5],
    total: "₹58,200",
    delta: "↑ 34% vs prior 90 days",
    labels: ["Mar", "Apr", "May", "Jun"],
  },
  "12m": {
    points: [0.6, 0.9, 1.4, 1.2, 2.0, 2.6, 2.3, 3.4, 4.1, 4.8, 5.6, 7.0],
    total: "₹1,84,000",
    delta: "↑ 2.4× vs last year",
    labels: ["Jul", "Oct", "Jan", "Apr", "Jun"],
  },
};

const W = 640;
const H = 180;
const PAD = 8;

/* catmull-rom → cubic bezier for a calm, smooth line */
function smoothPath(points: number[]) {
  const max = Math.max(...points) * 1.15;
  const xy = points.map((p, i) => [
    PAD + (i * (W - PAD * 2)) / (points.length - 1),
    H - PAD - (p / max) * (H - PAD * 2),
  ]);
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[Math.max(i - 1, 0)];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[Math.min(i + 2, xy.length - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return { d, last: xy[xy.length - 1] };
}

export default function RevenueChart() {
  const [range, setRange] = useState<Range>("30d");
  const data = DATA[range];
  const { d, last } = smoothPath(data.points);

  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Revenue chart">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-extrabold tracking-tight">Revenue</h2>
          <div key={range} className="pop-in mt-1 flex items-baseline gap-2.5">
            <span className="text-[26px] font-black leading-none tracking-tight">{data.total}</span>
            <span className="rounded-full bg-green-soft px-2 py-0.5 text-[11.5px] font-extrabold text-green-deep">
              {data.delta}
            </span>
          </div>
        </div>
        <div className="flex rounded-full border border-line bg-cream p-1" role="tablist" aria-label="Time range">
          {(Object.keys(DATA) as Range[]).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-colors duration-200 ${
                range === r ? "bg-ink text-cream shadow-soft" : "text-muted hover:text-ink"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <svg key={range} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Revenue trend, ${data.total} (${data.delta})`}>
          <defs>
            <linearGradient id="revfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E2552C" stopOpacity=".18" />
              <stop offset="1" stopColor="#E2552C" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 5" />
          ))}
          <path className="chart-area" d={`${d} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`} fill="url(#revfill)" />
          <path className="chart-line" d={d} />
          <circle cx={last[0]} cy={last[1]} r="4.5" fill="var(--color-terra)" stroke="#fff" strokeWidth="2" />
        </svg>
        <div className="mt-1.5 flex justify-between px-1 text-[11px] font-bold text-faint">
          {data.labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
