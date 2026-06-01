# Lab Signoff Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining ramp.com signoff failures without weakening evidence gates: make VoC source acquisition validator-compatible, prevent duplicate lab section jobs, expose deterministic ad-prepass evidence to the verifier, and contain realtime partial broadcast failures.

**Architecture:** Keep the existing Next.js in-process lab engine and Supabase persistence model. Add typed, testable helpers around evidence candidate selection, section-run claiming, verifier provenance, and partial broadcast error isolation. Do not port new ad providers, relax validators, push, deploy, or apply live migrations in this wave.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Vercel AI SDK v6, Supabase/Postgres, Clerk, Vitest. Root gates: `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build`; worker gate: `cd research-worker && npm run build`.

---

## Context

Latest signoff run:

- Run ID: `f7ce1ccb-24fb-4492-a131-556139704077`
- Artifact ID: `38a61be2-e26f-4f74-8f9b-71e80f5d92bd`
- VoC failed before commit because `body.painLanguage.quotes` had too few independent sources.
- CompetitorLandscape committed real ad creatives, so B3 is not the active blocker.
- CompetitorLandscape still had old-baseline latency and repair events.
- The UI showed live partial drafting, but logs recorded structured-stream fallback and a realtime partial broadcast `ECONNRESET`.

Reference spec: `docs/superpowers/specs/2026-06-01-lab-signoff-hardening-design.md`.

## Operating Rules

- [ ] Work in `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`.
- [ ] Do not revert or edit unrelated dirty files.
- [ ] Do not print `.env` contents or secrets.
- [ ] Do not apply Supabase migrations to the live project without explicit user approval.
- [ ] Do not run repeated paid E2E loops. After local gates pass, run exactly one new ramp.com signoff.
- [ ] Do not edit source while the paid signoff run is active.
- [ ] Commit each completed task atomically before starting the next implementation task.

## Task 0 - Baseline And Ownership

**Objective:** Confirm current code shape, record baseline status, and keep later changes scoped.

- [ ] Read `AGENTS.md`, `docs/2026-06-01-remaining-tasks-codex-handoff.md`, and the design spec.
- [ ] Record `git status --short` before implementation and identify pre-existing dirty files.
- [ ] Inspect these files before editing to confirm current line shapes:
  - [ ] `src/lib/lab-engine/agents/run-section.ts`
  - [ ] `src/lib/lab-engine/agents/tools/reviews.ts`
  - [ ] `src/lib/lab-engine/agents/tool-registry.ts`
  - [ ] `src/lib/lab-engine/agents/budget.ts`
  - [ ] `src/lib/research-v2/lab-section-dispatch.ts`
  - [ ] `src/lib/research-v2/orchestrate-db.ts`
  - [ ] `src/lib/research-v2/supabase-run-store.ts`
  - [ ] `src/lib/research-v2/section-partial-broadcaster.ts`
  - [ ] `src/lib/research-v2/realtime-broadcast.ts`
  - [ ] `supabase/migrations/20260530_seed_orchestration_return_status.sql`
- [ ] Run a cheap focused baseline if time allows:
  - [ ] `npm run test:run -- src/lib/research-v2/__tests__/section-partial-broadcaster.test.ts src/lib/lab-engine/agents/__tests__/run-section-artifact-streaming.test.ts`
- [ ] Commit only if documentation or baseline notes were intentionally changed; otherwise leave Task 0 uncommitted.

## Task 1 - VoC Candidate Pack

**Objective:** Make Voice of Customer pain-language evidence acquisition deterministic before model drafting, while keeping existing validators strict.

### Files

- [ ] Add `src/lib/lab-engine/agents/voice-of-customer-candidates.ts`.
- [ ] Add `src/lib/lab-engine/agents/__tests__/voice-of-customer-candidates.test.ts`.
- [ ] Modify `src/lib/lab-engine/agents/run-section.ts`.
- [ ] Modify the prompt helper in `src/lib/lab-engine/agents/build-prompts.ts` only if `run-section.ts` delegates prompt construction there for this path.
- [ ] Extend existing runner tests in `src/lib/lab-engine/agents/__tests__/run-section-artifact-streaming.test.ts` or add a narrower test file beside it.

### Types And Pure Helpers

- [ ] Define named exported types:
  - [ ] `VoiceOfCustomerCandidateSource = "reviews" | "researchInput" | "web_search" | "firecrawl"`.
  - [ ] `VoiceOfCustomerEvidenceKind = "review" | "forum" | "support-thread" | "article"`.
  - [ ] `VoiceOfCustomerCandidate`.
  - [ ] `VoiceOfCustomerCandidatePack`.
  - [ ] `VoiceOfCustomerGap`.
  - [ ] `VoiceOfCustomerCandidateResult`.
