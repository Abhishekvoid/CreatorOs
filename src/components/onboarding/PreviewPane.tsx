"use client";

import { useState } from "react";

/**
 * The preview column shared by every two-column wizard step: sticky on
 * desktop, a floating button + bottom sheet on mobile. Render it as the
 * second child of the step's grid.
 */
export default function PreviewPane({ children }: { children: React.ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div className="sticky top-10 max-lg:hidden">{children}</div>

      {/* mobile: floating preview button + bottom sheet */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="btn btn-primary fixed bottom-5 left-1/2 z-90 -translate-x-1/2 !px-6 !py-3 !text-[14px] lg:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
          <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
        Preview
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-120 lg:hidden">
          <button aria-label="Close preview" className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" onClick={() => setSheetOpen(false)} />
          <div className="pane-in absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[28px] border-t border-line bg-cream px-4 pb-8 pt-3">
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-line-2" />
            {children}
            <button type="button" onClick={() => setSheetOpen(false)} className="btn btn-ghost mx-auto mt-5 flex !px-6 !py-2.5 !text-[13.5px]">
              Back to editing
            </button>
          </div>
        </div>
      )}
    </>
  );
}
