# Fast Drafts + Deep Enrichment Slice

## Goal Launcher

```text
/goal Execute Fast Drafts + Deep Enrichment Slice from /Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-15-fast-drafts-deep-enrichment.md.

Treat that handoff as the source of truth. Complete phases in order, obey all hard rules, conduct the required technical research before implementation, stay inside the current Research V2 architecture, run every verification gate, and return the final implementation report requested in the handoff. The goal is complete only when all listed completion criteria pass or an explicit blocker is reported with evidence.
```

## Execution Contract

### Objective

Turn the current six-section positioning runner into a fast first-pass product:

1. Initial audit path commits useful draft artifacts quickly from `SectionContextPack`.
2. Deep enrichment becomes an explicit per-section action, or an opt-in background path.
3. Deep enrichment only uses tools for gaps declared by the pack.
4. UI and API state tell the truth: queued, compiling context, reading sources when applicable, drafting, validating, committed, or needs review.
5. Persistence supports revisioned enrichment without overwriting newer user-visible work.

Latest E2E learning, 2026-05-16: extending draft timeout to 180 seconds did
not make the current draft path reliable. Draft mode still tried to emit the
full typed Section Artifact with all sub-sections, and all six sections timed
out in the live orchestration test. The right cut is therefore not "more
timeout" or UI polish. The right cut is a thinner draft artifact that commits
first, followed by deep enrichment that fills the full Section schema.

The right cut is the worker runner and orchestration path, not a new architecture.

### Source Of Truth Hierarchy

Use this order when docs, code, and old assumptions disagree:

1. This handoff.
2. `AGENTS.md` and `CLAUDE.md`.
3. `CONTEXT.md`.
4. `docs/architecture/2026-05-14-positioning-audit-stack.md`.
5. `docs/research-v2-e2e-brutal-findings-2026-05-15.md`.
6. `docs/handoffs/2026-05-15-research-v2-context-packs-live-product-slice.md`.
7. Current code and tests in the checkout.

Do not follow older Journey docs when they conflict with `/research-v2`, the worker `/orchestrate` path, `SectionContextPack`, or the normalized artifact tables.

### Cwd And Branch

- Cwd: `/Users/ammar/Dev-Projects/AI-GOS`.
- Current branch at handoff time: `fix/p0-p2-research-v2-pipeline-2026-05-13`.
- The worktree may be dirty. Do not revert or modify unrelated changes.

### Completion Definition

The slice is complete when:

- Initial six-section audit runs in `draft` mode by default.
- Draft mode skips the broad `ToolLoopAgent.generate` evidence loop and goes directly from `SectionContextPack` to `streamObject(PositioningSectionDraftSchema)` or equivalent thin per-section draft schemas.
- Draft mode does not emit the full `SectionArtifactSchema`.
- Deep mode is available per section and uses `MODELS.STRONG`.
- Draft mode uses `MODELS.STANDARD`.
- No hardcoded model strings remain in the touched runner/subagent path.
- Tool budget is enforced in runtime code, not only in prompts.
- One timeout spans context work, evidence work, `streamObject`, validation, retry, and artifact commit.
- Timed-out runs cannot commit late.
- Deep enrichment commits against the current artifact section revision and cleanly handles stale revisions.
- `/api/research-v2/rerun-section` can dispatch one-zone deep enrichment.
- UI labels use `Committed`, not `Complete`, for the runtime/display phase.
- Tests listed in this handoff pass, or blockers are reported with exact evidence.

## Scope

### In Scope

- Worker execution mode contract: `draft` and `deep`.
- `research-worker/src/runners/section-context-pack.ts` consumers, not the pack contract itself unless tests prove a gap.
- `research-worker/src/runners/positioning-audit-orchestrator.ts`.
- `research-worker/src/runners/positioning-subagent-runner.ts`.
- `research-worker/src/runners/positioning/index.ts`.
- `research-worker/src/index.ts` `/orchestrate` route.
- Worker Supabase helpers in `research-worker/src/supabase.ts` and/or `research-worker/src/db/artifact-runs.ts`.
- `commit_artifact_section` RPC migration and tests or smoke checks around its compare-and-swap behavior.
- `/api/research-v2/rerun-section`.
- `/api/research-v2/audit-state`.
- `src/components/research-v2/agent-artifact-surface.tsx` and adjacent UI components needed for phase labels and Deepen actions.
- Focused tests for runner, orchestrator, persistence behavior, rerun route, audit state, and UI phase labels.

