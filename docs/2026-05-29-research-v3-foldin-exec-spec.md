# Exec Spec — Research V3 Live-Run Fold-In (P0 streaming leak + Research Console restyle)

Date: 2026-05-29 · Worktree (SYSTEM OF RECORD): `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` · Branch `feat/v2-lab-section-wire`

> Every agent: `cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` at the start of EVERY bash call (cwd resets to the stale main checkout between calls). Use absolute worktree paths for Read/Edit/Write. NEVER edit `/Users/ammar/Dev-Projects/AI-GOS`.

## Wiring decision (locked — read before touching anything)
- The production reader (`src/components/research-v2/audit-reader-shell.tsx`) is **paginated**: one section at a time, left `SectionProgressStrip` rail, single reading column. `LiveActivity` renders only for the **active running section**, fed `live.eventsByZone[active]` (≤12 events, snake_case `SectionEvent`).
- The prototype `variant-c.tsx` is a **whole-run single-scroll thread** — a different IA. We do **NOT** wholesale-replace the shell with it. We port its **visual language** (phase narration rows + search chips + verification-aware tone) into the per-section feed, and add a **compact top-right run bar**. Pagination stays.
- The prototype `phase-narration.ts` is the **proven customer-safe logic**. Its translation rules move into the production lib (`section-activity.ts`). The prototype is retired afterward (clean delete — nothing outside `prototype-live/` imports it).
- Production uses **semantic shadcn tokens** (theme-aware: `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`, `bg-muted`, `bg-card`, `text-destructive`). Variant C's hardcoded hex (`#365eff`, `#e2e4ea`, …) must be **translated to tokens**, never copied. Token map: `accent→primary`, `text1→foreground`, `text2→muted-foreground`, `text3→muted-foreground/70`, `border→border`, `green→primary` (project treats success as primary), `amber→` keep a restrained warning (e.g. `text-amber-500 dark:text-amber-400` only where a warning tone is needed), `red→destructive`.

## The leak (P0) — exact sites in `src/lib/research-v2/section-activity.ts`
`buildActivityItem` surfaces raw `payload.metadata` into customer-facing `title`/`detail`:
- `tool-finished` → `detail: outputSummary(event)` (raw result JSON) — **L193-204**
- `validation-failed` → title `"Validation failed"` + `validationIssueSummary` (raw Zod issue array) — **L218-227**
- `repair-started` → title `"Repairing Artifact"` + raw `reason` — **L228-237**
- `structured-output-started` → title `"Structuring Artifact"` + `schemaName` (internal jargon) — **L206-217**

---

## W1 — Customer-safe adapter (file: `src/lib/research-v2/section-activity.ts` + `__tests__/section-activity.test.ts`)
Independent file. Rewrite the adapter so NO raw payload reaches `title`/`detail`/`chip`. Allowlist-based (drop unknown events).

### New exported contract (pin exactly — W2 builds against this)
```ts
export type ProductPhase =
  | 'preparing' | 'searching' | 'drafting' | 'checking' | 'refining' | 'committing' | 'done';

export interface SectionActivityItem {
  id: string;
  eventType: string;
  phase: ProductPhase;        // NEW — drives the render icon + grouping
  title: string;              // customer-safe phase label
  detail: string | null;     // customer-safe ONLY (translated reason / calm line). NEVER raw payload.
  chip: string | null;       // NEW — clean web_search query (tool-finished only), else null
  createdAt: string;
  kind: SectionActivityKind;  // keep existing union
  tone: SectionActivityTone;  // keep existing union
}

export interface CollapsedSectionActivityItem extends SectionActivityItem {
  count: number;              // consecutive same-phase events merged
  chips: string[];            // accumulated clean query chips
}

export interface SectionActivityFeed {
  currentLabel: string;
  items: CollapsedSectionActivityItem[];   // collapsed + customer-safe; this is what the shell renders
  counts: SectionActivityCounts;           // keep existing shape
}
```

