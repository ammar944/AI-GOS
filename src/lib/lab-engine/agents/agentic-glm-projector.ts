/**
 * agentic-glm-projector — the D0 hybrid bridge.
 *
 * The proven GLM-agentic writer emits rich free markdown (scored 8–9 in the
 * blind value A/B). Production renders a typed body. This module maps that
 * markdown into the (now-widened) typed bodySchema, populating the high-value
 * containers (VoC adAngles/outcomeProof, Demand intentClusters/negativeKeywords)
 * WITHOUT inventing: it copies quotes, numbers and URLs verbatim from the
 * markdown and OMITS any row whose source it cannot find. Invention is the
 * downstream honest gate's job to catch, not this projector's job to produce.
 *
 * The module is pure: it takes markdown + transcript as args and never reads
 * the filesystem. The GLM call is injectable (`generate`) so unit tests run
 * with a hand-crafted projection and no live model. evidenceVerdict is NEVER
 * populated here — that is populated deterministically by the provenance gate.
 */
import type { ZodTypeAny } from "zod";

import { generateText } from "ai";

import { getAgenticGLMModel } from "../ai/models";
import {
  buyerICPBodySchema,
} from "../artifacts/schemas/buyer-icp";
import {
  competitorLandscapeBodySchema,
} from "../artifacts/schemas/competitor-landscape";
import {
  demandIntentBodySchema,
} from "../artifacts/schemas/demand-intent";
import {
  marketCategoryBodySchema,
} from "../artifacts/schemas/market-category";
import {
  offerDiagnosticBodySchema,
} from "../artifacts/schemas/offer-diagnostic";
import {
  voiceOfCustomerBodySchema,
} from "../artifacts/schemas/voice-of-customer";
import type { TranscriptRecord } from "./verification/provenance-detect";

/**
 * GLM-5.2 is a reasoning model; too few output tokens returns EMPTY content
 * (live-probed: a 19.7k-char VoC markdown truncated to empty text at 12000
 * output tokens — the full typed body needs more headroom).
 */
const PROJECT_MAX_OUTPUT_TOKENS = 24000;

/** Injectable generate fn — (system, prompt) -> raw model text. */
export type ProjectGenerateFn = (
  system: string,
  prompt: string,
) => Promise<string>;

export type ProjectableSectionId =
  | "positioningVoiceOfCustomer"
  | "positioningDemandIntent"
  | "positioningOfferDiagnostic"
  | "positioningBuyerICP"
  | "positioningCompetitorLandscape"
  | "positioningMarketCategory";

export interface ProjectionCompleteness {
  /** High-value optional block name (e.g. 'adAngles'). */
  block: string;
  /** Did the source markdown contain this block (heading/keyword match)? */
  sourceHadIt: boolean;
  /** How many rows the projector mapped into the typed body. */
  typedCount: number;
}

export interface ProjectMarkdownToTypedBodyArgs {
  sectionId: ProjectableSectionId;
  markdown: string;
  transcript: TranscriptRecord[];
  env?: Record<string, string | undefined>;
  /** INJECTABLE for tests; default = GLM via getAgenticGLMModel. */
  generate?: ProjectGenerateFn;
}

export interface ProjectMarkdownToTypedBodyResult {
  /** Validated against the section bodySchema (when validates === true). */
  body: unknown;
  validates: boolean;
  zodError?: string;
  completeness: ProjectionCompleteness[];
}

interface SectionProjectionSpec {
  bodySchema: ZodTypeAny;
  /** Precise prose description of the target JSON for this section. */
  targetDescription: string;
  /** High-value blocks whose presence + typed count we report. */
  highValueBlocks: HighValueBlockSpec[];
}

interface HighValueBlockSpec {
  /** Key in the typed body (e.g. 'adAngles'). */
  key: string;
  /** Regexes that, if any match the markdown, mean the source HAD this block. */
  sourceMarkers: RegExp[];
}

