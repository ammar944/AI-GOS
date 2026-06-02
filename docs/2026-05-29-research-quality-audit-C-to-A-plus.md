> **Method:** Read-only multi-agent audit (34 agents, adversarial-verified) against the deployed lab-engine.
> **Target:** `feat/v2-lab-section-wire` worktree == `main` == `4237d9b2` (the live code).
> **Date:** 2026-05-29. **Workflow run:** `wf_ca69d011-953`.
> **Scope:** Pass 1 — diagnosis only. No edits, no paid/live runs. Pass 2 = fixing the kinks.
> Three Phase-1 claims were **refuted** by the verifier layer and corrected below ("dead .ts is the better content", "2 live ads were fabricated", "schema floor = ceiling pinning every run").

# AI-GOS Research Quality Audit — C → A+

---

## 1. Verdict

**Current overall grade: C+.** AIGOS is a genuinely-agentic, evidence-grounded six-section diagnostic report generator with a working paid-media synthesis section — more disciplined than a chat prompt where its tools fire, but structurally short of the "AI McKinsey / Manus for GTM" pitch. The architecture is real (AI SDK v6 `ToolLoopAgent`, 12-step loop, 181 tool calls in one verified run, layered Zod + minimums + evidence gates, anti-fabrication ad-injection). What holds it at C+ is three things: the differentiating ad-creative data layer has produced zero output in every persisted run, the fabrication gate is advisory-off by default, and there is no cross-section positioning synthesis — the connective tissue that is the actual human edge.

**Is it better than just asking Claude?** Today it is a **tie**, and the honest answer is a three-way split, not a single grade — see §4a for the full decomposition. It **wins** where the review/web/ad tools fire and produce falsifiable evidence Claude would hallucinate (VoC verbatims, real competitor URLs + hero copy, gated-pricing honesty, SERP grounding, the paid-media schema). It **ties** on Market Category, Buyer ICP, and Demand Intent, which run the same `web_search` + `firecrawl` toolkit a browsing LLM already has — only the schema differs. And it has one confirmed **loss**: Voice-of-Customer ingested the subject company's own homepage marketing as buyer "pain language," which is actively worse than raw Claude (see §4b).

**Would an elite strategist extract more from the same inputs? Yes — decisively (see §4c).** The engine produces six isolated extractions plus a paid-media plan and never connects findings across sections into a single defensible positioning wedge. A human reading the same six sections would chain the evidence into one named bet. That cross-section synthesis gap is the human edge, and it is also the single highest-leverage C→B+ lever.

---

## 2. Scorecard

| Dimension | Grade | One-line state |
|---|---|---|
| Engine & agentic flow | **B** | Real multi-tool ToolLoopAgent + 3 stacked gates, but fabrication fail-gate is OFF by default and depth caps at 4–6 fetches. |
| Data inputs & API health | **C+** | SearchAPI/Brave/Firecrawl/reviews live and real; flagship ad probe persists zero creatives (unproven post-fix); SpyFu & Foreplay orphaned. |
| Prompt / skill quality | **C+** | Live-path schema/skill alignment is tight; 2 of 6 live skills world-class, 4 are 44–46 line stubs; specific copy-strategy hooks stranded in dead `.ts`. |
| Output quality & bloat | **B-** | Consultant-grade evidence hygiene in places; cross-section restatement is the main bloat; confidence narration leaks into prose. |
| Better than raw Claude? | **C+** | Wins where tools fire, ties where starved, one confirmed loss (VoC self-sourcing); the moat (ad creatives) is unproven in production. |
| Vision alignment (Manus for GTM) | **C+** | Six diagnostics + a paid-media plan; no positioning blueprint, no executive synthesis, no cross-section wedge. |

**Overall: C+** — a strong evidence engine wearing the costume of a strategist, with the two highest-leverage levers (proving the live ad data + adding cross-section synthesis) both currently unrealized.

---

## 3. What's genuinely strong (the real moat)