### Out Of Scope

- Redesigning the six full deep artifact schemas.
- Replacing deep-mode full artifacts with draft-only artifacts.
- Removing the ability to render a committed first-pass draft before deep enrichment.
- Replacing deep-mode `ToolLoopAgent -> streamObject(SectionArtifactSchema)`.
- Replacing Vercel AI SDK UI/chat architecture.
- Introducing a new queue, new agent framework, new DB model, or new product surface.
- Reopening raw full-corpus prompt injection.
- Adding automatic background deep enrichment unless gated behind `AUTO_DEEP_ENRICHMENT=true`, off by default.
- Rewriting onboarding UX in this slice except where rerun/deepen controls need to read frozen review context.

### Assumptions To Verify

- `SectionContextPack` already contains frozen GTM Brief answers, selected excerpts, source refs, capability gaps, evidence gaps, and `toolBudget`.
- `DEFAULT_MAX_EXTERNAL_LOOKUPS` is currently `2`.
- The worker `/orchestrate` route currently runs all eligible child sections and does not accept zone/mode filters.
- `commitArtifactSection` currently receives `expectedRevision: 0` from the orchestrator commit path.
- Existing `commit_artifact_section` migrations still reject a new `section_run_id` when a previous committed section has a different run id, even if the expected revision matches.
- `readCurrentSection` or a similar helper exists in `research-worker/src/supabase.ts` but is private to legacy write-back and must be exposed or recreated in the proper DB helper layer.

Verify these from the current checkout before editing. If any assumption is false, adapt the implementation while preserving the objective and hard rules.

## Architecture References

### Read First

- `AGENTS.md`.
- `CLAUDE.md`.
- `CONTEXT.md`.
- `docs/architecture/2026-05-14-positioning-audit-stack.md`.
- `docs/research-v2-e2e-brutal-findings-2026-05-15.md`.
- `docs/handoffs/2026-05-15-research-v2-context-packs-live-product-slice.md`.
- `docs/research-sections.md`.
- `docs/adr/0001-skill-driven-artifact-builder-pattern.md`.
- `docs/adr/0002-single-structured-output-per-section.md`.
- `docs/adr/0003-backend-only-deployment.md`.

### External Practice References

Use these as product and engineering guardrails, not as a reason to replace the
existing stack:

- AI Hero Vercel AI SDK Tutorial: https://www.aihero.dev/vercel-ai-sdk-tutorial
- AI Hero Streaming Objects: https://www.aihero.dev/streaming-objects-with-vercel-ai-sdk
- AI Hero Agents With Vercel AI SDK: https://www.aihero.dev/agents-with-vercel-ai-sdk
- AI Hero AI Engineer Roadmap: https://www.aihero.dev/ai-engineer-roadmap
- AI Hero Evals: https://www.aihero.dev/what-are-evals
- AI Hero Choosing an LLM: https://www.aihero.dev/how-to-choose-an-llm
- AI Hero LLM App Improvement Techniques: https://www.aihero.dev/how-to-improve-your-llm-powered-app

The applied lesson for AI-GOS is narrow: we already have AI SDK primitives
(`ToolLoopAgent`, tools, `streamObject`, Zod schemas, model abstraction,
background worker execution). The missing layer is smaller work units plus
runtime evals for latency, abort propagation, model choice, and first useful
artifact quality.

### Current Code Anchors

