# Codex Handoff — Task 5: Live phase honesty (kill the "Reading sources" lie)

> **Executor:** Codex (`-c model_reasoning_effort=xhigh -s workspace-write`). Edit files only — do NOT run git. Claude gates + commits.
> **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` · branch `feat/v2-lab-section-wire`.
> **Grounded in:** assessment Dimension B (technical-wow). The single highest "watch it think" win with no new streaming infra.

## PROBLEM (verified)
During a 2-9 min section run the UI phase indicator is frozen at **"Reading sources"** the entire time. `buildLabSectionTelemetry` (`src/lib/research-v2/supabase-run-store.ts:54-65`) is type-locked to `'Reading sources' | 'Committed' | 'Needs review'` and is only ever written as `'Reading sources'` (running), `'Committed'` (done), `'Needs review'` (failed). Meanwhile:
- The **read model already defines a rich 8-value enum** `AuditSectionPhase` (`src/app/api/research-v2/audit-state/route.ts:29-37`): `Queued | Compiling context | Reading sources | Drafting | Validating | Draft ready | Committed | Needs review`.
- The **activity-event stream already persists granular events** (`src/lib/lab-engine/events/activity-event.ts`): `section-started`, `skill-loaded`, `tool-started`, `tool-finished`, `structured-output-started`, `validation-failed`, `repair-started`, `sub-section-committed`, `artifact-saved`, `section-completed`, `section-failed`.

So the live phase is fully derivable from data we already store. The fix is read-time derivation — no write-path/runtime changes, no streaming infra.

## GOAL
In the audit-state read model, compute each section's `phase`/`phaseLabel` from its **latest activity event** (+ status), so the UI shows real transitions (Compiling context → Reading sources → Drafting → Validating → Draft ready → Committed) as the section progresses across the 2.5s poll. Pure, deterministic, unit-tested.

## STEPS
1. **New pure helper** `src/app/api/research-v2/derive-section-phase.ts` (or colocated in a `lib/` next to the route — match where the route's helpers live): `deriveSectionPhase({ status, latestEventType }): AuditSectionPhase`. Mapping:
   | status / latest event | phase |
   |---|---|
   | status `queued`, or no events | `Queued` |
   | `section-started`, `skill-loaded` | `Compiling context` |
   | `tool-started`, `tool-finished` | `Reading sources` |
   | `structured-output-started` | `Drafting` |
   | `validation-failed`, `repair-started` | `Validating` |
   | `artifact-saved` | `Draft ready` |
   | `sub-section-committed`, `section-completed`, status `complete` | `Committed` |
   | `section-failed`, status `error`/needs-review | `Needs review` |
   Terminal status wins over event (a `complete` section is `Committed` even if its last event was a tool call).
2. **Wire it into `audit-state/route.ts`**: when assembling each `workerStates[]` entry, set `phase` + `phaseLabel` from `deriveSectionPhase(...)` using the section's already-fetched events (use the most recent `SectionEvent`). If events aren't currently fetched per-section in the assembly, fetch/most-recent them (the route already models `SectionEvent[]`). Keep `phaseStartedAt` = timestamp of the event that set the current phase when available.
3. **Tests** `__tests__/derive-section-phase.test.ts`: each mapping row + the terminal-status-wins rule + the no-events→Queued case.
4. Do NOT change the write side (`buildLabSectionTelemetry`) or runtime (`run-section.ts`); leave its stored `telemetry.phase` as-is (the read model now overrides for display). Do NOT touch wave/totalWaves here (separate cleanup).

## CONSTRAINTS
- Read-time only; no runtime/DB write changes; no new events emitted.
- `tsc --noEmit` 0, `lint` 0, `test:run` green (incl. existing audit-reader-shell tests — keep them passing; update them only if they assert the old frozen phase).
- Surgical; match existing route style. Do NOT run git.

## VERIFY (Claude re-runs)
```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
npx tsc --noEmit && npm run lint
npm run test:run -- src/app/api/research-v2
npm run test:run            # full green
```
## DONE WHEN
A running section reports a phase that advances with its events (not a constant "Reading sources"); helper unit-tested; gates green.
