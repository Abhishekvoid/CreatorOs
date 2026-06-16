# Replace emoji icons with Lucide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every emoji/glyph used as a UI element across `src/` with Lucide React icons, consolidating onto a single icon source and adding a regression guard so emoji can't creep back in.

**Architecture:** Rebuild the hand-rolled `Check`/`Cross` SVGs in `ui.tsx` on Lucide (same component signatures, so every consumer upgrades for free), add a `RatingStars` helper for the repeated `★★★★★` strips, and convert data-driven icon lists from emoji strings to `LucideIcon` component references. A Vitest test scans `src/**/*.tsx` for emoji and fails if any remain. Squircle tiles, colours and sizes are preserved — only the glyph changes.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Tailwind v4, `lucide-react` (already a dependency), Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-16-emoji-to-lucide-icons-design.md`

**Conventions used throughout:**
- Pictographic icons in squircle tiles: drop the `text-base`/`text-[17px]`/`text-[24px]` font-size class from the tile (it only sized the emoji) and render the Lucide icon with an explicit `size-*` class + `strokeWidth={2}` + `aria-hidden="true"`. Keep the tile's `bg-*` and `rounded-*`.
- Star colour is `text-amber` (the established rating colour already used in the codebase), not terra. The single exception `♥` in the footer stays `text-terra`.
- Semantic colour preserved: `Check` stays green, stars amber, neutral icons `text-ink`/`text-ink-2`.
- Inline glyphs in running text become inline icons sized to the text (`inline size-3` / `size-4`, `align-[-2px]`) rather than tiles.

---

## Task 1: Foundation — Lucide-backed shared icons in `ui.tsx`

**Files:**
- Modify: `src/components/ui.tsx`

- [ ] **Step 1: Add the Lucide import at the top of the file**

Add as the first line of `src/components/ui.tsx`:

```tsx
import { Check as LucideCheck, X as LucideX, Star } from "lucide-react";
```

- [ ] **Step 2: Replace the hand-rolled `Check` component (lines 1–16)**

Replace the entire existing `Check` function with a Lucide-backed version that keeps the exact same signature and default classes:

```tsx
export function Check({ className = "mt-px size-[18px] shrink-0 text-green" }: { className?: string }) {
  return <LucideCheck className={className} strokeWidth={2.4} aria-hidden="true" />;
}
```

- [ ] **Step 3: Replace the hand-rolled `Cross` component (lines 18–32)**

```tsx
export function Cross({ className = "mt-px size-[18px] shrink-0 text-faint" }: { className?: string }) {
  return <LucideX className={className} strokeWidth={2.4} aria-hidden="true" />;
}
```

- [ ] **Step 4: Add the `RatingStars` helper** (place it right after `Cross`, before `LogoMark`)

```tsx
export function RatingStars({ count = 5, className = "size-3.5" }: { count?: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-px align-middle text-amber" role="img" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className={className} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      ))}
    </span>
  );
}
```

`LogoMark`, `Logo`, `VerifiedBadge`, `SectionHead` are unchanged (brand marks / not icons).

- [ ] **Step 5: Type-check the file compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). Existing consumers of `<Check>`/`<Cross>` are unaffected because the signatures are identical.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui.tsx
git commit -m "refactor(ui): back Check/Cross with Lucide, add RatingStars helper"
```

---

## Task 2: Regression guard test (the failing test)

**Files:**
- Create: `tests/no-emoji-icons.test.ts`

- [ ] **Step 1: Write the guard test**

This is the red test: it scans every `src/**/*.tsx` file for emoji code points (after stripping comments) and fails listing offenders. Arrow `→` (U+2192) and geometric bullets like `●` (U+25CF) are intentionally NOT in the ranges — they are legitimate typography, not emoji.

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";

// Emoji / pictograph / dingbat / symbol ranges treated as "emoji used as UI".
// Deliberately excludes Arrows (U+2190–U+21FF) and Geometric Shapes (U+25A0–U+25FF).
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}]/u;

