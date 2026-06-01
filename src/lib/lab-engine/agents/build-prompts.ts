import type { ResearchInput } from "../artifacts/artifact-envelope";
import type { CompetitorAdEvidenceGroup } from "../artifacts/schemas/competitor-landscape";
import type { SectionId } from "../events/activity-event";
import { ToolGapSchema } from "./tools/_shared";
import type { AgentStep } from "./section-agent";
import type { AnswerToolInputSchemaMode } from "./answer-tool";

export interface PromptSectionDefinition {
  id?: SectionId;
  title: string;
  mission: string;
  outputEmphasis: readonly string[];
  bodySchema?: unknown;
  sectionOutputSchemaName?: string;
}

export interface AnswerToolInstructionOptions {
  externalToolNames?: readonly string[];
  inputSchemaMode?: AnswerToolInputSchemaMode;
}

interface CompetitorSeedHint {
  angle: string;
  landingUrl: string | null;
  name: string;
  sourceUrl: string;
}

const sectionIdByOutputSchemaName: Readonly<Record<string, SectionId>> = {
  MarketCategorySectionOutput: "positioningMarketCategory",
  BuyerICPSectionOutput: "positioningBuyerICP",
  CompetitorLandscapeSectionOutput: "positioningCompetitorLandscape",
  VoiceOfCustomerSectionOutput: "positioningVoiceOfCustomer",
  DemandIntentSectionOutput: "positioningDemandIntent",
  OfferDiagnosticSectionOutput: "positioningOfferDiagnostic",
  PositioningSynthesisSectionOutput: "positioningSynthesis",
  PaidMediaPlanSectionOutput: "positioningPaidMediaPlan",
};

interface CompactAdEvidenceCreative {
  body: string | null;
  headline: string | null;
  landingUrl: string | null;
  platform: string;
  sourceUrl: string;
}

interface CompactAdEvidenceGroup {
  advertiserName: string;
  dataGaps: CompetitorAdEvidenceGroup["dataGaps"];
  displayableCounts: CompetitorAdEvidenceGroup["displayableCounts"];
  platforms: CompetitorAdEvidenceGroup["platforms"];
  rawCounts: CompetitorAdEvidenceGroup["rawCounts"];
  returnedCreativeCount: number;
  sampleCreatives: CompactAdEvidenceCreative[];
  sourceErrors: CompetitorAdEvidenceGroup["sourceErrors"];
}

function buildRootShapeGuidance(): string {
  return [
    "Required JSON root shape:",
    "{",
    '  "sectionTitle": "...",',
    '  "verdict": "...",',
    '  "statusSummary": "...",',
    '  "confidence": 0.6,',
    '  "sources": [{ "title": "...", "url": "...", "publisher": "..." }],',
    '  "body": {',
    '    "...section body keys only...": {}',
    "  }",
    "}",
    "",
    "Only these root keys are allowed: `sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`, and `body`.",
    "Section-specific keys must be inside `body`, never at the root.",
    "",
    "WRONG (do NOT nest the root fields inside `body`):",
    '{ "body": { "sectionTitle": "...", "verdict": "...", "statusSummary": "...", "confidence": 0.6, "sources": [...], ...section keys... } }',
    "RIGHT (root fields stay at the top level; `body` holds only section keys):",
    '{ "sectionTitle": "...", "verdict": "...", "statusSummary": "...", "confidence": 0.6, "sources": [...], "body": { ...section keys only... } }',
    "Do not output `$schema`.",
  ].join("\n");
}

function buildCorpusOnlyBoundary(
  externalToolNames: readonly string[] | undefined,
): string[] {
  if (externalToolNames === undefined || externalToolNames.length > 0) {
    return [];
  }

  return [
    "Corpus-only mode:",
    "No external research tools are available in this run. Use only the ResearchInput JSON, pre-normalized evidence blocks, skill guidance, and the answer tool.",
    "Do not call web_search, firecrawl, pagespeed, reviews, keyword_ad_probe, adlibrary, google_ads, or meta_ads.",
    "Ignore any skill text that lists research tools; those tools are not available for this corpus-only validation run.",
    "",
  ];
}

