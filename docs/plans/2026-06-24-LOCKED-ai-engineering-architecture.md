# LOCKED — AIGOS AI-Engineering / Backend / AI-SDK Architecture (canonical)

**Date:** 2026-06-24 · **Branch:** `refactor/architecture-deepening` · **Status:** owner-ratified direction, code-grounded. This is the **single canonical AI-engineering reference**. It consolidates and supersedes the scattered decisions across the four prior docs and is verified against the actual built code by a 12-agent ground-truth + design study (`wf_59d7f3c3-678`).

**What this doc is:** the AI-engineering / backend / AI-SDK spec for "**Manus for GTM**." How the GLM-5.2 agentic pipeline is wired with the Vercel AI SDK v6, on Vercel serverless, against Supabase. Read it as the execution contract for the production wire-up.

**North star (binding, owner):** **generate genuinely useful GTM research** — real buyer language, real switching stories, real competitor positioning, real demand signals — research a strategist bills to a client. Honesty machinery is *hygiene underneath*, never the success metric. Value, not evals.

---

## 0. Supersede map (so there is one source of truth)

| Prior doc | Holds | Superseded |
|---|---|---|
| `2026-06-23-final-agentic-architecture.md` | §1 topology (1+pool+1), §2 four-complaints diagnosis | §3 Opus composer, §4 orchestrator-on-worker, §5/§6 Opus LLM oracle |
| `2026-06-24-gtm-framework-and-backward-design.md` | §1 framework, §2 backward chain, §3 deck gaps, §5 score-by-template-cells | §4 onboarding-reframe-to-10-agent-researched-Qs |
| `2026-06-24-LOCK-agentic-research-to-media-plan.md` | §1/§2 flow, §3 economics, §5 the bar, §7 sequence | §2/§7E "Opus composer + `Output.object`" |
| `2026-06-24-HANDOFF-glm-research-arc-B-to-E-built.md` | §1 owner decisions, §2 flow, §3 file map | learning #4's open hole is now specced (this doc §6) |

**Net result of the chain → this doc.** Everything below is the consolidated, current truth.

---

## 0.5 Fusion-3 cross-check — corrections that OVERRIDE the body below

After the body was written, a 3-model panel (Opus 4.8 + GPT-5.5 + GLM 5.2 — two of which independently read the live repo and confirmed bugs at `file:line`) stress-tested it. Provenance: `~/.claude/fusion-runs/2026-06-24_143427_opus4.8-gpt5.5-glm5.2.md`. **The locks HOLD** (flat topology, GLM-everywhere + fenced-JSON, kill-the-oracle). These verified deltas **supersede the matching paragraphs below** and are folded into §6/§7/§8:

1. **Labels must be MACHINE-ASSIGNED, not model-claimed (§6 Leg 2 correction).** The same GLM call that hallucinates a number self-labels it `[grounded:url]` — so a model-emitted label is *net-negative* (manufactures false operator trust). `[grounded:url]` is granted only when **deterministic containment** (incl. numeric tokens) confirms the literal token at that URL; the model may *request* a label, code grants it. Everything unconfirmed is force-downgraded to `[inferred]`/`[gap]` by code.
2. **The numeric/economic surface is the real billable-fabrication risk and is currently undefended (NEW, all 3).** Quote-at-URL catches only verbatim quotes; a paid-media deck's liability is *numbers* (CAC/CPL/CPM/budget-split/competitor-spend). Add a **deterministic numeric-provenance gate**: every `$`/`%`/CPM in the deck must literally trace to a `research_facts` row (reuse `numeric-coherence.ts` + `normalizeMoney`), else force `[inferred]`/`[gap]`. This is the single biggest unclaimed win — pure string/number matching, no LLM.
3. **Composer output goes under a `claim_ledger` (§6 composer-floor, elevated).** A `deck_claims` layer (`claim_text`, `claim_type`, `support_fact_ids`, `computed_from`, `grounding_status`, `operator_review_status`) **enforced in code** blocks Share/export until high-risk claims are grounded, marked, or operator-attested. Human review = **per-`[inferred]`-claim attestation**, not a single rubber-stampable stamp (review fatigue + the operator-is-the-seller incentive breaks one stamp).
4. **The 300s wall is STALE → enable Fluid + `maxDuration=800` (§7 correction).** Vercel Fluid compute is GA/default with **800s on Pro/Enterprise** (+30-min beta). Raise the composer route to 800s and the "281s/4s-headroom existential" risk largely evaporates — a one-line change. (Does NOT rescue the §8.1 concurrency bug: `after()`/`waitUntil` work is *cancelled* on function timeout.)
5. **"Pause/resume impossible on Vercel" is OUTDATED (§2 justification correction).** Vercel **Workflows** (durable pause/resume) + **Queues** (durable fan-out/concurrency/retries/dedupe) exist first-party (also Inngest/Trigger.dev). Flat-on-Vercel is still right **for the pilot** (simplest correct thing), but the *reason* is not "the platform can't do durable." A **durable queue/workflow is the highest-leverage post-pilot move** — it fixes concurrency + completion-signaling + the human checkpoint in one shot. The current 4-lambda DB-rollup is a hand-rolled durable workflow.
6. **Concurrency fix = an EXPIRING lease, never a naked counter (§8.1 correction).** TTL + heartbeat (via `onStepFinish`) + atomic claim (`FOR UPDATE SKIP LOCKED` / `UPDATE…WHERE count<3 RETURNING`) + release in `finally`. A naked counter **deadlocks** when a lambda dies in `after()`. Do **not** hold a Postgres lock across the GLM call. Cleanest native pattern = **Supabase pgmq / Vercel Queues** (visibility-timeout *is* the lease-with-TTL). `await-in-parent` stays rejected.
7. **Three more prerequisites (1–2 panelists):** (a) completion-signal must be **atomic** ("all 6 terminal"), not TOCTOU `count(*)`; (b) **idempotency keys** on ledger writes (`ON CONFLICT … DO NOTHING`) — at-least-once retries dup facts; (c) a **non-Opus fallback model** (≥ composer) — one OpenRouter outage kills every 14-min run; (d) keep tolerant decode for **structural** drift only + a **synthesized-row-ratio guard** (a >50%-backfilled deck routes to honest-gap, not "admitted"); (e) quote-containment ≠ correct attribution (long-page/paraphrase/wrong-speaker pass) — necessary, not a full net.
8. **Panel blind spot = the premise.** Nobody tested whether GLM-5.2's research is *good enough* to be the billable bar — all three attacked fabrication/infra and took the model as given. **Run a frozen multi-subject value-read before prod**; the value north star is proven only on Clay/Ramp so far.

---

## 1. The product flow (locked)

```
URL / website
   │
   ▼  USER FILLS ONBOARDING  (the existing form, fully, INCL. competitors — user-filled, BLANK)
   │     corpus-before-onboarding is DEAD. runId minted at welcome submit.
   │
   ▼  ONBOARDING SUBMIT → fire research
   │
   ▼  ORCHESTRATOR  (1 GLM-5.2 agentic loop, IN-APP, own 300s lambda)
   │     identity-lock (prompt) · extract 6 GTM fields · gather over 6 intelligence buckets
   │     → WRITES URL-pinned facts to the SHARED LEDGER (Supabase research_facts)
   │     → returns { gtmFields, researchDigest(markdown), transcript }
   │
   ▼  SECTION POOL  (bounded 3 concurrent of 6, each its OWN GLM agentic loop + OWN 300s lambda)
   │     Market · BuyerICP · Competitor · VoC · Demand · Offer
   │     each READS the ledger first → top-up fetches only where thin → WRITES findings back
   │     emits FREE MARKDOWN (no schema mid-loop); narrativeMarkdown is the primary card body
   │
   ▼  COMPOSER  (1 GLM-5.2 call, own 300s lambda, synthesis-only)
   │     reads ledger digest + 6 section markdowns + onboarding frame
   │     reconciles ICP⟷competitors⟷demand BY CONSTRUCTION → emits the 13-block deck
   │     fenced-JSON → tolerant decoder → deterministic floor (NO Opus, NO oracle)
   │
   ▼  13-block paid-media deck + 6 positioning cards  →  HUMAN REVIEW before Share/export
```

One human seam (onboarding). Three compute tiers chained by Supabase DB-state rollup — **never one mega-lambda** (842s p50 would blow any single budget).

---

## 2. The topology — **1 + (3-of-6) + 1**, locked

**Decision: sections are INDEPENDENT dispatched jobs reading/writing a shared ledger — NOT Manus-style orchestrator-spawned subagents.** This is not a compromise; it is the only topology Vercel permits and the one the multi-agent breadth win actually endorses.

