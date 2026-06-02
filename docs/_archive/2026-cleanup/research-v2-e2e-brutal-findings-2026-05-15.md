# Research V2 E2E Brutal Findings - Fanout Runtime

Date: 2026-05-15  
Run: Fellow, `fbd2b98c-69db-4947-b0ca-85e2704297e6`  
Parent audit artifact: `6b8c87d0-1324-4885-bd84-ad56062d538d`  
Scope: E2E runtime behavior, agent behavior, and UI implications. This is not a source-quality audit.

## Executive Take

The run completed. That is the only comfortable part.

The current section "fanout" is not an interactive product experience yet. It is a heavy background batch job being presented inside a live workspace UI. The backend did real work and persisted all six artifacts, but the user waited about 13 minutes for section research after the first section started. That is too slow unless the product explicitly frames the audit as a background job with clear progress, ETA, and notification behavior.

The product promise cannot be "watch the agent work" while the UI gives vague activity for 13 minutes. Either make the first useful artifact appear much faster, or own the fact that this is a long-running audit.

## What Actually Happened

All timestamps below are UTC from Supabase.

Parent artifact:

| Field | Value |
| --- | --- |
| Created | `2026-05-15T13:48:26.548266+00:00` |
| Completed | `2026-05-15T14:04:13.007+00:00` |
| Parent duration | `15.77 min` |
| Status | `complete` |
| Children | `6/6 complete` |

Section fanout:

| Section | Started | Completed | Duration | Events Written | Markdown Chars |
| --- | --- | --- | ---: | ---: | ---: |
| Market Category | `13:51:05.537` | `13:57:57.762` | `6.87 min` | `487` | `13,015` |
| Competitor Landscape | `13:51:05.540` | `13:57:31.053` | `6.43 min` | `327` | `18,294` |
| Buyer ICP | `13:51:05.541` | `13:57:31.061` | `6.43 min` | `482` | `9,870` |
| Voice of Customer | `13:57:31.707` | `14:02:56.325` | `5.41 min` | `228` | `17,282` |
| Demand Intent | `13:57:31.720` | `14:04:12.661` | `6.68 min` | `404` | `11,651` |
| Offer Diagnostic | `13:57:58.412` | `14:02:20.329` | `4.37 min` | `219` | `14,473` |

The real section-runtime window was:

```text
first section started: 2026-05-15T13:51:05.537+00:00
last section completed: 2026-05-15T14:04:12.661+00:00
elapsed: about 13.12 minutes
```

This was not six sections running fully in parallel. It ran as two waves.

## Brutal Findings

### P0 - "Fanout" Is Misleading Right Now

The orchestrator defaults to concurrency `3`, not `6`.

Code evidence:

- `research-worker/src/index.ts:700` reads `ORCHESTRATOR_CONCURRENCY` with a default of `3`.
- `research-worker/src/runners/positioning-audit-orchestrator.ts:136` falls back to `options.concurrency ?? 3`.

That means the wall-clock runtime is driven by:

```text
slowest section in wave 1 + slowest section in wave 2
```

For this run:

```text
~6.87 min + ~6.68 min = ~13.55 min
```

The observed 13.12 minutes matches that model. The system behaved as coded. The product expectation was wrong.

If we want this to feel like fanout, concurrency should be `6` when rate limits allow. If we cannot safely run six sections at once, the UI must say that sections are queued in waves.

### P0 - The Section Timeout Does Not Cover the Whole Section

The runner defines a four-minute timeout:

- `research-worker/src/runners/positioning-subagent-runner.ts:67`

But the timeout is cleared immediately after `agent.generate()`:

- `research-worker/src/runners/positioning-subagent-runner.ts:2177`

Then the runner starts the structured artifact generation phase:

- `research-worker/src/runners/positioning-subagent-runner.ts:2179`

This means the timeout protects the evidence/tool loop, not the full section. The expensive `streamObject` phase can continue after the four-minute budget. That is a bad runtime contract. A section-level timeout should cover the entire section from start through commit.