function getCapabilityGapSignalLabel(definition: PromptSectionDefinition): string {
  switch (definition.sectionOutputSchemaName) {
    case "MarketCategorySectionOutput":
      return "a market signal";
    case "BuyerICPSectionOutput":
      return "an ICP signal";
    case "CompetitorLandscapeSectionOutput":
      return "a competitive signal";
    case "VoiceOfCustomerSectionOutput":
      return "buyer language";
    case "DemandIntentSectionOutput":
      return "demand volume";
    case "OfferDiagnosticSectionOutput":
      return "offer or funnel evidence";
    default:
      return "substantive evidence for the section";
  }
}

function buildCapabilityGapToolHints(
  definition: PromptSectionDefinition,
): string[] {
  if (definition.sectionOutputSchemaName !== "VoiceOfCustomerSectionOutput") {
    return [];
  }

  return [
    "When `reviews` snippets are thin, chain `firecrawl` on the source URL to recover the full verbatim quote rather than truncating it.",
  ];
}

function buildCapabilityGapGuidance(
  definition: PromptSectionDefinition,
  externalToolNames: readonly string[] | undefined,
): string[] {
  if (externalToolNames === undefined || externalToolNames.length === 0) {
    return [];
  }

  return [
    "Capability gaps:",
    'If a tool call returns `{ type: "gap", reason: "...", message: "..." }`, treat it as a capability gap.',
    "Do not retry the same tool with different inputs unless the gap reason is `rate_limited`.",
    "Name the gap explicitly in section prose using the format `evidence gap: <human-readable reason>`.",
    "Continue producing the best honest artifact from the evidence that remains.",
    ...buildCapabilityGapToolHints(definition),
    "",
    "Budget note:",
    "`web_search` and SDK tools have independent per-channel caps in V1. A section may spend up to `maxExternalLookups` web searches plus `maxExternalLookups` SDK-tool calls.",
    `When either channel is exhausted, treat the returned \`rate_limited\` gap as evidence that the surface was capped, not as ${getCapabilityGapSignalLabel(definition)}.`,
    "",
  ];
}

function buildAnswerToolCompletionInstruction(
  externalToolNames: readonly string[] | undefined,
): string {
  if (externalToolNames !== undefined && externalToolNames.length === 0) {
    return "You MUST call the `answer` tool with the COMPLETE structured section output — every required field (`sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`, `body`) must be present and non-empty. If a required field is not directly evidenced by ResearchInput, write an explicit evidence gap inside the relevant field while still satisfying the schema. Do not call unavailable research tools. Do not respond with text after a successful `answer` call.";
  }

  return "You MUST call the `answer` tool with the COMPLETE structured section output — every required field (`sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`, `body`) must be present and non-empty. If any required field is unknown, KEEP RESEARCHING with the available tools. The `answer` tool will reject incomplete input and feed the error back to you; if that happens, fix the missing fields and call it again. Do not respond with text after a successful `answer` call.";
}

export function shortenForEvent(value: unknown, maxChars = 180): string {
  const raw =
    typeof value === "string" ? value : JSON.stringify(value, null, 0) ?? "";

  if (raw.length <= maxChars) {
    return raw;
  }

  return `${raw.slice(0, maxChars - 14)}...truncated`;
}

