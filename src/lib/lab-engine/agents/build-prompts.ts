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
  angle?: string;
  landingUrl: string | null;
  name: string;
  sourceUrl: string | null;
}

const sectionIdByOutputSchemaName: Readonly<Record<string, SectionId>> = {
  MarketCategorySectionOutput: "positioningMarketCategory",
  BuyerICPSectionOutput: "positioningBuyerICP",
  CompetitorLandscapeSectionOutput: "positioningCompetitorLandscape",
  VoiceOfCustomerSectionOutput: "positioningVoiceOfCustomer",
  DemandIntentSectionOutput: "positioningDemandIntent",
  OfferDiagnosticSectionOutput: "positioningOfferDiagnostic",
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

function buildStructuredDraftShapeGuidance(): string {
  return [
    "Required JSON root shape:",
    "{",
    '  "verdict": "...",',
    '  "statusSummary": "...",',
    '  "sources": [{ "title": "...", "url": "https://...", "publisher": "..." }],',
    '  "body": {',
    '    "...section body keys only...": {}',
    "  }",
    "}",
    "",
    "Return ONLY this structured draft object.",
    "Author `verdict` and `statusSummary` as distinct reader-facing fields; do not copy the same body prose block into both.",
    "Author top-level `sources` with distinct cited public URLs. Include at least five distinct URLs whenever the section minimum validator requires >=5 sources.",
    "Only these root keys are allowed: `verdict`, `statusSummary`, `sources`, and `body`.",
    "Do not include `sectionTitle`, `confidence`, or `$schema` at the root.",
    "Every evidence-backed row that has a public source must carry its own `sourceUrl` field inside `body` so the runner can merge row-level sources with the top-level `sources` channel after validation.",
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
    "Do not call web_search, firecrawl, pagespeed, reviews, keyword_ad_probe, adlibrary, google_ads, meta_ads, or linkedin_ads.",
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
    "`web_search` and SDK tools share the generic `maxExternalLookups` pool. Competitor Landscape also receives an additive reserved ad-tool pool for `adlibrary`, `google_ads`, `meta_ads`, and `linkedin_ads`; other sections should assume only the shared generic pool.",
    `When a tool call is rejected because the applicable pool is exhausted, treat the returned \`rate_limited\` gap as evidence that the surface was capped, not as ${getCapabilityGapSignalLabel(definition)}.`,
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

export function buildCompetitorSeedHints(
  researchInput: ResearchInput,
): CompetitorSeedHint[] {
  // Read competitorSeeds (the populated, cleaned/deduped named set built from
  // the onboarding brief), not competitorAds — the latter is hardcoded to an
  // empty array in corpus-to-research-input.ts, so the prompt never saw any
  // named competitors. Seeds carry only name + optional bare domain; angle and
  // a real source URL don't exist for them.
  return (researchInput.competitorSeeds ?? []).map((seed) => {
    const url =
      seed.domain === undefined ? null : `https://${seed.domain}`;

    return {
      landingUrl: url,
      name: seed.name,
      sourceUrl: url,
    };
  });
}

function joinList(values: readonly string[] | undefined): string | null {
  if (values === undefined || values.length === 0) {
    return null;
  }

  return values.join(", ");
}

function readEconomicsProvenance(
  economics: NonNullable<ResearchInput["onboarding"]["economics"]>,
  key: Exclude<
    keyof NonNullable<ResearchInput["onboarding"]["economics"]>,
    "provenance"
  >,
): string {
  return economics.provenance?.[key] ?? "unknown";
}

function formatEconomicsField(
  economics: NonNullable<ResearchInput["onboarding"]["economics"]>,
  key: Exclude<
    keyof NonNullable<ResearchInput["onboarding"]["economics"]>,
    "provenance"
  >,
  label: string,
): string | null {
  const value = economics[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return `${label}=${value.trim()} (${readEconomicsProvenance(economics, key)})`;
}

function buildEconomicsImplications(
  economics: NonNullable<ResearchInput["onboarding"]["economics"]>,
): string[] {
  const implications: string[] = [];

  if (
    economics.avgSalesCycle !== undefined ||
    economics.acv !== undefined ||
    economics.conversionPath !== undefined
  ) {
    implications.push(
      [
        economics.avgSalesCycle ?? "unknown cycle",
        economics.acv ?? "unknown ACV",
        economics.conversionPath ?? "unknown conversion path",
        "implies the section should treat the purchase as a considered decision and avoid impulse-buy assumptions",
      ].join(" + "),
    );
  }

  if (
    economics.monthlyAdBudget !== undefined ||
    economics.targetCac !== undefined ||
    economics.currentCac !== undefined
  ) {
    implications.push(
      [
        economics.monthlyAdBudget ?? "unknown media budget",
        economics.targetCac ?? "unknown target CAC",
        economics.currentCac ?? "unknown current CAC",
        "sets the paid-learning efficiency boundary",
      ].join(" + "),
    );
  }

  if (
    economics.visitorToSignup !== undefined ||
    economics.signupToActivation !== undefined ||
    economics.activationToPaid !== undefined ||
    economics.demoToClose !== undefined
  ) {
    implications.push(
      [
        "funnel rates",
        [
          economics.visitorToSignup,
          economics.signupToActivation,
          economics.activationToPaid,
          economics.demoToClose,
        ]
          .filter((value): value is string => value !== undefined)
          .join(" / "),
        "identify where messaging and offer proof must reduce friction",
      ].join(" "),
    );
  }

  if (
    economics.pricingModel !== undefined ||
    economics.pricingTiers !== undefined ||
    economics.targetPlan !== undefined
  ) {
    implications.push(
      [
        economics.pricingModel ?? "unknown pricing model",
        economics.targetPlan ?? "unknown target plan",
        "requires section claims to respect packaging and plan-level buying context",
      ].join(" + "),
    );
  }

  if (
    economics.monthlyRevenue !== undefined ||
    economics.avgLtv !== undefined ||
    economics.growthTrend !== undefined
  ) {
    implications.push(
      [
        economics.monthlyRevenue ?? "unknown revenue",
        economics.avgLtv ?? "unknown LTV",
        economics.growthTrend ?? "unknown growth trend",
        "sets the scale context for risk, urgency, and channel recommendations",
      ].join(" + "),
    );
  }

  return implications;
}

export function buildOnboardingStrategicFrame(
  researchInput: ResearchInput,
): string {
  const { onboarding } = researchInput;
  const lines = [
    `Primary objective: ${onboarding.primaryGoal}.`,
    `Target segments: ${joinList(onboarding.targetSegments) ?? "unknown"}.`,
    `Key offers: ${joinList(onboarding.keyOffers) ?? "unknown"}.`,
    `Distribution channels: ${
      joinList(onboarding.distributionChannels) ?? "unknown"
    }.`,
    onboarding.constraints.length === 0
      ? null
      : `Constraints: ${onboarding.constraints.join(", ")}.`,
    onboarding.gtmMotion === undefined
      ? null
      : `GTM motion: ${onboarding.gtmMotion}.`,
    onboarding.creativeCapacity === undefined
      ? null
      : `Creative capacity: ${onboarding.creativeCapacity}.`,
    onboarding.leadListAvailable === undefined
      ? null
      : `Lead list available: ${String(onboarding.leadListAvailable)}.`,
  ].filter((line): line is string => line !== null);
  const economics = onboarding.economics;

  if (economics !== undefined) {
    const economicsFields = [
      formatEconomicsField(economics, "pricingModel", "pricing model"),
      formatEconomicsField(economics, "conversionPath", "conversion path"),
      formatEconomicsField(economics, "acv", "ACV"),
      formatEconomicsField(economics, "pricingTiers", "pricing tiers"),
      formatEconomicsField(economics, "targetPlan", "target plan"),
      formatEconomicsField(economics, "avgLtv", "average LTV"),
      formatEconomicsField(economics, "targetCac", "target CAC"),
      formatEconomicsField(economics, "monthlyAdBudget", "monthly ad budget"),
      formatEconomicsField(economics, "budgetSplit", "budget split"),
      formatEconomicsField(economics, "currentCac", "current CAC"),
      formatEconomicsField(economics, "monthlyRevenue", "monthly revenue"),
      formatEconomicsField(economics, "avgSalesCycle", "sales cycle"),
      formatEconomicsField(economics, "visitorToSignup", "visitor to signup"),
      formatEconomicsField(
        economics,
        "signupToActivation",
        "signup to activation",
      ),
      formatEconomicsField(
        economics,
        "activationToPaid",
        "activation to paid",
      ),
      formatEconomicsField(economics, "demoToClose", "demo to close"),
      formatEconomicsField(economics, "growthTrend", "growth trend"),
    ].filter((field): field is string => field !== null);

    if (economicsFields.length > 0) {
      lines.push(`Economics signals: ${economicsFields.join("; ")}.`);
    }

    const implications = buildEconomicsImplications(economics);
    if (implications.length > 0) {
      lines.push(`Strategic implications: ${implications.join("; ")}.`);
    }
  }

  return lines.join("\n");
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
}): Omit<ResearchInput, "corpus" | "onboarding"> & {
  onboardingStrategicFrame: string;
  corpus: { excerpts: ResearchInput["corpus"]["excerpts"] };
} {
  const sectionId = resolvePromptSectionId(definition);
  const sectionExcerpts =
    sectionId === null
      ? undefined
      : researchInput.corpus.sectionExcerpts?.[sectionId];
  const { corpus: _corpus, onboarding: _onboarding, ...promptInput } =
    researchInput;

  return {
    ...promptInput,
    onboardingStrategicFrame: buildOnboardingStrategicFrame(researchInput),
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

function buildStrategicDepthMinimumGuidance(
  definition: PromptSectionDefinition,
): string[] {
  const coreSections = new Set([
    "MarketCategorySectionOutput",
    "CompetitorLandscapeSectionOutput",
    "BuyerICPSectionOutput",
    "VoiceOfCustomerSectionOutput",
    "DemandIntentSectionOutput",
    "OfferDiagnosticSectionOutput",
  ]);

  const schemaName = definition.sectionOutputSchemaName;

  if (schemaName === undefined || !coreSections.has(schemaName)) {
    return [];
  }

  const common = [
    "- Strategic depth fields: `body.strategicInsight` is required with `strategicVerdict`, `nonObviousRead`, `secondOrderImplication`, and `keyTension { tension, side, costOfPosition }`.",
    "- Strategic depth fields must be specific strategic judgments or `evidence gap: <missing signal>`; do not restate verdict/statusSummary or summarize the section.",
  ];

  if (schemaName === "MarketCategorySectionOutput") {
    return [
      ...common,
      "- MarketCategorySectionOutput strategic field: `body.categoryPowerBet { bet, whyNow, riskAccepted }` must name the category-power bet and the cost accepted.",
    ];
  }

  if (schemaName === "CompetitorLandscapeSectionOutput") {
    return [
      ...common,
      "- CompetitorLandscapeSectionOutput strategic fields: `body.whereToAttackVsConcede { attack, concede, rationale }` and `body.incumbentBlindSpot { incumbent, blindSpot, whyTheyMissIt }` are required.",
      "- CompetitorLandscapeSectionOutput strategic repair: `body.incumbentBlindSpot.incumbent` must name the incumbent/status-quo and the buyer pain or positioning miss as a full strategic judgment; it must not be only a competitor name, category label, or section summary. If the fetched evidence does not support that judgment, write exactly `evidence gap: <missing incumbent/status-quo signal>`.",
    ];
  }

  if (schemaName === "VoiceOfCustomerSectionOutput") {
    return [
      ...common,
      "- VoiceOfCustomerSectionOutput strategic field: `body.fourForcesBalanceVerdict { push, pull, anxiety, habit, balanceVerdict }` is required and must make the Four-Forces balance explicit.",
    ];
  }

  if (schemaName === "DemandIntentSectionOutput") {
    return [
      ...common,
      "- DemandIntentSectionOutput strategic fields: `body.orderedMoves[]` requires at least two sequenced moves with consecutive `rank` values, backward-only `dependsOn` rank references, and `rationale`; `body.provesWrongIf { metric, threshold, window }` is required.",
    ];
  }

  if (schemaName === "OfferDiagnosticSectionOutput") {
    return [
      ...common,
      "- OfferDiagnosticSectionOutput strategic fields: `body.singleBindingConstraint { constraint, whyBinding, unlockCondition }`, `body.orderedMoves[]`, and `body.provesWrongIf { metric, threshold, window }` are required.",
    ];
  }

  return common;
}

function buildSectionMinimumGuidance(
  definition: PromptSectionDefinition,
): string[] {
  if (definition.sectionOutputSchemaName === "MarketCategorySectionOutput") {
    return [
      ...buildStrategicDepthMinimumGuidance(definition),
      "- MarketCategorySectionOutput minimums: top-level `sources` must include at least three Section-level sources.",
      "- MarketCategorySectionOutput minimums: `body.categoryDefinition.adjacentCategories` must include at least two categories buyers confuse this with.",
      "- MarketCategorySectionOutput minimums: `body.marketSize.signals` must include at least three public trajectory signals with unique `signalType` values.",
      "- MarketCategorySectionOutput minimums: `body.marketSize.signals` must include at least one `top-down` and one `bottom-up` methodology.",
      "- MarketCategorySectionOutput exact contract: `body.marketSize.bottomUpTam.recipeName` must be `keyword-demand-reachable-revenue`; `inputs[]` must include exactly one each for `keyword-volume`, `commercial-intent-share`, `conversion-rate`, and `acv`.",
      "- MarketCategorySectionOutput bottom-up TAM: use `monthly keyword volume x 12 x commercial-intent share x conversion rate x ACV`; sourced inputs require `sourceUrl`, and unavailable inputs must use `status: \"evidence-gap\"` with `value` beginning `evidence gap:`. Do not substitute analyst TAM for the bottom-up recipe.",
      "- MarketCategorySectionOutput minimums: `body.structuralForces.forces` must include exactly one `regulation`, one `platform-shift`, and one `buyer-behavior` forceType.",
      "- MarketCategorySectionOutput minimums: `body.categoryMaturity.classification.supportingSignals` must include at least two maturity signals.",
    ];
  }

  if (definition.sectionOutputSchemaName === "CompetitorLandscapeSectionOutput") {
    return [
      ...buildStrategicDepthMinimumGuidance(definition),
      "- CompetitorLandscapeSectionOutput minimums: top-level `sources` must include at least five distinct cited Section-level source URLs.",
      "- CompetitorLandscapeSectionOutput grounding: cite only competitor URLs and numeric pricing/deal values that appear in fetched tool evidence, the evidence transcript, pre-normalized live ad evidence, or ResearchInput/corpus; if the source was not fetched, mark it as an evidence gap instead of asserting the URL or number.",
      "- CompetitorLandscapeSectionOutput minimums: `body.competitorSet.competitors` must include at least one `direct` and one `status-quo` competitor. Include `indirect` and `diy` competitors when public evidence names them; if a bucket has no credible evidence, name it as an evidence gap in prose instead of dropping or fabricating it.",
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
      ...buildStrategicDepthMinimumGuidance(definition),
      "- BuyerICPSectionOutput exact item contracts: `body.icpExistenceCheck.firmographicCuts[]` keys are `cutType`, `value`, optional `accountCount`, `source`, `sourceUrl`, `dateObserved`.",
      "- `cutType` must be one of `industry`, `employeeBands`, `revenueBands`, `geography`, `techStack`.",
      "- BuyerICPSectionOutput minimums: include at least three firmographic cuts with at least three distinct `cutType` values.",
      "- `body.personaReality.personas[]` keys are `name`, `title`, `company`, `sourceUrl`, `role`, `seniority`, optional `teamSize`, `evidence`.",
      "- `role` must be one of `champion`, `economic-buyer`, `decision-maker`, `influencer`, `end-user`, `gatekeeper`; include at least five personas.",
      "- `body.personaReality.personas[].name` must be a named person, public reviewer handle, or named source identity present in fetched evidence.",
      "- Each persona row is allowed only when the exact `name` string appears in fetched tool evidence or a corpus excerpt next to its company, title, source URL, or buyer role evidence.",
      "- Role labels, segments, departments, seniority labels, and company names do not satisfy `body.personaReality.personas[].name`.",
      "- Do not invent named people. If no named buyer identity exists in the fetched evidence, state an explicit evidence gap instead of padding persona rows.",
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
      ...buildStrategicDepthMinimumGuidance(definition),
      "- VoiceOfCustomerSectionOutput exact item contracts: `body.painLanguage.quotes[]` keys are `verbatimText`, `source`, `sourceUrl`, `painTheme`, `painIntensity`, plus optional `role` (reviewer role/handle) and `date` (when the source discloses it).",
      "- `source` must be one of `g2`, `reddit`, `hackernews`, `sales-call`, `support-thread`, `twitter`, `other`; `painIntensity` must be `high`, `medium`, or `low`.",
      "- VoiceOfCustomerSectionOutput minimums: top-level `sources` must include at least five distinct cited source URLs across independent domains; do not use the audited company's own domain as a VoC source.",
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
      ...buildStrategicDepthMinimumGuidance(definition),
      "- DemandIntentSectionOutput exact item contracts: `body.keywordDemand.keywords[]` keys are `keyword`, `monthlyVolume`, optional `monthlyVolumeValue`, optional `cpc`, optional `cpcValue`, optional `difficulty`, `intentType`, `top3RankingDomains`, `sourceTitle`, `sourceUrl`, `dateObserved`.",
      "- `intentType` must be one of `informational`, `commercial`, `transactional`, `navigational`; include at least ten keyword rows.",
      "- Put a falsifiable signal on every keyword row: call the `keyword_volume` tool (SpyFu) with your candidate keywords in ONE bulk call (up to 100) to get monthly search volume + CPC + difficulty. If `keyword_volume` returns a gap/rate-limit/no row, call `keyword_trends` (SearchAPI Google Trends) for a real relative-interest fallback.",
      "- Preserve display/provenance strings: keep `monthlyVolume` and optional `cpc` as reader-facing strings with provenance labels such as `320 (SpyFu-estimated)` and `$4.10 (SpyFu-estimated)`.",
      "- Numeric siblings are tool-derived only: when `keyword_volume` returns data for a keyword, set `monthlyVolumeValue` to `searchVolume`, `cpcValue` to `cpc`, and `difficulty` to `difficulty` as nonnegative numbers. If only `keyword_trends` returns data, omit numeric siblings and write `monthlyVolume` as a relative-interest string such as `relative interest 42/100 (SearchAPI Google Trends)`. Do not invent sortable numbers.",
      "- Provenance honesty is enforced: ONLY label `monthlyVolume`/`cpc` values 'SpyFu-estimated' when the `keyword_volume` tool returned data for that keyword. If SpyFu returns a gap, you MUST NOT claim SpyFu provenance and MUST NOT use model-estimated keyword economics — use `keyword_trends` or restate the row as a data gap. Never write `not disclosed` — it is rejected by the validator.",
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
      ...buildStrategicDepthMinimumGuidance(definition),
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
      "- Emit the lean 12-block body only: `campaignOverview`, `campaignPhases`, `audienceTypes`, `anglesToTest`, `creativeStrategy`, `creativeFramework`, `funnelIdeation`, `salesProcess`, `competitorMarketingInsights`, `competitorReviewInsights`, `channelSuggestions`, `kpis`, plus folded internal `crossSectionInsight`.",
      "- Do NOT emit `strategicThesis`, `contradictionReconciliation`, or `orderedMoves`; those capstone fields were removed and their reasoning now belongs inside `crossSectionInsight`.",
      "- Source sections are free strings but should snap to `positioningMarketCategory`, `positioningBuyerICP`, `positioningCompetitorLandscape`, `positioningVoiceOfCustomer`, `positioningDemandIntent`, `positioningOfferDiagnostic`, or `gtmBrief`.",
      "- `body.crossSectionInsight[]` carries 1-3 tensions that drove the plan; each item has `tension`, `sourceSections[]` (>=2 section ids), `implicationForPlan`, `clientBlindSpot`, `secondOrderRisk`, and `contrarianInversion`.",
      "- Paid-media money provenance fields are free strings; prefer `user-supplied`, `tool-measured`, `source-reported`, `model-estimated`, or `unknown`. Use `unknown` when the number cannot be tied to user input, tool measurement, source reporting, or an explicit scenario assumption.",
      "- Optional paid-media numeric siblings are machine-sortable numbers: `monthlyBudgetValue`, `dailySpendValue`, and `dailyBudgetValue`; add numeric siblings only when they come from user-supplied economics, tool-measured data, source-reported data, or explicit scenario assumptions with corresponding provenance.",
      "- Keep display strings and provenance fields. Numeric siblings must not duplicate provenance in strings; keep provenance in `monthlyBudgetProvenance`, `dailySpendProvenance`, and `dailyBudgetProvenance`.",
      "- Omit numeric siblings when the number is unknown or weakly inferred; use `model-estimated` only for explicit scenario assumptions.",
      "- If you emit `monthlyBudgetValue`, then `dailySpendValue * 30`, every `campaignPhases[].monthlyBudgetValue`, and the sum of `audienceTypes[].dailyBudgetValue * 30` should reconcile to `monthlyBudgetValue` within $5; otherwise omit the optional numeric sibling and keep only the display string/provenance.",
      "- `body.campaignOverview` keys are exactly `prose`, `monthlyBudget`, optional `monthlyBudgetValue`, `monthlyBudgetProvenance`, `totalMonths`, `phaseCount`, `dailySpend`, optional `dailySpendValue`, `dailySpendProvenance`, `primaryKpi`, `platform`.",
      "- PaidMediaPlanSectionOutput numeric fields are `totalMonths`, `phaseCount`, `staticCount`, `videoCount`, `totalPerAudience`, plus optional machine-sortable money siblings `monthlyBudgetValue`, `dailySpendValue`, and `dailyBudgetValue`; emit those as numbers.",
      "- PaidMediaPlanSectionOutput array fields must stay arrays. Budget, daily-spend, slot, and descriptive fields must be JSON strings.",
      "- `body.campaignPhases[]` has exactly 2 rows; each has `phaseName`, `monthsLabel`, `monthlyBudget`, optional `monthlyBudgetValue`, `monthlyBudgetProvenance`, and `bullets`.",
      "- `body.audienceTypes[]` has exactly 3 rows; each has `slot`, `archetype`, `dailyBudget`, optional `dailyBudgetValue`, `dailyBudgetProvenance`, `detail`, `sourceSection`, and `grounding`.",
      "- `body.anglesToTest[]` has exactly 4 distinct creative angles. Use diverse DR types across Problem-Aware, Mechanism-Led, Proof-Stacked, Enemy, Contrarian, Identity, and Comparison; no two angles should lean on the same lever.",
      "- Each angle row has `shortName`, `description`, free-string `angleType`, `sourceSection`, and exact `grounding` or `UNVERIFIED`.",
      "- `body.creativeStrategy` keys are exactly `prose`, `staticCount`, `videoCount`, `totalPerAudience`; use 5 static, 3 UGC, 8 total per audience.",
      "- `body.creativeFramework[]` has exactly 8 fixed slots: `PST 1`, `PST 2`, `PST 3`, `Objection 1`, `Objection 2`, `USP`, `Demo + Objection`, `Before / After`; each row has `label`, `angleType`, deployable `hook`, `executesAngle`, `sourceSection`, and `grounding`.",
      "- `body.funnelIdeation[]` has exactly 3 rows: `1 - PRIMARY`, `2 - SECONDARY`, `3 - TEST`; each row has `rank`, `name`, `description`, and `whatItProves`.",
      "- `body.salesProcess[]` should include Sales Process Overview, SDR Opt-In Flow, Personalization Playbook, and Loom Walkthrough rows; use empty `url` and explicit gap `note` when assets are absent.",
      "- `body.competitorMarketingInsights[]` has at least 2 rows with `competitor`, `messaging`, `adPlatforms`, `estSpendProvenance`, `icp`, `angles`, `positioning`, `offer`, `sourceSection`, and `grounding`; never invent spend.",
      "- `body.competitorReviewInsights[]` has exactly 3 rows with `complaint`, `howWeLeverage`, `sourceSection`, and `grounding`; never invent quotes.",
      "- `body.channelSuggestions[]` has exactly 4 rows for Website, Content / Organic, Other Ad Platforms, and Email / Nurture; verdict is free string but use one of `FIX`, `REWORK`, `REVIEW`, `KEEP`, `ADD`, `KILL`, `SCALE`.",
      "- `body.kpis[]` has exactly 3 rows: primary KPI, CTR, and CPL; each KPI has `metric`, `role`, and `definition`.",
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

export function buildStructuredBodyPrompt({
  definition,
  externalToolNames,
  normalizedAdEvidenceGroups,
  researchInput,
  skillMd,
  voiceOfCustomerCandidateBlock,
}: {
  definition: PromptSectionDefinition;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  researchInput: ResearchInput;
  skillMd: string;
  externalToolNames?: readonly string[];
  voiceOfCustomerCandidateBlock?: string;
}): string {
  const evidenceInstruction =
    externalToolNames !== undefined && externalToolNames.length === 0
      ? "No external research tools are available. Use the ResearchInput JSON, pre-normalized evidence blocks, and skill guidance only."
      : "Use the available tools for evidence gathering before finalizing the structured draft.";

  return [
    `Section ${definition.title}.`,
    `Mission: ${definition.mission}`,
    evidenceInstruction,
    "",
    ...buildCapabilityGapGuidance(definition, externalToolNames),
    "Skill analyst guidance:",
    skillMd,
    "",
    ...buildNormalizedAdEvidenceBlock(normalizedAdEvidenceGroups),
    ...(voiceOfCustomerCandidateBlock === undefined
      ? []
      : [voiceOfCustomerCandidateBlock, ""]),
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
    "- Satisfy the section-specific body schema and minimum validator.",
    "- Author verdict and statusSummary as distinct, purpose-built reader copy.",
    "- Use real source URLs from tool evidence and ResearchInput.",
    "- For Competitor Landscape ad evidence, use pre-normalized live ad evidence only.",
    ...buildSectionMinimumGuidance(definition),
    "- Do not state a confidence figure in verdict, statusSummary, or any body prose.",
    "",
    buildStructuredDraftShapeGuidance(),
    buildSectionObjectiveRecap(definition, researchInput),
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

function buildIssueSpecificRepairGuidance(
  definition: PromptSectionDefinition,
  issues: readonly string[],
): string[] {
  const hasBuyerICPPersonaNameIssue =
    definition.sectionOutputSchemaName === "BuyerICPSectionOutput" &&
    issues.some((issue) =>
      /^body\.personaReality\.personas\[\d+\]\.name:/.test(issue),
    );

  if (!hasBuyerICPPersonaNameIssue) {
    return [];
  }

  return [
    "",
    "BuyerICP persona-name repair:",
    "- Replace invalid persona rows only with another exact identity observed in fetched tool evidence or the ResearchInput/corpus.",
    "- Never repair by copying `title`, `role`, `seniority`, `company`, `targetCustomer`, or `targetSegments` into `name`.",
    "- If you cannot find enough exact named identities, keep the evidence gap explicit instead of padding with generic persona labels.",
  ];
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
    ...buildIssueSpecificRepairGuidance(definition, issues),
    "",
    "Previous output JSON:",
    JSON.stringify(previousOutput),
  ].join("\n");
}

export function buildStructuredBodyRepairPrompt({
  definition,
  evidenceTranscript,
  externalToolNames,
  issues,
  normalizedAdEvidenceGroups,
  previousOutput,
  researchInput,
  skillMd,
  voiceOfCustomerCandidateBlock,
}: {
  definition: PromptSectionDefinition;
  evidenceTranscript: string;
  issues: string[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  previousOutput: unknown;
  researchInput: ResearchInput;
  skillMd: string;
  externalToolNames?: readonly string[];
  voiceOfCustomerCandidateBlock?: string;
}): string {
  return [
    buildStructuredBodyPrompt({
      definition,
      externalToolNames,
      normalizedAdEvidenceGroups,
      researchInput,
      skillMd,
      voiceOfCustomerCandidateBlock,
    }),
    "",
    "Evidence from the previous streamed attempt:",
    evidenceTranscript,
    "",
    "The previous output failed validation. Return a corrected structured draft object with verdict, statusSummary, and body.",
    "If full-envelope fields were included, remove sectionTitle, confidence, and sources while preserving verdict, statusSummary, and section body keys inside body.",
    "Validation issues:",
    issues.map((issue) => `- ${issue}`).join("\n"),
    ...buildIssueSpecificRepairGuidance(definition, issues),
    "",
    "Previous draft JSON:",
    JSON.stringify(previousOutput),
  ].join("\n");
}
