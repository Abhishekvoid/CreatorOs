import { Eye } from "lucide-react";
import Link from "next/link";

export default function DemoBanner() {
  return (
    <div className="fixed inset-x-0 top-0 z-110 flex h-9 items-center justify-center gap-3 bg-ink px-4 text-cream">
      <p className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-semibold text-[#D9D5CA]">
        <Eye className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" /> This is a demo profile —{" "}
        <span className="max-sm:hidden">your page will look like this in 5 minutes.</span>
        <span className="sm:hidden">yours in 5 minutes.</span>
      </p>
      {/* ink-register CTA: the page's one saffron action stays "Book a session" */}
      <Link
        href="/#final"
        className="hit-44 shrink-0 rounded-full bg-cream px-3 py-1 text-[11.5px] font-bold text-ink transition-colors duration-150 hover:bg-paper"
      >
        Claim your free link →
      </Link>
    </div>
  );
}
