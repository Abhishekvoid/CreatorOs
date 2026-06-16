"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Check, Logo } from "./ui";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Bookings", href: "#features" },
      { label: "UPI Payments", href: "#features" },
      { label: "Client CRM", href: "#features" },
      { label: "WhatsApp Automation", href: "#features" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Creator playbook", href: "#" },
      { label: "Pricing calculator", href: "#" },
      { label: "Switch from Topmate", href: "#" },
      { label: "Help center", href: "#" },
      { label: "API docs", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

function SocialIcon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="grid size-9 place-items-center rounded-[11px] border border-line text-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-cream"
    >
      {children}
    </a>
  );
}

export default function Footer() {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="border-t border-line bg-paper pb-9 pt-16">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="mb-12 grid gap-9 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.4fr] max-lg:grid-cols-2">
          <div className="max-lg:col-span-full">
            <Logo />
            <p className="mb-4.5 mt-4 max-w-[250px] text-sm font-medium text-muted">
              The booking &amp; payments operating system for creators, coaches, consultants and tutors. One link. 0%
              commission.
            </p>
            <div className="flex gap-2">
              <SocialIcon label="Twitter / X">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.2l7.3-8.3L1.8 2h6.4l4.4 5.9L18.9 2zm-1.1 18.1h1.7L7.3 3.8H5.5l12.3 16.3z" /></svg>
              </SocialIcon>
              <SocialIcon label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" /></svg>
              </SocialIcon>
              <SocialIcon label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M23 7.2a3 3 0 0 0-2.1-2.2C19 4.5 12 4.5 12 4.5s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.2zM9.8 15.3V8.7l6 3.3-6 3.3z" /></svg>
              </SocialIcon>
              <SocialIcon label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0zM.3 8.3h4.4V24H.3V8.3zm7.6 0h4.2v2.1h.1c.6-1.1 2-2.3 4.2-2.3 4.5 0 5.3 3 5.3 6.8V24h-4.4v-7.9c0-1.9 0-4.3-2.6-4.3s-3 2-3 4.1V24H7.9V8.3z" /></svg>
              </SocialIcon>
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-faint">{col.title}</h4>
              {col.links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="block py-[5px] text-sm font-semibold text-ink-2 transition-colors hover:text-terra-deep"
                >
                  {l.label}
                </a>
              ))}
            </div>
          ))}

          <div>
            <h4 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-faint">
              Creator economy, weekly
            </h4>
            <p className="mb-3.5 text-sm font-medium text-muted">
              One email a week on pricing, packaging and getting booked. No fluff.
            </p>
            <form
              className="flex rounded-full border border-line bg-cream p-1 transition-colors focus-within:border-ink"
              onSubmit={(e) => {
                e.preventDefault();
                setSubscribed(true);
              }}
            >
              <input
                type="email"
                placeholder="you@email.com"
                aria-label="Email address"
                required
                className="min-w-0 flex-1 bg-transparent px-3.5 py-2 text-[13.5px] font-semibold text-ink outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-ink px-4.5 py-2 text-[13px] font-bold text-cream transition-transform duration-300 ease-spring hover:scale-104"
              >
                {subscribed ? (
                  <span className="inline-flex items-center gap-1.5">Done <Check className="size-3.5 text-current" /></span>
                ) : (
                  "Subscribe"
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6.5 max-md:flex-col max-md:items-start">
          <p className="text-[13px] font-semibold text-faint">
            © 2026 CreatorOS Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex gap-5.5">
            {["Privacy", "Terms", "Refunds", "Security"].map((l) => (
              <a key={l} href="#" className="text-[13px] font-semibold text-muted transition-colors hover:text-ink">
                {l}
              </a>
            ))}
          </div>
          <p className="inline-flex items-center gap-1 text-[13px] font-semibold text-faint">
            Made with <Heart className="size-3.5 text-terra" fill="currentColor" strokeWidth={0} aria-hidden="true" /> in India
          </p>
        </div>
      </div>
    </footer>
  );
}
