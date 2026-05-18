# Research V2 Context Packs + Live Product Slice Plan

## Goal Launcher

```text
/goal Execute Research V2 Context Packs + Live Product Slice Plan from /Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-15-research-v2-context-packs-live-product-slice.md.

Treat that handoff as the source of truth. Complete phases in order, obey all hard rules, run every verification gate, update docs where required, and return the final implementation report requested in the handoff. The goal is complete only when all listed completion criteria pass or an explicit blocker is reported with evidence.
```

## Execution Contract

- Cwd: `/Users/ammar/Dev-Projects/AI-GOS`
- Current branch when written: `fix/p0-p2-research-v2-pipeline-2026-05-13`, ahead of origin with unrelated dirty/untracked files already present. Do not clean or revert unrelated work.
- Objective: ship the next `/research-v2` product slice where the user reviews every GTM Brief field before synthesis, the reviewed brief is frozen into the audit run, each positioning Section receives a compact source-addressable `SectionContextPack`, and the centered Audit Reader shows honest live phase progress.
- Product promise: after AI fills the GTM Brief, the user can review/edit all fields, then the six audit Sections run from curated Section Context Packs instead of a raw corpus dump. First useful visible output should target under 90 seconds and the full first-draft Audit should target under 5 minutes when rate limits allow. If concurrency remains 3, the UI must say it is running in waves.
- Completion definition: all in-scope code is implemented, focused tests pass, root and worker builds pass or documented pre-existing failures are proven unrelated, and a Fellow audit smoke run proves distinct context packs, visible phase state, and explicit capability gaps.

## Scope

In scope:

- Add a `SectionContextPack` contract for the six positioning Sections.
- Build one compact pack per Section from the frozen reviewed GTM Brief, selected corpus excerpts, source refs, capability gaps, allowed tool budget, and section-specific evidence gaps.
- Remove the `/api/research-v2/orchestrate` shared-context handoff to the worker.
- Ensure positioning context does not depend on the old Journey `DISPATCH_PIPELINE_ORDER`.
- Update runner instructions so Subagents read the Section Context Pack first and use external tools only for listed gaps, default max 2 external lookups per Section.
- Update onboarding review UX to render all 47 GTM Brief fields grouped by existing onboarding sections, with missing/low-confidence fields pinned at the top without hiding filled fields.
- Persist a frozen reviewed brief snapshot into the audit run context used by all Section Context Packs.
- Replace primary UI "Generating" language with phase labels: `Queued`, `Compiling context`, `Reading sources`, `Drafting`, `Validating`, `Complete`, `Needs review`.
- Expose readable live activity on the primary surface: phase, latest source/tool, elapsed time, concurrency/wave state, and next expected step. Keep raw/debug events in details only.
- Preserve the centered artifact reader and bottom command composer.

Out of scope:

- Redesigning the six typed Section Artifact schemas.
- Replacing Vercel AI SDK UI/chat, Railway worker, Anthropic runner, `ToolLoopAgent`, or `streamObject`.
- Reintroducing Anthropic Platform Skills zip uploads, `code_execution`, `validate.py`, or generic envelope output.
- Building a marketing landing page, dashboard shell, per-section chat, or non-centered workspace layout.
- Deep background enrichment beyond the first-draft audit. That can follow after the fast, honest first draft.

Assumptions to verify before editing:

- `CONTEXT.md` says all six positioning Sections are now ported to bespoke Artifacts and `streamObject`; verify that is true in the current checkout before changing runner behavior.
- `research_artifacts.thesis` exists and can hold the frozen GTM Brief snapshot without a new table. If this conflicts with current DB truth, add the smallest migration or use `journey_sessions.metadata` with a clear reason.
- Worker code can read `journey_sessions.research_results`, `journey_sessions.onboarding_data`, and `research_artifacts.thesis` using the existing service-role Supabase client.
- The current `research_section_runs.telemetry` jsonb column can carry phase/read-model fields. Prefer it over new columns unless a test proves it cannot support the UI read model.
- `ORCHESTRATOR_CONCURRENCY` may remain 3. The product fix is honesty first, not silently forcing concurrency 6 without rate-limit evidence.

## Authority

