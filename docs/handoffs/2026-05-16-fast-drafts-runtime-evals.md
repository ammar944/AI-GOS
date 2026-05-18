# Fast Drafts + Runtime Evals Handoff

## Goal Launcher

```text
/goal Execute Fast Drafts + Runtime Evals from /Users/ammar/Dev-Projects/AI-GOS/docs/handoffs/2026-05-16-fast-drafts-runtime-evals.md.

Treat that handoff as the source of truth. Complete phases in order, obey all hard rules, run every verification gate, update docs where required, and return the final implementation report requested in the handoff. The goal is complete only when all listed completion criteria pass or an explicit blocker is reported with evidence.
```

## Execution Contract

### Objective

Make `/research-v2` draft mode actually fast by committing thin first-pass positioning section drafts, then using deep mode for full typed artifact enrichment.

### Authority Stack

1. This handoff.
2. `/Users/ammar/Dev-Projects/AI-GOS/AGENTS.md`.
3. `/Users/ammar/Dev-Projects/AI-GOS/docs/research-v2-e2e-brutal-findings-2026-05-15.md`.
4. `/Users/ammar/Dev-Projects/AI-GOS/docs/architecture/2026-05-14-positioning-audit-stack.md`.
5. Current code and tests.

### Cwd And Branch

- Cwd: `/Users/ammar/Dev-Projects/AI-GOS`.
- Branch: `fix/p0-p2-research-v2-pipeline-2026-05-13`.
- Dirty worktree expected. Do not revert unrelated files.

### Completion Definition

- Draft mode uses a thin draft schema, not full section schemas.
- Deep mode remains full `ToolLoopAgent -> streamObject(full schema)`.
- Draft commits all six sections reliably under the SLA gates.
- Runtime timings prove first partial, final object, commit, timeout, abort, and terminal write timing.
- Haiku vs Sonnet draft matrix is run before changing the draft default.
- No UI polish beyond truthful draft/deep state, confidence, evidence gaps, and existing Deepen controls.

## Scope

### In Scope

- `research-worker/src/runners/positioning-subagent-runner.ts`.
- `research-worker/src/runners/positioning-audit-orchestrator.ts`.
- `research-worker/src/index.ts`.
- `research-worker/src/models.ts`.
- `research-worker/src/supabase.ts`.
- `research-worker/src/db/artifact-runs.ts`.
- `src/app/api/research-v2/rerun-section/route.ts`.
- `src/app/api/research-v2/audit-state/route.ts`.
- `src/components/research-v2/agent-artifact-surface.tsx`.
- Focused tests and worker eval scripts.

### Out Of Scope

- New agent framework, queue, DB model, product surface, or raw corpus prompting.
- Rewriting the six full deep schemas.
- Background deep enrichment unless behind `AUTO_DEEP_ENRICHMENT=true`, off by default.
- Reader redesign, artifact version-history UI, or broad polish before runtime gates pass.

### Assumptions To Verify Before Editing

- Draft currently skips `agent.generate()` but still calls full `stream*Artifact` paths.
- `commit_artifact_section` supersede-by-revision is already covered by `20260525_commit_artifact_section_allow_revision_supersede.sql`.
- `/orchestrate` already accepts `executionMode` and optional `zones`.
- `/rerun-section` already defaults reruns to deep.
- Audit state already prefers active run, then committed section run.

## Architecture References

### Read First

- `AGENTS.md`.
- `docs/handoffs/2026-05-15-fast-drafts-deep-enrichment.md`.
- `docs/research-v2-e2e-brutal-findings-2026-05-15.md`.
- `docs/architecture/2026-05-14-positioning-audit-stack.md`.
- `docs/adr/0002-single-structured-output-per-section.md`.

### External References To Attach