1. **Genuinely agentic, not a façade.** Production routes all six sections + paid media through `runSectionViaAnswerTool` → real AI SDK v6 `ToolLoopAgent` (12-step loop, terminal `answer` tool; `section-agent.ts:370-409`, `run-section.ts:3917`). A verified run fired **181 tool-started / 181 tool-finished events** with 76 sub-section-committed events in `research_section_events`.
2. **Three independent gates stack before commit:** Zod parse → `validateMinimums` (per-section quantitative floors) → `checkRequiredEvidenceClasses`, any failure triggering a bounded repair loop that keeps the best committable attempt.
3. **The competitor-ad probe is well-engineered, and the reserve-aware path IS the production path.** Out-of-band lookups with normalized counts injected post-generation (`build-prompts.ts:254`) so counts can't be hallucinated, plus `advertiser-match.ts` Jaro-Winkler + domain corroboration, plus a two-pool `SectionToolBudget(6,6)` that reserves ad lookups so generic `web_search` cannot starve the probe. This is the live runner path (`run-section.ts:2866`), verified — the zero-creatives result is a production-history problem (§5/§8), not a broken design.
4. **Real, falsifiable evidence where tools fire:** verbatim hero copy ("Transparent, flat-fee pricing from $1,250 per month"), gated-pricing honesty, genuinely verbatim VoC buyer language with real source URLs, and an Offer Diagnostic that catches a real PLG-vs-DFY motion contradiction and tags proof points company-own vs external-source.
5. **Live-path schema/skill alignment is tight.** Every live `SKILL.md` output section maps 1:1 to the Zod body keys, and `build-prompts.ts` `buildSectionMinimumGuidance` restates the exact enums and item contracts — structural drift between prompt and schema on the running path is effectively zero. (The two **strong** skills — `positioning-competitor-landscape/SKILL.md` at 504 lines and `positioning-market-category/SKILL.md` at 267 — carry IRON LAWs, anti-slop banks, worked examples, and market-size triangulation requiring ≥1 top-down AND ≥1 bottom-up signal.)
6. **A working cross-section synthesis exists — for paid media:** `positioningPaidMediaPlan` (ADR-0005) consumes all six Artifacts, every item carries a `sourceSection` enum, `validatePaidMediaPlanMinimums()` enforces ≥14 grounded items. It's just aimed at the wrong altitude (a media-buy plan, not a positioning blueprint).

---

## 4. The brutal truth, per dimension

**Engine & agentic flow (B).** The loop and gates are real — but the fabrication fail-gate is OFF: `getMaxUnsupportedAllowed` returns `Infinity` unless `LAB_VERIFIER_MAX_UNSUPPORTED` is set (it isn't), so sections commit `complete` with 14/18/13 unsupported load-bearing claims (confirmed in Supabase). Worse, the paid-media plan — the worst offender (18 unsupported) — runs the structured `runSection` path that has **no** evidence gate at all, only schema validity. The verifier is purely lexical — `source.text.includes(needle)` against a flattened blob of *all* tool payloads, so "$49/mo" verifies if those digits appear anywhere in the run (the project's own unit test demonstrates the cross-attribution false positive). Depth is capped: 62% of non-answer tool calls in completed CompetitorLandscape runs were rate-limited gaps (reviews 100% gapped).

**Data inputs & API health (C+).** Text substrate works (real diverse domains land in every section). Flagship input has never persisted output: 18 persisted advertiser groups, `max_raw_total=0`, zero creatives — but see §8, this predates the reserve fix. No search-volume / ad-spend source anywhere. `BRAVE_SEARCH_API_KEY` — behind the only universal tool — is **invisible to `env.ts` validation**, an unmonitored SPOF.

**Prompt / skill quality (C+).** Split-brain: `positioning-skills/01-06*.ts` are orphaned dead code; production loads `lab-engine/skills/<slug>/SKILL.md`. The real alignment story has two layers. On the **live path, alignment is good** — 1:1 SKILL.md→Zod body keys, enums restated in `build-prompts.ts`. The hazards are (a) the orphaned `.ts` corpus carries a divergent flat `keyFindings`/`evidenceQuotes` contract that would **fail `.strict()` validation** if anyone rewired it, and (b) skills reference capabilities the engine lacks (`positioning-competitor-landscape/SKILL.md:395` says "use SpyFu only when available" — and it is never available, so always a gap). Four of six live skills are 44–46 line stubs steered by the schema, not strategist instruction. **Correction to a tempting overstatement:** the dead `.ts` files are *not* categorically "the better content" — the live corpus is larger overall (1032 vs 495 lines) and far richer for the two heavy sections (competitor-landscape live 504 vs `.ts` 76; market-category live 267 vs `.ts` 62). What was genuinely stranded is a handful of **specific copy-strategy hooks**: Schwartz awareness→headline mapping, hair-on-fire success language, and "empty narrative slots no one is using." The trigger-to-evaluation-window insight **did survive** into the live `buyer-icp.ts` schema (`triggerWindows` enum, forced in `build-prompts.ts:325`), so it is not on the stranded list. _Dropped as refuted: the "schema minimum = ceiling, every run pinned at the floor" claim — real data shows counts vary above the floor (pain quotes reach 14, personas reach 5/6/7)._

