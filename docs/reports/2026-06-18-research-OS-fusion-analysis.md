# Fusion analysis — opus4.8-gpt5.5 panel (Track B: research/architecture)

## Consensus (independent agreement = highest confidence)
Both panelists, blind to each other and reading the real repo, converged on the SAME architecture:
- STOP "6-parallel-sections-then-synthesize" as the control plane. Ingredients are right; the control plane is wrong.
- KEYSTONE: a durable, append-only **Evidence Ledger** in Supabase = the system of record. Facts written the instant acquired, so a timeout kills an agent, not its facts. Both noted the repo already has a context-only pool (wave6EvidencePool / evidence-pool.ts) that is NOT durable.
- Provider scheduler with per-provider caps (both gave ~identical numbers: DeepSeek 2, Brave 1-2, Perplexity 1), 429/Retry-After backoff, requeue. Both: no cross-lambda limiter exists today.
- Completion = readiness state machine (GROUNDED/DIRECTIONAL/BLOCKED), NOT "row written". Paid media fires only when required cell-groups pass readiness. Both flagged readiness is currently an annotation, not a gate.
- Schema: drop the `.min(N)` forced rows on synthesized blocks; make evidence packs UNIVERSAL across all non-boilerplate cells. Both named the exact 4 unpacked blocks: projectedResults, funnelIdeation, kpis, crossSectionInsight.
- Composition: a single deep **composer/compiler** reads the ledger and fills typed DeckCell objects {value, status, provenance} — binds to a fact or renders an explicit gap; fabrication structurally impossible.
- Coverage map = EXECUTABLE contract/manifest (cellId, class, servedBy, floor). One source of truth for planner + composer + QA.
- Projected results = arithmetic/formula artifacts; default CPC labeled "assumption", false ±20% precision suppressed, "grounded" status failed on defaults.
- Quality: DO NOT trust a single LLM judge. Deterministic liar-catcher gate PRIMARY/blocking (grounding %, no unsupported cells, no invented buyers, no padded counts, projection math closes); LLM value-read only AFTER deterministic pass, advisory/scored. Both noted the repo already has the seeds (provenance-gate, zz-saaslaunch-coverage-eval, zz-judge-run) — promote them from advisory to gate.
- AI SDK v6 is already used correctly in places; use ToolLoopAgent for acquisition loops, generateText+Output.object for typed compilation, prepareStep to force search->fetch->extract->cite->answer, provider middleware (wrapLanguageModel) for throttling.
- The 16 onboarding + 7 team-asset cells are NOT research-fillable; "95% grounded" = 95% of the 34 research cells; the rest are brief/asset inputs, not gaps.

## Contradictions (honest disagreement = most useful)
1. **Rollup specifics.** Opus: corpus-padding is ALREADY FIXED in current SQL (20260603+20260608 exclude corpus); surviving bug is purely content-blindness. GPT: the latest functions still mark any non-excluded zone as rollup-eligible rather than an EXACT-SIX allow-list (hence the trail of exclusion migrations). Reconciliation: both true — corpus specifically is excluded (Opus), but the deny-list pattern is fragile and should become an allow-list (GPT).
2. **Concurrency shape.** Opus prefers Option A: COLLAPSE acquisition into ONE lambda with in-process p-limit (simplest; you're on Pro, maxDuration 800). GPT prefers a distributed DB/Redis lease queue (keep lanes distributed; copy the worker's existing semaphore). Genuine fork.
3. **Section granularity.** Opus: sections become "miners" producing atomic facts; the typed section artifact becomes a composer-generated projection (flatter). GPT: sections become "compilers over the ledger" with a separate cell-verifier stage (corpus -> planner -> acquisition lanes -> section compilers -> cell verifier -> deck compiler) (more staged).

## Partial coverage (one went deeper)
- Opus deeper on: full Evidence Ledger DDL; readiness-barrier-triggers-bounded-solo-rerun (leveraging proven solo-rerun success); the cost argument (ledger+cache makes runs CHEAPER); Gate-1 mechanics (assert the cell's source_quote literally contains the claimed token); a shared page/search cache as a distinct compounding fix (starvation is self-inflicted by redundant re-fetch).
- GPT deeper on: reusing MORE existing repo seeds (worker semaphore.ts, evidence-pool.ts, zz-* eval scripts, section-agent.ts ToolLoopAgent); a research_acquisition_attempts table (record what was tried + rejected -> blocked_unfindable vs blocked_retriable); DeckCell fields {attempts, ownerCellId}; explicit node-state list.

## Unique insights (only one saw)
- Opus: corpus-padding-already-fixed verification; shared page cache / request coalescing; Gate-1 token-level fabrication catch; cost likely DROPS; bounded solo re-run before degrade.
- GPT: convert rollup DENY-list -> exact-six ALLOW-list (stop exclusion-migration whack-a-mole); research_acquisition_attempts table + blocked_unfindable vs blocked_retriable; "you already have a semaphore in the worker"; explicit section-compiler + cell-verifier stages.

## Blind spots (both under-addressed)
- LATENCY/UX: a planner -> acquisition-barrier -> single-deep-composer pipeline can be SLOWER wall-clock than the current all-at-once fan-out, and the final one-shot composer call is a silent multi-minute gap — collides with the hard "stream visible progress" requirement. Neither sized the latency budget or proposed per-cell streaming telemetry for the composer.
- ROLLOUT RISK: this is a large re-architecture of a LIVE system. Neither gave an explicit strangler-fig path (Opus's P0-first ordering implies it but doesn't specify keeping the current pipeline alive while the ledger is introduced).
- COHERENCE: neither specified how the single composer enforces cross-section numeric coherence (audiences sum to budget, projected results reconcile) — there's an existing numeric-coherence gate neither mentioned.
- CORPUS->LEDGER: how Perplexity corpus facts get typed into the ledger vs in-section live tools is glossed.
- MODEL QUALITY: neither questioned whether DeepSeek is the right acquisition model for the grounding bar (the drafting/review/judge split in CONTEXT.md).
