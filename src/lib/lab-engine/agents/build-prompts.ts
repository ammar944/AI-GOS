import type { ResearchInput } from "../artifacts/artifact-envelope";
import type { CompetitorAdEvidenceGroup } from "../artifacts/schemas/competitor-landscape";
import type { SectionId } from "../events/activity-event";
import { buildChannelPolicyPromptLines } from "../sections/channel-policy";
import {
  SECTION_REGISTRY,
  isSupportedSectionId,
} from "../sections/section-registry";
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
  // P4: owned by the SectionDefinition descriptor. Optional here because
  // prompt-definition literals (and the registry fallback below) may omit them.
  strategicDepthGuidance?: readonly string[];
  promptMinimumGuidance?: readonly string[];
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
  identityBasis: string | null;
  landingUrl: string | null;
  platform: string;
  sourceUrl: string;
  verified: boolean | null;
}

interface CompactAdEvidenceGroup {
  advertiserName: string;
  dataGaps: CompetitorAdEvidenceGroup["dataGaps"];
  displayableCounts: CompetitorAdEvidenceGroup["displayableCounts"];
  identityConfidence: CompetitorAdEvidenceGroup["identityConfidence"] | null;
  platforms: CompetitorAdEvidenceGroup["platforms"];
  quarantinedCount: number;
  rawCounts: CompetitorAdEvidenceGroup["rawCounts"];
  returnedCreativeCount: number;
  sampleCreatives: CompactAdEvidenceCreative[];
  sourceErrors: CompetitorAdEvidenceGroup["sourceErrors"];
  verifiedCount: number;
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
    "Name the gap in section prose as missing MARKET evidence using the format `evidence gap: <missing market evidence>` (e.g. `evidence gap: no public pricing found for X`) — never name tools, credentials, budgets, rate limits, prepass mechanics, or internal stage names in section prose; tool diagnostics belong only in structured gap fields.",
    "Continue producing the best honest artifact from the evidence that remains.",
    ...buildCapabilityGapToolHints(definition),
    "",
    "Budget note:",
    "`web_search` and SDK tools share the generic `maxExternalLookups` pool. Competitor Landscape also receives an additive reserved ad-tool pool for `adlibrary`, `google_ads`, `meta_ads`, and `linkedin_ads`; other sections should assume only the shared generic pool.",
    `When a tool call is rejected because the applicable pool is exhausted, treat the returned \`budget_exhausted\` gap as evidence that the surface was capped by section budget — do not narrate this in prose, and never read it as ${getCapabilityGapSignalLabel(definition)}.`,
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

export function buildClientIdentityPin(researchInput: ResearchInput): string {
  const companyName = researchInput.company.name.trim();
  const websiteUrl = researchInput.company.websiteUrl.trim();

  return `CLIENT = ${companyName} (${websiteUrl}). Every verdict, recommendation, and budget directive in this artifact is advice TO ${companyName} about its own go-to-market. Never write advice for a competitor of ${companyName} or for a hypothetical entrant attacking ${companyName}.`;
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
    "Quarantine-tier creatives are identity-unverified signals; prose must not present them as confirmed competitor advertising, and when `verifiedCount` is 0 prose must say so.",
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
    identityConfidence: group.identityConfidence ?? null,
    platforms: group.platforms,
    quarantinedCount:
      group.quarantinedCount ??
      group.creatives.filter((creative) => creative.verified === false).length,
    rawCounts: group.rawCounts,
    returnedCreativeCount: group.returnedCreativeCount,
    sampleCreatives: group.creatives.slice(0, 2).map((creative) => ({
      body: creative.body,
      headline: creative.headline,
      identityBasis: creative.identityBasis ?? null,
      landingUrl: creative.landingUrl,
      platform: creative.platform,
      sourceUrl: creative.sourceUrl,
      verified: creative.verified ?? null,
    })),
    sourceErrors: group.sourceErrors,
    verifiedCount:
      group.verifiedCount ??
      group.creatives.filter((creative) => creative.verified === true).length,
  }));
}

// P4: the per-section minimum-guidance now lives on the SectionDefinition
// descriptor. Prompt-definition literals (tests, non-registry callers) may omit
// it, so resolve the owning registry entry by id/schemaName as a fallback.
function registrySectionGuidance(definition: PromptSectionDefinition) {
  const id = resolvePromptSectionId(definition);
  return id !== null && isSupportedSectionId(id)
    ? SECTION_REGISTRY[id]
    : undefined;
}

export function buildStrategicDepthMinimumGuidance(
  definition: PromptSectionDefinition,
): string[] {
  const guidance =
    definition.strategicDepthGuidance ??
    registrySectionGuidance(definition)?.strategicDepthGuidance ??
    [];
  return [...guidance];
}

