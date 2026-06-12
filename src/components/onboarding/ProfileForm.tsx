"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarField from "./AvatarField";
import Field from "./Field";
import PhonePreview from "./PhonePreview";
import PreviewPane from "./PreviewPane";
import { SOCIAL_ICONS } from "../profile/ProfileHeader";
import {
  type CreatorDraft,
  type SocialPlatform,
  emptyDraft,
  normalizeSocial,
  PRESET_LANGUAGES,
  validateSocial,
  validateWhatsapp,
} from "@/lib/creator";
import { getProfileDraft, saveProfileDraft, uploadAvatar } from "@/lib/actions/profile";

/* ---------------- small building blocks ---------------- */

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="pop-in inline-flex items-center gap-1.5 rounded-full border border-line bg-paper py-1.5 pl-3 pr-1.5 text-[13px] font-bold text-ink-2 shadow-soft">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="hit-44 grid size-5 place-items-center rounded-full text-faint transition-colors hover:bg-cream-2 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" className="size-3" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function HighlightsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const full = value.length >= 3;

  function add() {
    const v = text.trim();
    if (!v || full || value.includes(v)) return;
    onChange([...value, v]);
    setText("");
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {value.map((h) => (
            <Chip key={h} label={h} onRemove={() => onChange(value.filter((x) => x !== h))} />
          ))}
        </div>
      )}
      {!full && (
        <div className="flex gap-2">
          <input
            id="highlights"
            className="field"
            maxLength={30}
            placeholder={value.length === 0 ? "e.g. 5 yrs experience" : value.length === 1 ? "e.g. 120+ clients" : "e.g. Certified NLP coach"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" onClick={add} disabled={!text.trim()} className="btn btn-ghost !px-5 !py-2 !text-[13.5px] disabled:opacity-40">
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function LanguagesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const custom = value.filter((l) => !(PRESET_LANGUAGES as readonly string[]).includes(l));

  function toggle(lang: string) {
    onChange(value.includes(lang) ? value.filter((l) => l !== lang) : [...value, lang]);
  }

  function addCustom() {
    const v = text.trim();
    if (!v || value.some((l) => l.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
    setText("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PRESET_LANGUAGES.map((lang) => {
          const on = value.includes(lang);
          return (
            <button
              key={lang}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(lang)}
              className={`hit-44 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-150 ease-soft ${
                on ? "border-ink bg-ink text-cream" : "border-line bg-paper text-ink-2 hover:border-ink"
              }`}
            >
              {lang}
            </button>
          );
        })}
        {custom.map((lang) => (
          <Chip key={lang} label={lang} onRemove={() => toggle(lang)} />
        ))}
      </div>
      <input
        id="languages"
        className="field mt-2.5"
        placeholder="Add another language and press Enter"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addCustom();
          }
        }}
      />
    </div>
  );
}

const SOCIAL_FIELDS: { platform: SocialPlatform; label: string; placeholder: string }[] = [
  { platform: "instagram", label: "Instagram", placeholder: "@yourhandle or full URL" },
  { platform: "youtube", label: "YouTube", placeholder: "@yourchannel or full URL" },
  { platform: "linkedin", label: "LinkedIn", placeholder: "in/your-name or full URL" },
  { platform: "x", label: "X", placeholder: "@yourhandle or full URL" },
];

/* ---------------- the form ---------------- */

