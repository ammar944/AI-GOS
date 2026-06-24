# AIGOS Research — Final Agentic Architecture (decision-ready)

**Date:** 2026-06-23 · **Branch:** `refactor/architecture-deepening` · **Status:** direction proposal, owner ratification required on §6 bar before Phase 1 ships.

Source: 15-agent study (`wf_064bef63-089`) — 6 ground-truth readers → 4 architecture proposals → 4 adversarial stress-tests → synthesis. Every fact below was re-verified against the repo.

---

## 0. Cold truth — why 6 months produced slop

The pipeline is a **deterministic assembly line with an LLM bolted into the middle**. The disease is that mismatch, and the evidence is in the code:

- `run-section.ts` = **15,696 lines** (verified) — bigger than all sibling agent files combined. 232 `repair` + ~196 `gap` + ~50 `rescue` references. That is not an agent; it is a fossil record of patches built around a model the team does not trust.
- The section list is hardcoded (6 + paid-media), order fixed, schemas `.strict()` with count floors, tools whitelisted per section, step budgets uniform (16 for every section).
- The model has latitude over exactly two things — which URLs to fetch, what prose to write — and even the prose gets force-projected into a strict Zod body by a **second GLM call** (`agentic-glm-projector.ts`, 566 lines, verified). On any zod-miss it **throws away the whole GLM section and falls back to DeepSeek**.
- The team already proved free-form agentic scores **8–9 blind vs 1–3** for the caged path. The good engine (`agentic-glm-runner.ts`, verified) is installed and bolted shut behind `LAB_AGENTIC_GLM_SECTIONS`, **which never reaches the live dispatch** (S1162: 0/5 agentic in the Vanta E2E — the empty-tools guard falls every section back to DeepSeek). **Every real user today gets DeepSeek-through-a-schema-guillotine. That is the slop.**

**Your instinct is right on three counts, dangerously wrong on one.**
- ✅ "Real agents = goal + tools + loop, not 6 caged things." Verbatim the Anthropic agent definition; the repo's own blind A/B proves it.
- ✅ "The evals kill output." `LAB_VERIFIER_MAX_UNSUPPORTED=0` hard-fails the **whole section** on one unsupported claim. The harness verdict proves it's the guillotine, not contention: **5 of 7 sections gate-failed in-process with no fan-out.**
- ✅ "GLM is caged." The schema-in-loop answer tool + the prose→projector→reject ladder are real cages, documented in code comments.
- ❌ "Drop the gates and trust the model." On **this** model, in **this** repo, that ships confident lies. GLM here **laundered 13 Perplexity quotes** (real quote, wrong attribution), **invented 3 SpyFu bidder names** (hallucinated inference on correctly-fetched numbers), and **fabricated a source closed-book** (invented a founder + a real-looking URL). The deliverable is a media plan a human bills to paying clients. A fabricated bidder at `confidence:0.4` is worse than an empty cell — it looks done.

**The fix is not "remove the guillotine." It is "replace the guillotine with a scalpel":** per-claim strip-and-flag, a few load-bearing deterministic floors that DROP (not nuke) the fabrication class, plus a hard LLM oracle for laundering. **Lean on the model for value; never lean on it for its own grounding.**

---

## 1. The architecture — ONE decision: **1 + (2–3) + 1**

Your literal question — "6 agents, or 1, or 2?" — answer: **one orchestrator + a bounded pool of 2–3 concurrent section subagents (drawn from the 6) + one long-context composer.** Not 6 uncapped. Not 1 monolith.

