import { Check as LucideCheck, X as LucideX, Star } from "lucide-react";

export function Check({ className = "mt-px size-[18px] shrink-0 text-green" }: { className?: string }) {
  return <LucideCheck className={className} strokeWidth={2.4} aria-hidden="true" />;
}

export function Cross({ className = "mt-px size-[18px] shrink-0 text-faint" }: { className?: string }) {
  return <LucideX className={className} strokeWidth={2.4} aria-hidden="true" />;
}

export function RatingStars({ count = 5, className = "size-3.5" }: { count?: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-px align-middle text-amber" role="img" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className={className} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      ))}
    </span>
  );
}

export function LogoMark({ className = "size-[34px] rounded-[11px]" }: { className?: string }) {
  return (
    <span
      className={`grid place-items-center bg-grad text-white shadow-[0_4px_12px_-2px_rgba(226,85,44,.5)] transition-transform duration-400 ease-spring group-hover/logo:rotate-[-8deg] group-hover/logo:scale-106 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[55%]"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </svg>
    </span>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="#" className="group/logo flex items-center gap-2.5 text-xl font-black tracking-tight">
      <LogoMark />
      <span>
        Creator
        <span className={light ? "font-medium text-faint" : "font-medium text-muted"}>OS</span>
      </span>
    </a>
  );
}

export function VerifiedBadge() {
  return (
    <svg viewBox="0 0 24 24" className="size-[15px] text-terra" aria-label="Verified" fill="none">
      <path
        d="M9.5 12.7l1.8 1.8 3.6-4"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth={1.8} />
    </svg>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div className={`mb-[clamp(40px,6vw,64px)] ${center ? "flex flex-col items-center text-center" : ""}`}>
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="max-w-[680px] text-[clamp(30px,4.4vw,46px)] font-bold leading-[1.1] tracking-[-0.025em]">
        {title}
      </h2>
      {sub && (
        <p className="mt-4 max-w-[560px] text-[clamp(16px,1.6vw,18.5px)] font-medium text-muted">{sub}</p>
      )}
    </div>
  );
}