**Output quality & bloat (B-).** Consultant-grade where tools work. Fabrication gate has a structural blind spot (§4d). Bloat is cross-section restatement (PLG/DFY mismatch, "no public pricing", $20K-course quote each recur 4+×). _Dropped as refuted: "Paid Media Plan fabricated 2 live ads" — the event log proves two real `keyword_ad_probe` calls returned `ad_count:2` each; the auditor mis-scoped DemandIntent's "0 calls succeeded" to the whole run. Those numbers were truthful — but the verifier blind-spot that would have let a fabricated count of that shape through is still real and structural (§4d)._

**Vision alignment (C+).** Per-section verdicts are genuinely evaluative, but no executive synthesis exists. `research_artifacts.thesis` stores onboarding bookkeeping (`source: onboarding_v2_review`), not a thesis. The buyer self-synthesizes seven sections. The "divergent brainstorm absent" conclusion is correct **at the schema layer, not the prompt layer**: every binding schema is descriptive (the only `anglesToTest` are ad-creative copy), and a `recommendedMoves` field exists in five `SKILL.md` files but is stripped by `.strict()`. So the prompts *do* contain recommendation language — the schema discards it, which is the actual failure point.

### 4a. The "better than Claude" answer, decomposed

Three dimensions returned three framings; collapsing them to one grade hides the real shape. Here is the clean decomposition.

| Bucket | Sections | Why |
|---|---|---|
| **WINS** | Voice-of-Customer (verbatims), CompetitorLandscape (real URLs + hero copy, gated-pricing honesty), the SERP-grounded sourcing layer, the paid-media schema | Where review/web/ad tools fire, they produce falsifiable, sourced evidence a raw browsing LLM would hallucinate or hedge on. This is the genuine edge. |
| **TIES** | Market Category, Buyer ICP, Demand Intent | Same `web_search` + `firecrawl` toolkit (4–5 lookups) a browsing Claude already has. Only the schema and evidence discipline differ — an elite human with web search produces equal or better. |
| **LOSES** | Voice-of-Customer (self-sourcing failure) | Confirmed *worse* than raw Claude in run c346d71e — it labeled the subject's own homepage marketing as buyer pain (§4b). Raw Claude would not present self-promotion as third-party VoC. |

**Net = tie today**, gated on two things: the ad probe actually firing in a shipped run (§8) and a synthesis layer existing (§4c). Once the ad/review chains fire reliably and a synthesis pass connects the sections, this flips to clearly better-than-Claude. Until then, a meaningful fraction of the output is web-search synthesis an LLM could approximate.

### 4b. Named finding: VoC ingests the subject's own marketing as buyer "pain"

This is the report's headline question (is it better than Claude?) answered in the negative for one section, with a verified case, so it gets its own callout rather than a buried clause.

In run **c346d71e**, two of the ten `painLanguage.quotes` were the subject company's own homepage copy, sourced to `saaslaunch.net`:
- quote #9: *"We build, manage, and optimize complete client acquisition systems for B2B SaaS companies"*
- quote #10: *"We'll Help You Add Minimum $1M - $5M in ARR with AI based growth systems"*

Both labeled as customer **pain language**, with the model self-grading 0.7 confidence and a "sufficient buyer-language evidence surfaced" verdict. The mechanism is a tool/prompt/schema mismatch: the `reviews` tool returns role-less, date-less SERP snippets; the prompt demands 15 quotes *with* role+date; the schema (`painQuoteSchema`) cannot even carry role or date — so the model pads `painLanguage` with whatever text it has, including the subject's marketing. Six of ten quotes also share one Trustpilot URL, violating the prompt's independent-source rule, which the weaker hostname-count validator passes anyway.

