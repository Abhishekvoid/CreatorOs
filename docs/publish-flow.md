# Publish Flow

How a creator goes from signup to a live, shareable page that can take bookings.

```
Signup → Claim handle → Profile → Service → Availability → Payments → Publish → Share
```

## Onboarding wizard

A server-driven wizard. Progress is stored as a jsonb map `completed_steps` on
the `profiles` row; a creator resumes at the first incomplete step.

| Step | Route | Persistence | Marks complete |
|---|---|---|---|
| handle | `/onboarding/handle` | handle action | `handle: true` |
| profile | `/onboarding/profile` | `saveProfileDraft` | `profile: true` |
| service | `/onboarding/service` | `saveServiceDraft` | `service: true` |
| availability | `/onboarding/availability` | `saveAvailability` | `availability: true` |
| payments | `/onboarding/payments` | `payment-profile` action | `payments: true` |

**Routing brain:** `destinationFor(profile)` in `src/lib/auth.ts` (used by the
onboarding index, the OAuth callback, and the proxy so the rules never drift):

- no row → `/onboarding/handle`
- `is_published` → `/dashboard`
- otherwise → first incomplete step
- all steps done → `/onboarding/publish`

`completed_steps` writes are read-merge-write and happen **only on explicit
Continue**, never on autosave.

## Publish eligibility

A page may go live **only when it is genuinely bookable**. Rules live in a pure,
unit-tested function, `evaluatePublishEligibility()`
(`src/lib/publish-eligibility.ts`), checked in wizard order — the first failure
decides the message and the step to return to:

1. **handle** — a claimed handle (`creatoros.in/{handle}` must resolve) → else `/onboarding/handle`
2. **service** — ≥1 active `type='booking'` service → else `/onboarding/service`
3. **availability** — ≥1 active availability window → else `/onboarding/availability`

`publishProfile()` (`src/lib/actions/profile.ts`) gathers the counts, runs the
gate, and on success flips `is_published = true` and returns the handle. On
failure it returns `{ error, redirectTo }`; `/onboarding/publish` redirects to
that exact step.

> Why availability is gated: previously only a service was required, so a
> creator could publish a page with **no bookable slots** — a live link that can
> never take a booking, silently breaking the get-paid path.

## The "You're Live" moment

`/onboarding/publish` → `PublishMoment` (`src/components/onboarding/PublishMoment.tsx`):

- The handle arrives as a **server prop** from `publishProfile()` (single source
  of truth); the client draft derivation remains only as the no-Supabase dev
  fallback.
- Actions: **Share on WhatsApp**, **Copy link**, **View profile** (opens
  `/{handle}` in a new tab), plus links to the dashboard / keep editing.
- One-time confetti choreography; respects `prefers-reduced-motion`.

## Public profile

`/[handle]` (`src/app/[handle]/page.tsx`) → `loadCreatorPage(handle)`
(`src/lib/public-profile.ts`). The loader filters
`where handle = $1 and is_published = true` and returns only active booking
services. A miss (unknown handle or a draft) renders `notFound()` → **HTTP 404**
(previously this threw → 500).

## Dashboard status strip

`ProfileStatusStrip` (`src/components/dashboard/ProfileStatusStrip.tsx`) is the
one real, DB-backed element on the dashboard (the surrounding cards are still
design mockups). Fed from the signed-in creator's `profiles` row:

- **Live** vs **Draft** badge from the real `is_published` flag.
- The creator's actual `creatoros.in/{handle}` URL.
- Published → Copy link / View profile / Edit profile.
- Draft → Publish page / Edit profile (a draft's public URL 404s, so Copy/View
  would hand out a dead link).

The `/dashboard` route is auth-gated (no session → `/login`, no handle →
`/onboarding/handle`); `/dashboard` and `/onboarding/*` are also protected by
the proxy (`src/proxy.ts`).

## File map

| Concern | File |
|---|---|
| Eligibility rules (pure) | `src/lib/publish-eligibility.ts` |
| Publish action | `src/lib/actions/profile.ts` (`publishProfile`) |
| Routing | `src/lib/auth.ts` (`destinationFor`) |
| Publish screen | `src/app/onboarding/publish/page.tsx` + `PublishMoment.tsx` |
| Public page | `src/app/[handle]/page.tsx` + `src/lib/public-profile.ts` |
| Dashboard strip | `src/components/dashboard/ProfileStatusStrip.tsx` |
| Tests | `tests/publish-eligibility.test.ts` |
