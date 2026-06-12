"use client";

import { useEffect, useRef } from "react";

/**
 * The device frame every wizard preview lives in: real phone width (390px)
 * shrunk to the frame, same visual language as the landing mockups.
 *
 * - default: fixed screen, content clipped (the profile step's behavior).
 * - `scrollable`: the screen scrolls like a real phone — used when the
 *   preview is a full page and the editing focus sits below the fold.
 *   `scrollTo` (a CSS selector) brings that focus into view on mount.
 */
export default function PhoneFrame({
  handle,
  scrollable = false,
  scrollTo,
  children,
}: {
  handle: string;
  scrollable?: boolean;
  scrollTo?: string;
  children: React.ReactNode;
}) {
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollable || !scrollTo) return;
    const screen = screenRef.current;
    const target = screen?.querySelector(scrollTo);
    if (!screen || !target) return;
    // geometry-based (zoom-safe): align the target near the top of the screen
    const top =
      target.getBoundingClientRect().top - screen.getBoundingClientRect().top + screen.scrollTop - 24;
    screen.scrollTop = Math.max(0, top);
  }, [scrollable, scrollTo]);

  return (
    <div className="flex flex-col items-center">
      <div className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-terra-deep">How clients see you</div>
      <div className="mt-1 text-[14px] font-bold text-muted">
        <span className="text-faint">creatoros.in/</span>
        <span className="text-ink">{handle}</span>
      </div>

      <div className="mt-5 w-[320px] rounded-[40px] border border-line bg-paper p-[10px] shadow-pop">
        <div
          ref={screenRef}
          className={`relative h-[600px] rounded-[31px] bg-cream ${
            scrollable ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
          }`}
        >
          {/* status-bar notch */}
          {scrollable ? (
            <div className="sticky top-2.5 z-10 h-0">
              <div className="mx-auto h-[5px] w-[84px] rounded-full bg-line-2" />
            </div>
          ) : (
            <div className="absolute left-1/2 top-2.5 z-10 h-[5px] w-[84px] -translate-x-1/2 rounded-full bg-line-2" />
          )}

          {/* real components at true phone width, shrunk to the frame.
              zoom (not transform) so scroll geometry stays honest. */}
          <div
            aria-hidden="true"
            className="pointer-events-none w-[390px] select-none"
            style={{ zoom: 0.7641 }}
          >
            {children}
          </div>

          {/* soft fade where the page continues past the frame */}
          {!scrollable && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-cream to-transparent" />
          )}
        </div>
      </div>
    </div>
  );
}