- [ ] Define named exported constants:
  - [ ] `VOC_CANDIDATE_PACK_MAX_SIZE = 12`.
  - [ ] `VOC_CANDIDATE_MIN_DOMAINS = 3`.
  - [ ] `VOC_CANDIDATE_MIN_COUNT = 6`.
  - [ ] `VOC_CANDIDATE_PER_DOMAIN_CAP = 4`.
  - [ ] `VOC_PREPASS_MAX_LOOKUPS = 3`.
- [ ] Implement `getRegistrableDomain(input: string): string | null`.
  - [ ] Accept full URLs, hostnames, and bare domains.
  - [ ] Lowercase and strip `www.`.
  - [ ] Handle common public suffix cases in tests without adding a dependency: at minimum `co.uk` and `com.au`.
  - [ ] Return `null` for invalid inputs.
- [ ] Implement `createVoiceOfCustomerCandidate(...)` as a pure normalizer.
  - [ ] Reject candidates whose registrable domain equals the audited company registrable domain.
  - [ ] Keep third-party review/forum domains even when their path contains the audited company name.
  - [ ] Reject empty URLs and empty snippets.
- [ ] Implement `selectVoiceOfCustomerCandidates(...)`.
  - [ ] Deduplicate by normalized URL.
  - [ ] Rank `review`, `forum`, and `support-thread` evidence before `article`.
  - [ ] Apply `VOC_CANDIDATE_PER_DOMAIN_CAP`.
  - [ ] Return `ok: true` only when at least three independent registrable domains and at least six candidates remain.
  - [ ] Return typed gaps for `no_review_or_forum_surfaces`, `insufficient_independent_domains`, or `insufficient_candidates`.
- [ ] Implement `formatVoiceOfCustomerCandidateBlock(result: VoiceOfCustomerCandidateResult): string`.
  - [ ] Include URL, registrable domain, evidence kind, source surface, and snippet.
  - [ ] For gaps, include the typed reason and observed domains for logging and prompts.

### Tests First

- [ ] Add failing tests for `getRegistrableDomain`:
  - [ ] `reviews.g2.com/products/ramp/reviews` does not collapse to `ramp.com`.
  - [ ] `uk.example.co.uk` returns `example.co.uk`.
  - [ ] `vendor.com.au` returns `vendor.com.au`.
  - [ ] invalid input returns `null`.
- [ ] Add failing tests for audited-domain rejection:
  - [ ] `ramp.com`, `www.ramp.com`, and `support.ramp.com` are rejected for subject `ramp.com`.
  - [ ] `g2.com/products/ramp/reviews` and `trustpilot.com/review/ramp.com` are kept for subject `ramp.com`.
- [ ] Add failing tests for pack selection:
  - [ ] Three domains and at least six candidates returns `ok: true`.
  - [ ] Two domains returns `insufficient_independent_domains`.
  - [ ] Three domains but fewer than six candidates returns `insufficient_candidates`.
  - [ ] Article-only candidates return `no_review_or_forum_surfaces`.
- [ ] Add failing runner integration tests:
  - [ ] A valid VoC candidate pack is built before the full structured model draft call.
  - [ ] The VoC structured prompt includes the formatted candidate evidence block.
  - [ ] The prepass consumes no more than three combined tool calls across `reviews`, `web_search`, and `firecrawl`.
  - [ ] The prepass tool calls decrement the same section budget used for model-directed external tools.
  - [ ] A candidate gap emits `validation-failed`, fails the VoC section with a contextual error, and does not call the full structured model draft.

### Runner Integration

- [ ] Add a VoC-only prepass before the structured body model attempt in `run-section.ts`.
- [ ] Use only existing evidence surfaces:
  - [ ] Existing `researchInput.corpus.sectionExcerpts?.positioningVoiceOfCustomer` when present.
  - [ ] Existing fallback `researchInput.corpus.excerpts`.
  - [ ] `reviews` tool for the audited brand.
  - [ ] Targeted `web_search` for review/forum surfaces.
  - [ ] `firecrawl` only for quote recovery from a selected third-party candidate URL.
