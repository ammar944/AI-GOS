# Business Profiles Integration Plan

## Goal
Wire up the existing profiles backend into the UI — auto-save from onboarding, show in sidebar, show on dashboard, ensure chat gets profile context.

## What Already Exists
- Supabase `business_profiles` table (30+ fields, RLS, upsert on user_id+company_name)
- `src/lib/profiles/business-profiles.ts` — full service (save, list, fetch, buildContext)
- `src/app/api/profiles/route.ts` — GET (list) + POST (save from session)
- `src/app/api/chat/unified/route.ts` — already loads `getActiveProfile()` and injects into chat system prompt
- `src/components/journey/profile-card.tsx` — preview card during onboarding (reads local state)

## What's Missing

### Task 1: Auto-save profile after onboarding completes
**File**: `src/app/journey/page.tsx`
**When**: After the last onboarding field is collected and research dispatches begin (transition to workspace phase)
**How**: Call `POST /api/profiles` with the current `sessionId`. Fire-and-forget — don't block the research flow.
**Why**: User shouldn't have to manually save. Profile persists automatically from onboarding answers.

### Task 2: Profile selector in sidebar
**File**: `src/components/shell/app-sidebar.tsx` (modify)
**New file**: `src/components/shell/profile-selector.tsx`
**Design**:
- Below the nav items, above the footer
- Collapsed state: small avatar/icon with company initial
- Expanded state: dropdown showing company name + industry
- Click opens a popover listing all saved profiles
- Each item: company name, industry badge, last updated date
- Active profile highlighted with accent ring
- "New Journey" button at bottom of list
**Data**: `GET /api/profiles` via SWR or React Query (already using neither — use `useEffect` + fetch to match existing patterns)
**Interaction**: Selecting a profile sets it as active (store `activeProfileId` in localStorage)

### Task 3: Dashboard profiles section
**File**: `src/app/dashboard/page.tsx` (check if exists, create section)
**Design**:
- Grid of profile cards (max 6 visible, "View All" link)
- Each card: company name, website favicon, industry, budget, last research date
- Click navigates to `/journey` with that profile pre-loaded
- Empty state: "Start your first journey" CTA
**Data**: Same `GET /api/profiles` endpoint

### Task 4: Profile context in journey lead agent
**File**: `src/app/api/journey/stream/route.ts`
**How**: Load `getActiveProfile(userId)` at request start. If profile exists, append `buildProfileContext(profile)` to the system prompt. This gives the onboarding agent awareness of returning users.
**Check**: Verify unified chat already has this (research says yes — confirm in code).

### Task 5: Pre-fill from profile on new journey
**File**: `src/app/journey/page.tsx`
**When**: User starts a new journey with an active profile selected
**How**: If `activeProfileId` is set in localStorage, load the profile via `GET /api/profiles/:id` and pre-populate the `savedSession` state so the journey page shows the "resume" phase instead of "welcome"
**Benefit**: Returning users skip re-entering company info

## Design Tokens (from existing design system)
- Dark OLED background: `--bg-primary` (already in app)
- Cards: `bg-card` with `border-border` — match existing workspace card styling
- Profile badge: `bg-primary/10 text-primary` for active state
- Typography: DM Sans (body), Instrument Sans (headings) — per DISCOVERY.md
- Icons: Lucide (`Building2`, `Globe`, `Users`, `Target`)

## File Impact Summary
| File | Action |
|------|--------|
| `src/app/journey/page.tsx` | Modify — auto-save profile + pre-fill from profile |
| `src/components/shell/app-sidebar.tsx` | Modify — add profile selector slot |
| `src/components/shell/profile-selector.tsx` | **Create** — profile dropdown component |
| `src/app/dashboard/page.tsx` | Modify — add profiles grid section |
| `src/components/dashboard/profile-grid.tsx` | **Create** — dashboard profile cards |
| `src/app/api/journey/stream/route.ts` | Modify — inject profile context into system prompt |

## Non-goals
- Profile editing UI (profiles update on next journey completion via upsert)
- Profile deletion (future)
- Profile sharing (separate feature — shared sessions)
- Changing the profiles API or Supabase schema

## Verification
- [ ] New journey → complete onboarding → profile auto-saved to Supabase
- [ ] Sidebar shows saved profiles with active indicator
- [ ] Dashboard shows profile cards grid
- [ ] Starting new journey with active profile pre-fills company info
- [ ] Chat agent references business context from profile
- [ ] Build passes (`npm run build`)