const VOC_TARGET_DESCRIPTION = `Target JSON for the Voice of Customer body. Emit EXACTLY these top-level keys (omit a key only where noted as optional and the markdown has no source for it):

- strategicInsight: { strategicVerdict: string, keyTension: { tension: string, side: string, costOfPosition: string } } — the lead/headline insight from the markdown. strategicVerdict = the headline read; keyTension = the central tension, which side the verdict takes, and what that position costs. nonObviousRead and secondOrderImplication are optional strings (include only if the markdown supports them). Every present field is a non-empty string.
- fourForcesBalanceVerdict: { push: string, pull: string, anxiety: string, habit: string, balanceVerdict: string } — derive from the markdown's framing of why buyers move/stay. Non-empty strings.
- painLanguage: { prose: string, quotes: PainQuote[] } where PainQuote = { verbatimText, source (one of: g2|capterra|trustpilot|trustradius|reddit|hackernews|sales-call|support-thread|twitter|other), sourceUrl, painTheme, painIntensity (high|medium|low) }. Copy each pain quote VERBATIM with its real sourceUrl. role/date optional.
- objections: { prose: string, items: Objection[] } where Objection = { objectionText, category (price|feature|trust|switching-cost|timing|stakeholder|other), frequency (recurring|occasional|one-off), howToHandle, sourceUrl }.
- switchingStories: { prose: string, stories: SwitchingStory[] } where SwitchingStory = { priorSolution, reasonToLeave, decisionPath, sourceUrl }. exampleCompany optional.
- decisionCriteria: { prose: string, criteria: DecisionCriterion[] } where DecisionCriterion = { criterion, statedBy (buyer|champion|influencer|blocker), evidenceQuote, sourceUrl }.
- successLanguage: { prose: string, quotes: SuccessQuote[] } where SuccessQuote = { verbatimText, source (same enum as PainQuote), sourceUrl, afterStatePattern }.
- adAngles (optional): AdAngle[] where AdAngle = { angle, targeting, hook, sourcePainTheme, sourceUrl? }. Map the "Ad Angles to Test" block: angle = the angle name/headline; targeting = who it targets; hook = the ad hook copy; sourcePainTheme = the pain it exploits; sourceUrl = the cited source if the angle names one.
- outcomeProof (optional): OutcomeProof[] where OutcomeProof = { company, metric, beforeAfter, sourceUrl }. Map the named-customer outcome bullets (e.g. "Sanity: 120% increase in team satisfaction after switching from Zendesk"): company = the named customer; metric = the headline number/result; beforeAfter = the before→after framing; sourceUrl = the case-study URL.

Every quote/objection/story/criterion/success row REQUIRES a non-empty sourceUrl. If a row in the markdown has no real source URL, OMIT that row — do NOT invent a URL. Do NOT emit keyFindings, retrievalSummary, blockGap, coverage, evidenceVerdict, evidenceGap, or evidenceGapReport.`;

const DEMAND_TARGET_DESCRIPTION = `Target JSON for the Demand & Intent body. Emit EXACTLY these top-level keys (omit a key only where noted as optional and the markdown has no source for it):

- strategicInsight: { strategicVerdict: string, keyTension: { tension: string, side: string, costOfPosition: string } } — the lead insight from the markdown. strategicVerdict = the headline read; keyTension = the central tension, which side the verdict takes, and what that position costs. nonObviousRead and secondOrderImplication are optional strings. Every present field is a non-empty string.
- orderedMoves: OrderedMove[] where OrderedMove = { rank: number (1-based), move: string, dependsOn: number[] (ranks this move depends on, [] if none), rationale: string } — the ordered paid-strategy moves ("What this means for paid strategy"). Copy the move text and its reasoning.
- provesWrongIf: { metric: string, threshold: string, window: string } — the falsifiable demand claim: the metric to watch, the threshold that would disprove the thesis, and the time window. Derive from the markdown's framing if present.
- keywordDemand: { prose: string, keywords: KeywordSignal[] } where KeywordSignal = { keyword, monthlyVolume (string, e.g. "1,600"), intentType (informational|commercial|transactional|navigational), top3RankingDomains (string[] — use [] when the markdown lists none), sourceTitle, sourceUrl, dateObserved }. Copy each keyword row VERBATIM from the keyword tables with its real SpyFu sourceUrl. dateObserved is REQUIRED: when the source table shows no date column, set dateObserved to the string "as observed in source" (do NOT invent a calendar date). Optional numeric siblings monthlyVolumeValue/cpcValue/difficulty and cpc only when the markdown shows a real number for that keyword.
- questionMining: { prose: string, questions: BuyerQuestion[] } where BuyerQuestion = { question, surface (paa|reddit|quora|community|forum|support-thread), sourceUrl, frequency (recurring|occasional) }. Only if the markdown mined real buyer questions.
- contentGaps: { prose: string, gaps: ContentGap[] } where ContentGap = { topic, evidenceOfDemand, weakCompetitorAnswerEvidence, opportunity }.
- intentSignals: { prose: string, items: IntentSignal[] } where IntentSignal = { signalType (job-posting|rfp|news-trigger|funding|leadership-change), description, sourceUrl }.
- venueMap: { prose: string, venues: DemandVenue[] } where DemandVenue = { name, venueType (event|community|newsletter|podcast|slack), audienceSize, sourceUrl }.
- intentClusters (optional): IntentCluster[] where IntentCluster = { tier (string, e.g. "Tier 1 — Competitor-alternative"), read (the **Read:** paragraph for that tier), budgetShare? (string, e.g. "~50%"), keywords (string[] — the keyword strings in that tier's table) }. Map each keyword tier-grouping + its Read paragraph + (from the cluster funding priority list) its budget share.
- negativeKeywords (optional): string[] — map the "Explicitly avoid" / exclusion list: each avoided keyword string (e.g. "plain", "plain tickets", "ticketing system").

keywordDemand, questionMining, contentGaps, intentSignals and venueMap are REQUIRED blocks (you cannot omit them). Each needs a non-empty "prose" string and its rows array. When the markdown has NO content for one of these blocks (e.g. a keyword-only section with no question-mining), do NOT emit empty prose and do NOT invent rows — instead set its prose to a single honest sentence stating the block had no source evidence in this section (e.g. "No buyer-question surfaces were captured in this section's research."), set its rows array to [], and add a blockGap object: { summary: "<why this block is empty>", foundCount: 0, requiredCount: <the floor: questionMining 10, contentGaps 3, intentSignals 5, venueMap 4, keywordDemand 5>, sourcingPlan: ["<one concrete next step to acquire this evidence>"] }. Stating that evidence is absent is honest; inventing rows to fill the block is not.

Every keyword/question/gap/signal/venue row REQUIRES a non-empty sourceUrl where the schema demands it; OMIT rows with no real source rather than inventing one. Do NOT emit keyFindings, operatorEconomics, coverage, or evidenceVerdict.`;

