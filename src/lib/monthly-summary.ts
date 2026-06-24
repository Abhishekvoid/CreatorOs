import { randomUUID } from "node:crypto";
import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Monthly Income Summary (retention) — one short WhatsApp summary of the
 * previous calendar month per creator, delivered through the EXISTING
 * notification pipeline.
 *
 *   generateMonthlySummary  — the metrics for one creator (read-only, scoped)
 *   renderMonthlySummaryMessage — the short message text (pure)
 *   enqueueMonthlySummaries — insert notification_queue rows, idempotently
 *
 * Revenue uses the same source of truth as the dashboard: confirmed bookings,
 * keyed on confirmation time (bookings.updated_at). Everything is windowed to
 * the previous calendar month relative to `now` and pinned to one creator_id.
 */

export type MonthlySummary = {
  creatorId: string;
  /** ISO first instant of the summarised month */
  periodStart: string;
  /** "YYYY-MM" of the summarised month — the dedup key suffix */
  periodMonth: string;
  /** human month name, e.g. "June" */
  periodLabel: string;
  revenuePaise: number;
  bookings: number;
  repeatClients: number;
  topService: string | null;
};

function num(v: unknown): number {
  return Number(v ?? 0);
}

/** paise → "₹18,500" (whole rupees, Indian digit grouping). */
function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/**
 * Build the previous-month metrics for one creator. `now` defaults to the
 * current instant; the window is [start of (now's month − 1), start of now's
 * month). Deterministic for a fixed `now`. Confirmed bookings only.
 */
export async function generateMonthlySummary(
  creatorId: string,
  db: Executor = getPool(),
  opts: { now?: Date } = {},
): Promise<MonthlySummary> {
  const now = opts.now ?? new Date();

  // Revenue + booking count over confirmed bookings whose confirmation time
  // (updated_at) falls in the previous calendar month. month_start is returned
  // so the label/dedup key derive from the same boundary the SQL used.
  const summary = await db.query(
    `select
        date_trunc('month', $2::timestamptz) - interval '1 month' as month_start,
        coalesce(sum(amount_paise) filter (where in_window), 0) as revenue_paise,
        count(*) filter (where in_window) as bookings
     from (
       select amount_paise,
              (status = 'confirmed'
               and updated_at >= date_trunc('month', $2::timestamptz) - interval '1 month'
               and updated_at <  date_trunc('month', $2::timestamptz)) as in_window
         from public.bookings
        where creator_id = $1
     ) b`,
    [creatorId, now],
  );
  const row = summary.rows[0];
  const monthStart: Date = row.month_start;

  // Repeat clients: distinct customer_phone with >= 2 confirmed bookings in the
  // window. Defined month-locally (not lifetime) so it's deterministic.
  const repeat = await db.query(
    `select count(*) as repeat_clients from (
        select customer_phone
          from public.bookings
         where creator_id = $1
           and status = 'confirmed'
           and customer_phone is not null
           and updated_at >= date_trunc('month', $2::timestamptz) - interval '1 month'
           and updated_at <  date_trunc('month', $2::timestamptz)
         group by customer_phone
        having count(*) >= 2
     ) r`,
    [creatorId, now],
  );

  // Top service: most-booked service in the window (confirmed, with a service),
  // deterministic tie-break by title then id.
  const top = await db.query(
    `select s.title
       from public.bookings b
       join public.services s on s.id = b.service_id
      where b.creator_id = $1
        and b.status = 'confirmed'
        and b.updated_at >= date_trunc('month', $2::timestamptz) - interval '1 month'
        and b.updated_at <  date_trunc('month', $2::timestamptz)
      group by s.id, s.title
      order by count(*) desc, s.title asc, s.id asc
      limit 1`,
    [creatorId, now],
  );

  const y = monthStart.getUTCFullYear();
  const m = monthStart.getUTCMonth(); // 0-based
  return {
    creatorId,
    periodStart: monthStart.toISOString(),
    periodMonth: `${y}-${String(m + 1).padStart(2, "0")}`,
    periodLabel: monthStart.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
    revenuePaise: num(row.revenue_paise),
    bookings: num(row.bookings),
    repeatClients: num(repeat.rows[0]?.repeat_clients),
    topService: top.rows[0]?.title ?? null,
  };
}

/**
 * The short summary message. Deliberately minimal — no marketing, no upsells.
 * The Top Service block is omitted entirely when there's no serviced booking.
 */
export function renderMonthlySummaryMessage(s: MonthlySummary): string {
  const lines = [
    `${s.periodLabel} Summary`,
    "",
    `Revenue: ${formatRupees(s.revenuePaise)}`,
    `Bookings: ${s.bookings}`,
    `Repeat Clients: ${s.repeatClients}`,
  ];
  if (s.topService) {
    lines.push("", "Top Service:", s.topService);
  }
  lines.push("", "Keep growing \u{1F680}");
  return lines.join("\n");
}

export type EnqueueSummary = { enqueued: number };

/**
 * Enqueue the previous month's summary for every creator with a WhatsApp number
 * and at least one confirmed booking that month. Idempotent: the row carries a
 * dedup_key of 'monthly_summary:<creator>:<YYYY-MM>' with `on conflict do
 * nothing`, so a re-fired or retried scheduler run never double-sends. Inserts
 * only — the existing notification worker delivers.
 */
export async function enqueueMonthlySummaries(
  db: Executor = getPool(),
  opts: { now?: Date } = {},
): Promise<EnqueueSummary> {
  const now = opts.now ?? new Date();

  // Creators who had confirmed activity in the window AND can receive WhatsApp.
  const { rows: creators } = await db.query<{ creator_id: string; whatsapp_number: string }>(
    `select distinct b.creator_id, p.whatsapp_number
       from public.bookings b
       join public.profiles p on p.id = b.creator_id
      where b.status = 'confirmed'
        and p.whatsapp_number is not null and p.whatsapp_number <> ''
        and b.updated_at >= date_trunc('month', $1::timestamptz) - interval '1 month'
        and b.updated_at <  date_trunc('month', $1::timestamptz)`,
    [now],
  );

  let enqueued = 0;
  for (const c of creators) {
    const summary = await generateMonthlySummary(c.creator_id, db, { now });
    if (summary.bookings === 0) continue; // defensive; the query already filters
    const payload = {
      recipient: "creator",
      kind: "monthly_summary",
      whatsapp: c.whatsapp_number,
      month: summary.periodMonth,
      revenuePaise: summary.revenuePaise,
      bookings: summary.bookings,
      repeatClients: summary.repeatClients,
      topService: summary.topService,
      text: renderMonthlySummaryMessage(summary),
    };
    const { rowCount } = await db.query(
      `insert into public.notification_queue
         (correlation_id, booking_id, type, channel, payload, dedup_key)
       values ($1, null, 'monthly_summary', 'whatsapp', $2::jsonb, $3)
       on conflict (dedup_key) do nothing`,
      [randomUUID(), JSON.stringify(payload), `monthly_summary:${c.creator_id}:${summary.periodMonth}`],
    );
    enqueued += rowCount ?? 0;
  }
  return { enqueued };
}