export function buildEvidenceTranscript(steps: AgentStep[]): string {
  const maxChars = 12_000;
  const blocks = steps.map((step) =>
    [
      `[step ${step.stepNumber} finish=${step.finishReason}]`,
      step.text,
      ...step.toolCalls.map(
        (toolCall) =>
          `[toolCall ${toolCall.toolName}] ${shortenForEvent(toolCall.input, 500)}`,
      ),
      ...step.toolResults.map((toolResult) =>
        formatToolResultForTranscript(toolResult.toolName, toolResult.output),
      ),
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  );
  const joined = blocks.join("\n\n");

  if (joined.length <= maxChars) {
    return joined;
  }

  return `...truncated...\n${joined.slice(-maxChars)}`;
}

function formatToolResultForTranscript(
  toolName: string,
  output: unknown,
): string {
  const gapResult = ToolGapSchema.safeParse(output);

  if (gapResult.success) {
    const envVar =
      gapResult.data.envVar === undefined ? "" : ` (${gapResult.data.envVar})`;
    return `[toolResult ${toolName}] gap: ${gapResult.data.reason}${envVar}: ${gapResult.data.message}`;
  }

  return `[toolResult ${toolName}] ${shortenForEvent(output, 1_000)}`;
}

function isCompetitorLandscapeDefinition(
  definition: PromptSectionDefinition,
): boolean {
  return (
    definition.sectionOutputSchemaName === "CompetitorLandscapeSectionOutput" ||
    definition.title === "Competitor Landscape & Positioning"
  );
}

function buildCompetitorSeedHints(
  researchInput: ResearchInput,
): CompetitorSeedHint[] {
  return researchInput.competitorAds.map((competitorAd) => ({
    angle: competitorAd.angle,
    landingUrl: competitorAd.landingUrl,
    name: competitorAd.competitorName,
    sourceUrl: competitorAd.sourceUrl,
  }));
}

function buildResearchInputForPrompt({
  definition,
  researchInput,
}: {
  definition: PromptSectionDefinition;
  researchInput: ResearchInput;
}): unknown {
  const scopedResearchInput = buildSectionScopedResearchInputForPrompt({
    definition,
    researchInput,
  });

  if (!isCompetitorLandscapeDefinition(definition)) {
    return scopedResearchInput;
  }

  return {
    ...scopedResearchInput,
    competitorSeedHints: buildCompetitorSeedHints(researchInput),
    competitorAds:
      "ResearchInput.competitorAds is fixture-preview context only. It is omitted from live ad evidence and must not be copied into body.adEvidence. Use competitorSeedHints as the named competitor starting set, not as live ad creative evidence.",
  };
}

function resolvePromptSectionId(
  definition: PromptSectionDefinition,
): SectionId | null {
  if (definition.id !== undefined) {
    return definition.id;
  }

  if (definition.sectionOutputSchemaName === undefined) {
    return null;
  }

  return (
    sectionIdByOutputSchemaName[definition.sectionOutputSchemaName] ?? null
  );
}

function buildSectionScopedResearchInputForPrompt({
  definition,
  researchInput,
}: {
  definition: PromptSectionDefinition;
  researchInput: ResearchInput;
}): Omit<ResearchInput, "corpus"> & {
  corpus: { excerpts: ResearchInput["corpus"]["excerpts"] };
} {
  const sectionId = resolvePromptSectionId(definition);
  const sectionExcerpts =
    sectionId === null
      ? undefined
      : researchInput.corpus.sectionExcerpts?.[sectionId];

  return {
    ...researchInput,
    corpus: {
      excerpts: sectionExcerpts ?? researchInput.corpus.excerpts,
    },
  };
}

function buildNormalizedAdEvidenceBlock(
  groups: readonly CompetitorAdEvidenceGroup[] | undefined,
): string[] {
  if (groups === undefined) {
    return [];
  }

  return [
    "Pre-normalized live ad evidence:",
    "Write `body.adEvidence.prose` from these groups. If groups are empty, say that no live ad-library tool results were available and do not use fixture ads.",
    "Set `body.adEvidence.advertiserGroups` to [] in your generated JSON. The runner injects these exact normalized groups after structured generation so counts, source links, returnedCreativeCount, dataGaps, and sourceErrors cannot drift.",
    "For Competitor Landscape, reconcile `body.competitorSet.competitors` against ResearchInput.competitorSeedHints and the live evidence transcript before introducing generic alternatives.",
    "Compact ad evidence view for reasoning:",
    JSON.stringify(compactAdEvidenceGroups(groups), null, 2),
    "",
  ];
}

function compactAdEvidenceGroups(
  groups: readonly CompetitorAdEvidenceGroup[],
): CompactAdEvidenceGroup[] {
  return groups.map((group) => ({
    advertiserName: group.advertiserName,
    dataGaps: group.dataGaps,
    displayableCounts: group.displayableCounts,
    platforms: group.platforms,
    rawCounts: group.rawCounts,
    returnedCreativeCount: group.returnedCreativeCount,
    sampleCreatives: group.creatives.slice(0, 2).map((creative) => ({
      body: creative.body,
      headline: creative.headline,
      landingUrl: creative.landingUrl,
      platform: creative.platform,
      sourceUrl: creative.sourceUrl,
    })),
    sourceErrors: group.sourceErrors,
  }));
}

function buildSectionMinimumGuidance(
  definition: PromptSectionDefinition,
): string[] {
  if (definition.sectionOutputSchemaName === "MarketCategorySectionOutput") {
    return [
      "- MarketCategorySectionOutput minimums: top-level `sources` must include at least three Section-level sources.",
      "- MarketCategorySectionOutput minimums: `body.categoryDefinition.adjacentCategories` must include at least two categories buyers confuse this with.",
      "- MarketCategorySectionOutput minimums: `body.marketSize.signals` must include at least three public trajectory signals with unique `signalType` values.",
      "- MarketCategorySectionOutput minimums: `body.marketSize.signals` must include at least one `top-down` and one `bottom-up` methodology.",
      "- MarketCategorySectionOutput minimums: `body.structuralForces.forces` must include exactly one `regulation`, one `platform-shift`, and one `buyer-behavior` forceType.",
      "- MarketCategorySectionOutput minimums: `body.categoryMaturity.classification.supportingSignals` must include at least two maturity signals.",
    ];
  }

  if (definition.sectionOutputSchemaName === "CompetitorLandscapeSectionOutput") {
    return [
      "- CompetitorLandscapeSectionOutput minimums: top-level `sources` must include at least five Section-level sources.",
      "- CompetitorLandscapeSectionOutput minimums: `body.competitorSet.competitors` must include at least one competitor for each `competitorType`: `direct`, `indirect`, `status-quo`, and `diy`.",
      "- CompetitorLandscapeSectionOutput minimums: `status-quo` means the buyer's current non-purchase workflow, such as spreadsheet backlog tracking, Slack/email triage, founder memory, or manual process review. Source it to public evidence that names the workflow pain or current process, and call out any thin evidence in prose instead of dropping the bucket.",
      "- For the SaaSLaunch fixture, use a manual founder-led sales workflow, spreadsheet pipeline review, or founder memory/follow-up process as the `diy` competitor when public sources do not name a productized DIY alternative.",
      "- CompetitorLandscapeSectionOutput minimums: `body.positioningTaxonomy.axes` must include at least three axes.",
      "- CompetitorLandscapeSectionOutput minimums: `body.pricingReality.dataPoints` must cover at least three distinct competitors.",
      "- CompetitorLandscapeSectionOutput minimums: do not repeat one competitor to satisfy distinct-competitor checks; if pricing is public for Jira, Asana, ClickUp, GitHub Projects, Monday.com, Shortcut, or another named competitor, use those separate competitor names with their own source URLs.",
      "- CompetitorLandscapeSectionOutput minimums: `body.shareOfVoice.slices` must include at least three surfaces.",
      "- CompetitorLandscapeSectionOutput minimums: `body.publicWeaknesses.items` must include at least four verbatim weaknesses.",
      "- CompetitorLandscapeSectionOutput minimums: `body.publicWeaknesses.items` must cover at least two distinct competitors.",
      "- CompetitorLandscapeSectionOutput minimums: public weaknesses must quote or summarize weakness evidence for at least two different competitor names; do not reuse all weaknesses from a single competitor.",
      "- CompetitorLandscapeSectionOutput minimums: `body.narrativeArcs.arcs` must include at least three arcs.",
    ];
  }

  if (definition.sectionOutputSchemaName === "BuyerICPSectionOutput") {
    return [
      "- BuyerICPSectionOutput exact item contracts: `body.icpExistenceCheck.firmographicCuts[]` keys are `cutType`, `value`, optional `accountCount`, `source`, `sourceUrl`, `dateObserved`.",
      "- `cutType` must be one of `industry`, `employeeBands`, `revenueBands`, `geography`, `techStack`.",
      "- BuyerICPSectionOutput minimums: include at least three firmographic cuts with at least three distinct `cutType` values.",
      "- `body.personaReality.personas[]` keys are `name`, `title`, `company`, `sourceUrl`, `role`, `seniority`, optional `teamSize`, `evidence`.",
      "- `role` must be one of `champion`, `economic-buyer`, `decision-maker`, `influencer`, `end-user`, `gatekeeper`; include at least five personas.",
      "- Do not invent named people. If evidence has only a role or segment, make `name` a role/segment label and put `evidence gap: no named public buyer found` in `evidence`.",
      "- `body.awarenessDistribution.levels[]` keys are `level`, `share`, `evidence`, optional `sampleQuery`; `share` must be a string like `20%`, `low`, or `medium`, never a number.",
      "- Include exactly one awareness row each for `unaware`, `problem-aware`, `solution-aware`, `product-aware`, `most-aware`.",
      "- `body.buyingContext.triggers[]` keys are `name`, `detectionSignal`, `window`, `evidence`, optional `sourceUrl`; do not use `event`, `urgency`, or `buyerQuote`.",
      "- `window` must be one of `immediate`, `weeks`, `quarters`; include at least three triggers.",
      "- `body.clusters.venues[]` keys are `bucketType`, `name`, `audienceSize`, `sourceUrl`, `whyItMatters`; do not use `type`, `icpConcentration`, `accessMethod`, or `evidence`.",
      "- `bucketType` must be one of `community`, `newsletter`, `conference`, `podcast`, `slack-group`, `event`; include at least two `community` and two `newsletter` venues.",
    ];
  }

  if (definition.sectionOutputSchemaName === "VoiceOfCustomerSectionOutput") {
    return [
      "- VoiceOfCustomerSectionOutput exact item contracts: `body.painLanguage.quotes[]` keys are `verbatimText`, `source`, `sourceUrl`, `painTheme`, `painIntensity`, plus optional `role` (reviewer role/handle) and `date` (when the source discloses it).",
      "- `source` must be one of `g2`, `reddit`, `hackernews`, `sales-call`, `support-thread`, `twitter`, `other`; `painIntensity` must be `high`, `medium`, or `low`.",
      "- VoiceOfCustomerSectionOutput minimums: include at least ten pain quotes from at least three distinct sources.",
      "- Pain quotes are LOAD-BEARING: every `verbatimText` must trace to a fetched source or corpus excerpt. NEVER present the subject company's own homepage, marketing, or testimonial copy as buyer pain — pain quotes come only from independent sources (review sites, forums, support threads), never the audited company's own domain.",
      "- No single source may supply a majority of the pain quotes; spread them across independent domains.",
      "- When a `reviews` snippet is truncated, chain `firecrawl` on its `sourceUrl` to recover the full verbatim quote (and the reviewer `role`/`date` when shown) rather than emitting a clipped quote.",
      "- `body.objections.items[]` keys are `objectionText`, `category`, `frequency`, `howToHandle`, `sourceUrl`; include at least five objections across at least three categories.",
      "- `category` must be one of `price`, `feature`, `trust`, `switching-cost`, `timing`, `stakeholder`, `other`; `frequency` must be `recurring`, `occasional`, or `one-off`.",
      "- `body.switchingStories.stories[]` keys are `priorSolution`, `reasonToLeave`, `decisionPath`, optional `exampleCompany`, `sourceUrl`; include at least three stories and at least two prior solutions.",
      "- `body.decisionCriteria.criteria[]` keys are `criterion`, `statedBy`, `evidenceQuote`, `sourceUrl`; `statedBy` must be `buyer`, `champion`, `influencer`, or `blocker`; include at least five criteria.",
      "- `body.successLanguage.quotes[]` keys are `verbatimText`, `source`, `sourceUrl`, `afterStatePattern`; include at least five success quotes.",
    ];
  }

  if (definition.sectionOutputSchemaName === "DemandIntentSectionOutput") {
    return [
      "- DemandIntentSectionOutput exact item contracts: `body.keywordDemand.keywords[]` keys are `keyword`, `monthlyVolume`, `intentType`, `top3RankingDomains`, `sourceTitle`, `sourceUrl`, `dateObserved`.",
      "- `intentType` must be one of `informational`, `commercial`, `transactional`, `navigational`; include at least ten keyword rows.",
      "- Put a falsifiable signal on every keyword row: call the `keyword_volume` tool (SpyFu) with your candidate keywords in ONE bulk call (up to 100) to get monthly search volume + CPC + difficulty, and populate `monthlyVolume` (and optional `cpc`) from it.",
      "- Provenance honesty is enforced: ONLY label `monthlyVolume`/`cpc` values 'SpyFu-estimated' when the `keyword_volume` tool returned data for that keyword. If the tool returns a gap (e.g. rate-limited / unavailable), you MUST NOT claim SpyFu provenance — instead label the value 'model estimate (SpyFu unavailable)' or restate the row as a data gap. Never write `not disclosed` — it is rejected by the validator.",
      "- `body.questionMining.questions[]` keys are `question`, `surface`, `sourceUrl`, `frequency`; include at least ten questions across at least two surface types.",
      "- `surface` must be one of `paa`, `reddit`, `quora`, `community`, `forum`, `support-thread`; `frequency` must be `recurring` or `occasional`.",
      "- `body.contentGaps.gaps[]` keys are `topic`, `evidenceOfDemand`, `weakCompetitorAnswerEvidence`, `opportunity`; include at least three gaps.",
      "- `body.intentSignals.items[]` keys are `signalType`, `description`, `sourceUrl`, optional `exampleCompany`; include at least five items across at least two signalTypes.",
      "- `signalType` must be one of `job-posting`, `rfp`, `news-trigger`, `funding`, `leadership-change`.",
      "- `body.venueMap.venues[]` keys are `name`, `venueType`, `audienceSize`, `sourceUrl`; `venueType` must be `event`, `community`, `newsletter`, `podcast`, or `slack`; include at least four venues across at least two venueTypes.",
    ];
  }

  if (definition.sectionOutputSchemaName === "OfferDiagnosticSectionOutput") {
    return [
      "- OfferDiagnosticSectionOutput exact item contracts: `body.offerMarketFit.proofPoints[]` keys are `metric`, `value`, `reportedBy`, `confidence`, `sourceUrl`; include at least three proof points.",
      "- `reportedBy` must be `company-own` or `external-source`; `confidence` must be `high`, `medium`, or `low`.",
      "- `body.funnelDiagnosis.breaks[]` keys are `stageName`, `metric`, `magnitude`, `hypothesis`, `sourceUrl`; include at least two funnel breaks.",
      "- `body.channelTruth.channels[]` keys are `channelName`, `hasWorked`, `quantifiedEvidence`, `sourceUrl`; include at least three distinct channels.",
      "- `hasWorked` must be one of `yes`, `partial`, `no`, `unknown`.",
      "- `body.retentionHealth.signals[]` keys are `signalType`, `metric`, `value`, `sourceUrl`; include at least three signals across at least two signalTypes.",
      "- `signalType` must be one of `activation`, `retention`, `first-value-moment`.",
      "- `body.redFlags.items[]` keys are `claimedMotion`, `actualEvidence`, `contradiction`, `severity`; `severity` must be `high`, `medium`, or `low`; include at least three red flags.",
    ];
  }

  if (definition.sectionOutputSchemaName === "PaidMediaPlanSectionOutput") {
    return [
      "- PaidMediaPlanSectionOutput top-level `sources[]` objects use only `title`, `url`, and optional `publisher`; do not emit `id` or `observedAt`.",
      "- PaidMediaPlanSectionOutput sourceSection enum values are exactly `positioningMarketCategory`, `positioningBuyerICP`, `positioningCompetitorLandscape`, `positioningVoiceOfCustomer`, `positioningDemandIntent`, `positioningOfferDiagnostic`, or `gtmBrief`.",
      "- `body.campaignOverview` keys are exactly `prose`, `monthlyBudget`, `totalMonths`, `phaseCount`, `dailySpend`, `primaryKpi`, `platform`.",
      "- PaidMediaPlanSectionOutput numeric fields are only `totalMonths`, `phaseCount`, `staticCount`, `videoCount`, and `totalPerAudience`; emit those as numbers.",
      "- PaidMediaPlanSectionOutput array fields must stay arrays. Budget, daily-spend, slot, and descriptive fields must be JSON strings.",
      "- `body.campaignPhases` is an object with `prose` and `phases[]`; each phase has exactly `phaseName`, `monthsLabel`, `monthlyBudget`, `bullets`. Do not use `name`, `duration`, `focus`, or `allocation`.",
      "- `body.audienceTypes` is an object with `prose` and `audiences[]`; each audience has exactly `slot`, `archetype`, `dailyBudget`, `detail`, `sourceSection`, `sourceUrl`.",
      "- `body.creativeStrategy` keys are exactly `prose`, `staticCount`, `videoCount`, `totalPerAudience`, `angleTypesInMix`; angle type values are `unique-selling-point`, `problem-solution-transformation`, `objection-handling`, `founder-talking-head`, or `product-demo`.",
      "- `body.anglesToTest` is an object with `prose` and `angles[]`; each angle has exactly `angleName`, `primaryText`, `supportingLine`, `insight`, `sourceSection`, `sourceUrl`. Do not use `name`.",
      "- `body.creativeFramework` is an object with `prose` and `creatives[]`; each creative has `creativeType`, `sourceSection`, `sourceUrl`, plus the fields for that creative type. Do not use `headline`, `body`, `cta`, `visualDescription`, or `landingPageUrl`.",
      "- `body.competitorReviewInsights` is an object with `prose` and `insights[]`; each insight has exactly `competitor`, `verbatimComplaint`, `adLeverage`, `sourceSection`, `sourceUrl`.",
      "- `body.competitorMarketingInsights` is an object with `prose` and `competitors[]`; each competitor has exactly `competitor`, `messaging`, `adPlatforms`, `estSpend`, `icpTargeted`, `anglesTested`, `positioningClaim`, `offer`, `sourceSection`, `sourceUrl`.",
      "- `body.competitorMarketingInsights.competitors[].anglesTested` is a single string such as `workflow speed; tool consolidation`; never an array.",
      "- `body.funnelIdeation` is an object with `prose` and `recommendations[]`; each recommendation has exactly `funnelType`, `recommendation`, `optInToBookedCall`, `sourceSection`. Funnel type values are `direct-to-calendar`, `booking-page`, `free-audit-landing-page`, or `advanced-vsl-website`.",
      "- `body.salesProcess` is an object with `prose` and `assets[]`; each asset has exactly `label`, `url`, `assetType`, where assetType is `sop-doc` or `loom`. If no asset URL exists, use an empty array and explain the gap in prose.",
      "- `body.channelSuggestions` is an object with `prose` and `suggestions[]`; each suggestion has exactly `channel`, `observation`, `recommendation`, `verdict`, `sourceSection`, where verdict is `keep`, `fix`, `cut`, or `start`.",
      "- `body.kpis` keys are exactly `prose`, `gtmMotion`, `kpis`; `gtmMotion` must be `SLG` or `PLG`; each KPI has exactly `metric`, `role`, `definition`.",
    ];
  }

  if (definition.sectionOutputSchemaName === "PositioningSynthesisSectionOutput") {
    return [
      "- PositioningSynthesisSectionOutput top-level `sources[]` objects use only `title`, `url`, and optional `publisher`; do not emit `id` or `observedAt`.",
      "- PositioningSynthesisSectionOutput sourceSection enum values are exactly `positioningMarketCategory`, `positioningBuyerICP`, `positioningCompetitorLandscape`, `positioningVoiceOfCustomer`, `positioningDemandIntent`, `positioningOfferDiagnostic`, or `gtmBrief`.",
      "- `body` keys are exactly `situationThesis`, `positioningOptions`, `recommendedMove`, `messagingDirections`. Do not emit other keys.",
      "- `body.situationThesis` is an object with exactly `prose`.",
      "- `body.positioningOptions` is an object with `prose` and `options[]`; provide exactly 2 or 3 divergent options. Each option has exactly `optionName`, `angle`, `rationale`, `sourceSection`, `sourceUrl`.",
      "- `body.recommendedMove` is an object with exactly `optionAngle`, `rationale`, `nextSteps`. `optionAngle` must be verbatim one of `body.positioningOptions.options[].angle`.",
      "- `body.messagingDirections` is an object with `prose` and `directions[]`; provide at least two. Each direction has exactly `direction`, `copyPoint`, `sourceSection`, `sourceUrl`.",
      "- At least two synthesized items across options and directions must cite a non-`gtmBrief` `sourceSection`. Do not narrate a confidence figure in any prose field.",
    ];
  }

  return [];
}

export function buildStructuredPrompt({
  definition,
  evidenceTranscript,
  externalToolNames,
  normalizedAdEvidenceGroups,
  researchInput,
  skillMd,
}: {
  definition: PromptSectionDefinition;
  evidenceTranscript: string;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  researchInput: ResearchInput;
  skillMd: string;
  externalToolNames?: readonly string[];
}): string {
  return [
    `Section ${definition.title}.`,
    `Mission: ${definition.mission}`,
    "",
    ...buildCapabilityGapGuidance(definition, externalToolNames),
    "Skill analyst guidance:",
    skillMd,
    "",
    "Evidence from the loop:",
    evidenceTranscript,
    "",
    ...buildNormalizedAdEvidenceBlock(normalizedAdEvidenceGroups),
    "ResearchInput JSON:",
    JSON.stringify(
      buildResearchInputForPrompt({ definition, researchInput }),
      null,
      2,
    ),
    "",
    "Output emphasis:",
    definition.outputEmphasis.map((item) => `- ${item}`).join("\n"),
    "",
    "Validator checklist:",
    "- Satisfy the section-specific schema and minimum validator.",
    "- Use real source URLs from the evidence transcript and ResearchInput.",
    "- For Competitor Landscape ad evidence, use pre-normalized live ad evidence only.",
    ...buildSectionMinimumGuidance(definition),
    "- Keep confidence in the 0..1 envelope scale.",
    "- Do not state a confidence figure as text in verdict, statusSummary, or any body prose; report it only in the confidence field.",
    "",
    buildRootShapeGuidance(),
    "",
    "Produce the section output strictly matching the schema. The runner will wrap it into the envelope.",
  ].join("\n");
}

export function buildAnswerToolInstructions(
  definition: PromptSectionDefinition,
  researchInput: ResearchInput,
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[],
  options: AnswerToolInstructionOptions = {},
): string {
  const inputSchemaMode = options.inputSchemaMode ?? "loose-passthrough";

  return [
    `You are the AI-GOS section analyst for ${definition.title}.`,
    `Mission: ${definition.mission}`,
    "",
    "ResearchInput JSON:",
    JSON.stringify(
      buildResearchInputForPrompt({ definition, researchInput }),
      null,
      2,
    ),
    "",
    ...buildNormalizedAdEvidenceBlock(normalizedAdEvidenceGroups),
    ...buildCapabilityGapGuidance(definition, options.externalToolNames),
    "Output emphasis:",
    definition.outputEmphasis.map((item) => `- ${item}`).join("\n"),
    "",
    "Validator checklist:",
    "- Gather enough evidence to satisfy the section-specific schema and minimum validator.",
    "- Use real source URLs from tool evidence and ResearchInput.",
    ...buildSectionMinimumGuidance(definition),
    "- Keep confidence in the 0..1 envelope scale.",
    "- Do not state a confidence figure as text in verdict, statusSummary, or any body prose; report it only in the confidence field.",
    "",
    buildRootShapeGuidance(),
    "",
    ...(inputSchemaMode === "section-schema"
      ? [
          "Answer tool schema mode:",
          "The answer tool input schema is bound to the full section schema for this model.",
          "Call `answer` only when the complete object satisfies every required field and section-specific body key.",
          "",
        ]
      : []),
    ...buildCorpusOnlyBoundary(options.externalToolNames),
    buildAnswerToolCompletionInstruction(options.externalToolNames),
  ].join("\n");
}

// Goal recitation (Manus context-engineering): restate the section's objective
// at the prompt TAIL — after the long skill body — so the goal sits in the
// model's recent-attention window and fights lost-in-the-middle drift on the
// longer single-section loops. Cheap, and it reinforces the evidence-grounding
// rule right before the model answers.
export function buildSectionObjectiveRecap(
  definition: PromptSectionDefinition,
  researchInput: ResearchInput,
): string {
  return [
    "",
    "Section objective (re-anchor before you answer):",
    `- Deliver ${definition.title}: ${definition.mission}`,
    `- Subject company: ${researchInput.company.websiteUrl}`,
    "- Ground every card in fetched tool evidence or the ResearchInput above; where evidence is thin, name the gap — do not invent or pad.",
  ].join("\n");
}

export function buildRepairPrompt({
  definition,
  evidenceTranscript,
  issues,
  normalizedAdEvidenceGroups,
  previousOutput,
  researchInput,
  skillMd,
  externalToolNames,
}: {
  definition: PromptSectionDefinition;
  evidenceTranscript: string;
  issues: string[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  previousOutput: unknown;
  researchInput: ResearchInput;
  skillMd: string;
  externalToolNames?: readonly string[];
}): string {
  return [
    buildStructuredPrompt({
      definition,
      evidenceTranscript,
      externalToolNames,
      normalizedAdEvidenceGroups,
      researchInput,
      skillMd,
    }),
    "",
    "The previous output failed validation. Return a corrected full output.",
    "If section-specific fields were placed at the root, move them under `body`.",
    "Remove `$schema` and any runtime-only fields.",
    "Validation issues:",
    issues.map((issue) => `- ${issue}`).join("\n"),
    "",
    "Previous output JSON:",
    JSON.stringify(previousOutput),
  ].join("\n");
}