const OFFER_TARGET_DESCRIPTION = `Target JSON for the Offer & Performance Diagnostic body. Emit EXACTLY these top-level keys:

- strategicInsight: { strategicVerdict: string, keyTension: { tension: string, side: string, costOfPosition: string } } — the lead diagnostic read. nonObviousRead / secondOrderImplication optional strings.
- orderedMoves: OrderedMove[] where OrderedMove = { rank: number (1-based), move: string, dependsOn: number[], rationale: string } — the "What to Fix Before Scaling Spend" ordered actions.
- provesWrongIf: { metric: string, threshold: string, window: string } — the falsifiable test for the diagnosis ("What would make this recommendation wrong").
- singleBindingConstraint: { constraint: string, whyBinding: string, unlockCondition: string } — the "Single Binding Constraint" section: the one constraint, why it binds, and what unlocks it.
- offerMarketFit: { prose: string, proofPoints: FitProofPoint[] } where FitProofPoint = { metric, value, reportedBy (company-own|external-source), confidence (high|medium|low), sourceUrl }. Map the offer-market-fit proof classification (defensible/comparative/assumed proof points): metric = what is proven; value = the figure/claim; reportedBy = company-own if from the subject's own site else external-source.
- funnelDiagnosis: { prose: string, breaks: FunnelBreak[] } where FunnelBreak = { stageName, metric, magnitude, hypothesis, sourceUrl }. Map each "Break point" in the funnel: stageName = the funnel stage; metric/magnitude = the quantified break; hypothesis = the testable behavior hypothesis.
- channelTruth: { prose: string, channels: ChannelEvidence[] } where ChannelEvidence = { channelName, hasWorked (yes|partial|no|unknown), quantifiedEvidence, sourceUrl }. Map the "Channel Truth" section: each channel, whether it has worked, and the evidence.
- retentionHealth: { prose: string, signals: RetentionSignal[] } where RetentionSignal = { signalType (activation|retention|first-value-moment), metric, value, sourceUrl }. Map the "Positive retention signals".
- redFlags: { prose: string, items: RedFlag[] } where RedFlag = { claimedMotion, actualEvidence, contradiction, severity (high|medium|low) }. Map the "Red flags that could waste spend": claimedMotion = what is claimed; actualEvidence = what the evidence shows; contradiction = the gap; severity = how bad.

offerMarketFit, funnelDiagnosis, channelTruth, retentionHealth and redFlags are REQUIRED blocks (cannot omit). Each needs non-empty "prose" + its rows array. When the markdown genuinely has no rows for a block, set its prose to an honest absence sentence, rows=[], and add a blockGap { summary, foundCount: 0, requiredCount: <floor: offerMarketFit.proofPoints 3, funnelDiagnosis.breaks 2, channelTruth.channels 3, retentionHealth.signals 1, redFlags.items 3>, sourcingPlan: ["<one next step>"] } — NEVER invent rows. proofPoint/break/channel/signal rows REQUIRE a non-empty sourceUrl (redFlag rows do NOT carry a sourceUrl); OMIT a row that lacks a real source rather than inventing a URL. Do NOT emit keyFindings, coverage, evidenceTier, verification, or evidenceVerdict.`;

