"use client";

import { useEffect, useState } from "react";

export default function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-90 border-t border-line bg-paper/92 backdrop-blur-xl transition-transform duration-400 ease-soft md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-black tracking-tight">
            ₹1,499 <s className="ml-0.5 text-[13px] font-semibold text-faint">₹1,999</s>
          </div>
          <div className="truncate text-[11.5px] font-semibold text-muted">
            1:1 Career Strategy Call · next slot today 5:00 pm
          </div>
        </div>
        <a href="/meera/book" className="btn btn-grad shrink-0 !px-5.5 !py-2.5 !text-[14px]">
          Book now
        </a>
      </div>
    </div>
  );
}
