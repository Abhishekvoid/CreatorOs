import { type Executor, getPool } from "@/lib/db/pool";

/**
 * Availability computation.
 *
 * RULE 5 (CRITICAL): availability is computed from booking_locks ONLY,
 * never from bookings.
 *
 *   booking_locks are acquired synchronously at initiate and protected by
 *   the partial unique index. bookings are downstream state and may lag.
 *   Availability reads locks to eliminate race windows.
 */

/** India observes no DST, so IST is a fixed UTC+05:30 the year round. */
const IST_OFFSET_MIN = 330;

/** Lock states that occupy a slot. 'released' deliberately excluded. */
const BLOCKING_STATUSES = ["active", "pending_reconciliation", "confirmed"];

export type AvailableSlot = { slotStart: string; slotEnd: string };

type Window = { dayOfWeek: number; startMin: number; endMin: number };

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** UTC epoch ms for an IST wall-clock instant on a given civil date. */
function istToUtcMs(year: number, monthIndex: number, day: number, minutesIntoDay: number): number {
  return Date.UTC(year, monthIndex, day) + (minutesIntoDay - IST_OFFSET_MIN) * 60_000;
}

/** Civil (Y/M/D) date in IST for a UTC instant. */
function istCivilDate(utcMs: number): { year: number; monthIndex: number; day: number } {
  const shifted = new Date(utcMs + IST_OFFSET_MIN * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/**
 * Available slots for a creator across [from, to), computed from the
 * creator's weekly availability windows minus any slot a live booking_lock
 * overlaps. `slotMinutes` sets the slot length and step (default 60).
 */
export async function getAvailability(
  input: { creatorId: string; from: Date | string; to: Date | string; slotMinutes?: number },
  exec: Executor = getPool(),
): Promise<AvailableSlot[]> {
  const slotMinutes = input.slotMinutes ?? 60;
  const fromMs = new Date(input.from).getTime();
  const toMs = new Date(input.to).getTime();
  if (!(toMs > fromMs)) return [];

  // weekly schedule (the slot *generator*) — not the occupancy source
  const { rows: windowRows } = await exec.query<{ day_of_week: number; start_time: string; end_time: string }>(
    `select day_of_week, start_time, end_time
       from public.availability
      where profile_id = $1 and is_active = true`,
    [input.creatorId],
  );
  const windows: Window[] = windowRows.map((r) => ({
    dayOfWeek: r.day_of_week,
    startMin: parseTimeToMinutes(r.start_time),
    endMin: parseTimeToMinutes(r.end_time),
  }));
  if (windows.length === 0) return [];

  // occupancy — RULE 5: booking_locks only. Overlap test against [from, to).
  const { rows: lockRows } = await exec.query<{ slot_start: Date; slot_end: Date }>(
    `select slot_start, slot_end
       from public.booking_locks
      where creator_id = $1
        and status = any($2)
        and slot_start < $4
        and slot_end > $3`,
    [input.creatorId, BLOCKING_STATUSES, new Date(fromMs), new Date(toMs)],
  );
  const locks = lockRows.map((r) => ({ start: r.slot_start.getTime(), end: r.slot_end.getTime() }));

  // enumerate candidate slots across each IST civil day touched by the range
  const slots: AvailableSlot[] = [];
  const firstDay = istCivilDate(fromMs);
  const spanDays = Math.ceil((toMs - fromMs) / 86_400_000) + 1;

  for (let i = 0; i < spanDays; i++) {
    const { year, monthIndex, day } = firstDay;
    // weekday of this civil date (stable regardless of zone)
    const weekday = new Date(Date.UTC(year, monthIndex, day + i)).getUTCDay();
    for (const w of windows) {
      if (w.dayOfWeek !== weekday) continue;
      for (let t = w.startMin; t + slotMinutes <= w.endMin; t += slotMinutes) {
        const startMs = istToUtcMs(year, monthIndex, day + i, t);
        const endMs = startMs + slotMinutes * 60_000;
        if (startMs < fromMs || startMs >= toMs) continue;
        const blocked = locks.some((l) => l.start < endMs && l.end > startMs);
        if (!blocked) {
          slots.push({ slotStart: new Date(startMs).toISOString(), slotEnd: new Date(endMs).toISOString() });
        }
      }
    }
  }

  slots.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  return slots;
}