const BUYER_TARGET_DESCRIPTION = `Target JSON for the Buyer & ICP Reality body. Emit EXACTLY these top-level keys:

- strategicInsight: { strategicVerdict: string, keyTension: { tension: string, side: string, costOfPosition: string } } — the lead insight. nonObviousRead / secondOrderImplication optional.
- icpExistenceCheck: { prose: string, firmographicCuts: FirmographicCut[] } where FirmographicCut = { cutType (industry|employeeBands|revenueBands|geography|techStack), value (the segment, e.g. "venture-backed high-growth tech"), source (the source name/type), sourceUrl, dateObserved (use "as observed in source" when no date), accountCount? }. Map the "ICP Boundary" firmographic/technographic/psychographic cuts. cutType must be one of the 5 enum values — use industry for vertical cuts, techStack for technographic cuts, employeeBands/revenueBands for size cuts, geography for location. Need >=3 DISTINCT cutType values.
- personaReality: { prose: string, personas: Persona[] } where Persona = { name (the named human, or a role label if no human is named), title, company, sourceUrl, role (champion|economic-buyer|decision-maker|influencer|end-user|gatekeeper), seniority, evidence (the verbatim quote/proof for this persona), segmentLabel? (a sourced role/segment label when no human is named), teamSize? }. Map each "Persona A/B/C": name = the named individual (e.g. "Chad Joglekar") or, if the persona is a role archetype with no named human, set name to the role label and put the sourced label in segmentLabel; evidence = the quote/proof from the case study; company = where they work.
- awarenessDistribution: { prose: string, levels: AwarenessLevel[], dominantLevel? } where AwarenessLevel = { level (unaware|problem-aware|solution-aware|product-aware|most-aware), evidence, share?, sampleQuery? }. Map any awareness-stage analysis. If the markdown has no explicit awareness-level breakdown, set prose to an honest absence sentence, levels=[], and add a blockGap (see below) — do NOT invent awareness levels.
- buyingContext: { prose: string, triggers: Trigger[] } where Trigger = { name, detectionSignal, window (immediate|weeks|quarters), evidence, sourceUrl? }. Map the "Buying Triggers" trigger events (e.g. "growth-induced system failure", "first-time CRM adoption under pressure"): name = the trigger; detectionSignal = how to detect it; evidence = the proof. NOTE: if the markdown frames buying as a PUSH/PULL/ANXIETY/INERTIA forces-balance rather than discrete trigger events, extract the discrete trigger events from the PUSH/INERTIA discussion into triggers[] — the forces-balance prose goes into this block's prose.
- clusters: { prose: string, venues: ClusterVenue[] } where ClusterVenue = { bucketType (community|newsletter|conference|podcast|slack-group|event), name, sourceUrl, whyItMatters, audienceSize? }. Map the "Reachable Venues". Need >=1 real venue OR a blockGap.

icpExistenceCheck, personaReality, awarenessDistribution, buyingContext and clusters are REQUIRED blocks. Each needs non-empty "prose" + its rows array. When a block has no real rows, set prose to an honest absence sentence, rows=[], and add a blockGap { summary, foundCount: 0, requiredCount: <floor: firmographicCuts 3, personas 1, triggers 3, clusters.venues 1; awarenessDistribution has no count floor — use 1>, sourcingPlan: ["<one next step>"] } — NEVER invent rows. firmographicCut/persona/clusterVenue rows REQUIRE a non-empty sourceUrl; trigger.sourceUrl and awarenessLevel have no required sourceUrl. OMIT a row that lacks a real source rather than inventing one. Do NOT emit keyFindings, coverage, evidenceTier, verification, evidenceGap, or evidenceGapReport.`;