### event_type → phase / title / tone / detail / chip  (snake_case input)
| event_type | phase | title | tone | detail | chip |
|---|---|---|---|---|---|
| section-started | preparing | Preparing context | neutral | null | null |
| skill-loaded | preparing | Preparing context | neutral | null | null |
| tool-started | searching | Searching source evidence | active | null | null |
| tool-finished | searching | Searching source evidence | active | null | **clean `metadata.query`** (≤96 chars, no `[{}]`/`"code"`/`body.`); never `outputSummary` |
| structured-output-started | drafting | Drafting section | active | null | null |
| validation-failed | checking | Checking source support | active | "Verifying claims against sources" | null |
| repair-started | refining | Refining unsupported claims | warning | `translateReason(metadata.reason)` | null |
| sub-section-committed | committing | Sub-section ready | success | clean `message` (e.g. "ICP existence check committed") ?? humanized `subSectionKey` | null |
| artifact-saved | committing | Section verified & committed | success | null | null |
| section-completed | done | Section verified & committed | success | optional duration ("1m 7s") | null |
| section-failed | done | Section needs review | error | "This section needs another pass" (NEVER raw error) | null |
| (any other) | — | — | — | DROP from feed (return null, filter out) | — |

### `translateReason(reason: unknown): string | undefined` (port from phase-narration.ts exactly)
- `/grounding (\d+) unsupported claim/i` → `Strengthening N claim(s) with sources`
- `/sources:\s*have (\d+),\s*need >?=?\s*(\d+)/i` → `Gathering more sources (X of Y)`
- else if `reason` is a string ≤72 chars AND no JSON hint (`/[{}\[\]]|"code"|body\./`) → return it verbatim
- else → `Refining section structure`

### Other rules
- `searchChip`: read `metadata.query`; string, trimmed, ≤96 chars, no JSON hint; else null.
- Collapse consecutive same-`phase` items (within the single-section feed) into one `CollapsedSectionActivityItem` with `count` + accumulated `chips` (port `collapseNarration`). The feed's `items` are the collapsed list, capped by `maxItems` (default 8) on the **collapsed** list (slice last N).
- `counts` unchanged (toolsStarted/Finished, subSectionsCommitted, validationFailures, repairsStarted) — still feeds the count pills.
- `currentLabel` = `latestActivity ?? last collapsed item.title ?? phaseLabel`.
- Confirm `buildSectionActivityFeed` has NO consumers besides the shell + this test (grep). If others exist, reconcile.

### Test rewrite (`__tests__/section-activity.test.ts`)
The existing test asserts the LEAKY output — rewrite it. New assertions MUST include:
- A run with `tool-finished` carrying `outputSummary: '<raw json>'` and `query: 'b2b saas pricing'` → item.detail is null, item.chip/chips contains `'b2b saas pricing'`, and NO item.detail/title contains the outputSummary string.
- `validation-failed` with raw `issues: [...]` → title `'Checking source support'`, detail `'Verifying claims against sources'`, and the raw issue strings appear NOWHERE.
- `repair-started` with `reason: 'grounding 3 unsupported claim(s)'` → detail `'Strengthening 3 claims with sources'`; with `reason: 'sources: have 4, need >=5'` → `'Gathering more sources (4 of 5)'`; with a raw Zod-ish `reason: '[{"code":"invalid_type"}]'` → detail `'Refining section structure'` (raw NEVER shown).
- `structured-output-started` → title `'Drafting section'` (no schemaName).
- phase mapping + collapse (consecutive tool events merge with count>1 and chips array) correct.
- A general guard: for every item, assert `JSON.stringify(item)` does NOT contain `outputSummary`, `"code"`, `issues`, or `body.` raw markers.

---

## Track B — Shell restyle (file: `src/components/research-v2/audit-reader-shell.tsx`). ONE agent (all three; same file).
Depends on the W1 contract above (build against it; tsc gate catches drift). Use **semantic tokens only**. Keep complete/queued/error/paid-media render paths working. Surgical edits — don't rewrite the file.