export default function ProfileForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<CreatorDraft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">("idle");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  /* rehydrate exactly as the creator left it — from their profiles row */
  useEffect(() => {
    getProfileDraft().then((d) => {
      setDraft(d);
      setLoaded(true);
    });
  }, []);

  /* autosave, debounced 800ms — nothing is ever lost */
  useEffect(() => {
    if (!loaded || saveState !== "dirty") return;
    const t = setTimeout(async () => {
      const res = await saveProfileDraft(draft);
      if (res.success) setSaveState("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [draft, saveState, loaded]);

  function update(patch: Partial<CreatorDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setSaveState("dirty");
  }

  function blur(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  const errors = {
    photo: !draft.avatar ? "Add a photo — pages with a real face get booked far more." : null,
    name: !draft.name.trim() ? "Your display name is required." : null,
    title: !draft.title.trim() ? "Required — this line does the heavy lifting on your page." : null,
    bio: !draft.bio.trim() ? "A short bio is required." : null,
    whatsapp: validateWhatsapp(draft.whatsappCode, draft.whatsappNumber),
  };
  const socialErrors = Object.fromEntries(
    SOCIAL_FIELDS.map(({ platform }) => [platform, validateSocial(platform, normalizeSocial(platform, draft.socials[platform]))]),
  ) as Record<SocialPlatform, string | null>;

  const show = (key: keyof typeof errors) => (submitted || touched[key] ? errors[key] : null);

  async function onContinue() {
    setSubmitted(true);
    const firstBad = (Object.keys(errors) as (keyof typeof errors)[]).find((k) => errors[k]);
    if (firstBad || Object.values(socialErrors).some(Boolean)) {
      document.getElementById(`field-${firstBad ?? "socials"}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // complete: true marks {"profile": true} in completed_steps — the handle
    // itself was claimed in step 1 and is never written from here
    const res = await saveProfileDraft(draft, { complete: true });
    if (!res.success) return; // stay put; the draft autosave will retry
    router.push("/onboarding/service");
  }

  const bioLen = draft.bio.length;

  if (!loaded) {
    return <div className="min-h-[60vh]" aria-busy="true" />;
  }

  return (
    <div className="grid items-start gap-12 lg:grid-cols-[45fr_55fr]">
      {/* ---------------- left: the form ---------------- */}
      <div className="flex flex-col gap-8">
        <Field id="photo" label="Photo" required error={show("photo")}>
          <AvatarField
            avatar={draft.avatar}
            name={draft.name}
            error={null}
            onCropped={async (dataUrl) => {
              const url = await uploadAvatar(dataUrl); // straight to storage, outside the autosave cycle
              update({ avatar: url });
            }}
          />
        </Field>

        <Field id="name" label="Display name" required error={show("name")}>
          <input
            id="name"
            className="field"
            maxLength={50}
            placeholder="Meera Shah"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            onBlur={() => blur("name")}
          />
        </Field>

        <Field
          id="title"
          label="Title"
          required
          helper="Your one-line credibility. This does the heavy lifting on your page."
          error={show("title")}
        >
          <input
            id="title"
            className="field"
            maxLength={80}
            placeholder="Career Coach · ex-Head of Talent"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            onBlur={() => blur("title")}
          />
        </Field>

        <Field
          id="bio"
          label="Bio"
          required
          error={show("bio")}
          counter={
            <span className={`text-[12px] font-bold tabular-nums ${bioLen >= 240 ? "text-amber" : "text-faint"}`}>
              {bioLen}/280
            </span>
          }
        >
          <textarea
            id="bio"
            className="field min-h-[120px] resize-none"
            maxLength={280}
            placeholder="Who do you help, and what changes for them after working with you?"
            value={draft.bio}
            onChange={(e) => update({ bio: e.target.value })}
            onBlur={() => blur("bio")}
          />
        </Field>

        <Field
          id="highlights"
          label="Experience highlights"
          helper="Up to 3 short chips. These show where stats appear once you have real bookings."
        >
          <HighlightsInput value={draft.highlights} onChange={(v) => update({ highlights: v })} />
        </Field>

        <Field id="whatsapp" label="WhatsApp number" required helper="Booking confirmations come here." error={show("whatsapp")}>
          <div className="flex gap-2">
            <div className="flex items-center rounded-[14px] border-[1.5px] border-line bg-paper px-3">
              <span className="text-[14.5px] font-semibold text-muted">+</span>
              <input
                aria-label="Country code"
                className="w-9 bg-transparent text-[14.5px] font-semibold text-ink outline-none"
                value={draft.whatsappCode}
                maxLength={3}
                onChange={(e) => update({ whatsappCode: e.target.value.replace(/\D/g, "") })}
                onBlur={() => blur("whatsapp")}
              />
            </div>
            <input
              id="whatsapp"
              type="tel"
              inputMode="numeric"
              className="field flex-1"
              placeholder="98765 43210"
              value={draft.whatsappNumber}
              onChange={(e) => update({ whatsappNumber: e.target.value })}
              onBlur={() => blur("whatsapp")}
            />
          </div>
        </Field>

        <Field id="languageList" label="Languages" helper="Clients filter by language — pick everything you're comfortable coaching in.">
          <LanguagesInput value={draft.languages} onChange={(v) => update({ languages: v })} />
        </Field>

        <Field id="location" label="Location">
          <input
            id="location"
            className="field"
            placeholder="Mumbai, India"
            value={draft.location}
            onChange={(e) => update({ location: e.target.value })}
          />
        </Field>

        <Field id="socials" label="Social links" helper="Optional — paste a URL or just your handle, we'll format it.">
          <div className="flex flex-col gap-2.5">
            {SOCIAL_FIELDS.map(({ platform, label, placeholder }) => (
              <div key={platform}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                    {SOCIAL_ICONS[label]}
                  </span>
                  <input
                    aria-label={label}
                    className="field !pl-11"
                    placeholder={placeholder}
                    value={draft.socials[platform]}
                    onChange={(e) => update({ socials: { ...draft.socials, [platform]: e.target.value } })}
                    onBlur={(e) => {
                      const normalized = normalizeSocial(platform, e.target.value);
                      if (normalized !== e.target.value) update({ socials: { ...draft.socials, [platform]: normalized } });
                    }}
                  />
                </div>
                {socialErrors[platform] && <p className="mt-1 text-[12px] font-bold text-terra-deep">{socialErrors[platform]}</p>}
              </div>
            ))}
          </div>
        </Field>

        {/* ---------------- continue ---------------- */}
        <div className="mt-2 flex items-center gap-4 border-t border-line pt-6">
          <button type="button" onClick={onContinue} className="btn btn-grad btn-lg">
            Continue <span className="arr">→</span>
          </button>
          <span
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 text-[13px] font-bold text-green transition-opacity duration-500 ${
              saveState === "saved" ? "opacity-100" : "opacity-0"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Saved
          </span>
        </div>
      </div>

      {/* ---------------- right: live preview ---------------- */}
      <PreviewPane>
        <PhonePreview draft={draft} />
      </PreviewPane>
    </div>
  );
}