const COMPETITOR_TARGET_DESCRIPTION = `Target JSON for the Competitor Landscape body. Emit EXACTLY these top-level keys:

- strategicInsight: { strategicVerdict: string, keyTension: { tension: string, side: string, costOfPosition: string } } — the lead read. nonObviousRead / secondOrderImplication optional.
- whereToAttackVsConcede: { attack: string, concede: string, rationale: string } — the strategic where-to-attack-vs-concede call.
- incumbentBlindSpot: { incumbent: string, blindSpot: string, whyTheyMissIt: string } — the named incumbent's structural blind spot.
- competitorSet: { prose: string, competitors: Competitor[] } where Competitor = { name, url (homepage), competitorType (direct|indirect|status-quo|diy), oneLinePositioning, verbatimHeroCopy? (the competitor's actual hero/tagline copy — OPTIONAL), pricingPosition, sourceUrl }. Map the competitor table/list. Need >=3 competitors. verbatimHeroCopy is OPTIONAL: include it ONLY when the markdown quotes that competitor's actual hero/tagline copy verbatim; when the markdown names the competitor without quoting its hero copy, OMIT the verbatimHeroCopy field entirely — do NOT emit a placeholder like "Not found in source markdown".
- positioningTaxonomy: { prose: string, axes: PositioningAxis[] } where PositioningAxis = { axisName, ourPosition (the subject's position on this axis), competitorPositions: [{ competitor, position }], evidenceUrl }. Map the positioning-axis comparison. Need >=2 axes.
- pricingReality: { prose: string, dataPoints: PricingDataPoint[] } where PricingDataPoint = { competitor, tierName, monthlyPrice, packagingPattern, gatedSignals (what's gated behind this tier), sourceUrl }. Map the pricing table. Need >=2 data points.
- shareOfVoice: { prose: string, slices: ShareOfVoiceSlice[] } where ShareOfVoiceSlice = { surface (e.g. "G2 category page"), winner, evidence, sourceUrl }. Need >=1 or blockGap.
- publicWeaknesses: { prose: string, items: CompetitorWeakness[] } where CompetitorWeakness = { competitor, verbatimQuote (the actual complaint quote), source, sourceUrl, whyItMatters }. Need >=1 or blockGap.
- narrativeArcs: { prose: string, arcs: NarrativeArc[] } where NarrativeArc = { competitor, villain (who the competitor frames as the villain), hero, transformationClaim, sourceUrl }. Need >=1 or blockGap.
- adPresence: { prose: string, signals: AdPresenceSignal[] } where AdPresenceSignal = { competitor, platforms (subset of google|meta|linkedin), estSpend, evidence, sourceUrl (must be a full http(s) URL) }. Map any paid-ad presence discussion. If the markdown has no ad-spend evidence, set prose to an honest absence sentence, signals=[], and add a blockGap.
- adEvidence: { prose: string, advertiserGroups: [] } — this block is normally populated by the ad-engine TOOL, not by markdown. The agentic markdown writer does NOT produce ad-creative tool data. Set prose to a one-sentence note that ad-creative evidence comes from the ad-engine tool (not this writer), set advertiserGroups to [], and add a blockGap { summary, foundCount: 0, requiredCount: 1, sourcingPlan: ["Run the ad-engine creative probe for the discovered competitor set."] }. Do NOT fabricate ad creatives.

competitorSet, positioningTaxonomy, pricingReality, shareOfVoice, publicWeaknesses, narrativeArcs and adPresence are REQUIRED {prose, rows[]} blocks. When a block has no real rows, set prose to an honest absence sentence, rows=[], and add a blockGap { summary, foundCount: 0, requiredCount: <floor: competitors 3, axes 2, dataPoints 2, slices 1, items 1, arcs 1, signals 1>, sourcingPlan: ["<one next step>"] } — NEVER invent rows. competitor/axis(evidenceUrl)/pricing/slice/weakness/arc/adPresence rows REQUIRE a non-empty sourceUrl (adPresence.signals.sourceUrl must be a full http(s) URL). OMIT a row that lacks a real source rather than inventing a URL. Do NOT emit keyFindings, coverage, evidenceTier, or verification.`;

const MARKET_TARGET_DESCRIPTION = `Target JSON for the Market & Category body. Emit EXACTLY these top-level keys:

- strategicInsight: { strategicVerdict: string, keyTension: { tension: string, side: string, costOfPosition: string } } — the lead read. nonObviousRead / secondOrderImplication optional.
- categoryPowerBet: { bet: string, whyNow: string, riskAccepted: string } — the category power bet, why now, and the risk accepted.
- categoryDefinition: { prose: string, adjacentCategories: AdjacentCategory[] } where AdjacentCategory = { name, whyBuyersConfuseIt, disambiguatingSignal, sourceUrl? }. Map the categories buyers confuse this with. Need >=2 adjacent categories.
- marketSize: { prose: string, signals: MarketSizeSignal[], bottomUpTam: BottomUpTam }. MarketSizeSignal = { signalType (public-data|funding-flow|hiring-velocity|search-trend|analyst-report), name, evidence, trajectory (expanding|stable|contracting|unclear), methodology (top-down|bottom-up), sourceTitle, sourceUrl, dateObserved (use "as observed in source" when no date) }. Need >=2 signals or a marketSize.blockGap. BottomUpTam = { recipeName: "keyword-demand-reachable-revenue" (this exact literal), formula (the TAM formula prose), reachableRevenueEstimate, inputs: BottomUpTamInput[], caveats: string[] (need >=1) }. BottomUpTamInput = { inputType (keyword-volume|commercial-intent-share|conversion-rate|acv), label, value, status (sourced|evidence-gap), sourceTitle, dateObserved (use "as observed in source"), sourceUrl? }. If the markdown's TAM is not a real bottom-up build, set inputs to one evidence-gap input per inputType with value "evidence gap: <what's missing>", status "evidence-gap", and reachableRevenueEstimate to an honest "not computable from sources" string — do NOT invent TAM numbers.
- structuralForces: { prose: string, forces: StructuralForce[] } where StructuralForce = { forceType (regulation|platform-shift|buyer-behavior), name, evidence, implication, impact (high|medium|low), direction (accelerating|decelerating|neutral), sourceTitle?, sourceUrl? }. Need >=1 force or a structuralForces.blockGap.
- categoryMaturity: { prose: string, classification: MaturityClassification }. MaturityClassification = { stage (emerging|growing|consolidating|commoditizing), evidenceSummary, supportingSignals: [{ signalType (player-count|buyer-education|feature-parity|price-pressure|platform-bundling), evidence, implication, sourceUrl? }] }. signal.implication (REQUIRED) = what that signal means for the category — extract it from the markdown's reasoning, never invent. Need >=2 supportingSignals (or a categoryMaturity.blockGap). classification is REQUIRED (not a {rows[]} block) — derive the maturity stage + its supporting signals from the markdown's maturity discussion.
- confidenceBasis (optional): string — the qualitative confidence basis, if the markdown states one (no unsourced numerics).
- categoryVerdict (optional): one of "own-existing-shelf" | "create-new-category" | "defend-current-frame" — the strategic shelf call, if the markdown makes one.
- tamGapPosture (optional): string — the qualitative TAM-gap posture, if stated.

categoryDefinition, marketSize and structuralForces are {prose, rows[]} blocks; categoryMaturity carries a required classification object instead of a rows array. When a {rows[]} block has no real rows, set prose to an honest absence sentence, rows=[], and add a blockGap { summary, foundCount: 0, requiredCount: <floor: adjacentCategories 2, marketSize.signals 2, structuralForces.forces 1>, sourcingPlan: ["<one next step>"] } — NEVER invent rows. marketSizeSignal rows REQUIRE a non-empty sourceUrl; adjacentCategory/structuralForce sourceUrl are optional. OMIT a row that lacks a real source rather than inventing one. Do NOT emit keyFindings, coverage, evidenceTier, or verification.`;

