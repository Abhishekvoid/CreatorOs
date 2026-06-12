import Link from "next/link";

export default function DemoBanner() {
  return (
    <div className="fixed inset-x-0 top-0 z-110 flex h-9 items-center justify-center gap-3 bg-ink px-4 text-cream">
      <p className="min-w-0 truncate text-[12.5px] font-semibold text-[#D9D5CA]">
        <span aria-hidden="true">👀</span> This is a demo profile —{" "}
        <span className="max-sm:hidden">your page will look like this in 5 minutes.</span>
        <span className="sm:hidden">yours in 5 minutes.</span>
      </p>
      <Link
        href="/#final"
        className="shrink-0 rounded-full bg-grad px-3 py-1 text-[11.5px] font-extrabold text-white shadow-[0_2px_8px_-2px_rgba(226,85,44,.6)] transition-transform duration-200 hover:scale-[1.04]"
      >
        Claim your free link →
      </Link>
    </div>
  );
}
