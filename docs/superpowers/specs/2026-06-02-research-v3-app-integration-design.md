# Research-v3 App Integration — Design Spec

**Date:** 2026-06-02
**Branch / worktree:** `feat/v2-lab-section-wire` @ `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` (system of record; live dev server runs here)
**Status:** APPROVED — executing phase-by-phase via dynamic workflows.

## Goal (one sentence)
Stop `/research-v3` from being a chromeless full-screen takeover: fold it inside the existing `AppSidebar` shell, move in-run progress from the left `SectionRail` to a compact Codex-style status card docked top-right, polish both light + dark, and sweep the bloat — without touching backend/runtime.

## Reframe (load-bearing facts from recon)
- `/research-v3` is **already** the canonical live surface (sidebar Compass, every CTA, post-login + onboarding redirects all point here). The "disconnected" feeling = it renders with **no `AppSidebar`**, as a full-viewport takeover.
- The in-research left sidebar to remove = **`SectionRail`** (`audit-reader-shell.tsx` ~623-675, `w-[208px] border-r`). It is BOTH status display AND the section navigator.
- A compact top-right run widget already exists in skeleton: **`RunStatusBar`** (~691-749). All run telemetry derives from ONE poll hook: `useAuditState(runId)` → `/api/research-v2/audit-state`. The redesign reuses this data verbatim.
- `AuditReaderShell` + `WelcomeForm` + `CorpusStream` + `OnboardingWizard` + `lib/research-v2/*` are **shared** and live under the `research-v2` namespace; `/research-v3` reuses them. Inverted import: `components/research-v2/audit-reader-shell.tsx` imports `components/research-v3/reader-sections.ts`. KEEP these — only the `/app/research-v2` ROUTE is dead.
- Shell collapse plumbing exists: `ShellProvider` exposes `setSidebarCollapsed/toggleSidebar/sidebarCollapsed` + `defaultSidebarCollapsed`; `AppSidebar` reads `useOptionalShell()` (falls back to local state).
- Theme: `defaultTheme="dark"`, `enableSystem=false`, next-themes persists per-user. User is on light (toggled). `:root`=light, `.dark`=dark; both define the legacy `--text-*/--bg-*` tokens the shell uses AND the shadcn semantic tokens the reader uses. Both adapt today.

## Locked decisions
1. **Right box** = compact status card, top-right. Merges `SectionRail` + `RunStatusBar`. Live `ActivityRail` chain-of-thought **stays in the center** reading column.
2. **App shell** = research renders inside `AppSidebar`; left nav **collapses to icons on run start**, restores on exit.
3. **Theme** = polish BOTH light + dark for the new components; keep the toggle; no forced theme; no seam.
4. **Cleanup** = delete dead `/research-v2` route; sweep safe bloat; fix duplicate "Research" nav labels; **`/research` retire DOWNSCOPED → de-list only** (see correction).

### Correction: "retire /research V1" is NOT a clean delete
The old `research_results` → `card-renderer`/`research-document` path is load-bearing for the **public share feature** (`/api/share` + `/shared/[token]` render old sessions through the same components) and is deep-linked from dashboard history, `profiles/[id]:406`, and `workspace/artifact-footer.tsx:61`. Full deletion would strand old reports + break share links. → **De-list only:** remove the duplicate FileText "Research"→`/research` sidebar item and demote the dashboard "View Research" CTA, but keep `/research/[id]` reachable. Do NOT delete `components/research/*`, `/app/research`, `/api/share`, or `/shared/[token]`.

## Target layout
```
┌─────┬──────────────────────────────┬──────────────┐
│ app │   centered reading column    │  RunStatusCard│
│ nav │   (article, max-w-760)       │  (top-right)  │
│left │                              │  rollup +     │
│↓icon│                              │  8 sections   │
│ on  │   live ActivityRail stays    │  (clickable)  │
│ run │   inside running section     │  + verify     │
└─────┴──────────────────────────────┴──────────────┘
```

## Phases (gated; commit per phase; push held for user)

### Phase 0 — Bugs (isolated warm-up)
- **Competitor table overlap** (`ui-kit/data-table.tsx` + `section-renderers/competitor-landscape.tsx`): root cause = `table-fixed` + frozen `<colgroup>` widths + `wrap:'nowrap'`, with `<th>`/`<td>` having no horizontal padding and no overflow clip → long values ("Contact sales", "not disclosed", long Gates text) overflow onto the next column. Fix: add horizontal cell padding (`px-3`) to `th`/`td`; make `nowrap` columns clip (`truncate`/`overflow-hidden`) or wrap; loosen the over-tight fixed widths in `pricingColumns` (615-638). Keep DESIGN.md table idiom (mono 11px uppercase headers, hairline rows).
- **Paid-media `{}` error** (`lib/research-v2/use-audit-state.ts` ~65-80, 132-201): root cause = `dispatchPaidMediaPlan`/`dispatchPositioningSynthesis` fetch has no abort guard; on unmount/runId-change/StrictMode the fetch aborts → Error with empty `.message` → logged as `{runId, message:""}` ≈ `{}`. Fix: pass/respect `cancelled.current` (or AbortController); on `AbortError`/empty-message do NOT `console.error` (expected unmount); log 409 (transient race) at `console.debug`, keep 5xx as real `console.error`. Preserve self-healing retry (rollback of `dispatchedMediaPlanRunIds` + 2.5s reschedule).