const SECTION_SPECS: Record<ProjectableSectionId, SectionProjectionSpec> = {
  positioningVoiceOfCustomer: {
    bodySchema: voiceOfCustomerBodySchema,
    targetDescription: VOC_TARGET_DESCRIPTION,
    highValueBlocks: [
      {
        key: "adAngles",
        sourceMarkers: [/ad angles?/i, /angles? to test/i],
      },
      {
        key: "outcomeProof",
        sourceMarkers: [
          /named customer outcomes?/i,
          /customer outcomes?/i,
          /outcome proof/i,
        ],
      },
    ],
  },
  positioningDemandIntent: {
    bodySchema: demandIntentBodySchema,
    targetDescription: DEMAND_TARGET_DESCRIPTION,
    highValueBlocks: [
      {
        key: "intentClusters",
        sourceMarkers: [/intent tier/i, /by intent/i, /^#+\s*tier\s*\d/im, /\*\*read:\*\*/i],
      },
      {
        key: "negativeKeywords",
        sourceMarkers: [
          /explicitly avoid/i,
          /negative keywords?/i,
          /keywords? to avoid/i,
        ],
      },
    ],
  },
  positioningOfferDiagnostic: {
    bodySchema: offerDiagnosticBodySchema,
    targetDescription: OFFER_TARGET_DESCRIPTION,
    highValueBlocks: [
      {
        key: "redFlags",
        sourceMarkers: [/red flags?/i, /could waste spend/i],
      },
      {
        key: "channelTruth",
        sourceMarkers: [/channel truth/i, /paid search/i, /other channels/i],
      },
    ],
  },
  positioningBuyerICP: {
    bodySchema: buyerICPBodySchema,
    targetDescription: BUYER_TARGET_DESCRIPTION,
    highValueBlocks: [
      {
        key: "buyingContext",
        sourceMarkers: [
          /buying triggers?/i,
          /balance of forces/i,
          /\bpush\b[\s\S]*\bpull\b/i,
          /\binertia\b/i,
        ],
      },
      {
        key: "awarenessDistribution",
        sourceMarkers: [/awareness/i, /problem-aware|solution-aware|product-aware/i],
      },
    ],
  },
  positioningCompetitorLandscape: {
    bodySchema: competitorLandscapeBodySchema,
    targetDescription: COMPETITOR_TARGET_DESCRIPTION,
    highValueBlocks: [
      {
        // Tool-shaped block: the ad-engine populates advertiserGroups, the
        // markdown writer cannot. Expect typedCount 0 = structural strangle.
        key: "adEvidence",
        sourceMarkers: [/ad creative/i, /ad library/i, /advertiser/i, /running ads?/i],
      },
      {
        key: "narrativeArcs",
        sourceMarkers: [/narrative arc/i, /villain/i, /story they tell/i],
      },
    ],
  },
  positioningMarketCategory: {
    bodySchema: marketCategoryBodySchema,
    targetDescription: MARKET_TARGET_DESCRIPTION,
    highValueBlocks: [
      {
        // Bespoke required recipe object: markdown narrative TAM rarely matches
        // the keyword-demand-reachable-revenue build. Watch for strangle.
        key: "marketSize",
        sourceMarkers: [/market size/i, /\btam\b/i, /bottom-up/i, /reachable revenue/i],
      },
      {
        key: "structuralForces",
        sourceMarkers: [/structural force/i, /platform shift/i, /regulation/i, /buyer behavior/i],
      },
    ],
  },
};

const EXTRACT_ONLY_RULE = `EXTRACT ONLY. Copy quotes, numbers, and URLs verbatim from the markdown. Do NOT invent or add anything not present in the markdown. Output ONLY valid JSON, no prose, no code fences.

MANDATORY MAPPINGS — if the markdown contains any of these blocks, you MUST populate the corresponding optional field (dropping a present block is an ERROR, not an allowed omission):
- An "Ad Angles to Test" (or "Ad Angles") block -> adAngles[] (one entry per angle).
- A "Named customer outcomes" list / outcome table -> outcomeProof[] (one entry per named customer result).
- Keyword tables grouped by intent tier, each with a **Read:** paragraph -> intentClusters[] (one entry per tier).
- An "Explicitly avoid" / exclusion / negative-keyword list -> negativeKeywords[] (one string per avoided keyword).

Omit an OPTIONAL field ONLY when the markdown genuinely has no such block. For any row whose schema requires a sourceUrl, OMIT just that row if the markdown has no real source URL for it — never invent a URL, and never drop the whole block because one row lacks a source.`;

/**
 * Strip a ```json ... ``` (or bare ```) fence wrapper if the model added one,
 * then return the inner JSON text. Falls back to the original text untouched.
 * Exported for reuse by the paid-media projector (same fence-strip discipline).
 */
export function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Defensive: a leading/trailing stray fence line without a closing pair.
  return trimmed
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

/**
 * If the model wrapped the body under a single envelope key (e.g. {"body": {...}}
 * or {"output": {...}}), unwrap it so safeParse sees the body directly. Only
 * unwraps when the object has exactly one key and that key is a known envelope
 * name whose value is an object — a real body has many top-level keys.
 */
const ENVELOPE_KEYS = new Set(["body", "output", "json", "result", "data"]);

function unwrapEnvelope(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 1 && ENVELOPE_KEYS.has(keys[0])) {
    const inner = (value as Record<string, unknown>)[keys[0]];
    if (inner !== null && typeof inner === "object") {
      return inner;
    }
  }
  return value;
}

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: unwrapEnvelope(JSON.parse(stripCodeFences(raw))) };
  } catch {
    return { ok: false };
  }
}