1. This handoff and the user request that produced it.
2. `/Users/ammar/Dev-Projects/AI-GOS/AGENTS.md` and `/Users/ammar/Dev-Projects/AI-GOS/CLAUDE.md`.
3. `/Users/ammar/Dev-Projects/AI-GOS/CONTEXT.md`.
4. `/Users/ammar/Dev-Projects/AI-GOS/docs/architecture/2026-05-14-positioning-audit-stack.md`.
5. `/Users/ammar/Dev-Projects/AI-GOS/docs/research-v2-e2e-brutal-findings-2026-05-15.md`.
6. Current implementation and tests in the files listed below.

## Architecture References

- Canonical product surface: `src/app/research-v2/page.tsx`
- Onboarding field contract: `src/lib/research-v2/onboarding-v2-types.ts`
- Corpus to onboarding prefill: `src/lib/research-v2/prefill-from-corpus.ts`
- Onboarding review UI: `src/components/research-v2/onboarding-wizard-v2.tsx`
- Onboarding save route: `src/app/api/research-v2/onboarding/route.ts`
- Orchestrate route currently building one shared context: `src/app/api/research-v2/orchestrate/route.ts`
- Old dispatch/context helper with `DISPATCH_PIPELINE_ORDER`: `src/lib/journey/server/dispatch-research.ts`
- Worker `/orchestrate` route: `research-worker/src/index.ts`
- Pure orchestrator loop: `research-worker/src/runners/positioning-audit-orchestrator.ts`
- Section runner and closing instructions: `research-worker/src/runners/positioning-subagent-runner.ts`
- Worker capability truth: `research-worker/src/capabilities.ts`
- Worker tool maps: `research-worker/src/agent-tools/index.ts`
- Normalized artifact DB helpers: `research-worker/src/db/artifact-runs.ts`, `research-worker/src/supabase.ts`
- Audit state route: `src/app/api/research-v2/audit-state/route.ts`
- Audit state hook: `src/lib/research-v2/use-audit-state.ts`
- Centered Audit Reader: `src/components/research-v2/agent-artifact-surface.tsx`
- Positioning Section IDs: `src/lib/ai/prompts/positioning-skills/index.ts`
- Existing tests to extend: `src/app/api/research-v2/orchestrate/__tests__/route.test.ts`, `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx`, `research-worker/src/runners/__tests__/positioning-audit-orchestrator.test.ts`

## Hard Rules

- Do not inject the full deep research corpus into every Section prompt.
- Do not pass one `sharedContext` string from `/api/research-v2/orchestrate` to all six children.
- Do not use old Journey `DISPATCH_PIPELINE_ORDER` to decide positioning context.
- Do not hide AI-filled onboarding fields. Missing/low-confidence fields can be pinned, but filled fields must still be visible in their groups.
- Do not let missing integrations become hidden agent behavior. A missing tool must become a capability gap in the pack and visible in the UI/artifact.
- Do not change the six typed Artifact schemas unless a test proves a small additive field is required for context-pack transparency.
- Do not replace the current architecture: Next.js app, Vercel AI SDK UI/chat layer, Railway worker, Anthropic runner, `ToolLoopAgent`, and `streamObject`.
- Do not revive per-section chat. Keep one run-level command composer tied to the centered artifact.
- Do not show generic "Generating" on the primary audit status surface. Use the explicit phase labels.
- No `any`, no default exports, no silent catch/fallback behavior. If a fallback is needed, make it explicit and test it.
- Stop if current repo truth contradicts this handoff in a way that changes the implementation shape. Report the conflict with exact file/line evidence.

## Execution Order

1. Preflight and baseline tests.
2. GTM Brief review and frozen snapshot.
3. `SectionContextPack` contract and builder.
4. Orchestrate/worker integration and runner instructions.
5. Durable phase state and audit-state read model.
6. Audit Reader UI honesty.
7. Integration smoke, docs, and final cleanup.

## Per-Phase Checklist

### Phase 0: Preflight

Deliverables:

- Confirm the repo state and current implementation status before editing.
- Record the current branch and dirty files in the final report.

Verification:

- [ ] `test -d ~/.claude/skills/gstack/bin && echo GSTACK_OK || echo GSTACK_MISSING` from `/Users/ammar/Dev-Projects/AI-GOS` returns `GSTACK_OK`.
- [ ] `git status --short --branch` is captured. Do not modify unrelated dirty files.
- [ ] `rg "Run your evidence tools|sharedContext|DISPATCH_PIPELINE_ORDER|Generating" src research-worker docs -g '*.ts' -g '*.tsx' -g '*.md'` is run once to establish the baseline.
- [ ] `npm run test:run -- src/app/api/research-v2/orchestrate/__tests__/route.test.ts src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` establishes current app test baseline.
- [ ] `cd research-worker && npm test -- src/runners/__tests__/positioning-audit-orchestrator.test.ts` establishes current worker test baseline.