export function buildSectionMinimumGuidance(
  definition: PromptSectionDefinition,
): string[] {
  const minimums =
    definition.promptMinimumGuidance ??
    registrySectionGuidance(definition)?.promptMinimumGuidance ??
    [];
  return [...buildStrategicDepthMinimumGuidance(definition), ...minimums];
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
    ...buildChannelPolicyPromptLines(definition, researchInput),
    ...buildProjectedResultsPromptLines(definition),
    "Skill analyst guidance:",
    skillMd,
    "",
    "Evidence from the loop:",
    evidenceTranscript,
    "",
    ...buildNormalizedAdEvidenceBlock(normalizedAdEvidenceGroups),
    buildClientIdentityPin(researchInput),
    "",
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

// SOP projected-results table instruction (W3) — rides alongside the binding
// channel-policy block in all three prompt builders; the repair prompt
// inherits it through buildStructuredBodyPrompt.
function buildProjectedResultsPromptLines(definition: {
  sectionOutputSchemaName?: string;
}): string[] {
  if (definition.sectionOutputSchemaName !== "PaidMediaPlanSectionOutput") {
    return [];
  }

  return [
    "SOP PROJECTED-RESULTS TABLE (body.projectedResults, at least 1 row):",
    "- One row per target ICP x campaign phase: targetIcp, kpi (the unit being bought, e.g. MQL/SQL/demo), kpiCostValue + kpiCostProvenance, objective, durationLabel, phaseMonthlyBudgetValue + phaseMonthlyBudgetProvenance, sourceSection.",
    "- NEVER compute projectedCountValue, projectedCountProvenance, or marginOfErrorPercent — the runner computes the count as floor(budget / KPI cost) at +/-20% and overwrites any model math.",
    '- KPI cost unknown? Set kpiCostProvenance to "unknown" and omit kpiCostValue — the row ships without a count rather than an invented one.',
    "",
  ];
}

export function buildStructuredBodyPrompt({
  brandedKeywordCandidateBlock,
  buyerPersonaCandidateBlock,
  competitorReviewCandidateBlock,
  definition,
  externalToolNames,
  normalizedAdEvidenceGroups,
  researchInput,
  skillMd,
  voiceOfCustomerCandidateBlock,
}: {
  brandedKeywordCandidateBlock?: string;
  buyerPersonaCandidateBlock?: string;
  competitorReviewCandidateBlock?: string;
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
    ...buildChannelPolicyPromptLines(definition, researchInput),
    ...buildProjectedResultsPromptLines(definition),
    "Skill analyst guidance:",
    skillMd,
    "",
    ...buildNormalizedAdEvidenceBlock(normalizedAdEvidenceGroups),
    ...(voiceOfCustomerCandidateBlock === undefined
      ? []
      : [voiceOfCustomerCandidateBlock, ""]),
    ...(buyerPersonaCandidateBlock === undefined
      ? []
      : [buyerPersonaCandidateBlock, ""]),
    ...(brandedKeywordCandidateBlock === undefined
      ? []
      : [brandedKeywordCandidateBlock, ""]),
    ...(competitorReviewCandidateBlock === undefined
      ? []
      : [competitorReviewCandidateBlock, ""]),
    buildClientIdentityPin(researchInput),
    "",
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
    buildClientIdentityPin(researchInput),
    "",
    "ResearchInput JSON:",
    JSON.stringify(buildResearchInputForPrompt({ definition, researchInput })),
    "",
    ...buildNormalizedAdEvidenceBlock(normalizedAdEvidenceGroups),
    ...buildCapabilityGapGuidance(definition, options.externalToolNames),
    ...buildChannelPolicyPromptLines(definition, researchInput),
    ...buildProjectedResultsPromptLines(definition),
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
  externalToolNames,
}: {
  definition: PromptSectionDefinition;
  evidenceTranscript: string;
  issues: string[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  previousOutput: unknown;
  researchInput: ResearchInput;
  // Accepted for call-site compatibility; the repair prompt intentionally does
  // NOT re-inject the multi-thousand-char skill body (token waste) — the live
  // answer-tool path already carries it in the attempt instructions.
  skillMd?: string;
  externalToolNames?: readonly string[];
}): string {
  return [
    buildStructuredPrompt({
      definition,
      evidenceTranscript,
      externalToolNames,
      normalizedAdEvidenceGroups,
      researchInput,
      skillMd:
        "Apply the section skill rubric you were given in the first attempt — it is already in your context.",
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
  brandedKeywordCandidateBlock,
  buyerPersonaCandidateBlock,
  competitorReviewCandidateBlock,
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
  brandedKeywordCandidateBlock?: string;
  buyerPersonaCandidateBlock?: string;
  competitorReviewCandidateBlock?: string;
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
      brandedKeywordCandidateBlock,
      buyerPersonaCandidateBlock,
      competitorReviewCandidateBlock,
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
