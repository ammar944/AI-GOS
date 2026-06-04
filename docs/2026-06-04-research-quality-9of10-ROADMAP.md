# Research Quality → 9/10 — Master Roadmap & Task Registry

**Owner:** Ammar · **Execution:** Codex (`-c model_reasoning_effort=xhigh`, research-then-implement per task) · **Verification:** Claude (diff review + live run is the gate) · **Created:** 2026-06-04 · **Branch:** `feat/research-quality-truthgate`

This is the source of truth. Each task below is a self-contained Codex assignment: it carries its own RESEARCH step (investigate the codebase first), IMPLEMENT step, VERIFY step, and any DECISION GATE. Update the **Status** column as we go. Per-task deep handoffs get written just-in-time (Codex or Claude) when a task is picked up.

---

## The vision (what 9/10 means)

Research output that is **(1) never fabricated or hallucinated, (2) built on real data not model estimates, and (3) strategically devastating** — it says non-obvious, senior-level things that make a sharp marketer email it to their CEO with "we should talk about point 2." Not polished dog-shit. The best GTM frameworks, fully leveraged, producing insight a competent human + ChatGPT could not.

## The core reframe (read this first — it sets the priority)

The last six months made the output **trustworthy** (truthgate, evidence gates, provenance, contamination removal). That was the right first investment. But **trust and insight are orthogonal axes** — and we maxed trust while barely touching insight. The current best output (`tmp/2026-06-04-truthgate-e2e-v2/UPGRADED-RAMP-AUDIT.md`) is a world-class *trust artifact* that is still, strategically, **a competent summary with a confidence overlay.** It tells the client what their own CFO already knows.

The reason is architectural: **six sections are researched in isolation, then a capstone that is forbidden to re-research compresses them into a few pre-grounded angles. Insight lives in the collisions between sections — and nothing in the pipeline is built to find collisions. We built a verifier. We never built a thinker.**

So the work splits into **three axes**, and the biggest lever is the one we've barely touched:

| Axis | State today | The lever |
|---|---|---|
| **A. Trust** (no fabrication) | ~80% solved (truthgate) but the programmatic judge is brittle (`'No object generated'` on every section) | Replace the entailment-judge machinery with one strong-model **agentic review pass** (already spec'd) |
| **B. Richness** (real data, not estimates) | Two of three data tools are **already built but stranded** in the legacy worker path | Re-wire SpyFu + port the real review-body scraper + a bottom-up TAM recipe |
| **C. Insight** (mind-blowing strategy) | **Barely started** — the system has no cross-section reasoning, no contrarian forcing, no thinker | Build a frontier-model **cross-section reasoning + adversarial critic**, depth-forcing skills, model-tiering |

---

## Phasing (execution order)

- **Wave 0 — Foundation:** strong-model tiering + the agentic review pass. Unblocks the run (VoC stops nuking capstones) and gives every later task a frontier model to call. **Do first.**
- **Wave R — Richness:** real keyword data, real review quotes, real TAM. Independent of the insight work; can run in parallel once Wave 0's model knob exists.
- **Wave I — Insight:** the thinker. The biggest quality lever. Depends on Wave 0 (needs the frontier-model knob) and is *much* better with Wave R (real data to reason over).
- **Wave G — Gate:** the 9/10 strategic rubric + live E2E validation. The live run — scored against the rubric — is the gate, **not** the unit suite (two prior lanes were unit-green and LIVE_FAIL).

---

## Decision gates (resolve these once; they cut across tasks)

- **DG-1 — Strategy/judge model.** Default **Claude Sonnet 4.5** (wired today via `@ai-sdk/anthropic`); option **GPT-5.5 via AI Gateway** (`@ai-sdk/gateway`, precedent in `src/lib/company-intel/run-company-research.ts`); option **Opus** for the once-per-audit cross-section reasoning. Recommend: Sonnet for per-section review, **Opus/GPT-5.5 for the cross-section reasoning + critic** (runs once per audit — cost is cents).
- **DG-2 — Render shape.** Markdown-first client view (recommended) vs. keep typed cards primary. (See agentic-review SPEC §0.)
- **DG-3 — New paid data key?** The realistic Richness plan needs **no new key** (SpyFu + Firecrawl + SearchAPI already on hand). A dedicated G2/Capterra reviews API is the only thing that would need new spend — deferred unless G2 specifically is must-have.

---

## TASK REGISTRY

| ID | Task | Axis | Effort | Depends on | Status |
|---|---|---|---|---|---|
| **T1** | Strong-model tiering foundation | Foundation | S | — | ☑ Done |
| **T2** | Agentic Section Review Pass (trust + unblock run) | A. Trust | L | T1 | ◐ Code gate green; live gate pending |
| **T3** | SpyFu keyword economics — fund + harden + trends fallback | B. Richness | S–M | T1 | ◐ Code gate green; live gate pending |
| **T4** | Real VoC review bodies — port the stranded extractor | B. Richness | M | — | ◐ Code gate green; live gate pending |
| **T5** | Bottom-up TAM recipe + market-category SKILL rewrite | B. Richness | S–M | T3 | ◐ Code gate green; live gate pending |
| **T6** | Depth-forcing skills (shared strategic preamble + verdict fields) | C. Insight | M | — | ☐ Not started |
| **T7** | Cross-section reasoning agent (the thinker) | C. Insight | L | T1, T2 | ☐ Not started |
| **T8** | Adversarial "so-what" critic pass | C. Insight | M | T1, T7 | ☐ Not started |
| **T9** | Capstone rebuild — compressor → strategist | C. Insight | L | T6, T7 | ☐ Not started |
| **T10** | 9/10 strategic rubric + "knew-that" gate | D. Gate | M | T6–T9 | ☐ Not started |
| **T11** | Live E2E validation (Ramp + 2nd company) vs rubric | D. Gate | M | all | ☐ Not started |
| **T12** | *(optional)* Cross-section memory at draft time | C. Insight | M | T1 | ☐ Optional |
| **T13** | Deepen the initial corpus — the upstream foundation everything flows from | B. Richness / Foundation | M–L | — | ◐ Code gate green; live gate pending |

---

## TASK DETAIL

### T1 — Strong-model tiering foundation `[Foundation · S]`
**Goal:** Decouple the strategy/review/judge model from the cheap section-draft model. Today `defaultEntailmentJudge` reuses `sectionRunnerModel` (= `deepseek-v4-flash`) — the single line that killed the judge.
**Research:** `src/lib/lab-engine/ai/models.ts` (`SectionModelSelection`, `resolveSectionModelProvider`); the gateway precedent `src/lib/company-intel/run-company-research.ts:408-434`.
**Implement:** Add a `reviewModel` / `strategyModel` to the selection, resolved independently of `LAB_ENGINE_PROVIDER` via a new knob (`LAB_REVIEW_MODEL`), default Claude Sonnet 4.5; support Opus + GPT-5.5-via-gateway. Keep cheap DeepSeek for drafting/retrieval.
**Verify:** `tsc` + a unit test that the review model resolves independently of the section provider. **Decision:** DG-1.

### T2 — Agentic Section Review Pass `[A. Trust · L]`
**Goal:** Replace the brittle entailment-judge machinery with one strong-model read-and-upgrade pass per section: returns upgraded markdown + tiny metadata tail (tier, rationale, removedItems[], clientQuestions[]). Makes VoC author an honest gap (no fabricated quotes) → **unblocks capstones** (the bug that LIVE_FAILed twice). Proven approach: `tmp/2026-06-04-truthgate-e2e-v2/UPGRADED-RAMP-AUDIT.md`.
**Full spec already written:** `docs/handoffs/2026-06-04-agentic-review-pass-SPEC-codex.md` — execute that. Retires `structuralVerifierWithEntailment`/`defaultEntailmentJudge`; keeps A3 tier persistence (re-sourced from the agent). **No big structured schema** (that's what failed).
**Verify:** live Ramp run reaches 6/6 + capstones; sections in the `UPGRADED-RAMP-AUDIT.md` quality class. **Decisions:** DG-1, DG-2.
**2026-06-04 Codex evidence:** Wave 0 code gate green. VoC minimum/self-domain/single-source-majority failures now commit evidence-gap artifacts instead of terminal failures; `run-section.ts` uses deterministic structural verification instead of `structuralVerifierWithEntailment`; agentic review has `LAB_REVIEW_TIMEOUT_MS` commit-path guard. Proof: `pnpm exec tsc --noEmit` 0; `pnpm run test:run` 173 files / 1473 tests passed / 1 skipped; `pnpm run build` clean. Live Ramp gate still pending.

### T3 — SpyFu keyword economics: fund + harden `[B. Richness · S–M]`
**Goal:** Kill the "estimated CPC/volume" leak in demand-intent at the source. The tool is **already fully built** (`src/lib/ai/spyfu-client.ts` → `keyword_volume`); the gap is operational.
**Research:** `src/lib/ai/spyfu-client.ts`, `src/lib/lab-engine/agents/tools/keyword-volume.ts`, `src/lib/env.ts` (SPYFU_API_KEY is `optional`), `positioning-demand-intent/SKILL.md` (the "drop the keyword if no SpyFu volume" IRON LAW).
**Implement:** (a) promote `SPYFU_API_KEY` to **required** in `env.ts` + `/api/health` gate so a missing/unfunded key fails loud, not silently-estimates; (b) verify the key is funded + quota in Vercel prod (one probe call, scrub the key from output); (c) add a **degraded-but-real** `keyword_trends` fallback using SearchAPI's unused `engine=google_trends` (real relative interest) so demand-intent attaches a falsifiable signal instead of dropping every row when SpyFu 429s.
**Verify:** demand-intent run shows tool-sourced (not model-estimated) keyword rows; trends fallback fires when SpyFu is unavailable. **Decision:** DG-3 (none needed — key on hand).
**2026-06-04 Codex evidence:** T3 code gate green. `SPYFU_API_KEY` is now required by env validation and `/api/health`; Demand Intent can use `keyword_volume` first and `keyword_trends` (SearchAPI Google Trends relative interest) as the bounded fallback; the provenance guard is row-scoped and rejects unmatched SpyFu/Trends claims, CPC/numeric siblings without matching SpyFu evidence, model-estimated keyword economics, and empty Trends result shells. One scrubbed SpyFu probe returned HTTP 200 with one result and search-volume data for `project management software`, confirming the local key is valid/funded for this endpoint. Proof: `pnpm exec tsc --noEmit` 0; targeted T3 Vitest 9 files / 75 tests passed; `pnpm run test:run` 175 files / 1492 tests passed / 1 skipped; `pnpm run build` clean; `pnpm run lint` 0 errors / 32 existing warnings; QA re-review GO on the prior row-scoping/no-data blockers. Live Demand Intent gate still pending.

### T4 — Real VoC review bodies: port the stranded extractor `[B. Richness · M]`
**Goal:** VoC gets **real verbatim reviews across ≥3 independent sources**, not 160-char Google SERP snippets. The live `reviews` tool returns snippets; the **real review-body extractor already exists** at `research-worker/src/tools/reviews.ts` (`extractTrustpilotReviews`, `extractG2Reviews`) but is stranded in the legacy worker path.
**Research:** live `src/lib/lab-engine/agents/tools/reviews.ts` (snippet-only) vs. worker `research-worker/src/tools/reviews.ts` (real parsers — read its battle-tested comments: Trustpilot scrapes reliably, G2/Capterra bot-wall Firecrawl to ~43-char stubs). Worker can't import from `src/lib/`, so this is a **copy-port**, not a shared module.
**Implement:** add a `mode:"bodies"` path to the live `reviews` tool: discover review URL via SearchAPI → Firecrawl-scrape (`blockAds:true`) → split into review blocks. Realistic source set: **Trustpilot + Reddit/HN + Firecrawl'd forum/comparison pages** (reliable); G2/Capterra/TrustRadius opportunistic. Keep the VoC `≥3 distinct sources` rule; this feeds it real material.
**Verify:** VoC run produces verbatim quotes with reviewer role/date/URL across ≥3 domains (or commits an honest gap via T2 if it genuinely can't). **Decision:** DG-3 (G2-reliable would need a paid API — deferred).
**2026-06-04 Codex evidence:** T4 code gate green. Live `reviews` now has `mode:"bodies"`: SearchAPI discovery → bounded Firecrawl v2 scrape with `blockAds:true` → G2/Trustpilot/generic body extraction; body mode returns a non-consuming content gap instead of promoting SERP snippets when no usable review body is found. VoC prepass calls `reviews` in body mode and only promotes `reviewText` into review candidates, preserving the T2 honest-gap path. Proof: `pnpm exec tsc --noEmit` 0; `pnpm run test:run` 174 files / 1477 tests passed / 1 skipped; `pnpm run build` clean; `pnpm run lint` 0 errors / 32 existing warnings. Live Ramp gate still pending.

### T5 — Bottom-up TAM recipe + SKILL rewrite `[B. Richness · S–M]`
**Goal:** Replace opaque aggregator-cited TAM with a bottom-up figure the pipeline can actually compute and cite. No new tooling.
**Research:** `positioning-market-category/SKILL.md` (its triangulation IRON LAW already forbids invented TAM but has no tool to satisfy "bottom-up").
**Implement:** define a named recipe — **(real keyword volume from T3) × (commercial-intent share) × (conversion + ACV from Firecrawl-scraped pricing pages)** → defensible reachable-revenue, each multiplier carrying a `sourceUrl`. Rewrite the SKILL methodology + small schema nudge to force cited multipliers; keep the analyst figure as the *check*, not the basis.
**Verify:** market-category run emits a TAM/SAM with every input source-cited (or honestly labeled). **Depends on T3.**
**2026-06-04 Codex evidence:** T5 code gate green. Market Category now requires `body.marketSize.bottomUpTam` using the named `keyword-demand-reachable-revenue` recipe with four required inputs (`keyword-volume`, `commercial-intent-share`, `conversion-rate`, `acv`), sourced input URLs, honest evidence-gap handling, and a guard that prevents numeric reachable-revenue estimates when any recipe input is an evidence gap. The Market Category SKILL and prompt guidance now require keyword-demand math and allow `keyword_volume`; the renderer displays the TAM recipe, source title/date/URL, and legacy evidence-gap fallback rows for saved artifacts that predate the new field. Proof: targeted T5 Vitest 10 files / 69 tests passed; final schema+renderer regression rerun 2 files / 12 tests passed; `pnpm exec tsc --noEmit` 0; `pnpm run test:run` 176 files / 1499 tests passed / 1 skipped; `pnpm run build` clean; `pnpm run lint` 0 errors / 32 existing warnings; QA re-review GO on the prior legacy-renderer/numeric-gap blockers. Live Market Category gate still pending.

### T6 — Depth-forcing skills (shared strategic preamble + verdict fields) `[C. Insight · M]`
**Goal:** The skills are built for honesty, not insight — frameworks "collect the inputs to a judgment, then never require the judgment." Force the judgment. Keep context cost flat by adding ONE shared preamble, not bloating 7 files.
**Research:** all 7 `src/lib/lab-engine/skills/positioning-*/SKILL.md`; the loader `src/lib/research-v2/lab-section-job.ts` (`loadLabSkill` — wholesale injection, no shared preamble today); the section schemas in `src/lib/lab-engine/artifacts/schemas/`.
**Implement:** (a) a shared **"GTM Strategic Standard"** preamble injected ahead of every section: forces a one-sentence *strategic verdict*, a *contrarian/non-obvious read* (with the VoC-style honest "no insight here" escape hatch), *second-order implication*, and *named tension*. (b) Per-section schema-gated fields that can't be filled by summary: `nonObviousRead`, `keyTension { tension, side, costOfPosition }`, and for offer/demand a sequenced `orderedMoves[] { rank, dependsOn, rationale }` + `provesWrongIf { metric, threshold, window }`. Validation rejects vacuous/restated fills (mirror the existing evidence-gap pattern). Per-section upgrades from the audit: VoC force the Four-Forces *balance verdict*; competitor force *where-to-attack-vs-concede* + incumbent blind-spot; offer force the *single binding constraint*; market force the *category-power bet*.
**Verify:** sections emit committed verdict/tension/contrarian fields; a live run shows them non-vacuous. **This is the "best skills" lever.**

### T7 — Cross-section reasoning agent (the thinker) `[C. Insight · L]`
**Goal:** The single highest-leverage move. Insert a stage **between** the six sections and the deliverable whose only job is to find what no single section could see — the P5 cross-section threads. Runs on a frontier model (Opus/GPT-5.5), reads all six committed artifacts **plus their evidence**, and *interrogates* rather than summarizes.
**Research:** `run-section.ts` commit flow + the orchestrate fan-out; `positioning-synthesis` skill + schema (today: forbidden to re-research, counts `sourceSection` citations per-document — structurally optimizes *against* cross-section insight).
**Implement:** a new reasoning stage with output fields that can't be compressed: `crossSectionThreads[] { claim, sourceSections[≥2], whyNonObvious }`, `clientBlindSpot`, `namedTension { side, costAccepted }`, `secondOrderRisk`, `contrarianInversion`. Validator requires each thread to cite **≥2 distinct sections**. Frontier model (DG-1). Output feeds T9.
**Verify:** live run produces ≥1 genuine cross-section thread (a claim false/invisible in any single section). **Depends on T1, T2.**

### T8 — Adversarial "so-what" critic pass `[C. Insight · M]`
**Goal:** A frontier-model adversary that attacks every strategic sentence with: *"a senior GTM consultant reads this and says 'so what — I knew that.' True?"* Sentences that fail are killed or sent back to deepen. Same machine as the evidence verifier, pointed at *insight density* instead of grounding.
**Research:** the existing verifier/repair loop (`shouldRepairAttempt`, repair reasons in `run-section.ts`) — graft a `strategicDeepen` reason.
**Implement:** a critic agent over the reasoning output (T7) + each section's strategic fields; ≥40% of synthesis sentences must pass the "knew-that" test (T10 rubric) or get deepened/cut.
**Verify:** before/after — critic measurably raises the insight-density of a live run's synthesis. **Depends on T1, T7.**

### T9 — Capstone rebuild: compressor → strategist `[C. Insight · L]`
**Goal:** The paid-media/synthesis capstone is the biggest single gap (no framework, just field assembly). Rebuild it to *think*, anchored by T7's threads.
**Research:** `positioning-paid-media-plan/SKILL.md` + `positioning-synthesis` schema.
**Implement:** force (a) a single **strategic thesis** the whole plan executes ("this plan bets that [segment] at [awareness] can be moved by [force] with [defensible differentiator] because [cross-section evidence]"); (b) a **contradiction-reconciliation** step (where do the 6 sections disagree — resolve before planning); (c) **sequenced** `orderedMoves[]` with `dependsOn` + learning-priority (first-money = highest-information bet, not strongest-evidence); (d) every money value keeps provenance enums; every bet carries `provesWrongIf`. The plan must trace to the thesis.
**Verify:** capstone output names a thesis + a reconciled contradiction + sequenced bets with kill-criteria. **Depends on T6, T7.**

### T10 — 9/10 strategic rubric + "knew-that" gate `[D. Gate · M]`
**Goal:** Make "9/10 strategic" checkable. This gate sits **after** the truthgate — honesty is the price of admission, not the achievement.
**Implement:** encode the rubric (8 properties: contrarian thesis / cross-section thread [absence caps at 6] / named tension w/ side / second-order / sequenced moves / kill-criteria / ≥40% sentences pass the "knew-that" sweep / conviction-without-false-certainty) as (a) the critic's scoring prompt (T8) and (b) a human/Claude sign-off checklist. Disqualifiers: reads like Wikipedia+brief → ceiling 5; no cross-section insight → ceiling 6; hedges everything → ceiling 6.
**Verify:** the rubric reliably separates the current 6/10 Ramp specimen from a T6–T9 upgraded run.

### T11 — Live E2E validation `[D. Gate · M]`
**Goal:** Prove the delta on real runs. **The live run is the gate, not the test suite.**
**Implement:** one live Ramp + one second-company (different category) E2E after each wave; capture evidence (like `tmp/2026-06-04-truthgate-e2e-v2/`); score against T10's rubric; Claude verifies the diff (never trust Codex self-report — `feedback_codex_drifts_on_ambient_context`).
**Verify:** 6/6 + capstones complete; sections trustworthy (A) + data-backed (B) + scoring ≥9 on the strategic rubric (C).

### T12 — *(optional)* Cross-section memory at draft time `[C. Insight · M]`
**Goal:** The cheap 20%-buys-60% partial of T7: each section, on commit, writes 2–3 "signals for other sections" into shared state; later sections read prior signals. Gets *some* cross-section awareness at near-zero cost. Does not replace T7. Do only if T7 proves too heavy to land quickly.

### T13 — Deepen the initial corpus (the upstream foundation) `[B. Richness / Foundation · M–L]`
**Goal:** Everything downstreams from the corpus — it's the shared substrate every section drafts from and the material the cross-section thinker (T7) reasons over. Today it's a single thin ~4K-char `sonar-pro` Perplexity pass (6-source/8-evidence floor, forbidden from section-level proof). A thin seed forces sections to either re-research in isolation or fall back to estimates. Deepen it into a real multi-source intelligence foundation. *(Note: the old "corpus isn't the binding constraint" finding held in the isolated-sections era; with the T7 thinker + the richness layer, corpus depth now compounds across every section.)*
**Research:** corpus runner `research-worker/src/runners/` (`runDeepResearchProgram`); `src/lib/research-v2/corpus-to-research-input.ts`; the corpus schema/floor + how sections consume `researchInput.corpus.excerpts`; what a deep multi-pass corpus should contain (company truth, market, competitors, buyers, pricing, recent events) with source lineage per fact.
**Implement:** replace the single shallow pass with a deeper, multi-query, multi-source fan-out that produces a structured, source-cited intelligence base (more excerpts, deduped, typed by topic) — feeding both the six sections and the T7 thinker. Keep every corpus fact source-lineaged (no fabrication; same honesty discipline). Don't let corpus depth become a paid-API loop without an abort condition.
**Verify:** a live run shows sections + the thinker drawing on a materially richer, source-cited corpus; section drafts lean less on `[model estimate]`. **Feeds:** every section + T7/T9. Land it early in Wave R so the insight wave reasons over real depth.
**2026-06-04 Codex evidence:** T13 code gate green. Worker corpus now runs a primary Perplexity corpus pass plus three bounded topic fan-out calls (company/market/buyers, competitors/pricing/offer, VoC/demand/recent events), requires 10 cited sources, 16 grounded evidence items across `corpus.evidence` + `intelligenceTopics[].evidence`, and 6 topic buckets; exact duplicate claim/quote/url triples do not inflate the evidence floor. App adapter flattens topic evidence into global `corpus.excerpts`, routes mapped topics into section-scoped pools, and keeps unmapped topics such as `recent_events` as shared section context. Proof: `pnpm exec tsc --noEmit` 0; `pnpm run test:run` 174 files / 1478 tests passed / 1 skipped; `pnpm run build` clean; `pnpm run lint` 0 errors / 32 existing warnings; `npm run build` in `research-worker` clean; `pnpm vitest run src/lib/research-v2/__tests__/corpus-to-research-input.test.ts` 10 tests passed; `pnpm exec vitest run --root research-worker src/__tests__/deep-research-program.test.ts --reporter=verbose` 7 tests passed. Worker-local `npm run test:run -- src/__tests__/deep-research-program.test.ts` hung inside the worker-local Vitest CLI and was replaced by the root Vitest runner for this gate. Live corpus-depth gate still pending.

---

## How we execute (operating model)
1. **Pick a task** (respect the dependency column). Update Status → `In progress`.
2. **Codex research-then-implement:** write/expand the per-task handoff (Codex or Claude), then `codex exec -c model_reasoning_effort=xhigh` with the self-contained brief. Codex investigates the cited files first, then implements.
3. **Claude verifies the diff** + runs the gate. Never trust the self-report.
4. **Live run is the acceptance gate** (T11 protocol), scored against the T10 rubric — not the unit suite.
5. Update Status → `Done`. Move to the next.

## Reference map
- Proven 9/10 target: `tmp/2026-06-04-truthgate-e2e-v2/UPGRADED-RAMP-AUDIT.md` · failed-run root cause: same dir's `REPORT.md` + `next-dev.log` + `judge-fallback-grep.txt`.
- Trust-pass spec (T2): `docs/handoffs/2026-06-04-agentic-review-pass-SPEC-codex.md`.
- Quality vision/rubric: `docs/handoffs/2026-06-04-research-hub-quality-audit.md`.
- Architecture: `docs/source-map.md` · env knobs: `CLAUDE.md`.
- Key files: skills `src/lib/lab-engine/skills/positioning-*/SKILL.md` (loader `src/lib/research-v2/lab-section-job.ts`); models `src/lib/lab-engine/ai/models.ts`; tools `src/lib/lab-engine/agents/tools/` + stranded extractor `research-worker/src/tools/reviews.ts` + `src/lib/ai/spyfu-client.ts`; section runner `src/lib/lab-engine/agents/run-section.ts`; capstone `positioning-synthesis` / `positioning-paid-media-plan` skills.

**One-line mandate:** trust is the price of admission (Wave 0/A), real data is the substrate (Wave R), and the thinker — cross-section reasoning + adversarial critic + depth-forcing skills on a frontier model — is what turns a verified summarizer into a junior partner who actually thinks (Wave I). Ship in that order; the live run scored against the strategic rubric is the only gate that counts.