Move-on rule:

- If baseline tests fail before edits, record the exact failures and continue only if the failures are clearly unrelated to this slice.

### Phase 1: GTM Brief Review And Frozen Snapshot

Deliverables:

- `src/components/research-v2/onboarding-wizard-v2.tsx` renders a review/edit surface for all 47 `OnboardingV2Data` fields using `SECTION_META`.
- Missing and low-confidence fields appear in a pinned review area above the grouped sections, but every filled field remains visible in its original section group.
- Each field displays one state: `AI-filled`, `User-edited`, `Missing`, or `Needs review`.
- `src/lib/research-v2/prefill-from-corpus.ts` or a companion helper preserves corpus prefill metadata from `deepResearchProgram.data.onboardingFields`: value, confidence, sourceUrl, and reasoning.
- `src/app/api/research-v2/onboarding/route.ts` persists the reviewed data plus review metadata. Prefer storing review metadata under `journey_sessions.metadata.researchV2OnboardingReview` to avoid schema churn unless a migration is clearly better.
- On orchestration kickoff, freeze the reviewed brief into the parent audit run. Preferred shape: update `research_artifacts.thesis` with `{ gtmBriefSnapshot, gtmBriefReview, frozenAt, source: "onboarding_v2_review" }` immediately after `seedOrchestration`.

TDD gate:

- [ ] Add or update component tests for `OnboardingWizardV2` before implementation.
- [ ] Add route/helper tests that prove a saved reviewed brief produces a frozen snapshot and later edits to `journey_sessions.onboarding_data` do not alter an already seeded parent run.

Implementation notes:

- The field count is driven by `OnboardingV2Data` and `SECTION_META`, not a hardcoded UI list.
- A field is `Missing` when its current value is empty.
- A field is `User-edited` when the current value differs from the AI prefill value after normalization.
- A field is `Needs review` when it is AI-filled but low confidence or source metadata is missing. Use an explicit threshold and put it in a named constant.
- A field is `AI-filled` when it came from corpus prefill, has acceptable confidence/source metadata, and has not been edited.

Verification:

- [ ] `npm run test:run -- src/components/research-v2/__tests__/onboarding-wizard-v2.test.tsx` passes.
- [ ] `npm run test:run -- src/app/api/research-v2/onboarding/__tests__/route.test.ts` passes if this test file is created.
- [ ] `rg "companyName|activationToPaid|growthTrend" src/components/research-v2/onboarding-wizard-v2.tsx src/lib/research-v2/onboarding-v2-types.ts` shows the first and last field groups are represented.

### Phase 2: SectionContextPack Contract And Builder

Deliverables:

- Add a worker-side pack module, likely `research-worker/src/runners/section-context-pack.ts`.
- Export named types and pure helpers:
  - `SectionContextPack`
  - `SectionCorpusExcerpt`
  - `SectionSourceRef`
  - `SectionCapabilityGap`
  - `SectionEvidenceGap`
  - `SectionToolBudget`
  - `buildSectionContextPack`
  - `serializeSectionContextPack`
- The serialized pack is a compact text block passed to the existing runner as the Section context.
- Hard cap: define `MAX_SECTION_CONTEXT_PACK_CHARS` and test it. Start at `12_000` chars unless evidence shows a better cap.
- The pack includes:
  - frozen GTM Brief/onboarding answers
  - selected corpus excerpts
  - source refs with stable IDs, title, URL, quote/claim/snippet, and confidence when available
  - capability gaps from worker capability truth
  - allowed tool budget, default `maxExternalLookups: 2`
  - section-specific evidence gaps
- The pack never serializes the full corpus object when the corpus exceeds budget.
- Section selection is deterministic and source-addressable. Avoid model calls inside the pack builder.

TDD gate:

- [ ] Write `research-worker/src/runners/__tests__/section-context-pack.test.ts` before implementation.
- [ ] Tests prove each Section gets distinct excerpt selection.
- [ ] Tests prove onboarding answers and source refs appear in every pack.
- [ ] Tests prove a large corpus is clipped by selected excerpts, not by dumping the whole JSON and slicing it.
- [ ] Tests prove unavailable tools become `capabilityGaps`.
- [ ] Tests prove `maxExternalLookups: 2` is present for all six Sections.

Implementation notes:

- Use `research-worker/src/capabilities.ts` for capability truth.
- Use `src/lib/ai/prompts/positioning-skills/index.ts` only as a reference for Section IDs if mirrored constants are needed. The worker cannot import from `src/`.
- If the worker lacks a canonical Section ID list, add one locally with a test that matches the six current IDs.
- Keep corpus excerpt selection simple and explicit: per-Section keyword/topic maps are acceptable for this slice.

Verification:

- [ ] `cd research-worker && npm test -- src/runners/__tests__/section-context-pack.test.ts` passes.
- [ ] `rg "SectionContextPack|MAX_SECTION_CONTEXT_PACK_CHARS|maxExternalLookups" research-worker/src` finds the contract and tests.
- [ ] `rg "JSON.stringify\\(corpus|full corpus|Company Research Corpus" research-worker/src/runners/section-context-pack.ts src/lib/journey/server/dispatch-research.ts` does not show a new full-corpus positioning prompt path.

### Phase 3: Orchestrate/Worker Integration And Runner Instructions

Deliverables:

- `src/app/api/research-v2/orchestrate/route.ts` no longer calls `buildJourneyResearchDispatchContext` to build one `sharedContext` for all children.
- The Next route calls worker `/orchestrate` with `parent_audit_run_id` only, plus any minimal metadata required for traceability. Do not send one shared context.
- `research-worker/src/index.ts` builds or loads a Section Context Pack per child before invoking the runner.
- Each `runSection` call passes that Section's serialized pack into the existing runner.
- `research-worker/src/runners/positioning-subagent-runner.ts` closing instructions are changed from "Run your evidence tools..." to "Read the Section Context Pack first; synthesize from source-backed evidence; use external tools only for listed evidence gaps within the allowed budget."
- The runner preserves `ToolLoopAgent -> streamObject(SectionArtifactSchema)` and existing post-validation.
- Single-section reruns through `/api/research-v2/dispatch` and `/api/research-v2/rerun-section` either use the new pack path or are explicitly marked as legacy with tests proving the main orchestrated path is the canonical path.

TDD gate:

- [ ] Update `src/app/api/research-v2/orchestrate/__tests__/route.test.ts` so it fails if `buildJourneyResearchDispatchContext` is called from the orchestrate route.
- [ ] Add worker tests proving `/orchestrate` runs children with distinct pack strings by zone.
- [ ] Add a focused runner test proving every Section closing instruction contains the pack-first rule and max 2 lookup budget language.

Implementation notes:

- `src/lib/journey/server/dispatch-research.ts` can keep `DISPATCH_PIPELINE_ORDER` for legacy Journey sections, but positioning Section Context Packs must not import or depend on it.
- If single-section dispatch remains for reruns, prefer building a pack there too so reruns have the same context discipline.
- Keep capability wrappers as a safety net, but do not rely on the model calling missing tools to discover gaps.

Verification:

- [ ] `npm run test:run -- src/app/api/research-v2/orchestrate/__tests__/route.test.ts` passes.
- [ ] `cd research-worker && npm test -- src/runners/__tests__/positioning-audit-orchestrator.test.ts src/runners/__tests__/section-context-pack.test.ts` passes.
- [ ] `rg "sharedContext|buildJourneyResearchDispatchContext" src/app/api/research-v2/orchestrate/route.ts` returns no shared-context build path.
- [ ] `rg "Run your evidence tools" research-worker/src/runners/positioning-subagent-runner.ts` returns no old closing instruction.
- [ ] `rg "DISPATCH_PIPELINE_ORDER" research-worker/src src/app/api/research-v2/orchestrate src/lib/research-v2` returns no new positioning pack dependency on the old order.

### Phase 4: Durable Phase State And Audit-State Read Model

Deliverables:

