# 2026-06-19 — Full-Run Harness Verdict (Ramp)

Evidence-first diagnosis from an in-process full-deck run against the frozen Ramp corpus + brief. Replaces the handoff's stale bug list with verified ground truth.

## Method

Built `scripts/zz-full-run-harness.ts` — freezes corpus + onboarding, runs all 7 sections in-process (real DeepSeek model + real live tools: Firecrawl/SpyFu/Perplexity/SearchAPI/Reviews), wires the durable fact ledger (`createInMemoryResearchFactStore` + `parentAuditRunId`), runs the in-tree `checkDeckAgainstLedger` liar-gate, prints a per-section fill map. No browser, no Clerk, no Supabase writes. Two runs:

1. **Strict run** (`harness-ramp-37be5efb`): default `LAB_VERIFIER_MAX_UNSUPPORTED=0` — the real production gate.
2. **Advisory run** (`harness-ramp-e5e2b9b3`): `LAB_VERIFIER_MAX_UNSUPPORTED=2` — lets gate-failing sections commit so their intended content + specific unsupported claims are visible.

## What the handoff got wrong (verified against code + real runs)

| Handoff claim | Verdict | Evidence |
|---|---|---|
| "BuyerICP hardcodes `personas:[]` and discards acquired champions" | **STALE** | `buildDeadlineExhaustionHonestGapBody` (run-section.ts:3500) calls `promoteDeadlineBuyerICPPersonas(buyerPersonaCandidates)` — rescue is wired (commit `e94c9e2b`). Empty only when 0 candidates acquired. |
| "Ledger half is dead / `getFacts()` has 0 live callers / `deps.factStore` always undefined" | **STALE** | `factStore` threaded through `runSection` deps (run-section.ts:412,438,652,717,741,1186); `getFacts()` called at :669. Advisory run captured **614 facts** (612 corpus_excerpt + 2 named_champion). |
| "8/10 cannot be proven without a browser" | **STALE** | Harness runs the full deck in-process against a frozen corpus with zero browser/Clerk/Supabase dependency. The proof loop exists now. |
| "Apify not on `/research-v3` path" | **TRUE** | Apify absent from `TOOL_CATALOG` (tools/index.ts:15-29). Confirmed — don't rely on Apify. |
| "Manufactures confident (Paid Media)" | **PARTIALLY TRUE** | Liar-gate caught 2 real `token-not-in-ledger-quote` violations in `audienceTypes[3]` citing ramp.com homepage — the gate works and blocks them. |

## Per-section results (strict run, real gate)

| Section | Status | Confidence | Sources | Gap blocks | Notes |
|---|---|---|---|---|---|
| Competitor Landscape | **committed** | 0.4 | 53 | shareOfVoice | 6 competitors, 4 pricing rows, 5 weaknesses, 6 ad groups, 132 verified / 5 unsupported claims |
| Voice of Customer | **committed** | 0.45 | 25 | painLanguage, decisionCriteria, successLanguage | 6 pain quotes + 4 objections + 1 switching story; 77-row acquisition ledger (59 found, 2 promoted, 57 rejected — honesty trail intact) |
| Market Category | gate-failed (2 unsupported) | — | — | — | Advisory: conf 0, 3 of 4 blocks gapped (categoryDefinition, marketSize, structuralForces) — TAM/sizing data not landing |
| Buyer ICP | gate-failed (1 unsupported) | — | — | — | Advisory: conf 0, ALL 5 blocks gapped. **Root cause found precisely** — see below |
| Demand Intent | gate-failed (1 unsupported) | — | — | — | Advisory: conf 0.4, 3 gap blocks (questionMining, intentSignals, venueMap) |
| Offer Diagnostic | gate-failed (2 unsupported) / schema-decode fail | — | — | — | Advisory run hit a different bug: model emitted `sources: []` → schema `min 1` reject |
| Paid Media | (not run in strict; ran in advisory) | 0.69 | 4 | — | 2 liar-gate violations on audienceTypes[3] (cites ramp.com homepage token not in ledger) |

## THE root cause for BuyerICP (the canonical "found data, shipped empty" case)

The prepass **did find 2 real named champions** and wrote them to the ledger as `named_champion` facts:
- Alicia Coleman — Marketing Operations Manager, WizeHire — `https://ramp.com/customers/wizehire`
- Lauren Feeney — Controller, Perplexity — `https://next.ramp.com/customers/perplexity`

Both were mined from Ramp's own case-study pages by `buyer-persona-case-study-mining.ts` (scrape + extract — the name is verified-by-construction against that URL). They were handed to the model in the prompt via `buyerPersonaPrepass.candidateBlock`.

**The model rejected both as `unverifiable_source` and committed `personaReality.personas: []` with `confidence: 0`.**