- [ ] Count prepass calls against the existing VoC `SectionToolBudget`.
  - [ ] Maximum prepass tool calls is three.
  - [ ] The three calls are a combined cap across `reviews`, `web_search`, and `firecrawl`.
  - [ ] Execute prepass tool calls through the same wrapped tool map or shared budget API used by model-directed tools; do not call raw tool implementations in a way that bypasses budget accounting.
  - [ ] Do not raise `maxExternalLookups`; leave at least two generic lookups available for model-directed work.
- [ ] Prefer call order:
  - [ ] `reviews` first.
  - [ ] one targeted `web_search` for third-party review/forum surfaces.
  - [ ] one `firecrawl` only if a selected third-party URL lacks extractable quote text and budget remains.
- [ ] Append the candidate evidence block to the VoC prompt with explicit instruction:
  - [ ] Use the candidate pack for `body.painLanguage.quotes[]`.
  - [ ] Use at least three independent domains for pain quotes.
  - [ ] Do not use the audited company's own domain for pain quotes.
  - [ ] Keep top-level `sources` aligned with the independent candidate URLs.
- [ ] If the prepass returns a gap:
  - [ ] Emit the existing `validation-failed` event with `metadata.issues` containing reason, message, observed domains, and candidate count.
  - [ ] Fail the section honestly before requesting a full VoC draft.
  - [ ] Include `runId`, `sectionId`, and subject domain in the error message.
- [ ] Keep `validateVoiceOfCustomerMinimums` and `checkVoiceOfCustomerSelfSourcing` unchanged except for tests that prove the prepass feeds them better data.
- [ ] Verify in the final diff that neither `validateVoiceOfCustomerMinimums` nor `checkVoiceOfCustomerSelfSourcing` was weakened or relaxed.

### Verification

- [ ] Run `npm run test:run -- src/lib/lab-engine/agents/__tests__/voice-of-customer-candidates.test.ts`.
- [ ] Run the focused runner tests touched by this task.
- [ ] Run `npx tsc --noEmit`.
- [ ] Commit: `fix(lab): add deterministic VoC evidence candidate pack`.

## Task 2 - Atomic Section-Run Claim

**Objective:** Ensure only one lab job owns each queued section row, eliminating duplicate section starts and duplicated repair storms.

### Files

- [ ] Add `src/lib/research-v2/section-run-claim.ts` or place the helper in `src/lib/research-v2/orchestrate-db.ts` if that matches local style better.
- [ ] Add or update tests under `src/lib/research-v2/__tests__/`.
- [ ] Modify `src/lib/research-v2/lab-section-dispatch.ts`.
- [ ] Modify `src/app/api/research-v2/orchestrate/route.ts` if it still has direct scheduling behavior that must be claim-aware or if its kickoff response handling must distinguish duplicate-claim skips.
- [ ] Modify `src/app/api/research-v2/run-lab-section/route.ts` only if response shape or dispatch result typing requires it.
- [ ] Modify `src/app/api/research-v2/rerun-section/route.ts` only if explicit rerun reset needs to claim after reset.
- [ ] Add local migration `supabase/migrations/20260601_claim_section_run.sql`.

### Claim Types

- [ ] Define named exports:
  - [ ] `SectionRunClaimStatus = "claimed" | "already_running" | "already_complete" | "already_error" | "not_found"`.
  - [ ] `SectionRunClaimResult`.
- [ ] Include `runId`, `sectionId`, optional `sectionRunId`, and optional `previousStatus` in the result.
- [ ] Parse and validate RPC rows with a narrow local schema or explicit type guard. Do not use `any`.

### Migration

- [ ] Inspect existing migrations and current table column names before writing SQL.
- [ ] Create `claim_section_run(p_run_id uuid, p_section_id text)`.
- [ ] Atomically update only rows currently `queued` to `running`.
- [ ] Return `claimed` when the update succeeds.
- [ ] Return `already_running`, `already_complete`, or `already_error` for existing rows with those states.
- [ ] Return `not_found` when no matching section row exists for `runId` and `sectionId`.
- [ ] Set `started_at` only when claiming if the column exists; update `updated_at` only if the table has that column.
- [ ] Grant execute to the same roles as nearby orchestration RPCs.
- [ ] Do not apply this migration to the live Supabase project in this task.

### Dispatch Integration

- [ ] Keep orchestration seeding as the source of section rows.
- [ ] Call the claim helper inside `scheduleLabSectionJob` after seeding/store creation and before scheduling `runLabSectionJob`.
- [ ] Schedule only on `status === "claimed"`.
- [ ] Ensure `/api/research-v2/orchestrate` remains claim-compatible:
  - [ ] Its queued-status filtering may stay as a first-layer optimization.
  - [ ] It must not directly schedule work outside the claim-aware `run-lab-section` path.
  - [ ] Duplicate kickoffs that race past the route filter must be owned or skipped by the claim in `scheduleLabSectionJob`.