- https://www.aihero.dev/vercel-ai-sdk-tutorial
- https://www.aihero.dev/streaming-objects-with-vercel-ai-sdk
- https://www.aihero.dev/agents-with-vercel-ai-sdk
- https://www.aihero.dev/ai-engineer-roadmap
- https://www.aihero.dev/what-are-evals
- https://www.aihero.dev/how-to-choose-an-llm
- https://www.aihero.dev/how-to-improve-your-llm-powered-app
- https://vercel.com/docs/ai-sdk
- https://ai-sdk.dev/docs/agents
- https://ai-sdk.dev/docs/ai-sdk-core/telemetry

## Hard Rules

- Do not bypass `SectionContextPack`.
- Do not inject full raw corpus into section prompts.
- Do not let draft mode emit full typed section artifacts.
- Do not rely on prompt text alone for tool budgets.
- Do not hardcode Anthropic model strings in touched runner paths.
- Do not commit after timeout or abort.
- Do not overwrite a newer artifact revision from stale deep enrichment.
- Do not hide capability gaps or evidence gaps.
- Do not start broad UI polish until runtime eval gates pass.

## Execution Order

### Phase 1: Preflight

Deliverables:

- Run `git status --short --branch`.
- Search current draft/deep, timeout, commit, and eval paths.
- Confirm exact tests to extend before code edits.

