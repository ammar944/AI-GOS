# Overnight Gap-to-8 Progress Log — 2026-06-18

**Branch:** `refactor/architecture-deepening` · **HEAD at start:** `8ae9152b`
**Contract:** `docs/reports/2026-06-18-gap-to-8-kanban-roadmap.html` (source of truth)
**Bar:** every rendered research section ≥ 8/10 on an offline media-buyer value-read. Internal evals are liar-catcher floors, never the product bar.

**Proof-state vocabulary (do not conflate):** `code-patched` = diff written, may be uncommitted · `unit-tested` = focused suite green · `live-proven` = fresh confirmed-HEAD Ramp rerun with grep gates passing · `buyer-value-proven` = offline value-read ≥ 8 on the rendered section.

---

## Execution order (per kanban + goal directive)
0. Re-judge current Ramp dump (free, first) — **DONE**
1. Track A cheap correctness patches (Market containment, Competitor clamp)
2. Track B long poles in parallel where safe (BICP laundering gate, Demand discovery, VoC directional lane, carpet-bomb generalization)
3. Reconcile Offer/exec (Next)
4. NO broad E2E until known local defects fixed
5. This file = durable progress log

---

## Prerequisite reads (contract-mandated) — all completed + cross-checked
Board `2026-06-18-gap-to-8-kanban-roadmap.html` (via Bash HTML-strip — claude-mem hook truncates the Read tool to line 1 on indexed files), `AGENTS.md`, `CLAUDE.md` (in-context), `docs/source-map.md`, `docs/reports/2026-06-18-production-readiness-audit.md`, handoff `…ShGvt927TP`, `docs/reports/2026-06-17-content-quality-grounding.md`, `docs/plans/2026-06-17-research-presentation-model-plan.md`. **Cross-check verdict: zero contradictions; every fix below matches its prescribed spec.** One optional sub-item explicitly deferred: the grounding-report §4 / audit §7(c) "Competitor buyer-eval check added AFTER the normalizer" — a verification-harness safety net (not a behavior fix); A.2 implements the behavior clamp + RED-first tests, the post-normalizer eval guard is a noted optional follow-up.

## Track 0 — Re-judge committed Ramp dump ✅ DONE (free, 2026-06-18 ~01:55)

**What:** Offline value-read of `tmp/grill/ramp-current-status/` (run `d2abf018`, committed code only: `6b1bc3ed` P0a+P0b, `353c60bc` P1-VoC-count, `5fbf5b98` WS1 telemetry-strip). The prior verdict (`tmp/judge/d2abf018/verdict.json`, 6.7, `noFabrication:false`) judged the **stale pre-P1 dump** (VoC count=3 vs 2 emitted = padded-count fabrication).

**How:** `node scripts/zz-judge-run.mjs ramp-current-status --bundle tmp/grill/ramp-current-status` ($0 offline gather) → local-agent value-read → `tmp/judge/ramp-cur/verdict.json` → `--gate`.

**Independent fabrication audit of the committed dump (direct JSON inspection, not rubber-stamp):**
- **VoC:** exactly 2 painLanguage quotes, 2 real per-review G2 permalinks (`survey_responses/ramp-review-129435`, `-129221`); all count fields ∈ {0,1,2}, `foundPainQuoteCount=2`. The prior 3-vs-2 padded-count finding is **resolved**.
- **BuyerICP:** `personas:[]` — no invented people; 52 "section exceeded its time budget" apology strings, confidence 0.1. An honest (low-quality) carpet-bombed gap, **not** fabrication (same line the prior judge drew at 5.5).
- **Market $13B:** labeled "(per client brief)" + one `status:verified` corpusExcerpt match — attributed, not invented.
- **Exec ACV:** winner correctly `$1K–$10K`, flagged `disputed:true` — fact-ledger hygiene/coherence issue, not fabrication.