**Fix (P1.4):** chain `reviews`→`firecrawl` to scrape full verbatims + role + date; add a `build-prompts.ts` guard banning quotes whose `sourceUrl` domain equals the subject domain; make VoC `quote` claims load-bearing in `evidence-support.ts`.

### 4c. Would an elite strategist do better with the same inputs? Yes.

This is a literal user question and deserves a direct verdict, not a throwaway.

**An elite human reading the same six committed sections would extract materially more — and the delta is specific and nameable.** A strategist would chain cross-section evidence into **one positioning wedge**: e.g., *the dominant awareness level from BuyerICP + an unaddressed objection from VoC + an empty quadrant from CompetitorLandscape → this headline*. The engine never does this. It produces six isolated extractions plus a paid-media plan and stops. There is no `executiveSummary`, no `recommendedPositioning`, no synthesis that reads the section *outputs* (the one field named `thesis` is onboarding bookkeeping, and the view-model `thesis` echoes the corpus input, not the diagnostic outputs).

That connective tissue — situation → 2–3 candidate angles → the recommended bet and why — is exactly the McKinsey one-pager the "AI McKinsey for GTM" vision implies, and it is the single thing a human does that the per-section fan-out structurally cannot. **It is therefore the highest-leverage C→B+ lever** (P1.1).

### 4d. The verifier blind-spot is structural — even though the "2 ads" case was truthful

The specific "2 live ads" claim that an earlier auditor flagged as fabricated turned out to be **truthful** (two real `keyword_ad_probe` calls returned `ad_count:2`). But that rescue must not undersell the genuine gap: the verifier *would not have caught it* if it had been fabricated.

`claim-extractor.ts` only tokenizes currency / percent / magnitude / URL / quotes ≥6 words. A bare count ("2 live ads"), a qualitative assertion, a causal claim, or an invented tool result ("probes confirm N") **never becomes a claim at all**, so it is never checked. Worse, a range like "$1M–$5M" splits into four fragments (`$1`, `$5`, `1M`, `5M ARR`), each substring-"verified" against any source containing those digits — verification theater. And the load-bearing set is only `numeric` + `url`, so even an extracted `quote` claim (like the self-sourced VoC marketing copy) is never gated.

**The next fabricated count of that shape WILL slip the gate.** This is real and structural; the truthful "2 ads" instance is luck, not coverage. Fix pairs the P2.1 LLM-judge with a tool-result cross-check: when prose asserts "probes confirm N" / "ad library shows", validate it against the section's actual tool-call ledger in the events table.

### 4e. The user-facing confidence number is not a trustworthy quality signal

Model-self-reported confidence is **uncorrelated with verifier results**. A section with 18 unsupported claims and one with 0 both report ~0.6–0.72 (e.g. paid-media 18-unsupported at 0.6; demand-intent 0-unsupported at 0.72). `buildEnvelope` copies `output.confidence` straight from the model; the verification report is attached to the artifact but never feeds back into the number. So the confidence the user reads tells them nothing about grounding.

**Fix (P0.1):** derive an evidence-grounded confidence in `buildEnvelope` (`verifiedCount / (verifiedCount + unsupportedCount)`) and suppress or replace the model-self-reported number until it is grounded.

---

## 5. APIs & data inputs status

| Source | Wired into lab-engine? | Used / Dropped | Working evidence |
|---|---|---|---|
| **SearchAPI** (`SEARCHAPI_KEY`) | ✅ Wired (REQUIRED `env.ts:11`) | **Used** — backs `adlibrary`, `reviews`, `keyword_ad_probe` | Reviews returns real g2/capterra/trustpilot URLs; probe returned live `ad_count:2`. Functional. |
| **SpyFu** | ❌ Not in `TOOL_CATALOG`; test asserts absence | **Dropped** — legacy-only | One SKILL.md line "use SpyFu only when available" — always a gap. No spend/difficulty data anywhere. |
| **Foreplay** (`FOREPLAY_API_KEY` opt) | ❌ Zero lab-engine references | **Dropped** — key present, no consuming tool | Dead key; richer creative dataset orphaned. |
| **Google Ads** (`google_ads`) | ✅ Wired | **Used but thin** — `adLibraryAgentTool({platform:'google'})` | Platform flag on SearchAPI ad-library, not independent. Persisted creatives: 0. |
| **Meta Ads** (`meta_ads`) | ✅ Wired | **Used but thin** — same endpoint, `platform:'meta'` | Same single underlying source. Persisted creatives: 0. |
| **Brave** (`web_search`) | ✅ Wired (every section) | **Used** — primary web search | Real domains land. ⚠️ `BRAVE_SEARCH_API_KEY` **absent from `env.ts`** — unmonitored SPOF. |
| **Firecrawl** (`firecrawl`) | ✅ Wired (opt) | **Used** | Real fetched URLs in persisted sources. |
| **PageSpeed** (`pagespeed`) | ✅ Wired (keyless) | **Used** — OfferDiagnostic only | Keyless, functional, narrow. |
| **reviews** (SearchAPI SERP) | ✅ Wired | **Used** — VoC | `{source,url,snippet}` only — **no role, no date**; prompt demands role+date → padding (§4b). |

