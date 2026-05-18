# Research V2 Smooth Flow Handoff

## Goal Launcher

```text
/goal Execute Research V2 Smooth Flow from /Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-16-research-v2-smooth-flow.md.

Treat that handoff as the source of truth. Complete phases in order, obey all hard rules, run every verification gate, update docs where required, and return the final implementation report requested in the handoff. The goal is complete only when all listed completion criteria pass or an explicit blocker is reported with evidence.
```

## Execution Contract

### Objective

Make the proven `/research-v2` backend flow feel smooth in the product by fixing the corpus-to-GTM-Brief UI transition and softening successful draft artifact labels.

Current proven backend state:

- URL input can produce a real live first-draft audit end to end.
- Corpus, onboarding prefill, six-section orchestration, revisioned draft artifacts, reader rendering, sources, gaps, and Deepen buttons work.
- The remaining blockers before calling the flow smooth are UI state invalidation and reader label semantics.

### Source Of Truth Hierarchy

Use this order when docs, old handoffs, code, and assumptions disagree:

1. This handoff.
2. `/Users/ammar/Dev-Projects/AI-GOS/AGENTS.md`.
3. The current user-provided plan: P0 transition fix, P1 reader polish.
4. `/Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-16-fast-drafts-runtime-evals.md`.
5. `/Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-15-fast-drafts-deep-enrichment.md`.
6. `/Users/ammar/Dev-Projects/AI-GOS/docs/research-v2-e2e-brutal-findings-2026-05-15.md`.
7. Current code and tests in the checkout.

Do not follow older Journey docs when they conflict with `/research-v2`, the GTM Brief Review, the worker `/orchestrate` path, or normalized artifact tables.

### Cwd And Branch

- Cwd: `/Users/ammar/Dev-Projects/AI-GOS`.
- Branch at handoff time: inspect with `git status --short --branch`.
- Dirty worktree expected. Do not revert or modify unrelated files.

### Completion Definition

This goal is complete when:

- `/research-v2` leaves `Researching company...` and lands on `GTM Brief Review` as soon as `journey_sessions.research_results.deepResearchProgram.status === "complete"` is visible for the active run.
- The transition does not depend only on `journey_sessions.job_status` activity rows.
- Duplicate completion signals are idempotent and cannot cause double dispatch, empty-review fallback, or state regression.
- Successful draft section chips and section pills show `Draft ready`.
- `Needs review` is reserved for failed, aborted, timed-out, or manual-attention section states, not normal committed drafts.
- Onboarding field state labels remain unchanged; `Needs review` inside GTM Brief Review still means a low-confidence field needs human review.
- Targeted tests, lint, build, and live browser acceptance pass, or a blocker is reported with evidence.

## Scope

### In Scope

- Parent `/research-v2` state invalidation and polling.
- `CorpusStream` completion callback wiring only where needed.
- Session-state inference used by resume and corpus completion.
- Audit-state phase labels and UI display labels for worker chips and section pills.
- Focused tests for transition behavior, audit-state labels, and reader label rendering.

### Out Of Scope

- Worker orchestration changes.
- New database schema or migrations.
- Changing draft/deep runtime behavior.
- Rewriting onboarding fields or review scoring.
- Changing Deepen behavior.
- Redesigning the reader layout.
- Replacing Vercel AI SDK, Clerk, Supabase, or the current worker architecture.

### Assumptions To Verify Before Editing

- `src/app/research-v2/page.tsx` owns the state machine render and currently infers resume state from `researchResults`, `onboardingData`, and `jobStatus`.
- `src/components/research-v2/corpus-stream.tsx` currently calls `onComplete` only when collapsed job activity finds `runDeepResearchProgram` with `status === "complete"`.
- `/api/journey/session?runId=...` returns `researchResults`, `jobStatus`, `onboardingData`, and `runId` for the authenticated user.
- `src/app/api/research-v2/audit-state/route.ts` currently defaults `complete` worker status to `Committed` and failed terminal statuses to `Needs review`.
- `src/components/research-v2/agent-artifact-surface.tsx` displays `state.phaseLabel ?? state.phase ?? state.status` for chips and pills.

If any assumption is false in the current checkout, preserve the objective and adapt the smallest implementation path.

## Architecture References

### Read First

- `AGENTS.md`.
- `src/app/research-v2/page.tsx`.
- `src/lib/research-v2/state-machine.ts`.
- `src/components/research-v2/corpus-stream.tsx`.
- `src/app/api/journey/session/route.ts`.
- `src/app/api/research-v2/audit-state/route.ts`.
- `src/lib/research-v2/use-audit-state.ts`.
- `src/components/research-v2/agent-artifact-surface.tsx`.

### Existing Tests To Extend

- `src/lib/research-v2/__tests__/resume-and-partial.test.ts`.
- `src/app/api/research-v2/audit-state/__tests__/route.test.ts`.
- `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx`.
- Add a focused component or hook test only if the state transition cannot be covered cleanly through an extracted pure helper.

