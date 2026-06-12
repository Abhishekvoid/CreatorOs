/**
 * Weekly availability windows and the "next available" slot computation.
 * Client-safe, no Supabase imports. Day-of-week uses the JS convention
 * (0 = Sunday … 6 = Saturday); the UI presents Monday first.
 */

export type DayWindow = {
  dayOfWeek: number;
  /** "HH:MM", 24-hour */
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const; // Monday first
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wizard default: Mon–Fri 10:00–18:00 on, weekends off. */
export function defaultWindows(): DayWindow[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: "10:00",
    endTime: "18:00",
    isActive: dayOfWeek >= 1 && dayOfWeek <= 5,
  }));
}

/** 30-minute increments, 06:00–23:00. */
export const TIME_OPTIONS: string[] = Array.from({ length: (23 - 6) * 2 + 1 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(time: string): string {
  const minutes = toMinutes(time);
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "am" : "pm"}`;
}

/** Current weekday + minutes-since-midnight in Asia/Kolkata, wherever this runs. */
function nowIST(): { dow: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dow = DAY_SHORT.indexOf(get("weekday"));
  return { dow: dow < 0 ? 0 : dow, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/**
 * The next bookable slots from the weekly schedule: up to two from the first
 * day with openings, then the first opening of following days. Today's slots
 * respect a one-hour lead time snapped to the half hour.
 */
export function nextSlots(windows: DayWindow[], count = 3): string[] {
  const { dow, minutes } = nowIST();
  const labels: string[] = [];

  for (let offset = 0; offset < 7 && labels.length < count; offset++) {
    const day = (dow + offset) % 7;
    const w = windows.find((x) => x.dayOfWeek === day && x.isActive);
    if (!w) continue;

    let start = toMinutes(w.startTime);
    const end = toMinutes(w.endTime);
    if (offset === 0) {
      start = Math.max(start, Math.ceil((minutes + 60) / 30) * 30);
    }
    if (start >= end) continue;

    const dayLabel = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : DAY_SHORT[day];
    const perDay = labels.length === 0 ? Math.min(2, count) : 1;
    for (let i = 0; i < perDay && start < end && labels.length < count; i++) {
      const h = Math.floor(start / 60);
      const m = start % 60;
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      labels.push(`${dayLabel} · ${formatTime(time)}`);
      start += 120; // a believable spread, not back-to-back chips
    }
  }
  return labels;
}