This is the most dangerous backend issue from the E2E. The code gives us the feeling that sections have a hard budget, but the slowest and most output-heavy phase is allowed to keep going.

### P0 - Each Section Is Two Expensive Agent Runs in Practice

The system is not doing one short model call per section.

Each section does:

```text
ToolLoopAgent evidence run
  -> transcript capture
  -> streamObject typed artifact generation
  -> validation
  -> possible retry
  -> Supabase commit
```

The prompts explicitly tell the agent it is gathering evidence only and that the runner will convert the transcript later. See `research-worker/src/runners/positioning-subagent-runner.ts:95`.

That architecture can produce better artifacts, but it is expensive. Calling it "fanout section research" hides the actual cost model. It is fanout plus structured synthesis per section.

### P0 - Opus Everywhere Is a Product-Speed Problem

The subagent registry uses `claude-opus-4-6` across the board:

- `research-worker/src/agents/subagents/index.ts:30`
- `research-worker/src/runners/positioning-subagent-runner.ts:61`

That may be defensible for final-quality synthesis. It is not defensible for first visible progress in an operator UI unless the user knows they are waiting for a premium deep audit.

The current product is paying deep-audit latency before giving the user a fast first artifact. That is backwards for perceived product quality.

### P1 - The Event Stream Is Noisy, Costly, and Mostly Thrown Away

This run wrote hundreds of events per section:

- Market Category: `487`
- Buyer ICP: `482`
- Demand Intent: `404`
- Competitor Landscape: `327`
- Voice of Customer: `228`
- Offer Diagnostic: `219`

But the UI route reads only the last 60 events total across all zones:

- `src/app/api/research-v2/audit-state/route.ts:119`
- `src/app/api/research-v2/audit-state/route.ts:124`

So we are writing a large amount of activity data and then deliberately discarding most of it at read time. That is not observability. That is database churn with a small activity preview.

The UI should not need hundreds of partial `streamObject` events. It needs durable, low-cardinality state:

- queued
- running evidence
- structuring artifact
- validating
- committing
- complete
- failed
- retrying

Events should be throttled to subsection boundaries or a 5-10 second cadence, not every partial object update.

### P1 - The UI Does Not Explain the Runtime Honestly

The final UI state looked good: `Audit ready`, `6/6`, all chips complete.

During the run, the UI did not make the real execution model obvious:

- It did not show that only three sections were running at once.
- It did not show that the second wave was queued behind the first.
- It did not show which phase each section was in: evidence, structuring, validation, or commit.
- It did not show an ETA or elapsed time per section.
- It did not explain that a section can spend minutes in structured artifact generation after the evidence loop.

This matters because long-running agent UX lives or dies by trust. If a user waits 13 minutes and cannot tell whether the system is doing useful work, queued, stuck, retrying, or formatting, the product feels broken even when the backend eventually succeeds.

### P1 - Tool Capability Reality Is Still Leaking Into Product Quality

The worker capability endpoint currently reports:

```json
{
  "webSearch": true,
  "spyfu": false,
  "firecrawl": false,
  "googleAds": false,
  "metaAds": false,
  "ga4": false,
  "charting": true
}
```

But the section closing instructions still ask agents to use tool families like `firecrawl`, `spyfu`, `meta_ads`, `google_ads`, `ga4`, and reviews depending on the section.

That is not automatically wrong if the tools return explicit gaps. But product-wise, it is dangerous. A missing integration should be visible as a capability gap, not buried inside agent behavior. Otherwise the UI can imply "full audit" when the runtime is actually doing web search plus structured synthesis with several unavailable specialty tools.

The product needs a visible capability contract:

- "Available in this run"
- "Unavailable because credentials are missing"
- "Unavailable because customer data was not connected"
- "Not used for this section"

### P1 - The Backend Proved Persistence, Not Product Readiness

The successful result proves:

- corpus research completed
- six section runs completed
- normalized section artifacts were committed
- the Audit Reader can render persisted artifacts
- rerunnable section rows exist as a plausible control surface