- Add an explicit phase union for section progress. Use these product labels: `Queued`, `Compiling context`, `Reading sources`, `Drafting`, `Validating`, `Complete`, `Needs review`.
- Persist phase state durably. Preferred minimal path: update `research_section_runs.telemetry` with fields like:
  - `phase`
  - `phaseStartedAt`
  - `latestTool`
  - `latestSource`
  - `latestActivity`
  - `nextStep`
  - `wave`
  - `concurrency`
  - `elapsedMs`
  - `capabilityGaps`
- Add helpers in `research-worker/src/db/artifact-runs.ts` or a small sibling module to write phase transitions.
- Emit phase transitions at these points:
  - queued after seeding
  - compiling context before pack builder runs
  - reading sources during ToolLoopAgent evidence collection
  - drafting during `streamObject`
  - validating during post-validation and retry
  - complete after commit
  - needs_review when a section is partial, errored with recoverable output, or has explicit capability/evidence gaps that reduce confidence
- `src/app/api/research-v2/audit-state/route.ts` returns phase, readable label, latest source/tool, elapsed time, next expected step, concurrency, and wave data for each Section.
- Raw events remain available in `eventsByZone`, but the primary UI uses the compact read model.

TDD gate:

- [ ] Add route tests for `audit-state` if no focused test exists.
- [ ] Extend worker orchestrator tests to assert phase transition calls happen in order.
- [ ] Add tests for `Needs review` when capability gaps exist or partial output is committed.

Verification:

- [ ] `npm run test:run -- src/app/api/research-v2/audit-state/__tests__/route.test.ts` passes if this test file is created.
- [ ] `cd research-worker && npm test -- src/runners/__tests__/positioning-audit-orchestrator.test.ts` passes.
- [ ] `rg "Compiling context|Reading sources|Drafting|Validating|Needs review" src research-worker` finds real code, not only docs.

### Phase 5: Audit Reader UI Honesty

Deliverables:

- `src/components/research-v2/agent-artifact-surface.tsx` replaces primary "Generating" labels with the explicit phase labels from audit-state.
- Worker chips show phase and status, not just queued/running/complete.
- The header/progress summary shows concurrency/wave state honestly. Example: "Wave 1 of 2 - 3 running, 3 queued" when concurrency is 3.
- Running Section rows show latest source/tool, elapsed time, and next expected step.
- Raw/debug events move behind details/disclosure UI. The primary surface stays readable.
- Keep centered artifact reader and bottom command composer. Do not add side rails or dashboard cards.

TDD gate:

- [ ] Extend `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` for phase labels, queued/running/complete states, wave messaging, latest activity, and details-only raw events.
- [ ] Add tests proving no primary label says `Generating` for a running Section.

Verification:

- [ ] `npm run test:run -- src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` passes.
- [ ] `rg "Generating|generating" src/components/research-v2/agent-artifact-surface.tsx` returns no primary status label. If it appears in a historical comment or hidden details label, justify it in the final report.
- [ ] Text does not overlap or resize chips unpredictably at mobile width. Use stable dimensions and concise phase labels.

### Phase 6: Integration Smoke And Product Timing

Deliverables:

- Run a local Fellow audit with the worker and app attached if credentials allow.
- Confirm all six Sections receive distinct Section Context Packs.
- Confirm the first visible section activity appears quickly after orchestration starts.
- Confirm unavailable tools appear as capability gaps.
- Confirm phase state changes from queued to compiling context to reading sources/drafting/validating/complete or needs review.
- Confirm the UI reflects concurrency/waves honestly if `ORCHESTRATOR_CONCURRENCY=3`.

Verification:

- [ ] Terminal 1: `npm run dev` from `/Users/ammar/Dev-Projects/AI-GOS`.
- [ ] Terminal 2: `cd research-worker && npm run dev`.
- [ ] Ensure `.env.local` has `RAILWAY_WORKER_URL=http://localhost:3001` and `RAILWAY_API_KEY=dev-secret` or equivalent local worker settings.
- [ ] Browser smoke on `/research-v2` with Fellow or a real test URL.
- [ ] Capture exact run ID, parent audit run ID, first visible activity timestamp, first artifact timestamp, and final completion timestamp.
- [ ] If live E2E is blocked by credentials, run route/worker integration tests and report the exact missing credential.

## Verification Matrix

