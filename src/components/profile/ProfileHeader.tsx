/* eslint-disable @next/next/no-img-element */
import { Star } from "lucide-react";
import { MEERA_AVATAR, MEERA_CREDENTIAL } from "../persona";
import SlotRow from "../SlotRow";
import { VerifiedBadge } from "../ui";
import ShareButton from "./ShareButton";

/**
 * The one public-profile header. It powers the live Meera demo (default
 * props), real creator pages, and — fed the in-progress onboarding draft —
 * the live preview inside /onboarding/profile. One component, zero replicas:
 * what creators see while editing is exactly what clients get.
 *
 * - `coldStart` applies the empty-state rules: highlight chips where the
 *   stats row lives, a "first service" placeholder instead of the booking
 *   card, no verified badge, no social-proof chip.
 * - `stacked` forces the single-column (mobile) arrangement regardless of
 *   viewport — used by the phone-framed preview on desktop.
 */

export type ProfileHeaderData = {
  name: string;
  title: string;
  bio: React.ReactNode;
  avatar: string | null;
  location?: string;
  languages?: string[];
  highlights?: string[];
  socials?: { label: string; href: string }[];
};

const METRICS: { value: React.ReactNode; label: string }[] = [
  { value: "340+", label: "sessions" },
  { value: <span className="inline-flex items-center gap-1">4.9 <Star className="size-3.5 text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" /></span>, label: "212 reviews" },
  { value: "120+", label: "clients helped" },
  { value: "5 yrs", label: "experience" },
];

export const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  LinkedIn: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0zM.3 8.3h4.4V24H.3V8.3zm7.6 0h4.2v2.1h.1c.6-1.1 2-2.3 4.2-2.3 4.5 0 5.3 3 5.3 6.8V24h-4.4v-7.9c0-1.9 0-4.3-2.6-4.3s-3 2-3 4.1V24H7.9V8.3z" />
    </svg>
  ),
  X: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.2l7.3-8.3L1.8 2h6.4l4.4 5.9L18.9 2zm-1.1 18.1h1.7L7.3 3.8H5.5l12.3 16.3z" />
    </svg>
  ),
  Instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  YouTube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M23 7.2a3 3 0 0 0-2.1-2.2C19 4.5 12 4.5 12 4.5s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.2zM9.8 15.3V8.7l6 3.3-6 3.3z" />
    </svg>
  ),
};

const MEERA_DATA: ProfileHeaderData = {
  name: "Meera Shah",
  title: `Career Coach · ${MEERA_CREDENTIAL}`,
  bio: (
    <>
      I help mid-career professionals land roles they thought were{" "}
      <span className="font-serif italic text-grad">out of reach</span> — from resume to signed offer.
    </>
  ),
  avatar: MEERA_AVATAR,
  location: "Mumbai, India",
  languages: ["English", "Hindi"],
  socials: [
    { label: "LinkedIn", href: "#" },
    { label: "X", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "YouTube", href: "#" },
  ],
};

/* capitalize each word, preserving acronyms (USA) and intercaps (McKinsey) —
   so "ahmedabad, india" reads "Ahmedabad, India" without mangling the rest */
function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/* dots inside the title pick up the same faint styling everywhere */
function Title({ title }: { title: string }) {
  const parts = title.split("·").map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (
        <span key={`${p}-${i}`}>
          {i > 0 && <span className="mx-1 text-faint">·</span>}
          {p}
        </span>
      ))}
    </>
  );
}

function FirstServiceCard() {
  return (
    <div className="relative rounded-[26px] border-2 border-dashed border-line-2 bg-paper/70 p-6">
      <span className="rounded-full bg-cream-2 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
        Next step
      </span>
      <h2 className="mt-2.5 text-[19px] font-extrabold tracking-tight">Your first service — next step</h2>
      <div className="mt-1 text-[12.5px] font-semibold text-muted">45 min · Google Meet · paid via UPI</div>

      <div className="mt-5 flex flex-wrap gap-1.5 opacity-45" aria-hidden="true">
        {["11:00 am", "2:30 pm", "5:00 pm", "6:30 pm"].map((t) => (
          <span key={t} className="slot pointer-events-none">
            {t}
          </span>
        ))}
      </div>

      <div className="btn btn-primary mt-5 w-full opacity-35" aria-hidden="true">
        Book a session <span className="arr">→</span>
      </div>
      <p className="mt-3.5 text-center text-[12px] font-semibold text-muted">
        You&rsquo;ll set this up right after your profile
      </p>
    </div>
  );
}

