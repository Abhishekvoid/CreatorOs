"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "../ui";

const LINKS = [
  { href: "#services", label: "Sessions" },
  { href: "#products", label: "Products" },
  { href: "#reviews", label: "Reviews" },
  { href: "#faq", label: "FAQ" },
];

export default function ProfileNav() {
  const [scrolled, setScrolled] = useState(false);

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
      <div className="mx-auto flex h-18 max-w-[1160px] items-center justify-between gap-3 px-6">
        <a href="/" className="group/logo flex min-w-0 items-center gap-2.5">
          <LogoMark className="size-[30px] shrink-0 rounded-[10px]" />
          <span className="truncate text-[15px] font-bold tracking-tight">
            <span className="text-faint">creatoros.in/</span>meera
          </span>
        </a>

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

        <a href="/meera/book" className="btn btn-grad !px-5 !py-2.5 !text-[14px]">
          Book a session <span className="arr max-sm:hidden">→</span>
        </a>
      </div>
    </header>
  );
}