- Context pack: `research-worker/src/runners/section-context-pack.ts`.
- Context pack tests: `research-worker/src/runners/__tests__/section-context-pack.test.ts`.
- Orchestrator: `research-worker/src/runners/positioning-audit-orchestrator.ts`.
- Worker route: `research-worker/src/index.ts`.
- Runner: `research-worker/src/runners/positioning-subagent-runner.ts`.
- Runner dispatch wrapper: `research-worker/src/runners/positioning/index.ts`.
- Subagent registry and tool maps: `research-worker/src/agents/subagents/index.ts`, `research-worker/src/agent-tools`.
- Models: `research-worker/src/models.ts`.
- Phase enum: `research-worker/src/runners/section-phase.ts`.
- Worker persistence helper: `research-worker/src/supabase.ts`.
- Artifact run DB helpers: `research-worker/src/db/artifact-runs.ts`.
- Existing RPC migrations: `supabase/migrations/20260514_research_artifact_normalized.sql`, `supabase/migrations/20260515_phase5_abort_guard_and_reaper.sql`, `supabase/migrations/20260521_commit_artifact_section_qualify_revision.sql`, `supabase/migrations/20260523_commit_artifact_section_variable_conflict.sql`, `supabase/migrations/20260524_research_artifact_sections_data.sql`.
- Rerun route: `src/app/api/research-v2/rerun-section/route.ts`.
- Audit state route: `src/app/api/research-v2/audit-state/route.ts`.
- Main artifact UI: `src/components/research-v2/agent-artifact-surface.tsx`.
- Artifact canvas rerun caller: `src/components/research-v2/audit-artifact-canvas.tsx`.

### Existing Tests To Extend

- `research-worker/src/runners/__tests__/positioning-subagent-runner-instructions.test.ts`.
- `research-worker/src/runners/__tests__/positioning-audit-orchestrator.test.ts`.
- `research-worker/src/runners/__tests__/section-context-pack.test.ts`.
- `src/app/api/research-v2/audit-state/__tests__/route.test.ts`.
- `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx`.
- Add route tests for `src/app/api/research-v2/rerun-section` if none exist.

## Technical Research Requirement

Before implementation, conduct focused technical research. This is required, but it must not become architecture drift.

Research only these questions:

1. How the current AI SDK v6 `ToolLoopAgent` and `streamObject` calls in this repo accept models, tools, abort signals, retries, and telemetry.
2. Whether official AI SDK docs or installed package source clarify dynamic tool maps, abort behavior, and stream cancellation. Use official docs if network is available; otherwise inspect installed source in `node_modules`.
3. How the current Supabase RPC compare-and-swap pattern should be changed so revision match allows a new valid section run to supersede the old `section_run_id`, while stale revision still conflicts.
4. How existing route tests mock worker dispatch and Supabase so `/rerun-section` can be tested without real network calls.
5. Whether current UI state already distinguishes active runs, committed artifact sections, and terminal stale runs.

Research output requirement:

- Do not create a separate research doc unless implementation needs it.
- Include a short "Technical research notes" section in the final report with exact repo files, package docs, or official docs consulted.
- If a discovered API behavior conflicts with this handoff, stop that phase and report the conflict with evidence before redesigning.

## Framework Alignment And Best Practices

Preserve these decisions:

- Next.js App Router and Vercel AI SDK v6 stay in place.
- Worker remains the backend execution surface for positioning audit sections.
- `ToolLoopAgent -> streamObject(SectionArtifactSchema)` remains the architecture for deep mode.
- Draft mode uses `streamObject(PositioningSectionDraftSchema)` or thin per-section draft schemas and post-validation.
- Deep mode uses `streamObject(SectionArtifactSchema)` and post-validation.
- Zod schemas stay the boundary for AI outputs, API inputs, and route bodies.
- The GTM Brief and Section Context Pack are the source context, not a full raw corpus dump.
- Capability gaps are explicit data, not hidden agent behavior.
- Model selection comes from `research-worker/src/models.ts`.
- TypeScript stays strict: no `any`, no implicit return types, named exports only for new code.
- Use structured logs and telemetry payloads with fields, not string-only state.
- Keep diffs minimal and local to this slice.

## Hard Rules

