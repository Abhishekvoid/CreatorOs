"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ABHISHEK_AVATAR } from "../persona";

export default function ProfilePreview({ completion = 85 }: { completion?: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText("https://creatoros.in/abhishek");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="flex flex-col rounded-[28px] border border-line bg-paper p-6" aria-label="Public profile preview">
      <div className="flex items-center gap-3">
        <img
          src={ABHISHEK_AVATAR}
          alt="Abhishek"
          className="size-12 rounded-full border-2 border-white object-cover shadow-soft outline outline-[1.5px] outline-offset-1 outline-terra"
        />
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold tracking-tight">Abhishek</div>
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted">
            <span className="size-1.5 rounded-full bg-green animate-pulse-dot" />
            <span className="truncate">
              <span className="text-faint">creatoros.in/</span>abhishek
            </span>
          </div>
        </div>
        <span className="ml-auto rounded-full bg-green-soft px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-green-deep">
          Live
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-[12.5px] font-bold">
          <span className="text-muted">Profile completion</span>
          <span>{completion}%</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-cream-2"
          role="progressbar"
          aria-valuenow={completion}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-grad" style={{ width: `${completion}%` }} />
        </div>
        <p className="mt-2 text-[12px] font-semibold text-muted">
          {completion < 100 ? "Add 2 testimonials to reach 100%." : "Your profile is fully set up."}
        </p>
      </div>

      <div className="mt-auto flex gap-2 pt-5">
        <a href="/meera" className="btn btn-primary flex-1 !px-4 !py-2.5 !text-[13px]">
          View profile
        </a>
        <button
          type="button"
          onClick={copy}
          className={`btn btn-ghost flex-1 !px-4 !py-2.5 !text-[13px] transition-colors duration-150 ${copied ? "!bg-cream-2" : ""}`}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
