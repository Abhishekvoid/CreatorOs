"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { LogoMark } from "../ui";

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
  bell: "M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5|M10 20a2.2 2.2 0 0 0 4 0",
  menu: "M4 7h16M4 12h16M4 17h16",
  x: "M18 6L6 18M6 6l12 12",
  external: "M14 4h6v6|M20 4l-9 9|M19 13.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5h5.5",
};

/* ---------------- nav ---------------- */
const NAV: { group?: string; items: { label: string; icon: keyof typeof ICONS; active?: boolean; badge?: string }[] }[] = [
  { items: [{ label: "Overview", icon: "overview", active: true }] },
  {
    group: "Business",
    items: [
      { label: "Bookings", icon: "bookings", badge: "3" },
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

/* ---------------- notifications ---------------- */
const NOTIFICATIONS = [
  {
    icon: "bookings" as const,
    tint: "bg-[#FCE9E1] text-terra-deep",
    title: "New booking",
    desc: "Rohit Sharma booked a Career Strategy Call for today, 5:00 PM.",
    time: "2 min ago",
    unread: true,
  },
  {
    icon: "payments" as const,
    tint: "bg-green-soft text-green-deep",
    title: "Payment received — ₹1,499",
    desc: "Via UPI from Rohit Sharma. Settled instantly, 0% fee.",
    time: "2 min ago",
    unread: true,
  },
  {
    icon: "bell" as const,
    tint: "bg-[#FDF3DF] text-[#9A6A14]",
    title: "Reminder sent",
    desc: "WhatsApp reminder delivered to Arjun Mehta for tomorrow's session.",
    time: "1 hr ago",
    unread: false,
  },
  {
    icon: "payments" as const,
    tint: "bg-[#FBEAE7] text-[#B3261E]",
    title: "Payment failed",
    desc: "Sneha's ₹799 payment didn't go through. A retry link was sent.",
    time: "3 hrs ago",
    unread: false,
  },
  {
    icon: "clients" as const,
    tint: "bg-[#FDF3DF] text-[#9A6A14]",
    title: "New review ★★★★★",
    desc: "Kavya Reddy left a 5-star review on Resume Review.",
    time: "Yesterday",
    unread: false,
  },
];

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-5 pb-5 pt-6">
        <a href="/" className="group/logo flex items-center gap-2.5 text-[17px] font-black tracking-tight">
          <LogoMark className="size-[30px] rounded-[10px]" />
          <span>
            Creator<span className="font-medium text-muted">OS</span>
          </span>
        </a>
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
              {section.items.map((item) => (
                <a
                  key={item.label}
                  href="#"
                  aria-current={item.active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-bold transition-colors duration-200 ${
                    item.active ? "bg-ink text-cream shadow-soft" : "text-ink-2 hover:bg-cream-2 hover:text-ink"
                  }`}
                >
                  <Icon d={ICONS[item.icon]} className={`size-[17px] shrink-0 ${item.active ? "" : "text-muted"}`} />
                  {item.label}
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-[#FCE9E1] px-2 py-0.5 text-[11px] font-extrabold text-terra-deep">
                      {item.badge}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3.5">
        <div className="rounded-2xl border border-line bg-cream p-3.5">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-faint">Your public profile</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold">
            <span className="size-1.5 shrink-0 rounded-full bg-green animate-pulse-dot" />
            <span className="truncate">
              <span className="text-faint">creatoros.in/</span>abhishek
            </span>
          </div>
          <a
            href="/meera"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2 text-[12.5px] font-bold text-cream transition-transform duration-200 hover:scale-[1.02]"
          >
            View public profile <Icon d={ICONS.external} className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => setNow(new Date()), []);

  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen lg:pl-[248px]">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-line bg-paper lg:block">
        <SidebarContent />
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
            <SidebarContent />
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
              {now ? `${greeting}, Abhishek 👋` : "Welcome back 👋"}
            </div>
            <div className="text-[11.5px] font-semibold text-muted">{dateLabel ?? " "}</div>
          </div>

          <div className="ml-auto flex min-w-0 flex-1 justify-end sm:max-w-[340px]">
            <label className="flex w-full items-center gap-2.5 rounded-full border border-line bg-paper px-4 py-2 transition-colors duration-200 focus-within:border-ink">
              <Icon d={ICONS.search} className="size-4 shrink-0 text-faint" />
              <input
                type="search"
                placeholder="Search bookings, clients…"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-ink outline-none placeholder:text-muted"
              />
              <kbd className="rounded-md border border-line bg-cream px-1.5 py-0.5 text-[10.5px] font-bold text-faint max-sm:hidden">
                ⌘K
              </kbd>
            </label>
          </div>

          <button
            className="relative grid size-9 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors duration-200 hover:bg-cream-2"
            aria-label="Notifications"
            onClick={() => setNotifOpen(true)}
          >
            <Icon d={ICONS.bell} className="size-[19px]" />
            <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-cream bg-terra" />
          </button>

          <div className="relative shrink-0">
            <button onClick={() => setUserMenu(!userMenu)} aria-label="Account menu" className="block">
              <img
                src="https://randomuser.me/api/portraits/men/32.jpg"
                alt="Abhishek"
                className="size-9 rounded-full border-2 border-white object-cover shadow-soft transition-transform duration-200 hover:scale-105"
              />
            </button>
            {userMenu && (
              <>
                <button aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setUserMenu(false)} />
                <div className="pop-in absolute right-0 top-11 z-50 w-[200px] overflow-hidden rounded-2xl border border-line bg-paper py-1.5 shadow-pop">
                  <div className="border-b border-line px-4 py-2.5">
                    <div className="text-[13.5px] font-extrabold">Abhishek</div>
                    <div className="text-[11.5px] font-semibold text-muted">ab14609a@gmail.com</div>
                  </div>
                  {["View profile", "Settings", "Help centre"].map((l) => (
                    <a key={l} href="#" className="block px-4 py-2 text-[13px] font-bold text-ink-2 hover:bg-cream-2">
                      {l}
                    </a>
                  ))}
                  <a href="#" className="block border-t border-line px-4 py-2 text-[13px] font-bold text-terra-deep hover:bg-cream-2">
                    Sign out
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* notification drawer */}
      <div
        className={`fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] transition-opacity duration-250 ${
          notifOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setNotifOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 right-0 z-60 flex w-[372px] max-w-[92vw] flex-col bg-paper shadow-pop transition-transform duration-300 ease-soft ${
          notifOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Notifications"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="text-[15.5px] font-extrabold tracking-tight">Notifications</div>
          <div className="flex items-center gap-1.5">
            <button className="rounded-full px-3 py-1.5 text-[12px] font-bold text-muted transition-colors duration-200 hover:bg-cream-2 hover:text-ink">
              Mark all read
            </button>
            <button
              aria-label="Close notifications"
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-cream-2"
              onClick={() => setNotifOpen(false)}
            >
              <Icon d={ICONS.x} className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {NOTIFICATIONS.map((n) => (
            <button
              key={n.title}
              className="flex w-full items-start gap-3 border-b border-line px-5 py-4 text-left transition-colors duration-200 hover:bg-cream"
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${n.tint}`}>
                <Icon d={ICONS[n.icon]} className="size-[17px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[13.5px] font-extrabold tracking-tight">
                  {n.title}
                  {n.unread && <span className="size-1.5 shrink-0 rounded-full bg-terra" />}
                </span>
                <span className="mt-0.5 block text-[12.5px] font-medium leading-relaxed text-muted">{n.desc}</span>
                <span className="mt-1 block text-[11px] font-bold text-faint">{n.time}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-line p-4">
          <a href="#" className="block rounded-full bg-cream py-2.5 text-center text-[13px] font-bold text-ink-2 transition-colors duration-200 hover:bg-cream-2">
            View all activity
          </a>
        </div>
      </aside>

      <main className="mx-auto max-w-[1240px] px-5 pb-14 pt-6 sm:px-7">{children}</main>
    </div>
  );
}