- Do not replace the architecture with a new agent framework.
- Do not bypass `SectionContextPack`.
- Do not inject the full corpus into section prompts.
- Do not rely on prompt text alone for tool budgets.
- Do not hardcode Anthropic model strings in the touched runner/subagent path.
- Do not make draft mode emit full typed Section Artifacts with all sub-sections.
- Do not let a timed-out section commit after timeout.
- Do not overwrite a newer artifact section revision from an older deep enrichment run.
- Do not show generic `Generating` or runtime phase `Complete` in the primary audit UI.
- Do not turn on background deep enrichment by default.
- Do not hide missing capability gaps.
- Do not silently swallow RPC, worker dispatch, validation, or model errors.
- Do not modify unrelated dirty files.

## Execution Order

### Phase 0: Preflight And Technical Research

Read the reference docs, inspect current code, and capture the exact implementation shape before editing.

Deliverables:

- Confirm current branch and dirty status.
- Confirm where `SectionContextPack` is built, serialized, and passed.
- Confirm where section timeout currently starts and where it is cleared.
- Confirm current tool-map creation and whether dynamic per-run tool maps require a factory.
- Confirm current revision helper and RPC behavior.
- Confirm current rerun path.
- Confirm current audit-state run selection behavior.

Verification:

```bash
git status --short --branch
rg -n "SectionContextPack|serializeSectionContextPack|buildSectionContextPack" research-worker/src
rg -n "SUBAGENT_MODEL|agent.generate|clearTimeout|commitArtifactSection|expectedRevision" research-worker/src
rg -n "commit_artifact_section|section_run_id|expected_revision" supabase/migrations research-worker/src
rg -n "rerun-section|audit-state|Complete|Generating" src research-worker/src
```

Pass condition:

- You can state the exact files to edit and the tests to add before making code changes.

### Phase 1: Execution Mode Contract

Add an explicit execution mode contract:

```ts
export type PositioningExecutionMode = 'draft' | 'deep';
```

Implementation expectations:

- Add this type in the narrowest shared worker location that avoids cycles.
- Propagate mode through worker `/orchestrate`, orchestrator deps, positioning runner wrapper, and `runJourneySectionViaSubagent`.
- Initial orchestration defaults to `draft`.
- Explicit section reruns default to `deep`.
- Keep mode explicit in telemetry and progress events.
- Preserve existing schemas and artifacts.

Likely file targets:

- `research-worker/src/runners/positioning-audit-orchestrator.ts`.
- `research-worker/src/runners/positioning/index.ts`.
- `research-worker/src/runners/positioning-subagent-runner.ts`.
- `research-worker/src/index.ts`.
- `src/app/api/research-v2/rerun-section/route.ts`.

Tests:

- Orchestrator test proves default initial mode is `draft`.
- Rerun route test proves explicit section reruns default to `deep`.

### Phase 2: Thin Fast Draft Path

Refactor the runner so `draft` mode skips `agent.generate` and emits a thin
draft artifact instead of the full Section Artifact.

Draft behavior:

- Input: serialized `SectionContextPack`.
- No broad ToolLoopAgent evidence loop.
- No external tool calls.
- Model: `MODELS.STANDARD`.
- Phase progression should usually be `Compiling context -> Drafting -> Validating -> Committed`.
- Skip `Reading sources` unless draft mode actually reads an external source.
- Artifact emission path is `streamObject(PositioningSectionDraftSchema)` or a thin per-section draft schema.
- The full `SectionArtifactSchema` is deep-mode only.
- Draft schema should include only what the reader needs for first value:
  - section id and title
  - status summary
  - core thesis
  - 3-5 evidence-backed findings
  - source references or source-gap references
  - explicit capability/evidence gaps
  - confidence
  - recommended deep-fill targets
- Existing normalization and markdown projection may be adapted to render draft artifacts, but do not force a draft through the full deep artifact shape.
- A draft may commit with evidence gaps if draft validation passes and gaps are explicit in the artifact or telemetry.

Implementation expectations:

