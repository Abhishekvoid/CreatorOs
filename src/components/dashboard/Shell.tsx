"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Hand, Command } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { LogoMark } from "../ui";
import { firstName, initials } from "./format";

/**
 * The signed-in creator's identity, passed down from the dashboard page (real
 * profile data). Null only in local dev without Supabase, where the Shell
 * falls back to neutral placeholders.
 */
export type ShellCreator = {
  name: string;
  email: string;
  avatarUrl: string | null;
  handle: string;
  isPublished: boolean;
};

/* ---------------- icons (single stroke vocabulary) ---------------- */
function Icon({ d, className = "size-[18px]" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d.split("|").map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

const ICONS = {
  overview: "M3.5 3.5h7v7h-7z|M13.5 3.5h7v7h-7z|M3.5 13.5h7v7h-7z|M13.5 13.5h7v7h-7z",
  bookings: "M16 2.5v4M8 2.5v4M3.5 9.5h17|M3.5 5.5h17v15h-17z|M9 15l2 2 4-4",
  clients:
    "M16.5 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.7A3.7 3.7 0 0 0 3 18.7v1.8|M9.75 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5|M21 20.5v-1.8a3.7 3.7 0 0 0-2.8-3.6|M15.2 4.2a3.75 3.75 0 0 1 0 7.1",
  services: "M2.5 7.5h19v13h-19z|M8 7.5V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5v2|M2.5 13h19",
  products: "M21 8l-9-5-9 5v8l9 5 9-5V8z|M3 8l9 5 9-5|M12 13v8",
  availability: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7.5V12l3 2",
  calendar: "M16 2.5v4M8 2.5v4M3.5 9.5h17|M3.5 5.5h17v15h-17z",
  payments: "M2.5 5.5h19v13h-19z|M2.5 10h19|M6 15h4",
  analytics: "M4.5 20V11|M9.5 20V5|M14.5 20v-6|M19.5 20V9",
  settings: "M4 7.5h9|M17.5 7.5H20|M15.5 5.5v4|M4 16.5h2.5|M11 16.5h9|M8.5 14.5v4",
  search: "M21 21l-4.8-4.8|M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
  menu: "M4 7h16M4 12h16M4 17h16",
  x: "M18 6L6 18M6 6l12 12",
  external: "M14 4h6v6|M20 4l-9 9|M19 13.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5h5.5",
};

/* ---------------- nav ---------------- */
/* Items with an `href` are real, built routes; the rest are placeholders. */
const NAV: { group?: string; items: { label: string; icon: keyof typeof ICONS; href?: string }[] }[] = [
  { items: [{ label: "Overview", icon: "overview", href: "/dashboard" }] },
  {
    group: "Business",
    items: [
      { label: "Bookings", icon: "bookings", href: "/dashboard/bookings" },
      { label: "Clients", icon: "clients" },
      { label: "Services", icon: "services" },
      { label: "Products", icon: "products" },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Availability", icon: "availability" },
      { label: "Calendar", icon: "calendar" },
      { label: "Payments", icon: "payments" },
    ],
  },
  {
    group: "Insights",
    items: [
      { label: "Analytics", icon: "analytics" },
      { label: "Settings", icon: "settings" },
    ],
  },
];

/* ---------------- avatar (real image, or initials fallback) ---------------- */
function Avatar({ creator, className }: { creator: ShellCreator | null; className: string }) {
  if (creator?.avatarUrl) {
    return <img src={creator.avatarUrl} alt={creator.name} className={`${className} object-cover`} />;
  }
  return (
    <span className={`${className} grid place-items-center bg-cream-2 text-[12px] font-extrabold text-ink-2`}>
      {initials(creator?.name ?? null)}
    </span>
  );
}

function SidebarContent({ creator }: { creator: ShellCreator | null }) {
  const pathname = usePathname();
  const isActive = (href?: string) =>
    !href ? false : href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-5 pb-5 pt-6">
        <Link href="/" className="group/logo flex items-center gap-2.5 text-[17px] font-black tracking-tight">
          <LogoMark className="size-[30px] rounded-[10px]" />
          <span>
            Creator<span className="font-medium text-muted">OS</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {NAV.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-5" : ""}>
            {section.group && (
              <div className="mb-1.5 px-3 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-faint">
                {section.group}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const className = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-bold transition-colors duration-200 ${
                  active ? "bg-ink text-cream shadow-soft" : "text-ink-2 hover:bg-cream-2 hover:text-ink"
                }`;
                const inner = (
                  <>
                    <Icon d={ICONS[item.icon]} className={`size-[17px] shrink-0 ${active ? "" : "text-muted"}`} />
                    {item.label}
                  </>
                );
                return item.href ? (
                  <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={className}>
                    {inner}
                  </Link>
                ) : (
                  <a key={item.label} href="#" className={className}>
                    {inner}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {creator && (
        <div className="p-3.5">
          <div className="rounded-2xl border border-line bg-cream p-3.5">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-faint">Your public profile</div>
            {creator.isPublished ? (
              <>
                <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold">
                  <span className="size-1.5 shrink-0 rounded-full bg-green animate-pulse-dot" />
                  <span className="truncate">
                    <span className="text-faint">creatoros.in/</span>
                    {creator.handle}
                  </span>
                </div>
                <a
                  href={`/${creator.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2 text-[12.5px] font-bold text-cream transition-transform duration-200 hover:scale-[1.02]"
                >
                  View public profile <Icon d={ICONS.external} className="size-3.5" />
                </a>
              </>
            ) : (
              <>
                <div className="mt-1.5 text-[13px] font-bold text-muted">Not published yet</div>
                <Link
                  href="/onboarding/publish"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2 text-[12.5px] font-bold text-cream transition-transform duration-200 hover:scale-[1.02]"
                >
                  Publish profile
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Shell({ children, creator = null }: { children: React.ReactNode; creator?: ShellCreator | null }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // hydration gate: the greeting is time-dependent, so SSR and client must both render the null state first
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(new Date()), []);

  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const name = creator ? firstName(creator.name) : "there";

  return (
    <div data-register="product" className="min-h-screen lg:pl-[248px]">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-line bg-paper lg:block">
        <SidebarContent creator={creator} />
      </aside>

      {/* mobile sidebar drawer */}
      {mobileNav && (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileNav(false)}
          />
          <aside className="pop-in fixed inset-y-0 left-0 z-60 w-[264px] bg-paper shadow-pop lg:hidden">
            <button
              aria-label="Close menu"
              className="absolute right-3 top-5 grid size-8 place-items-center rounded-full text-muted hover:bg-cream-2"
              onClick={() => setMobileNav(false)}
            >
              <Icon d={ICONS.x} className="size-4" />
            </button>
            <SidebarContent creator={creator} />
          </aside>
        </>
      )}

      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-cream/85 backdrop-blur-xl">
        <div className="flex h-[64px] items-center gap-3 px-5 sm:px-7">
          <button
            className="grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-cream-2 lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileNav(true)}
          >
            <Icon d={ICONS.menu} className="size-5" />
          </button>

          <div className="min-w-0 max-md:hidden">
            <div className="truncate text-[15.5px] font-extrabold tracking-tight">
              {now ? (
                <span className="inline-flex items-center gap-1.5">{greeting}, {name} <Hand className="size-4 text-amber" strokeWidth={2} aria-hidden="true" /></span>
              ) : (
                <span className="inline-flex items-center gap-1.5">Welcome back <Hand className="size-4 text-amber" strokeWidth={2} aria-hidden="true" /></span>
              )}
            </div>
            <div className="text-[11.5px] font-semibold text-muted">{dateLabel ?? " "}</div>
          </div>

          <div className="ml-auto flex min-w-0 flex-1 justify-end sm:max-w-[340px]">
            <label className="flex w-full items-center gap-2.5 rounded-full border border-line bg-paper px-4 py-2 transition-colors duration-200 focus-within:border-ink">
              <Icon d={ICONS.search} className="size-4 shrink-0 text-faint" />
              <input
                type="search"
                placeholder="Search bookings, clients…"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-ink outline-none placeholder:text-muted"
              />
              <kbd className="inline-flex items-center gap-0.5 rounded-md border border-line bg-cream px-1.5 py-0.5 text-[10.5px] font-bold text-faint max-sm:hidden">
                <Command className="size-3" strokeWidth={2} aria-hidden="true" />K
              </kbd>
            </label>
          </div>

          <div className="relative shrink-0">
            <button onClick={() => setUserMenu(!userMenu)} aria-label="Account menu" className="block">
              <Avatar creator={creator} className="size-9 rounded-full border-2 border-white shadow-soft transition-transform duration-200 hover:scale-105" />
            </button>
            {userMenu && (
              <>
                <button aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setUserMenu(false)} />
                <div className="pop-in absolute right-0 top-11 z-50 w-[210px] overflow-hidden rounded-2xl border border-line bg-paper py-1.5 shadow-pop">
                  <div className="border-b border-line px-4 py-2.5">
                    <div className="truncate text-[13.5px] font-extrabold">{creator?.name ?? "Your account"}</div>
                    {creator?.email && <div className="truncate text-[11.5px] font-semibold text-muted">{creator.email}</div>}
                  </div>
                  {creator?.isPublished && (
                    <a href={`/${creator.handle}`} target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-[13px] font-bold text-ink-2 hover:bg-cream-2">
                      View public profile
                    </a>
                  )}
                  <Link href="/onboarding/profile" className="block px-4 py-2 text-[13px] font-bold text-ink-2 hover:bg-cream-2">
                    Edit profile
                  </Link>
                  <form action={signOut} className="border-t border-line">
                    <button type="submit" className="block w-full px-4 py-2 text-left text-[13px] font-bold text-terra-deep hover:bg-cream-2">
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pb-14 pt-6 sm:px-7">{children}</main>
    </div>
  );
}