/**
 * Exported for reuse by the paid-media projector (same JSON-parse + envelope
 * unwrap discipline). Tolerates code fences and single-key envelopes.
 */
export function parseProjectedJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  return tryParseJson(raw);
}

function buildProjectionPrompt(spec: SectionProjectionSpec, markdown: string): string {
  return [
    "Project the SECTION MARKDOWN below into the target typed JSON body.",
    "",
    EXTRACT_ONLY_RULE,
    "",
    "=== TARGET JSON SHAPE ===",
    spec.targetDescription,
    "",
    "=== SECTION MARKDOWN ===",
    markdown,
    "",
    "Output the JSON body object now (no surrounding prose, no code fences):",
  ].join("\n");
}

function buildRepairPrompt(
  spec: SectionProjectionSpec,
  priorJsonText: string,
  zodError: string,
): string {
  return [
    "Your previous JSON failed schema validation. Fix ONLY the failing fields and re-emit the FULL corrected JSON body.",
    "Do not add invented content while fixing — if a failing field has no real source, omit that row/field.",
    "",
    EXTRACT_ONLY_RULE,
    "",
    "=== TARGET JSON SHAPE ===",
    spec.targetDescription,
    "",
    "=== VALIDATION ERRORS ===",
    zodError,
    "",
    "=== YOUR PREVIOUS JSON ===",
    priorJsonText,
    "",
    "Output the corrected JSON body object now (no surrounding prose, no code fences):",
  ].join("\n");
}

/**
 * Default GLM-backed projection generate fn. Free JSON via generateText (NOT
 * constrained decoding — the .strict() schemas are too complex for reliable
 * openai-compat constrained decoding). maxOutputTokens is generous because
 * GLM-5.2 is a reasoning model and starves to EMPTY content otherwise.
 */
function buildDefaultGenerate(
  env: Record<string, string | undefined>,
): ProjectGenerateFn {
  return async (system, prompt) => {
    const result = await generateText({
      model: getAgenticGLMModel(env),
      system,
      prompt,
      maxOutputTokens: PROJECT_MAX_OUTPUT_TOKENS,
    });
    return result.text;
  };
}

