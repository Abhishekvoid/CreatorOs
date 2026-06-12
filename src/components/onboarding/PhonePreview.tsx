import ProfileHeader, { type ProfileHeaderData } from "../profile/ProfileHeader";
import { type CreatorDraft, normalizeSocial, slugify, SOCIAL_PLATFORMS } from "@/lib/creator";

/**
 * The live preview is the real public profile component — the same one that
 * renders /meera — fed the in-progress draft and framed as a phone. Render
 * width is a real phone's 390px, scaled down to fit the device frame;
 * `stacked` forces the genuine mobile arrangement at any viewport.
 */

const SOCIAL_LABELS: Record<(typeof SOCIAL_PLATFORMS)[number], string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

/* the profile shows socials in the same order the real header does */
const DISPLAY_ORDER = ["linkedin", "x", "instagram", "youtube"] as const;

function toHeaderData(d: CreatorDraft): ProfileHeaderData {
  return {
    name: d.name.trim() || "Your name",
    title: d.title.trim(),
    bio: d.bio.trim() || null,
    avatar: d.avatar,
    location: d.location.trim() || undefined,
    languages: d.languages.length ? d.languages : undefined,
    highlights: d.highlights,
    socials: DISPLAY_ORDER.filter((p) => d.socials[p].trim()).map((p) => ({
      label: SOCIAL_LABELS[p],
      href: normalizeSocial(p, d.socials[p]),
    })),
  };
}

export default function PhonePreview({ draft }: { draft: CreatorDraft }) {
  const handle = draft.handle || slugify(draft.name) || "you";

  return (
    <div className="flex flex-col items-center">
      <div className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-terra-deep">How clients see you</div>
      <div className="mt-1 text-[14px] font-bold text-muted">
        <span className="text-faint">creatoros.in/</span>
        <span className="text-ink">{handle}</span>
      </div>

      {/* device frame, same visual language as the landing mockups */}
      <div className="mt-5 w-[320px] rounded-[40px] border border-line bg-paper p-[10px] shadow-pop">
        <div className="relative h-[600px] overflow-hidden rounded-[31px] bg-cream">
          {/* status-bar notch */}
          <div className="absolute left-1/2 top-2.5 z-10 h-[5px] w-[84px] -translate-x-1/2 rounded-full bg-line-2" />

          {/* real profile component at true phone width, scaled to the frame */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 w-[390px] origin-top-left select-none"
            style={{ transform: "scale(0.7641)" }}
          >
            <ProfileHeader creator={toHeaderData(draft)} coldStart stacked compactTop />
          </div>

          {/* soft fade where the page continues past the frame */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-cream to-transparent" />
        </div>
      </div>
    </div>
  );
}