export default function ProfileHeader({
  creator,
  coldStart = false,
  stacked = false,
  compactTop = false,
  serviceSlot,
}: {
  creator?: ProfileHeaderData;
  coldStart?: boolean;
  stacked?: boolean;
  compactTop?: boolean;
  /** cold start only: the creator's real service card once one exists,
      rendered where the "first service" placeholder otherwise sits */
  serviceSlot?: React.ReactNode;
} = {}) {
  const c = creator ?? MEERA_DATA;
  const initial = (c.name.trim()[0] || "Y").toUpperCase();
  const socials = (c.socials ?? []).filter((s) => s.href);

  /* stacked = the real mobile arrangement, forced at any viewport */
  const cx = (base: string, atDesktop: string, whenStacked: string) =>
    `${base} ${stacked ? whenStacked : atDesktop}`.trim();

  return (
    <section
      className={`relative overflow-hidden pb-[clamp(48px,7vw,84px)] ${
        compactTop ? "pt-12" : "pt-[172px] max-md:pt-[148px]"
      }`}
    >
      {/* ambient gradient washes, same recipe as the landing hero */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 480px at 80% 4%, rgba(242,163,60,.13), transparent 60%), radial-gradient(700px 460px at 8% 40%, rgba(226,85,44,.08), transparent 60%)",
        }}
      />

      <div
        className={cx(
          "relative mx-auto max-w-[1160px] px-6",
          "grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] max-lg:gap-12",
          "flex flex-col gap-12",
        )}
      >
        {/* ---- left: identity ---- */}
        <div className={stacked ? "flex flex-col items-center text-center" : "max-lg:flex max-lg:flex-col max-lg:items-center max-lg:text-center"}>
          <div
            className={cx("h-anim flex items-center", "gap-5 max-lg:flex-col max-lg:gap-4", "flex-col gap-4")}
            style={{ animationDelay: "0.05s" }}
          >
            <div className="relative shrink-0">
              {c.avatar ? (
                <img
                  src={c.avatar}
                  alt={c.name}
                  className="size-[108px] rounded-full border-4 border-white object-cover shadow-card outline outline-[3px] outline-offset-3 outline-terra"
                />
              ) : (
                <span className="grid size-[108px] place-items-center rounded-full border-4 border-white bg-grad text-[44px] font-black text-white shadow-card outline outline-[3px] outline-offset-3 outline-terra">
                  {initial}
                </span>
              )}
              {!coldStart && (
                <span className="absolute -bottom-0.5 -right-0.5 grid size-8 place-items-center rounded-full border-[3px] border-cream bg-green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              )}
            </div>
            <div>
              <h1
                className={cx(
                  "flex items-center gap-2.5 text-[clamp(32px,4.2vw,44px)] font-black leading-none tracking-[-0.025em]",
                  "max-lg:justify-center",
                  "justify-center",
                )}
              >
                {c.name || "Your name"} {!coldStart && <VerifiedBadge />}
              </h1>
              {c.title && (
                <p className="mt-2 text-[16px] font-bold text-ink-2">
                  <Title title={c.title} />
                </p>
              )}
              {(c.location || !coldStart || (c.languages?.length ?? 0) > 0) && (
                <div
                  className={cx(
                    "mt-2.5 flex flex-col gap-1 text-[13px] font-semibold text-muted",
                    "max-lg:items-center",
                    "items-center",
                  )}
                >
                  {/* line 1: location · live-status — the client-facing hierarchy */}
                  {(c.location || !coldStart) && (
                    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-1", "max-lg:justify-center", "justify-center")}>
                      {c.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-terra" aria-hidden="true">
                            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {titleCase(c.location)}
                        </span>
                      )}
                      {!coldStart && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-[7px] rounded-full bg-green animate-pulse-dot" />
                          Replies within 2 hours
                        </span>
                      )}
                    </div>
                  )}
                  {/* line 2: languages, on their own row */}
                  {(c.languages?.length ?? 0) > 0 && <span>{c.languages!.join(" · ")}</span>}
                </div>
              )}
            </div>
          </div>

          {/* cold-start trust layer: the creator's own highlights, sitting
              directly beneath the identity row and above the bio (max 3) */}
          {coldStart && (c.highlights?.length ?? 0) > 0 && (
            <div className={cx("h-anim mt-6 flex flex-wrap gap-2", "max-lg:justify-center", "justify-center")} style={{ animationDelay: "0.12s" }}>
              {c.highlights!.slice(0, 3).map((h) => (
                <span key={h} className="rounded-full border border-line bg-paper px-3.5 py-2 text-[13px] font-bold text-ink-2 shadow-soft">
                  {h}
                </span>
              ))}
            </div>
          )}

          {c.bio && (
            <p
              className="h-anim mt-7 max-w-[540px] text-[clamp(19px,2.2vw,24px)] font-medium leading-snug text-ink-2"
              style={{ animationDelay: "0.18s" }}
            >
              {c.bio}
            </p>
          )}

          {/* established creators: real trust metrics where the highlights stood */}
          {!coldStart && (
            <div className={cx("h-anim mt-7 flex flex-wrap gap-x-9 gap-y-4", "max-lg:justify-center", "justify-center")} style={{ animationDelay: "0.25s" }}>
              {METRICS.map((m) => (
                <div key={m.label}>
                  <div className="text-[24px] font-black leading-none tracking-tight">{m.value}</div>
                  <div className="mt-1 text-[12.5px] font-semibold text-muted">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          <div
            className={cx("h-anim mt-8 flex flex-wrap items-center gap-3.5", "max-lg:justify-center", "justify-center")}
            style={{ animationDelay: "0.35s" }}
          >
            {coldStart ? (
              <span className="btn btn-grad btn-lg pointer-events-none">
                Book a session <span className="arr">→</span>
              </span>
            ) : (
              <a href="/meera/book" className="btn btn-grad btn-lg">
                Book a session <span className="arr">→</span>
              </a>
            )}
            <ShareButton />
            {socials.length > 0 && (
              <div className={cx("flex gap-2", "max-lg:w-full max-lg:justify-center", "w-full justify-center")}>
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="hit-44 grid size-10 place-items-center rounded-full border border-line bg-paper text-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-cream"
                  >
                    {SOCIAL_ICONS[s.label] ?? s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- right: booking card (or its cold-start placeholder) ---- */}
        <div className={cx("relative", "max-lg:mx-auto max-lg:w-full max-lg:max-w-[440px]", "mx-auto w-full max-w-[440px]")}>
          <div
            className="h-anim dot-texture absolute -inset-x-[7%] -bottom-[6%] -top-[7%] rounded-[36px] border border-line bg-grad-soft"
            style={{ animationDelay: "0.2s" }}
          />
          {coldStart ? (
            <div className="h-anim relative" style={{ animationDelay: "0.4s" }}>
              {serviceSlot ?? <FirstServiceCard />}
            </div>
          ) : (
            <>
              <div
                className="h-anim relative rounded-[26px] border border-line bg-paper p-6 shadow-pop"
                style={{ animationDelay: "0.4s" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-grad px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
                      <Star className="size-3 text-white" fill="currentColor" strokeWidth={0} aria-hidden="true" /> Most booked
                    </span>
                    <h2 className="mt-2.5 text-[19px] font-extrabold tracking-tight">1:1 Career Strategy Call</h2>
                    <div className="mt-1 text-[12.5px] font-semibold text-muted">45 min · Google Meet · recorded</div>
                  </div>
                  <div className="text-right">
                    <s className="block text-[13px] font-semibold text-faint">₹1,999</s>
                    <b className="text-[26px] font-black leading-none tracking-tight">₹1,499</b>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-faint">Today · Thu 12 Jun</span>
                  <span className="rounded-full bg-[#FDF3DF] px-2.5 py-1 text-[11px] font-extrabold text-[#9A6A14]">
                    3 slots left
                  </span>
                </div>
                <div className="mt-2.5">
                  <SlotRow
                    slots={[
                      { time: "11:00 am", taken: true },
                      { time: "2:30 pm", taken: true },
                      { time: "5:00 pm" },
                      { time: "6:30 pm" },
                      { time: "8:00 pm" },
                    ]}
                    initial={2}
                  />
                </div>

                <a href="/meera/book" className="btn btn-primary mt-5 w-full">
                  Book for ₹1,499 <span className="arr">→</span>
                </a>
                <p className="mt-3.5 text-center text-[12px] font-semibold text-muted">
                  Pay via UPI · instant confirmation on WhatsApp · free reschedule
                </p>
              </div>

              {/* floating proof chip, echoing the landing hero */}
              <div
                className={cx(
                  "h-anim absolute z-2 flex items-center gap-2.5 rounded-2xl border border-line bg-paper py-2.5 pl-3 pr-4 shadow-card animate-float-c",
                  "-left-[6%] -bottom-[26px] max-lg:-bottom-5 max-lg:left-2",
                  "-bottom-5 left-2",
                )}
                style={{ animationDelay: "0.6s" }}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-green-soft text-green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <div className="text-[12.5px] font-extrabold tracking-tight">Rohit booked 5:00 pm</div>
                  <div className="text-[11px] font-semibold text-muted">paid via UPI · 4 min ago</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
