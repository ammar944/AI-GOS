# Lab Signoff Hardening Design

Date: 2026-06-01
Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
Branch: `feat/v2-lab-section-wire`

## Context

The latest single-run ramp.com signoff produced:

- Run ID: `f7ce1ccb-24fb-4492-a131-556139704077`
- Artifact ID: `38a61be2-e26f-4f74-8f9b-71e80f5d92bd`
- Gates before the paid run: `tsc`, `lint`, `test:run`, app build, and worker build passed.
- B1: pass.
- B2: partial. The UI showed drafting/partial state, but logs recorded structured-stream fallback and realtime broadcast `ECONNRESET`.
- B3: pass. CompetitorLandscape committed real ad creatives.
- T2: pass. Completed sections had `error=null`.
- VoC: fail. `positioningVoiceOfCustomer` ended `status=error` with `body.painLanguage.quotes: need >=3 distinct sources, have 1`.
- B4: fail. CompetitorLandscape completed in about `186.8s`, and repair events persisted.

The handoff decision tree says a VoC structural failure is a stop condition. The user has authorized continuing into research, design, and implementation, with a strong preference for complete engineering fixes over narrow patches.

## Goals

1. Make Voice of Customer source acquisition deterministic enough to satisfy the existing independent-source validators without weakening them.
2. Prevent duplicate lab section jobs from running the same section row and inflating repairs, tool calls, latency, and conflicting terminal writes.
3. Preserve real competitor ad creative yield while making deterministic ad-prepass evidence visible to the verifier.
4. Contain transient realtime partial-broadcast failures so streaming interruptions do not surface as unhandled rejections.
5. Keep paid-run verification bounded: no paid loop, no source edits during live runs, one fresh signoff run after local gates.

## Non-Goals

- Do not relax the VoC minimums or self-sourcing guard.
- Do not weaken the fabrication/provenance verifier.
- Do not apply migrations to the live Supabase project without explicit user authorization.
- Do not port LinkedIn or Foreplay ad adapters in this wave; B3 passed with Google/Meta evidence.
- Do not do broad UI redesign or onboarding changes.
- Do not push, deploy, or apply the T1 event index migration as part of this local hardening wave.

## Selected Approach

Implement a four-part hardening wave:

1. Deterministic VoC evidence prepass.
2. Atomic section-run claim before scheduling.
3. Ad-prepass verifier provenance.
4. Realtime partial broadcast failure containment.

This is stronger than prompt-only tuning because it moves load-bearing evidence selection and scheduling correctness into typed, testable code. It is narrower than a full competitor grounding rewrite because the latest run proved B3 yield and exposed two lower-risk B4 root causes: duplicate jobs and verifier invisibility for deterministic ad evidence.

## Architecture

### 1. VoC Evidence Prepass

Create a small, pure candidate-planning and filtering unit for Voice of Customer evidence.

Responsibilities:

- Derive the audited company's registrable domain from `researchInput.company.websiteUrl`.
- Normalize candidate URLs to registrable domains.
- Reject the audited company's own domain and subdomains.
- Keep third-party review/forum URLs even when the path or title mentions the audited company.
- Deduplicate candidates by URL.
- Select a bounded candidate pack only when the candidate set includes at least three independent registrable domains.
- Expose explicit gap metadata when fewer than three independent domains are available.

Boundaries:

- Candidate pack max size: 12 candidates.
- Minimum independent domains for a usable pack: 3.
- Minimum candidates for a usable pack: 6, so the model has enough material to produce 10 pain quotes without majority-source collapse.
- Per-domain cap: 4 candidates.
- Ranking priority: review/forum evidence with concrete snippet or quote text first, then review/forum URLs without quote text, then broader third-party articles only when they discuss buyer pain or objections.
- Source priority: `reviews` results, then existing `researchInput.sourceExcerpts`, then targeted `web_search`, then `firecrawl` for quote recovery only.
- Lookup budget: do not increase VoC `maxExternalLookups` in this wave. The prepass may use at most three targeted lookup calls before the structured attempt, leaving at least two generic calls for the model. `firecrawl` may consume one of those three calls only for a selected third-party candidate, never for the audited company's own domain.

The runner must build this candidate pack before the VoC structured body attempt and include it in the VoC prompt as a dedicated evidence block. The prompt must instruct the model to use the candidate pack for `body.painLanguage.quotes[]` and top-level `sources`, and to avoid audited-company domains entirely for pain quotes.

The first implementation must use existing tool surfaces and corpus excerpts rather than introducing new paid APIs. The candidate pack may include only these source classes:

