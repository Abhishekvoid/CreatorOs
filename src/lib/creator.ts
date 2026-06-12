import { MEERA_AVATAR, MEERA_CREDENTIAL } from "@/components/persona";

/**
 * The one creator shape that powers the public profile page, the Meera demo
 * and the onboarding preview. The onboarding form edits a draft of this and
 * feeds it straight into the same <ProfileHeader /> the real pages render.
 */
export const SOCIAL_PLATFORMS = ["instagram", "youtube", "linkedin", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type CreatorDraft = {
  handle: string;
  name: string;
  title: string;
  bio: string;
  /** public URL once a backend exists; a data-URL while drafting locally */
  avatar: string | null;
  /** up to 3 short credibility chips shown where stats appear post cold-start */
  highlights: string[];
  /** E.164 — booking confirmations are sent here, never rendered publicly */
  whatsappCode: string;
  whatsappNumber: string;
  languages: string[];
  location: string;
  socials: Record<SocialPlatform, string>;
  onboardingStep: number;
};

export function emptyDraft(): CreatorDraft {
  return {
    handle: "",
    name: "",
    title: "",
    bio: "",
    avatar: null,
    highlights: [],
    whatsappCode: "91",
    whatsappNumber: "",
    languages: [],
    location: "",
    socials: { instagram: "", youtube: "", linkedin: "", x: "" },
    onboardingStep: 2,
  };
}

export const PRESET_LANGUAGES = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Marathi",
  "Bengali",
  "Gujarati",
  "Punjabi",
] as const;

/* ---------------- validation & normalization ---------------- */

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** E.164: + followed by 7–15 digits; Indian mobiles additionally start 6–9 */
export function validateWhatsapp(code: string, number: string): string | null {
  const digits = number.replace(/[\s-]/g, "");
  if (!digits) return "Required — booking confirmations go here.";
  if (!/^\d+$/.test(digits)) return "Digits only, no spaces or dashes.";
  if (code === "91" && !/^[6-9]\d{9}$/.test(digits)) return "Indian mobile numbers are 10 digits starting 6–9.";
  if (!/^\+[1-9]\d{6,14}$/.test(`+${code}${digits}`)) return "That doesn't look like a valid number.";
  return null;
}

export function toE164(code: string, number: string): string {
  return `+${code}${number.replace(/[\s-]/g, "")}`;
}

const SOCIAL_META: Record<SocialPlatform, { domains: string[]; profileUrl: (h: string) => string; label: string }> = {
  instagram: { domains: ["instagram.com"], profileUrl: (h) => `https://instagram.com/${h}`, label: "Instagram" },
  youtube: { domains: ["youtube.com", "youtu.be"], profileUrl: (h) => `https://youtube.com/@${h}`, label: "YouTube" },
  linkedin: { domains: ["linkedin.com"], profileUrl: (h) => `https://linkedin.com/in/${h}`, label: "LinkedIn" },
  x: { domains: ["x.com", "twitter.com"], profileUrl: (h) => `https://x.com/${h}`, label: "X" },
};

/** "@priya" / "priya" → full profile URL; full URLs pass through untouched */
export function normalizeSocial(platform: SocialPlatform, raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.includes(".") && !v.startsWith("@")) return `https://${v}`;
  const handle = v.replace(/^@+/, "").replace(/\/+$/, "");
  return handle ? SOCIAL_META[platform].profileUrl(handle) : "";
}

export function validateSocial(platform: SocialPlatform, value: string): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "That doesn't look like a URL.";
  }
  const host = url.hostname.replace(/^www\./, "");
  if (!SOCIAL_META[platform].domains.some((d) => host === d || host.endsWith(`.${d}`))) {
    return `That doesn't look like ${SOCIAL_META[platform].label}.`;
  }
  return null;
}

/* ---------------- the demo creator ---------------- */

export const MEERA: CreatorDraft = {
  handle: "meera",
  name: "Meera Shah",
  title: `Career Coach · ${MEERA_CREDENTIAL}`,
  bio: "", // the demo page renders richer JSX copy; see ProfileHeader's default
  avatar: MEERA_AVATAR,
  highlights: [],
  whatsappCode: "91",
  whatsappNumber: "",
  languages: ["English", "Hindi"],
  location: "Mumbai, India",
  socials: {
    instagram: "#",
    youtube: "#",
    linkedin: "#",
    x: "#",
  },
  onboardingStep: 99,
};