### W2 — Restyle the per-section running feed (`LiveActivity` + `ActivityFeedItem`)
- Render the collapsed customer-safe `items`. Each row: a **phase icon** + title + `×count` (when >1) + optional `detail` + **search-query chips**.
- Phase→lucide icon: preparing→`CircleDot`, searching→`Search`, drafting→`FileText`, checking→`ShieldCheck`, refining→`Sparkles`, committing→`CheckCircle2`, done→`CheckCircle2`.
- tone→token: active/success→`text-primary`; neutral→`text-muted-foreground`; warning→`text-amber-500 dark:text-amber-400`; error→`text-destructive`. Rail dot keeps the existing `ACTIVITY_TONE_CLASS` idiom (extend for the icon treatment).
- Chips: small rounded `bg-muted border-border text-muted-foreground` pills with a `Search` glyph, truncate ≤260px, cap 8 + "+N".
- Keep the skeleton + count pills + the spinner `currentLabel` header.
- Bounded height (variant-D note): the feed must scroll **internally**, not grow the page. The reading `<main>` already has `overflow-y-auto`; add `max-h-[…]`/`overflow-y-auto` to the feed list so a long run doesn't push the page. Verify body doesn't exceed viewport.
- Respect `prefers-reduced-motion` for any pulse/animation.

### W3 — Compact top-right run bar + first-5s receipt (shell `<header>`)
- In the top bar (currently "Positioning Audit / {company}" left, Copy/Rerun right), add a **compact run-status cluster** shown while the run is non-terminal (`!allSectionsTerminal`): `{completedCount}/6 sections` · current active phase label · `{verified}✓ {flagged}⚑` rollup · elapsed (mono, DESIGN label style: 11px mono uppercase 0.06em). Keep it SMALL — this is the "small top-right streaming bar," not a dashboard.
- Verified/flagged rollup = sum of `verification.verifiedCount`/`unsupportedCount` across complete sections (use `typedByZone`/`activeTyped.verification`; reuse existing confidence/verification reads).
- **First-5s receipt:** the instant the run is dispatched (parent exists, workers queued/running, nothing complete yet), the bar must already show "6 sections · researching live sources" (or equivalent) so the first seconds aren't empty. No empty/blank initial state.
- Elapsed: derive from the earliest available `runtimeTimings.sectionStartedAt` across workers, else a client timer from first-running-observed. Keep it robust; if no reliable start, omit the clock rather than show a wrong one.

### W4 — Mobile section switcher (P2)
- The left `SectionProgressStrip` is desktop-oriented. On small screens add a horizontal section switcher (pill/tab row, DESIGN.md section-tab idiom) at the top of the reading column so users can switch sections without the narrow rail. Desktop unchanged (`sm:hidden` for the mobile switcher; keep the rail `hidden sm:block` or current behavior on ≥sm). Verify at 390px width.

### Track B may extract small components
`section-activity-feed.tsx` and/or `run-status-bar.tsx` under `src/components/research-v2/` (named exports, kebab-case) IF it keeps the shell readable. Prefer in-place edits when the diff stays small.

---

## Hard constraints (all agents)
- Worktree absolute paths; `cd` worktree in every bash call.
- Do NOT touch: lab engine / verifier / repair path, `audit-state/route.ts` (payload stays — it's same-tenant; we just stop rendering raw fields; no dev-drawer build in scope), paid-media sequencing, AI SDK provider config.
- Semantic tokens only in UI; no hardcoded hex.
- Stage explicit paths only; NEVER `git add -A`; do NOT commit, push, or deploy (HQ handles commits; user gates push/deploy).
- The repo worktree has pre-existing entropy (untracked docs, `tmp/`, `package-lock.json`) — leave it alone.

## Verify (gates run from the worktree)
`cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire && npx tsc --noEmit && npm run lint && npm run test:run`
Baseline before this work: tsc=0 errors, lint=0 errors/67 warnings, tests=1132 passed/1 skipped. Do not regress.

## Out of scope this pass (defer — do NOT start)
- P1 onboarding "Brief Review cockpit" VISUAL redesign (contract+a11y already shipped; this is a separate focused pass).
- Paid-media plan (user-deferred to the very end).
- Dev-details drawer (optional/future).
- Prototype retirement + live authenticated browser proof — HQ does these after the workflow verifies.