**Why this exact shape (from the economics, not vibes):**
- Anthropic's multi-agent data: lead+subagents beat single-agent Opus **90.2%** on breadth-first parallel search. Your 6 sections **are** 6 independent search directions → parallel subagents justified for the *gather* phase.
- But multi-agent **loses** on coherent synthesis with cross-dependencies, and token use explains ~80% of cost variance at **~15× spend** → do NOT run 6 agents each re-deriving the same company facts (that is today's 15×-waste-plus-fabrication-multiplier).
- And do NOT collapse to one monolith ("treat it like Opus" taken literally): the stress-test killed it. On a **stateless 300s Vercel lambda you cannot pause an agent mid-loop** for the human brief checkpoint (zero pause/resume machinery exists); one derailed identity poisons all 7 regions where today 5 can commit while 1 starves; and one emit of 6 bodies + the deck **does not fit the output-token ceiling.**

So: **parallel where search wants breadth, single-headed where synthesis wants coherence, bounded so it doesn't starve the 300s wall.**

```
URL in
  │
  ▼  ORCHESTRATOR  (1 agent, GLM-5.2 agentic loop, on the worker)
     step 1  identity-lock (TLD-collision-safe topic reconcile)
     step 2  extract the 28 GTM fields
     step 3  corpus gather over the intelligence buckets
     → writes every fact to a SHARED LEDGER with quote-at-URL ADMISSION
       (a fact is admitted only if its text is present at its cited URL)
     → emits deepResearchCorpusSchema + onboardingFields, STREAMING partials
  │
  ▼  [ HUMAN CHECKPOINT — GTM Brief review ]   ← confirmation, NOT a compute wait
  │     (Supabase write + resume; this seam is unavoidable on Vercel — accept it, don't fake a pause)
  ▼  SECTION POOL  (2–3 concurrent of 6, each a GLM agentic loop)
     Market · BuyerICP · Competitor · VoC · Demand · Offer
     each READS the shared ledger first (no re-deriving the same facts)
     each does TARGETED top-up fetches only where ledger evidence is thin
     each WRITES grounded findings back (append-only, URL-pinned)
     per-section effort budget: thin = 3–6 steps, rich = 12–16
     in-loop cite-or-retract; emits FREE MARKDOWN (no schema mid-loop)
  │
  ▼  COMPOSER  (1 long-context Opus 4.8 / 1M)
     reads union of ledger + 6 section markdowns
     reconciles cross-section coherence BY CONSTRUCTION (ICP ⟷ competitors ⟷ demand keywords agree)
     emits typed bodies via Output.object (schema bound ONCE, here) + the 13-page media-plan deck
     runner does ALL math; HARD floors: quote-at-URL · exemplar-motif · numeric-coherence (DROP)
     + LLM acceptance oracle (HARD catch-net for laundering)
  │
  ▼  Media-plan deck + 6 positioning cards out
```

One research wait (orchestrator, streamed). The brief is a human confirmation, not a compute wait. Then one section+compose wait, streamed card-by-card. **Two visible compute waits collapse to one**; the brief seam stays because the platform forces it — honest, unlike a faked mid-loop pause.

---

## 2. How each of your four complaints dies

**(a) Two waits → one flow.** Today the corpus is *built to be* the shared evidence base, but `corpusToResearchInput` flattens the typed `intelligenceTopics`/`evidence` into plain text excerpts and every section **re-researches the same web** with its own 4–8 lookups — so the expensive corpus degrades to onboarding-prefill and the web is searched twice. Fix: the orchestrator's corpus pass writes a **real ledger the sections READ instead of re-deriving**; sections do targeted top-up only where evidence is thin. Kills the double-search latency AND the redundancy that forced 232 repair paths. Corpus stays on the worker (can't fit 300s, can't import `src/lib`) but **streams partials**. The brief-confirmation seam is a genuine process boundary — accept it.

**(b) Evals killing output → verification-as-self-correction.** Retire the binary `LAB_VERIFIER_MAX_UNSUPPORTED=0` whole-section throw (`run-section.ts:~14172`). Every load-bearing verifier returns **three per-claim verdicts**: KEEP (grounded) · KEEP-BUT-FLAG (plausible → demote confidence + honest-gap note) · STRIP (invented → remove clause, re-derive floor). Section fails **only when nothing survives.** Count floors (VoC<6 quotes, Demand<10 questions) become **render targets / honest-gap cards**, not thrown errors + dead-empty cards. Already proven in-tree: BuyerICP's `verifierDowngradeMode` took persona confidence **0 → 0.57** by keep-demoting. Flip all 6 to downgrade mode. **And re-order: run the strips BEFORE `evaluateCommittableAttempt`, re-derive the floor post-strip** — today strips run after the gate passes, so a section clears then loses rows below the floor with no re-loop. That single re-ordering removes a whole failure class.

**(c) GLM caged → real tool-loop, un-projected.** GLM runs the proven `agentic-glm-runner.ts` shape (`generateText` + `stopWhen(stepCountIs)`) emitting **free markdown** in the gather phase. The schema binds **once** at the composer via `Output.object`, not via a per-section projector. Source agentic tools from the section's real `allowedTools` (make the `deps.allowedTools ?? definition.allowedTools` path the DEFAULT, not the bypass) so prepared-context stops zeroing tools. **Turn the flag on** for proven sections (the committed unbypass `fe773d57` changes nothing for users while the flag is unset). **Commit the noop-writer-pen change** (working-tree-only at HEAD — the DeepSeek pen still rewrites GLM's body and sinks Market/VoC to all-gaps).

**(d) 6-section rigidity → sections as output format.** The 6 are a **deliverable** constraint, not a model constraint — they are backward-designed suppliers to the 14-block media-plan deck (the deck literally cannot build until all 6 commit). Structure stays; rigidity dies: (1) sections become regions filled against ONE shared ledger with full cross-section visibility (today only paid-media reads siblings); (2) `.strict()` count-floor gates become lenient containers with honest-gap escapes; (3) uniform 16-step budgets become orchestrator-assigned per-section effort. "Six sections" was never the problem — six **blind, caged, re-researching** sections was.

