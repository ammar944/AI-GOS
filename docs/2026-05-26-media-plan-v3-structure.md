# Paid Media Plan v3 — Structure Alignment Proposal

> **Status:** Alignment proposal. No code. For human sign-off before any runner/renderer/schema work.
> **Date:** 2026-05-26
> **Author:** research/structure exploration pass
> **Replaces:** the heavy `src/lib/media-plan/` pipeline (10-section Perplexity research + CAC math + QvC platform scoring + 14-step deterministic budget validation, documented in `docs/media-plan-technical-reference.md`). v3 does **ZERO fresh research** — it is a **skill-backed synthesis** of the 6 positioning sections + the GTM brief.

---

## 0. Framing

The old media-plan pipeline modeled CAC, scored platforms, and ran fresh Perplexity research. The team does **none** of that. Their real plan is:

- a **TEMPLATED media-buying core** (budget, phases, audience archetypes, creative counts, KPI list) — copy-paste, only numbers vary; and
- a **RESEARCH-BACKED strategic upgrade** (specific ad angles with copy, a filled-in creative framework, competitor insights, funnel ideation, channel feedback) — synthesized from the 6 positioning sections that already ran. No new web research.

So v3 = **synthesis section, not a research section.** It is the 7th section, sequenced last, and it reads the 6 committed positioning artifacts + the GTM brief as input. This mirrors the two synthesis skills that already exist on the worker (`ai-gos-gtm-synthesis`, `ai-gos-activation-plan`) — neither is in the 6-section research registry, which is the precedent for a "consumes prior sections" skill.

---

## 1. RovR `.pptx` — slide-by-slide outline (the templated core)

Extracted from `/Users/ammar/Downloads/RovR_PaidMediaPlan.pptx` (7 slides; speaker notes were page numbers only; 2 charts).