- [ ] For `already_running`, `already_complete`, and `already_error`, skip scheduling and emit a structured low-noise log/event with `runId`, `sectionId`, and status.
- [ ] For `not_found`, throw a specific error that includes `runId` and `sectionId`.
- [ ] Preserve explicit rerun behavior:
  - [ ] The rerun endpoint must reset or create a new queued row first.
  - [ ] The rerun path then claims the queued row and schedules exactly one job.
- [ ] Do not rely on `/api/research-v2/orchestrate` filtering alone for correctness; the claim is the authoritative guard.

### Tests First

- [ ] Add a unit test for the claim result parser/type guard.
- [ ] Add a dispatcher test where claim returns `claimed` and `runLabSectionJob` is scheduled exactly once.
- [ ] Add a dispatcher test where claim returns `already_running` and no job is scheduled.
- [ ] Add a dispatcher test where claim returns `already_complete` and no job is scheduled.
- [ ] Add a dispatcher test where claim returns `already_error` and no job is scheduled.
- [ ] Add a dispatcher test where claim returns `not_found` and the caller gets a contextual error.
- [ ] Add or update route tests to prove the observable duplicate behavior:
  - [ ] concurrent or repeated kickoff attempts for the same `runId` and `sectionId` result in exactly one scheduled `runLabSectionJob`.
  - [ ] the non-owning attempt receives or records `already_running` and skips scheduling.
  - [ ] the response remains non-terminal/idempotent for the duplicate request.
- [ ] Add or update rerun tests to prove intentional reruns still schedule after reset.

### Verification

- [ ] Run the affected route and dispatch tests.
- [ ] Run `npx tsc --noEmit`.
- [ ] Commit: `fix(research-v2): claim lab section rows before scheduling`.

## Task 3 - Ad-Prepass Verifier Provenance

**Objective:** Make deterministic CompetitorLandscape ad evidence visible to structural verification so valid injected creative URLs do not trigger avoidable repairs.

### Files

- [ ] Modify `src/lib/lab-engine/agents/run-section.ts`.
- [ ] Extend tests in `src/lib/lab-engine/agents/__tests__/run-section-artifact-streaming.test.ts` or add a narrower verifier integration test.
- [ ] Modify `src/lib/lab-engine/agents/verification/structural-verifier.ts` only if a type extension is required; prefer feeding existing `AgentStep[]` shape.

### Implementation

- [ ] Change `buildAnswerToolAdEvidence` return type to include `adProbeSteps: readonly AgentStep[]`.
- [ ] Populate `adProbeSteps` from deterministic ad tool outputs that generated `normalizedAdEvidenceGroups`.
- [ ] Build verifier input from model steps plus deterministic ad-prepass steps for CompetitorLandscape.
- [ ] Keep the model prompt's normalized ad evidence block unchanged unless the existing code already centralizes verifier and prompt evidence together.
- [ ] Do not fabricate or synthesize tool results. The verifier must see real tool outputs only.
- [ ] Preserve persisted `adEvidence` output and UI events.
- [ ] Preserve B3 behavior: real ad creatives still render from `body.adEvidence.advertiserGroups`.

### Tests First

- [ ] Add a failing test where an ad creative URL exists only in deterministic ad-prepass tool output and in the final `body.adEvidence`.
- [ ] Prove the structural verifier treats that URL as supported once `adProbeSteps` are included.
- [ ] Add or preserve a negative assertion that unsupported non-ad URLs still fail provenance.
- [ ] Run the existing CompetitorLandscape/ad evidence tests to prove no regression in creative normalization.

### Verification

- [ ] Run focused lab-engine tests.
- [ ] Run `npx tsc --noEmit`.
- [ ] Commit: `fix(lab): include ad prepass steps in verifier evidence`.

## Task 4 - Partial Broadcast Failure Containment

**Objective:** Make realtime partial broadcasts best-effort so transient Supabase realtime failures cannot surface as unhandled rejections or corrupt committed artifacts.

### Files

- [ ] Modify `src/lib/research-v2/section-partial-broadcaster.ts`.
- [ ] Modify `src/lib/research-v2/realtime-broadcast.ts`.
- [ ] Extend `src/lib/research-v2/__tests__/section-partial-broadcaster.test.ts`.
- [ ] Add or extend realtime broadcast tests if an existing test file exists.