It does not prove:

- the live run feels trustworthy
- the user understands what the agent is doing
- the product can survive rate limits at concurrency `6`
- the environment is production-clean
- unavailable APIs are communicated clearly
- the system has acceptable first-value latency

The current E2E is a backend milestone, not a product milestone.

### P2 - Local Auth/Environment Hygiene Is Still Polluting QA

The local E2E showed Clerk development/keyless UI interference in the browser. It covered part of the onboarding control area and forced awkward clicking around the UI.

That is not a small annoyance. It means local QA is not exercising the same interaction surface the user will see. Fixing the Clerk publishable key and environment hygiene is required before calling future UI QA clean.

## What Worked

The run should not be dismissed. These are real wins:

- The pipeline completed end to end.
- All six positioning artifacts committed.
- The Audit Reader rendered the final state.
- The worker wrote enough section/event data to diagnose the execution model.
- The normalized artifact path is now useful for product decisions.

But these wins are backend correctness wins. They do not make the product feel finished.

## Product Decision Required

We need to decide what the first-run product promise is.

Option A: Background deep audit.

The UI should say this is a long-running audit, show clear per-section waves, expose ETA, and let the user leave or continue working. Thirteen minutes can be acceptable if framed as "deep audit running" and the system provides confidence the work is progressing.

Option B: Interactive operator workspace.

The first useful artifact needs to appear much faster. The target should be:

```text
first section preview: < 60-90 seconds
all first-draft sections: < 3-5 minutes
deep enrichment: background or on demand
```

The current system is neither cleanly A nor B. It has background-job latency with interactive-workspace expectations.

## Recommended Fix Order

### 1. Make Concurrency Explicit

Set `ORCHESTRATOR_CONCURRENCY=6` in local and production only after checking Anthropic rate limits and cost. If production cannot support six, surface wave-based queueing in the UI.

Expected impact: likely reduces section elapsed time from about 13 minutes to about 6-7 minutes for similar runs.

### 2. Put a Real Timeout Around the Entire Section

The timeout must cover:

```text
agent.generate
streamObject
validation
retry
commit
```

If the section exceeds budget, do not let it commit late. Mark the run as `Needs review` with timeout details and the last completed phase. A partial artifact should only be committed before timeout through an explicit draft contract, not as a late fallback after abort.

### 3. Split Fast Draft From Deep Audit

Use a cheaper/faster path for first visible section drafts. Then deepen on demand or in the background.

Suggested shape:

```text
fast section draft: Sonnet or Haiku, no broad tools, thin structured artifact
deep enrichment: Opus/Sonnet as evals justify, budgeted tools, full typed artifact
```

This is the biggest product-quality unlock. Users forgive background enrichment. They do not forgive staring at vague progress for 13 minutes before the product becomes useful.

### 4. Stop Asking for Unavailable Tools Invisibly

Before each section starts, calculate available tools and inject only the tools that are actually configured. If an unavailable data source matters, write an explicit capability gap into the artifact and UI.

The agent should not spend reasoning budget trying to use integrations that the worker already knows are unavailable.

### 5. Replace Event Spam With Phase State

Keep raw events if needed for debugging, but the product read model should expose compact phase state:

```text
queued
running evidence
structuring
validating
committing
committed
needs review
failed
rerunning
```

Throttle event writes. Keep per-section latest activity and phase timestamps. The current "write hundreds, read last 60" model is not a serious observability design.

### 6. Add Phase Timings to the DB

We need to know where time goes without reconstructing it from event noise.

Add fields or structured events for:

- `evidence_started_at`
- `evidence_completed_at`
- `structuring_started_at`
- `structuring_completed_at`
- `validation_started_at`
- `validation_completed_at`
- `committed_at`

Then the UI and future audits can say exactly why a run was slow.

### 7. Clean Environment Hygiene Before More UI QA

