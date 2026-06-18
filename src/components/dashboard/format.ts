/**
 * Presentation helpers for the dashboard. Money is stored in paise and shown
 * in rupees with Indian digit grouping; booking times are stored as UTC
 * timestamptz and shown in IST (the product's single market).
 */

const IST = "Asia/Kolkata";

/** paise → "₹24,500" (no decimals; whole-rupee bookings are the norm). */
export function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/** An ISO instant → IST day + time, e.g. { day: "Fri, 14 Jun", time: "5:00 pm" }. */
export function formatSlot(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: IST,
    }),
    time: d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: IST,
    }),
  };
}

/** Coarse relative time for the activity feed: "just now", "2 hr ago", "3 days ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const secs = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
}

/** First name for greetings/avatars; falls back to the whole string. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Up to two initials from a name, for avatar fallbacks. */
export function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