- Replace hardcoded `anthropic('claude-opus-4-6')` in touched runner code with model helpers from `research-worker/src/models.ts`.
- Keep section-specific deep schema branches.
- Add a shared draft schema only if it can represent all six sections without hiding section identity. Otherwise add thin per-section draft schemas.
- Avoid copy-pasting six new runner implementations. Add a small shared mode/model/options layer around existing section-specific stream functions.
- Preserve `chatRefinement` behavior for paths that still need it, but do not use it to reintroduce broad evidence loops in draft mode.

Tests:

- Unit test spies on or mocks the agent and proves `draft` mode does not call `agent.generate`.
- Unit test proves draft mode calls the thin draft `streamObject` path with the draft model.
- Unit test proves draft mode does not pass any full `SectionArtifactSchema`.
- Unit test proves a valid thin draft can be projected and committed.
- Existing section schema tests still pass.

### Phase 2A: Draft Runtime Eval Gate

Add a focused eval or integration command for the draft SLA before UI polish.

Required metrics:

- `section_started_at`
- `first_partial_at`
- `draft_object_complete_at`
- `validation_complete_at`
- `commit_started_at`
- `commit_complete_at`
- `timeout_fired_at`
- `abort_signal_seen_at`
- `terminal_status_written_at`

Pass targets for the next live gate:

- First visible partial for each section: under 15 seconds after section start.
- Each draft commit: under 90 seconds unless provider outage is explicit.
- All six draft sections: under 3 minutes when concurrency is 6 and rate limits allow.
- Abort settle lag: under 10 seconds from timeout to terminal DB state.
- No draft run may commit after its timeout has fired.

This gate should run against a stable fixture such as the Fellow run context and
at least one second company fixture before the app moves back to visual polish.

### Phase 3: Deep Mode Tool Budget Enforcement

Deep mode can use tools, but only for gaps declared by the `SectionContextPack`.

Runtime rules:

- Filter available tools per section using `pack.toolBudget.allowedTools`.
- Enforce `pack.toolBudget.maxExternalLookups`, currently `2`, in code.
- Tool calls after budget exhaustion return a structured result like:

```ts
{
  ok: false,
  status: 'tool_budget_exhausted',
  maxExternalLookups: 2,
  unresolvedEvidenceGapId: '<gap id if known>',
  message: 'Tool budget exhausted for this section.'
}
```

- Record the unresolved evidence gap in section telemetry or artifact error/gap metadata.
- Missing unavailable integrations stay as `capabilityGaps`.
- Do not expose disallowed tools to the model.
- Do not mutate global tool maps for one run.

Implementation guidance:

- Inspect `research-worker/src/agents/subagents/index.ts` and `research-worker/src/agent-tools`.
- If current subagents are static singletons, introduce a per-run factory that preserves the existing instructions but accepts filtered, budget-wrapped tools and a selected model.
- Keep `POSITIONING_SUBAGENTS` compatibility if other code imports it, but do not let the new deep mode depend on unfiltered global tools.
- If a tool cannot be mapped to `allowedTools`, treat that mismatch as a capability gap and test it.

Tests:

- Deep mode filters out a tool not listed in the pack budget.
- Deep mode allows only up to `maxExternalLookups`.
- The third external lookup returns structured budget-exhausted output.
- Budget exhaustion is recorded as an unresolved gap.

### Phase 4: One Whole-Section Timeout

Move timeout ownership high enough that it spans the whole section lifecycle.

Defaults:

```text
POSITIONING_DRAFT_TIMEOUT_MS=180000
POSITIONING_DEEP_TIMEOUT_MS=240000
```

The 180-second draft timeout is a temporary guardrail, not the desired product
latency. Thin drafts should still target sub-90-second commits, with timeout
used to fail honestly rather than to define the happy path.

Timeout must cover:

- Context pack build or load.
- Deep evidence/tool loop when mode is `deep`.
- `streamObject`.
- Validation.
- Retry.
- `commitArtifactSection`.

Implementation expectations:

- Start the timeout before context/evidence work for each section child.
- Pass one `AbortSignal` through context work, runner, streaming, validation retry, and commit guard.
- Do not clear timeout after the evidence step.
- Clear timeout only after the section reaches terminal handling.
- Before committing, check whether the signal was aborted.
- On timeout, do not commit. Mark the child section as `Needs review` in phase telemetry and terminal run status should carry timeout details.
- Include the last completed phase in telemetry.

Tests:

- Timeout firing during `streamObject` prevents commit.
- Timeout firing during validation/retry prevents commit.
- Timeout firing just before commit prevents commit.
- Timed-out run exposes `Needs review` or timeout telemetry with the last completed phase.

### Phase 5: Revisioned Deep Enrichment Persistence

Deep enrichment must commit against the current artifact section revision.

Implementation expectations:

- Add or expose a DB helper to read the current artifact section revision and current `section_run_id`.
- Initial draft commit can use revision `0` when creating the section.
- Deep enrichment must read the current revision before commit and pass that as `expectedRevision`.
- Update `commit_artifact_section` RPC so a new valid `section_run_id` can supersede the previous `section_run_id` when `expectedRevision` matches.
- Keep stale revision protection: if revision changed while enrichment was running, return conflict and do not overwrite.
- If commit conflicts, mark the section run `Needs review` or equivalent telemetry; do not retry blindly.
- Keep abort protection from existing abort-guard migrations.

Likely targets:

- `research-worker/src/supabase.ts`.
- `research-worker/src/db/artifact-runs.ts`.
- New Supabase migration after the latest existing `commit_artifact_section` migration.
- Any tests or SQL smoke harness already used by this repo for RPC behavior.

Tests:

- Deep enrichment increments revision from current revision.
- Deep enrichment can supersede prior `section_run_id` when expected revision matches.
- Stale revision conflict does not overwrite.
- Conflict is surfaced to run telemetry/status.

### Phase 6: One-Zone Deep Rerun Path

Extend existing rerun path for on-demand deep enrichment.

API behavior:

- `POST /api/research-v2/rerun-section` accepts:

```ts
{
  runId: string;
  zone: PositioningSectionId;
  executionMode?: 'draft' | 'deep';
  usePartialContext?: boolean;
  refinement?: string;
}
```

- Explicit section reruns default to `deep`.
- Seed only the requested zone.
- Call the worker orchestration path for that zone and mode.
- Do not dispatch all six zones for a one-section Deepen action.
- Preserve best-effort abort behavior for the current zone when needed.

Worker behavior:

- `/orchestrate` accepts optional zone filters and `executionMode`.
- Orchestrator only runs eligible children for the requested zone filter.
- Response includes enough IDs for the UI to track the new run.

Tests:

- Route test proves missing `executionMode` becomes `deep`.
- Route test proves only one requested zone is seeded/dispatched.
- Worker/orchestrator test proves zone filter prevents other sections from running.

### Phase 7: Honest Phase State And UI

Runtime/display phase order:

```text
Queued
Compiling context
Reading sources
Drafting
Validating
Committed
Needs review
```

Implementation expectations:

- Replace runtime/display phase `Complete` with `Committed`.
- Keep DB status value `complete`; this is a display/runtime phase language change.
- Draft mode skips `Reading sources` unless it actually reads external sources.
- `audit-state` should prefer active runs first, then the run referenced by the committed artifact section, not the oldest terminal run.
- Primary UI should show readable activity, latest source/tool, elapsed time, next expected step, and current phase.
- Raw/debug events stay in details only.
- Completed draft sections show a clear `Deepen` action.
- Deep enrichment shows the same phase rail with source/tool activity visible.
- Background auto-enrichment is allowed only behind `AUTO_DEEP_ENRICHMENT=true`, off by default.

Likely targets:

- `research-worker/src/runners/section-phase.ts`.
- `research-worker/src/runners/positioning-audit-orchestrator.ts`.
- `src/app/api/research-v2/audit-state/route.ts`.
- `src/components/research-v2/agent-artifact-surface.tsx`.
- `src/components/research-v2/audit-artifact-canvas.tsx`.
- Adjacent tests.

Tests:

