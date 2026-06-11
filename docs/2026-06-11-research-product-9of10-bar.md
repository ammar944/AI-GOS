# The 9/10 GTM Research Product Bar — and the rebuild that reaches it

> Written 2026-06-11 after a fresh-eyes product audit of run `98bbec81` (subject: Airtable).
> Audit inputs: 5 persona judges (GTM strategist 4/10, media buyer 4/10, SaaS founder 3.5/10, fabrication auditor 3/10, product designer 3.5/10 — **all five: would not pay**), 4 code-layer tracers, 3 prior judge reports, live UI census.
> This document replaces the old validators as the north star. Existing validators survive only where they serve this bar.

---

## Part 1 — The Bar

A report clears 9/10 when a serious SaaS founder, growth lead, or media buyer reads it and says: *"sharp, trustworthy, easy to digest, strategically useful, I can act on it."* Concretely:

### 1. Research trust
- **Every load-bearing claim is typed**: `measured` (tool-observed, dated), `sourced` (live URL whose content contains the claim), `benchmark` (industry figure, labeled), `assumption` (ours, labeled, confirm-with-client), or `gap` (stated honestly in plain language). No fifth state. No untyped numbers.
- **No dead or invented references.** Every URL resolves at commit time. Every named person/community/newsletter/venue exists (DNS + content containment). A venue whose URL fails liveness is dropped — never "URL scrubbed, number kept."
- **Claims about the subject's own site are observations**: CTA/funnel claims carry a fetched excerpt of the actual page. "100% of CTAs route to demo" can never ship from model memory.
- **Confidence shown to the reader = computed trust** (citation liveness × containment × review verdict), never model self-report. A section with zero real evidence can never outscore a section with measured data.
- **Subject-scale sanity**: recommendations must fit the subject's size and motion (no $2.6M TAM for a $375M-ARR company; no "introduce a free trial" for a famously freemium product).

### 2. Source & evidence quality
- VoC quotes are **verbatim, human-authored, permalinked, ≤280 chars** — or the section says, in one honest paragraph, "no customer quotes retrieved this run" with a sourcing plan. Nav menus, journalist prose, and competitor marketing can never occupy a quote field.
- Evidence and the claim it supports appear **on the same line** (inline chips/drawers), not claim-here/appendix-there.
- Paraphrases are labeled as paraphrases, with the page-level source. Never inside a field named "verbatim".

### 3. Strategic usefulness
- **One thesis per deliverable**, stated on page one, argued by the sections in order. Sections are chapters of one argument, not seven parallel documents.
- Cross-section contradictions are **arbitrated before commit** (one keyword-cluster total, one price, one CAC, one strategy call), not shipped in parallel.
- Insights are **earned**: emitted only when the section's own evidence supports them. Fewer, sharper. No mandatory four-insight quota per section.
- Every recommendation carries **cost, confidence, the single best piece of evidence, and a proves-wrong-if tripwire**.

### 4. Media-plan actionability
- **Budgets are physically buyable**: per audience — keyword set, volume, CPC estimate (with method), max absorbable spend, assigned spend. Over-allocation is visible in the structure. Computed in code, not by the LLM.
- **Funnel math closes**: budget → CPC → clicks → CVR → conversions → CAC, every cell tagged measured/benchmark/assumption; break-even rates stated; reconciles with the demand section's measured volumes.
- **Creative is runnable**: every hook traces to actual VoC language or a cited competitor weakness, and carries a compliance status (runnable / needs proof asset / blocked). No invented case studies or fabricated quantities in paste-ready copy.
- Plan ships in buildable shape: campaign hierarchy, creative matrix (audience × angle × format), measurement spec — not prose tables.

### 5. Section structure
- Reading order is the argument: **Executive decision memo → Demand reality → Buyer reality → Competitor reality → Voice of customer → Offer constraint → Paid media plan**.
- Every section opens with its verdict and 3–5 key findings; exhibits (full tables, ad walls) are secondary/collapsible.
- Blocks are **omittable**: a section may say "this block is not relevant / not evidenced for this subject" in one sentence. Empty-slot apology rows never render.

