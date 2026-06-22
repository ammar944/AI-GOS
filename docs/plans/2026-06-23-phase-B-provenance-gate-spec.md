# Phase B — Thin Deterministic Provenance Gate (SPEC)

**Date:** 2026-06-23 · **Branch:** `refactor/architecture-deepening` · **Owner steer:** thin (4–5 checks), NOT a heavy in-app verifier rewire; keep the eval-agent as catch-net.
**Goal:** Build a deterministic provenance gate that catches GLM's fabrication patterns, remediate the 21 already-generated sections, and re-score the SAME 7×3 matrix gated. **Bar:** the data-thin subject **Plain** clears Phase A gate (≤1 of 7 sections <8) with value preserved.

This is the unblock the Phase A verdict (`docs/reports/2026-06-22-phase-A-cross-subject-verdict.md`) called for: value generalizes, provenance is the wall, the wall is **mechanically gateable**.

---

## 0. Artifact contract (VERIFIED 2026-06-23 against real files)

Per section: `tmp/zz-agentic-glm/<subject>/<section>/{body.md, transcript.json, meta.json}`
Subjects: `plain` `fathom` `attio`. Sections: `voc market buyer competitor offer demand paidmedia`.

`transcript.json` = **JSON array**; each element:
```
{ step:number, toolName:string, toolCallId:string, input:object, output:object, isError:boolean }
```
Tool names seen: `web_search firecrawl perplexity_research reviews keyword_ad_probe adlibrary keyword_discovery keyword_volume pagespeed`.

Key output shapes (the gate depends on these):
- `keyword_volume` / `keyword_discovery`: `output.keywords[] = {keyword, searchVolume, cpc(|null), difficulty, sourceUrl, display}` — **volume/CPC ARE present here.**
- `keyword_ad_probe`: `output = {keyword, organic_count, ad_count, top_organic:[{url,title,snippet}]}` — **NO advertiser field, NO searchVolume, NO cpc.** (Schema-deterministic basis for Check 3.)
- `reviews` / `firecrawl` / `web_search` / `perplexity_research` / `adlibrary`: free-form `output` objects carrying text/snippets/urls.

**Ground truth = the transcript.** A claim is grounded iff its URL/quote/number appears in some tool `output` (or `input`) for that run.

---

## 1. The five checks (deterministic)

Build a per-section ground-truth index from `transcript.json`:
- `transcriptText` = concat of `JSON.stringify(output)` + `JSON.stringify(input)` over all records, **normalized**: lowercase, collapse whitespace, strip URL-encoding (`%20`→space), strip thousands-separators from numbers (`1,600`→`1600`), unify quote glyphs.
- `transcriptUrls` = set of all URLs extracted from the raw (un-normalized) transcript, normalized to `host+path+query` (drop scheme/`www.`/trailing slash).
- `toolsUsed` = set of toolNames (non-error). `hasVolumeCpcTool` = any non-error `keyword_volume`/`keyword_discovery` with a `searchVolume`/`cpc`. `hasAdvertiserField` = **always false** (no tool returns one).
- `hasCustomerVoiceEvidence` = any non-error `reviews`/`firecrawl`/`web_search`/`perplexity_research`/`adlibrary` output that contains a quotable customer-voice string (a sentence-length snippet, not just a nav/title).

**Check 1 — URL grounding (`url_not_in_transcript`, ceiling 7 / laundered).**
Extract every URL cited in body (markdown `[..](url)` targets + bare URLs). Normalize. A cited URL must match a member of `transcriptUrls` OR appear as a substring of `transcriptText`. Miss → violation.