- "Multi-agent beats single-agent **90.2%** on breadth-first search" is a claim about **independent parallel slice-owners** (your 6 sections = 6 slices), not deep parent→child spawning.
- A spawning orchestrator (`ToolLoopAgent` whose tools spawn children in-process) forces all 6 GLM loops + the orchestrator into **one 300s lambda sharing one budget**. At the Clay-measured **161s/loop** that's ~2 sections before the wall — guaranteed timeout. It also throws away the single biggest asset you already have: **each section gets its own fresh 285s lambda** (`LAB_SECTION_JOB_TIMEOUT_MS`).
- Pause/resume across the onboarding checkpoint is impossible on Vercel anyway. Independent jobs make onboarding a clean process seam with no in-flight agent to suspend.

**The orchestrator is a LEDGER PRODUCER, not a spawner.** It writes facts and returns; the pool reads them.

### AI-SDK primitive per tier (all three identical shape — **generateText + stopWhen**, NOT ToolLoopAgent)

| Tier | Primitive | Steps | maxOutputTokens | Tools |
|---|---|---|---|---|
| **Orchestrator** | `generateText({ model: getAgenticGLMModel(env), tools, stopWhen: stepCountIs(14), … })` | `ORCHESTRATOR_MAX_STEPS = 14` | `8000` | `{ web_search, firecrawl, perplexity_research }` |
| **Section** (×6) | `generateText({ … stopWhen: stepCountIs(16) … })` | `AGENTIC_GLM_MAX_STEPS = 16` | `8000` | per-section `allowedTools` (registry) |
| **Composer** | `generateText({ … stopWhen: stepCountIs(4) … })` | `COMPOSER_MAX_STEPS = 4` | `12000` | `{}` (synthesis-only; recommend → 2 steps, see §7) |

`ToolLoopAgent` *is* exported by `ai@6.0.178` (as is `Experimental_Agent`, `createAgentUIStreamResponse`, `NoObjectGeneratedError`), but it earns its place ONLY for (i) a reusable agent object invoked many times, (ii) tools that spawn sub-agents (the pattern we reject), or (iii) `.respond()/.stream()` ergonomics. None apply: each tier is a **single-shot, per-request, env-re-resolved** call. Raw `generateText` keeps the `stopWhen` step budget — which the whole system is tuned around — legible. **Document this LOCK in the ADR so a future contributor doesn't "tidy" it into `ToolLoopAgent` and re-enable budget-collapsing spawning.**

`getAgenticGLMModel(env)` is **re-resolved per invocation** (not the cached `LAB_ENGINE_PROVIDER` lazy proxies) — correct for per-request env on a multi-tenant lambda. Keep it.

---

## 3. Model & transport — the AI SDK layer

**Model = GLM-5.2 everywhere** (orchestrator + 6 sections + composer). No Opus, no DeepSeek on the agentic path.

### Two GLM routes exist in code — use the right one

- **(A) Agentic route — THE LOCKED DIRECTION.** The 5 GLM agents call `getAgenticGLMModel(env)` **directly**, which always builds `createGLMSelection(env)` regardless of `LAB_ENGINE_PROVIDER`. This is the un-caged free-markdown path.
- **(B) Provider-switch route — LEGACY, do not use for GLM.** `LAB_ENGINE_PROVIDER='glm-openai-compatible'` routes through the legacy `section-agent.ts` / `Output.object` structured-output pipeline — which the composer header explicitly documents GLM **cannot** satisfy. **Flipping `LAB_ENGINE_PROVIDER` is NOT how you turn the locked path on.** The flag is `LAB_AGENTIC_GLM_SECTIONS` (see §7).

### Transport (`src/lib/lab-engine/ai/models.ts`)

```ts
// createGLMSelection(env) — generic OpenAI-compatible client
const glm = createOpenAICompatible({
  apiKey:  GLM_API_KEY  ?? "ollama",                    // literal "ollama" dev fallback
  baseURL: GLM_BASE_URL ?? "http://localhost:11434/v1", // DEFAULT_GLM_BASE_URL — OLLAMA, not OpenRouter
  name:    "glm",
});
const model = glm(GLM_MODEL_ID ?? "glm-5.2:cloud");     // DEFAULT_GLM_MODEL_ID
```

**⚠ OpenRouter is NOT wired in code — it is purely env-driven.** There is no `z-ai/glm-5.2` default, no OpenRouter base URL, no `OPENROUTER_API_KEY` read anywhere. The code is provider-agnostic and points wherever `GLM_BASE_URL` says. The in-code defaults are **Ollama localhost** (dev). Prod OpenRouter depends *entirely* on env being set:

| Env var | Dev (default) | Prod (Vercel, owner sets) |
|---|---|---|
| `GLM_BASE_URL` | `http://localhost:11434/v1` | `https://openrouter.ai/api/v1` |
| `GLM_MODEL_ID` | `glm-5.2:cloud` | `z-ai/glm-5.2` |
| `GLM_API_KEY` | `ollama` | `<OpenRouter key>` |