### 6. Visual presentation & readability
- **Tables only where comparison is the job** (competitor set, pricing, keyword table). Reasoning never renders as a table. Target ≤ 1/3 of current table count.
- The highest-value content gets the loudest visual treatment (verdict hero cards), not the quietest.
- Charts where they beat prose: keyword volume bars, budget split, positioning 2×2, awareness bar — only when data earned them.
- A founder gets each section's takeaway in **10 seconds**; the whole deliverable's in **5 minutes** via the memo; full read ≤ 25 minutes (~15k words max; currently ~50k).
- **Zero pipeline chrome in the deliverable**: no validator text, no "evidence gap: budget exhausted", no `[unverified]` mid-sentence markers, no enum ids, no internal jargon ("depth gate"), no quarantine counters, no `.invalid` URLs, no apology tables. Gaps are stated in client-plain language in a dedicated coverage note.

### 7. UI information architecture
- Page one is the **decision memo** (the artifact the buyer forwards).
- Provenance is a **visual system** (chips/dimming + evidence drawer), not inline noise.
- Process telemetry (activity, timers, commit checklists) lives outside the reading surface once a section is complete.

---

## Part 2 — Root causes (why the current app misses the bar)

**RC1 — The generation contract is quota-shaped, not argument-shaped.**
~45 array-of-object schema fields with row floors (≥10 keywords, all-5 awareness levels, all-3 force types, exactly-8 creative slots), a fixed 44-heading outline (`sub-sections.ts`), prose capped at 1–2 paragraphs, "numbers live in cards". The only feedback loop the model experiences is schema rejection (`answer-tool.ts`, repair prompts list only validation issues; every prompt ends with a literal "Validator checklist:"). When evidence < quota, the rational outputs are padding, sentinels, or fabrication. Insight has no contract; structure has a strict one. *(schemas: `artifacts/schemas/*.ts`; prompts: `build-prompts.ts:192,665,760,797`, `section-prompt-guidance.ts:24-166`)*

**RC2 — Acquisition can't deliver what schemas promise, and failure ships silently.**
Snippet-native end to end (SERP titles/snippets, 1,600-token Perplexity caps, 3 Firecrawl scrapes behind bot walls, 75s VoC prepass, 4–8 lookups/section). VoC's verbatim-permalink contract degrades by design to paraphrase or raw-scrape promotion and still commits — this run shipped a 21KB InfoWorld nav menu as the lead "verbatim quote", duplicated across 5 blocks (2.5MB artifact, 51,634px of UI scroll). Subject ad identity resolved to `wikipedia.org`, so Airtable's own Google ads were never retrieved and the report implies zero. *(`reviews.ts:521-871,1227-1235`, `run-section.ts:2214,5813`)*

**RC3 — No synthesis layer: seven islands plus a remix section.**
Sections never see each other; cross-section numeric reconciliation does not exist (`numeric-coherence.ts` is intra-section; `committable-gate.ts` is single-artifact). The paid-media plan receives raw JSON dumps of six sections and re-tables them — inheriting the false demo-gate premise wholesale, pointing $10K/mo at a 2,820-search cluster, and projecting trials that are physically unreachable from its own demand data. Three different non-brand ceilings (4,300 / 2,200 / 2,820) and a 10× ACV slip ($540 vs $5,400) shipped in one deliverable.

**RC4 — Trust is computed wrong and displayed wrong.**
"Verified" = substring co-occurrence anywhere in any fetched text (`structural-verifier.ts:369-390`); VoC scored 0.98 — the run's highest — on its worst content (trust signal inverted). Confidence is model self-report. Provenance enums are snap-coerced with silent defaults (fabricating attribution, `paid-media-plan.ts:255-292`). Placeholder gates strip fake URLs but keep the invented numbers they justified. The pipeline's own ledger flagged the demo-gate claim unsupported — it shipped as the binding constraint anyway and three sections built on it.

**RC5 — The rendering layer is a JSON projection, not an editorial product.**
Renderers transcribe schema 1:1 — ~38 DataTables / 1 chart / 0 cards; columns are Zod field names. The strategist layer (verdict, non-obvious read, tension) renders in the quietest style on the page (13px muted, 1px border) under internal jargon ("depth gate"). Pipeline chrome ships to the client. The multi-minute drafting phase renders a reflection-based JSON pretty-printer. Evidence is a per-row raw-link column instead of the existing Cite hover-card system. *(`section-renderers/*`, `strategic-insight-panel.tsx:37-57`, `typed-artifact-renderer.tsx:104-446`)*