- `reviews` results for the audited company.
- `web_search` results targeting review/forum surfaces.
- Existing `researchInput.sourceExcerpts` that match VoC surfaces.
- `firecrawl` for quote recovery only when it is one of the three prepass lookup calls and targets a selected third-party candidate URL.

If the prepass finds insufficient independent candidates, the system must fail honestly with a clear validation event instead of fabricating or lowering the validator.

Interface sketch:

```ts
export type VoiceOfCustomerCandidateSource =
  | "reviews"
  | "researchInput"
  | "web_search"
  | "firecrawl";

export interface VoiceOfCustomerCandidate {
  readonly title: string;
  readonly url: string;
  readonly registrableDomain: string;
  readonly source: VoiceOfCustomerCandidateSource;
  readonly snippet: string;
  readonly evidenceKind: "review" | "forum" | "support-thread" | "article";
}

export interface VoiceOfCustomerCandidatePack {
  readonly ok: true;
  readonly subjectRegistrableDomain: string;
  readonly candidates: readonly VoiceOfCustomerCandidate[];
  readonly domainCount: number;
}

export interface VoiceOfCustomerGap {
  readonly ok: false;
  readonly subjectRegistrableDomain: string;
  readonly reason:
    | "insufficient_independent_domains"
    | "insufficient_candidates"
    | "no_review_or_forum_surfaces";
  readonly message: string;
  readonly observedDomains: readonly string[];
  readonly candidateCount: number;
}

export type VoiceOfCustomerCandidateResult =
  | VoiceOfCustomerCandidatePack
  | VoiceOfCustomerGap;
```

When the result is `VoiceOfCustomerGap`, the runner emits the existing `validation-failed` event with `metadata.issues` containing the typed reason and message, then fails the section honestly. It must not call the model for a full VoC draft when the candidate pack cannot satisfy the independent-source floor.

### 2. Atomic Section-Run Claim

The latest evidence shows every base section started twice, while the runner permits only two repair attempts per job. Four CompetitorLandscape repair events indicate duplicate jobs rather than a single long repair loop.

Add a claim step that transitions a section run from `queued` to `running` atomically before scheduling the lab job. Only a successful claim schedules work. Rows already `running`, `complete`, or `error` must not schedule another job unless an explicit rerun path creates or resets a row intentionally.

Required interface:

- A store method such as `claimSectionRun(runId, sectionId): Promise<SectionRunClaimResult>`.
- A SQL/RPC implementation for atomicity. Author the migration locally if the current DB surface lacks the RPC; do not apply it to live Supabase without explicit user authorization.
- `/api/research-v2/orchestrate` and `/api/research-v2/run-lab-section` use the claim result before calling `after()` or equivalent scheduling.

The claim must preserve existing user-visible status semantics. It must not hide genuine section failures.

Interface sketch:

```ts
export type SectionRunClaimStatus =
  | "claimed"
  | "already_running"
  | "already_complete"
  | "already_error"
  | "not_found";

export interface SectionRunClaimResult {
  readonly status: SectionRunClaimStatus;
  readonly runId: string;
  readonly sectionId: SectionId;
  readonly sectionRunId?: string;
  readonly previousStatus?: "queued" | "running" | "complete" | "error";
}
```

Claim semantics:

- `claimed`: the row was `queued` and is now `running`; schedule exactly one lab job.
- `already_running`: skip scheduling and log a duplicate-claim notice.
- `already_complete`: skip scheduling.
- `already_error`: skip scheduling unless the explicit rerun endpoint has reset the row to `queued` first.
- `not_found`: return a clear route/store error with `runId` and `sectionId`.

### 3. Ad-Prepass Verifier Provenance

The deterministic CompetitorLandscape ad prepass produced real creatives, but the verifier only sees model steps and corpus excerpts. After normalized ad evidence is injected into `body.adEvidence`, its creative/detail/landing URLs can appear unsupported and trigger repair.

Change the ad prepass result to retain the underlying `AgentStep[]` in addition to normalized groups and UI events. Include those ad-prepass steps in the structural verifier input for CompetitorLandscape. The model still receives normalized ad evidence; the verifier gets the raw tool results needed to prove those URLs came from actual ad tools.

This preserves the current Google/Meta yield and avoids porting more ad adapters before the existing evidence chain is correct.

### 4. Partial Broadcast Failure Containment

`broadcastSectionPartial` can fail on transient Supabase realtime errors. The latest run logged `ECONNRESET` and unhandled rejections. Partial broadcasts are helpful for B2 user experience, but they are not commit authority.

Make partial broadcast failures best-effort:

- Catch and log failures with structured fields.
- Do not allow a broadcast failure to reject outside the broadcaster queue.
- Keep committed artifact persistence independent from realtime partial delivery.