**Prerequisite (a real prod-failure risk):** `checkAgenticGLMPreflight` validates only that `modelId`/`baseURL` are non-empty strings — it does **not** verify the key, reachability, or that `baseURL` ≠ localhost. If the three env vars are unset on Vercel, **every** GLM call (orchestrator + 6 sections + composer) silently targets `localhost:11434`, which doesn't exist on a lambda, and fails at request time, not preflight. **Add a prod assertion: `GLM_BASE_URL` must not be localhost when `NODE_ENV==='production'`.** (See ADR-0012.)

### Structured output: fenced-JSON + tolerant decoder — never `Output.object` on GLM

GLM-via-Ollama/OpenRouter does **not** support `responseFormat`/`Output.object` (proven live, Step D). Verified in `node_modules`: `@ai-sdk/openai-compatible@2.0.48` exposes `supportsStructuredOutputs?: boolean` (default false); the GLM client does not set it. AI SDK v6's `Output.object` on a reasoning model with a low step budget **throws `NoObjectGeneratedError`** (a crash, not a null) when the model burns its budget before emitting the closing object.

→ All three tiers emit **free markdown + a fenced JSON block**, parsed by a tolerant text decoder. CLAUDE.md's "prefer `generateText`+`Output.object`" rule has a **documented GLM exception** here. `Output.object` may only be probed in `scripts/` (never shipped), and the fenced path stays primary regardless of probe outcome.

---

## 4. Tool stack per tier (locked)

| Tier | Tools | Notes |
|---|---|---|
| **Orchestrator** | `web_search`, `firecrawl`, `perplexity_research` | gather-only; credential-gated (auto-drops unfunded) |
| **Sections** | per-section `allowedTools` in `section-registry.ts` (unchanged) + ledger as first source | competitor/demand also carry ad/keyword tools (SpyFu/SearchAPI/Foreplay) — credential-gated |
| **Composer** | **none** (`{}`) | gather is done upstream; spend the 4 steps on synthesis |

**Sub-calls resolved:**
- **Brave `web_search` — non-issue, already done.** `web_search === firecrawlSearchAgentTool`. Brave exists ONLY as an in-tool degradation fallback inside it (fires on a Firecrawl gap). Keep as-is; it self-heals. Action = fix the stale "Brave web_search" lines in CLAUDE.md/capabilities docs, and keep `BRAVE_SEARCH_API_KEY` funded so the fallback is real.
- **Perplexity — KEEP (default), kill only if an A/B earns it.** It's the only tool that reads G2/Capterra/Reddit server-side with citation URLs — load-bearing for the VoC-as-competitor-reviews mandate. **OPEN-needs-owner:** authorize the ~$1-2 A/B — run `generateAgenticGLMOrchestrator` on 3 subjects ×2 (arm A with `PERPLEXITY_API_KEY`, arm B without → tool auto-drops); metric = grounded-claim density (distinct http(s) ledger facts) + review-surface URL count (g2/capterra/reddit/trustpilot). Kill rule: <15% density delta **and** ≥parity on review URLs. Default KEEP until proven.
- **Tavily / Exa — NO.** Not in the repo; both overlap Firecrawl + Perplexity; a 4th provider adds credentials + GLM tool-choice confusion for no measured lift. Revisit Exa only *if* the A/B kills Perplexity and Firecrawl proves insufficient for review surfaces.
- **Identity-lock — prompt preamble, not a tool.** Disambiguation is a reasoning constraint (`IDENTITY_LOCK_PREAMBLE`: commit to one company, domain as disambiguator, mark uncertain `[unverified identity]`). The deterministic backstop is the ledger's http(s)-URL boundary. A "tool" would just duplicate `web_search`'s domain scoping.
- **Complexity / extended-thinking knob — NO.** GLM-5.2 already burns reasoning budget; the `maxOutputTokens=8000` floor exists *because* GLM returns empty markdown below it. An extra thinking knob risks the documented DeepSeek-pro truncation failure (`finishReason:'length'`). **Step count is the complexity lever, not a thinking toggle.**

All tools are AI-SDK-v6-correct: `tool({ description, inputSchema, outputSchema, execute })` with Zod `inputSchema` (never `parameters`), budget via `maxOutputTokens` (never `maxTokens`). New tools: add a `TOOL_REQUIRED_ENV` entry so they auto-drop when unfunded.

---

