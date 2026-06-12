import ProfileHeader, { type ProfileHeaderData } from "../profile/ProfileHeader";
import PhoneFrame from "./PhoneFrame";
import { type CreatorDraft, normalizeSocial, slugify, SOCIAL_PLATFORMS } from "@/lib/creator";

/**
 * The live preview is the real public profile component — the same one that
 * renders /meera — fed the in-progress draft and framed as a phone.
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

export function toHeaderData(d: CreatorDraft): ProfileHeaderData {
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
    <PhoneFrame handle={handle}>
      <ProfileHeader creator={toHeaderData(draft)} coldStart stacked compactTop />
    </PhoneFrame>
  );
}