function countTypedRows(body: unknown, key: string): number {
  if (body === null || typeof body !== "object") {
    return 0;
  }
  const value = (body as Record<string, unknown>)[key];
  // A high-value block is either a top-level array (VoC adAngles, Demand
  // intentClusters) or a {prose, <rows>[], blockGap} object whose rows live in
  // its single array property (Offer redFlags.items, Buyer buyingContext
  // .triggers). Count whichever applies; report 0 only when truly absent.
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(inner)) {
        return inner.length;
      }
    }
  }
  return 0;
}

function sourceHadBlock(markdown: string, markers: RegExp[]): boolean {
  return markers.some((marker) => marker.test(markdown));
}

function buildCompleteness(
  spec: SectionProjectionSpec,
  markdown: string,
  body: unknown,
): ProjectionCompleteness[] {
  return spec.highValueBlocks.map((block) => ({
    block: block.key,
    sourceHadIt: sourceHadBlock(markdown, block.sourceMarkers),
    typedCount: countTypedRows(body, block.key),
  }));
}

const PROJECTION_SYSTEM =
  "You are a precise data-projection engine. You convert a section's free-markdown analysis into a strict typed JSON body by EXTRACTING ONLY what is already present in the markdown. You never invent quotes, numbers, customers, or URLs. You output a single JSON object and nothing else.";

/**
 * Project a section's free-markdown body into its typed bodySchema. Extraction
 * only — no invention. One repair round on Zod failure; if still failing,
 * returns validates=false with the zodError (a real finding: the schema is
 * still too tight or the markdown lacks a required field).
 */
export async function projectMarkdownToTypedBody(
  args: ProjectMarkdownToTypedBodyArgs,
): Promise<ProjectMarkdownToTypedBodyResult> {
  const spec = SECTION_SPECS[args.sectionId];
  if (spec === undefined) {
    throw new Error(
      `projectMarkdownToTypedBody: unsupported sectionId "${args.sectionId}".`,
    );
  }

  const env = args.env ?? process.env;
  const generate = args.generate ?? buildDefaultGenerate(env);

  // Round 1: project.
  const firstRaw = await generate(
    PROJECTION_SYSTEM,
    buildProjectionPrompt(spec, args.markdown),
  );
  const firstParse = tryParseJson(firstRaw);

  if (firstParse.ok) {
    const firstValidation = spec.bodySchema.safeParse(firstParse.value);
    if (firstValidation.success) {
      return {
        body: firstValidation.data,
        validates: true,
        completeness: buildCompleteness(spec, args.markdown, firstValidation.data),
      };
    }

    // Round 2: ONE repair round on the failing fields.
    const zodError = JSON.stringify(firstValidation.error.issues);
    const repairRaw = await generate(
      PROJECTION_SYSTEM,
      buildRepairPrompt(spec, stripCodeFences(firstRaw), zodError),
    );
    const repairParse = tryParseJson(repairRaw);

    if (repairParse.ok) {
      const repairValidation = spec.bodySchema.safeParse(repairParse.value);
      if (repairValidation.success) {
        return {
          body: repairValidation.data,
          validates: true,
          completeness: buildCompleteness(
            spec,
            args.markdown,
            repairValidation.data,
          ),
        };
      }

      return {
        body: repairParse.value,
        validates: false,
        zodError: JSON.stringify(repairValidation.error.issues),
        completeness: buildCompleteness(spec, args.markdown, repairParse.value),
      };
    }

    // Repair produced unparsable JSON — report the round-1 zodError as the finding.
    return {
      body: firstParse.value,
      validates: false,
      zodError,
      completeness: buildCompleteness(spec, args.markdown, firstParse.value),
    };
  }

  // Round 1 produced unparsable JSON. ONE repair round asking for valid JSON.
  const repairRaw = await generate(
    PROJECTION_SYSTEM,
    buildRepairPrompt(
      spec,
      firstRaw.slice(0, 8000),
      "Output was not valid JSON. Re-emit a single valid JSON object with no prose or code fences.",
    ),
  );
  const repairParse = tryParseJson(repairRaw);

  if (!repairParse.ok) {
    return {
      body: undefined,
      validates: false,
      zodError: "projection output was not valid JSON after one repair round.",
      completeness: spec.highValueBlocks.map((block) => ({
        block: block.key,
        sourceHadIt: sourceHadBlock(args.markdown, block.sourceMarkers),
        typedCount: 0,
      })),
    };
  }

  const repairValidation = spec.bodySchema.safeParse(repairParse.value);
  if (repairValidation.success) {
    return {
      body: repairValidation.data,
      validates: true,
      completeness: buildCompleteness(spec, args.markdown, repairValidation.data),
    };
  }

  return {
    body: repairParse.value,
    validates: false,
    zodError: JSON.stringify(repairValidation.error.issues),
    completeness: buildCompleteness(spec, args.markdown, repairParse.value),
  };
}