- Phase order renders `Committed`.
- Tests assert no generic `Generating`.
- Tests assert no primary `Complete` phase label.
- Deepen action appears for committed draft sections.

### Phase 8: Verification And Runtime Smoke

Run focused tests first, then broader checks.

Minimum commands:

```bash
npm run test:run -- research-worker/src/runners/__tests__/section-context-pack.test.ts
npm run test:run -- research-worker/src/runners/__tests__/positioning-audit-orchestrator.test.ts
npm run test:run -- research-worker/src/runners/__tests__/positioning-subagent-runner-instructions.test.ts
npm run test:run -- src/app/api/research-v2/audit-state/__tests__/route.test.ts
npm run test:run -- src/components/research-v2/__tests__/agent-artifact-surface.test.tsx
npm run test:run -- src/app/api/research-v2/rerun-section
npm run lint
npm run build
```

Worker-specific commands:

```bash
cd research-worker && npm run test:run
cd research-worker && npm run build
```

If full build is blocked by known unrelated TypeScript errors, report exact errors and still run all focused tests that cover this slice.

## Per-Phase Checklist

### Phase 0 Checklist

- [ ] Read all source-of-truth docs.
- [ ] Record current branch and dirty files.
- [ ] Inspect current runner, orchestrator, worker route, rerun route, audit state, models, tool maps, and RPC helpers.
- [ ] Conduct focused AI SDK/Supabase/package-source research.
- [ ] Identify exact file edit set.

### Phase 1 Checklist

- [ ] Add `PositioningExecutionMode`.
- [ ] Thread mode through worker route, orchestrator, positioning wrapper, and runner.
- [ ] Add telemetry field for mode.
- [ ] Initial audit defaults to `draft`.
- [ ] Explicit rerun defaults to `deep`.
- [ ] Tests prove defaults.

### Phase 2 Checklist

- [ ] Replace touched hardcoded model strings with `MODELS`.
- [ ] Draft mode skips `agent.generate`.
- [ ] Draft mode uses a thin draft `streamObject` schema directly.
- [ ] Draft mode does not use the full Section Artifact schema.
- [ ] Draft mode uses `MODELS.STANDARD`.
- [ ] Draft mode keeps draft schema validation and post-validation.
- [ ] Draft commits valid artifacts with explicit gaps.
- [ ] Tests prove `agent.generate` is skipped.

### Phase 2A Checklist

- [ ] Add draft runtime metrics for first partial, final object, validation, commit, timeout, abort observation, and terminal write.
- [ ] Add or extend an eval command that exercises the real draft runner path.
- [ ] Gate draft with pass/fail thresholds for first partial, per-section commit, six-section wall time, and abort settle lag.
- [ ] Run Haiku vs Sonnet draft comparison from the same fixture before locking the default model.

### Phase 3 Checklist

- [ ] Deep mode uses `MODELS.STRONG`.
- [ ] Deep mode builds per-run filtered tools.
- [ ] Runtime budget enforces `maxExternalLookups`.
- [ ] Budget-exhausted result is structured.
- [ ] Unresolved gap is recorded.
- [ ] Tests prove filtering and budget enforcement.

### Phase 4 Checklist

- [ ] Add draft/deep timeout env parsing with defaults.
- [ ] One timeout spans context through commit.
- [ ] Timeout signal reaches runner and commit guard.
- [ ] No late commit after timeout.
- [ ] Timeout telemetry includes last completed phase.
- [ ] Tests cover stream, validation/retry, and commit timing.

### Phase 5 Checklist

- [ ] Add or expose current section revision helper.
- [ ] Deep commit uses current revision.
- [ ] RPC migration allows new run to supersede old run when revision matches.
- [ ] RPC still rejects stale revision.
- [ ] Conflict marks Needs review or equivalent telemetry.
- [ ] Tests or SQL smoke prove revision behavior.

### Phase 6 Checklist

- [ ] Extend rerun route schema with `executionMode`.
- [ ] Default explicit reruns to `deep`.
- [ ] Seed one requested zone.
- [ ] Worker `/orchestrate` accepts zone filter and mode.
- [ ] Orchestrator only runs requested zone.
- [ ] Tests prove one-zone deep dispatch.

