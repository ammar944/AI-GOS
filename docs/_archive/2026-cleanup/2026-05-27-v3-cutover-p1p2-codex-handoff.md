# v3 → main Cutover — Phase 1 & 2 Codex Hand-off (2026-05-27)

Author: Claude (HQ). Executor: Codex (xhigh). Branch/worktree: `feat/v2-lab-section-wire`
(`/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`). Baseline HEAD `23ae724f`.

Context: lab-wire is the integrated v3 app (dashboard + profiles + new corpus/sections engine +
Audit Reader, journey removed). We are preparing to merge it to the live `main` domain. Two
branch-local phases here. **Phase 3 (merge to main + prod migrations + deploy) is NOT in scope —
do not merge, do not touch prod, do not deploy.**

Make **two separate commits** (one per phase). Do not touch the research engine/corpus, ad-scripts
(stays removed), or `/journey` (stays deleted).

---

## PHASE 1 — Restore RBAC / access-gating (additive)

**GOAL:** Restore `main`'s account-status + role access gate onto lab-wire, layered on top of
lab-wire's EXISTING Clerk-`auth()` + `userId` data-ownership (which already works — leave it).

**NON-GOALS (do NOT do these):**
- Do NOT rewrite lab-wire's existing per-route ownership. Every route already scopes by `userId`
  (`getProfile(userId, id)`, `.eq('user_id', userId)`). Leave that intact.
- Do NOT wire impersonation (`effectiveUserId`) into the new research-v2/v3 data paths — follow-up.
- Do NOT implement the client-journey-lock rule on research-v2 — follow-up.
- Do NOT re-add `/journey`, do NOT restore ad-scripts, do NOT touch the corpus/section runners.

**FILES — port verbatim from `main` via `git show main:<path> > <path>`:**
- `src/lib/auth/app-access.ts`
- `src/lib/auth/app-access-guards.ts`
- `src/lib/auth/impersonation.ts`
- `src/lib/auth/app-access.test.ts`
- `src/app/access-pending/page.tsx`
- `src/app/access-disabled/page.tsx`
- `src/app/internal/layout.tsx`
- `src/app/internal/allowlist/page.tsx`
- `src/app/internal/clients/page.tsx`
- `src/app/api/admin/allowlist/route.ts`
- `src/app/api/admin/impersonation/route.ts`
- `src/app/api/auth/me/route.ts`
- `supabase/migrations/20260421_add_app_roles_to_user_profiles.sql`
- `supabase/migrations/20260421_create_access_audit_logs.sql`
- `supabase/migrations/20260421_create_client_allowlist.sql`

(`src/lib/auth/errors.ts` already exists on lab-wire and is identical to main — leave it.)

**KNOWN IMPORT DRIFT to reconcile (verified):**
- `app-access.ts` imports `{ mapRow, type BusinessProfile }` from `@/lib/profiles/business-profiles`.
  lab-wire's `business-profiles.ts` exports `BusinessProfile` but **does NOT export `mapRow`**.
  Fix: port main's `mapRow` into lab-wire's `business-profiles.ts` as an ADDITIVE export (copy it
  verbatim from `git show main:src/lib/profiles/business-profiles.ts`). Do NOT change existing
  exports/behavior in that file.
- `createAdminClient` from `@/lib/supabase/server` exists on lab-wire ✓.
- The ported `/internal/*` pages and `api/admin/*` + `api/auth/me` routes may import UI components or
  helpers that drifted on lab-wire. Resolve each `tsc` error by adapting to lab-wire's equivalent;
  if a small dep is genuinely missing, port it minimally. Flag anything non-trivial in your report.

**WIRING — add the account-status gate (the judgment is captured here):**
`requireActiveAccount()` (server, from `@/lib/auth/app-access`) resolves the user and redirects
`pending → /access-pending`, `disabled → /access-disabled`, none → `/sign-in`. Pattern (from main):
call it at the top of a SERVER component. Add it to these lab-wire entry surfaces, preserving all
existing logic:
- `src/app/dashboard/page.tsx` — server component (does `await auth()` today); add `requireActiveAccount()`.
- `src/app/profiles/page.tsx` and `src/app/profiles/[id]/page.tsx` — gate at the server page (or add
  `src/app/profiles/[id]/layout.tsx` mirroring main's layout-level gate, whichever matches lab-wire's structure).
- `src/app/research/page.tsx` and `src/app/research/[sessionId]/page.tsx`.
- `src/app/research-v2/page.tsx` and `src/app/research-v3/page.tsx` are **`'use client'`** — they
  CANNOT call the server guard. CREATE new server layouts:
  - `src/app/research-v2/layout.tsx` — `export default async function` that `await requireActiveAccount()` then returns `{children}`.
  - `src/app/research-v3/layout.tsx` — same.
- API defense-in-depth: in `src/app/api/research-v2/orchestrate/route.ts`,
  `src/app/api/research-v2/dispatch/route.ts`, `src/app/api/research-v2/run-lab-section/route.ts` —
  after the existing `auth()`/`userId` check, also reject pending/disabled accounts via
  `requireApiUser()`/`resolveAuthorizedAppUser()` (return `jsonError(..., 403)`). Keep existing `userId` logic.

**ENV:** Port `APP_BOOTSTRAP_INTERNAL_EMAILS` behavior (main commit `c86cb20d`) so listed emails
self-heal to internal/active on first resolve. Add the var to `.env.example` if present and note it.

**VERIFY (must pass before committing P1):**
1. `npx tsc --noEmit` → 0 frontend errors (worker has its own pre-existing errors — out of scope; run frontend tsc only).
2. `npm run test:run` → existing pass count holds (≈1047+), `app-access.test.ts` passes.
3. `npm run build` → exits 0 IF Clerk env is available; if env missing, rely on tsc + tests and say so.
4. In your report, **list every file where you added `requireActiveAccount`/the account-status gate** (for HQ security review).

---

## PHASE 2 — Re-style onboarding wizard to legacy look (styling only)

**GOAL:** Make `src/components/onboarding/onboarding-wizard.tsx` (+ its step files) visually match
`main`'s legacy appearance, keeping ALL V2 data wiring + corpus prefill intact.

**NON-GOALS:** Do NOT change data flow, `OnboardingV2Data` output, corpus prefill, validation, or
step logic. **Styling / className / layout only.** Do NOT touch any other surface.

**REFERENCE (visual target):** `git show main:src/components/onboarding/onboarding-wizard.tsx`. The v3
re-skin landed mostly in commit `9d84ff27` (intermixed with the V2-contract rewrite) plus 6 lines in
`b22332da` (GradientBorder → shadcn Card). Restore the legacy visual treatment (GradientBorder /
legacy card styling, spacing, typography) on top of lab-wire's CURRENT V2 logic. ~150 styling lines expected.

**CONSTRAINTS:** Read `DESIGN.md` first. Preserve V2 wiring exactly. shadcn/Tailwind, `cn()`.

**VERIFY:** `npm run build` (or tsc) + `onboarding-wizard.test.tsx` pass; confirm the wizard still
emits `OnboardingV2Data` (the data/submit path is unchanged). HQ/Claude will screenshot-diff against main.

---

## Report back
For each phase: files changed, the mapRow reconciliation outcome, every gated file (P1), any
import-drift you had to resolve, and the verify command outputs. Then stop — HQ reviews before Phase 3.
