"use client";

import { useEffect, useState } from "react";
import { Logo } from "./ui";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#product", label: "Product" },
  { href: "#stories", label: "Stories" },
  { href: "#pricing", label: "Pricing" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-100 border-b transition-all duration-350 ${
        scrolled ? "border-line bg-cream/80 backdrop-blur-xl" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-18 max-w-[1160px] items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-1.5 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-[14.5px] font-semibold text-ink-2 transition-colors hover:bg-cream-2 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <a
            href="#"
            className="hidden rounded-full px-3.5 py-2 text-[14.5px] font-bold transition-colors hover:bg-cream-2 md:block"
          >
            Log in
          </a>
          <a href="#final" className="btn btn-grad hidden !px-5 !py-2.5 !text-[14.5px] md:inline-flex">
            Claim your link <span className="arr">→</span>
          </a>
          <button
            className="flex flex-col gap-[5px] p-2.5 md:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <span className="h-0.5 w-[22px] rounded-full bg-ink" />
            <span className="h-0.5 w-[22px] rounded-full bg-ink" />
            <span className="h-0.5 w-[22px] rounded-full bg-ink" />
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-1 border-b border-line bg-cream px-6 pb-6 pt-3 shadow-card md:hidden">
          {[...LINKS, { href: "#", label: "Log in" }].map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="border-b border-line px-2 py-3 font-semibold"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a href="#final" className="btn btn-grad mt-3.5" onClick={() => setOpen(false)}>
            Claim your link →
          </a>
        </div>
      )}
    </header>
  );
}