This makes B2 streaming more robust without changing the persistence model.

## Data Flow

1. `/research-v2` starts the six-section fanout.
2. Orchestration seeds or locates section rows.
3. For each section row, the dispatcher atomically claims `queued -> running`.
4. Only claimed rows schedule lab jobs.
5. CompetitorLandscape runs the deterministic ad prepass and keeps both normalized groups and raw ad-prepass steps.
6. VoC builds a deterministic candidate pack before model drafting.
7. Structured generation receives section-specific evidence guidance.
8. Validation keeps the existing minimum and provenance gates.
9. Structural verifier evaluates model steps plus deterministic ad-prepass steps where applicable.
10. Partial broadcast failures are logged but do not affect commit.
11. Commit writes completed artifacts with `error=null`; genuine failures remain `status=error`.

## Error Handling

- VoC candidate insufficiency is a typed/gap failure, not a fallback to weak sources.
- Duplicate-claim failure is a skip, not an error, when another job already owns the row.
- A claim conflict should emit a low-noise event/log field with `runId`, `sectionId`, and current status.
- Ad-prepass tool gaps remain explicit data gaps in `adEvidence`.
- Realtime partial broadcast errors are logged with `runId`, `sectionId`, sequence metadata if available, and error message.
- No catch-all handler should swallow terminal section errors.

## Testing Strategy

### Unit Tests

- VoC candidate filtering rejects audited-company domains and subdomains.
- VoC candidate filtering keeps third-party review/forum domains whose path mentions the audited company.
- VoC candidate selection returns `VoiceOfCustomerCandidatePack` only with at least three independent domains.
- VoC candidate selection returns a typed insufficiency result when only one or two domains are available.
- Ad-prepass verifier input includes deterministic ad tool results, so injected ad creative URLs are supported.
- Broadcast wrapper catches a simulated fetch failure and does not throw an unhandled rejection.

### Integration Tests

- Orchestration duplicate calls do not schedule duplicate jobs for the same `runId` and `sectionId`.
- Existing rerun behavior still schedules intentionally reset/rerun rows.
- A fake VoC runner path with a valid candidate pack passes `validateVoiceOfCustomerMinimums` and `checkVoiceOfCustomerSelfSourcing`.
- CompetitorLandscape still commits real ad evidence when ad tools return creatives and gaps.

### Local Gates

Run after implementation:

```bash
npx tsc --noEmit
npm run lint
npm run test:run
npm run build
cd research-worker && npm run build
```

### Behavioral Verification

After local gates pass, run exactly one fresh ramp.com signoff. Do not edit source while it runs.

Expected pass criteria:

- VoC commits `status=complete` with at least five top-level sources.
- VoC pain quotes include at least ten quotes from at least three independent domains.
- No pain quote uses `ramp.com` or a Ramp subdomain.
- CompetitorLandscape still renders real ad creatives.
- There is exactly one `section-started` event for each of the six base positioning zones.
- CompetitorLandscape has no more than two `repair-started` events, matching the single-job repair cap.
- CompetitorLandscape no longer reports injected ad creative/detail/landing URLs as unsupported solely because they came from deterministic ad prepass output.
- CompetitorLandscape elapsed time is below the old duplicated-run baseline of `186.8s`; if external APIs are slow, the report must separate duplicate-job elimination from provider latency.
- Completed sections have `error=null`.
- B1 live feed and B2 drafting-to-card behavior still work.

## Risks And Mitigations

- Risk: VoC prepass consumes too much lookup budget.
  - Mitigation: keep the pack bounded, prefer existing corpus/review results, and only firecrawl selected candidates when needed.

- Risk: Atomic claim requires a migration.
  - Mitigation: author the migration locally if the SQL function is absent, but do not apply it to live Supabase without explicit user authorization. Keep a fallback store test for the intended behavior.

- Risk: Verifier still flags ad landing URLs that are nested too deeply in tool results.
  - Mitigation: add a focused test fixture around the actual normalized ad result shape before changing verifier wiring.

- Risk: Broadcast containment hides a real streaming regression.
  - Mitigation: log structured warnings and keep UI/DB verification in the signoff report.

## Rollout Plan

1. Commit this design.
2. Write a detailed implementation plan.
3. Implement in small commits:
   - VoC prepass and tests.
   - Atomic claim and tests.
   - Ad-prepass verifier evidence and tests.
   - Broadcast containment and tests.
4. Run full local gates.
5. Run one fresh ramp.com signoff only after gates pass.
6. Report pass/fail with run ID, artifact ID, DB summary, screenshots, and any remaining gated follow-ups.