**Check 2 — quote/number grounding (`quote_not_in_transcript`, `number_not_in_transcript`, ceiling 7).**
- Quotes: every `"..."`/`“...”` span ≥15 chars that is presented as evidence (not a heading). Normalize, substring-check against `transcriptText`. Miss → violation. (Fuzzy: allow ≥90% token-overlap window match to avoid punctuation FPs.)
- Numbers: every numeric token presented as a **sourced fact** — carries a unit/context ($, %, `/mo`, `searches`, `x`, `seats`, `users`, `reviews`, `mo`, `/yr`) AND is attributed to a source (near a citation, "SpyFu", "per", "G2", a URL). Comma-stripped bare number must appear in `transcriptText`. Miss → violation. (Do NOT flag derived/rhetorical numbers — those are Check 4's job. Conservative: only flag clearly-sourced facts.)

**Check 3 — invented advertiser / fabricated volume-CPC (`invented_bidder`, `invented_volume_cpc`, ceiling 4 / INVENTED).**
- `invented_bidder`: body names a specific company as bidding/advertising/outbidding on a keyword ("X bids on", "X will outbid", "competitors like X are bidding on", "X is buying this term") AND keyword evidence in transcript is only `keyword_ad_probe`/`keyword_volume`/`keyword_discovery` (none carry an advertiser field). Generic hedges ("enterprise competitors", "Gong-class players") are OK — only **named** company-as-bidder fires.
- `invented_volume_cpc`: body cites a **searchVolume or CPC** as "per SpyFu"/sourced in a section whose transcript has `keyword_ad_probe` but **NO** `keyword_volume`/`keyword_discovery` carrying that number (the PaidMedia pattern — `keyword_ad_probe` returns only ad_count/organic).

**Check 4 — numeric coherence (`arithmetic_error`, ceiling 4).**
Detect asserted arithmetic/ratios: `$A/mo × 12 = $B/yr`, `A × N = B`, `A% of B`, `A out of B (C%)`, `Nx` multipliers stated between two cited numbers. Recompute; mismatch beyond 2% tolerance → violation. (Anchors from Phase A: attio PaidMedia `$4,140/yr` ≈ 2.4× overstated; attio Competitor HubSpot 10-seat ~47% understated.)

**Check 5 — zero-evidence synthesis (`synthesized_evidence`, ceiling 4).**
If `section ∈ {voc, buyer, competitor}` AND `hasCustomerVoiceEvidence == false` AND body presents customer quotes / named-customer proof as deployable evidence → violation. (The Attio thin-VoC failure: synthesized a homepage tagline + competitor-blog quote and shipped them as proof.)

**Severity → ceiling:** `invented_*`/`arithmetic_error`/`synthesized_evidence` → cap 4; `*_not_in_transcript` → cap 7; none → no cap. The gate REPORTS; the remediator FIXES.

---

## 2. Remediation (constrained, convergent — the gate's "hands")

Detection is the teeth; prose repair is one **constrained GLM pass** (Ollama `glm-5.2:cloud`, $0, no new tool calls — repair uses ONLY the existing transcript as source of truth):

> "Here is the section body. Here are the N deterministically-detected provenance violations (exact span + reason + what the transcript actually supports). Rewrite ONLY those spans: drop/demote laundered citations to plain directional claims; hedge named-bidder attributions to 'specific advertisers not identifiable from available data'; correct or remove incoherent arithmetic; replace synthesized proof with an explicit honest gap ('no customer voice retrievable for <subject>; recommend …'). Preserve every grounded claim, the structure, and the analytical value. Output the full corrected body."

**Convergence loop (guarantees 0 surviving detector-violations):** detect → if violations, GLM-remediate → re-detect → repeat (max 2 GLM rounds) → if still failing, **deterministically** strip the offending spans and label `[unverified]`/honest-gap. Output → `tmp/zz-agentic-glm-gated/<subject>/<section>/{body.md, violations.json}`.

### 2a. Test the "GLM is smart enough to fix itself" hypothesis (owner steer 2026-06-23)
GLM-5.2 is frontier/Opus-tier — so before assuming we *need* the deterministic strip, **measure how far the model fixes itself.** The deterministic detector is also the *measurement instrument*: you cannot claim "the smart model corrected it" without an independent, reliable check that it did.
- **Step 0 (model-level):** run a single **GLM self-audit pass** — feed GLM its own body + the full transcript and instruct it to flag/repair any citation/quote/number/attribution not supported by the transcript (its own intelligence, no deterministic hints).
- **Then run the deterministic detector** on that self-audited body and record `violationsRemainingAfterSelfAudit`.
- This yields the number that settles the debate: if GLM self-audit alone drives violations to ~0, the deterministic gate collapses to a thin backstop (the owner's preference — lean on the model). If violations persist (the Phase A prediction: models can't reliably string-check 150KB of transcript JSON), the deterministic ground-truth check earns its place. **Either way the model stays the brain; the gate only fact-checks footnotes.**
- Report `{rawViolations, afterSelfAudit, afterDeterministicRemediation}` per cell so the model-vs-gate contribution is explicit.

---

## 3. Re-score the gated matrix (same method as Phase A)

For each of the 21 gated bodies: **3 blind value-reads (median, `scripts/zz-value-read.mjs` §5 rubric) + 1 provenance re-audit (must report ~0 surviving fabrications) + reconcile.** `finalScore = min(medianValue, ceiling)` where ceiling now derives from *surviving* violations (target: none → ceiling 9–10).

**Success criteria (the Phase B gate):**
1. Detector trustworthy vs the Phase A oracle (§4): catches the known TP cells, ZERO false positives on the known-clean cells.
2. After remediation, re-detection reports ~0 violations on all 21.
3. **Value preserved**: gated medianValue ≈ raw medianValue (gate strips receipts, not insight). A collapse means over-aggressive remediation — fix.
4. **Plain clears**: ≤1 of Plain's 7 sections <8 on `finalScore`.

---

## 4. Oracle (Phase A audit — for detector validation; do NOT peek during detection, only to score precision/recall)

Must-CATCH (true positives):
- `attio/buyer`: ~10 laundered + 5 invented — incl. **Coca-Cola / Ryanair** fabricated as Attio enterprise customers, **USV** case study invented from a logo.
- `attio/competitor`: ~1 laundered + **3 invented**.
- `attio/voc`: **synthesized_evidence** — homepage tagline + competitor-blog quote shipped as deployable proof (thin-VoC).
- `attio/paidmedia`: **invented_volume_cpc** ("per SpyFu" vol/CPC; tool only ad-probed) + **arithmetic_error** (`$4,140/yr` ~2.4× overstated).
- `attio/offer`: invented enterprise customers (Coca-Cola/Ryanair minted again).
- `fathom/demand`: **invented_bidder** (named "Zendesk/Gong will outbid").
- `plain/competitor`: laundered URLs/quotes (ceiling-7 class), no invented.

Must-CLEAR (true negatives — ZERO violations, the false-positive guard):
- `plain/voc`: 38 grounded, 0 laundered, 0 invented (clean).
- `plain/offer`: clean (value 9).
- `plain/buyer`: provenance-clean.
- `plain/paidmedia`: provenance-clean.
- `fathom/voc`: clean (8/8) — competitor-mode VoC held.
- `plain/demand` keyword rows: 30 keyword rows verified 100% accurate → **must not flag those numbers** (number-grounding TN guard).
- `attio/market`: near-clean (≤1 laundered, 0 invented) — tolerance check.

Report detector **precision/recall** against this oracle. Trustworthy = recall ≥ the invented/synth class on every must-catch cell (those are ad-money-fatal) AND zero FP on must-clear cells.

---

## 5. File layout & constraints
- `scripts/provenance/gate.ts` — pure detector (the 5 checks + index builder); no `src/lib` app imports (script-side, `zz-*` convention). Exports `detect({bodyPath, transcriptPath, section, subject}) → {violations[], stats}`.
- `scripts/provenance/__tests__/gate.test.ts` — vitest; **TDD: write failing tests pinning §4 oracle cells first**, then implement.
- `scripts/zz-provenance-gate.ts` — CLI: `--subject --section [--all] [--remediate] [--detect-only]`; writes gated artifacts + `violations.json`.
- `scripts/zz-provenance-remediate.ts` (or a flag) — the GLM convergence pass (Ollama; reuse the model wiring in `scripts/zz-agentic-section.ts`).
- **Cost:** Phase B is ~$0 — detection local, remediation GLM/Ollama, scoring local Claude reads. **No paid lab tools, no corpus regen.** No new subjects.
- **Do NOT** touch the app path (`src/lib/lab-engine/**`) — Phase E (last) wires the gate into prod. This phase proves the gate on the 21 existing artifacts only.
- Verification gate (repo rule): `npm run test:run -- scripts/provenance` green, `npx tsc --noEmit` no NEW errors.
