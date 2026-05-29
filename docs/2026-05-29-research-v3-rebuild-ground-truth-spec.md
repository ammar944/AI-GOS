# Research V3 Premium Rebuild — Ground-Truth Spec

Date: 2026-05-29
Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
Branch: `feat/v2-lab-section-wire`
Source QA: `.gstack/qa-reports/qa-report-localhost-3000-2026-05-29.md`
Source handoff: `docs/qa/2026-05-29-research-v3-live-ux-qa-claude-handoff.md`
Ground-truth run: `db41a945-b8d1-4f02-83a7-6481f7d3500e` (artifact_id `c7824975-a20f-43bd-8617-04054eb3691f`)

This spec supersedes the handoff where they conflict. It records the aligned decisions
from the grilling session and the verified data reality behind each UI surface. **Build
order: ground-truth (done) → `/prototype` variations → build swarm → verify.**

---

## Aligned decisions (locked with the user)

1. **Ground truth first** — no UI surface is built until its backing metadata is verified to exist and flow. (This doc is that verification.)
2. **Prototype before commit** — UI goes through `/prototype` as toggleable variations; user picks before the real build.
3. **Field contract = 2 classes.** `hard-required` (= existing `required: true`, gates Run audit) vs `optional enrichment` (= existing `required: false`, never red, never blocks). Fix `buildOnboardingReviewMetadata` to respect the flag it currently ignores. **No field reclassification.** The QA's "conditional" class is dropped (its only trigger was paid-media, which is deferred).
4. **Live-run = premium agent-at-work UI.** Process-streaming, **atomic verified content**. The lab engine content path is untouched; the structural verifier + evidence-support repair stay the gate. All work is presentation-layer.
5. **Competitor ads = 4 honest states + fixture-proven cards.** No engine/budget change.
6. **Design = premium research-agent _patterns_ inside DESIGN.md.** North star = Parallel.ai / Linear polish, not Perplexity's consumer look. shadcn MCP AI components restyled to DESIGN.md tokens. No design-system deviation.
7. **⏸️ Paid-media plan deferred** to a final dedicated pass — its inputs, economics, the Media Plan Setup step, and the section itself are out of scope here.

ADR-0010 (process-streaming / atomic artifact) to be written when the prototype direction is locked.

---

## Ground truth — verified data reality

### Activity stream (`research_section_events`, keyed by `artifact_id`)
Event types + real volumes from the run:

| event_type | n | `message` (clean) | leak lives in |
|---|---|---|---|
| tool-started | 188 | "web_search started" | — |
| tool-finished | 188 | "web_search finished" | `payload.metadata.outputSummary` (raw result JSON), `.query` (clean, usable) |
| sub-section-committed | 76 | "ICP existence check committed" | — (synthetic, post-commit) |
| artifact-saved | 13 | "… artifact saved" | — |
| section-started | 13 | "… started" | — |
| section-completed | 13 | "… completed" | — |
| skill-loaded | 13 | "Loaded positioning-market-category" | — |
| validation-failed | 6 | "Answer tool output failed validation" | `payload.metadata.issues` (raw Zod array) |
| repair-started | 6 | "Answer tool repair started" | `payload.metadata.reason` ("grounding 3 unsupported claim(s)", "sources: have 4, need >=5", raw Zod array) |
| structured-output-started | 2 | "Structured output started" | — |
| section-failed | 0 (none this run) | — | `payload.metadata.error` |

**Key fact:** `message` is already customer-safe. The leak is `payload.metadata`. The adapter
maps `event_type` → phase label and renders curated fields only.

### Activity → product-phase map (the 7 phases)
- `section-started` + `skill-loaded` → **Preparing context**
- `tool-started`/`tool-finished` (web_search) → **Searching source evidence** (show `metadata.query` as a clean "Searched: …" chip; never `outputSummary`)
- `structured-output-started` → **Drafting section**
- `validation-failed` → **Checking source support**
- `repair-started` → **Refining unsupported claims** (translate `reason`: "grounding N unsupported claim(s)" → "Strengthening N claims with sources"; "sources: have X, need >=Y" → "Gathering more sources"; raw Zod array → "Refining structure". **Never render the raw reason/array.**)
- `sub-section-committed` → **Sub-section ready** (messages are clean, e.g. "ICP existence check committed")
- `artifact-saved` + `section-completed` → **Section verified & committed**

Raw `payload` goes behind an off-by-default **Developer details** drawer.

### Timeline (`research_section_runs`)
- 6 positioning sections start in parallel at `03:03:24` (±0.3s) — **no waves**.
- Completions: BuyerICP 03:04:18 (~54s, fastest) … Competitor 03:06:31 (**~3m7s, long-pole**, 4 repair cycles).
- Paid media starts `03:06:18` (after positioning) → completes `03:08:02` (~1m44s).
- Parent created `03:03:19`, updated `03:08:03` → **~4m44s** end-to-end.
- Stage timeline = **Corpus → 6 parallel positioning → Paid media synthesis → Final manual**, derived from real per-section status/timestamps. Not a fake bar.

### Artifact structure (`research_artifact_sections.data`)
Top-level wrapper: `{ id, runId, sectionId, sectionTitle, verdict, statusSummary, confidence, sources, verification, createdAt, body }`.
Typed sub-sections live under **`data.body.<subSection>`**, distinct per section:

- `positioningMarketCategory`: categoryDefinition, categoryMaturity, marketSize, structuralForces
- `positioningBuyerICP`: awarenessDistribution, buyingContext, clusters, icpExistenceCheck, personaReality
- `positioningCompetitorLandscape`: adEvidence, adPresence, competitorSet, narrativeArcs, positioningTaxonomy, pricingReality, publicWeaknesses, shareOfVoice
- `positioningVoiceOfCustomer`: decisionCriteria, objections, painLanguage, successLanguage, switchingStories
- `positioningDemandIntent`: contentGaps, intentSignals, keywordDemand, questionMining, venueMap
- `positioningOfferDiagnostic`: channelTruth, funnelDiagnosis, offerMarketFit, redFlags, retentionHealth
- `positioningPaidMediaPlan` (deferred): anglesToTest, audienceTypes, campaignOverview, campaignPhases, channelSuggestions, competitorMarketingInsights, competitorReviewInsights, creativeFramework, creativeStrategy, funnelIdeation, kpis, salesProcess

### Verification signal (`data.verification`)
Shape: `{ claims: [{ claim: { raw }, … }], verifiedCount, unsupportedCount }`.
→ Render a per-section **"M verified · N flagged"** trust badge. This is the fabrication gate
made visible. Never leak the raw repair internals; surface the counts + a calm label.

### Competitor ad evidence (`data.body.adEvidence`) — real shape
```
{ prose: "No live ad-library tool results were available … rate-limited … documented evidence gap …",
  advertiserGroups: [
    { advertiserName: "Kalungi", domain: null, platforms: ["google"],
      creatives: [],                       // EMPTY on live runs (budget capped)
      rawCounts/displayableCounts: {google:0,meta:0,linkedin:0}, displayableTotal: 0,
      libraryLinks: { google: "https://adstransparency.google.com/?region=US&query=Kalungi" },
      dataGaps: [{ platform:"google", reason:"google lookup failed: section budget exhausted after 6 lookups" }],
      sourceErrors: [{ platform:"google", message:"…" }], observedAt, rawSourceSamples: [] } ] }
```
Plus `data.body.adPresence.prose` = qualitative fallback synthesized from web search.

**4 states (derived from real fields):**
- `ads found` — `creatives.length > 0` → render creative cards (platform, advertiser, headline/body, landingUrl, imageUrl, sourceUrl).
- `no active ads found` — `creatives: []`, no `dataGaps` → "No active ads found" + last-checked.
- `lookup capped` — `creatives: []` + `dataGaps` reason contains budget/rate → "Lookup capped — check {libraryLinks.google} ↗" + the search context.
- `not checked` — advertiser group absent → "Not yet checked".

Fixture for the "ads found" path populates `creatives[]` per the schema (tests only; live runs stay mostly "capped" — honest).

---

## Other verified findings (small, in scope — NOT paid media)
- **Field contract bug**: `onboarding-review.ts:80` marks any blank `Missing`; `buildOnboardingReviewMetadata` (108–130) never reads `field.required`. Funnel metrics, `avgSalesCycle`, `demoToClose`, `growthTrend`, and the entire Media Plan Setup step are already `required: false` — respecting the flag fixes the "100%-but-MISSING" bug.
- **Rerun gating**: `audit-reader-shell.tsx:1112-1125` only disables on `rerunPending`; disable/relabel while the active section is non-terminal.
- **Dup React keys**: `key={…url}` at `typed-artifact-renderer.tsx:377`, `audit-reader-shell.tsx:424`, `buyer-icp/renderer.tsx:133` → composite keys. (The "64" is the warning repeat count; ~3-5 sites.)
- **a11y**: 49 label mis-associations + 8 missing id/name in the onboarding wizard → fixed as part of the cockpit rebuild (shared Field/Label component).
- **Progress %**: `audit-state/route.ts:573` = `childrenComplete / 6`; per-section phases via `deriveSectionPhase`. No parent stage model yet → the timeline is new presentation over real signals.

---

## Prototype brief (`/prototype`)
Build **several radically different variations, toggleable from one route**, fed by the **real
`db41a945` event stream + committed artifacts** (exported as a fixture — not lorem ipsum),
using shadcn MCP AI components restyled to DESIGN.md tokens.

Surfaces to prototype (priority order):
1. **Live-run agent-at-work view** (centerpiece): phase narration feed + real stage timeline + per-section verification badge + atomic artifact resolve-in + run receipt in <500ms. Developer-details drawer off by default.
2. **Onboarding "Brief Review cockpit"**: readiness summary (true blockers only) + one focused step + optional-enrichment queue.
3. **Competitor ad-evidence module**: the 4 states + creative cards (fixture) + "capped → transparency link" treatment.

User picks a direction per surface → that becomes the build-swarm spec.

## Verification plan (Phase 3)
- `npm run lint`, `npx tsc --noEmit`
- Focused unit tests: onboarding review (hard blocks / optional never pins), section-activity adapter (no raw JSON/Zod/parse internals in default detail; phase mapping), competitor ad states (ads-found fixture renders cards; capped renders gap+link).
- Chrome MCP browser proof at desktop + 390px: front door, corpus 1s/5s, onboarding missing-required + optional-blank, audit 0s/5s/30s, final artifact, mobile reader.
- One live DeepSeek run for final proof.