**"Are SpyFu / Foreplay / SearchAPI actually working and used?"** SearchAPI: **yes**, load-bearing. SpyFu: **no**, not wired (and the skill that references it can never satisfy it). Foreplay: **no**, dead key. The "two ad tools" are one SearchAPI endpoint behind two names. **No competitive-spend or search-volume source exists in the engine** — every Demand Intent keyword shows `monthlyVolume: "not disclosed"`, which is structural, not transient.

**On the ad probe specifically — unproven, not broken-by-design.** The competitor-ad layer has returned 0 creatives in 18/18 persisted advertiser groups (and 0 raw rows across all 24 completed CompetitorLandscape runs spanning 16 days). But the reserve-aware `SectionToolBudget` *is* the production path and *does* work on current code; the persisted "exhausted after 6/8 lookups" errors all **predate** the `f6e4252f` reserve fix and the 2→6 ad-budget bump, both of which landed *after* every stored run. So the honest framing is: **0/16 in production to date, with no shipped run having yet exercised the fix.** The data proves "dead in production so far" — it cannot yet prove the fix fails. That makes §8's live run the single highest-value validation.

---

## 6. Bloat — what to cut

1. **Dead duplicated streaming code in `run-section.ts`** — `streamSectionViaAnswerTool` (:3243), `streamRunSection` (:3543) and deps, zero production callers, ~50% of a 3900-line file, already diverged from the live path (the dead `flushBufferedEvents` lacks the cursor-safety the live path has). Cut + sweep orphan `__tests__`.
2. **Orphaned `positioning-skills/01-06*.ts`** — zero non-definition imports; flat schema would fail the live `.strict()` schemas if rewired. Cut after porting the stranded hooks (P1.2); keep only the used ID constants (`POSITIONING_SECTION_IDS`/labels).
3. **Cross-section content restatement** — same 4–5 insights re-derived from the same 4–5 sources across 7 sections ("no public pricing" in 4 sections; the `$20K`-course and `$1M-$5M ARR` quotes recur 4+×). Fix via cross-reference (P2.3).
4. **Confidence narration leaking into prose** — commit `4237d9b2` was UI-only; "Confidence at 0.65…" still appears verbatim in section markdown. One `build-prompts.ts` line finishes it (keep content-level confidence like proof-point and per-item confidence, which are legitimate research content).
5. **Dead `FOREPLAY_API_KEY` env declaration** if Foreplay isn't wired.

---

## 7. The path from C to A+ (by impact-per-effort)

### P0 — highest trust-per-effort
- **P0.1 Turn the fabrication gate ON + ground the confidence number** (high impact / low effort): set a finite `LAB_VERIFIER_MAX_UNSUPPORTED` in prod so `getEvidenceGateFailureReason` (`run-section.ts:633`) actually fails ungrounded sections; route the paid-media plan through an evidence gate (it currently has none); add derived evidence-grounded confidence in `buildEnvelope` (`verifiedCount/(verifiedCount+unsupportedCount)`) and suppress the model-self-reported number; fix the `$1M–$5M`→4-fragment split in `claim-extractor.ts`.
- **P0.2 Prove the ad probe with a live run + harden it** (high / medium): pre-execute the deterministic probe for top-3 seeds *outside* the model loop with a reserve generic tools can't decrement; confirm the worker runs post-`f6e4252f` reserve code + the 2→6 bump; loosen `advertiser-match.ts` for known brands; add 429 backoff. Gate on `displayableTotal>0` against a known advertiser (e.g. `ramp.com`). This converts "unproven" to "proven or root-caused."
- **P0.3 Register `BRAVE_SEARCH_API_KEY` in `env.ts`** (medium / trivial): add to `REQUIRED_ENV_VARS.server`.