Why: `formatBuyerPersonaCandidateBlock` (buyer-persona-acquisition.ts:466-479) introduced the leads with: *"These are LEADS, not personas. Promote a persona only after the named evidence at its URL supports it."* The model can't fetch the URL itself, so it conservatively rejects. But the prepass already deterministically verified the name is on that page (that's how it was mined). The candidate block didn't tell the model that.

**The fix (applied + proven):** rewrote `formatBuyerPersonaCandidateBlock` to split leads into VERIFIED (case-study champions mined from their URL — name+employer on the page by construction, clears the source-liveness verifier) vs UNVERIFIED (Perplexity leads — confirm before promoting), and tell the model to promote VERIFIED leads directly with `sourceUrl` = the given URL. ~25 lines, no schema/gate/plumbing change.

### Proof run (Ramp, real gate, real tools)

| | Before fix | After fix |
|---|---|---|
| confidence | 0 | **0.57** |
| personas shipped | `[]` | **Alicia Coleman @ WizeHire, Lauren Feeney @ Perplexity** |
| champions promoted | 0/2 (rejected `unverifiable_source`) | **2/2** |
| sufficiency tier | insufficient | **partial** (honest — 2 below the floor of 3) |
| rejection reasons | unverifiable_source ×2 | none |

The remaining gap (2 personas vs floor of 3) is an **honest acquisition ceiling** — only 2 case-study pages had named external champions — not a bug. Tests: 23 formatter tests + 55 BuyerICP tests pass.

## What actually works (verified)

- **Data acquisition tools fire live** and return real data: Firecrawl (case-study scraping → 2 champions), SpyFu/keyword probes, SearchAPI, Perplexity, Reviews. The handoff's "verify the tools can get data" question is answered: **yes, they can and do.**
- **The fact ledger captures facts** live: 614 facts across 5 sections. Read+write both work.
- **The deterministic liar-gate works**: caught 2 real Paid Media violations, passes honest-gap cells, refuses unbacked claims.
- **The evidence-gate works**: refused to commit 4 sections whose load-bearing claims weren't backed. This is correct behavior, not a bug.
- **Honesty instrumentation is intact in the data**: VoC's 77-row acquisition ledger, BuyerICP's sufficiency tier, `evidenceGapReport`, `acquisitionLedger`, `blockGap` are all present in committed artifacts. The gap is *rendering* them (handoff Phase D item 7), not capturing them.
- **The corpus → ResearchInput → section path is clean**: 18 sources + 91 excerpts + 5 competitor seeds reach every section with per-row source URLs.

## The honest path to 9/10

Not "three bodies of work." Verified against real runs, it's closer to:

1. **One precise prompt fix** (BuyerICP, ~5 lines): rewrite `formatBuyerPersonaCandidateBlock` to state the leads are pre-verified against their URLs. Unblocks the canonical regression case. **Highest leverage — fixes the single most-cited "empty" section.**
2. **One schema/prompt investigation** (OfferDiagnostic): model emits `sources: []` under advisory mode — find why the source-list isn't being populated (likely a writer-pass drop). Small.
3. **Two sections that need more/better acquisition, not plumbing**: Market Category (TAM/sizing evidence not landing — the acquisition layer isn't surfacing market-sizing rows) and Demand Intent (keyword economics from SpyFu modest). These are *acquisition* gaps (the data exists in providers but isn't being delivered to the section well), not consumption-plumbing gaps.
4. **Render the honesty data that's already captured** (renderer pass, handoff Phase D item 7): `confidence`, `evidenceGapReport`, `acquisitionLedger`, rejection trail. Pure UI work — the data is already in committed artifacts.
5. **Run the 3-subject sweep** (Ramp → Fathom → Plain) through this harness once 1-4 land. Fathom/Plain need frozen corpora built first (only Ramp exists today under `tmp/grill/`).

The "consumption plumbing rebuild" the handoff centers on is largely **already done** — `PreparedSectionContext` exists (run-section.ts:396), `factStore` is wired, corpus rows reach the model with URLs. The remaining gap is targeted producer behavior + renderer honesty, not a from-scratch rebuild.

## Artifacts

- Harness: `scripts/zz-full-run-harness.ts`
- Strict run: `tmp/zz-full-run/harness-ramp-37be5efb/` (Competitor + VoC committed; 4 gate-failed)
- Advisory run: `tmp/zz-full-run/harness-ramp-e5e2b9b3/` (Market/Buyer/Demand/PaidMedia committed; Offer schema-fail)
- Ledger (advisory): 614 facts — `tmp/zz-full-run/harness-ramp-e5e2b9b3/ledger.json`
- Gate verdict (advisory): `tmp/zz-full-run/harness-ramp-e5e2b9b3/gate.json` (blocked: true, 2 violations)