---

## 3. Model & context

- **GLM-5.2** (OpenRouter `z-ai/glm-5.2`, env-only per ADR-0012) = the **gather brain**: orchestrator + section subagents. The moat (8–9 blind vs 1–3 caged; tool-calls, grounds numbers, cheap). Its fabrication weakness is contained by §6, not by caging.
- **Opus 4.8 (1M)** = the **composer + the LLM acceptance oracle** — the two single-headed jobs demanding judgment and cross-section coherence. Low-volume, high-value calls where being confidently wrong is most expensive.
- **DeepSeek** = demoted to throw-only fallback, then deleted. Its writer-pen is noop'd on the agentic path.
- **Context:** 1M **holds it for COMPOSE, shard for GATHER.** A long-context composer can hold corpus + 6 finished markdowns + template for one coherent emit. But do NOT research all 6 in one window — you lose the 90.2% breadth speedup and hit context rot (16 tool calls × 6 sections of raw JSON buries signal → invention before you ever reach 1M). **Long context ≠ clean context.** Shard gather (one subagent per section, own window, distilled quote+URL pairs not raw HTML); unify compose. Perplexity demoted to one optional probe tool — never a source of a verbatim quote or number.

---

## 4. Kill list

**DELETE:** `agentic-glm-projector.ts` (the 2nd-GLM cage) → replaced by composer `Output.object` · the `z.object({}).passthrough()` answer-tool workaround + `__answerRejected` retry · the `LAB_VERIFIER_MAX_UNSUPPORTED=0` whole-section throw · the 5+ silent `runSectionViaAnswerTool` fallback reversions (collapse into one telemetried path) · the `shouldUseAgenticGLM` canary (graduate default-on) · DeepSeek-as-live-default + its writer-pen · Brave search (Firecrawl is already the backend) · `validatePaidMediaPlanMinimums` as the acceptance bar (1 row + 1 channel is toothless vs a 78-cell deck) · **eventually most of `run-section.ts` — but only after extracting `runAgenticGLMSection` into its own module FIRST (Phase 0). Do NOT clean in place; amputate.**