**Verdict (`tmp/judge/ramp-cur/verdict.json`):** overall **6.4/10**, wouldPay `with-caveats`, **mediaPlanNumericallyCoherent: yes**, **noFabrication: yes**, `fabricationFindings: []`. Per-section: Market 6.5 · BuyerICP 2 · Competitor 7.5 · VoC 4.5 · Demand 6.5 · Offer 6 · PaidMedia 7. Gate exit=2 (6.4 < 8 ship bar — expected; we are not claiming ship, only closing the fabrication finding).

**Outcome:** The only fabrication finding on the committed code path is **closed**. `noFabrication` flips `false → true`. This is the cheapest, highest-leverage proof step on the board and it is done. Sub-8 score is driven by BuyerICP (2) and VoC (4.5), exactly the Track B long poles.

---

## Track A — cheap defect patches (IN PROGRESS)

### A.1 Market exact-magnitude containment ✅ code-patched + unit-tested

**Finding (premise correction):** The audit/kanban prescribed "bound numberVariants so `$13B` doesn't match `$13M`." RED-first testing proved that case is **already handled** by the working-tree bidirectional-magnitude patch — `numberVariants('$13B')` yields `13b`/`13billion`, never bare `13`, so `containsNumber("$13M page","$13B")` is already `false` (test passes on current HEAD). That prescribed defect is a **phantom**.

**Real defect found by RED test:** a **bare integer** claim (`13`) substring-matches a magnitude-suffixed page number — `13` ∈ `$13M`. `containsNumber("$13M page","13")` returned `true` (false positive). This is the literal "or bare 13" half of the acceptance criterion.

**Fix** (`source-liveness.ts`): added `bareIntegerMatches()` — bare digit-only variants now match only a standalone quantity via `(?<![\d.,])N(?![\d.,]|\s?(?:k|m|b|thousand|million|billion)\b)` against the space-preserving haystack; richer variants ($, commas, k/m/b, spelled-out magnitudes) keep the plain substring test. 2 RED-first tests added (`drops an abbreviated magnitude claim…`, `drops a bare-integer claim…`).

**Proof:** `source-liveness.test.ts` 25/25 green (23 prior + 2 new). _Live Market rerun deferred to the PROOF lane._

### A.2 Competitor prose truth clamp (!isSubject + recruiter downgrade) ✅ code-patched + unit-tested

**Defect:** `reconcileAdEvidenceProseWithVerifiedCounts` summed `totalVerified` over **all** groups — including the subject (Ramp's own 6 verified ads, tagged `isSubject` by `markSubjectAdvertiserGroups`) and any recruiter/hiring creatives. That inflated the competitor verified total and **loosened the overclaim clamp** for competitor prose (e.g. "Brex ran 4 ads" passed because `4 ≤ 7`).

**Fix** (`competitor-ad-adapter.ts`): the prose clamp now computes `totalVerified` over **non-subject** groups only, and subtracts recruiter/hiring creatives (`RECRUITER_POST_PATTERN` over headline/body/transcript/cta) from each group's verified count via `Math.max(0, groupVerified − recruiterVerified)`. Creatives are never deleted — the wall (incl. Ramp's praised 6) is untouched; only the competitor count that gates the prose clamp changes. 2 RED-first tests added.

**Proof:** `with-normalized-competitor-ad-evidence.test.ts` 20/20 green (18 prior + 2 new). _Rendered Competitor value-read (no-regression-below-7.5) deferred to the PROOF lane._

## Track B — long poles