**RC6 — Prompt economics invert attention.**
27–40KB skills injected wholesale 2–3× per run vs a 12KB evidence cap — the model knows the rules 3–6× better than the company. ~30–40% of payload is vivid fictional-exemplar content that is forbidden output — and it leaks (VoC's strategy layer describes an "AI operating loop" product that is not Airtable). Threat-register prompts ("automatic FAIL") select hedged compliance prose over committed judgment.

---

## Part 3 — The rebuild (what it takes, not the minimum)

Keep: the 7 section keys / DB zones / dispatch plumbing (pipeline identity), the live tools, the honest-gap ethos, deterministic gates that already work (placeholder strip, exemplar motifs, ad quarantine).
Rebuild: contracts, acquisition floors, synthesis, trust computation, and the entire reading layer.

### Wave 1 — Kill the fabrication-forcers (schemas + validators + skills)
1. Remove row floors and enum-coverage quotas that force invention: awareness all-5-levels, structural-forces all-3-types, ≥10 keywords, ≥28 VoC cards, 4-input TAM recipe, venue audienceSize-required. Every block gains a legal one-sentence omit state (`notEvidenced: reason`).
2. Delete `withCount()` padding normalizers in `paid-media-plan.ts:885-973` — filler rows must never ship. Remove snap-coercion silent defaults; unrecognized provenance = validation error, not 'gtmBrief'.
3. TAM: compute deterministically from recorded inputs in code; suppress the headline number when ≥2 inputs are gaps.
4. Skills: delete quota language, delete fictional-account exemplars (replace with 5-line skeletal shape examples), end prompts with the reader contract, not the validator checklist.

### Wave 2 — Make evidence real or honestly absent (acquisition + gates)
1. **URL liveness + containment gate** (deterministic, pre-commit): DNS/HTTP every sourceUrl; grep fetched content for the attributed entity/number; fail → drop the row (claim and number together).
2. **VoC quote admission**: human-voice check + ≤280 chars + permalink required; kill the deterministic snippet-promotion pass; honest-empty section state renders as one paragraph + sourcing plan.
3. **Subject observations**: fetch homepage + pricing CTAs at run start; funnel/CTA claims must cite the fetched excerpt.
4. **Subject ad identity pinned to onboarding domain** — never re-resolved to wikipedia.org.

### Wave 3 — Synthesis layer (fact ledger + thesis + feasibility)
1. **Fact ledger**: after the 6 sections commit, a reconciliation pass single-writers shared numbers (prices, keyword totals, customer count, CAC targets) with winners + reasons; contradictions either patched into sections or flagged; ledger stored on the artifact.
2. **Executive decision memo** (upgrade existing exec-brief): thesis + 3–5 decisions, each with cost, confidence grade, best evidence, proves-wrong-if. Reconciliation internals (per-section readings) move to a collapsed appendix, not page one.
3. **Media-plan feasibility math in code**: volume × CTR × CPC → max absorbable spend per audience; budget overruns are blocked at commit, not discovered by the reader. CAC math must close against the stated targets.

### Wave 4 — The reading layer (renderers + reader IA)
1. New primitives: `VerdictHero`, `DecisionCard`, `StatCallout`, `EvidenceChip` + `EvidenceDrawer`, `QuoteCard`, `GapNote` (client-plain), `FunnelMath`, `CreativeMatrix`, `BudgetBar`, `Positioning2x2`.
2. Rewrite section renderers: verdict hero → key findings narrative with evidence chips → exhibits collapsed. Tables only for true comparisons. Map all enum ids through labels. Strip every piece of pipeline chrome.
3. Reader IA: memo first; section order = argument order; provenance chips everywhere; drafting view gets a designed skeleton, not the JSON reflector.
4. VoC renderer: quote clusters with permalink chips, or the honest-empty state.

### Wave 5 — Prove it
Fresh E2E run on a real subject → 5 fresh-context judges (strategist, media buyer, fabrication auditor, UX judge, founder) against THIS bar. Ship only on ≥9/10 median with no critical fabrication findings.

### Execution notes
- Renderers must stay tolerant of old artifact bodies in the DB (null-check legacy shapes; new fields optional at render).
- Worker boundary untouched (corpus stays as-is this pass; corpus quality is not the binding constraint — the contract and reading layers are).
- Verification gate per repo rules: tsc 0 net-new, scoped vitest green, `npm run build` exit 0 before any live run.
