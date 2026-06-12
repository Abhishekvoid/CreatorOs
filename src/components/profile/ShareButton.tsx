"use client";

import { useState } from "react";

const PROFILE_URL = "https://creatoros.in/meera";

export default function ShareButton({ className = "btn btn-ghost btn-lg" }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Meera Shah — Career Coach",
          text: "Book a session with Meera Shah on CreatorOS",
          url: PROFILE_URL,
        });
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    await navigator.clipboard.writeText(PROFILE_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`${className} transition-colors duration-150 ${copied ? "!bg-cream-2" : ""}`}
    >
      {copied ? (
        "Copied"
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          Share profile
        </>
      )}
    </button>
  );
}