**SURVIVES (load-bearing, do not touch):** `agentic-glm-runner.ts` (the 8–9 core) · quote-at-URL containment (`source-liveness.ts:isQuoteContainedInLiveText`, verified) · provenance-gate exemplar-motif strips · numeric-coherence strip · misattributed-quote relabel · the LLM acceptance oracle (recall 100%/FP 0%) → promoted into the live commit spine · the locked `paid-media-plan.ts` template + runner-does-all-math · the 6→14 supplier map · the `factStore` ledger primitive (wire it, don't rebuild).

---

## 5. Anti-fabrication — the load-bearing part (3 layers, none a guillotine)

**Layer 1 — Structural grounding (prevent at source).** The writer can cite ONLY pinned ledger fact-IDs. A fact enters the ledger only via quote-at-URL admission (re-fetch URL, normalized text must be present, else `[unverified]`). Because the composer cites fact-IDs, **there is no ungrounded row to delete below a floor** — the DELETE-below-floor deadlock that produces "VoC everything dead" cannot fire. **Honest limit (the stress-tests hammered this):** admission stops the *closed-book invented-source* class but NOT **laundering** (true quote, wrong page — passes containment at its real URL) or **hallucinated inference** (the 3 invented bidder names were analysis on correct numbers — no URL to check). Layer 1 is necessary, not sufficient. Anyone claiming "the writer literally cannot fabricate" is wrong about this repo's dominant residual failure.

**Layer 2 — In-loop cite-or-retract + self-audit.** `verify_claim` as a tool the agent calls before committing a load-bearing claim (belt). `remediateProvenance` as a **loop-until-clean-OR-budget** evaluator-optimizer (today `maxRounds:1`) — the model re-audits and *revises* (drops the clause, keeps the section). Proven lever: **GLM self-audit fixes 92% alone** (75→6 violations). Hard budget-gate against the 300s wall + 75s repair floor. `verify_claim` is an additional signal, never the only floor — a fabricating model won't volunteer to verify the claims it invented.

**Layer 3 — Deterministic floors + HARD LLM oracle (catch the residual).** The four deterministic strips run as DROPs over the FINAL composed body, before the gate, floor re-derived after. Then the **LLM acceptance oracle runs HARD, not advisory** — the only mechanism that catches the laundering/off-citation class (Phase-B: deterministic gate misses it, oracle catches it at recall 100%/FP 0%). Max 2 remediation rounds, then strip. **The composer goes under the SAME strips + oracle** — synthesis is exactly where GLM laundered before; it is not exempt.

**Decisive rule:** per claim → keep / flag-low-confidence / strip. Per deliverable → ship with honest gaps + confidence labels; hard-fail ONLY when nothing survives.

---

## 6. ✅ RATIFIED (2026-06-23): ceiling-7 bar = flag-for-pilot, block-later

"Ceiling-7" = real data, hedged, low-confidence, but *off-citation* (right fact, imperfectly attributed). **Owner decision: FLAG, not block, for the supervised pilot.** The LLM acceptance oracle marks off-citation claims as low-confidence + attaches an honest-gap note; they survive into the deck because a human reviews every deck before it ships. **Tighten the oracle to HARD-BLOCK off-citation before any unsupervised/auto path.** The *invented* class (closed-book fabrication, hallucinated inference) is always hard-DROP regardless of bar — only the off-citation-of-real-data class is flagged. This bar is wired into the oracle config; it is the one knob that flips when the pilot graduates to unsupervised.

---

## 7. Execution — the discipline the stress-tests forced

The synthesis proposed 4 phases. **All four critiques independently said: do NOT execute as a 4-phase march. Ship Phase 1 alone, prove it, then decide.** Phase 3/4 carry the real coupling + fabrication risk and several phases rest on misreads that must be corrected first. So:

**Phase 0 — Extract the agentic core out of the monolith.** *(prerequisite, low risk)* Pull `runAgenticGLMSection` + deps into its own module out of the 15,696-line file; treat the answer-tool path as throw-only fallback. Proves: `tsc` 0, suite green, no behavior change. **If extraction proves entangled, that is the signal the migration needs more surgery than planned — surface it loudly, don't grind.**

**Phase 1 — Un-cage + verification-as-strip. SHIP THIS ALONE FIRST.** *(highest value, lowest risk, runs on verified-live ground)*
- Set `LAB_AGENTIC_GLM_SECTIONS` for one rich section; **convert the silent agentic fallback to a loud `agentic_fallback` telemetry event** so you can SEE whether GLM actually runs.
- Commit the noop-writer-pen change.
- Flip the section to `verifierDowngradeMode`; retire the `=0` throw; convert count floors to honest-gap cards; re-order strips before the gate.
- Proves: a live `/research-v3` run shows **agentic-not-DeepSeek in telemetry**; VoC/Demand commit honest-partial cards instead of dead-empty; value-read ≥8; a unit test that one unsupported claim demotes instead of throwing.

**Phase 2 — Kill the projector, bind schema once.** *(medium risk, big latency win)* prose→projector→reject replaced by composer `Output.object`. Proves: blind A/B holds (8–9 preserved), ~70–250s/section removed, projector deleted with no dangling refs.

**Phase 3 — Shared ledger + bounded pool + composer.** *(HOLD until Phase 1 proves the foundation runs)* Inject real `factStore` + `parentAuditRunId` so `getFacts()` finally has live readers; move quote-at-URL to ledger-WRITE admission; bound concurrent section JOBS (see misdiagnosis below); add the Opus composer; put composer output under the strips + HARD oracle; promote the per-cell deck coverage map as the bar. Proves: a live run where ICP/competitor/demand reconcile, zero fabricated cells pass the oracle, fits the time budget.

**Phase 4 — Collapse the corpus wait + standing eval.** *(highest risk, LAST)* Move identity+extraction+corpus into one streaming agentic loop **on the worker** — re-implementing the Firecrawl calls there (worker can't import `src/lib`; budget this as a real second implementation). Stand up the eval-agent on the real dispatch path. Proves: one visible compute wait end-to-end; 3 frozen niche-SaaS subjects clear the standing eval; supervised pilot.

**Misdiagnosis the critiques caught (do not get this wrong):** `orchestrate/route.ts:113` awaits HTTP **kickoff** delivery, not compute — each section is its own 300s lambda. Capping concurrency there only throttles request delivery. The real contention is each section's own 16-step Firecrawl loop against its own 300s wall + provider rate limits. Phase 3's pool must bound **actual concurrent section jobs** (+ per-section effort budgets), not the kickoff fan-out.

---

## 8. Monday morning — the single most important step

**Turn the agentic path ON for ONE section (VoC) on `/research-v3` and watch telemetry prove it ran — the real app, not the harness.** Set `LAB_AGENTIC_GLM_SECTIONS=VoC`, commit the noop-writer-pen, convert the silent fallback to a loud `agentic_fallback` event, run one live dispatch on a real subject.

This closes the single most dangerous open question: **everything assumes GLM runs in production, and the verified truth is it has NEVER run in the live dispatch (0/5 agentic in the Vanta E2E).** If telemetry shows GLM tool-loop steps + a value-read ≥8, the whole architecture is de-risked and every later phase is execution. If it shows a silent DeepSeek fallback, you've found the real wall before spending a day on the composer. **Prove the foundation runs before you build the house on it.**
