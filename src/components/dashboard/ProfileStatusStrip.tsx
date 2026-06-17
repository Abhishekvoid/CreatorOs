"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * The dashboard's one source of truth about whether a creator is actually
 * live. Unlike the surrounding mockup cards, this is fed real data from the
 * profiles row (handle + is_published). Published creators get the share/view
 * actions; drafts get a Publish CTA instead — their public URL 404s until they
 * go live, so offering Copy/View on a draft would hand out a dead link.
 */
export default function ProfileStatusStrip({
  handle,
  isPublished,
}: {
  handle: string;
  isPublished: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = `creatoros.in/${handle}`;

  async function copyLink() {
    await navigator.clipboard.writeText(`https://${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section
      className="rounded-[28px] border border-line bg-paper p-5 sm:p-6"
      aria-label="Profile status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {isPublished ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-soft px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-green-deep">
              <span className="size-1.5 rounded-full bg-green animate-pulse-dot" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-2 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
              Draft
            </span>
          )}

          <div className="mt-2.5 truncate text-[15px] font-bold tracking-tight">
            <span className="text-faint">creatoros.in/</span>
            {handle}
          </div>
          <p className="mt-1 text-[12.5px] font-medium text-muted">
            {isPublished
              ? "Your page is live and ready to take bookings."
              : "Your page isn’t published yet — only you can see it."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {isPublished ? (
            <>
              <button
                type="button"
                onClick={copyLink}
                className={`btn btn-ghost !px-4 !py-2.5 !text-[13px] transition-colors duration-150 ${copied ? "!bg-cream-2" : ""}`}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={`/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost !px-4 !py-2.5 !text-[13px]"
              >
                View profile
              </a>
              <Link href="/onboarding/profile" className="btn btn-ghost !px-4 !py-2.5 !text-[13px]">
                Edit profile
              </Link>
            </>
          ) : (
            <>
              <Link href="/onboarding/publish" className="btn btn-primary !px-4 !py-2.5 !text-[13px]">
                Publish page
              </Link>
              <Link href="/onboarding/profile" className="btn btn-ghost !px-4 !py-2.5 !text-[13px]">
                Edit profile
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