### Implementation

- [ ] In `section-partial-broadcaster.ts`, ensure `publish(payload)` is invoked inside the serialized promise chain, or attach an immediate catch before any rejection can become unhandled.
- [ ] Ensure `flush()` resolves after the queue drains even when individual partial publish attempts fail.
- [ ] Call `onError` exactly once per failed publish.
- [ ] Keep queue ordering for successful publishes.
- [ ] In `realtime-broadcast.ts`, wrap network/fetch failures in `RealtimeBroadcastError` with structured context:
  - [ ] topic or channel name.
  - [ ] `runId`.
  - [ ] `sectionId`.
  - [ ] payload sequence metadata if available.
  - [ ] original error message.
- [ ] Do not make partial broadcast success a prerequisite for artifact commit.

### Tests First

- [ ] Add a failing test where `publish` rejects before the prior queued publish resolves; assert no unhandled rejection and `flush()` resolves.
- [ ] Add a failing test where two publish failures call `onError` twice with contextual errors.
- [ ] Preserve existing throttle/flush tests.
- [ ] Add a test for fetch rejection wrapping if the module has an existing test seam; otherwise keep this covered by a direct helper-level test.

### Verification

- [ ] Run `npm run test:run -- src/lib/research-v2/__tests__/section-partial-broadcaster.test.ts`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Commit: `fix(research-v2): contain realtime partial broadcast failures`.

## Task 5 - Full Local Gates

**Objective:** Prove the full local codebase is green before spending on a new paid signoff run.

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.
- [ ] Run `cd research-worker && npm run build`.
- [ ] If a gate fails, fix the root cause in the relevant task area and re-run the failed gate.
- [ ] Do not start the live signoff until all gates pass.
- [ ] Commit any gate-only fix atomically with a precise message.

## Task 6 - One Fresh ramp.com Signoff

**Objective:** Behaviorally verify the fixes on exactly one new paid run.

- [ ] Start or reuse `npm run dev` on an available localhost port.
- [ ] Open `/research-v2` in an authenticated browser session.
- [ ] Run one audit for `ramp.com`.
- [ ] Do not edit source while the run is active.
- [ ] Capture run ID and artifact ID.
- [ ] Save screenshots for:
  - [ ] six-zone fanout.
  - [ ] live drafting state.
  - [ ] CompetitorLandscape complete with real ad creatives.
  - [ ] VoC complete or failure state.
  - [ ] final artifact state.
- [ ] Query DB or available local evidence for:
  - [ ] VoC section run status.
  - [ ] VoC `source_count`.
  - [ ] VoC pain quote source domains.
  - [ ] CompetitorLandscape ad creative count.
  - [ ] section-started event count for each of six base zones.
  - [ ] CompetitorLandscape repair count.
  - [ ] CompetitorLandscape elapsed time.
  - [ ] completed section errors.
  - [ ] realtime partial broadcast errors.
- [ ] Expected pass criteria:
  - [ ] VoC commits `status=complete` with at least five top-level sources.
  - [ ] VoC pain quotes include at least ten quotes from at least three independent domains.
  - [ ] No VoC pain quote uses `ramp.com` or any Ramp subdomain.
  - [ ] CompetitorLandscape still renders real ad creatives.
  - [ ] Exactly one base job owns each of the six base positioning zones.
  - [ ] CompetitorLandscape repair count is no more than the single-job cap of two and ideally no more than one.
  - [ ] CompetitorLandscape elapsed time is materially below the duplicated-job baseline of `186.8s`; if external providers are slow, report duplicate-job elimination separately from provider latency.
  - [ ] Completed sections have `error=null`.
  - [ ] Partial broadcast failures, if any, are logged and non-terminal.
- [ ] Write a concise signoff report with pass/fail per criterion, run ID, artifact ID, and screenshot paths.
- [ ] Do not run a second paid loop without explicit user approval.

## Final Review

- [ ] Dispatch a spec-compliance reviewer against the full implementation and this plan.
- [ ] Dispatch a code-quality reviewer after spec compliance passes.
- [ ] Fix any blocking review findings.
- [ ] Run the final local gate affected by review fixes.
- [ ] Confirm `git status --short` shows only intentional changes plus pre-existing unrelated dirt.
- [ ] Final response must include:
  - [ ] Commits created.
  - [ ] Gate results.
  - [ ] Signoff run ID and artifact ID if the live run was executed.
  - [ ] Remaining blockers or user-gated steps.