| # | Slide title | Content / sub-sections |
|---|---|---|
| 1 | **Paid Media Plan — RovR** | Cover. "Meta Advertising · Phase 1 & 2 · $3,000 / Month". "Prepared by SaaS Launch · saaslaunch.net". |
| 2 | **Campaign Overview** | "Monthly paid media budget · Meta Ads · 4-Month, 2-Phase Plan". Tiles: **$3,000 Monthly Budget**; **$6,000 Phase 1 — Testing** (Months 1–2, validate audiences & creative); **$6,000 Phase 2 — Optimization** (Months 3–4, scale winning combinations); **$100 Daily Spend** (across test audiences, KPI: MQLs). *(Chart1 confirms Phase1=$6,000, Phase2=$6,000.)* |
| 3 | **Campaign Phases** | "A 4-month plan: 2-month testing phase → 2-month optimization & scale phase". **Phase 1 — Testing** (Months 1–2, Heavy Testing, $3,000/mo): test multiple audience types in parallel; full mix of static + UGC; identify winning audience×creative×angle; collect CPL/CTR/MQL quality; no scaling until Phase 1 reviewed. **Phase 2 — Optimization & Scale** (Months 3–4, $3,000/mo, after Phase 1 review): turn off underperformers; double down on top performers; scale budget on winning combos; refresh creative + retargeting on Phase 1 signals; continuous CRO + LP iteration. |
| 4 | **Audience Types** | "3 audiences tested in parallel during Phase 1 · KPI: MQLs · $3,000/mo". **01 Broad Prospecting — Interest Stack** ($33/day): layered interest targeting (paid media, Meta Ads, e-commerce, SaaS, agencies, small-business-owner categories). **02 High Intent — ABM ICP List + 1% Lookalike** ($33/day): upload RovR's ideal-customer list paired with Meta 1% Lookalike. **03 AI Optimized — Advantage+** ($33/day): Meta's AI-driven Advantage+ with minimal targeting constraints. |
| 5 | **Creative Strategy** | "Ad mix tested across all 3 audiences simultaneously during Phase 1". **5 Static Ads** — Problem–Solution–Transformation + Objection Handling angles. **3 UGC Videos** — USP-focused, objection handling & before/after. **8 Total Ad Creatives per Audience.** *(Chart2 confirms 5 statics / 3 UGC.)* |
| 6 | **Creative Framework** | "Every creative built on a defined framework so test results are clear and repeatable." **5 Static Ads** (Problem–Solution–Transformation & Objection Handling): Static 1–3 = Problem/Solution/Transformation; Static 4–5 = Objection Handling. **3 UGC Videos** (USP storytelling + before/after): UGC 1 = USP (who it's for, problem it solves, impact); UGC 2 = USP product intro + objection handling; UGC 3 = Before & After. |
| 7 | **KPIs & Success Metrics** | "Three core metrics across the campaign." **MQLs** (Primary KPI): Marketing Qualified Leads, free deep-analysis sign-ups. **CTR** (creative & messaging health): hook & angle performance, creative engagement. **CPL** (efficiency): cost per lead, budget efficiency per MQL. Footer: "Phase 1 review at end of month 2 to align on optimization priorities before Phase 2." |

**Read of the deck:** RovR's deck *is* the fully-templated core — every slide is the stakeholder's "no thought behind it" template with only the budget number swapped. The strategic upgrade the stakeholder described (angles with copy, filled framework, competitor insights, funnel ideation, channel feedback) is **not present in the deck** — it lives only in the walkthrough transcript. v3's job is to keep the deck's templated spine and **bolt the synthesized upgrade onto it.**

---

## 2. Proposed section id + label

Follow `POSITIONING_SECTION_IDS` camelCase-with-`positioning`-prefix convention (`positioningMarketCategory`, `positioningBuyerICP`, …).

- **Section id:** `positioningPaidMediaPlan`
- **Label:** `Paid Media Plan`
- **Tool name** (matches `save_<x>_artifact` convention): `save_paid_media_plan_artifact`
- **Platform-skill id / dir:** `ai-gos-paid-media-plan` → `research-worker/platform-skills/ai-gos-paid-media-plan/SKILL.md`
- **Artifact key** (for `TYPED_ARTIFACT_KEYS_BY_ZONE` in `src/types/positioning-artifact.ts`): `paidMediaPlanArtifact`

> **Naming note:** keep the `positioning*` prefix even though this is a synthesis, not a positioning research section — every existing registry, state-machine, run-id map, dispatch validator, and orchestrator keys off that prefix (`POSITIONING_SECTION_IDS`, `POSITIONING_ZONE_SET`, `ZoneIdSchema = z.enum(POSITIONING_SECTION_IDS)`). Breaking the prefix to coin a separate `synthesis*` namespace would fork all of those. Recommend `positioningPaidMediaPlan`.

> **Sequencing:** it must run **after** all 6 positioning sections commit, because it reads their artifacts. This is a behavioral change from the current "fan out all 6 in parallel waves" model — the orchestrator must gate this 7th section behind the 6, or run it as a dependent follow-up wave. (Flagged in §7 as the one orchestration change required.)

---

## 3. Ordered sub-sections (RovR outline × current × desired, reconciled)

Each sub-section is tagged exactly one of:

- **[TEMPLATED]** — filled from the GTM brief / a fixed template. Numbers vary, copy is boilerplate.
- **[SYNTHESIZED]** — AI-generated from the 6 positioning artifacts. This is the upgrade. Must "fill in the blanks," never ship a label.
- **[STATIC-ASSET]** — linked SOP docs / looms supplied via the brief; the section renders links + a short explainer, generates nothing.

The order interleaves the templated spine (slides 2–7) with the synthesized upgrade so the document reads as one plan, templated structure first, personalized substance layered in.

| # | Sub-section | Tag | Source of truth | Maps to |
|---|---|---|---|---|
| 1 | **Campaign Overview** — total monthly budget, # months, # phases, daily spend, primary KPI | **[TEMPLATED]** | GTM brief (`monthlyAdBudget`, `campaignDuration`) + template | RovR slide 2 |
| 2 | **Campaign Phases** — Phase 1 testing / Phase 2 optimization, per-phase budget split + boilerplate bullets | **[TEMPLATED]** | GTM brief + fixed phase copy | RovR slide 3 |
| 3 | **Audience Types** — Interest Stack (=ICP), ABM/Lookalike (or uploaded lead list), Advantage+; 2 audiences if budget low | **[TEMPLATED]** (audience *labels* + per-day split) with **[SYNTHESIZED]** interest-stack contents | `positioningBuyerICP` fills the actual interest stack + ABM firmographics; brief supplies budget split + lead-list availability | RovR slide 4 |
| 4 | **Creative Strategy** — creative counts (5 static + 3 UGC, or 5+5) + which angle TYPES are in the mix | **[TEMPLATED]** | GTM brief (creative count = preference/capacity) + template | RovR slide 5 |
| 5 | **Angles to Test** — multiple ready-to-use ad angles **with actual copy** (hook + body line + the insight behind it) | **[SYNTHESIZED]** | `positioningVoiceOfCustomer`, `positioningDemandIntent`, `positioningMarketCategory`, `positioningCompetitorLandscape` | Desired #1 (new; not in RovR deck) |
| 6 | **Creative Framework (filled)** — per chosen type, the *actual content*: UPS sentence; Problem→Solution→Transformation; Objection + the answer; Founder talking-head script beat; (Product Demo rare) | **[SYNTHESIZED]** | `positioningOfferDiagnostic` + `positioningVoiceOfCustomer` (objections/success) + `positioningMarketCategory` (UPS) | RovR slide 6 turned from labels into copy; Desired #2 |
| 7 | **Competitor Insights — Reviews** — what customers complain about competitors, framed as ad leverage (e.g. "competitor pricing too high") | **[SYNTHESIZED]** | `positioningVoiceOfCustomer` (pain/switching), `positioningCompetitorLandscape` (public weaknesses) | Desired #5 (new) |
| 8 | **Competitor Insights — Marketing** — per competitor: Messaging, **Ads (platforms + est. spend)**, ICP/niche, Angles tested, Positioning claim, Offer/guarantee | **[SYNTHESIZED]** | `positioningCompetitorLandscape` (messaging/positioning/pricing/SoV), `positioningMarketCategory` | Desired #6 (new) — **see Gap G1: ad platforms + spend not currently captured** |
| 9 | **Funnel Ideation** — recommend funnel(s) with depth: direct-to-calendar / booking page / free-audit LP → nurture → close / advanced VSL+site; explain opt-in→booked-call | **[SYNTHESIZED]** | `positioningOfferDiagnostic` (funnel breaks, channel truth) + `positioningBuyerICP` (awareness level) + brief (`currentFunnelType`, `salesCycleLength`) | Desired #4 (new) |
| 10 | **Sales Process** — link 4 SOP docs (process overview, SDR, opt-in, personalization) + 15-min loom, with a short explainer | **[STATIC-ASSET]** | GTM brief link fields (see §5) + `salesProcessOverview` text | Desired #3 (new) |
| 11 | **Channel & Current-Funnel Suggestions** — actionable feedback on the client's *other* channels: their Google Ads, organic/SEO/GEO, website (speed/clarity/messaging), content quality | **[SYNTHESIZED]** | `positioningOfferDiagnostic` (channel truth) + brief (`currentMarketingActivities`, `websiteUrl`) | Desired #7 (new) — **see Gaps G2/G3: client's own ads/website/SEO not audited as a structured object** |
| 12 | **KPIs & Success Metrics** — primary + supporting metrics, depends SLG vs PLG (SLG = MQLs, CPL, CTR, CPA, Cost/Demo, SQLs) | **[TEMPLATED]** | GTM brief (SLG vs PLG, `targetCpl`, `targetCac`) + template | RovR slide 7 |

**Tag totals:** TEMPLATED ×5 (1,2,4,12 + audience labels in 3) · SYNTHESIZED ×6 (5,6,7,8,9,11 + interest-stack contents in 3) · STATIC-ASSET ×1 (10).

---

## 4. Proposed typed Zod/TS schema shape

Follows the canonical convention in `src/lib/managed-agents/schemas/*` exactly:

- Top-level meta: `sectionTitle`, `verdict`, `statusSummary`, `confidence: z.number()`, `sources: SourceSchema.array()`.
- One **named object per sub-section**, each `{ prose: string, <typed array> }`. **No generic envelope** (per `docs/research-sections.md`).
- **No `.min()/.max()` on Zod numbers** (Anthropic structured-output rejects them — `.claude/rules/learned-patterns.md`). Cardinality lives in a separate `validatePaidMediaPlanMinimums()` returning `ValidationResult`, registered in `section-artifact-schemas.ts`.
- Mirror into **both** `src/lib/managed-agents/schemas/paid-media-plan.ts` **and** `research-worker/src/agents/subagents/schemas/paid-media-plan.ts` (the Next.js process cannot import from the worker; schemas are duplicated — see the header comment in every existing schema file).

```ts
// src/lib/managed-agents/schemas/paid-media-plan.ts  (mirror in research-worker/.../schemas/)
import { z } from 'zod';
import { SourceSchema, type ValidationResult, /* hasText, pushMissingText, uniqueCount, validateUrl */ } from './_shared';

/* ── enums ── */
const GTM_MOTION = ['SLG', 'PLG'] as const;
const CREATIVE_TYPE = [
  'unique-selling-point',
  'problem-solution-transformation',
  'objection-handling',
  'founder-talking-head',
  'product-demo',
] as const;
const FUNNEL_TYPE = [
  'direct-to-calendar',
  'booking-page',
  'free-audit-landing-page',
  'advanced-vsl-website',
] as const;
const SOURCE_SECTION = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'gtmBrief',
] as const; // every synthesized item must name where it came from (grounding)
const CHANNEL_VERDICT = ['keep', 'fix', 'cut', 'start'] as const;

/* ── 1. Campaign Overview [TEMPLATED] ── */
const CampaignOverviewSchema = z.object({
  prose: z.string(),
  monthlyBudget: z.string(),       // from monthlyAdBudget
  totalMonths: z.number(),         // from campaignDuration
  phaseCount: z.number(),
  dailySpend: z.string(),
  primaryKpi: z.string(),
  platform: z.string(),            // e.g. "Meta Ads"
});

/* ── 2. Campaign Phases [TEMPLATED] ── */
const CampaignPhaseSchema = z.object({
  phaseName: z.string(),           // "Testing" | "Optimization & Scale"
  monthsLabel: z.string(),         // "Months 1-2"
  monthlyBudget: z.string(),
  bullets: z.string().array(),     // boilerplate phase bullets
});
const CampaignPhasesSchema = z.object({ prose: z.string(), phases: CampaignPhaseSchema.array() });

/* ── 3. Audience Types [TEMPLATED labels + SYNTHESIZED interest stack] ── */
const AudienceSchema = z.object({
  slot: z.string(),                // "01 Broad Prospecting"
  archetype: z.string(),           // "Interest Stack" | "ABM ICP List + 1% Lookalike" | "Advantage+"
  dailyBudget: z.string(),
  detail: z.string(),              // SYNTHESIZED: actual interest stack / firmographics from positioningBuyerICP
  sourceSection: z.enum(SOURCE_SECTION),
});
const AudienceTypesSchema = z.object({ prose: z.string(), audiences: AudienceSchema.array() });

/* ── 4. Creative Strategy [TEMPLATED] ── */
const CreativeStrategySchema = z.object({
  prose: z.string(),
  staticCount: z.number(),
  videoCount: z.number(),
  totalPerAudience: z.number(),
  angleTypesInMix: z.enum(CREATIVE_TYPE).array(),
});

/* ── 5. Angles to Test [SYNTHESIZED] — ACTUAL COPY ── */
const AdAngleSchema = z.object({
  angleName: z.string(),           // "Show up on ChatGPT"
  primaryText: z.string(),         // the actual ad hook/copy, ready to use
  supportingLine: z.string(),      // body / secondary line
  insight: z.string(),             // the buyer insight behind it
  sourceSection: z.enum(SOURCE_SECTION),
  sourceUrl: z.string(),           // traceable to the positioning evidence
});
const AnglesToTestSchema = z.object({ prose: z.string(), angles: AdAngleSchema.array() });

/* ── 6. Creative Framework (filled) [SYNTHESIZED] — content, not labels ── */
const FilledCreativeSchema = z.object({
  creativeType: z.enum(CREATIVE_TYPE),
  // exactly one of these blocks is filled depending on type; all are strings of ACTUAL copy
  uspSentence: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  transformation: z.string().optional(),
  objection: z.string().optional(),
  objectionAnswer: z.string().optional(),
  founderScriptBeat: z.string().optional(),
  sourceSection: z.enum(SOURCE_SECTION),
  sourceUrl: z.string(),
});
const CreativeFrameworkSchema = z.object({ prose: z.string(), creatives: FilledCreativeSchema.array() });

/* ── 7. Competitor Insights — Reviews [SYNTHESIZED] ── */
const ReviewInsightSchema = z.object({
  competitor: z.string(),
  verbatimComplaint: z.string(),   // pulled from positioningVoiceOfCustomer / competitorLandscape weaknesses
  adLeverage: z.string(),          // how to weaponize it in an ad
  sourceSection: z.enum(SOURCE_SECTION),
  sourceUrl: z.string(),
});
const CompetitorReviewInsightsSchema = z.object({ prose: z.string(), insights: ReviewInsightSchema.array() });

/* ── 8. Competitor Insights — Marketing [SYNTHESIZED] (see Gap G1) ── */
const CompetitorMarketingSchema = z.object({
  competitor: z.string(),
  messaging: z.string(),           // what they say
  adPlatforms: z.string().array(), // LinkedIn / Google / Meta / FB / IG  ← G1: NOT in current corpus
  estSpend: z.string(),            // est. spend                          ← G1: NOT in current corpus
  icpTargeted: z.string(),         // who they target / niche vs broad
  anglesTested: z.string(),        // what angles they run
  positioningClaim: z.string(),    // "best X company"
  offer: z.string(),               // e.g. guarantee
  sourceSection: z.enum(SOURCE_SECTION),
  sourceUrl: z.string(),
});
const CompetitorMarketingInsightsSchema = z.object({ prose: z.string(), competitors: CompetitorMarketingSchema.array() });

/* ── 9. Funnel Ideation [SYNTHESIZED] ── */
const FunnelRecommendationSchema = z.object({
  funnelType: z.enum(FUNNEL_TYPE),
  recommendation: z.string(),      // why this funnel for this client
  optInToBookedCall: z.string(),   // what happens between opt-in and booked call
  sourceSection: z.enum(SOURCE_SECTION),
});
const FunnelIdeationSchema = z.object({ prose: z.string(), recommendations: FunnelRecommendationSchema.array() });

/* ── 10. Sales Process [STATIC-ASSET] ── */
const SalesAssetSchema = z.object({
  label: z.string(),               // "Sales Process Overview" | "SDR SOP" | "Opt-in SOP" | "Personalization SOP" | "15-min Loom"
  url: z.string(),
  assetType: z.enum(['sop-doc', 'loom']),
});
const SalesProcessSchema = z.object({ prose: z.string(), assets: SalesAssetSchema.array() });

/* ── 11. Channel & Current-Funnel Suggestions [SYNTHESIZED] (see Gaps G2/G3) ── */
const ChannelSuggestionSchema = z.object({
  channel: z.string(),             // "Google Ads" | "SEO/GEO" | "Website" | "Content"
  observation: z.string(),         // what's happening now  ← G2/G3: thin without own-channel audit
  recommendation: z.string(),      // concrete pointer
  verdict: z.enum(CHANNEL_VERDICT),
  sourceSection: z.enum(SOURCE_SECTION),
});
const ChannelSuggestionsSchema = z.object({ prose: z.string(), suggestions: ChannelSuggestionSchema.array() });

/* ── 12. KPIs & Success Metrics [TEMPLATED] ── */
const KpiSchema = z.object({ metric: z.string(), role: z.string(), definition: z.string() });
const KpisSchema = z.object({ prose: z.string(), gtmMotion: z.enum(GTM_MOTION), kpis: KpiSchema.array() });

/* ── top-level artifact ── */
export const PaidMediaPlanArtifactSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: SourceSchema.array(),
    campaignOverview: CampaignOverviewSchema,
    campaignPhases: CampaignPhasesSchema,
    audienceTypes: AudienceTypesSchema,
    creativeStrategy: CreativeStrategySchema,
    anglesToTest: AnglesToTestSchema,
    creativeFramework: CreativeFrameworkSchema,
    competitorReviewInsights: CompetitorReviewInsightsSchema,
    competitorMarketingInsights: CompetitorMarketingInsightsSchema,
    funnelIdeation: FunnelIdeationSchema,
    salesProcess: SalesProcessSchema,
    channelSuggestions: ChannelSuggestionsSchema,
    kpis: KpisSchema,
  })
  .describe('Complete Section 07 Paid Media Plan Artifact (synthesis).');

export type PaidMediaPlanArtifact = z.infer<typeof PaidMediaPlanArtifactSchema>;
```

### `validatePaidMediaPlanMinimums()` — cardinality outside Zod

Lives in the same file, registered as `validateMinimums` in `section-artifact-schemas.ts`. Enforces the "fill in the blanks" rule via counts (mirrors `validateCompetitorLandscapeMinimums`):

- `confidence` ∈ [0,10]; `sources.length >= 5`.
- `anglesToTest.angles.length >= 4`; each angle: non-empty `primaryText` **and** `supportingLine` (not a label), `sourceUrl` is a valid URL.
- `creativeFramework.creatives.length >= 3`; for each, the type-appropriate fields are non-empty (e.g. `problem-solution-transformation` ⇒ `problem`+`solution`+`transformation` all present; `objection-handling` ⇒ `objection`+`objectionAnswer`; `unique-selling-point` ⇒ `uspSentence`).
- `competitorReviewInsights.insights.length >= 2`; each has `verbatimComplaint` + `adLeverage`.
- `competitorMarketingInsights.competitors.length >= 2`; each has non-empty `messaging`, `positioningClaim`, and at least one `adPlatforms` entry.
- `funnelIdeation.recommendations.length >= 1`; each has non-empty `optInToBookedCall`.
- `channelSuggestions.suggestions.length >= 2`; each has `observation` + `recommendation`.
- `audienceTypes.audiences.length` ∈ {2,3} (3 normally, 2 if budget low).
- Every `[SYNTHESIZED]` item carries a `sourceSection` ∈ the 6 positioning ids (not `gtmBrief`) — enforces grounding.

> **Render-friendliness:** every sub-section maps cleanly to existing primitives in `src/components/research-v2/primitives/` — `SubsectionBlock` wraps each; `DataTable` for audiences/competitor-marketing/channel-suggestions/KPIs; `QuoteCallout` for review insights and angle copy; `NarrativeBlock`/`InlineStats` for the overview; `MilestoneTimeline` for phases. No new primitive required. The renderer slots into `src/components/research-v2/section-renderers/` exactly like `competitor-landscape.tsx`.

---

## 5. Inputs — GTM brief / onboarding vs the 6 sections

All brief fields below **already exist** in `src/lib/journey/field-catalog.ts` unless flagged NEW.

**From the GTM brief / onboarding (the [TEMPLATED] inputs):**

| Input | Field key | Status |
|---|---|---|
| Total monthly budget | `monthlyAdBudget` | exists (required-blocker) |
| # months / campaign length | `campaignDuration` | exists |
| Phase split | — | derive from template + `campaignDuration`; no dedicated field |
| SLG vs PLG | — | **NEW** — infer from `businessModel`/`currentFunnelType`, or add an explicit `gtmMotion` field |
| Creative count (5+3 vs 5+5) | — | **NEW** — capacity/preference; add `creativeCapacity` field or default in template |
| Lead-list availability (5–10k upload) | — | **NEW** — add `leadListAvailable` boolean (drives audience slot 02) |
| Sales-process doc links (4 SOPs + loom) | partial: `salesProcessOverview` (text only) | **NEW** — add structured link fields `salesProcessDocs[]` / `salesLoomUrl` (see Gap G4) |
| Target CPL / CAC | `targetCpl`, `targetCac` | exists |
| Current funnel type | `currentFunnelType` | exists |
| Client's running channels (for #11) | `currentMarketingActivities` | exists — rich (placeholder shows "Meta $8k/mo… LinkedIn $3k/mo… Google Search: not running yet") |
| Website URL (for #11) | `websiteUrl` | exists |

**From the 6 positioning artifacts (the [SYNTHESIZED] inputs):**

| Sub-section | Feeds from |
|---|---|
| 3 Audience interest-stack / ABM detail | `positioningBuyerICP` (firmographics, personas, clusters) |
| 5 Angles to Test | `positioningVoiceOfCustomer` (pain/objection/success language), `positioningDemandIntent` (questions, intent), `positioningMarketCategory` (category shifts, the "buyers are on GPT" structural force), `positioningCompetitorLandscape` (white-space) |
| 6 Creative Framework (filled) | `positioningOfferDiagnostic` (offer-market-fit proof for UPS), `positioningVoiceOfCustomer` (objection+answer, success-state), `positioningMarketCategory` (UPS framing) |
| 7 Competitor Insights — Reviews | `positioningVoiceOfCustomer` (switching stories, pain), `positioningCompetitorLandscape` (public weaknesses verbatim) |
| 8 Competitor Insights — Marketing | `positioningCompetitorLandscape` (messaging, positioning taxonomy, pricing, share-of-voice), `positioningMarketCategory` |
| 9 Funnel Ideation | `positioningOfferDiagnostic` (funnel breaks, channel truth), `positioningBuyerICP` (awareness level → funnel depth) |
| 11 Channel Suggestions | `positioningOfferDiagnostic` (channel truth = what has/hasn't worked), GTM brief `currentMarketingActivities` + `websiteUrl` |

---

## 6. SKILL.md shape

Lives at `research-worker/platform-skills/ai-gos-paid-media-plan/SKILL.md`; loaded by `agents.ts` (`PLATFORM_SKILL_DIR_BY_SECTION[positioningPaidMediaPlan] = 'ai-gos-paid-media-plan'`) and prepended to the runner system prompt. Structure mirrors the 6 research skills (`## <Title> — Section 07`, `### Required outputs`, `### Evidence rules`, `### Output shape`), but the framing and rules differ because this is **synthesis, not research**:

**Framing block:**
> Strategic question: *given everything the 6 positioning sections found, what is the exact paid-media plan we run — with the templated spine filled and every strategic blank replaced by personalized, evidence-backed copy?* You do **ZERO fresh web research.** Your only inputs are the 6 committed positioning artifacts and the GTM brief. Synthesize; do not re-discover.

**Required-outputs block:** one bullet per sub-section (§3), each stating what "filled in" means. E.g.:
- *Angles to Test* — "Produce ≥4 ad angles. Each MUST include the actual primary text a media buyer can paste into Ads Manager, plus the body line and the buyer insight. Example shapes: 'show up on ChatGPT'; 'when customers search you on GPT they find competitors'; a statistic angle ('45% of buyers use GPT before buying'); a market-callout angle ('if you're in [industry], your competitors outspend you on Google/LinkedIn/Meta but your buyers are on GPT'). Pull the insight from a named positioning section + source URL."
- *Creative Framework* — "Do NOT emit angle-type labels. For each chosen type write the content: UPS ⇒ the actual unique-selling-point sentence; Problem–Solution–Transformation ⇒ the actual problem, the actual solution, the actual transformation; Objection Handling ⇒ the actual objection (verbatim buyer language from VoC) + the actual answer."
- *Competitor Insights — Marketing* — "Per competitor: Messaging, Ads (platforms + est. spend), ICP, Angles, Positioning claim, Offer."

**Evidence / grounding rules (the enforcement spine):**
- **Cite the section, not the web.** Every synthesized claim names its `sourceSection` (one of the 6) + a `sourceUrl` carried through from that section's evidence. No new URLs invented here.
- **Fill in the blanks — never ship a template.** Forbidden outputs: bare angle-type labels, "Problem–Solution–Transformation" with no problem written, "[industry]" left as a literal placeholder, "Objection Handling" with no objection. If a positioning section is too thin to fill a blank, write what you have and record the gap in `risksOrGaps` — do **not** emit boilerplate.
- **Use the buyer's verbatim language.** Angle copy and objection text reuse the exact phrasing surfaced in `positioningVoiceOfCustomer`; do not sanitize.
- **No fabricated competitor ad data.** If `positioningCompetitorLandscape` did not capture a competitor's ad platforms/spend, mark `adPlatforms: []` / `estSpend: "unknown"` and flag it in `risksOrGaps` (see Gap G1) — never guess a spend number (`feedback_no_fabricated_pricing`).
- **Templated sub-sections stay templated.** Overview/Phases/Creative-counts/KPIs read straight from the brief + fixed copy; do not "research" them.

**Output-shape block:** the exact `PaidMediaPlanArtifactSchema` key set, "no extra keys, no markdown fences," closing with "If a positioning section has thin evidence for a blank, return what you have and surface the gap in `risksOrGaps`. Do not fabricate."

---

## 7. Gap analysis — corpus / section enrichment needed

What the desired plan needs that the 6 positioning sections + GTM brief **cannot currently supply.** Each is a concrete enrichment task.

| ID | Gap | Where it bites | Current reality | Enrichment needed |
|---|---|---|---|---|
| **G1** | **Competitor AD PLATFORMS + estimated spend** | Sub-section #8 (`adPlatforms`, `estSpend`) | `competitor-landscape.ts` captures positioning, pricing, share-of-voice, weaknesses, narrative — **no field for which ad platforms a competitor runs on or spend.** `shareOfVoice.slices` is organic/community/publication SoV, not paid. Confirmed by grep: zero `platform`/`spend`/`adspend` fields in the schema. | Add `adPresence` to `positioningCompetitorLandscape` (worker + mirror schema + SKILL.md required-outputs): per competitor, `platforms: string[]` + `estSpend` + source (Meta Ad Library, LinkedIn Ads, SEMrush). This is a research-side addition; v3 only consumes it. Until then #8 ships platforms partial + flagged. |
| **G2** | **Client's OWN current paid ads** (Google Ads creative/structure) | Sub-section #11 Google-Ads feedback | No section audits the client's own live ads as a structured object. `positioningOfferDiagnostic.channelTruth` is retrospective "has this channel worked (yes/partial/no) + quantified evidence," not a forward-looking ad-account critique. `currentMarketingActivities` (brief) is free-text the client typed, not analyzed. | Either (a) accept brief free-text + `channelTruth` as the only basis and keep #11 advisory, or (b) add a small **own-channel audit** input (client pastes Google Ads / GEO / site URL) feeding a new mini-section or enriching `positioningOfferDiagnostic`. Recommend (a) for v3 (zero-research constraint); flag (b) as future. |
| **G3** | **Client's website speed / clarity / SEO / GEO / content quality** | Sub-section #11 website + content feedback | Not captured anywhere as a structured, auditable object. `websiteUrl` exists in the brief but nothing inspects it; no section stores page-speed / messaging-clarity / content-depth signals. | Forward-looking website/SEO audit is **out of scope for a zero-research synthesis.** v3 #11 should give *positioning-derived* messaging/clarity feedback (from `positioningMarketCategory` + `positioningOfferDiagnostic`) and explicitly scope out technical SEO/page-speed, OR a separate lightweight "site audit" capability is added later. Flag as the biggest scope boundary. |
| **G4** | **Structured sales-process asset links** (4 SOP docs + loom) | Sub-section #10 (STATIC-ASSET) | Brief has `salesProcessOverview` as a **text** field only — no structured URL fields for the 4 SOPs + the 15-min loom. | Add brief fields `salesProcessDocs: {label,url}[]` + `salesLoomUrl` (this is a 6-place field-sync per CLAUDE.md "Field sync" gotcha: field-catalog, JOURNEY/PROFILE field groups, Supabase migration, worker parse-context, identity JSONB). Low effort, no research. |
| **G5** | **SLG-vs-PLG flag, creative capacity, lead-list availability** | Sub-sections #12, #4, #3 | Inferable but not explicit brief fields. | Add `gtmMotion` (SLG/PLG), `creativeCapacity`, `leadListAvailable` to the brief, or derive in-template with a stated default. Trivial. |
| **G6** | **Orchestration: this section depends on the other 6** | Sequencing | Current orchestrator fans out all 6 in parallel waves (`ORCHESTRATOR_CONCURRENCY`, `ZoneIdSchema = z.enum(POSITIONING_SECTION_IDS)`); there is no notion of a section that *waits for* the others. | The orchestrator must run `positioningPaidMediaPlan` as a **dependent final wave** after the 6 commit (it reads their artifacts). Not a schema gap — an execution-graph change. Flag for the orchestrator owner. |

**Net:** The 6 sections + GTM brief already cover sub-sections **5, 6, 7, 9** richly (angles, filled framework, review insights, funnel ideation are well-fed by VoC / Offer / Market / Competitor / Demand). The real enrichment gaps are **G1 (competitor paid-ad intel)** and **G2/G3 (the client's own ads/website/SEO/content)** — both are *research-side* additions, not v3-synthesis work. G4/G5 are trivial brief-field adds. G6 is an orchestration change.

---

## 8. One-screen summary for sign-off

- **New section:** `positioningPaidMediaPlan` / "Paid Media Plan" / tool `save_paid_media_plan_artifact` / skill `ai-gos-paid-media-plan`. Runs **last**, after the 6. Zero fresh research.
- **12 sub-sections:** 5 TEMPLATED (overview, phases, creative counts, KPIs, audience labels), 6 SYNTHESIZED (angles-with-copy, filled framework, competitor reviews, competitor marketing, funnel ideation, channel suggestions), 1 STATIC-ASSET (sales process links).
- **Schema:** typed named sub-section objects (`{prose, <typed array>}`), top-level meta identical to the 6, cardinality in `validatePaidMediaPlanMinimums()`, mirrored Next.js + worker. Renders with existing primitives.
- **SKILL.md enforces** "fill in the blanks, never templated," section-level grounding (`sourceSection` + carried `sourceUrl`), no fabricated competitor spend.
- **Enrichment needed:** G1 competitor ad platforms+spend (add to `positioningCompetitorLandscape`), G2/G3 client's own ads/website/SEO (scope boundary — biggest open question), G4 structured sales-asset links, G5 SLG/creative/lead-list brief flags, G6 orchestrator dependency wave.
