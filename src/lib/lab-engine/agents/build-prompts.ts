import type { ResearchInput } from "../artifacts/artifact-envelope";
import type { CompetitorAdEvidenceGroup } from "../artifacts/schemas/competitor-landscape";
import { ToolGapSchema } from "./tools/_shared";
import type { AgentStep } from "./section-agent";

export interface PromptSectionDefinition {
  title: string;
  mission: string;
  outputEmphasis: readonly string[];
  bodySchema?: unknown;
  sectionOutputSchemaName?: string;
}

interface CompetitorSeedHint {
  angle: string;
  landingUrl: string | null;
  name: string;
  sourceUrl: string;
}

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
  if (!isCompetitorLandscapeDefinition(definition)) {
    return researchInput;
  }

  return {
    ...researchInput,
    competitorSeedHints: buildCompetitorSeedHints(researchInput),
    competitorAds:
      "ResearchInput.competitorAds is fixture-preview context only. It is omitted from live ad evidence and must not be copied into body.adEvidence. Use competitorSeedHints as the named competitor starting set, not as live ad creative evidence.",
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
      "- MarketCategorySectionOutput minimums: `body.marketSize.signals` must include at least one `top-down` and one `bottom-up` methodology.",
      "- MarketCategorySectionOutput minimums: `body.structuralForces.forces` must include exactly one `regulation`, one `platform-shift`, and one `buyer-behavior` forceType.",
    ];
  }

  if (definition.sectionOutputSchemaName === "CompetitorLandscapeSectionOutput") {
    return [
      "- CompetitorLandscapeSectionOutput minimums: `body.competitorSet.competitors` must include at least one competitor for each `competitorType`: `direct`, `indirect`, `status-quo`, and `diy`.",
      "- For the SaaSLaunch fixture, use a manual founder-led sales workflow, spreadsheet pipeline review, or founder memory/follow-up process as the `diy` competitor when public sources do not name a productized DIY alternative.",
      "- CompetitorLandscapeSectionOutput minimums: `body.pricingReality.dataPoints` must cover at least three distinct competitors.",
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
      "- VoiceOfCustomerSectionOutput exact item contracts: `body.painLanguage.quotes[]` keys are `verbatimText`, `source`, `sourceUrl`, `painTheme`, `painIntensity`.",
      "- `source` must be one of `g2`, `reddit`, `hackernews`, `sales-call`, `support-thread`, `twitter`, `other`; `painIntensity` must be `high`, `medium`, or `low`.",
      "- VoiceOfCustomerSectionOutput minimums: include at least ten pain quotes from at least three distinct sources.",
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

  return [];
}

export function buildStructuredPrompt({
  definition,
  evidenceTranscript,
  normalizedAdEvidenceGroups,
  researchInput,
  skillMd,
}: {
  definition: PromptSectionDefinition;
  evidenceTranscript: string;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  researchInput: ResearchInput;
  skillMd: string;
}): string {
  return [
    `Section ${definition.title}.`,
    `Mission: ${definition.mission}`,
    "",
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
): string {
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
    "Output emphasis:",
    definition.outputEmphasis.map((item) => `- ${item}`).join("\n"),
    "",
    "Validator checklist:",
    "- Gather enough evidence to satisfy the section-specific schema and minimum validator.",
    "- Use real source URLs from tool evidence and ResearchInput.",
    ...buildSectionMinimumGuidance(definition),
    "- Keep confidence in the 0..1 envelope scale.",
    "",
    buildRootShapeGuidance(),
    "",
    "You MUST call the `answer` tool with the COMPLETE structured section output — every required field (`sectionTitle`, `verdict`, `statusSummary`, `confidence`, `sources`, `body`) must be present and non-empty. If any required field is unknown, KEEP RESEARCHING with the available tools. The `answer` tool will reject incomplete input and feed the error back to you; if that happens, fix the missing fields and call it again. Do not respond with text after a successful `answer` call.",
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
}: {
  definition: PromptSectionDefinition;
  evidenceTranscript: string;
  issues: string[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  previousOutput: unknown;
  researchInput: ResearchInput;
  skillMd: string;
}): string {
  return [
    buildStructuredPrompt({
      definition,
      evidenceTranscript,
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
