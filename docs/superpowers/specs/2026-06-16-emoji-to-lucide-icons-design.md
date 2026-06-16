# Replace emoji icons with Lucide icons

**Date:** 2026-06-16
**Status:** Approved design — ready for implementation plan

## Problem

Several surfaces render emoji (🎯 📅 💸 ★ ✓ 👋 …) as interface icons. Coloured emoji
glyphs render inconsistently across devices, clash with the "calm ledger" visual system,
and make the product read as AI-generated — directly undermining the client-trust and
growth goals, since the public page and booking flow are marketing surfaces. The design
language already mandates "Lucide, consistent stroke, in soft squircles — no emoji as
interface elements," and `lucide-react` is already a dependency. This work brings the
codebase in line with that rule.

## Scope

In scope — replace every emoji/glyph used as a UI element across all `src/` surfaces
(marketing landing, public profile, booking, onboarding, dashboard), in four buckets:

- **A — Pictographic icons** (🎯 📄 📘 💪 🥗 🔗 📅 💸 📲 📊 🎖️ 🎓 🏆 ⚡ 💬 🔁)
- **B — Star ratings** (★)
- **C — Checkmarks** (✓)
- **D — Decorative-in-copy emoji** (👋 👀 ☀️ ♥ ⌘)

Out of scope: emoji inside comments, `console.*` logs, API routes, and `lib/` server code
(not user-facing). No visual redesign beyond the glyph swap — tiles, colours, sizes, and
layout stay as-is.

## Approved icon mapping

All replacements are `lucide-react` icons. Each keeps its existing squircle tile, tile
background colour, and size; only the glyph changes.

### A — Pictographic icons

| Emoji | Lucide | Meaning | Files |
|-------|--------|---------|-------|
| 🎯 | `Target` | career strategy / book | Hero, BookingFlow, PaymentFlow |
| 📄 | `FileText` | resume review | Hero |
| 📘 | `BookOpen` | prep kit / digital download | Hero |
| 💪 | `Dumbbell` | training session | Showcase |
| 🥗 | `Salad` | nutrition plan | Showcase |
| 🔗 | `Link2` | link-in-bio tool | Replace |
| 📅 | `CalendarDays` | scheduling | Replace, BookingFlow |
| 💸 | `BadgePercent` | platform takes a cut | Replace |
| 📲 | `Smartphone` | manual UPI collection | Replace |
| 📊 | `Table2` | spreadsheet CRM | Replace |
| 🎖️ | `Medal` | certified coach | TrustStrip |
| 🎓 | `GraduationCap` | education credential | TrustStrip |
| 🏆 | `Trophy` | top mentor award | TrustStrip |
| ⚡ | `Zap` | instant / fast | BookingFlow |
| 💬 | `MessageCircle` | WhatsApp confirm | BookingFlow |
| 🔁 | `Repeat` | rebooking | BookingFlow |

### B — Star ratings

| Glyph | Lucide | Notes |
|-------|--------|-------|
| ★ | `Star` (filled, terra) | Render via shared `RatingStars` helper |

Files: ProfileHeader, ProfileTestimonials, Results, Services, Pricing, Hero, TrustStrip,
Showcase, dashboard Panels & Shell.

### C — Checkmarks

| Glyph | Lucide | Notes |
|-------|--------|-------|
| ✓ | `Check` (green) | Route all raw `✓` through the shared `<Check>` component |

Files: BookingFlow, BookingSuccess, FinalCta, Footer, SlotPicker, SlotRow, WizardHeader,
PayoutTimeline, Showcase.

### D — Decorative-in-copy

| Emoji | Lucide | Context | Files |
|-------|--------|---------|-------|
| 👋 | `Hand` | "Hey {name}" greeting | Shell, Features |
| 👀 | `Eye` | demo banner | DemoBanner |
| ☀️ | `Sun` | "Good morning" | Showcase |
| ♥ | `Heart` (filled, terra) | "made with ♥" | Footer |
| ⌘ | `Command` | keyboard-shortcut hint | Shell |

## Architecture

### Single icon source

