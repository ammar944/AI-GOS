# Phase A — Cross-Subject GLM-Agentic Verdict (7 sections × 3 subjects)

**Date:** 2026-06-22 · **Branch:** `refactor/architecture-deepening` (working tree, nothing committed) · **Model:** GLM-5.2 via Ollama (`glm-5.2:cloud`)
**Method:** Generalized `scripts/zz-agentic-section.ts` to all 7 sections + arbitrary subject. Generated corpus for 3 non-Ramp subjects (Plain=data-thin, Fathom=data-rich, Attio=rich-corpus/thin-VoC). Ran all 21 sections live (GLM-agentic + real lab tools). Scored each section: **3 blind value-reads (median) + 3 adversarial provenance audits (section-aware fabrication checklist, traced to the tool transcript) + reconcile**. `finalScore = min(median value, provenance ceiling)`. Bar = **≥8** (a serious buyer would pay + act, ad-money-safe). Scoring workflow `wf_51edf2cc-fff` (148 agents).

## Verdict: 🔴 NO-GO on raw GLM-agentic output — but the moat is real and the wall is narrow

**Only 3/21 sections clear ≥8.** But value is NOT the problem — **provenance is.** GLM writes buyer-grade prose (blind value mostly 8), then **launders/invents** in 16/21 cells, capping the score.

## The matrix (medianValue | finalScore)

| Section | Plain (thin) | Fathom (rich) | Attio (rich corpus / thin VoC) |
|---|---|---|---|
| **VoC** (competitor-mode) | 8 \| **8** ✓ | 8 \| **8** ✓ | 8 \| 4 ✗ |
| Market | 1 \| 1 ✗ | 8 \| 4 ✗ | 1 \| 1 ✗ |
| Buyer/ICP | 1 \| 1 ✗ | 8 \| 7 ✗ | 8 \| 4 ✗ |
| Competitor | 8 \| 7 ✗ | 8 \| 4 ✗ | 1 \| 1 ✗ |
| **Offer** | 9 \| **9** ✓ | 8 \| 4 ✗ | 8 \| 4 ✗ |
| Demand | 1 \| 1 ✗ | 8 \| 4 ✗ | 1 \| 1 ✗ |
| PaidMedia | 1 \| 1 ✗ | 8 \| 7 ✗ | 8 \| 4 ✗ |

Clean cells (proof the value is payable): plain VoC 8, plain Offer 9, fathom VoC 8 — plus several cells bound only by a single provenance defect on otherwise-8 prose.

## Findings

### 1. Value generalizes; provenance does not (the wall)
- **medianValue is mostly 8** across sections and subjects → GLM produces buyer-grade strategy prose. The moat is real.
- **16/21 cells laundered or invented** (12 capped at ceiling 4 by surviving INVENTED/arithmetic; 4 at ceiling 7 by laundered quotes). Only 5 cells reconciled provenance-clean (plain VoC/Buyer/Offer/PaidMedia, fathom VoC).
- **The plan's "prompt floor is insufficient" claim is CONFIRMED cross-subject.** Every fabrication occurred *despite* the finalized skills' inline citation-discipline prompts. The cure is deterministic code, not more prompt text.

### 2. The dominant failure is mechanically gateable
The recurring mechanism is uniform: **a real-looking source URL attached to a quote/number that exists in zero tool output.** Three deterministic sub-patterns:
1. **Cited URL never appears in the run's tool transcript** (broadest pattern) — e.g. plain Market "UI-API parity" cited to `plain.com/product` + `/docs/graphql` (never fetched); attio Buyer/Offer "Coca-Cola / Ryanair" minted as Attio enterprise customers.
2. **Named bidder/advertiser attributions minted from SpyFu**, whose schema has **no advertiser field** — recurred *identically* on plain + fathom Demand ("Zendesk/Gong will outbid"). Schema-deterministic.
3. **"Per SpyFu" volume/CPC numbers in PaidMedia** whose tool (`keyword_ad_probe`) returns only ad_count/organic, never volume/CPC.
4. **Numeric-coherence:** 2 arithmetic errors survived all 3 auditors (attio Competitor HubSpot 10-seat ~47% understated; attio PaidMedia $4,140/yr = 2.4× overstated).

### 3. VoC competitor-mode reframe = PARTIAL WIN
The pre-launch reframe (mine competitors' customer voice) **held clean on Plain AND Fathom** (8/8) — your play works when competitor reviews are retrievable, and it refuted the Ramp 13-laundered-quote failure on those subjects. It **failed on Attio** (thin-VoC): with no real quotes retrievable, GLM synthesized a homepage tagline + competitor-blog quote and shipped them as deployable proof. Fix = a **"zero retrieved evidence → honest gap, never synthesize"** rule + the transcript-grounding gate.

### 4. Caveat on the value scores
The synthesis flagged a value-read harness artifact (a few readers scored from a title-only read), so some `medianValue=1` cells likely understate true value. **This does not change the verdict** — the provenance ceiling is the independent, decisive blocker (even Fathom, all-8 value, is capped to 4–7 on 6/7 sections).

## Recommended next step: a THIN deterministic provenance gate (not heavy machinery)
This converges with the owner steer (de-prioritize heavy verifiers; lean on a lightweight eval-agent). The eval-agent built here (value-read + provenance audit) **reliably DETECTED the laundering across 21 sections** — keep it as the catch-net. Add a **thin deterministic gate** (3–4 checks, exactly the "thin floor" the master plan always specified):
1. **Transcript-grounding gate:** every cited URL must appear in the run transcript; every load-bearing quote/number must substring-match a tool output; fail-closed to honest gap on miss.
2. **SpyFu bidder-field gate:** forbid naming WHO bids on a term when the tool returned no advertiser field; hedge to "unknown."
3. **Numeric-coherence floor:** recompute asserted arithmetic/ratios; strip/flag on mismatch.
4. **Zero-evidence → honest-gap rule** for VoC and all evidence-anchored sections (the Attio fix).

Then re-run the SAME 7×3 matrix through the gated pipeline; require the data-thin subject (Plain) to clear the Phase A gate (≤1 section <8) before advancing. **Do NOT strangle the app path yet** (Phase E, last, per the flipped sequencing). Do NOT run more subjects — they'd reproduce the same 16/21 pattern.

## Cost
Corpus: <$1/subject (worker doesn't persist aggregate Perplexity usage; floor captured ~$0.15). Sections: GLM ≈ $0 (Ollama); paid tools ≈ $0.15–0.30/research section, higher for Competitor/PaidMedia (ad-probe). Full sweep total: low tens of dollars. Scoring: $0 (local reads).

## Artifacts
- Sections: `tmp/zz-agentic-glm/{plain,fathom,attio}/<section>/{body.md,transcript.json,meta.json}`
- Corpora: `tmp/zz-section-out/{plain,fathom,attio}-research-input.json`
- Scoring workflow: `wf_51edf2cc-fff` · Plain-VoC single-section proof: `wf_5af8af72-b17` (8/8)
- Harness (generalized, working tree): `scripts/zz-agentic-section.ts` · Corpus recorder: `scripts/zz-record-corpus.ts`
- VoC competitor-mode reframe (working tree): `src/lib/lab-engine/skills/positioning-voice-of-customer/SKILL.md`