### Useful Current Code Anchors

- Resume inference currently lives inside `src/app/research-v2/page.tsx`.
- Activity-only completion trigger currently lives in `src/components/research-v2/corpus-stream.tsx`.
- Worker chip phase union currently lives in `src/app/api/research-v2/audit-state/route.ts`.
- Reader aggregate status label currently lives in `getAuditStatusLabel` inside `src/components/research-v2/agent-artifact-surface.tsx`.

## Hard Rules

- Do not change worker dispatch, `/orchestrate`, runner code, or artifact commit semantics for this goal.
- Do not make `job_status` the canonical completion signal for the P0 transition.
- Do not silently advance to an empty GTM Brief when the session fetch fails or the persisted corpus is not complete.
- Do not swallow fetch, route, or parse errors without useful context.
- Do not remove the existing resume behavior.
- Do not change onboarding field labels or scoring; GTM Brief field-level `Needs review` remains valid.
- Do not use broad UI polish as a substitute for the transition fix.
- Do not introduce `any`, default exports, implicit return types, or unrelated refactors.
- Do not revert unrelated dirty files.

## Execution Order

1. Preflight and test target confirmation.
2. Extract or centralize persisted session-to-state inference.
3. Implement authoritative corpus completion polling in the page.
4. Update draft-ready section labels.
5. Run automated verification.
6. Run live browser acceptance against the real local flow.

## Per-Phase Checklist

### Phase 1: Preflight

Deliverables:

- Confirm branch and dirty state.
- Confirm current transition and label codepaths.
- Confirm which tests will be edited before implementation.