The app currently splits icon handling three ways: hand-rolled SVGs in `ui.tsx`
(`Check`, `Cross`, `LogoMark`), Lucide re-exports in `profile/icons/service_icons.ts`, and
ad-hoc emoji glyphs in component bodies/data. This work consolidates onto Lucide:

1. **`ui.tsx` — rebuild `Check` and `Cross` on Lucide** (`Check`, `X`), preserving the
   exact same component signature (`className` prop, current default classes). Because the
   public API is unchanged, every existing consumer upgrades for free, and the raw `✓`
   glyphs elsewhere get pointed at `<Check>`. `LogoMark`/`Logo` are brand marks, not icons
   — left untouched.

2. **Add a `RatingStars` helper** (in `ui.tsx`) that renders a row of `count` filled Lucide
   `<Star>` (default 5), replacing the repeated `★★★★★` strips across ~9 files. Props:
   `count` (default 5) and optional `className`/size. No partial/half-star fill is needed —
   existing usages are either a full 5-star strip or a single `★` unit beside a numeric
   rating (the latter is just `<RatingStars count={1} />` or an inline `<Star>`). Terra
   fill, consistent stroke.

3. **Data-driven icon lists** (Replace `OLD_TOOLS`, TrustStrip `CREDENTIALS`, Showcase
   services, Hero `ServiceRow`, BookingFlow feature list) change their shape from
   `icon: "🎯"` (emoji string) to `icon: Target` (a `LucideIcon` component reference) and
   render `<Icon className=… />`. Tile markup, background colour classes, and sizing are
   unchanged.

### Consistent rendering

- Lucide default `strokeWidth={2}` everywhere (the brief's "consistent stroke").
- `size` matched to each icon's existing tile so visual weight is preserved.
- Semantic colour preserved: green on checks, terra on stars/heart, ink on neutral icons —
  colour stays semantic, never decorative.
- Decorative inline emoji (D) become inline `<Icon>` sized to the surrounding text
  (`size-[1em]`-ish) with appropriate vertical alignment.

## Regression guard

Add a Vitest test (`tests/no-emoji-icons.test.ts` or similar) that scans `src/**/*.tsx`
for emoji code-point ranges in JSX/text and fails if any are found. This prevents emoji
creeping back into the UI. The scan targets `.tsx` UI files and excludes comments and
string-literal log/console lines so server-side log emoji (out of scope) don't trip it.
The first run also doubles as a completeness check for this work.

## Affected files (≈25)

Marketing/landing: `Hero.tsx`, `Features.tsx`, `Replace.tsx`, `Showcase.tsx`,
`Pricing.tsx`, `FinalCta.tsx`, `Footer.tsx`, `DemoBanner.tsx`, `SlotRow.tsx`.
Profile (public): `profile/TrustStrip.tsx`, `profile/ProfileHeader.tsx`,
`profile/ProfileTestimonials.tsx`, `profile/Results.tsx`, `profile/Services.tsx`,
`public-profile/SlotPicker.tsx`.
Booking: `booking/BookingFlow.tsx`, `booking/BookingSuccess.tsx`, `booking/PaymentFlow.tsx`.
Onboarding: `onboarding/WizardHeader.tsx`, `onboarding/payments/PayoutTimeline.tsx`.
Dashboard: `dashboard/Shell.tsx`, `dashboard/Panels.tsx`.
Shared: `ui.tsx` (rebuild `Check`/`Cross`, add `RatingStars`).

(Final file list is whatever the regression-guard scan flags; the list above is the survey
from the emoji sweep.)

## Testing & verification

- `npm test` (Vitest) stays green — this is a presentational change with no logic impact.
- New emoji-guard test passes (no emoji remain in scope).
- Visual pass on the dev server of: public profile page, booking flow, booking success,
  onboarding wizard, dashboard, and the marketing landing — confirming icons render in
  their tiles with consistent stroke and correct semantic colour, on a mobile viewport.

## Non-goals

- No new icons or layout changes beyond replacing glyphs.
- No change to `LogoMark`/brand marks.
- No touching server-side / log emoji.
- No icon-library migration — Lucide is already chosen and partly in use.