Verification:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git status --short --branch
rg -n "executionMode|draft|deep|agent.generate|streamObject|POSITIONING_DRAFT_TIMEOUT_MS|commitArtifactSection|readCurrentArtifactSection" research-worker/src src/app/api/research-v2 src/components/research-v2
```

Pass condition:

- The executor can name the exact current draft path, deep path, timeout owner, commit owner, and tests to extend before editing code.

### Phase 2: Thin Draft Schema

Deliverables:

- Add `PositioningSectionDraftSchema` in a focused worker schema module.
- Required fields: `schemaVersion`, `artifactLayer: "draft"`, `sectionId`, `sectionTitle`, `verdict`, `statusSummary`, `coreThesis`, `findings`, `evidenceGaps`, `sources`, `confidence`, `recommendedDeepFillTargets`.
- Add draft validation and markdown formatter.

Expected file targets:

- `research-worker/src/runners/positioning-subagent-runner.ts`.
- New focused worker schema/formatter module if it keeps the runner smaller.
- Focused runner tests under `research-worker/src/runners/__tests__/`.

Pass condition:

- Draft schema is narrow enough that it cannot accidentally require the full section subsection arrays.
- Tests can identify draft schema usage separately from full section schemas.

### Phase 3: Draft Runtime Path

Deliverables:

- Route `executionMode === "draft"` from serialized `SectionContextPack` directly to `streamObject(PositioningSectionDraftSchema)`.
- No `agent.generate`, no tools, no full section validators.
- Persist `data.artifactLayer = "draft"` and keep row status `complete`.

Expected file targets:

- `research-worker/src/runners/positioning-subagent-runner.ts`.
- `research-worker/src/runners/positioning/index.ts` if mode plumbing needs adjustment.
- `research-worker/src/supabase.ts` only if commit patch shaping needs draft metadata handling.

Tests:

- Draft mode calls `streamObject(PositioningSectionDraftSchema)`.
- Draft mode never calls `agent.generate`.
- Draft mode never passes full section schemas.
- Draft result persists as a complete artifact with `data.artifactLayer = "draft"`.

### Phase 4: Deep Mode Preservation

Deliverables:

- Keep full schema generation in deep mode.
- Ensure budgeted filtered tools are runtime-enforced.
- Confirm deep commits read current revision and conflict safely if stale.

Expected file targets:

- `research-worker/src/agents/subagents/index.ts`.
- `research-worker/src/agent-tools`.
- `research-worker/src/runners/positioning-subagent-runner.ts`.
- `research-worker/src/index.ts`.
- `research-worker/src/supabase.ts`.
- `research-worker/src/db/artifact-runs.ts`.

Tests:

- Deep mode still uses full schema path.
- Disallowed tools are not exposed.
- `maxExternalLookups` is enforced in runtime code.
- A stale deep commit does not overwrite a newer revision.

### Phase 5: Timings And Timeout

Deliverables:

- Add `runtimeTimings` to section telemetry.
- Track `sectionStartedAt`, `firstPartialAt`, `finalObjectAt`, `validationCompleteAt`, `timeoutFiredAt`, `abortSignalObservedAt`, `commitStartedAt`, `commitCompleteAt`, `terminalStatusWrittenAt`.
- Replace delayed timeout settlement with an abort race that prevents late commits.

Expected file targets:

- `research-worker/src/runners/positioning-audit-orchestrator.ts`.
- `research-worker/src/db/artifact-runs.ts`.
- `research-worker/src/index.ts`.
- `src/app/api/research-v2/audit-state/route.ts`.

Tests:

- Timeout during stream prevents commit.
- Timeout during validation prevents commit.
- Timeout just before commit prevents commit.
- Late runner settlement after timeout cannot commit.
- Terminal telemetry contains timeout and abort timing.

### Phase 6: Concurrency And Models

Deliverables:

- Add `MODELS.DRAFT`, defaulting to `MODEL_DRAFT ?? MODELS.STANDARD`.
- Use draft concurrency default `6`.
- Use deep concurrency default `3`.
- Preserve env overrides.

Expected file targets:

- `research-worker/src/models.ts`.
- `research-worker/src/index.ts`.
- `research-worker/src/runners/positioning-audit-orchestrator.ts`.
- Existing worker tests around execution mode/concurrency.

Tests:

- Draft mode default model resolves through `MODELS.DRAFT`.
- Draft orchestration defaults to one wave of six sections.
- Deep orchestration default remains bounded to three.

### Phase 7: Runtime Evals

Deliverables:

- Add worker scripts: `eval:draft:sla`, `eval:draft:matrix`, `eval:draft:quality`.
- Gate on first partial under 15s, section draft under 90s, all six under 3 minutes, timeout terminal write under 10s, zero post-timeout commits.
- Run Haiku vs Sonnet on Fellow plus one second company fixture.

Expected file targets:

- `research-worker/evals/`.
- `research-worker/package.json`.
- Shared eval fixture/helpers if needed.

Pass condition:

- Eval output includes timing table, model comparison, quality verdict, and pass/fail for every SLA.
- Draft default model is not changed away from Sonnet unless the matrix proves Haiku meets latency, pass rate, grounding, usefulness, and cost requirements.

### Phase 8: Minimal UI Projection

Deliverables:

- Expose draft/deep state, timing, confidence, evidence gaps, and Deepen where current UI already supports it.
- Do not add version-history UI in this slice.

Expected file targets:

- `src/app/api/research-v2/audit-state/route.ts`.
- `src/components/research-v2/agent-artifact-surface.tsx`.
- Existing adjacent component tests.

Tests:

- Audit state projects draft/deep mode and runtime timing telemetry.
- `agent-artifact-surface` shows Deepen for committed draft sections.
- UI does not claim broad version history or background polish.

## Verification Matrix

Run from `/Users/ammar/Dev-Projects/AI-GOS/research-worker`:

```bash
npm run test:run
npm run build
npm run eval:draft:sla
npm run eval:draft:matrix
npm run eval:draft:quality
```

Run from `/Users/ammar/Dev-Projects/AI-GOS`:

```bash
npm run test:run -- src/app/api/research-v2/audit-state src/components/research-v2
npm run lint
npm run build
```

Pass condition:

- All focused tests pass.
- Worker build passes.
- Root lint/build pass, or blockers are reported with exact unrelated failure evidence.
- Eval output includes timing table, model comparison, quality verdict, and pass/fail for every SLA.

Failure handling:

- If a verification command fails because of unrelated pre-existing repo state, capture the exact error, keep focused tests/evals running where possible, and report the blocker with evidence.
- If a failure is inside this slice, fix it before moving to the final report.

## Final Report Format

Return:

- Files changed.
- Tests added/updated.
- Commands run with pass/fail results.
- Draft SLA results.
- Haiku vs Sonnet matrix decision.
- Quality eval summary.
- Deviations from handoff.
- Blockers with exact evidence.
- Follow-up cleanup only after runtime gates pass.