### B.1 Buyer ICP persona-laundering gate ✅ code-patched + unit-tested
**Defect (run d2abf018):** 7 "named" G2 personas all cited ONE aggregate listing URL `g2.com/products/ramp-financial-ramp/reviews` (not a per-review permalink). Each had *a* http sourceUrl + a name, so `countValidatorGradePersonas` counted all 7 ≥ 3 → no gap → laundered personas shipped (zero names in corpus).
**Fix** (`run-section.ts`): new `suppressSharedListingUrlPersonas()` in the shared `withNormalizedBuyerICPOutput` pipeline (runs after case-study backfill, before vendor-sourced derivation). Suppresses a persona iff its sourceUrl is shared by ≥2 personas AND is **not** a per-review permalink (`isReviewPermalinkUrl`) — **exempting** case-study champions whose name was actually mined from that exact page (so legit co-champions sharing a customer-story page survive). Thinned set then hits the ≥3 floor → existing honest gap injection fires (no carpet-bomb — that's B.4). 3 RED-first tests.
**Proof:** `with-normalized-buyer-icp-output.test.ts` 29/29 (26 prior + 3 new): suppresses 3-share-one-URL laundering; keeps distinct-URL personas; keeps mined case-study co-champions. _B.1b "prefer case-study leads" is enforced deterministically here (laundered G2 personas can't ship) + the prior session's candidate-merge order + SKILL.md. Live 2-rerun proof + value-read ≥8 deferred to PROOF lane._

### B.2 Complete Demand keyword discovery ✅ code-patched + unit-tested (subagent, diff-reviewed)
**Fix** (`keyword-discovery.ts` + `spyfu-client.ts`): wired the 2 dead kombat endpoints — new `competitorDomains` input calls `getCompetingSeo/PpcKeywords`, takes the `weaknesses` (gap keywords = the non-branded discovery we lacked), merges SEO+PPC, dedupes by lowercased keyword. New `minSearchVolume` input parametrizes the floor (added optional `minSearchVolume = MIN_SEARCH_VOLUME` to `getMostValuableKeywords`/`getRelatedKeywords`, byte-identical default; tool also post-filters all branches). Gap handling (credential/rate_limited/errorToGap) preserved.
**Proof:** `keyword-discovery.test.ts` 10/10 (4 new), `spyfu-client.test.ts` 5/5, tsc 0. _Diff reviewed by me — correct._ Known limitation (flagged, out of scope): kombat fns swallow per-call fetch errors internally, so a live 429 inside them returns empty `weaknesses` rather than a `rate_limited` gap. _Live Demand rerun (10+ non-branded terms) deferred to PROOF lane._

### B.3 VoC directional lane build — _directional lane already built; remaining work is probe-gated (PROOF lane)_

**Investigation finding (no safe offline code change to make tonight):** The directional lane already exists and is correct:
- `buildVoiceOfCustomerEvidenceGapBody` surfaces `selectVoiceOfCustomerPainCandidates(quoteCandidates)` into `painLanguage.quotes` with explicit directional labeling ("treat the block as directional buyer signal, not independently verified VoC"); secondary blocks (objections/switching/criteria) are **deliberately** left empty to avoid fanning one snippet across blocks (correct anti-padding).
- `selectVoiceOfCustomerPainCandidates` / `buildVoiceOfCustomerShortfallPainQuotes` do **not** filter by permalink — unpermalinked independent-domain quotes (e.g. Trustpilot) are KEPT and labeled directional, not discarded. `downgradeUnpermalinkedVocQuotes` downgrades (never drops).
- The candidate-pool selector (`selectVoiceOfCustomerCandidates`) caps per-domain + total but does **not** drop unpermalinked candidates.

So the "directional lane as primary" code path is present and honest. Whether it reaches value-read ≥8 for Ramp depends on (a) whether the run takes the gap-path (vs the main path committing 2 verified G2 quotes and stopping below floor) and (b) whether the acquired candidate pool actually contains independent-domain (Trustpilot/TrustRadius/Reddit) content to surface — **both are probe-gated questions the kanban itself conditions on** ("Allow the honest cap only if a fresh probe also kills the directional lane"). There is no bounded, offline-unit-testable code defect here; a speculative rewrite of the VoC admission/directional pipeline would risk regressing a delicate section the audit flagged as do-not-destabilize. **Deferred to the PROOF lane: fresh VoC probe → decide directional-as-primary vs honest cap → live VoC rerun → value-read.**

### B.4 Carpet-bomb / honest-unavailable renderer generalization ✅ code-patched + unit-tested (subagent, diff-reviewed)
**Fix** (`buyer-icp.tsx`, `voice-of-customer.tsx`, `demand-intent.tsx`): generalized the offer-diagnostic pattern. Each renderer now has an exported `is<Section>HonestlyUnavailable(artifact)` predicate (all evidence block arrays length 0) + an early-return single `GapNote` (`data-testid="<section>-honestly-unavailable"`) BEFORE the body — so a wholly-empty section renders ONE honest gap note instead of N carpet-bombed apology panels. Existing per-block GapNote sites (partial-shortfall case) untouched.
**Proof:** 27/27 across the 3 renderer suites (3 new per section: detects wholly-empty, renders ONE note not five, keeps full body on partial). tsc 0. _Diff reviewed by me — mirrors offer-diagnostic correctly._

---

## Consolidated verification (2026-06-18 ~02:22)
- **tsc --noEmit: 0 errors** (none in any touched file).
- **915 targeted tests pass** (1 live test skipped) across `lab-engine/agents`, `lab-engine/sections`, `lab-engine/agents/verification`, `section-renderers`.
- Proof-state: all six items above are **code-patched + unit-tested**, NOT live-proven. No live/E2E run yet (per directive #4 — defer until local defects fixed).

---

## Session end-state (2026-06-18 ~02:25) & gated next actions

**Done this session (Now lane, code-actionable):**
| Item | State | Files |
|---|---|---|
| Track 0 re-judge | ✅ noFabrication flipped false→true on committed dump | `tmp/judge/ramp-cur/verdict.json` (6.4) |
| A.1 Market containment | ✅ code-patched + unit-tested (real defect = bare-integer match; prescribed $13B↔$13M was already fixed) | `source-liveness.ts` (+test) |
| A.2 Competitor clamp | ✅ code-patched + unit-tested | `competitor-ad-adapter.ts` (+test) |
| B.1 BICP laundering gate | ✅ code-patched + unit-tested | `run-section.ts` (+test) |
| B.2 Demand discovery | ✅ code-patched + unit-tested (subagent, diff-reviewed) | `keyword-discovery.ts`, `spyfu-client.ts` (+tests) |
| B.4 carpet-bomb renderer | ✅ code-patched + unit-tested (subagent, diff-reviewed) | 3 renderers (+tests) |
| B.3 VoC directional lane | ⏸ already built + correct; remaining work probe-gated | (no change) |

Gate: **tsc 0 errors · 915 targeted tests pass.**

**Blocked / gated next actions (NOT done — require user decision or paid runs):**
1. **Atomic commit decision (USER).** The tree is interleaved (`run-section.ts` ~32 hunks across 5+ workstreams; no `git add -p` in this env). The kanban merge guidance says "Do Not Commit As-Is" and a confirmed-HEAD live rerun needs an atomic commit first. The grounding-feature commit must include the untracked `buyer-persona-case-study-mining.ts` + `keyword-discovery.ts` (wired into live path) and EXCLUDE `CLAUDE-FABLE-5.md`, `scripts/zz-probe-*`, report docs. Decide on the `ZZ_DUMP_ARTIFACT` hook (handoff says KEEP, env-gated). This is a scope-sensitive call for the user.
2. **Targeted Ramp proof rerun (PAID, ~$4/24min)** on confirmed HEAD for BICP + VoC + Demand + Market + Competitor + Paid Media → dump → grep gates (BICP `personas≥3` + no shared-aggregate-URL; Demand `≥10 non-branded`; Market no bare-integer false-positive; Competitor subject-excluded clamp) → re-judge + value-read. Target Ramp ≥7.5, noFabrication:true.
3. **VoC fresh probe** to decide directional-as-primary vs honest cap (B.3).
4. **3-subject sweep** (Ramp/Fathom/Plain) only after Ramp is green — fresh confirmed-HEAD runs.

These are deliberately not auto-run: #1 is a user scope decision; #2–#4 are paid live runs against a tree that "must not commit as-is." Directive #4 (no broad E2E until local defects fixed) is satisfied — local defects are fixed; the next step is the gated commit + proof.