### Phase 7 Checklist

- [ ] Replace runtime/display `Complete` phase with `Committed`.
- [ ] Keep DB status `complete`.
- [ ] Audit-state prefers active runs, then committed section run, not oldest terminal.
- [ ] UI removes primary generic `Generating`.
- [ ] Draft committed sections show Deepen action.
- [ ] Deep phase rail shows source/tool activity.
- [ ] Tests prove phase labels and Deepen action.

### Phase 8 Checklist

- [ ] Run focused tests.
- [ ] Run worker tests/build.
- [ ] Run root lint/build or report exact unrelated blockers.
- [ ] Review `git diff --stat` and `git diff`.
- [ ] Final report includes technical research notes, files changed, tests run, and unresolved risks.

## Verification Matrix

| Gate | Command | Expected pass condition | On failure |
| --- | --- | --- | --- |
| Context pack contract | `npm run test:run -- research-worker/src/runners/__tests__/section-context-pack.test.ts` | Existing pack tests pass | Fix pack consumers before editing pack contract |
| Runner mode behavior | `npm run test:run -- research-worker/src/runners/__tests__/positioning-subagent-runner-instructions.test.ts` | Draft skips agent, thin draft schema is used, deep budget instructions remain | Add focused tests or fix runner mode branching |
| Draft runtime SLA | New or extended draft eval command | First partial, draft commit, six-section wall time, and abort settle lag meet thresholds | Do not move to UI polish; reduce draft scope or fix abort propagation |
| Orchestrator mode/timeout | `npm run test:run -- research-worker/src/runners/__tests__/positioning-audit-orchestrator.test.ts` | Mode, phase, zone, timeout, no-late-commit cases pass | Fix orchestration lifecycle before UI |
| Audit state | `npm run test:run -- src/app/api/research-v2/audit-state/__tests__/route.test.ts` | Active run and committed section selection are correct | Fix route selection logic |
| Rerun route | `npm run test:run -- src/app/api/research-v2/rerun-section` | One-zone deep dispatch passes | Add missing route test if command cannot resolve |
| Artifact UI | `npm run test:run -- src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` | Committed label and Deepen action render | Fix UI state mapping |
| Worker suite | `cd research-worker && npm run test:run` | Worker tests pass | Fix worker regressions or report unrelated failures |
| Worker build | `cd research-worker && npm run build` | TypeScript build succeeds | Fix strict typing issues |
| Root lint | `npm run lint` | No lint errors from this slice | Fix touched files or report unrelated pre-existing errors |
| Root build | `npm run build` | Build succeeds | Fix touched files or report unrelated pre-existing errors |

## Acceptance Bar

- First full audit produces committed thin drafts quickly, ideally under three minutes for all six sections when rate limits allow.
- Draft mode never waits on full deep Section Artifact generation.
- Each section enriches only from known pack gaps, not broad research loops.
- Draft output appears without waiting for deep tool work.
- Every visible state tells the user what is happening now.
- Deep work is an explicit product action through `Deepen`, not a blocker for seeing usable GTM output.
- Stale enrichment never overwrites newer committed section work.
- The implementation remains inside the Research V2 stack described in `CONTEXT.md` and the architecture doc.

## Final Report Format

Return the final report with these sections:

1. `Technical research notes`
   - Exact repo files, installed package source, or official docs consulted.
   - Any implementation-relevant API behavior discovered.
2. `What changed`
   - Concise list grouped by runner/orchestrator, persistence, rerun route, audit state, UI, tests.
3. `Files changed`
   - File paths only, grouped by area.
4. `Verification`
   - Commands run and pass/fail result for each.
   - If a command was not run, state why.
5. `Acceptance status`
   - Confirm each acceptance bar item or list blockers.
6. `Residual risks`
   - Only real remaining risks, not generic caveats.

Do not declare the goal complete until the verification matrix is satisfied or a blocker is reported with exact evidence.