| Gate | Cwd | Command | Expected result |
| --- | --- | --- | --- |
| App focused tests | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run test:run -- src/app/api/research-v2/orchestrate/__tests__/route.test.ts src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` | Passes |
| Onboarding tests | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run test:run -- src/components/research-v2/__tests__/onboarding-wizard-v2.test.tsx` | Passes if file is added |
| Audit-state tests | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run test:run -- src/app/api/research-v2/audit-state/__tests__/route.test.ts` | Passes if file is added |
| Root test suite | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run test:run` | Passes, or any existing unrelated failures are documented with exact evidence |
| Root lint | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run lint` | Passes |
| Root build | `/Users/ammar/Dev-Projects/AI-GOS` | `npm run build` | Passes, or known unrelated TypeScript failures are documented with exact evidence |
| Worker focused tests | `/Users/ammar/Dev-Projects/AI-GOS/research-worker` | `npm test -- src/runners/__tests__/section-context-pack.test.ts src/runners/__tests__/positioning-audit-orchestrator.test.ts` | Passes |
| Worker full tests | `/Users/ammar/Dev-Projects/AI-GOS/research-worker` | `npm test` | Passes |
| Worker build | `/Users/ammar/Dev-Projects/AI-GOS/research-worker` | `npm run build` | Passes |
| No shared context | `/Users/ammar/Dev-Projects/AI-GOS` | `rg "sharedContext|buildJourneyResearchDispatchContext" src/app/api/research-v2/orchestrate/route.ts` | No shared-context build path remains |
| Pack budget | `/Users/ammar/Dev-Projects/AI-GOS` | `rg "MAX_SECTION_CONTEXT_PACK_CHARS|maxExternalLookups|SectionContextPack" research-worker/src` | Contract and budget are implemented |
| No old instruction | `/Users/ammar/Dev-Projects/AI-GOS` | `rg "Run your evidence tools" research-worker/src/runners/positioning-subagent-runner.ts` | No old section closing instruction remains |
| Phase labels | `/Users/ammar/Dev-Projects/AI-GOS` | `rg "Compiling context|Reading sources|Drafting|Validating|Needs review" src research-worker` | Labels exist in runtime code and tests |

## Failure Protocol

- If a test or build fails, capture command, cwd, exit code, and the shortest useful error excerpt.
- If a failure is pre-existing, prove it by showing it fails before your edit or by showing the failed file is untouched and unrelated.
- If live E2E is blocked by missing credentials or rate limits, do not fake runtime claims. Report the missing env var or rate-limit response and complete all local deterministic gates.
- If context pack size pressure forces dropping evidence, keep source refs and evidence gaps. Do not silently include unaddressable excerpts.
- If the worker cannot reliably build packs because required data is only available in Next, stop and report that boundary before duplicating large app code into the worker.

## Completion Criteria

- The GTM Brief review shows all 47 fields, grouped by existing onboarding sections.
- Missing/low-confidence fields are pinned at the top without hiding filled fields.
- Each field state is visible and persisted with the reviewed brief.
- A frozen reviewed brief snapshot is attached to the audit parent run before Section packs are built.
- Each positioning Section receives its own serialized `SectionContextPack`.
- The pack builder never serializes the full corpus when corpus exceeds budget.
- Tool-budget language and `maxExternalLookups: 2` are present for all six Sections.
- Unavailable tools are explicit capability gaps.
- `/api/research-v2/orchestrate` no longer builds one shared context and passes it to all children.
- Positioning pack context no longer depends on old Journey `DISPATCH_PIPELINE_ORDER`.
- The Audit Reader primary surface uses phase labels, latest source/tool, elapsed time, and wave/concurrency state.
- Raw/debug events are details-only.
- Focused app tests, focused worker tests, worker build, and root build/lint gates are run and reported.
- Live Fellow smoke is run when credentials allow, with timing evidence. If blocked, blocker evidence is explicit.

## Final Implementation Report

Return:

- Branch and dirty-worktree notes.
- Files changed, grouped by app, worker, DB/migrations, tests, docs.
- Tests added or updated.
- Commands run with pass/fail result.
- Context pack proof: one line per Section with serialized length, source ref count, capability gap count, and max lookup budget.
- Onboarding proof: field count rendered, pinned count behavior, frozen snapshot storage location.
- Live UI proof: phase labels observed, concurrency/wave state, latest source/tool rendering.
- Runtime proof if E2E ran: run ID, parent audit run ID, first visible activity latency, first artifact latency, full draft latency.
- Deviations from this handoff and why.
- Blockers or follow-up cleanup.
