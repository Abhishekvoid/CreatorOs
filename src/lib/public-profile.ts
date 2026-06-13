import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Server-only read model for the public creator page and the booking success
 * screen. Both are strictly READ-ONLY. They read through the trusted server
 * pool (the booking layer's connection); the browser never reaches these.
 *
 * The success view sources truth from the confirmed `bookings` row — never from
 * a Razorpay callback payload.
 */

export type PublicCreator = {
  id: string;
  handle: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatar: string | null;
  location: string | null;
  languages: string[];
  highlights: string[];
  socials: Record<string, string>;
};

export type PublicService = {
  id: string;
  title: string;
  description: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  durationMinutes: number | null;
  iconName: string | null;
};

export type CreatorPage = { creator: PublicCreator; services: PublicService[] };

/**
 * Load a PUBLISHED creator by handle plus its active booking services. Returns
 * null when the handle doesn't exist or isn't published — the page renders a
 * 404 in that case.
 */
export async function loadCreatorPage(handle: string, db: Executor = getPool()): Promise<CreatorPage | null> {
  const { rows } = await db.query<{
    id: string;
    handle: string;
    display_name: string | null;
    title: string | null;
    bio: string | null;
    avatar_url: string | null;
    location: string | null;
    languages: string[] | null;
    experience_highlights: string[] | null;
    social_links: Record<string, string> | null;
  }>(
    `select id, handle, display_name, title, bio, avatar_url, location,
            languages, experience_highlights, social_links
       from public.profiles
      where handle = $1 and is_published = true`,
    [handle],
  );
  const p = rows[0];
  if (!p) return null;

  const { rows: serviceRows } = await db.query<{
    id: string;
    title: string;
    description: string | null;
    price_paise: number;
    compare_at_paise: number | null;
    duration_minutes: number | null;
    icon_name: string | null;
  }>(
    `select id, title, description, price_paise, compare_at_paise, duration_minutes, icon_name
       from public.services
      where profile_id = $1 and is_active = true and type = 'booking'
      order by sort_order, created_at`,
    [p.id],
  );

  return {
    creator: {
      id: p.id,
      handle: p.handle,
      name: p.display_name ?? p.handle,
      title: p.title,
      bio: p.bio,
      avatar: p.avatar_url,
      location: p.location,
      languages: p.languages ?? [],
      highlights: p.experience_highlights ?? [],
      socials: p.social_links ?? {},
    },
    services: serviceRows.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      pricePaise: s.price_paise,
      compareAtPaise: s.compare_at_paise,
      durationMinutes: s.duration_minutes,
      iconName: s.icon_name,
    })),
  };
}

export type ConfirmedBooking = {
  bookingId: string;
  status: string;
  slotStart: string;
  slotEnd: string;
  amountPaise: number;
  currency: string;
  serviceTitle: string | null;
  durationMinutes: number | null;
  creatorHandle: string;
  creatorName: string;
};

/**
 * The success screen's data source: the booking, joined to its service and
 * creator, ONLY when it has reached `confirmed`. Returns null while still
 * pending/cancelled/expired so the success page redirects back to confirming.
 */
export async function getConfirmedBooking(
  correlationId: string,
  db: Executor = getPool(),
): Promise<ConfirmedBooking | null> {
  const { rows } = await db.query<{
    booking_id: string;
    status: string;
    slot_start: Date;
    slot_end: Date;
    amount_paise: number;
    currency: string;
    service_title: string | null;
    duration_minutes: number | null;
    creator_handle: string;
    creator_name: string | null;
  }>(
    `select b.id as booking_id, b.status, b.slot_start, b.slot_end, b.amount_paise, b.currency,
            s.title as service_title, s.duration_minutes,
            p.handle as creator_handle, p.display_name as creator_name
       from public.bookings b
       join public.profiles p on p.id = b.creator_id
       left join public.services s on s.id = b.service_id
      where b.correlation_id = $1 and b.status = 'confirmed'
      limit 1`,
    [correlationId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    bookingId: r.booking_id,
    status: r.status,
    slotStart: r.slot_start.toISOString(),
    slotEnd: r.slot_end.toISOString(),
    amountPaise: r.amount_paise,
    currency: r.currency,
    serviceTitle: r.service_title,
    durationMinutes: r.duration_minutes,
    creatorHandle: r.creator_handle,
    creatorName: r.creator_name ?? r.creator_handle,
  };
}