Commands:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git status --short --branch
rg -n "inferResumeState|handleCorpusComplete|Researching company|runDeepResearchProgram|AuditSectionPhase|Committed|Needs review|Audit ready|phaseLabel" src/app/research-v2 src/components/research-v2 src/app/api/research-v2 src/lib/research-v2
```

Pass condition:

- The executor can name the exact current completion trigger, the persisted session endpoint, and the display-label owners before editing.

### Phase 2: Persisted Session State Inference

Deliverables:

- Move or mirror `inferResumeState` into a testable module under `src/lib/research-v2/`.
- Keep the return states equivalent to current page behavior:
  - positioning result or job exists -> `sections`
  - onboarding data exists -> `sections`
  - corpus complete -> `onboarding` with prefill metadata
  - corpus missing or incomplete -> `corpus`
- Replace the duplicated resume reducer parity helper in tests with the exported helper where practical.

Expected file targets:

- `src/lib/research-v2/session-state.ts` or an equivalent focused module.
- `src/app/research-v2/page.tsx`.
- `src/lib/research-v2/__tests__/resume-and-partial.test.ts`.

Test requirements:

- Persisted complete corpus with `onboardingFields` returns `onboarding`.
- Persisted complete corpus with no `onboardingFields` returns `onboarding` with empty prefill data and metadata.
- Missing or running corpus returns `corpus`.
- Existing positioning work returns `sections`.

Pass condition:

- State inference is covered by pure tests and page code uses the same helper for resume and completion polling.

### Phase 3: P0 Corpus-To-GTM-Brief Transition

Deliverables:

- Add page-level polling while `state.kind === "corpus"` that fetches `/api/journey/session?runId=<runId>` with `cache: "no-store"` and `credentials: "same-origin"`.
- Treat `researchResults.deepResearchProgram.status === "complete"` as the authoritative corpus-complete signal.
- When the helper infers `onboarding`, dispatch a state transition to onboarding using persisted prefill data.
- Keep `CorpusStream` as the activity log and allow its `onComplete` callback to call the same idempotent transition path.
- Add an idempotency guard keyed by run id so duplicate signals do not double-dispatch.
- On fetch failure, keep the user in corpus/finalizing state and retry. Do not advance with fake empty review data unless the persisted complete corpus genuinely has no onboarding fields.

Expected file targets:

- `src/app/research-v2/page.tsx`.
- Optional focused helper in `src/lib/research-v2/session-state.ts`.

Test requirements:

- A complete corpus in `researchResults` advances to onboarding even when `jobStatus` is missing or stale.
- Duplicate completion signals for the same run are no-ops after the first successful transition.
- A failed session fetch does not dispatch `CORPUS_COMPLETE` with empty prefill.

Pass condition:

- The page no longer depends only on `CorpusStream` job activity to leave `Researching company...`.

### Phase 4: P1 Draft-Ready Reader Labels

Deliverables:

- Add `Draft ready` to the audit-state display phase union.
- Successful draft sections should expose `phaseLabel: "Draft ready"` when `status === "complete"` and `executionMode === "draft"`, even if raw telemetry says `Committed`.
- Completed deep or unknown execution-mode sections may keep `Committed`.
- Failed or aborted sections must continue to expose `Needs review`.
- Reader chips and section pills should display `Draft ready` for successful draft sections.
- Aggregate parent status should remain `Audit ready` at 6/6 complete and `Needs review` only when blocked sections exist.

Expected file targets:

- `src/app/api/research-v2/audit-state/route.ts`.
- `src/app/api/research-v2/audit-state/__tests__/route.test.ts`.
- `src/components/research-v2/agent-artifact-surface.tsx`.
- `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx`.

Test requirements:

- Audit-state route returns `Draft ready` for a complete draft worker state.
- Audit-state route returns `Committed` for complete deep or unknown execution mode.
- Audit-state route returns `Needs review` for `error` and `aborted`.
- AgentArtifactSurface renders `Draft ready` in worker chips and section pills for committed draft artifacts.
- Onboarding wizard tests still expect field-level `Needs review` where applicable.

Pass condition:

- Normal draft completion reads as ready, not harsh failure/manual-attention copy.

### Phase 5: Automated Verification

Run these from `/Users/ammar/Dev-Projects/AI-GOS`:

```bash
npm run test:run -- src/lib/research-v2/__tests__/resume-and-partial.test.ts src/app/api/research-v2/audit-state/__tests__/route.test.ts src/components/research-v2/__tests__/agent-artifact-surface.test.tsx src/components/research-v2/__tests__/onboarding-wizard-v2.test.tsx
npm run test:run
npm run lint
npm run build
```

Pass condition:

- All commands pass.
- If a full-suite failure is unrelated to touched files, capture the exact failing test and evidence, then still report it as a blocker or residual risk.

### Phase 6: Live Browser Acceptance

Preconditions:

- Worker running on `:3001`.
- Next dev server running on `:3000` or the port selected by Next.
- Authenticated browser session available for `/research-v2`.

Acceptance steps:

1. Open `/research-v2`.
2. Start a fresh run with a real URL.
3. Watch the corpus phase until the worker writes `deepResearchProgram.status === "complete"`.
4. Confirm the browser advances from `Researching company...` to `GTM Brief Review` within one poll interval after persisted corpus completion.
5. Complete the GTM Brief Review and launch the six-section draft.
6. Confirm successful draft chips and section pills show `Draft ready`.
7. Confirm the parent still shows `Audit ready` at 6/6 complete.
8. Confirm Deepen buttons remain visible on draft sections.

Pass condition:

- The observed UI matches the acceptance steps without reload.
- If browser automation is blocked by auth, CDP, or environment keys, report the blocker with screenshots/logs or exact command output. Do not claim live acceptance passed.

## Verification Matrix

| Gate | Cwd | Command or Check | Expected Pass Condition | On Failure |
| --- | --- | --- | --- | --- |
| Preflight | `/Users/ammar/Dev-Projects/AI-GOS` | `git status --short --branch` | Dirty state understood; unrelated files preserved | Stop before edits if target files have conflicting user edits |
| Codepath search | `/Users/ammar/Dev-Projects/AI-GOS` | `rg -n "inferResumeState|handleCorpusComplete|Researching company|AuditSectionPhase|Draft ready|Needs review" src/app src/components src/lib` | Runtime owners are in code/tests, not docs only | Re-run file inspection and update implementation target |
| Targeted tests | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run test:run -- src/lib/research-v2/__tests__/resume-and-partial.test.ts src/app/api/research-v2/audit-state/__tests__/route.test.ts src/components/research-v2/__tests__/agent-artifact-surface.test.tsx src/components/research-v2/__tests__/onboarding-wizard-v2.test.tsx` | All targeted tests pass | Fix touched behavior before broader checks |
| Full tests | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run test:run` | Vitest completes successfully | Identify whether failure is touched-scope or existing |
| Lint | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run lint` | ESLint exits 0 | Fix touched files; report unrelated failures separately |
| Build | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run build` | Next build exits 0 | Fix type/build errors before live QA |
| Live smoothness | Browser + local stack | Fresh `/research-v2` run | No reload needed from corpus complete to GTM Brief Review | Report exact blocker with logs/screenshot |
| Reader labels | Browser + local stack | Completed six-section draft | Draft sections show `Draft ready`, parent shows `Audit ready` at 6/6 | Inspect audit-state payload and UI projection |

## Final Report Format

Return this structure:

```markdown
## Summary
- What changed and why.

## Files Changed
- Path: short description.

## Tests And Verification
- Command: result.
- Browser/live acceptance: result with exact route, run id if available, and observed transition timing.

## Behavior Confirmed
- Corpus completion transition:
- Draft-ready reader labels:
- Onboarding Needs review unaffected:
- Deepen buttons unaffected:

## Deviations Or Blockers
- Any deviation from this handoff, with evidence.

## Follow-Up
- Only concrete cleanup still needed, if any.
```

Completion is not valid unless the report includes the automated command results and the live browser acceptance result or a concrete blocker with evidence.
