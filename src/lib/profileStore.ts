import { type CreatorDraft, emptyDraft } from "./creator";

/**
 * Persistence adapter for the onboarding draft.
 *
 * The API is shaped exactly like the eventual backend calls —
 *   saveDraft   → upsert into the `profiles` table
 *   saveAvatar  → upload to the `avatars` storage bucket, returns public URL
 *   loadDraft   → select the creator's row
 * — so wiring Supabase later means changing only this file. Until then,
 * drafts persist to localStorage and the avatar "URL" is a data-URL.
 */

const DRAFT_KEY = "creatoros.onboarding.profile";
const AVATAR_KEY = "creatoros.onboarding.avatar";

export async function loadDraft(): Promise<CreatorDraft> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<CreatorDraft>;
    const draft = { ...emptyDraft(), ...parsed };
    // the avatar blob is stored separately so the draft row stays light
    draft.avatar = localStorage.getItem(AVATAR_KEY) || draft.avatar;
    return draft;
  } catch {
    return emptyDraft();
  }
}

export async function saveDraft(draft: CreatorDraft): Promise<void> {
  const { avatar, ...row } = draft;
  void avatar;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(row));
}

/** Saves immediately on crop-confirm, independent of the autosave cycle. */
export async function saveAvatar(dataUrl: string): Promise<string> {
  localStorage.setItem(AVATAR_KEY, dataUrl);
  return dataUrl;
}