// Strip // line comments and /* */ block comments so emoji in comments don't count.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("no emoji used as UI elements", () => {
  const files = globSync("src/**/*.tsx", { cwd: process.cwd() });

  it("scans at least the known UI surface", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const rel of files) {
    it(`${rel} contains no emoji glyphs`, () => {
      const src = stripComments(readFileSync(join(process.cwd(), rel), "utf8"));
      const lines = src.split("\n");
      const offenders = lines
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => EMOJI.test(line))
        .map(({ line, n }) => `  ${rel}:${n}  ${line.trim()}`);
      expect(offenders, `emoji found:\n${offenders.join("\n")}`).toHaveLength(0);
    });
  }
});
```

> Note: if `globSync` is not available in the project's Node version, fall back to a small recursive `readdirSync` walker over `src` filtering `.tsx`. Verify with `node -e "console.log(typeof require('fs').globSync)"` first; if it prints `undefined`, use the walker.

- [ ] **Step 2: Run the guard to verify it FAILS**

Run: `npx vitest run tests/no-emoji-icons.test.ts`
Expected: FAIL — multiple files reported (Hero, Replace, Showcase, BookingFlow, TrustStrip, dashboard, etc.) with line numbers. This confirms the scan works and enumerates the remaining work for Tasks 3–6.

- [ ] **Step 3: Commit the test**

```bash
git add tests/no-emoji-icons.test.ts
git commit -m "test: add regression guard against emoji used as UI"
```

---

## Task 3: Marketing landing — pictographic-heavy files (Hero, Replace, Showcase)

**Files:**
- Modify: `src/components/Hero.tsx`
- Modify: `src/components/Replace.tsx`
- Modify: `src/components/Showcase.tsx`

- [ ] **Step 1: `Hero.tsx` — imports**

Change line 3 to also import the icons:

```tsx
import { VerifiedBadge } from "./ui";
import { Target, FileText, BookOpen, Star, type LucideIcon } from "lucide-react";
```

- [ ] **Step 2: `Hero.tsx` — convert `ServiceRow` to take a Lucide component**

Change the `icon` prop type (line 15) from `icon: string;` to `icon: LucideIcon;` and rename it in the destructure to `Icon`. Replace the tile (line 24). Full updated `ServiceRow` signature + tile:

```tsx
function ServiceRow({
  icon: Icon,
  iconBg,
  title,
  meta,
  price,
  note,
}: {
  icon: LucideIcon;
  iconBg: string;
  title: string;
  meta: string;
  price: string;
  note?: string;
}) {
  return (
    <div className="mt-2.5 flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-cream p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-soft">
      <div className={`grid size-9 shrink-0 place-items-center rounded-[11px] ${iconBg}`}>
        <Icon className="size-[18px] text-ink" strokeWidth={2} aria-hidden="true" />
      </div>
```

(everything below the tile in `ServiceRow` is unchanged)

- [ ] **Step 3: `Hero.tsx` — update the three `ServiceRow` usages (lines 202–204)**

```tsx
<ServiceRow icon={Target} iconBg="bg-[#FCE9E1]" title="1:1 Career Strategy Call" meta="45 min · Google Meet" price="₹1,499" note="slots open" />
<ServiceRow icon={FileText} iconBg="bg-[#FDF3DF]" title="Resume Review" meta="Async · 48 hr delivery" price="₹799" note="popular" />
<ServiceRow icon={BookOpen} iconBg="bg-green-soft" title="Interview Prep Kit" meta="Digital download" price="₹499" note="instant" />
```

- [ ] **Step 4: `Hero.tsx` — the `4.9 ★ rating` unit (line 198)**

Replace:

```tsx
<span><b className="text-[12.5px] text-ink">4.9</b> ★ rating</span>
```

with:

```tsx
<span className="inline-flex items-center gap-1"><b className="text-[12.5px] text-ink">4.9</b> <Star className="size-3 text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" /> rating</span>
```

- [ ] **Step 5: `Replace.tsx` — imports**

Change line 2 and add icons:

```tsx
import Reveal from "./Reveal";
import { Check, LogoMark, SectionHead } from "./ui";
import { Link2, CalendarDays, BadgePercent, Smartphone, Table2, type LucideIcon } from "lucide-react";
```

- [ ] **Step 6: `Replace.tsx` — convert `OLD_TOOLS` data (lines 4–10) to component refs**

```tsx
const OLD_TOOLS: { icon: LucideIcon; name: string; role: string; cost: string; costNote: string }[] = [
  { icon: Link2, name: "Link-in-bio tool", role: "Pretty links, zero revenue", cost: "₹420/mo", costNote: "and counting" },
  { icon: CalendarDays, name: "Scheduling tool", role: "Bookings, but no payments", cost: "₹830/mo", costNote: "per seat" },
  { icon: BadgePercent, name: "Monetization platform", role: "Takes a cut of every session", cost: "10–20%", costNote: "of your income" },
  { icon: Smartphone, name: "Manual UPI collection", role: "“Payment done?” screenshots", cost: "Untracked", costNote: "chaos" },
  { icon: Table2, name: "Spreadsheet CRM", role: "Client history, lost weekly", cost: "Hours", costNote: "every week" },
];
```

- [ ] **Step 7: `Replace.tsx` — render the icon component (the `.map` at lines 37–49)**

Replace the map body so it pulls the component out and the tile drops `text-[17px]`:

```tsx
{OLD_TOOLS.map((t) => {
  const Icon = t.icon;
  return (
    <div key={t.name} className="old-tool flex items-center gap-3.5 rounded-2xl border border-line bg-cream px-4.5 py-[15px]">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-paper">
        <Icon className="size-[19px] text-ink-2" strokeWidth={2} aria-hidden="true" />
      </div>
      <div>
        <div className="text-[14.5px] font-extrabold tracking-tight">{t.name}</div>
        <div className="text-xs font-semibold text-faint">{t.role}</div>
      </div>
      <div className="ml-auto whitespace-nowrap text-right text-[12.5px] font-extrabold text-terra-deep">
        {t.cost}
        <small className="block text-[10.5px] font-semibold text-faint">{t.costNote}</small>
      </div>
    </div>
  );
})}
```

- [ ] **Step 8: `Showcase.tsx` — imports**

Add to the existing import block at the top of `src/components/Showcase.tsx` (alongside whatever it already imports):

```tsx
import { Check } from "./ui";
import { Dumbbell, Salad, Sun, Star, type LucideIcon } from "lucide-react";
```

(If `Showcase.tsx` already imports from `./ui`, merge `Check` into that line instead of adding a duplicate.)

- [ ] **Step 9: `Showcase.tsx` — service list icons (lines 94–106)**

Change the inline service data + tile. The data currently is `{ icon: "💪", bg: ..., ... }`. Update to component refs and render:

```tsx
{[
  { icon: Dumbbell as LucideIcon, bg: "bg-[#FCE9E1]", title: "1:1 Training Session", meta: "60 min · Online", price: "₹999" },
  { icon: Salad as LucideIcon, bg: "bg-[#FDF3DF]", title: "Nutrition Plan", meta: "Monthly · PDF + check-ins", price: "₹2,499" },
].map((s) => {
  const Icon = s.icon;
  return (
    <div key={s.title} className="mt-2.5 flex items-center gap-3 rounded-2xl border border-line bg-cream p-3">
      <div className={`grid size-9 shrink-0 place-items-center rounded-[11px] ${s.bg}`}>
        <Icon className="size-[18px] text-ink" strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold tracking-tight">{s.title}</div>
        <div className="text-[10.5px] font-semibold text-faint">{s.meta}</div>
      </div>
      <div className="text-[13px] font-extrabold">{s.price}</div>
    </div>
  );
})}
```

- [ ] **Step 10: `Showcase.tsx` — the `4.8 ★` unit (line 90)**

Replace:

```tsx
<span><b className="text-[12.5px] text-ink">4.8</b> ★</span>
```

with:

```tsx
<span className="inline-flex items-center gap-1"><b className="text-[12.5px] text-ink">4.8</b> <Star className="size-3 text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" /></span>
```

- [ ] **Step 11: `Showcase.tsx` — the `✓ 100% goes…` line (line 177)**

Replace:

```tsx
<div className="rounded-[10px] bg-green-soft p-2.5 text-xs font-bold text-green-deep">
  ✓ 100% goes to the creator · 0% platform fee
</div>
```

with:

```tsx
<div className="flex items-center justify-center gap-1.5 rounded-[10px] bg-green-soft p-2.5 text-xs font-bold text-green-deep">
  <Check className="size-3.5 shrink-0 text-green-deep" /> 100% goes to the creator · 0% platform fee
</div>
```

- [ ] **Step 12: `Showcase.tsx` — the `Good morning, Meera ☀️` line (line 199)**

Replace:

```tsx
<b className="text-[13.5px] tracking-tight">Good morning, Meera ☀️</b>
```

with:

```tsx
<b className="inline-flex items-center gap-1.5 text-[13.5px] tracking-tight">Good morning, Meera <Sun className="size-3.5 text-amber" strokeWidth={2} aria-hidden="true" /></b>
```

- [ ] **Step 13: Run the guard — these three files should now be clean**

Run: `npx vitest run tests/no-emoji-icons.test.ts`
Expected: Hero.tsx, Replace.tsx, Showcase.tsx tests now PASS (others still fail).

- [ ] **Step 14: Commit**

```bash
git add src/components/Hero.tsx src/components/Replace.tsx src/components/Showcase.tsx
git commit -m "feat(landing): replace emoji icons with Lucide in Hero/Replace/Showcase"
```

---

## Task 4: Marketing landing — small glyphs (Features, Pricing, FinalCta, Footer, DemoBanner, SlotRow)

**Files:**
- Modify: `src/components/Features.tsx`
- Modify: `src/components/Pricing.tsx`
- Modify: `src/components/FinalCta.tsx`
- Modify: `src/components/Footer.tsx`
- Modify: `src/components/DemoBanner.tsx`
- Modify: `src/components/SlotRow.tsx`

- [ ] **Step 1: `Features.tsx` — WhatsApp bubble 👋 and ✓✓ (lines 155–159)**

Add `import { Hand, Check } from "lucide-react";` (or `Hand` from lucide + `Check` from `./ui` — prefer Lucide `Check` here so the ticks match weight). Then replace the bubble:

```tsx
<div className="max-w-[330px] rounded-2xl rounded-bl-[5px] border border-[#CDEBD9] bg-[#E9F8EF] px-4 py-3 text-[12.5px] font-semibold leading-normal text-[#1D4B33]">
  Hi Rohit! <Hand className="inline size-3.5 align-[-2px] text-[#1D4B33]" strokeWidth={2} aria-hidden="true" /> Reminder: your <b className="font-extrabold">1:1 Career Strategy Call</b> with Meera is{" "}
  <b className="font-extrabold">tomorrow at 11:00 am</b>. Join link: meet.creatoros.in/rohit
  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold text-[#6FA388]">
    Sent automatically · 10:58 am
    <span className="inline-flex -space-x-1">
      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
    </span>
  </div>
</div>
```

> Handoff note: these two glyphs sit inside a simulated WhatsApp message. If the realism is preferred over absolute consistency, an acceptable alternative is to keep them as text and add them to an allowlist in the guard. Default here is to convert.

- [ ] **Step 2: `Pricing.tsx` — `★ Founding member` badge (line 69)**

Add `import { Star } from "lucide-react";`. Replace:

```tsx
<div className="absolute -top-[15px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-grad px-4.5 py-[7px] text-[11.5px] font-extrabold uppercase tracking-wide text-white shadow-[0_6px_18px_-4px_rgba(226,85,44,.55)]">
  ★ Founding member — price locked forever
</div>
```

with (note: white star on the gradient badge, so `text-white`, filled):

```tsx
<div className="absolute -top-[15px] left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-grad px-4.5 py-[7px] text-[11.5px] font-extrabold uppercase tracking-wide text-white shadow-[0_6px_18px_-4px_rgba(226,85,44,.55)]">
  <Star className="size-3 text-white" fill="currentColor" strokeWidth={0} aria-hidden="true" /> Founding member — price locked forever
</div>
```

- [ ] **Step 3: `FinalCta.tsx` — `Link reserved ✓` button (line 40)**

Add `import { Check } from "./ui";`. Replace:

```tsx
<button type="submit" className="btn btn-grad !px-6 !py-3 !text-[14.5px] max-md:w-full">
  {claimed ? "Link reserved ✓" : "Claim free link"}
</button>
```

with:

```tsx
<button type="submit" className="btn btn-grad !px-6 !py-3 !text-[14.5px] max-md:w-full">
  {claimed ? (
    <span className="inline-flex items-center gap-1.5">Link reserved <Check className="size-4 text-current" /></span>
  ) : (
    "Claim free link"
  )}
</button>
```

(The button text is on the gradient/white, so `text-current` keeps the tick the same colour as the label rather than green.)

- [ ] **Step 4: `Footer.tsx` — `Done ✓` button (line 119) and `Made with ♥` (line 137)**

Add `import { Check } from "./ui"; import { Heart } from "lucide-react";`. Replace line 119:

```tsx
{subscribed ? (
  <span className="inline-flex items-center gap-1.5">Done <Check className="size-3.5 text-current" /></span>
) : (
  "Subscribe"
)}
```

Replace line 137:

```tsx
<p className="inline-flex items-center gap-1 text-[13px] font-semibold text-faint">
  Made with <Heart className="size-3.5 text-terra" fill="currentColor" strokeWidth={0} aria-hidden="true" /> in India
</p>
```

- [ ] **Step 5: `DemoBanner.tsx` — `👀` (line 7)**

Add `import { Eye } from "lucide-react";`. Replace:

```tsx
<p className="min-w-0 truncate text-[12.5px] font-semibold text-[#D9D5CA]">
  <span aria-hidden="true">👀</span> This is a demo profile —{" "}
```

with:

```tsx
<p className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-semibold text-[#D9D5CA]">
  <Eye className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" /> This is a demo profile —{" "}
```

- [ ] **Step 6: `SlotRow.tsx` — selected `✓` (line 21)**

Add `import { Check } from "lucide-react";` after the existing imports. Replace:

```tsx
{s.time}
{selected === i && " ✓"}
```

with:

```tsx
{s.time}
{selected === i && <Check className="ml-1 inline size-3.5 align-[-2px]" strokeWidth={3} aria-hidden="true" />}
```

- [ ] **Step 7: Run the guard for these files**

Run: `npx vitest run tests/no-emoji-icons.test.ts`
Expected: Features, Pricing, FinalCta, Footer, DemoBanner, SlotRow now PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/Features.tsx src/components/Pricing.tsx src/components/FinalCta.tsx src/components/Footer.tsx src/components/DemoBanner.tsx src/components/SlotRow.tsx
git commit -m "feat(landing): replace remaining emoji glyphs with Lucide"
```

---

## Task 5: Public profile surfaces

**Files:**
- Modify: `src/components/profile/TrustStrip.tsx`
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/profile/ProfileTestimonials.tsx`
- Modify: `src/components/profile/Results.tsx`
- Modify: `src/components/profile/Services.tsx`
- Modify: `src/components/public-profile/SlotPicker.tsx`
- Modify: `src/app/meera/book/page.tsx`
- Modify: `src/app/meera/page.tsx`

- [ ] **Step 1: `TrustStrip.tsx` — credential icons + star**

Add at top: `import { Medal, GraduationCap, Trophy, Star, type LucideIcon } from "lucide-react";`. Change `CREDENTIALS` (lines 3–7) to component refs:

```tsx
const CREDENTIALS: { icon: LucideIcon; text: string }[] = [
  { icon: Medal, text: "ICF-ACC Certified Coach" },
  { icon: GraduationCap, text: "XLRI Jamshedpur" },
  { icon: Trophy, text: "Top 1% Mentor, 2025" },
];
```

Render (the `.map` at lines 33–41): pull the component and render it instead of `{c.icon}`:

```tsx
{CREDENTIALS.map((c) => {
  const Icon = c.icon;
  return (
    <span
      key={c.text}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-3.5 py-1.5 text-[13px] font-bold text-ink-2"
    >
      <Icon className="size-3.5 text-ink-2" strokeWidth={2} aria-hidden="true" />
      {c.text}
    </span>
  );
})}
```

Replace the inline `★` at line 43:

```tsx
<span className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-3.5 py-1.5 text-[13px] font-bold text-ink-2">
  <Star className="size-3.5 text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" />
  4.9 · 212 verified reviews
</span>
```

- [ ] **Step 2: `ProfileHeader.tsx` — metric `4.9 ★` (line 33) and `★ Most booked` badge (line 335)**

Add `import { Star } from "lucide-react";` (merge into any existing lucide import). The `METRICS` array currently has `value: "4.9 ★"` as a string among other string values — widen it to ReactNode by making that one JSX:

```tsx
const METRICS: { value: React.ReactNode; label: string }[] = [
  { value: "340+", label: "sessions" },
  { value: <span className="inline-flex items-center gap-1">4.9 <Star className="size-3.5 text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" /></span>, label: "212 reviews" },
  { value: "120+", label: "clients helped" },
  { value: "5 yrs", label: "experience" },
];
```

Replace the badge at line 335:

```tsx
<span className="inline-flex items-center gap-1.5 rounded-full bg-grad px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
  <Star className="size-3 text-white" fill="currentColor" strokeWidth={0} aria-hidden="true" /> Most booked
</span>
```

> If `METRICS` is consumed somewhere expecting `string` (e.g. string methods), check usages; it is rendered as `{m.value}` text only, so ReactNode is safe.

- [ ] **Step 3: `ProfileTestimonials.tsx` — `★★★★★` strip (lines 74–76)**

Add `import { RatingStars } from "../ui";` (adjust relative path: from `src/components/profile/` to `src/components/ui` is `../ui`). Replace:

```tsx
<div className="text-[15px] tracking-[0.18em] text-amber" aria-label="5 out of 5 stars">
  ★★★★★
</div>
```

with:

```tsx
<RatingStars className="size-3.5" />
```

- [ ] **Step 4: `Results.tsx` — `★★★★★ · 212 reviews` note (line 35)**

Add `import { RatingStars } from "../ui";`. The `note` field is a string among others — make this one JSX and widen the type. Replace the object (lines 32–36):

```tsx
{
  value: "4.9",
  label: "average rating",
  note: <span className="inline-flex items-center gap-1.5"><RatingStars className="size-3" /> · 212 reviews</span>,
},
```

If the metrics array has an explicit element type, change `note: string` to `note: React.ReactNode`. It is rendered as `{x.note}` so ReactNode is safe.

- [ ] **Step 5: `Services.tsx` (profile) — `★ Most popular` badge (line 141)**

Add `import { Star } from "lucide-react";`. Replace:

```tsx
<span className="rounded-full bg-grad px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow-[0_4px_14px_-4px_rgba(226,85,44,.6)]">
  ★ Most popular
</span>
```

with:

```tsx
<span className="inline-flex items-center gap-1.5 rounded-full bg-grad px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow-[0_4px_14px_-4px_rgba(226,85,44,.6)]">
  <Star className="size-3 text-white" fill="currentColor" strokeWidth={0} aria-hidden="true" /> Most popular
</span>
```

- [ ] **Step 6: `public-profile/SlotPicker.tsx` — selected `✓` (line 96)**

Add `import { Check } from "lucide-react";`. Replace:

```tsx
{istTime(s.slotStart)}
{sel && " ✓"}
```

with:

```tsx
{istTime(s.slotStart)}
{sel && <Check className="ml-1 inline size-3.5 align-[-2px]" strokeWidth={3} aria-hidden="true" />}
```

- [ ] **Step 7: `app/meera/book/page.tsx` — UI star (line 76) + meta reword (line 15)**

Add `import { Star } from "lucide-react";`. Replace line 76:

```tsx
<Star className="inline size-3 align-[-1px] text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" /> <b className="text-ink">4.9</b> (212 reviews)
```

Reword the meta description string (line 15) to drop the `★` glyph (it is an SEO `<meta>` string, not UI):

```tsx
"Pick a slot, pay via UPI and get instant confirmation on WhatsApp. 45-minute career strategy call with Meera Shah — rated 4.9 from 212 reviews.",
```

- [ ] **Step 8: `app/meera/page.tsx` — meta reword (line 20)**

Reword the description string to drop the `★`:

```tsx
"Book a 1:1 career strategy call, resume review or mock interview with Meera Shah. 340+ sessions, rated 4.9, 120+ clients helped. Pay via UPI, instant confirmation.",
```

- [ ] **Step 9: Run the guard for profile surfaces**

Run: `npx vitest run tests/no-emoji-icons.test.ts`
Expected: all `profile/*`, `public-profile/SlotPicker`, and `app/meera/*` tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/profile src/components/public-profile/SlotPicker.tsx "src/app/meera/book/page.tsx" src/app/meera/page.tsx
git commit -m "feat(profile): replace emoji icons with Lucide across public profile"
```

---

## Task 6: Booking, onboarding & dashboard surfaces

**Files:**
- Modify: `src/components/booking/BookingFlow.tsx`
- Modify: `src/components/booking/BookingSuccess.tsx`
- Modify: `src/components/booking/PaymentFlow.tsx`
- Modify: `src/components/onboarding/WizardHeader.tsx`
- Modify: `src/components/onboarding/payments/PayoutTimeline.tsx`
- Modify: `src/components/dashboard/Shell.tsx`
- Modify: `src/components/dashboard/Panels.tsx`

- [ ] **Step 1: `BookingFlow.tsx` — imports**

Add `import { Target, Zap, CalendarDays, MessageCircle, Repeat, Check, type LucideIcon } from "lucide-react";` (merge with any existing lucide import). `LucideIcon` is needed by the feature-row map in Step 3.

- [ ] **Step 2: `BookingFlow.tsx` — service overview tile 🎯 (lines 267–269)**

Replace:

```tsx
<div className="grid size-13 shrink-0 place-items-center rounded-2xl bg-cream-2 text-[24px]">
  <span aria-hidden="true">🎯</span>
</div>
```

with:

```tsx
<div className="grid size-13 shrink-0 place-items-center rounded-2xl bg-cream-2">
  <Target className="size-6 text-ink" strokeWidth={2} aria-hidden="true" />
</div>
```

- [ ] **Step 3: `BookingFlow.tsx` — feature row ⚡📅💬🔁 (lines 296–305)**

Replace the array + map:

```tsx
{[
  [Zap, "Instant confirmation"],
  [CalendarDays, "Calendar invite sent"],
  [MessageCircle, "WhatsApp reminders"],
  [Repeat, "Free rescheduling"],
].map(([Icon, text]) => (
  <div key={text as string} className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
    {(() => { const C = Icon as LucideIcon; return <C className="size-4 shrink-0 text-ink-2" strokeWidth={2} aria-hidden="true" />; })()} {text}
  </div>
))}
```

> Simpler alternative if the mixed-tuple typing is awkward: define `const FEATURES: { icon: LucideIcon; text: string }[] = [{ icon: Zap, text: "Instant confirmation" }, …]` above the JSX and map over it with `const Icon = f.icon;`. Use whichever the implementer finds cleaner; ensure `LucideIcon` is imported as a type.

- [ ] **Step 4: `BookingFlow.tsx` — `⚡ Only 3 slots left today` (line 339)**

Replace:

```tsx
<span className="pop-in rounded-full bg-[#FDF3DF] px-3 py-1.5 text-[12px] font-extrabold text-[#9A6A14]">
  ⚡ Only 3 slots left today
</span>
```

with:

```tsx
<span className="pop-in inline-flex items-center gap-1.5 rounded-full bg-[#FDF3DF] px-3 py-1.5 text-[12px] font-extrabold text-[#9A6A14]">
  <Zap className="size-3.5" strokeWidth={2.4} aria-hidden="true" /> Only 3 slots left today
</span>
```

- [ ] **Step 5: `BookingFlow.tsx` — selected slot `✓` (line 376)**

Replace:

```tsx
{s}
{sel && " ✓"}
```

with:

```tsx
{s}
{sel && <Check className="ml-1 inline size-3.5 align-[-2px]" strokeWidth={3} aria-hidden="true" />}
```

- [ ] **Step 6: `BookingFlow.tsx` — summary tile 🎯 (lines 533–535)**

Replace:

```tsx
<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream-2 text-[17px]" aria-hidden="true">
  🎯
</span>
```

with:

```tsx
<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream-2" aria-hidden="true">
  <Target className="size-[18px] text-ink" strokeWidth={2} />
</span>
```

- [ ] **Step 7: `BookingSuccess.tsx` — `Paid ✓` (line 54)**

Add `import { Check } from "../ui";` (path from `src/components/booking/` to `ui` is `../ui`). Replace:

```tsx
<span className="ml-auto shrink-0 rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-extrabold text-green-deep">
  Paid ✓
</span>
```

with:

```tsx
<span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-extrabold text-green-deep">
  Paid <Check className="size-3 text-green-deep" />
</span>
```

- [ ] **Step 8: `PaymentFlow.tsx` — service tile 🎯 (lines 100–102)**

Add `import { Target } from "lucide-react";`. Replace:

```tsx
<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream-2 text-[17px]" aria-hidden="true">
  🎯
</span>
```

with:

```tsx
<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream-2" aria-hidden="true">
  <Target className="size-[18px] text-ink" strokeWidth={2} />
</span>
```

- [ ] **Step 9: `WizardHeader.tsx` — step `✓` (line 36)**

Add `import { Check } from "lucide-react";`. Replace:

```tsx
{i < current ? "✓" : i + 1}
```

with:

```tsx
{i < current ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : i + 1}
```

- [ ] **Step 10: `PayoutTimeline.tsx` — step `✓` (line 49)**

Add `import { Check } from "lucide-react";`. Replace:

```tsx
{done ? "✓" : i + 1}
```

with:

```tsx
{done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
```

- [ ] **Step 11: `dashboard/Shell.tsx` — imports**

Add `import { Hand, Command, RatingStars } from ...`. Note `Hand` and `Command` come from `lucide-react`; `RatingStars` from the shared ui module (path from `src/components/dashboard/` is `../ui`). So: `import { Hand, Command } from "lucide-react";` and `import { RatingStars } from "../ui";` (merge if Shell already imports from `../ui`).

- [ ] **Step 12: `dashboard/Shell.tsx` — notification title `★★★★★` (line 114)**

This is in a data array; make the title JSX. Replace:

```tsx
title: "New review ★★★★★",
```

with:

```tsx
title: <>New review <RatingStars className="size-3" /></>,
```

If the notifications array has an explicit `title: string` type, change it to `title: React.ReactNode`. Rendered as `{n.title}`, so ReactNode is safe.

- [ ] **Step 13: `dashboard/Shell.tsx` — greeting `👋` (line 241)**

Replace:

```tsx
{now ? `${greeting}, Abhishek 👋` : "Welcome back 👋"}
```

with:

```tsx
{now ? (
  <span className="inline-flex items-center gap-1.5">{greeting}, Abhishek <Hand className="size-4 text-amber" strokeWidth={2} aria-hidden="true" /></span>
) : (
  <span className="inline-flex items-center gap-1.5">Welcome back <Hand className="size-4 text-amber" strokeWidth={2} aria-hidden="true" /></span>
)}
```

- [ ] **Step 14: `dashboard/Shell.tsx` — `⌘K` kbd (line 255)**

Replace:

```tsx
<kbd className="rounded-md border border-line bg-cream px-1.5 py-0.5 text-[10.5px] font-bold text-faint max-sm:hidden">
  ⌘K
</kbd>
```

with:

```tsx
<kbd className="inline-flex items-center gap-0.5 rounded-md border border-line bg-cream px-1.5 py-0.5 text-[10.5px] font-bold text-faint max-sm:hidden">
  <Command className="size-3" strokeWidth={2} aria-hidden="true" />K
</kbd>
```

- [ ] **Step 15: `dashboard/Panels.tsx` — activity `★★★★★ review` (line 237)**

Add `import { RatingStars } from "../ui";`. Replace:

```tsx
{ dot: "bg-line-2", text: <>Kavya Reddy left a <b className="font-semibold">★★★★★ review</b></>, time: "Yesterday" },
```

with:

```tsx
{ dot: "bg-line-2", text: <>Kavya Reddy left a <b className="inline-flex items-center gap-1 font-semibold"><RatingStars className="size-3" /> review</b></>, time: "Yesterday" },
```

- [ ] **Step 16: Run the guard — everything should be green now**

Run: `npx vitest run tests/no-emoji-icons.test.ts`
Expected: ALL tests PASS (no emoji remain in any `src/**/*.tsx`).

- [ ] **Step 17: Commit**

```bash
git add src/components/booking src/components/onboarding src/components/dashboard
git commit -m "feat(app): replace emoji icons with Lucide in booking/onboarding/dashboard"
```

---

## Task 7: Full verification & close-out

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS — the new guard test green, and all pre-existing tests unaffected (this is a presentational change with no logic impact).

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS — no type errors from the `string → ReactNode`/`string → LucideIcon` widenings, no unused-import warnings (remove any leftover unused emoji-era imports if lint flags them).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS — confirms server components compile with the new imports.

- [ ] **Step 4: Visual pass on the dev server (mobile viewport)**

Run: `npm run dev`, then in the browser (DevTools mobile viewport) check each surface renders Lucide icons in their tiles with consistent stroke and correct semantic colour:
- `/` — Hero card, "five disconnected apps" (Replace), Showcase tabs, Features WhatsApp bubble, Pricing badge, Footer.
- `/meera` — TrustStrip credentials, ProfileHeader metrics/badge, testimonials stars, Results, Services badge.
- `/meera/book` — BookingFlow service tile, feature row, slot ticks, summary; payment screen.
- Booking success screen — "Paid" check.
- `/onboarding` — WizardHeader step ticks, PayoutTimeline.
- Dashboard — greeting hand, `⌘K`, activity/notification stars.

Confirm no emoji remain and nothing looks misaligned.

- [ ] **Step 5: Use superpowers:finishing-a-development-branch**

Hand off to the finishing-a-development-branch skill to decide merge/PR/cleanup for `fix/reconcile-tick-and-scheduler` (or a new branch if preferred for this UI work).

---

## Self-review notes

- **Spec coverage:** Buckets A (pictographic), B (stars), C (checks), D (decorative) each map to concrete edits across Tasks 1, 3–6. The single-icon-source consolidation is Task 1; the regression guard is Task 2; verification is Task 7.
- **Star colour correction vs spec:** the spec mockup showed terra stars; the codebase uses `text-amber` for ratings, so this plan uses amber to preserve the established look (terra reserved for the footer heart and primary actions). This is a deliberate refinement, not a gap.
- **Type widenings:** `METRICS.value`, `Results` note, and the dashboard notification `title` move from `string` to `React.ReactNode`; each is render-only (`{value}`), so safe. Flagged inline at each step.
- **Out of scope confirmed untouched:** emoji in `lib/`, `api/` routes, and comments/logs are `.ts` (not `.tsx`) or stripped by the guard's comment handling, so they neither break the build nor trip the test.