### Phase 1 — Cleanup / bloat + nav
- Delete `/app/research-v2/` (page.tsx, layout.tsx, `__tests__/`, `proto-reader/`). Grep-verify no external import of `@/app/research-v2`; sweep orphan tests. KEEP `lib/research-v2/*` + `components/research-v2/*`.
- `middleware.ts`: remove matchers `/research-v2/proto-reader(.*)`, `/test/(.*)`, `/journey`, `/blueprint-preview(.*)` (confirmed stale — no backing pages). KEEP `/api/journey/(.*)`.
- Delete empty `/app/test/` dir.
- Delete dead `components/research-v3/citation-list.tsx` + `components/research-v3/types.ts` (grep-verify orphan first).
- `components/shell/app-sidebar.tsx`: remove the FileText "Research"→`/research` NAV_ITEMS entry (resolves double-label). Nav becomes Home / Research(Compass→/research-v3) / Profiles.
- `dashboard/page.tsx`: demote the prominent "View Research"→`/research` quick-action (keep recent-session deep links to `/research/[id]` working).

### Phase 2 — Shell fold-in + collapse-on-run
- New client wrapper `components/shell/research-app-shell.tsx` (or inline in layout): `<ShellProvider><div className="flex h-screen ..."><AppSidebar/><main className="flex-1 min-w-0 overflow-hidden">{children}</main></div></ShellProvider>`.
- `research-v3/layout.tsx`: render that wrapper around children (after `requireActiveAccount()`).
- `research-v3/page.tsx`: call `useShell().setSidebarCollapsed(true)` when phase → `sections` (run dispatched); restore prior state on unmount/return to welcome. Adjust welcome/corpus/onboarding views to center within `<main>` (`h-full`, not `min-h-svh`).
- `audit-reader-shell.tsx`: change outer `h-[calc(100vh-64px)]` → `h-full` (no 64px chrome; app nav is a left rail). Ensure it fills `<main>`.
- Guard: only `/research-v3` gets the shell. `/research-v2` route is being deleted in P1, so `AuditReaderShell`'s only consumer becomes v3 — safe to restructure its height.

### Phase 3 — RunStatusCard + remove left rail
- New `components/research-v2/run-status-card.tsx` (compact card): props from existing derived state (statusOf, completedCount/positioningCompletedCount, activePhaseLabel, verificationRollup, elapsedMs, sections list, activeSectionId, onSectionChange). Contents: header (company · N/6 · m:ss · spinner; "Done · 6/6" terminal), shimmer active-phase line, 8 clickable section rows (StatusIcon + short label + subline, active highlighted → onSectionChange), verified/flagged foot.
- `audit-reader-shell.tsx`: remove `SectionRail` (left) and the header `RunStatusBar`; shrink header to title only. Restructure body row to: `<main>` center reading column (flex-1) + right column (`w-[260px] shrink-0`, `hidden lg:flex`) holding `<RunStatusCard>`. Keep `MobileSectionSwitcher` for mobile (card desktop-only). Preserve `?section=` URL nav + arrow-key nav.

### Phase 4 — Theme polish (both modes) + visual QA
- Cohesion pass on the new card + folded shell seam + reading column in BOTH light and dark, using design skills (ui-ux-pro-max / impeccable / design-review) + DESIGN.md. Reconcile any legacy-token vs shadcn-token visual mismatch at the shell↔reader boundary. Before/after screenshots via chrome-devtools/browse.

### Phase 5 — Verification gate
- `npm run build` (exit 0), `npm run lint`, `npm run test:run` — all green (respect known pre-existing baseline: openrouter/chat-blueprint TS errors ignored). Live browser walkthrough of welcome → run → reading on `/research-v3` in both themes. Screenshot evidence.

## Non-goals
- No backend/runtime/worker changes.
- No rename of the `research-v2` lib/component namespace (churn — deferred).
- No token-streaming rewrite.
- No migration of old `/research` sessions into the v3 reader; `/research` + share stay functional.

## Verification per phase
Each phase ends with build/lint/test green on the worktree + (for layout phases) a live browser check, then an atomic commit (`Co-Authored-By` trailer), push held for user.