Fix Clerk local configuration and remove dev/keyless prompt interference from the tested surface. Future UI feedback is contaminated until the browser flow matches what a real user sees.

## Bottom Line

The backend is real now. The product experience is not.

The current runtime proves that AI-GOS can produce a six-section audit. It does not yet prove that users will trust, understand, or tolerate the process.

The next engineering move should not be cosmetic UI polish. It should be runtime honesty:

```text
true concurrency
real section budgets
phase-level progress
fewer useless events
visible capability gaps
fast first artifact
deep audit after first value
```

Until that is fixed, `/research-v2` is a strong backend demo wrapped in a UI that over-promises the feeling of live agency.

## 2026-05-16 Update - Draft Timeout Follow-Up

Run tested: `c5b40850-7de5-4b98-abe1-612c967ac179`.

This follow-up tested the later draft/deep execution-mode path after the worker
draft timeout default was raised from 90 seconds to 180 seconds.

### What Worked

- `/research-v2` loaded in the browser.
- Audit Reader rendered.
- Phase chips worked.
- Dispatch started six sections.
- Wave state was visible: `Wave 1 of 1 - 6 running, 0 queued`.
- Draft/deep runtime state was visible.
- Timeout failure rendered honestly as `Needs review`.

### What Failed

- The real corpus step failed first with Anthropic returning `Failed to set up code execution container`.
- This run was seeded past corpus/onboarding only to test section orchestration.
- With 90 seconds, all six draft sections timed out.
- With 180 seconds, all six draft sections still timed out.
- Some sections did not terminate exactly at 180 seconds. Final observed terminal durations ranged roughly 189 seconds to 299 seconds.
- No section committed a draft artifact.

### Corrected Diagnosis

The failed draft path is not primarily a UI issue and not only a timeout-value
issue. Draft mode still asks the model to generate full typed artifacts with all
sub-sections. That makes draft mode a full-schema generation path without the
deep evidence loop, not a genuinely thin first-pass path.

The next backend fix should be:

```text
draft mode: SectionContextPack -> thin draft schema -> commit quickly
deep mode: ToolLoopAgent evidence -> full SectionArtifactSchema -> revisioned enrichment
```

Raising `POSITIONING_DRAFT_TIMEOUT_MS` to three minutes is reasonable as a
temporary default, but it is not the product fix. The product fix is to make the
draft artifact smaller.

### Added External Practice References

These sources were reviewed as a product/engineering comparison point. They do
not imply a new framework choice; AI-GOS already uses the relevant AI SDK
primitives. The useful lesson is smaller measured loops, model-choice evals,
runtime observability, and thin streaming artifacts before deep work.

- AI Hero Vercel AI SDK Tutorial: https://www.aihero.dev/vercel-ai-sdk-tutorial
- AI Hero Streaming Objects: https://www.aihero.dev/streaming-objects-with-vercel-ai-sdk
- AI Hero Agents With Vercel AI SDK: https://www.aihero.dev/agents-with-vercel-ai-sdk
- AI Hero AI Engineer Roadmap: https://www.aihero.dev/ai-engineer-roadmap
- AI Hero Evals: https://www.aihero.dev/what-are-evals
- AI Hero Choosing an LLM: https://www.aihero.dev/how-to-choose-an-llm
- AI Hero LLM App Improvement Techniques: https://www.aihero.dev/how-to-improve-your-llm-powered-app

### Updated Product Decision

Do not start UI polish assuming the backend is ready. The UI now shows progress
and honest failure better than before, but the product still cannot reliably
produce first-draft sections.

The next app update should be a runtime/product slice:

1. Add a thin draft artifact contract.
2. Route `executionMode === "draft"` to that thin contract.
3. Persist a committed draft before deep enrichment.
4. Add draft runtime evals for first partial, draft commit, all-six wall time,
   and abort settle lag.
5. Run a Haiku-vs-Sonnet draft model matrix against the same fixture.
6. Keep full typed artifacts in deep mode.
7. Resume UI polish only after all six draft sections commit reliably.