## 5. Structured-output binding — the composer tolerant decoder (closes the one open hole)

**The bug:** `composer-glm.ts:parsePaidMediaPlanFromText` extracts the fenced ` ```paid-media-plan ` JSON, `JSON.parse`s it, then runs a **strict** `paidMediaPlanBodySchema.safeParse` → returns `null` on ANY field-name/shape drift. On the live Clay run this turned a valid 13KB deck into `deck=null` — the billable deliverable silently vanished.

**The fix (reuse, don't rebuild):** route the parsed fence through the **already-built tolerant decoder** `normalizePaidMediaPlanBody` (`paid-media-plan.ts:1994`) — the same engine `withNormalizedPaidMediaPlanOutput` (`run-section.ts:8104`) already trusts for the legacy path. It absorbs GLM's common array-vs-`{phases|audiences|angles|…}`-wrapper drift (`getNestedArray`), backfills floors (`synthesize*GapRows`: audiences≥1, angles≥2, creativeFramework≥3, kpis≥2), slices ceilings (funnel≤3, channels≤6, kpis≤5), then a throwing `schema.parse` + budget reconciliation.

**Decode order (locked):**
1. Extract fence (` ```paid-media-plan `, ` ```json ` fallback) + `JSON.parse`.
2. `snapComposerKeys(parsed)` — a **small** alias-snap for GLM's renamed *scalar* keys (`normalizeCampaignOverview` reads `record.prose`/`record.monthlyBudgetValue` by **exact** name; the normalizer does NOT alias renamed scalars). Map only **empirically-observed** renames (e.g. `summary|description → prose`, `phase|name → phaseName`, `timeframe|months → monthsLabel`, `points|items → bullets`).
3. `normalizePaidMediaPlanBody(snapped, onboardingOptions)` inside `try/catch` (thread the typed onboarding economics: `creativeCapacity`, `targetCac`, `targetTrialsPerMonth`, `cvrChain`, `channelHint` — pass BOTH the frame string for the prompt AND the typed object for the normalizer).
4. On throw → keep `deckMarkdown` (`narrativeMarkdown`, the primary Audit Reader surface) + emit an honest-gap typed body via `normalizePaidMediaPlanBody({}, options)` (synthesize-floors produce a valid minimal deck). **The deck surface must never silently vanish.**

**Orchestrator `gtmFields`:** keep fenced-JSON, but make `parseOrchestratorGtmFieldsFromText` **tolerant** too — `orchestratorGtmFieldsSchema` fields are all non-optional `z.string()`/`z.array(z.string())` with **no `.min()`**, so coercing missing scalars to `''` and `topCompetitors` to `[]` parses. A null `gtmFields` starves the section seed; the prose `researchDigest` survives independently regardless.

**`OPEN-needs-owner`:** the exact `snapComposerKeys` alias table must be built from real GLM emissions (run `zz-composer-glm.ts` on 2-3 subjects, dump fenced-JSON keys) — over-aliasing mis-snaps content into the wrong block (silent wrong-data, worse than null). The *architecture* (snap-then-normalize) is LOCKED; the alias table is a 30-min data-collection task.

**`Output.object` verify-probe (scripts only):** `createOpenAICompatible({ …, supportsStructuredOutputs: true })`, `generateText({ experimental_output: Output.object({ schema }), stopWhen: stepCountIs(≥8), maxOutputTokens: ≥12000 })`, access `result.experimental_output` in `try/catch` (it throws `NoObjectGeneratedError`). PASS only if it parses AND the deck is non-degenerate — even then fenced-JSON stays primary.

---

## 6. Anti-fabrication floor — no Opus, no LLM oracle (the contested call, resolved)

**Owner killed the oracle. The panel agrees for the supervised pilot, and is candid that the deterministic floor alone is NOT enough for a billable deck.** The resolution is a **three-leg minimum floor** — drop any leg and a billable deck carries silent fabrication:

**Leg 1 — Per-record quote↔URL binding (a BUG fix, not new policy, ~80 LOC, zero LLM).**
On the agentic path *today*, `quoteGrounded` (`provenance-detect.ts:417`) checks a quote against `groundingText` — the **whole concatenated transcript blob** — not against the specific URL the body attributes it to. So a real quote pulled from tool-result A and attributed to URL B **passes**. This is the exact laundering class (13 quotes in the A/B), and it is **invisible on the agentic path right now**. The "quote-at-URL" floor the owner believes is in force lives only in `source-liveness.ts` on the **dead answer-tool path** — shipping the agentic path swaps a stronger floor for a weaker one.
→ Build a per-record `Map<normalizedUrl, normalizedText>` in `buildGroundTruth` (the tool result carries both url and text in one `TranscriptRecord` — no second network call), replace whole-blob `quoteGrounded` with `quoteGroundedAtUrl`, **reuse** `isQuoteContainedInLiveText` (`source-liveness.ts:593`), and emit a new `quote_at_wrong_url` violation (FLAG/relabel at `CEIL_LAUNDERED=7`, **not** drop). **This must land in the same change that flips `LAB_AGENTIC_GLM_SECTIONS` on.**

**Leg 2 — Per-claim `[grounded: <url>] / [inferred] / [gap]` labels (generation-layer, not a model call).**
The irreducible residual — **hallucinated inference on correctly-grounded numbers** (the 3 invented bidder names were analysis on real CPCs; there is no span to check) — is **permanently un-gateable by determinism**. The only honest answer within the no-oracle lock: require GLM to tag every load-bearing claim at write time (in `GROUNDING_LAW`), render `[inferred]`/`[gap]` visibly distinct in the card, and feed tag counts into the deterministic `deriveAgenticEvidenceVerdict`. This makes truth-risk **visible to the paid operator** instead of building an LLM to grade an LLM — the value-not-evals north star applied literally.

**Leg 3 — Human-review-before-ship gate (load-bearing, not optional).**
No deck auto-ships or becomes shareable until an operator stamps acceptance; **Share/export is blocked below the human stamp** (today a 3/6 deck is already shareable — that hole must close). This human is the catch-net that makes "kill the oracle" safe. It is also the knob that flips when graduating to unsupervised.

**Other deterministic strips** stay as-is (exemplar-motif, numeric-coherence, misattributed-quote relabel) and run as **DROP-not-NUKE** — do NOT re-arm the whole-section `SectionRunnerError` guillotine (`LAB_VERIFIER_MAX_UNSUPPORTED=0`) on the agentic path; the "never throw, always commit honest-gap" behavior is correct for value-preservation. The composer goes under the **same** floor (it is exactly where GLM laundered before) — but deferred to the composer-wiring phase, since the composer isn't live yet. `composerStripFloor` (angles≥2, reviews===3, kpis≥2) is a **shape floor, not an anti-fab gate** — don't mistake it for grounding.

**`OPEN-needs-owner`:** for any future **unsupervised / auto-ship** path, the laundering-at-right-URL + hallucinated-inference residual has no deterministic catch AND no human catch — at that point a hard catch-net (oracle, OR a hard-block on `[inferred]` claims) becomes mandatory. Decide the unsupervised graduation criteria explicitly; don't let the supervised floor silently become the unsupervised floor.

---

## 7. Cost, latency, serverless budget & streaming

**Shape:** 4 separate 300s Node lambdas (orchestrate → bounded section pool → composer), chained by Supabase DB-state rollup (mirrors today's `dispatchPaidMediaIfSixComplete`). `export const maxDuration = 300; export const runtime = 'nodejs'` on **each** tier's route — never one mega-lambda.

**Pool concurrency = 3 (LOCK).** 6 sections = 2 waves. Each section is its own lambda with its own fresh 285s budget, so there is **no cross-section freeze-survival risk** — a slow section can't starve a sibling. The only ceiling is OpenRouter's per-key concurrent limit (orchestrator done + 3 sections = 3 concurrent GLM calls, well under typical limits). Drop to 2 ONLY if prod logs show 429s. Concurrency 2 just adds a ~200s wave for no benefit and worsens the silent-wait the owner hates.

**Streaming (owner's hard requirement) — wire `onStepFinish`, NOT `streamText`/SSE.** All three tiers use bare `generateText`, which accepts `onStepFinish` (verified `node_modules/ai/dist/index.d.ts:1436`), firing after each step incl. every tool round-trip (`step.text`, `step.toolCalls[]`, `step.usage`, `step.finishReason`) — per-step cadence (~10-30s) is exactly what kills the silent multi-minute wait. **Do not switch to `streamText`/SSE** — Vercel serverless breaks held-open SSE, and the GLM output is a fenced-JSON+markdown blob the user shouldn't see mid-stream.
→ Reuse the existing serverless-safe spine: `broadcastSectionPartial` (`realtime-broadcast.ts:28`, a stateless one-shot POST to Supabase Realtime with the service-role key) → `useSectionPartials` over `section-partials:<runId>`. Push `{ phase, step, lastTool }` into the open `snapshot` field of `sectionPartialPayloadSchema` (it's `z.record(string,unknown)` — **no migration**). Add pseudo-zones `orchestrator` and `composer` so the page shows them as their own progress rows. **Throttle** to ≤1 frame/sec (reuse the existing throttled broadcaster).
*Today the agentic path emits ZERO progress on every tier — this is a hard pre-launch gap, not a nice-to-have.* Requires `SUPABASE_SERVICE_ROLE_KEY` in prod (broadcast throws without it). Reserve `createAgentUIStreamResponse` for the interactive `/api/research-v2/chat` route only.

**The composer is the existential latency risk — not the orchestrator.** Clay: orchestrator p50 **161s** (124s under the 285s job budget — comfortable, keep in-app). Composer **281s** on its first try — 4s under the 285s budget. One slow top-up or a reasoning-token burn blows the wall and (with the strict parser) the deck silently disappears.
→ Lower `COMPOSER_MAX_STEPS` to **2** (1 optional top-up + 1 emit), keep composer tools **off**, and guard `finishReason==='length'`. If the composer regresses, **move the composer to the worker before the orchestrator.** Add a `finishReason!=='length'` assertion after the orchestrator call too (8000 tokens for BOTH a fenced block AND a 6-bucket digest is tight); on `length`, retry once at 12000 before promoting facts.

**Worker-move trigger (DEFER):** keep orchestrator + composer in-app until a hard SLO breaches — orchestrator p95 ≥ 240s sustained 7 days, OR `finishReason 'length'`/timeout rate ≥ 5%. The worker can't import `src/lib`, so moving the GLM agents there is a real port, not a flag.

**Budget estimate:** ~**14 min p50 / ~18 min p95** wall-clock (sequential, DB-gated: 161 + 200 + 200 + 281 ≈ 842s p50); ~**$3-4/run** (8 GLM calls ×~$0.30 ≈ $2.30-2.70 via OpenRouter + ~$0.50-1.00 tools). *These assume the projector KILL lands — if the second per-section GLM projection call stays, per-section cost & latency roughly double.*

---

## 8. The gap between "docs say shipped" and "actually works in prod" — 6 prerequisites the handoff missed

The handoff reported B+C+D+E built + live-proven. True at the module level. But the panel found the **live dispatch wiring is half-built**, and three of these are silent correctness bugs:

1. **🔴 Concurrency is a LIVE BUG, not a config.** `scheduleLabSectionJob` runs the GLM loop inside Next.js `after()` (post-response). `kickoffLabSectionJob`'s fetch returns *before* the loop runs, so `dispatchBounded(3)` bounds only the **6 HTTP kickoffs**, NOT the 6 concurrent `after()` GLM loops. **Real section concurrency is unbounded at 6.** Under GLM/Firecrawl rate limits + $0.30/section this is 429-starvation + token explosion exactly when you think it's capped at 3. **Fix before wiring:** either (PREFERRED) move section execution out of `after()` so the POST awaits the loop and `dispatchBounded`'s cursor genuinely caps in-flight lambdas, OR (lower-risk first wire) extend the existing `claimSectionRun` CAS with a pool-lease counter keyed on `parent_audit_run_id` (lease 1-of-N slots before starting, self-requeue on miss). Validate the lambda budget math: 6 sections at concurrency 3 awaited-in-parent = 2 waves ×161s ≈ 322s > 300s — so the **DB-lease shape (per-section lambdas) is safer than awaiting in one parent.**

2. **🔴 The shared ledger is WRITE-ONLY on the live path.** `prepareSectionContext` is called **without** `factStore`/`parentAuditRunId` (`lab-section-dispatch.ts:138`), AND the Supabase store's `getFacts()` returns only its own in-process `appended[]` echo — **never a DB SELECT**. So no section can read the orchestrator's or a sibling's facts; the topology degenerates to independent-but-blind jobs re-searching the same company. **Fix (the #1 prerequisite):** (a) pass `factStore` + `parentAuditRunId` into `prepareSectionContext`, and (b) replace the echo `getFacts()` with a real DB SELECT on `research_facts` by `parent_audit_run_id` (the index exists). Without both, the ledger's whole point — and the tool-economy win — is lost.

3. **🔴 Laundering is live-invisible on the agentic path.** (See §6 Leg 1.) The agentic floor is strictly weaker than the answer-tool path it replaces. The per-record quote↔URL port must land in the same change that enables the agentic path.

4. **🟠 OpenRouter not defaulted.** (See §3.) Unset prod env → every GLM call hits localhost and fails. Add the non-localhost prod assertion.

5. **🟠 Zero visible progress on the agentic path.** (See §7.) Wire `onStepFinish` → existing broadcast spine.

6. **🟠 Orchestrator + composer are UNWIRED.** Confirmed: zero importers outside `__tests__`/`zz-` scripts. The live dispatch still runs the 6 sections directly + paid-media as a 7th (legacy DeepSeek/projection). The decoder fix (§5) and the wiring are **coupled — ship together or the fix is dead code.**

---

## 9. Execution sequence (ordered; prerequisites gate the wire-up)

**Phase 0 — Commit (owner-gated).** Ask first. Two atomic commits: (1) the un-caged engine slice (reviewed), (2) B+C+D+E from the handoff.

**Phase 1 — Prove GLM runs live + un-cage ONE section.** Set `LAB_AGENTIC_GLM_SECTIONS=positioningVoiceOfCustomer` on `/research-v3`; convert the silent agentic fallback to a loud `agentic_fallback` telemetry event; run one live dispatch and **watch telemetry prove GLM tool-loop steps (not DeepSeek fallback)**. This closes the single most dangerous open question — GLM has **never** run in the live dispatch (0/5 in the Vanta E2E). **Land the per-record quote↔URL port (§6 Leg 1) in this same change.**

**Phase 2 — Kill the projector, bind schema via the composer decoder.** Delete `agentic-glm-projector.ts` (the 2nd-GLM cage); the typed body comes from the composer's tolerant decoder. Confirms blind A/B holds (8-9) and removes a full per-section GLM round-trip.

**Phase 3 — Make the ledger READABLE, then wire orchestrator + composer (HOLD until Phase 1 proves the foundation).** Fix prerequisites #1 (concurrency) and #2 (write-only ledger) FIRST. Then wire the orchestrator as a pre-pass (new route or `/orchestrate` step) → bounded pool reads the ledger → composer (`composePaidMediaPlan` with the §5 decoder) replaces the paid-media 7th section. Put the composer output under the §6 floor. Wire `onStepFinish` streaming (§7) across all three tiers.

**Phase 4 — Turn the path ON in prod + the human gate (owner-applied).** Set the OpenRouter env (§3) + the non-localhost assertion; `LAB_SECTION_POOL_CONCURRENCY=3`; block Share/export below the human-acceptance stamp (§6 Leg 3). One live `/research-v3` run on a real subject; confirm value + telemetry.

**Phase 5 (DEFER) — worker-move + unsupervised graduation.** Only on a measured SLO breach (§7); move the composer before the orchestrator. Decide the unsupervised anti-fab catch-net (§6 OPEN) before any auto-ship.

---

## 10. Open-needs-owner decisions (short list)

1. **Perplexity keep/kill** — authorize the ~$1-2 A/B (§4). Default KEEP.
2. **`snapComposerKeys` alias table** — 30-min data-collection from live GLM emissions (§5).
3. **Concurrency fix shape** — DB-lease (recommended) vs await-in-parent (§8.1).
4. **Unsupervised anti-fab catch-net** — required before any auto-ship path (§6).

---

## 11. Verify (offline, free)
```
npx tsc --noEmit                                   # baseline 0 errors
npm run test:run -- src/lib/lab-engine src/lib/research-v2 src/app/api/research-v2 src/components/research-v2
```
Live generation proof (Ollama Cloud GLM, ~$0.30/call):
```
npx tsx scripts/zz-orchestrator-glm.ts --url https://www.clay.com --subject clay --max-steps 10
npx tsx scripts/zz-composer-glm.ts --subject clay --max-steps 2
```

## 12. Provenance & pointers
- Code-grounded by `wf_59d7f3c3-678` (7 ground-truth readers + 5 design lenses, all verified against the working tree, `ai@6.0.178`, `@ai-sdk/openai-compatible@2.0.48`).
- Canonical map: `docs/source-map.md`. DOX + gotchas: `CLAUDE.md`. GLM/OpenRouter transport: ADR-0012.
- Superseded-but-historical: `docs/plans/2026-06-23-final-agentic-architecture.md`, `docs/plans/2026-06-24-gtm-framework-and-backward-design.md`, `docs/handoffs/2026-06-24-LOCK-agentic-research-to-media-plan.md`, `docs/handoffs/2026-06-24-HANDOFF-glm-research-arc-B-to-E-built.md`.
- **Operating contract (binding):** owner is a non-coding vibe-coder — verify every API against installed `node_modules` `.d.ts`, prove it (`tsc` clean + targeted tests), TDD failing-test-first; do not commit unless asked; never invent status/data/endpoints/verification; minimal diffs matching local style.