### P1 — strategist layer + data depth
- **P1.1 Add a `positioningSynthesis` section** (high / high) — _the missing blueprint and biggest C→B+ lever; this is the human edge from §4c._ Mirror the paid-media ADR-0005 pattern, dispatched after 6/6. Body: `{situationThesis, positioningOptions:2-3{angle,rationale,evidenceRefs,risk}, recommendedMove, messagingDirections[]}`, every claim `sourceSection`-traced, divergent-options as an IRON LAW (so the schema can no longer discard recommendation language — §4 vision row). Make it the reader's headline capstone; demote the media plan to a downstream artifact. Populate `research_artifacts.thesis` with the real synthesized thesis.
- **P1.2 Port the stranded hooks into the 4 stub skills, then delete the dead `.ts`** (high / medium): rewrite to the rich SKILL.md template, bring across the genuinely-absent hooks (Schwartz awareness→headline, hair-on-fire success language, empty-narrative-slot analysis, "pull every supported instance then rank", per-section anti-slop banks). Note: trigger-windows already survived — don't re-port it. Add a CI test that every `skillSlug` resolves to a SKILL.md.
- **P1.3 Give Demand Intent a real signal or stop promising one** (high / medium): port `spyfu-client.ts` as a `keyword_volume` tool OR pivot to paid-vs-organic SERP composition (a signal Claude lacks); schema rejects `"not disclosed"`.
- **P1.4 Chain `reviews`→`firecrawl` and ban self-sourced VoC** (high / medium): scrape the review page for full verbatim+role+date; guard against `painLanguage` quotes whose domain == the subject company; make VoC quotes load-bearing. _This is the fix for the confirmed §4b loss._

### P2 — semantic rigor + connective tissue
- **P2.1 Bounded LLM-judge verifier behind the regex pass** (high / medium): over only flagged load-bearing claims, ask "does this excerpt support this claim?"; add a tool-result cross-check (assertions like "probes confirm N" validated against the events ledger — §4d); wire into `evaluateEvidenceSupport`. Sequence after P0.1.
- **P2.2 Raise / pool the per-section lookup budget** (high / medium): don't count rate-limited gaps against loop steps, surface remaining budget in the prompt, consider a run-level shared pool.
- **P2.3 Dedupe across sections via cross-reference** (medium / medium): extend the paid-media `sourceSection` discipline so later sections reference rather than re-quote.
- **P2.4 Delete the dead streaming half of `run-section.ts`** (low / low).

---

## 8. What a single ~$2 live run must confirm

This audit read code + persisted Supabase rows but did **not** run the engine. One live run (ideally vs a known ad-spender like `ramp.com`) would validate or expose:

1. **Does the ad probe finally produce creatives?** The reserve fix (`f6e4252f`) + 2→6 bump (`78e3fece`) both landed *after* every persisted run — no shipped run has proven the fix. Assert `displayableTotal>0`. **The single most important unknown** — it is what converts the ad layer from "unproven" to "proven," and with it the §4a net verdict from tie toward better-than-Claude.
2. **Does the worker run the reserve path?** Live `dataGaps` "exhausted after 12 lookups" confirms `SectionToolBudget(6,6)`; "after 6/8" means stale Railway code.
3. **Is `BRAVE_SEARCH_API_KEY` actually set on the worker?** If web_search silently gaps, every section degrades and `env.ts` won't warn.
4. **Real unsupported-claim count under a finite gate** (`=3`): how many sections fail vs commit — tells you if the prompts can ground their numbers.
5. **Does VoC still ingest the company's own marketing as "pain"?** Inspect `painLanguage.quotes[*].sourceUrl` for the subject domain (the §4b loss).
6. **How many keyword volumes return "not disclosed"?** Confirms Demand Intent is structurally blind.
7. **Does it reach 7/7 and how long?** Validate the 255s<270s<300s timeout hierarchy holds end-to-end.
8. **Tool-call vs gap ratio** from `research_section_events` — the live depth ceiling on real hardware.

_Items 1–2 alone justify the $2._
