# Handoff: Research V3 — Fold the Live-Run UI Prototype into the Real Reader

Date: 2026-05-29
Worktree (SYSTEM OF RECORD): `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
Branch: `feat/v2-lab-section-wire` · HEAD: `d0c6242d`
⚠️ The main checkout `/Users/ammar/Dev-Projects/AI-GOS` is a STALE branch — do NOT edit there. The bash shell cwd resets to it between calls; always use absolute worktree paths.

---

## What just shipped (don't re-read the diffs — these are the anchors)

- **`c93f2f41`** — locked QA fixes. Onboarding `field.required` contract (Lock 1) + a11y, dup React keys, rerun gating, competitor 4-state ad evidence. +16 tests.
- **`d0c6242d`** — throwaway `/prototype` for the live-run UI: variants A–D, the customer-safe `phase-narration.ts` adapter, the `replay.ts` engine, fixture, and the ground-truth spec + QA handoff docs.

Gates at HEAD (all green, independently re-verified): `npx tsc --noEmit` = 0 · `npm run lint` = 0 errors / 67 pre-existing warnings · `npm run test:run` = **1132 passed / 1 skipped** (the skip is the live-Ollama test).

## Read these first (context lives here, not in this doc)

1. `docs/2026-05-29-research-v3-rebuild-ground-truth-spec.md` — the 7 locked decisions, the verified data shapes (event stream, artifact `data.body.<subSection>`, `data.verification`, competitor `adEvidence`), the **activity→product-phase map**, and the prototype brief. This is the source of truth for the data reality.
2. `docs/qa/2026-05-29-research-v3-live-ux-qa-claude-handoff.md` — the original QA findings + acceptance criteria per priority (P0–P2).

## The next phase (what the user wants to start now)

**Fold the picked "Research Console" (variant C) direction + the proven customer-safe adapter into the REAL `/research-v3` reader, then retire the prototype.**

The prototype proved the *approach*; production wiring is the work. The user picked **variant C**: paginated sections + a **small top-right streaming bar** (not the big left timeline), polished to DESIGN.md (Parallel.ai / Linear north star, dark industrial).

### The three pieces and where they live

| Piece | Prototype (source to port FROM) | Real target (port INTO) |
|---|---|---|
| Customer-safe activity adapter (Lock 3) | `src/app/research-v3/prototype-live/phase-narration.ts` (the FIXED logic) | `src/lib/research-v2/section-activity.ts` → `buildActivityItem` (the EXISTING, LEAKY adapter — this is the literal P0 bug, see below) |
| "Research Console" presentation | `src/app/research-v3/prototype-live/variant-c.tsx` | `src/components/research-v2/audit-reader-shell.tsx` → `LiveActivity` (~L503-561), which renders `buildSectionActivityFeed(...)` |
| Live data feed | `replay.ts` (fixture-driven `AuditStateResponse`) | `src/lib/research-v2/use-audit-state.ts` (polls `/api/research-v2/audit-state`) — **already the same `AuditStateResponse` shape** replay mirrors |

### Wiring decision — RESOLVED (traced 2026-05-29, with evidence)
**The whole route→feed→render chain already exists.** No new wiring, no route change, no client/server debate.

- `src/app/api/research-v2/audit-state/route.ts:230-236` (`buildEventsByZone`) ships the **raw `payload`** in each `SectionEvent` (≤12 per zone). It crosses the wire **by design** — Lock 3's off-by-default "Developer details" drawer reads `event.payload` client-side. It's the user's own run data (same-tenant), so this is acceptable; do NOT rip it out.
- `src/lib/research-v2/section-activity.ts` `buildActivityItem` is the **existing** customer-facing adapter that `LiveActivity` renders — and it **IS the leak**. It surfaces exactly the QA-flagged strings:
  - `tool-finished` → `detail: outputSummary(event)` (raw result JSON) — **L200 / L123-125**
  - `validation-failed` → title `"Validation failed"` + `validationIssueSummary` (raw Zod issues) — **L218-227 / L134-144**
  - `repair-started` → title `"Repairing Artifact"` + raw `reason` — **L228-237 / L233**
  - `structured-output-started` → `"Structuring Artifact"` — **L206-217**

**So the fix = make `section-activity.ts` produce the SAME customer-safe output as `phase-narration.ts`** (the prototype already proved that logic against the full 560-event stream). Concretely, rewrite `buildActivityItem` so:
  - `tool-finished` → clean `metadata.query` chip only; never `outputSummary`.
  - `validation-failed` → `"Checking source support"` (drop the Zod issue detail).
  - `repair-started` → translate `reason`: `grounding N unsupported claim(s)` → `"Strengthening N claims with sources"`; `sources: have X, need >=Y` → `"Gathering more sources (X of Y)"`; raw Zod array → `"Refining section structure"`. Never the raw reason.
  - `structured-output-started` → `"Drafting section"`.
  - dedupe repeated `section-started` / `skill-loaded`.
  - keep `event.payload` flowing untouched to the dev drawer.

This is a much smaller, lower-risk change than originally framed: one module's mapping + a presentation port, no contract/route/engine change. Reconcile/merge `phase-narration.ts` into `section-activity.ts` (don't keep two adapters); update `section-activity.test.ts` to assert no raw JSON/Zod/`outputSummary`/`reason` in any default item detail (the QA acceptance criterion).

### Two refinement notes carried from variant D (apply to whatever ships)
1. It renders **raw** narration → repeated `Preparing context` ×N then a wall of `Searching source evidence`. Use the existing `collapseNarration()` in `phase-narration.ts`.
2. `h-full` height chain wasn't bounded by the page wrapper → the feed grew the page instead of scrolling internally (body = 14.7k px, no scroll). Bound it with `h-screen overflow-hidden` on the wrapper so the feed scrolls internally.

## Remaining QA items NOT yet done (from the QA handoff)
- [ ] **P0 streaming UX in production** — the fold-in above IS this fix (adapter only lives in the prototype today).
- [ ] **P1 onboarding "readiness cockpit" VISUAL redesign** — only the *contract + a11y logic* shipped in `c93f2f41`; the visual demote-the-rail redesign of `onboarding-wizard.tsx` is open.
- [ ] **P1 "first 5 seconds" run receipt** — agent count / active stage / next milestone on submit.
- [ ] **P2 mobile section switcher** in the reader's first viewport.
- [ ] **Browser proof** of the onboarding + competitor fixes against the live app (only jsdom-verified so far) — use `/qa`.
- [ ] ⏸️ **Paid-media plan** — DEFERRED to the very end, per the user. Out of scope until everything else lands.

## Gotchas / environment
- Run gates from the worktree: `cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire && npx tsc --noEmit && npm run lint && npm run test:run`.
- Dev server is already running against the worktree on `:3000` (tmux session `aigos-dev-labwire`, `next dev`). Prototype is at `/research-v3/prototype-live?variant=C` (and `=D`); switcher is `NODE_ENV`-gated.
- Browser QA needs the **authenticated** Chrome (Clerk) — curl gets 404. Chrome DevTools MCP has a 1s transport-timeout quirk (ops succeed server-side anyway) and can only write screenshots within a workspace root (use `/Users/ammar/Dev-Projects/AI-GOS/`, not the worktree).
- **Repo entropy:** the worktree has pre-existing uncommitted files NOT from this work — `package-lock.json` (1-line del), `docs/2026-05-25-*.html`, prior-session `docs/2026-05-27/28-*.md`, `docs/audit/`, `tmp/`. Leave them out of feature commits; stage explicit paths, never `git add -A`.
- Do NOT touch the lab engine / verifier / repair path or paid-media sequencing. Do NOT deploy or push (user gates both).

## Suggested skills for the next session
- `/prototype` exploration is **done** — don't redo it; the answer (variant C) is captured above and in the commits.
- Implementation: **frontend** specialist for the reader shell port; **design-consultation** / **design-review** to keep the Research Console inside DESIGN.md before/after the build.
- `/qa` for the live authenticated browser proof.
- Per repo routing (CLAUDE.md §6), hand the bulk mechanical port to **Codex** once the wiring decision + a thin spec are set; keep Claude on the wiring judgment + review.
