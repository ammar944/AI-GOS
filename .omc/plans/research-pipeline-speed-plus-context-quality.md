# Research Pipeline — Speed + Context Engineering Plan

> Constraint: **no quality regressions**. Every phase ships behind a quality gate.
> Scope: full sweep — context + caching + model routing + parallelism + dedupe.
> Branch: `redesign/v2-command-center` (PR #17 merged, Phases 6.1–6.3 shipped).

---

## Principles (RALPLAN-DR)

1. **Measure first, then cut.** No optimization without baseline telemetry.
2. **Quality ratchet only goes up.** Eval golden set blocks any regression.
3. **Evidence-preserving compression.** Never summarize evidence with an LLM when a deterministic filter works.
4. **Context engineering before model-swapping.** Better context > bigger model.
5. **Reversible by flag.** Every change behind an env var for instant rollback.

## Decision Drivers

1. User-visible walltime (target: 8-section pipeline under 180s p50, currently ~8-10 min observed)
2. Output fidelity (target: zero drift on 10-URL golden set; fabrication rate ≤ current)
3. Token cost per run (target: 30%+ reduction via caching)

---

## Phase 0 — Quality Guardrails (SHIP FIRST, BLOCKING)

No speed change lands until this is live.

### 0.1 Golden eval set
- **Deliverable**: `research-worker/evals/golden/` — 10 URLs spanning SaaS, e-com, services, B2B, B2C for **CI snapshot tests**
- Snapshot current production outputs per section + per card into JSON
- `npm run eval:research` runs the pipeline against all 10, diffs against snapshot
- Fail criteria: any section with <90% field-level recall, any card with <3 evidence citations, any fabrication detected
- **Statistical caveat**: n=10 gives weak regression detection. See 0.6 for the larger statistical run.

### 0.2 Shadow mode
- Add `RESEARCH_SHADOW_MODE=true` env flag
- When set, worker runs both old and new pipelines, writes new output to `research_results_shadow` JSONB, **never shows user new output**
- Diff logged to `research_eval_diffs` table with section, field, delta
- **Soak policy (amended)**: multiple phases may be in shadow concurrently, each gated by its own env flag and diff table; do NOT block phases on other phases' soaks

### 0.3 Fabrication detector extension
- `sweepFabricatedClaims` exists for media plan — port to all `*Intel` cards
- Gate: cards with flagged claims get `status='gated'` instead of `'rendered'`

### 0.4 Structured telemetry (pull forward from 7.5)
- Structured JSON log per event: `{event, runId, section, card?, phase, durationMs, inputTokens?, outputTokens?, cacheReadTokens?, cacheCreationTokens?, model?}`
- Wrap: runner start/end, each tool call, evidence-pack build, validator call, write-card
- Env-gated via `RESEARCH_TELEMETRY_VERBOSE=true`
- Export to Supabase `research_telemetry` table for queryability

### 0.5 Baseline walltime measurement (NEW)
- **Budget-constrained**: $10 max API spend. 5 diverse URLs × 1 run each ≈ $8-10.
- Record p50/p90/max per stage and end-to-end. Thin sample but directionally useful.
- **Deliverable**: `research-worker/evals/baselines/pipeline-2026-04-17.json`
- **Augment with passive data**: once 0.4 telemetry is live in prod, real user runs add statistical mass over 1 week without synthetic spend.
- Only after this lands do we write the walltime SLO into acceptance criteria. No guessing.

### 0.6 Nightly shadow eval (NEW)
- Shadow-mode run against a 50-URL extended set (golden 10 + 40 sampled from real prod sessions)
- Runs on schedule, not on every deploy
- Surfaces statistical regressions that n=10 would miss
- Alerts when diff score drifts >2σ from rolling mean

**Gate to Phase 1**: 0.1–0.5 shipped; 0.6 running for at least 3 nights with stable baseline.

---

## Phase 1 — Context Engineering (quality UP, speed UP)

These changes make outputs *better* while also making them faster. Ship in order.

### 1.1 Anthropic prompt caching
- **Current**: zero cache usage in `research-worker/src` — every call rebuilds full system prompt + context from scratch
- **Change**: add `cache_control: {type: 'ephemeral'}` breakpoints in this order:
  1. Static system prompts (per runner, per card) — 1h cache via `ttl: '1h'`
  2. Identity + company context block (stable across one run, cache key includes `identityVersion` hash) — 5min default
  3. Wiki evidence pack (growing per run) — 5min default
- Implementation: `research-worker/src/runners/base.ts` — single helper `withCacheBreakpoints()` that injects breakpoints into message array
- **Quality impact**: **none** — same content, same model, same tokens received
- **Speed impact**: 30-70% TTFT reduction on cache hits; 90% cost reduction on cached tokens
- **Scope**: applies to all 19 LLM calls per run. Biggest win on repeat identity context.
- **Verification**: telemetry `cacheReadTokens` > 0 on every call after runner #1
- **Pre-ship test matrix (NEW)**: `generateObject` × `cache_control` × Zod schema revisions — confirm cache hits still pass validation; confirm schema version bump invalidates cache. Without this test, a malformed-cache-hit-then-retry path could silently serve stale output.

### 1.2 Unified context builder (single source of truth)
- **Current**: context is rebuilt in 3 places — `src/app/api/journey/dispatch/route.ts:200-390`, `research-worker/src/runners/*.ts` context stitching, `research-worker/src/intelligence/evidence-packer.ts:71-109`
- Risk: each location makes independent decisions about what's included → drift
- **Change**: one `buildRunnerContext(runId, section)` module in `research-worker/src/context/` that both the dispatch route and worker runners import. Single definition of:
  - identity block (always first)
  - upstream section summaries (with strict budget per section)
  - wiki evidence pack (topic-filtered + relevance-ranked)
  - document injections (budget-capped)
  - meeting intelligence
- **Quality impact**: eliminates context drift, ensures every runner sees consistent identity framing
- **Verification**: unit test that two callers with same inputs get byte-identical output

### 1.3 Replace LLM summarization with deterministic context
- **Current**: `summarizeForSynthesis()` in dispatch route line 28 calls an LLM to compress prior results. Lossy. Runs per-section.
- **Change**: replace with structured extraction — `extractKeyClaims(priorSection)` returns top-N evidence-cited claims as XML-tagged blocks. No LLM. Deterministic.
- **Quality impact**: UP — preserves citations that LLM summarization was stripping
- **Speed impact**: removes 1 LLM call per downstream section (up to 7 per run)
- **Safety net**: behind `RESEARCH_DETERMINISTIC_CONTEXT=true` flag; shadow mode compares both for 1 week
- **Hard cutoff (NEW)**: 2 weeks after shadow parity declared → delete the `summarizeForSynthesis` path entirely. No permanent dead-code shadow.

### 1.4 Downstream runners get filtered, not full, upstream JSON
- **Current**: later runners receive the full JSONB of prior runners (observed in dispatch route context builder)
- Problem: noise dilutes attention, increases tokens, encourages hallucination from irrelevant fields
- **Change**: per-runner `UPSTREAM_WHITELIST` — e.g., `competitors` needs `{identity.coreKeywords, industryMarket.categorySnapshot, industryMarket.painPoints}`, NOT the full industryMarket JSON
- **Quality impact**: UP — better attention on relevant signals
- **Speed impact**: ~30-50% input token reduction on downstream runners

### 1.5 Semantic wiki retrieval (replacing topic-prefix filter)
- **Current**: `evidence-packer.ts` filters wiki by topic-prefix whitelist. Misses semantically relevant entries tagged under a different topic.
- **Change (deferred, Phase 1.5b)**: embed each wiki entry once (cached per session), cosine-rank against the card's retrieval query
- **Quality impact**: UP — better evidence coverage on ambiguous cards (e.g., strategic-synthesis pulling cross-section signals)
- **Risk**: adds embedding API cost + latency — only ship if Phase 1.1-1.4 telemetry shows evidence quality as the current ceiling
- **Gate**: do not ship until golden set shows evidence-packer missing material facts

### 1.6 Extended thinking for synthesis-heavy calls
- **Current**: zero extended thinking usage in worker
- **Change**: enable `thinking: {type: 'adaptive'}` on:
  - `runners/synthesize.ts` (crossAnalysis) — reasoning over all prior sections
  - `runners/media-plan.ts` blocks (channel mix, audience campaign)
  - `intelligence/cards/strategic-synthesis.ts` — highest-stakes card
- NOT on: industry, keywords, competitors primary pass (tool-use-heavy, thinking doesn't help as much)
- **Quality impact**: UP — measurable on synthesis tasks per Anthropic's own benchmarks
- **Speed impact**: slight negative (~10-20% slower for those 3 calls), offset by caching on other 16
- **Cost budget (NEW)**: thinking tokens are billed. Expect +2-5× output tokens on the 3 affected calls. Acceptance: net cost-per-run (post-caching) must stay ≤ current baseline. If it exceeds, narrow scope to just `strategic-synthesis`.

---

## Phase 2 — Model Routing & Dedupe (quality steady, speed UP)

### 2.1 Audit model choices
- **Finding**: `runners/industry.ts:19` uses `MODELS.FAST` (Haiku) as primary. This is the first real research runner — it feeds all 7 downstream stages. Haiku can hallucinate on open-ended market research.
- **Change**: promote industry primary to `MODELS.STANDARD` (Sonnet). Keep repair on STANDARD.
- Counter-tradeoff: +3-5s latency, +50% token cost on that stage. But it's the upstream foundation — errors compound.
- **Gate**: A/B on golden set. If Haiku-primary fails ≥1/10 URLs, promote. Otherwise keep.

### 2.2 Unify advisor tool usage
- **Finding**: advisor tool gated behind env var for only 2 of 8 runners (competitors, keywords per memory)
- **Change**: either standardize advisor on all tool-using runners OR remove from the 2 that have it. Pick based on golden set eval — if advisor lifts quality, roll out; if not, remove.
- **Quality impact**: whichever direction eval says. No guessing.

### 2.3 Deduplicate guardrails
- **Finding**: duplicated guardrail text across 3 runners (per interrupted plan's notes)
- **Change**: single `GUARDRAIL_BLOCK` constant in `research-worker/src/prompts/shared.ts`. Import everywhere.
- **Quality impact**: consistency — no drift where one runner has an updated guardrail and others don't
- **Speed impact**: zero directly, but unlocks cache reuse for the guardrail block across runners

### 2.4 Kill duplicate gap synthesis (was Phase 7.2)
- `runners/competitors.ts:110-118` inline `whiteSpaceGaps` schema → remove
- `white-space-gap` card becomes sole source
- Keep frontend fallback at `card-taxonomy.ts:388` for 2 weeks for legacy runs
- **Quality impact**: UP slightly — card synthesis has full wiki, runner had only live research
- **Speed impact**: ~30-60s off competitors runner (smaller output schema = smaller generation)

### 2.5 Batch validator Haiku calls
- **Current**: `validator.ts:45-85` fires 1 Haiku per card = 4/run
- **Change**: one Haiku call that audits all 4 cards' claims at once with structured output
- **Quality impact**: identical — same validation logic, same evidence pack
- **Speed impact**: ~8-12s saved; 4 round-trips → 1

---

## Phase 3 — Runner Parallelization (biggest speed win)

### 3.1 Verify data dependencies
- Grep every runner's `context` field reads. Build an explicit dependency graph.
- **Expected graph** (to verify):
  - `identityResolution` → (no deps)
  - Wave A (parallel after identity): `industryMarket`, `icpValidation`, `competitors`, `offerAnalysis`
  - `keywordIntel` needs competitors → runs after Wave A
  - `crossAnalysis` (synthesize) needs all upstream → runs after keywordIntel
  - `mediaPlan` needs everything → runs last

### 3.2 Replace sequential chain with wave executor
- **Current**: `research-worker/src/index.ts:357` awaits each runner in a loop
- **Change**: stage-aware executor — each stage is either a single runner or a `Promise.all(runners[])`
- **Quality impact**: **none** — same runners, same inputs, same outputs. Only timing changes.
- **Speed impact**: 540-720s → 180s for Wave A (4x parallelism). Single biggest win in the whole plan.

### 3.3 Safety — concurrency caps
- Anthropic has per-org RPM/TPM limits. Measure current usage at 1 concurrent, then ramp.
- Add `MAX_CONCURRENT_RUNNERS` env var (default 2, ramp to 4 after telemetry shows headroom)
- Retry-after-aware backoff in `runners/base.ts` that **respects the `retry-after` header**; not blind exponential
- **Circuit breaker (NEW)**: after N consecutive 429s in T seconds, stop queueing new runners in Wave A; serialize until cleared
- **Pool separation (NEW)**: runners and cards share the same Anthropic org quota today. Track separate in-flight counters for `runner-wave` and `card-dispatcher`; reserve ~70% RPM for runners during Wave A to prevent card-starvation

### 3.4 MediaPlan internal parallelization
- **Current**: 6 sequential `generateObject` in `runners/media-plan.ts`
- **Change**: identify block-level dependencies. `strategySnapshot`, `creativeSystem`, `measurementGuardrails` likely independent — `Promise.all` them. `rolloutRoadmap` may depend on channelMix.
- **Quality impact**: zero (same blocks, same context)
- **Speed impact**: ~60-120s

### 3.5 Fire-and-forget post-runner writes
- `index.ts:370-391` — DB writes and wiki extraction block the next runner
- **Change**: kick off writes in background with error-tracking; next runner starts immediately
- **Quality impact**: zero
- **Speed impact**: 5-15s per stage × 8 stages = ~40-120s
- **Data-loss mitigation (NEW)**: the next runner must receive the **in-memory result object**, not re-read from DB. If the background write fails, the run has already proceeded on the in-memory truth. Write-failures are logged to a retry queue; on retry-exhausted, the run is marked `status='degraded'` but not failed (frontend already has the card via realtime fan-out from the successful wiki write path).

---

## Phase 4 — Card-Level Parallelism (smaller win)

### 4.1 Cross-section card triggers
- **Current**: `dispatcher.ts:22-28` one-to-one section→card map
- **Change**: multi-trigger map; cards gate on evidence count via existing `GATED:empty_output` path
- Example: `strategic-synthesis` can tentatively fire after `competitors` with partial evidence; refires on `crossAnalysis` with full evidence (idempotent write)
- **Quality impact**: UP — user sees preliminary synthesis earlier, final synthesis overwrites it with richer version

### 4.2 Progressive render (7.4)
- Already plumbed via Supabase realtime (`research-realtime.ts:67-120`). Frontend-only — make sure cards render as they arrive without batching.

---

## Phase 5 — Optional Advanced Techniques (flag behind eval wins)

### 5.1 Self-consistency for strategic-synthesis
- Run card twice with slight prompt variation, keep overlapping claims, flag divergent ones
- Doubles cost on that one card but could cut fabrication by 30-50% per self-consistency literature
- Only ship if golden set shows strategic-synthesis as the fabrication-source

### 5.2 Retrieval-augmented guardrails
- Build small corpus of "good synthesis" exemplars → retrieve top-3 per card → inject as few-shot
- Quality lift on structured outputs

### 5.3 Structured output grammars
- Use Anthropic's tool-use for schema enforcement instead of post-hoc Zod validation on generated JSON
- Zero malformed outputs; kills the repair-stage LLM call entirely

---

## ADR — Ship Order & Why

| # | Phase | Gate | Rationale |
|---|---|---|---|
| 1 | 0 Quality infra | – | Nothing ships without baseline |
| 2 | 1.1 Prompt caching | Phase 0 telemetry shows `cacheReadTokens>0` | Pure win, no risk |
| 3 | 1.2 Unified context builder | Golden set green | Quality-preserving refactor |
| 4 | 1.3 Deterministic context | Shadow mode parity 1 week | Replaces lossy LLM summary |
| 5 | 1.4 Upstream whitelist | Shadow mode parity 1 week | Reduces noise |
| 6 | 1.6 Extended thinking | Golden set quality UP | Small speed cost, quality lift |
| 7 | 2.4 Dedupe gap synth | Shadow mode parity 1 week | Removes 1 LLM call |
| 8 | 2.5 Batch validator | Shadow mode parity | 4→1 Haiku call |
| 9 | 3.2 Runner parallelism | All above stable 1 week | Biggest user-visible win |
| 10 | 3.4 MediaPlan parallelism | Stage 9 stable | Localized change |
| 11 | 3.5 Fire-and-forget writes | Stage 10 stable | Small win, small risk |
| 12 | 4.1 Cross-section card triggers | All above stable | Partial-render UX |
| 13 | 1.5 Semantic retrieval | Only if Phase 0 eval shows evidence gaps | Deferred |
| 14 | 5.x Advanced | Only if fabrication flagged | Deferred |

### Alternatives considered
- **Model-swap-first (Sonnet→Opus everywhere)**: rejected. Blind cost increase without addressing context-quality ceiling. Better context + right-sized model beats bigger model on noisy context.
- **Ship runner parallelism first** (fastest wall-clock win): rejected. Without prompt caching + telemetry + shadow mode, quality drift would be invisible.
- **Full pipeline rewrite** (event-sourced, durable queue): rejected. Incremental plan with flags preserves shipability.

### Consequences
- +1 eval table (`research_eval_diffs`), +1 telemetry table (`research_telemetry`)
- +5-8 env flags. Acceptable for reversibility.
- ~2-3 weeks of sequenced rollout if each phase gets 1 week of shadow-mode stability. Can compress to 1 week if phases ship in same day but all start in shadow.

### Follow-ups
- Migrate `parseResearchToCards` fallback removals after legacy runs age out (2 weeks post-2.4)
- Cost-dashboard per run exposing token + cache + walltime breakdown
- Add section-level "expected walltime" SLO tracked in telemetry; alert on p95 breach

---

## Pre-mortem — 3 Failure Scenarios

### Scenario 1: Runner parallelization causes rate-limit cascade
- Anthropic org RPM cap hits during Wave A's 4-wide parallel. Retries storm. User sees worse latency.
- **Mitigation**: `MAX_CONCURRENT_RUNNERS` default 2 not 4. Measure usage before ramping. Exponential backoff with jitter.

### Scenario 2: Prompt caching cache-poisoning
- Cached system prompt contains a bug. All cached calls produce the same bad output until TTL expires.
- **Mitigation**: cache keys include runner version hash. Bumping version invalidates cache. Shadow mode catches bad cache within hours.

### Scenario 3: Unified context builder drops a field
- Refactor loses a field that the card synthesizer depends on. Cards render empty, dispatcher gates them, user sees blank sections.
- **Mitigation**: shadow mode diffs catch field-level drift. Feature flag instant rollback. Golden set must have zero gated cards baseline.

---

## Expected Test Plan

### Unit
- `buildRunnerContext` deterministic output test (Phase 1.2)
- `extractKeyClaims` returns correct top-N with citations (Phase 1.3)
- `UPSTREAM_WHITELIST` contains only declared fields (Phase 1.4)
- Cache breakpoint placement test (Phase 1.1)
- Wave executor dependency graph resolves correctly (Phase 3.1)

### Integration
- Full pipeline run with fresh Supabase session; assert 8 section keys present with `status='complete'`
- Shadow mode run writes both primary and shadow without cross-contamination
- Validator batched call produces same verdicts as individual calls on fixture set (Phase 2.5)

### E2E (golden set)
- All 10 URLs run through pipeline end-to-end
- Field-level recall ≥ 90% per section
- Zero fabrications detected
- p50 walltime under 180s after Phase 3

### Observability
- Telemetry table has row per runner + per card per run
- `cacheReadTokens` > 0 on every cache-eligible call post-1.1
- Structured error logs include runId for correlation
- Cost dashboard shows 30%+ reduction post-1.1

---

## Rollback Runbook (per phase)

Every phase must land with a tested rollback path. Template:

```
PHASE: <number>
TRIGGER: <what signal triggers rollback — fabrication spike, latency regression, user complaint>
FLIP: <exact env var change, e.g., RESEARCH_DETERMINISTIC_CONTEXT=false>
REVERT CODE: <git SHA to revert to if flag alone insufficient>
DATA CLEANUP: <what rows/tables to prune, e.g., DELETE FROM research_results_shadow WHERE run_id IN ...>
VERIFY REVERT: <how to confirm: golden set re-run, specific metric, user smoke test>
EXPECTED BLAST RADIUS: <what users see during rollback window>
```

Stored per phase in `research-worker/runbooks/phase-<N>.md`. Rollback drill done in staging at least once per phase before enabling in prod.

---

## Red-Team Scenarios Added

### Scenario 4: Prompt-cache × `generateObject` schema interaction
- Cache returns an output that fails Zod validation. Retry path doesn't distinguish cache hit from cold miss, so it re-caches the bad output.
- **Mitigation**: cache version key includes Zod schema hash. Schema change invalidates cache.

### Scenario 5: Semantic retrieval premature ship
- Phase 1.5 deferred but no enforcement — future work might ship it without eval justification.
- **Mitigation**: the plan explicitly blocks Phase 1.5 on a named eval gate ("evidence-packer missing material facts on ≥2 golden URLs"). Code-reviewers reject PRs without that evidence cited.

### Scenario 6: Wave A starves card dispatcher
- 4 parallel runners saturate Anthropic RPM. Cards queued behind them.
- **Mitigation**: separate in-flight pools (see 3.3 amendment). Cards get guaranteed ~30% RPM.

---

## Acceptance Criteria

### Phase 0 exit
- [ ] Golden set runs in CI; baseline snapshots committed
- [ ] Baseline walltime measured (0.5) and recorded in `evals/baselines/pipeline-<date>.json`
- [ ] Nightly 50-URL shadow eval running with ≥3 nights of stable diff scores
- [ ] Telemetry table queryable with section/runner/card breakdown
- [ ] Shadow mode infra ready to activate per phase

### Per-phase exit (each optimization)
- [ ] Env flag documented
- [ ] Shadow mode diff shows parity (≤2σ drift) for ≥1 week
- [ ] Runbook written + staging rollback drill completed
- [ ] `*Intel` consumer never silently returns empty — warn-log on empty parse
- [ ] Zero new fabrication regressions in `sweepFabricatedClaims` extended coverage

### Program-level targets (set AFTER Phase 0.5 baseline; placeholders for now)
- [ ] End-to-end p50 walltime: `<TBD after 0.5>` → target `<baseline × 0.3>`
- [ ] Token cost per run: down ≥ 30% via cache (measured post-Phase 1.1)
- [ ] Evidence citation rate per card: ≥ current baseline on golden set
- [ ] Fabrication rate per run: ≤ current baseline on golden set
