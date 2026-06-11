import { randomUUID } from "node:crypto";

import type { Tool, ToolExecutionOptions } from "ai";
import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
  type CompetitorAd,
  type ResearchInput,
  type VerificationReportEnvelope,
} from "../artifacts/artifact-envelope";
import {
  getRegistrableDomain,
  getRegistrableDomainBrandToken,
  isSameRegistrableDomain,
  normalizeBrandToken,
} from "../domain-utils";
import {
  isLikelyNamedBuyerIdentity,
  type BuyerICPBody,
} from "../artifacts/schemas/buyer-icp";
import type { CompetitorAdEvidenceGroup } from "../artifacts/schemas/competitor-landscape";
import { adCreativeFingerprint } from "../artifacts/schemas/competitor-landscape";
import {
  normalizePaidMediaPlanBody,
} from "../artifacts/schemas/paid-media-plan";
import {
  checkDemandIntentKeywordProvenance,
  softenDemandIntentForSpyFuToolGap,
  type DemandIntentBody,
} from "../artifacts/schemas/demand-intent";
import { buildOfferDiagnosticEvidenceGapBody } from "../artifacts/schemas/offer-diagnostic";
import {
  classifyVoiceOfCustomerEvidenceGap,
  checkVoiceOfCustomerSelfSourcing,
  type VoiceOfCustomerEvidenceGapClassification,
} from "../artifacts/schemas/voice-of-customer";
import {
  sectionRunnerModel,
  type SectionLanguageModel,
} from "../ai/models";
import {
  activityEventSchema,
  type ActivityEvent,
  type SectionId,
} from "../events/activity-event";
import {
  SECTION_REGISTRY,
  isSupportedSectionId,
  type SectionOutput,
  type SupportedSectionId,
} from "../sections/section-registry";
import {
  checkRequiredEvidenceClasses,
  RequiredEvidenceMissingError,
  type RequiredEvidenceClass,
} from "../sections/required-evidence";
import {
  evaluateCommittableAttempt,
  type HookOutcome,
  type PostRequiredEvidenceHookContext,
} from "../sections/committable-gate";
import {
  checkPaidMediaChannelPolicy,
  deriveChannelPolicy,
  type PaidMediaPolicyCheckBody,
} from "../sections/channel-policy";
import { getSectionSubSections } from "../sections/sub-sections";
import type { RunStore } from "../runs/run-store";
import {
  buildAnswerToolInstructions,
  buildSectionObjectiveRecap,
  buildEvidenceTranscript,
  buildRepairPrompt,
  buildStructuredBodyPrompt,
  buildStructuredBodyRepairPrompt,
  buildStructuredPrompt,
  shortenForEvent,
} from "./build-prompts";
import {
  createAnswerTool,
  getAnswerToolInputSchemaMode,
} from "./answer-tool";
import {
  defaultAnswerToolRunner,
  defaultAnswerToolStreamer,
  defaultEvidencePassRunner,
  defaultEvidenceStreamRunner,
  defaultStructuredCaller,
  defaultStructuredStreamer,
  type AgentStep,
  type AnswerToolRunner,
  type AnswerToolStreamer,
  type EvidencePassRunner,
  type EvidenceStreamRunner,
  type StructuredCaller,
  type StructuredStreamer,
} from "./section-agent";
import {
  defaultSectionWriterPassRunner,
  type SectionWriterPassRunner,
} from "./writer-pass";
import { createLabSectionTelemetry } from "./telemetry";
import { consumePartialsUntilAbort } from "./consume-partials";
import { createFixtureTools } from "./section-tools";
import { SectionToolBudget, ToolBudget } from "./budget";
import { buildToolMap } from "./tool-registry";
import {
  VOC_CANDIDATE_PACK_MAX_SIZE,
  VOC_PREPASS_MAX_LOOKUPS,
  VOC_PREPASS_REVIEW_BODY_MAX_PAGES,
  acquisitionModeForEvidenceKind,
  createVoiceOfCustomerCandidate,
  formatVoiceOfCustomerCandidateBlock,
  inferVoiceOfCustomerEvidenceKind,
  selectVoiceOfCustomerCandidates,
  type VoiceOfCustomerCandidate,
  type VoiceOfCustomerCandidateResult,
  type VoiceOfCustomerAcquisitionMode,
  type VoiceOfCustomerEvidenceKind,
  type VoiceOfCustomerCandidateSource,
} from "./voice-of-customer-candidates";
import {
  acquireVoiceOfCustomerClassCandidates,
  createEmptyVoiceOfCustomerClassCandidates,
  formatVoiceOfCustomerClassCandidateBlock,
  type VoiceOfCustomerClassCandidates,
} from "./voice-of-customer-class-acquisition";
import {
  buildVoiceOfCustomerAcquisitionLedger,
  type VoiceOfCustomerAcquisitionAttempt,
  type VoiceOfCustomerAcquisitionAttemptWithQuery,
  type VoiceOfCustomerAcquisitionLedgerRow,
} from "./voice-of-customer-acquisition-ledger";
import { synthesizeVoiceOfCustomerFromCandidates } from "./voice-of-customer-synthesis";
import {
  VOC_MIN_DOMAINS,
  VOC_MIN_QUOTES,
} from "../artifacts/voice-of-customer-floors";
import { ToolGapSchema, type ToolGap } from "./tools/_shared";
import { perplexityResearchAgentTool } from "./tools/perplexity-research";
import {
  acquireBuyerPersonaCandidates,
  deriveVendorSourced,
  formatBuyerPersonaCandidateBlock,
  type BuyerPersonaCandidate,
} from "./buyer-persona-acquisition";
import {
  cleanAdvertiserQuery,
  extractCompanyFromDomain,
  isAdvertiserMatch,
} from "./tools/advertiser-match";
import {
  buildCompetitorAdEvidenceGroups,
  buildEmptyCompetitorAdEvidenceGapGroup,
  summarizeCompetitorAdEvidenceGroups,
  textReconcilesWithCompetitorAdTopicContext,
} from "./tools/competitor-ad-adapter";
import { fetchSearchApiOrganicResults } from "./tools/searchapi-organic";
import { fetchVerifiedMetaPageAds } from "./tools/adlibrary";
import {
  normalizeForeplayAd,
  type NormalizedAd as NormalizedForeplayAd,
} from "./tools/foreplay-normalize";
import {
  createForeplayService,
  isForeplayEnabled,
} from "@/lib/foreplay/service";
import type { ToolName } from "./tools/index";
import type { RunSectionStreamWriter } from "../streaming/run-section-ui-message";
import {
  deriveGroundedConfidence,
  getMaxUnsupportedAllowed,
  redactUnsupportedNumericClaims,
  stripModelAuthoredVerifiedMarkers,
  stripMisattributedQuoteAttributions,
  type EvidenceSupportShortfall,
  type LoadBearingClaimKind,
  type StrippedNumericClaim,
  type StrippedQuoteAttribution,
} from "./verification/evidence-support";
import {
  dropConfessedExemplarQuotes,
  stripUngroundedNamedEntityMetrics,
  type StrippedNamedEntityMetric,
} from "./verification/creative-truth-gate";
import {
  keywordTrendKeywords,
  keywordVolumeKeywords,
} from "./run-section-keyword-results";
// Re-export the keyword-result helpers from their new home so external
// consumers (keyword-volume-succeeded.test.ts) keep importing from run-section.
export {
  keywordTrendKeywords,
  keywordTrendsSucceeded,
  keywordVolumeKeywords,
  keywordVolumeSucceeded,
} from "./run-section-keyword-results";
import {
  answerToolMaxAttempts,
  captureStructuredOutput,
  createForwardedAbortSignal,
  createTimeoutSignal,
  createToolExecutionOptions,
  getExecutableTool,
  hasExecutableTool,
  mapWithBoundedConcurrency,
  runAnswerToolWithStallGuard,
  withStructuredTimeout,
} from "./run-section-async-primitives";
import {
  collectStringValuesByKey,
  dedupeRecordArrayByStringKey,
  getHostname,
  getRecord,
  getSourceTitleFromUrl,
  getStringProperty,
  getUrlProperty,
  getValidHttpUrl,
  removeEmptyStringProperty,
} from "./record-helpers";
import {
  structuralVerifier,
} from "./verification/structural-verifier";
import {
  verifyPaidMediaPlan,
  type PaidMediaPlanVerificationResult,
  type VerifyPaidMediaPlanInput,
} from "./verification/claim-source-verifier";
import {
  createThrottledSectionPartialBroadcaster,
  type SectionPartialPublishFn,
  type SectionPartialSeqRef,
} from "@/lib/research-v2/section-partial-broadcaster";

export interface RunSectionInput {
  runId: string;
  sectionId: SupportedSectionId;
  signal?: AbortSignal;
  deadlineAt?: number;
}

export interface RunSectionDeps {
  store: RunStore;
  loadSkill: (slug: string) => Promise<string>;
  allowedTools?: readonly ToolName[];
  env?: Record<string, string | undefined>;
  runAnswerTool?: AnswerToolRunner;
  runEvidencePass?: EvidencePassRunner;
  runWriterPass?: SectionWriterPassRunner;
  callStructured?: StructuredCaller;
  streamStructured?: StructuredStreamer;
  verifyPaidMediaPlan?: (
    input: VerifyPaidMediaPlanInput,
  ) => Promise<PaidMediaPlanVerificationResult>;
  broadcastPartial?: SectionPartialPublishFn;
  now?: () => Date;
  newId?: () => string;
}

export interface RunSectionResult {
  runId: string;
  sectionId: SectionId;
  artifact: ArtifactEnvelope;
}

export interface StreamRunSectionDeps extends RunSectionDeps {
  streamAnswerTool?: AnswerToolStreamer;
  streamEvidencePass?: EvidenceStreamRunner;
  writer: RunSectionStreamWriter;
}

export class SectionRunnerError extends Error {
  public readonly runId: string;
  public readonly sectionId: SectionId;
  public readonly errors: string[];

  public constructor({
    errors,
    runId,
    sectionId,
  }: {
    errors: string[];
    runId: string;
    sectionId: SectionId;
  }) {
    super(
      `Section ${sectionId} failed for runId ${runId}: ${errors.join("; ")}`,
    );
    this.name = "SectionRunnerError";
    this.runId = runId;
    this.sectionId = sectionId;
    this.errors = errors;
  }
}

interface RuntimeSectionDefinition {
  id: SectionId;
  title: string;
  skillSlug: string;
  mission: string;
  outputEmphasis: readonly string[];
  sectionOutputSchemaName: string;
  structuredOutputMaxTokens?: number;
  allowedTools: readonly ToolName[];
  maxExternalLookups: number;
  adReservedLookups?: number;
  scrapeReservedLookups?: number;
  requiredEvidenceClasses: readonly RequiredEvidenceClass[];
  loadBearingKinds: readonly LoadBearingClaimKind[];
  strategicDepthGuidance: readonly string[];
  promptMinimumGuidance: readonly string[];
  bodySchema: z.ZodType<Record<string, unknown>>;
  sectionOutputSchema: z.ZodType<SectionOutput<Record<string, unknown>>>;
  validateMinimums: (
    artifact: ArtifactEnvelope & { body: Record<string, unknown> },
  ) => {
    ok: boolean;
    errors: string[];
  };
}

function getRuntimeSectionDefinition(
  sectionId: SupportedSectionId,
): RuntimeSectionDefinition {
  return SECTION_REGISTRY[sectionId] as unknown as RuntimeSectionDefinition;
}

function getNow(deps: RunSectionDeps): Date {
  return (deps.now ?? (() => new Date()))();
}

function getNewId(deps: RunSectionDeps): string {
  return (deps.newId ?? (() => randomUUID()))();
}

export const labSectionRepairFloorMs = 75_000;
export const labSectionEmitFloorMs = 20_000;
export const labSectionStructuredFallbackMinFloorMs = 120_000;

function getRemainingDeadlineMs(
  input: RunSectionInput,
  deps: RunSectionDeps,
): number | null {
  if (input.deadlineAt === undefined) {
    return null;
  }

  return Math.max(0, input.deadlineAt - getNow(deps).getTime());
}

function getDeadlineAwareModelTimeoutMs({
  deps,
  input,
  requestedMs,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  requestedMs: number;
}): number {
  const remainingMs = getRemainingDeadlineMs(input, deps);

  if (remainingMs === null) {
    return requestedMs;
  }

  return Math.max(1, Math.min(requestedMs, remainingMs - labSectionEmitFloorMs));
}

function canStartDeadlineFundedRepair(
  input: RunSectionInput,
  deps: RunSectionDeps,
): boolean {
  const remainingMs = getRemainingDeadlineMs(input, deps);

  return remainingMs === null || remainingMs >= labSectionRepairFloorMs;
}

function formatDeadlineRepairSkipIssue(
  input: RunSectionInput,
  deps: RunSectionDeps,
): string {
  const remainingMs = getRemainingDeadlineMs(input, deps);

  return [
    "deadline-aware salvage: skipped repair because remaining section budget",
    `${remainingMs ?? "unknown"}ms is below repair floor ${labSectionRepairFloorMs}ms`,
    `runId=${input.runId}`,
    `sectionId=${input.sectionId}`,
  ].join(" ");
}

function getStructuredFallbackFloorMs(sectionId: SectionId): number {
  return Math.max(
    labSectionStructuredFallbackMinFloorMs,
    getStructuredOutputTimeoutMs(sectionId) + labSectionEmitFloorMs,
  );
}

function createEvent({
  deps,
  message,
  metadata,
  runId,
  sectionId,
  type,
}: {
  deps: RunSectionDeps;
  runId: string;
  sectionId: SectionId;
  type: ActivityEvent["type"];
  message: string;
  metadata: ActivityEvent["metadata"];
}): ActivityEvent {
  return activityEventSchema.parse({
    id: getNewId(deps),
    runId,
    sectionId,
    type,
    message,
    createdAt: getNow(deps).toISOString(),
    metadata,
  });
}

async function appendEvent(
  deps: RunSectionDeps,
  runId: string,
  event: ActivityEvent,
): Promise<void> {
  await deps.store.appendEvent(runId, event);
}

function buildSubSectionCommittedEvents({
  artifact,
  deps,
  input,
}: {
  artifact: ArtifactEnvelope;
  deps: RunSectionDeps;
  input: RunSectionInput;
}): ActivityEvent[] {
  const bodyRecord = getRecord(artifact.body) ?? {};

  return getSectionSubSections(input.sectionId)
    .filter((subSection) => bodyRecord[subSection.key] !== undefined)
    .map((subSection) =>
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "sub-section-committed",
        message: `${subSection.label} committed`,
        metadata: {
          subSectionKey: subSection.key,
          status: "committed",
        },
      }),
    );
}

async function appendSubSectionCommittedEvents({
  artifact,
  deps,
  input,
}: {
  artifact: ArtifactEnvelope;
  deps: RunSectionDeps;
  input: RunSectionInput;
}): Promise<void> {
  for (const event of buildSubSectionCommittedEvents({ artifact, deps, input })) {
    await appendEvent(deps, input.runId, event);
  }
}

async function markSectionFailed({
  deps,
  errorMessage,
  runId,
  sectionId,
}: {
  deps: RunSectionDeps;
  runId: string;
  sectionId: SectionId;
  errorMessage: string;
}): Promise<void> {
  await deps.store.markSectionFailed(runId, sectionId, errorMessage);
}

function getErrorIssues(error: unknown): string[] {
  if (error instanceof Error) {
    return [error.message];
  }

  return [String(error)];
}

function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortOrTimeoutMessage(error: unknown): boolean {
  return describeErrorForLog(error).toLowerCase().includes("abort");
}

function hasTerminalStructuredError(errors: readonly string[]): boolean {
  return errors.some(
    (error) =>
      error.includes("Structured output timed out") ||
      error.includes("ended with finishReason=") ||
      error.toLowerCase().includes("abort"),
  );
}

function hasPaidMediaLengthFinishError(errors: readonly string[]): boolean {
  return errors.some((error) => error.includes("ended with finishReason=length"));
}

async function assertPaidMediaStructuredFinishReason({
  finishReason,
  input,
  outputTimeoutMs,
  schemaName,
}: {
  finishReason: PromiseLike<string> | undefined;
  input: RunSectionInput;
  outputTimeoutMs: number;
  schemaName: string;
}): Promise<void> {
  if (input.sectionId !== "positioningPaidMediaPlan" || finishReason === undefined) {
    return;
  }

  const reason = await withStructuredTimeout(Promise.resolve(finishReason), outputTimeoutMs);
  if (reason !== "stop") {
    throw new Error(
      `Structured output ${schemaName} ended with finishReason=${reason}.`,
    );
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function deriveSourceId(url: string, index: number): string {
  return `src_${slugify(url)}_${index + 1}`;
}

function buildEnvelope({
  definition,
  deps,
  input,
  output,
  verification,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  output: SectionOutput<Record<string, unknown>>;
  verification?: VerificationReportEnvelope;
}): ArtifactEnvelope {
  const observedAt = getNow(deps).toISOString();

  return artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      id: getNewId(deps),
      runId: input.runId,
      sectionId: input.sectionId,
      sectionTitle: output.sectionTitle,
      verdict: output.verdict,
      statusSummary: output.statusSummary,
      // Evidence-grounded confidence replaces the model's self-report (which is
      // uncorrelated with grounding). Falls back to the model value only when no
      // verification report is available (e.g. corpus-only paths).
      confidence:
        verification === undefined
          ? output.confidence
          : deriveGroundedConfidence(verification),
      sources: output.sources.map((source, index) => ({
        id: deriveSourceId(source.url, index),
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        observedAt,
      })),
      body: output.body,
      ...(verification === undefined ? {} : { verification }),
      createdAt: observedAt,
    });
}

type VoiceOfCustomerEvidenceGapFacts = Extract<
  VoiceOfCustomerEvidenceGapClassification,
  { ok: true }
>;

// Gap reports must quote the same shared floors the prepass, synthesis, and
// schema validator enforce (see artifacts/voice-of-customer-floors.ts).
const voiceOfCustomerRequiredPainQuoteCount = VOC_MIN_QUOTES;
const voiceOfCustomerRequiredDistinctPainSourceCount = VOC_MIN_DOMAINS;

function buildVoiceOfCustomerEvidenceGapBody({
  acquisitionAttempts,
  acquisitionLedger,
  facts,
  issue,
  subjectDomain,
}: {
  acquisitionAttempts?: readonly VoiceOfCustomerAcquisitionAttempt[];
  acquisitionLedger?: readonly VoiceOfCustomerAcquisitionLedgerRow[];
  facts: VoiceOfCustomerEvidenceGapFacts;
  issue: string;
  subjectDomain: string | null;
}): Record<string, unknown> {
  const observedDomains =
    facts.observedPainSourceDomains.length === 0
      ? "none"
      : facts.observedPainSourceDomains.join(", ");
  const summary = [
    "Evidence gap: independent Voice of Customer acquisition did not meet the committed evidence bar.",
    `Found ${facts.foundPainQuoteCount} usable pain-language candidate(s) across ${facts.foundDistinctPainSourceCount} independent source domain(s); required ${voiceOfCustomerRequiredPainQuoteCount} quotes across ${voiceOfCustomerRequiredDistinctPainSourceCount} domains.`,
    `Observed domains: ${observedDomains}.`,
    issue,
  ].join(" ");

  return {
    strategicInsight: {
      strategicVerdict:
        "evidence gap: independent Voice of Customer evidence did not clear the sourcing floor.",
      nonObviousRead:
        "evidence gap: no non-obvious buyer-language read can be promoted without enough independent sources.",
      secondOrderImplication:
        "evidence gap: downstream messaging should treat buyer-language claims as unproven until review/forum acquisition succeeds.",
      keyTension: {
        tension:
          "evidence gap: speed to synthesis conflicts with the independent-source bar for customer quotes.",
        side:
          "evidence gap: preserve truthfulness by shipping a sourcing gap instead of fabricated VoC.",
        costOfPosition:
          "evidence gap: the report loses buyer-language specificity until more independent sources are acquired.",
      },
    },
    fourForcesBalanceVerdict: {
      push:
        "evidence gap: buyer push forces were not sufficiently sourced from independent VoC.",
      pull:
        "evidence gap: buyer pull forces were not sufficiently sourced from independent VoC.",
      anxiety:
        "evidence gap: buyer anxiety forces were not sufficiently sourced from independent VoC.",
      habit:
        "evidence gap: buyer habit forces were not sufficiently sourced from independent VoC.",
      balanceVerdict:
        "evidence gap: Four-Forces balance cannot be scored until independent VoC acquisition clears the evidence bar.",
    },
    painLanguage: {
      prose: summary,
      quotes: [],
    },
    objections: {
      prose:
        "Objection language was not promoted because the run lacked enough independent customer-review or forum evidence.",
      items: [],
    },
    switchingStories: {
      prose:
        "Switching stories were not promoted because the available independent VoC surfaces were below the sourcing floor.",
      stories: [],
    },
    decisionCriteria: {
      prose:
        "Decision criteria were not promoted because the run could not corroborate buyer criteria from enough independent VoC sources.",
      criteria: [],
    },
    successLanguage: {
      prose:
        "Success language was not promoted because the run did not acquire enough independent customer after-state quotes.",
      quotes: [],
    },
    evidenceGap: true,
    evidenceGapReport: {
      reason: "insufficient_voice_of_customer_sources",
      summary,
      foundPainQuoteCount: facts.foundPainQuoteCount,
      requiredPainQuoteCount: voiceOfCustomerRequiredPainQuoteCount,
      foundDistinctPainSourceCount: facts.foundDistinctPainSourceCount,
      requiredDistinctPainSourceCount:
        voiceOfCustomerRequiredDistinctPainSourceCount,
      observedPainSourceDomains: facts.observedPainSourceDomains,
      ...(!acquisitionAttempts || acquisitionAttempts.length === 0
        ? {}
        : { acquisitionAttempts }),
      ...(!acquisitionLedger || acquisitionLedger.length === 0
        ? {}
        : { acquisitionLedger }),
      sourcingPlan: [
        "Recover full review bodies from approved third-party review surfaces such as G2, Capterra, Trustpilot, Reddit, Hacker News, or support/community threads.",
        "When a surfaced URL has no snippet, retry with Firecrawl only if the rendered page returns usable markdown; record JS-challenge or empty-body pages as acquisition gaps.",
        `Exclude the audited company domain (${subjectDomain ?? "unknown"}) and require at least three independent domains before promoting buyer pain language.`,
      ],
    },
  };
}

function buildVoiceOfCustomerEvidenceGapArtifact({
  acquisitionAttempts,
  acquisitionLedger,
  baseArtifact,
  definition,
  deps,
  facts,
  input,
  issue,
  researchInput,
}: {
  acquisitionAttempts?: readonly VoiceOfCustomerAcquisitionAttempt[];
  acquisitionLedger?: readonly VoiceOfCustomerAcquisitionLedgerRow[];
  baseArtifact?: ArtifactEnvelope;
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  facts: VoiceOfCustomerEvidenceGapFacts;
  input: RunSectionInput;
  issue: string;
  researchInput: ResearchInput;
}): ArtifactEnvelope {
  const observedAt = getNow(deps).toISOString();
  const subjectDomain = getRegistrableDomain(researchInput.company.websiteUrl);

  return artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      id: getNewId(deps),
      runId: input.runId,
      sectionId: input.sectionId,
      sectionTitle: definition.title,
      verdict:
        "Voice of Customer evidence is below the independent-source bar; treat this section as a sourcing gap, not buyer-language truth.",
      statusSummary:
        "The section completed with an evidence gap so downstream synthesis can proceed without fabricating customer quotes.",
      confidence: 0.2,
      sources: baseArtifact?.sources ?? researchInput.sources,
      body: buildVoiceOfCustomerEvidenceGapBody({
        acquisitionAttempts,
        acquisitionLedger,
        facts,
        issue,
        subjectDomain,
      }),
      createdAt: observedAt,
    });
}

function buildVoiceOfCustomerAttemptEvidenceGapArtifact({
  artifact,
  definition,
  deps,
  errors,
  input,
  researchInput,
}: {
  artifact: ArtifactEnvelope;
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  errors: readonly string[];
  input: RunSectionInput;
  researchInput: ResearchInput;
}): ArtifactEnvelope | undefined {
  if (input.sectionId !== "positioningVoiceOfCustomer") {
    return undefined;
  }

  const classification = classifyVoiceOfCustomerEvidenceGap({
    artifact,
    errors,
    subjectDomain: researchInput.company.websiteUrl,
  });

  if (!classification.ok) {
    return undefined;
  }

  return buildVoiceOfCustomerEvidenceGapArtifact({
    baseArtifact: artifact,
    definition,
    deps,
    facts: classification,
    input,
    issue: errors.join("; "),
    researchInput,
  });
}

const competitorStrategicTextErrorSuffix =
  ": must be a specific strategic judgment or write exactly `evidence gap: <missing signal>`, not a summary/restatement. Do not satisfy \"specific\" with numbers that are not in fetched evidence - unsupported numeric precision is treated as fabrication.";
const competitorStrategicEvidenceGapPaths = new Set([
  "body.whereToAttackVsConcede.attack",
  "body.whereToAttackVsConcede.concede",
  "body.whereToAttackVsConcede.rationale",
  "body.incumbentBlindSpot.incumbent",
  "body.incumbentBlindSpot.blindSpot",
  "body.incumbentBlindSpot.whyTheyMissIt",
]);

function parseCompetitorStrategicEvidenceGapPath(
  error: string,
): string | null {
  if (!error.endsWith(competitorStrategicTextErrorSuffix)) {
    return null;
  }

  const path = error.slice(0, -competitorStrategicTextErrorSuffix.length);
  return competitorStrategicEvidenceGapPaths.has(path) ? path : null;
}

function buildCompetitorStrategicEvidenceGapValue(path: string): string {
  return `evidence gap: ${path.replace(
    /^body\./,
    "",
  )} could not be upgraded into a source-backed strategic judgment from the fetched competitor evidence.`;
}

function withCompetitorStrategicEvidenceGapField({
  body,
  path,
}: {
  body: Record<string, unknown>;
  path: string;
}): Record<string, unknown> | null {
  const [, groupKey, fieldKey] = path.split(".");
  if (groupKey === undefined || fieldKey === undefined) {
    return null;
  }

  const group = getRecord(body[groupKey]);
  if (group === null) {
    return null;
  }

  return {
    ...body,
    [groupKey]: {
      ...group,
      [fieldKey]: buildCompetitorStrategicEvidenceGapValue(path),
    },
  };
}

function buildCompetitorStrategicEvidenceGapArtifact({
  artifact,
  definition,
  errors,
  input,
}: {
  artifact: ArtifactEnvelope;
  definition: RuntimeSectionDefinition;
  errors: readonly string[];
  input: RunSectionInput;
}): ArtifactEnvelope | undefined {
  if (input.sectionId !== "positioningCompetitorLandscape") {
    return undefined;
  }

  const failedPaths = errors.map(parseCompetitorStrategicEvidenceGapPath);
  if (failedPaths.length === 0 || failedPaths.some((path) => path === null)) {
    return undefined;
  }

  const originalBody = getRecord(artifact.body);
  if (originalBody === null) {
    return undefined;
  }

  let body: Record<string, unknown> | null = structuredClone(originalBody);
  for (const path of failedPaths) {
    if (path === null || body === null) {
      return undefined;
    }

    body = withCompetitorStrategicEvidenceGapField({ body, path });
  }

  if (body === null) {
    return undefined;
  }

  const candidate = artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      ...artifact,
      body,
    });
  const minimums = definition.validateMinimums(candidate);

  return minimums.ok ? candidate : undefined;
}

// T2b: OfferDiagnostic evidence-gap escape hatch. Mirrors the competitor builder
// — patch the failing strategic-text paths with evidence-gap strings, then
// re-validate minimums. Scoped to strategic-text/falsifiability paths only;
// structural failures (proof-point counts, bad move ranks) intentionally fall
// through to a hard fail because a rerun, not a gap string, is the fix.
function buildOfferDiagnosticEvidenceGapArtifact({
  artifact,
  definition,
  errors,
  input,
}: {
  artifact: ArtifactEnvelope;
  definition: RuntimeSectionDefinition;
  errors: readonly string[];
  input: RunSectionInput;
}): ArtifactEnvelope | undefined {
  if (input.sectionId !== "positioningOfferDiagnostic") {
    return undefined;
  }

  const originalBody = getRecord(artifact.body);
  if (originalBody === null) {
    return undefined;
  }

  const patchedBody = buildOfferDiagnosticEvidenceGapBody({
    body: originalBody,
    errors,
  });
  if (patchedBody === null) {
    return undefined;
  }

  const candidate = artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      ...artifact,
      body: patchedBody,
    });
  const minimums = definition.validateMinimums(candidate);

  return minimums.ok ? candidate : undefined;
}

function buildVoiceOfCustomerPrepassEvidenceGapArtifact({
  acquisitionAttempts,
  acquisitionLedger,
  definition,
  deps,
  input,
  issue,
  researchInput,
  result,
}: {
  acquisitionAttempts?: readonly VoiceOfCustomerAcquisitionAttempt[];
  acquisitionLedger?: readonly VoiceOfCustomerAcquisitionLedgerRow[];
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  issue: string;
  researchInput: ResearchInput;
  result: Exclude<VoiceOfCustomerCandidateResult, { ok: true }>;
}): ArtifactEnvelope {
  return buildVoiceOfCustomerEvidenceGapArtifact({
    acquisitionAttempts,
    acquisitionLedger,
    definition,
    deps,
    facts: getVoiceOfCustomerCandidateEvidenceGapFacts(result),
    input,
    issue,
    researchInput,
  });
}

function getVoiceOfCustomerCandidateEvidenceGapFacts(
  result: VoiceOfCustomerCandidateResult,
): VoiceOfCustomerEvidenceGapFacts {
  if (!result.ok) {
    return {
      ok: true,
      foundPainQuoteCount: result.gap.candidateCount,
      foundDistinctPainSourceCount: result.gap.domains.length,
      observedPainSourceDomains: result.gap.domains,
    };
  }

  return {
    ok: true,
    foundPainQuoteCount: result.pack.candidates.length,
    foundDistinctPainSourceCount: result.pack.domains.length,
    observedPainSourceDomains: result.pack.domains,
  };
}

const voiceOfCustomerModelAuthoredEvidenceGapIssue =
  "Voice of Customer structured synthesis returned a mixed model-authored gap; the runner must promote deterministic candidate synthesis or a runner-owned evidence-gap artifact instead of committing promoted content with body.evidenceGap=true.";

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function getVoiceOfCustomerModelAuthoredEvidenceGapIssue({
  artifact,
  input,
}: {
  artifact: ArtifactEnvelope;
  input: RunSectionInput;
}): string | null {
  if (input.sectionId !== "positioningVoiceOfCustomer") {
    return null;
  }

  const body = getRecord(artifact.body);
  if (body?.evidenceGap !== true) {
    return null;
  }

  const painLanguage = getRecord(body.painLanguage);
  const successLanguage = getRecord(body.successLanguage);
  const objections = getRecord(body.objections);
  const switchingStories = getRecord(body.switchingStories);
  const decisionCriteria = getRecord(body.decisionCriteria);
  const painQuoteCount = getArrayLength(painLanguage?.quotes);
  const successQuoteCount = getArrayLength(successLanguage?.quotes);
  const promotedContentCount =
    painQuoteCount +
    successQuoteCount +
    getArrayLength(objections?.items) +
    getArrayLength(switchingStories?.stories) +
    getArrayLength(decisionCriteria?.criteria);

  if (promotedContentCount === 0) {
    return null;
  }

  return [
    voiceOfCustomerModelAuthoredEvidenceGapIssue,
    `painQuoteCount=${painQuoteCount}`,
    `successQuoteCount=${successQuoteCount}`,
    `promotedContentCount=${promotedContentCount}`,
    `runId=${input.runId}`,
    `sectionId=${input.sectionId}`,
  ].join(" ");
}

function buildVoiceOfCustomerStructuredFailureEvidenceGapArtifact({
  definition,
  deps,
  errors,
  input,
  researchInput,
  voiceOfCustomerPrepass,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  errors: readonly string[];
  input: RunSectionInput;
  researchInput: ResearchInput;
  voiceOfCustomerPrepass:
    | Awaited<ReturnType<typeof buildVoiceOfCustomerCandidatePrepass>>
    | undefined;
}): ArtifactEnvelope | undefined {
  const prepass = voiceOfCustomerPrepass;
  if (
    prepass === undefined ||
    !hasVoiceOfCustomerStructuredSynthesisFailure({
      errors,
      input,
      voiceOfCustomerPrepass: prepass,
    })
  ) {
    return undefined;
  }

  const facts = getVoiceOfCustomerCandidateEvidenceGapFacts(
    prepass.result,
  );
  const isTimeout = hasTerminalStructuredError(errors);
  const issue = [
    isTimeout
      ? "Voice of Customer structured synthesis timed out before a source-backed artifact could be promoted."
      : "Voice of Customer structured synthesis failed to produce a parseable source-backed artifact before repair could be trusted.",
    `Structured attempt issues: ${errors.join("; ")}`,
  ].join(" ");

  return buildVoiceOfCustomerEvidenceGapArtifact({
    acquisitionAttempts: prepass.acquisitionAttempts,
    acquisitionLedger: prepass.acquisitionLedger,
    definition,
    deps,
    facts,
    input,
    issue,
    researchInput,
  });
}

function buildVoiceOfCustomerDeterministicSynthesisArtifact({
  definition,
  deps,
  errors,
  input,
  researchInput,
  voiceOfCustomerPrepass,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  errors: readonly string[];
  input: RunSectionInput;
  researchInput: ResearchInput;
  voiceOfCustomerPrepass:
    | Awaited<ReturnType<typeof buildVoiceOfCustomerCandidatePrepass>>
    | undefined;
}): ArtifactEnvelope | undefined {
  if (
    voiceOfCustomerPrepass === undefined ||
    !voiceOfCustomerPrepass.result.ok ||
    !hasVoiceOfCustomerStructuredSynthesisFailure({
      errors,
      input,
      voiceOfCustomerPrepass,
    })
  ) {
    return undefined;
  }

  const synthesis = synthesizeVoiceOfCustomerFromCandidates({
    candidateResult: voiceOfCustomerPrepass.result,
    now: () => getNow(deps),
    researchInput,
  });

  if (!synthesis.ok) {
    return undefined;
  }

  const output: SectionOutput<Record<string, unknown>> = {
    ...synthesis.output,
    body: synthesis.output.body as Record<string, unknown>,
  };
  const verification = verifySectionBody({
    body: output.body,
    evidenceSteps: voiceOfCustomerPrepass.steps,
    researchInput,
  });
  const artifact = buildEnvelope({
    definition,
    deps,
    input,
    output,
    verification,
  });
  const minimums = definition.validateMinimums(artifact);

  if (!minimums.ok) {
    return undefined;
  }

  const missingClass = checkRequiredEvidenceClasses({
    body: artifact.body,
    requiredEvidenceClasses: definition.requiredEvidenceClasses,
    sectionId: input.sectionId,
  });

  if (missingClass !== null) {
    return undefined;
  }

  const selfSourcing = checkVoiceOfCustomerSelfSourcing({
    artifact,
    subjectDomain: researchInput.company.websiteUrl,
  });

  return selfSourcing.ok ? artifact : undefined;
}

const buyerICPPersonaNameErrorPattern =
  /^body\.personaReality\.personas\[\d+\]\.name: must be a named person, public reviewer handle, or named source identity; generic role\/segment\/company labels do not qualify\.$/;
const buyerICPPersonaCountErrorPattern =
  /^body\.personaReality\.personas: have \d+, need >=3\.$/;
const buyerICPPersonaEvidenceGapReason = "insufficient_named_buyer_personas";
// Floor 3 (was 5) — kept in lockstep with validateBuyerICPMinimums.
const buyerICPRequiredNamedPersonaCount = 3;

function isBuyerICPPersonaEvidenceGapError(error: string): boolean {
  return (
    buyerICPPersonaNameErrorPattern.test(error) ||
    buyerICPPersonaCountErrorPattern.test(error)
  );
}

function isBuyerICPPersonaEvidenceGapFailure({
  errors,
  input,
}: {
  errors: readonly string[];
  input: RunSectionInput;
}): boolean {
  return (
    input.sectionId === "positioningBuyerICP" &&
    errors.length > 0 &&
    errors.every(isBuyerICPPersonaEvidenceGapError)
  );
}

function isNamedBuyerPersona(
  persona: BuyerICPBody["personaReality"]["personas"][number],
): boolean {
  return isLikelyNamedBuyerIdentity(persona.name, {
    company: persona.company,
    role: persona.role,
    seniority: persona.seniority,
    title: persona.title,
  });
}

function buildBuyerICPPersonaEvidenceGapArtifact({
  artifact,
  definition,
  errors,
  input,
}: {
  artifact: ArtifactEnvelope;
  definition: RuntimeSectionDefinition;
  errors: readonly string[];
  input: RunSectionInput;
}): ArtifactEnvelope | undefined {
  if (!isBuyerICPPersonaEvidenceGapFailure({ errors, input })) {
    return undefined;
  }

  const body = artifact.body as BuyerICPBody;
  const validPersonas = body.personaReality.personas.filter(isNamedBuyerPersona);
  const rejectedPersonaLabels = Array.from(
    new Set(
      body.personaReality.personas
        .filter((persona) => !isNamedBuyerPersona(persona))
        .map((persona) => persona.name.trim())
        .filter((name) => name.length > 0),
    ),
  );
  const summary = [
    "Evidence gap: public research did not clear the named BuyerICP persona bar.",
    `Found ${validPersonas.length} named buyer persona(s); required ${buyerICPRequiredNamedPersonaCount}.`,
    "Generic role, segment, seniority, and company labels were dropped instead of being promoted as persona proof.",
  ].join(" ");
  const candidate = artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      ...artifact,
      verdict:
        "Named BuyerICP persona proof is below the evidence bar; treat persona-specific targeting as unproven.",
      statusSummary:
        "The section completed with an evidence gap so downstream synthesis can proceed without fabricated buyer personas.",
      confidence: Math.min(artifact.confidence, 0.3),
      body: {
        ...body,
        personaReality: {
          ...body.personaReality,
          prose: `${summary} ${body.personaReality.prose}`,
          personas: validPersonas,
        },
        evidenceGap: true,
        evidenceGapReport: {
          reason: buyerICPPersonaEvidenceGapReason,
          summary,
          foundNamedPersonaCount: validPersonas.length,
          requiredNamedPersonaCount: buyerICPRequiredNamedPersonaCount,
          rejectedPersonaLabels,
          sourcingPlan: [
            "Recover named buyer identities from public case studies, review bylines, webinar speakers, conference rosters, customer stories, or first-party discovery calls.",
            "Keep title, company, source URL, role, seniority, and evidence for each promoted persona.",
            "Do not use role labels, segments, departments, seniority labels, or company names as persona names.",
          ],
        },
      },
    });
  const minimums = definition.validateMinimums(candidate);

  return minimums.ok ? candidate : undefined;
}

function hasVoiceOfCustomerStructuredSynthesisFailure({
  errors,
  input,
  voiceOfCustomerPrepass,
}: {
  errors: readonly string[];
  input: RunSectionInput;
  voiceOfCustomerPrepass:
    | Awaited<ReturnType<typeof buildVoiceOfCustomerCandidatePrepass>>
    | undefined;
}): boolean {
  if (
    input.sectionId !== "positioningVoiceOfCustomer" ||
    voiceOfCustomerPrepass === undefined
  ) {
    return false;
  }

  if (hasTerminalStructuredError(errors)) {
    return true;
  }

  return errors.some((error) => {
    const lowerError = error.toLowerCase();
    return (
      lowerError.includes("no object generated") ||
      lowerError.includes("agent did not call answer tool") ||
      lowerError.includes("model-authored gap") ||
      lowerError.includes("could not parse") ||
      lowerError.includes("response did not match schema")
    );
  });
}

function verifySectionBody({
  body,
  evidenceSteps,
  researchInput,
}: {
  body: unknown;
  evidenceSteps: readonly AgentStep[];
  researchInput: ResearchInput;
}): VerificationReportEnvelope {
  return structuralVerifier({
    body,
    toolResults: evidenceSteps.flatMap((step) => step.toolResults),
    corpusExcerpts: researchInput.corpus.excerpts,
    onboarding: researchInput.onboarding,
  });
}

function buildToolEvents({
  deps,
  runId,
  sectionId,
  step,
}: {
  deps: RunSectionDeps;
  runId: string;
  sectionId: SectionId;
  step: AgentStep;
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const toolCall of step.toolCalls) {
    const signalMetadata = buildToolSignalMetadata({
      input: toolCall.input,
      toolName: toolCall.toolName,
    });
    events.push(
      createEvent({
        deps,
        runId,
        sectionId,
        type: "tool-started",
        message: `${toolCall.toolName} started`,
        metadata: { toolName: toolCall.toolName, ...signalMetadata },
      }),
    );
  }

  for (const toolResult of step.toolResults) {
    const gap = parseToolGap(toolResult.output);
    const signalMetadata = buildToolSignalMetadata({
      input: toolResult.input,
      toolName: toolResult.toolName,
    });
    const metadata =
      gap === null
        ? {
            toolName: toolResult.toolName,
            ...signalMetadata,
            outputSummary: shortenForEvent(toolResult.output),
          }
        : {
            toolName: toolResult.toolName,
            ...signalMetadata,
            gap: buildGapMetadata(gap),
          };

    events.push(
      createEvent({
        deps,
        runId,
        sectionId,
        type: "tool-finished",
        message: `${toolResult.toolName} finished`,
        metadata,
      }),
    );
  }

  return events;
}

function writeSectionStatus({
  deps,
  message,
  runId,
  sectionId,
  status,
}: {
  deps: StreamRunSectionDeps;
  runId: string;
  sectionId: SectionId;
  status: "starting" | "running" | "validating" | "repairing" | "completed" | "failed";
  message: string;
}): void {
  deps.writer.write({
    type: "data-section-status",
    id: `${runId}-${sectionId}-status`,
    data: { runId, sectionId, status, message },
  });
}

function writeToolEvents({
  deps,
  events,
}: {
  deps: StreamRunSectionDeps;
  events: readonly ActivityEvent[];
}): void {
  for (const event of events) {
    if (
      event.type !== "tool-started" &&
      event.type !== "tool-finished"
    ) {
      continue;
    }

    const toolName = event.metadata.toolName;
    const gap =
      event.type === "tool-finished" ? event.metadata.gap : undefined;
    const outputSummary =
      event.type === "tool-finished"
        ? event.metadata.outputSummary
        : undefined;
    const state =
      event.type === "tool-started"
        ? "started"
        : gap === undefined
          ? "finished"
          : "gap";

    deps.writer.write({
      type: "data-tool-event",
      id: `${event.id}-tool-event`,
      data: {
        runId: event.runId,
        sectionId: event.sectionId,
        toolName,
        state,
        message: gap?.message ?? outputSummary ?? event.message,
      },
    });
  }
}

function writeValidationEvent({
  attempt,
  deps,
  issues,
  runId,
  sectionId,
  state,
}: {
  deps: StreamRunSectionDeps;
  runId: string;
  sectionId: SectionId;
  attempt: number;
  state: "started" | "failed" | "passed";
  issues: string[];
}): void {
  deps.writer.write({
    type: "data-validation-event",
    id: `${runId}-${sectionId}-validation-${attempt}-${state}`,
    data: { runId, sectionId, attempt, state, issues },
  });
}

function writeArtifactPartial({
  deps,
  partial,
  runId,
  sectionId,
}: {
  deps: StreamRunSectionDeps;
  runId: string;
  sectionId: SectionId;
  partial: unknown;
}): void {
  deps.writer.write({
    type: "data-artifact-partial",
    data: { runId, sectionId, partial },
  });
}

function writeArtifactFinal({
  artifactId,
  deps,
  runId,
  sectionId,
}: {
  deps: StreamRunSectionDeps;
  runId: string;
  sectionId: SectionId;
  artifactId: string;
}): void {
  deps.writer.write({
    type: "data-artifact-final",
    id: `${runId}-${sectionId}-artifact-final`,
    data: { runId, sectionId, artifactId },
  });
}

function parseToolGap(output: unknown): ToolGap | null {
  const result = ToolGapSchema.safeParse(output);
  return result.success ? result.data : null;
}

function buildGapMetadata(gap: ToolGap): {
  reason: ToolGap["reason"];
  envVar?: string;
  message?: string;
} {
  return {
    reason: gap.reason,
    envVar: gap.envVar,
    message: gap.message,
  };
}

function getAllowedTools(
  definition: RuntimeSectionDefinition,
  deps: RunSectionDeps,
): readonly ToolName[] {
  return deps.allowedTools ?? definition.allowedTools;
}

function buildRequiredToolSequence(
  allowedTools: readonly ToolName[],
): readonly string[] {
  const toolSequence = ["readResearchInput"];

  if (allowedTools.includes("web_search")) {
    toolSequence.push("web_search");
  }

  return toolSequence;
}

function getExternalToolNames(
  externalTools: Record<string, unknown>,
): readonly string[] {
  return Object.keys(externalTools).sort();
}

function buildAnswerToolPrompt({
  externalToolNames,
  input,
}: {
  input: RunSectionInput;
  externalToolNames: readonly string[];
}): string {
  const evidenceInstruction =
    externalToolNames.length === 0
      ? "No external research tools are available. Use the ResearchInput JSON and skill guidance only, then call answer with the complete section output."
      : "Use the available tools for evidence gathering, then call answer with the complete section output.";

  return [
    `RunId: ${input.runId}.`,
    `SectionId: ${input.sectionId}.`,
    evidenceInstruction,
  ].join(" ");
}

async function recordSectionFailure({
  definition,
  deps,
  errorMessage,
  failure,
  input,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  errorMessage: string;
  failure?: RequiredEvidenceMissingError;
}): Promise<void> {
  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "section-failed",
      message: `${definition.title} failed`,
      metadata: {
        error: errorMessage,
        ...(failure === undefined
          ? {}
          : {
              reason: "required_evidence_missing" as const,
              missingClass: failure.missingClass,
              unsupportedCount: failure.unsupportedCount,
              verifiedCount: failure.verifiedCount,
            }),
      },
    }),
  );
  await markSectionFailed({
    deps,
    errorMessage,
    runId: input.runId,
    sectionId: input.sectionId,
  });
}

async function saveCompletedArtifact({
  artifact,
  definition,
  deps,
  input,
  startedAt,
}: {
  artifact: ArtifactEnvelope;
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  startedAt: number;
}): Promise<RunSectionResult> {
  await appendSubSectionCommittedEvents({
    artifact,
    deps,
    input,
  });
  await deps.store.saveArtifact(input.runId, artifact);
  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "artifact-saved",
      message: `${definition.title} artifact saved`,
      metadata: { artifactId: artifact.id },
    }),
  );
  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "section-completed",
      message: `${definition.title} completed`,
      metadata: {
        sectionTitle: definition.title,
        durationMs: Math.max(0, getNow(deps).getTime() - startedAt),
      },
    }),
  );

  return {
    runId: input.runId,
    sectionId: input.sectionId,
    artifact,
  };
}

interface AttemptResult {
  output: SectionOutput<Record<string, unknown>> | null;
  artifact: ArtifactEnvelope | null;
  buyerICPEvidenceGapArtifact?: ArtifactEnvelope;
  competitorStrategicEvidenceGapArtifact?: ArtifactEnvelope;
  offerDiagnosticEvidenceGapArtifact?: ArtifactEnvelope;
  errors: string[];
  requiredEvidenceMissing?: RequiredEvidenceMissingError;
  evidenceSupportShortfall?: EvidenceSupportShortfall;
  voiceOfCustomerEvidenceGapArtifact?: ArtifactEnvelope;
}

function getAttemptRepairIssues(attempt: AttemptResult): string[] {
  return [
    ...attempt.errors,
    ...(attempt.evidenceSupportShortfall?.issues ?? []),
    ...(attempt.evidenceSupportShortfall?.provenanceFlags.map(
      (flag) => `provenance ${flag.reason}: ${flag.detail}`,
    ) ?? []),
  ];
}

function getAttemptEvidenceGapArtifact(
  attempt: AttemptResult,
): ArtifactEnvelope | undefined {
  return (
    attempt.buyerICPEvidenceGapArtifact ??
    attempt.voiceOfCustomerEvidenceGapArtifact ??
    attempt.competitorStrategicEvidenceGapArtifact ??
    attempt.offerDiagnosticEvidenceGapArtifact
  );
}

function getUnsupportedLoadBearingCount(attempt: AttemptResult): number {
  return attempt.evidenceSupportShortfall?.unsupportedLoadBearing.length ?? 0;
}

function getEvidenceGateFailureReason(
  attempt: AttemptResult,
  maxUnsupportedAllowed: number,
): string | null {
  const unsupportedLoadBearingCount = getUnsupportedLoadBearingCount(attempt);

  if (unsupportedLoadBearingCount <= maxUnsupportedAllowed) {
    return null;
  }

  return `evidence-gate: ${unsupportedLoadBearingCount} unsupported load-bearing claims exceed max ${maxUnsupportedAllowed}`;
}

function annotatePaidMediaVerifierReview({
  artifact,
  result,
}: {
  artifact: ArtifactEnvelope;
  result: PaidMediaPlanVerificationResult;
}): ArtifactEnvelope {
  return artifactEnvelopeSchema.parse({
    ...artifact,
    ...(result.needsReview ? { needs_review: true } : {}),
    verifierSummary: {
      ...(artifact.verifierSummary ?? {}),
      ...result.summary,
    },
  });
}

// Single-claim provenance strip (ADR-0010 amendment, ADR-0011): the review-citing
// sections relabel quotes whose asserted platform the sourceUrl host does not
// support, BEFORE persistence. The quote stays, the false label goes, the section
// still commits. Relabel shape is schema-driven per section:
// - CompetitorLandscape quote `source` is a free string -> the honest label is
//   the host that actually served the quote.
// - VoC quote `source` is a closed enum (vocSourceTypes) -> "other" is the only
//   schema-legal honest relabel.
const misattributedQuoteSourceRelabelers: Partial<
  Record<SectionId, (context: { actualHost: string }) => string>
> = {
  positioningCompetitorLandscape: ({ actualHost }) => actualHost,
  positioningVoiceOfCustomer: () => "other",
};

function annotateEvidenceSupportReview({
  artifact,
  sectionId,
  shortfall,
}: {
  artifact: ArtifactEnvelope;
  sectionId: SectionId;
  shortfall?: EvidenceSupportShortfall;
}): ArtifactEnvelope {
  const provenanceFlags = shortfall?.provenanceFlags ?? [];
  const relabelSource = misattributedQuoteSourceRelabelers[sectionId];
  const strip =
    relabelSource !== undefined &&
    provenanceFlags.some((flag) => flag.reason === "misattributed")
      ? stripMisattributedQuoteAttributions({
          body: artifact.body,
          relabelSource,
        })
      : { body: artifact.body, stripped: [] as StrippedQuoteAttribution[] };
  // W6 creative truth gate: confessed exemplars never ship with their
  // confession; paid-media creative copy never attaches an unsupported metric
  // to a named person. Runs before the numeric redactor so removed sentences
  // are not marker-spliced.
  const exemplarDrop = dropConfessedExemplarQuotes({
    body: strip.body,
    sectionId,
  });
  const namedEntityStrip =
    sectionId === "positioningPaidMediaPlan" &&
    artifact.verification !== undefined
      ? stripUngroundedNamedEntityMetrics({
          body: exemplarDrop.body,
          verification: artifact.verification,
        })
      : {
          body: exemplarDrop.body,
          stripped: [] as StrippedNamedEntityMetric[],
        };
  const numericStrip =
    artifact.verification === undefined
      ? { body: namedEntityStrip.body, stripped: [] as StrippedNumericClaim[] }
      : redactUnsupportedNumericClaims({
          body: namedEntityStrip.body,
          verification: artifact.verification,
        });
  const statusSummaryStrip = stripModelAuthoredVerifiedMarkers({
    field: "statusSummary",
    value: artifact.statusSummary,
  });
  const verdictStrip = stripModelAuthoredVerifiedMarkers({
    field: "verdict",
    value: artifact.verdict,
  });
  const strippedVerificationMarkers = [
    ...numericStrip.stripped.filter(
      (item) => item.action === "verified-marker-removed",
    ),
    ...statusSummaryStrip.stripped,
    ...verdictStrip.stripped,
  ];
  const strippedNumericClaims = numericStrip.stripped.filter(
    (item) => item.action !== "verified-marker-removed",
  );

  if (
    provenanceFlags.length === 0 &&
    strip.stripped.length === 0 &&
    exemplarDrop.stripped.length === 0 &&
    namedEntityStrip.stripped.length === 0 &&
    strippedNumericClaims.length === 0 &&
    strippedVerificationMarkers.length === 0
  ) {
    return artifact;
  }

  return artifactEnvelopeSchema.parse({
    ...artifact,
    body: numericStrip.body,
    statusSummary: statusSummaryStrip.value,
    verdict: verdictStrip.value,
    confidence:
      artifact.verification === undefined || shortfall === undefined
        ? artifact.confidence
        : deriveGroundedConfidence(artifact.verification, shortfall),
    needs_review: true,
    verifierSummary: {
      ...(artifact.verifierSummary ?? {}),
      ...(provenanceFlags.length > 0 ? { provenanceFlags } : {}),
      ...(strip.stripped.length > 0
        ? { strippedQuoteAttributions: strip.stripped }
        : {}),
      ...(exemplarDrop.stripped.length > 0
        ? { droppedConfessedExemplars: exemplarDrop.stripped }
        : {}),
      ...(namedEntityStrip.stripped.length > 0
        ? { strippedNamedEntityMetrics: namedEntityStrip.stripped }
        : {}),
      ...(strippedNumericClaims.length > 0
        ? { strippedNumericClaims }
        : {}),
      ...(strippedVerificationMarkers.length > 0
        ? { strippedVerificationMarkers }
        : {}),
    },
  });
}

function getPaidMediaVerifierIssues(
  result: PaidMediaPlanVerificationResult,
): string[] {
  if (result.repairIssues.length > 0) {
    return result.repairIssues;
  }

  return [
    `paid-media verifier hard fail: ${result.summary.hardFailIds.join(", ")}`,
  ];
}

function buildPaidMediaVerifierErrorResult(
  error: unknown,
): PaidMediaPlanVerificationResult {
  const message = describeErrorForLog(error);

  return {
    verdicts: [
      {
        id: "paid-media-verifier",
        flag: "VERIFIER_ERROR",
        reason: message,
        by: "deterministic",
      },
    ],
    claims: [],
    summary: {
      totalClaims: 0,
      judged: 0,
      deterministicFlags: 1,
      judgeFlags: 0,
      verifierErrors: 1,
      judgeSkipped: 0,
      hardFailCount: 0,
      needsReviewCount: 1,
      hardFailIds: [],
      needsReviewIds: ["paid-media-verifier"],
    },
    // ARI: even a verifier crash never kills the section — commit with an honest
    // needs_review badge stating the verifier could not run.
    hardFail: false,
    needsReview: true,
    repairIssues: [`paid-media verifier VERIFIER_ERROR: ${message}`],
  };
}

async function runPaidMediaVerifierGate({
  artifact,
  deps,
  input,
  researchInput,
}: {
  artifact: ArtifactEnvelope;
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
}): Promise<{
  artifact: ArtifactEnvelope;
  result: PaidMediaPlanVerificationResult | null;
}> {
  if (input.sectionId !== "positioningPaidMediaPlan") {
    return { artifact, result: null };
  }

  const verifier = deps.verifyPaidMediaPlan ?? verifyPaidMediaPlan;
  const result = await verifier({
    artifact,
    env: deps.env ?? process.env,
    researchInput,
    signal: input.signal,
  }).catch(buildPaidMediaVerifierErrorResult);

  if (result.hardFail) {
    return { artifact, result };
  }

  return {
    artifact: annotatePaidMediaVerifierReview({ artifact, result }),
    result,
  };
}

function getRepairReason(attempt: AttemptResult): string {
  const unsupportedLoadBearingCount = getUnsupportedLoadBearingCount(attempt);

  if (unsupportedLoadBearingCount > 0) {
    return `grounding ${unsupportedLoadBearingCount} unsupported claim(s)`;
  }

  return getAttemptRepairIssues(attempt).join("; ").slice(0, 200);
}

// Repair only when it can change the committed outcome: a genuine schema/parse
// failure (no committable artifact) OR an unsupported-load-bearing count that
// actually exceeds the evidence gate (getEvidenceGateFailureReason !== null).
//
// This is deliberately tied to maxUnsupportedAllowed (getMaxUnsupportedAllowed).
// The trigger used to fire on the mere PRESENCE of any shortfall
// (evidenceSupportShortfall !== undefined), decoupled from the gate — so every
// section burned up to answerToolMaxRepairAttempts full agentic re-runs
// grounding claims it could still accept. Gating on the count preserves bounded
// grounding repairs while avoiding repairs for unsupported claims that are
// explicitly within the configured threshold.
function shouldRepairAttempt(
  attempt: AttemptResult,
  maxUnsupportedAllowed: number,
): boolean {
  return (
    attempt.artifact === null ||
    getEvidenceGateFailureReason(attempt, maxUnsupportedAllowed) !== null
  );
}

function getBestCommittableAttempt(
  current: AttemptResult | null,
  candidate: AttemptResult,
): AttemptResult | null {
  if (candidate.artifact === null) {
    return current;
  }

  if (current === null || current.artifact === null) {
    return candidate;
  }

  return getUnsupportedLoadBearingCount(candidate) <
    getUnsupportedLoadBearingCount(current)
    ? candidate
    : current;
}

const defaultStructuredOutputMaxTokens = 8192;
const paidMediaLengthRetryStructuredOutputMaxTokens = 20_480;
// Must fire well under undici's default headersTimeout (~5 min) so the
// server records a terminal failure before the verifier's fetch dies and
// abandons the run record in `running` state.
const structuredOutputTimeoutMs = 240_000;
const voiceOfCustomerStructuredOutputTimeoutMs = 150_000;
// Inner backstop in the timeout hierarchy (Cluster A target, Option A):
// answer-tool 255s < job timeout (LAB_SECTION_JOB_TIMEOUT_MS = 285s) <
// route maxDuration (300s). The answer-tool timeout trips first as an inner
// guard; the 285s job-timeout AbortController is the canonical controlled
// failure emitter, firing ~15s later and ~30s before the platform cap so the
// app records a terminal section-failed event instead of orphaning a 'running'
// row. The previous 540s value was longer than both the job and route ceilings,
// so the answer tool could never self-abort before the platform killed it.
// Exported so the cross-cluster timeout-hierarchy contract test can assert
// answerToolTimeoutMs < LAB_SECTION_JOB_TIMEOUT_MS < route maxDuration.
//
// CAVEAT: this 255s budget is PER answer-tool invocation (overallDeadline is
// recomputed `Date.now() + answerToolTimeoutMs` in runAnswerToolWithStallGuard),
// NOT a cumulative section budget, and any VoC prepass time runs before it. So
// across multiple repairs the inner 255s guard does NOT bound total section
// wall-clock — the 285s job AbortController is the real ceiling under repairs.
// The repair loops therefore yield to input.signal?.aborted (see the while
// guards) so an aborted section commits its best attempt or fails cleanly
// rather than racing the controller into an orphaned 'running' row. A true
// cumulative section budget is a follow-up best calibrated with live latency.
export const answerToolTimeoutMs = 255_000;
const structuredFirstChunkTimeoutMs = 60_000;
const structuredChunkIdleTimeoutMs = 60_000;
// W5: cover the FULL discovered competitor set (the cold read sampled 3 of 8
// and called the rest "budget exhausted"). Stagger stays at concurrency 3 and
// the 30s probe deadline remains the hard wall-clock guard — a slow ad API
// still cannot push the section past its budget; it just covers fewer
// advertisers that run.
const competitorAdProbeAdvertiserLimit = 8;
// Over-fetch a pool per provider so the adapter's blended ranker (identity +
// recency + richness) has real choice before capping to the displayed set.
// adlibrary filters by advertiser identity + usable text BEFORE this cap, so a
// larger pool buys recall, not noise.
const competitorAdProbeMaxResults = 15;
// Each probed advertiser draws three SearchAPI ad lookups (google_ads + meta_ads
// + linkedin_ads), so the reserved ad pool caps how many advertisers the live
// probe can cover without borrowing generic budget. Bounding the probe to this
// many advertisers keeps added wall-clock to a single parallel
// google+meta+linkedin round-trip. (The optional Foreplay direct prepass does not
// draw from this reserved pool — it is a non-budgeted direct API call.)
const competitorAdProbeAdLookupsPerAdvertiser = 3;
const competitorAdProbeAdvertiserConcurrency = 3;
// Hard ceiling on the live competitor ad probe so a slow ad API cannot push
// CompetitorLandscape past the answer-tool timeout (255s). Worst-case +30s.
const competitorAdProbeDeadlineMs = 30_000;
// Per-group provenance note attached to every advertiser group recovered by the
// post-draft rescue probe (starved-seed case): the advertiser came from the
// section agent's drafted competitorSet, not from the GTM brief. Rides the
// existing dataGaps array so no schema change is needed.
const competitorAdRescueProbeNote =
  "Ads recovered by post-draft rescue probe (competitor discovered by the research agent, not supplied by the brief).";
// Per-advertiser ceiling on the optional Foreplay direct prepass (searchBrands ->
// searchAds). Foreplay runs alongside the SearchAPI probe inside the
// per-advertiser step; this bound keeps a slow Foreplay round-trip from eating the
// shared probe deadline.
const competitorAdProbeForeplayDeadlineMs = 9_000;
// Cap on Foreplay ads pulled per advertiser. Mirrors the SearchAPI max_results so
// one channel cannot flood the per-advertiser creative budget.
const competitorAdProbeForeplayMaxAds = 6;
// Organic domain fallback is paid, so it is single-shot and narrow: only
// domainless advertisers, max five SearchAPI organic requests per probe run.
const competitorAdProbeDomainFallbackAdvertiserLimit = 5;
const competitorAdProbeDomainFallbackOrganicLimit = 3;
// Hard ceiling on the VoC candidate prepass (reviews -> web_search -> firecrawl).
// Unlike the ad probe, the prepass ran on the critical path with NO deadline,
  // so a slow scrape could eat into the section budget and tip VoC past the 285s
// job timeout. Bounding it here (and degrading to partial candidates on abort,
// see executeVoiceOfCustomerPrepassTool) caps the front-loaded prepass wall-clock.
// Pain loop (~3 reviews + web_search + firecrawl) plus the W1a secondary-class
// perplexity fan-out (parallel, ≈ max(call) ≈ 15s, + one retry round worst
// case). The model phase is deadline-aware (getDeadlineAwareModelTimeoutMs),
// so a longer prepass shrinks the model window instead of blowing the job.
const voiceOfCustomerPrepassDeadlineMs = 75_000;
const answerToolMaxStepCount = 12;
const answerToolMaxRepairAttempts = 2;
// Sections routed through the generic answer-tool path instead of the legacy
// structured-output path.
const answerToolSectionIds: ReadonlySet<SectionId> = new Set([
  "positioningMarketCategory",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "positioningBuyerICP",
  "positioningVoiceOfCustomer",
  "positioningCompetitorLandscape",
]);
const missingAnswerToolMessage =
  "Agent did not call answer tool within maxSteps";
const labSectionStreamingEnvKey = "LAB_SECTION_STREAMING";

function getStructuredOutputTimeoutMs(sectionId: SectionId): number {
  return sectionId === "positioningVoiceOfCustomer"
    ? voiceOfCustomerStructuredOutputTimeoutMs
    : structuredOutputTimeoutMs;
}

interface StructuredSectionDraftOutput {
  verdict: string;
  statusSummary: string;
  sources: ModelSourceInput[];
  body: Record<string, unknown>;
}

function isLabSectionStreamingEnabled(
  env: Record<string, string | undefined>,
): boolean {
  // Streaming is on by default; only an explicit "false" (case-insensitive) disables
  // it. Any other value (unset, "true", "1", ...) keeps the structured-stream path.
  return env[labSectionStreamingEnvKey]?.trim().toLowerCase() !== "false";
}

function buildStructuredSectionDraftSchema(
  definition: RuntimeSectionDefinition,
): z.ZodType<StructuredSectionDraftOutput> {
  const sectionOutputSchema = definition.sectionOutputSchema as unknown as z.ZodObject<{
    sources: z.ZodType<ModelSourceInput[]>;
  }>;

  return z
    .object({
      verdict: z
        .string()
        .describe(
          "Authored reader verdict for the committed section; distinct from statusSummary and body prose.",
        ),
      statusSummary: z
        .string()
        .describe(
          "Authored one-to-two sentence reader status summary; distinct from verdict and body prose.",
        ),
      sources: sectionOutputSchema.shape.sources.describe(
        "Top-level model-authored section sources with distinct cited URLs. Author at least five distinct URLs when the section validator requires >=5 sources.",
      ),
      // VoC streams a LENIENT body: the SDK-side draft validation otherwise
      // kills the whole stream on one DeepSeek near-miss shape with an opaque
      // "response did not match schema" (no zod detail, no repair feedback) —
      // exactly what gap-committed the Anura W1 rerun. The lenient body flows
      // into buildOutputFromStructuredBody, where the VoC normalizer coerces
      // near-miss shapes and bodySchema.parse enforces strictness with REAL
      // issues that drive the repair attempt. Same deferral the paid-media
      // generation schema (lenientSectionGenerationSchema) already proved live.
      body:
        definition.id === "positioningVoiceOfCustomer"
          ? z.record(z.string(), z.unknown())
          : definition.bodySchema,
    })
    // .strict() is load-bearing: the draft schema must REJECT a full SectionOutput
    // (extra sectionTitle/confidence keys) so the draft shape stays distinct
    // from the committed envelope. The repair prompt already tells the model to drop
    // stray envelope fields. (run-section-artifact-streaming.test.ts:135 asserts this.)
    .strict();
}
// Lenient SDK-side generation schema for sections whose strictness is
// enforced AFTER the section normalizer (paid-media since the enum-reject
// fix; VoC since the Anura blockGap near-miss stream-kill).
const lenientSectionGenerationSchema = z
  .object({
    body: z.unknown(),
    confidence: z.unknown(),
    sectionTitle: z.unknown(),
    sources: z.unknown(),
    statusSummary: z.unknown(),
    verdict: z.unknown(),
  })
  .passthrough();


function getStructuredOutputMaxTokens(
  definition: RuntimeSectionDefinition,
  override?: number,
): number {
  return override ?? definition.structuredOutputMaxTokens ?? defaultStructuredOutputMaxTokens;
}

function getStructuredGenerationSchema(
  definition: RuntimeSectionDefinition,
): z.ZodType<unknown> {
  // SDK-side leniency: strictness lives in the post-normalizer
  // sectionOutputSchema.parse, not in the provider call.
  if (
    definition.id === "positioningPaidMediaPlan" ||
    definition.id === "positioningVoiceOfCustomer"
  ) {
    return lenientSectionGenerationSchema;
  }

  return definition.sectionOutputSchema;
}

function getGenerationModel(): SectionLanguageModel {
  return sectionRunnerModel;
}




function buildToolSignalMetadata({
  input,
  toolName,
}: {
  input: unknown;
  toolName: string;
}): { query?: string; sourceUrl?: string } {
  const inputRecord = getRecord(input);

  if (toolName === "web_search") {
    const query = getStringProperty(inputRecord, "q");
    return query === null ? {} : { query };
  }

  if (toolName === "firecrawl") {
    const sourceUrl = getUrlProperty(inputRecord, "url");
    return sourceUrl === null ? {} : { sourceUrl };
  }

  if (
    toolName === "google_ads" ||
    toolName === "meta_ads" ||
    toolName === "adlibrary"
  ) {
    const advertiser = getStringProperty(inputRecord, "advertiser");
    const domain = getStringProperty(inputRecord, "domain");
    if (advertiser === null) {
      return {};
    }
    return domain === null
      ? { query: advertiser }
      : { query: `${advertiser} (${domain})` };
  }

  return {};
}

export function withNormalizedCompetitorAdEvidence({
  normalizedAdEvidenceGroups,
  rawOutput,
}: {
  rawOutput: unknown;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
}): unknown {
  if (normalizedAdEvidenceGroups === undefined) {
    return rawOutput;
  }

  const outputRecord = getRecord(rawOutput);

  if (outputRecord === null) {
    return rawOutput;
  }

  const bodyRecord = getRecord(outputRecord.body) ?? {};
  const adEvidenceRecord = getRecord(bodyRecord.adEvidence);
  // The model's free-text prose is unverified narration. When the deterministic
  // ad evidence has zero displayable creatives, prose that claims specific
  // competitor ad counts cannot be grounded (e.g. a poisoned "idk" advertiser
  // query that returned nothing) — fall back to the deterministic summary so the
  // prose and the (empty) advertiserGroups wall agree. (run 73dfbc0d, 2026-06-09.)
  const deterministicSummary = summarizeCompetitorAdEvidenceGroups(
    normalizedAdEvidenceGroups,
  );
  const modelProse = getStringProperty(adEvidenceRecord, "prose");
  const hasVerifiedAdEvidence = normalizedAdEvidenceGroups.some(
    hasVerifiedAdEvidenceGroup,
  );
  const prose =
    hasVerifiedAdEvidence && modelProse !== null
      ? modelProse
      : deterministicSummary;

  // Never persist an empty advertiserGroups wall: hasAdEvidenceOrGap iterates
  // the groups, so [] fails the adEvidence_or_gap gate and hard-errors the whole
  // section (prod run 0eeebd93). Substitute one explicit gap group so the rich
  // competitor body commits with an honest "no ad evidence observed" wall.
  const advertiserGroups =
    normalizedAdEvidenceGroups.length === 0
      ? [buildEmptyCompetitorAdEvidenceGapGroup(new Date().toISOString())]
      : normalizedAdEvidenceGroups;

  return {
    ...outputRecord,
    body: {
      ...bodyRecord,
      adEvidence: {
        prose,
        advertiserGroups,
      },
    },
  };
}

type AdEvidenceCounts = CompetitorAdEvidenceGroup["rawCounts"];
type AdEvidenceCreative = CompetitorAdEvidenceGroup["creatives"][number];
type AdEvidenceRawSourceSample =
  CompetitorAdEvidenceGroup["rawSourceSamples"][number];
type AdEvidenceDataGap = CompetitorAdEvidenceGroup["dataGaps"][number];
type AdEvidenceSourceError =
  CompetitorAdEvidenceGroup["sourceErrors"][number];
type AdEvidenceIdentityConfidence =
  NonNullable<CompetitorAdEvidenceGroup["identityConfidence"]>;

function mergeCounts(
  base: AdEvidenceCounts,
  next: AdEvidenceCounts,
): AdEvidenceCounts {
  return {
    google: Math.max(base.google, next.google),
    meta: Math.max(base.meta, next.meta),
    linkedin: Math.max(base.linkedin, next.linkedin),
  };
}

function uniqueByKey<TItem>(
  items: readonly TItem[],
  getKey: (item: TItem) => string,
): TItem[] {
  const seen = new Set<string>();
  const uniqueItems: TItem[] = [];

  for (const item of items) {
    const key = getKey(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

function getCreativeKey(creative: AdEvidenceCreative): string {
  // Share the server-merge dedup with the sibling stages via the single-sourced
  // fingerprint: a bare numeric id (Meta ad_archive_id / Foreplay ad_library_id)
  // collapses the same creative across SearchAPI + Foreplay; content/media keys
  // catch the rest. Keep this in lockstep with the artifact-side helper.
  return adCreativeFingerprint(creative);
}

function getRawSourceSampleKey(sample: AdEvidenceRawSourceSample): string {
  return [sample.platform, sample.id, sample.sourceUrl].join(":");
}

function getDataGapKey(gap: AdEvidenceDataGap): string {
  return `${gap.platform ?? "all"}:${gap.reason}`;
}

function getSourceErrorKey(sourceError: AdEvidenceSourceError): string {
  return `${sourceError.platform}:${sourceError.message}`;
}

function countVerifiedAdEvidence(
  group: CompetitorAdEvidenceGroup,
): number {
  return (
    group.verifiedCount ??
    group.creatives.filter((creative) => creative.verified === true).length
  );
}

function countQuarantinedAdEvidence(
  group: CompetitorAdEvidenceGroup,
): number {
  return (
    group.quarantinedCount ??
    group.creatives.filter((creative) => creative.verified === false).length
  );
}

function hasVerifiedAdEvidenceGroup(
  group: CompetitorAdEvidenceGroup,
): boolean {
  return (
    countVerifiedAdEvidence(group) > 0 ||
    group.creatives.some((creative) => creative.verified === true)
  );
}

function mergeIdentityConfidence({
  next,
  verifiedCount,
}: {
  next: AdEvidenceIdentityConfidence | undefined;
  verifiedCount: number;
}): AdEvidenceIdentityConfidence | undefined {
  if (verifiedCount > 0) {
    return "verified";
  }

  return next;
}

function mergeAdEvidenceGroup(
  base: CompetitorAdEvidenceGroup,
  next: CompetitorAdEvidenceGroup,
): CompetitorAdEvidenceGroup {
  const platforms = uniqueByKey(
    [...base.platforms, ...next.platforms],
    (platform) => platform,
  );
  const creatives = uniqueByKey(
    [...next.creatives, ...base.creatives],
    getCreativeKey,
  );
  const rawSourceSamples = uniqueByKey(
    [...next.rawSourceSamples, ...base.rawSourceSamples],
    getRawSourceSampleKey,
  );
  const dataGaps = uniqueByKey(
    [...next.dataGaps, ...base.dataGaps],
    getDataGapKey,
  );
  const sourceErrors = uniqueByKey(
    [...next.sourceErrors, ...base.sourceErrors],
    getSourceErrorKey,
  );
  const displayableCounts = mergeCounts(
    base.displayableCounts,
    next.displayableCounts,
  );
  const verifiedCount =
    countVerifiedAdEvidence(base) + countVerifiedAdEvidence(next);
  const quarantinedCount =
    countQuarantinedAdEvidence(base) + countQuarantinedAdEvidence(next);
  const identityConfidence = mergeIdentityConfidence({
    next: next.identityConfidence ?? base.identityConfidence,
    verifiedCount,
  });

  return {
    advertiserName: next.advertiserName,
    domain: next.domain ?? base.domain,
    platforms,
    rawCounts: mergeCounts(base.rawCounts, next.rawCounts),
    displayableCounts,
    displayableTotal:
      displayableCounts.google +
      displayableCounts.meta +
      displayableCounts.linkedin,
    returnedCreativeCount: creatives.length,
    creatives,
    libraryLinks: {
      ...base.libraryLinks,
      ...next.libraryLinks,
    },
    rawSourceSamples,
    dataGaps,
    sourceErrors,
    observedAt: next.observedAt,
    identityConfidence,
    quarantinedCount,
    verifiedCount,
  };
}

export function mergeAdEvidenceGroups(
  baseGroups: readonly CompetitorAdEvidenceGroup[],
  nextGroups: readonly CompetitorAdEvidenceGroup[],
): CompetitorAdEvidenceGroup[] {
  const groupsByAdvertiser = new Map<string, CompetitorAdEvidenceGroup>();

  for (const group of baseGroups) {
    groupsByAdvertiser.set(group.advertiserName.toLowerCase(), group);
  }

  for (const group of nextGroups) {
    const key = group.advertiserName.toLowerCase();
    const existingGroup = groupsByAdvertiser.get(key);

    groupsByAdvertiser.set(
      key,
      existingGroup === undefined
        ? group
        : mergeAdEvidenceGroup(existingGroup, group),
    );
  }

  return Array.from(groupsByAdvertiser.values());
}





interface ModelSourceInput {
  title: string;
  url: string;
  publisher?: string;
}

function collectModelSourcesFromBody(value: unknown): ModelSourceInput[] {
  const sourcesByUrl = new Map<string, ModelSourceInput>();

  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    const record = getRecord(current);

    if (record === null) {
      return;
    }

    const sourceUrl = getValidHttpUrl(getStringProperty(record, "sourceUrl"));

    if (sourceUrl !== null && !sourcesByUrl.has(sourceUrl)) {
      const sourceTitle =
        getStringProperty(record, "sourceTitle") ??
        getStringProperty(record, "source") ??
        getStringProperty(record, "title") ??
        getSourceTitleFromUrl(sourceUrl);
      const publisher = getStringProperty(record, "publisher");

      sourcesByUrl.set(sourceUrl, {
        title: sourceTitle,
        url: sourceUrl,
        ...(publisher === null ? {} : { publisher }),
      });
    }

    for (const childValue of Object.values(record)) {
      visit(childValue);
    }
  };

  visit(value);

  return Array.from(sourcesByUrl.values());
}

function buildSyntheticSectionOutput({
  body,
  definition,
}: {
  body: Record<string, unknown>;
  definition: RuntimeSectionDefinition;
}): SectionOutput<Record<string, unknown>> {
  const firstProse = collectStringValuesByKey(body, "prose")[0];
  const summary =
    firstProse === undefined
      ? `${definition.title} drafted from available evidence.`
      : firstProse;

  return {
    sectionTitle: definition.title,
    verdict: summary.slice(0, 500),
    statusSummary: summary.slice(0, 500),
    confidence: 0.5,
    sources: collectModelSourcesFromBody(body),
    body,
  };
}


function normalizeVerbatimTextRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const aliasValue = getStringProperty(record, "verbatumText");
  const existingValue = getStringProperty(record, "verbatimText");
  const withoutAlias = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== "verbatumText"),
  );

  if (existingValue !== null || aliasValue === null) {
    return withoutAlias;
  }

  return {
    ...withoutAlias,
    verbatimText: aliasValue,
  };
}

const voiceOfCustomerQuoteSourceValues = new Set([
  "g2",
  "reddit",
  "hackernews",
  "sales-call",
  "support-thread",
  "twitter",
  "other",
]);


function normalizeVoiceOfCustomerQuoteSource({
  source,
  sourceUrl,
}: {
  source: string | null;
  sourceUrl: string | null;
}): string | null {
  const normalizedSource = source?.trim().toLowerCase() ?? null;

  if (
    normalizedSource !== null &&
    voiceOfCustomerQuoteSourceValues.has(normalizedSource)
  ) {
    return normalizedSource;
  }

  const hostname = getHostname(sourceUrl);
  if (hostname?.includes("g2.com") === true) {
    return "g2";
  }
  if (hostname?.includes("reddit.com") === true) {
    return "reddit";
  }
  if (
    hostname === "news.ycombinator.com" ||
    hostname?.includes("hackernews") === true
  ) {
    return "hackernews";
  }
  if (
    hostname?.includes("twitter.com") === true ||
    hostname?.includes("x.com") === true
  ) {
    return "twitter";
  }

  if (normalizedSource !== null) {
    return "other";
  }

  return null;
}

function normalizeVoiceOfCustomerQuoteRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const normalizedText = normalizeVerbatimTextRecord(record);
  const normalizedSource = normalizeVoiceOfCustomerQuoteSource({
    source: getStringProperty(normalizedText, "source"),
    sourceUrl: getStringProperty(normalizedText, "sourceUrl"),
  });
  const withoutBlankRole = removeEmptyStringProperty(normalizedText, "role");
  const withoutBlankDate = removeEmptyStringProperty(withoutBlankRole, "date");

  if (normalizedSource === null) {
    return withoutBlankDate;
  }

  return {
    ...withoutBlankDate,
    source: normalizedSource,
  };
}

function normalizeArrayRecords({
  normalize,
  value,
}: {
  value: unknown;
  normalize: (record: Record<string, unknown>) => Record<string, unknown>;
}): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    const itemRecord = getRecord(item);

    return itemRecord === null ? item : normalize(itemRecord);
  });
}

function stringifyStructuredScalar(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
          ? String(item)
          : null,
      )
      .filter((item): item is string => item !== null && item.trim().length > 0)
      .join("; ");
  }

  return value;
}

function numberFromStructuredValue(value: unknown): unknown {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (match === null) {
    return value;
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : value;
}

function stringArrayFromStructuredValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function pickAllowedKeys({
  allowedKeys,
  record,
}: {
  allowedKeys: readonly string[];
  record: Record<string, unknown>;
}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => allowedKeys.includes(key)),
  );
}

function normalizeStructuredRecord({
  allowedKeys,
  numberKeys = [],
  record,
  stringArrayKeys = [],
  stringKeys = [],
}: {
  allowedKeys: readonly string[];
  numberKeys?: readonly string[];
  record: Record<string, unknown>;
  stringArrayKeys?: readonly string[];
  stringKeys?: readonly string[];
}): Record<string, unknown> {
  const picked = pickAllowedKeys({ allowedKeys, record });

  return Object.fromEntries(
    Object.entries(picked).map(([key, value]) => {
      if (numberKeys.includes(key)) {
        return [key, numberFromStructuredValue(value)];
      }

      if (stringArrayKeys.includes(key)) {
        return [key, stringArrayFromStructuredValue(value)];
      }

      if (stringKeys.includes(key)) {
        return [key, stringifyStructuredScalar(value)];
      }

      return [key, value];
    }),
  );
}

function normalizeStructuredRecordArray({
  allowedKeys,
  numberKeys,
  stringArrayKeys,
  stringKeys,
  value,
}: {
  allowedKeys: readonly string[];
  numberKeys?: readonly string[];
  stringArrayKeys?: readonly string[];
  stringKeys?: readonly string[];
  value: unknown;
}): unknown {
  return normalizeArrayRecords({
    value,
    normalize: (record) =>
      normalizeStructuredRecord({
        allowedKeys,
        numberKeys,
        record,
        stringArrayKeys,
        stringKeys,
    }),
  });
}

function withSectionSourcesFromBody({
  minimumSources,
  rawOutput,
}: {
  rawOutput: unknown;
  minimumSources: number;
}): unknown {
  const outputRecord = getRecord(rawOutput);

  if (outputRecord === null || !Array.isArray(outputRecord.sources)) {
    return rawOutput;
  }

  const bodyRecord = getRecord(outputRecord.body);

  if (bodyRecord === null) {
    return rawOutput;
  }

  const sourceRecords = outputRecord.sources;
  const sourceUrls = new Set(
    sourceRecords
      .map((source) => getValidHttpUrl(getStringProperty(getRecord(source), "url")))
      .filter((url): url is string => url !== null),
  );
  const normalizedSources: unknown[] = [...sourceRecords];

  for (const sourceUrl of collectStringValuesByKey(bodyRecord, "sourceUrl")
    .map((url) => getValidHttpUrl(url))
    .filter((url): url is string => url !== null)) {
    if (normalizedSources.length >= minimumSources) {
      break;
    }

    if (sourceUrls.has(sourceUrl)) {
      continue;
    }

    normalizedSources.push({
      title: getSourceTitleFromUrl(sourceUrl),
      url: sourceUrl,
    });
    sourceUrls.add(sourceUrl);
  }

  return {
    ...outputRecord,
    sources: normalizedSources,
  };
}

function withoutEvidenceGapKeys(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key]) => key !== "evidenceGap" && key !== "evidenceGapReport",
    ),
  );
}

// vendorSourced is derived here, never asked of the model (same pattern as
// the P3 provenance verifier): registrable domain of persona.sourceUrl equals
// the subject domain -> true. Whatever the model authored is overwritten.
// Subject-company EMPLOYEES are dropped entirely — the vendor's own founders
// and staff are never buyer personas, no matter how independent the source
// that quotes them (the Anura rerun promoted Anura's own CEO as persona #3).
function withDerivedVendorSourcedPersonas({
  personaRealityRecord,
  subjectCompanyName,
  subjectWebsiteUrl,
}: {
  personaRealityRecord: Record<string, unknown>;
  subjectCompanyName: string | undefined;
  subjectWebsiteUrl: string | undefined;
}): Record<string, unknown> {
  if (
    subjectWebsiteUrl === undefined ||
    !Array.isArray(personaRealityRecord.personas)
  ) {
    return personaRealityRecord;
  }

  const subjectDomain = getRegistrableDomain(subjectWebsiteUrl);
  const subjectNameSlug =
    subjectCompanyName?.trim().toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const isSubjectCompanyLabel = (company: string | null): boolean => {
    if (company === null) {
      return false;
    }

    const companySlug = company.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const companyDomain = getRegistrableDomain(company);

    return (
      (subjectNameSlug.length > 0 && companySlug === subjectNameSlug) ||
      (subjectDomain !== null &&
        (companyDomain === subjectDomain ||
          companySlug === subjectDomain.replace(/[^a-z0-9]/g, "")))
    );
  };

  return {
    ...personaRealityRecord,
    personas: personaRealityRecord.personas.flatMap((persona) => {
      const personaRecord = getRecord(persona);

      if (personaRecord === null) {
        return [persona];
      }

      if (
        isSubjectCompanyLabel(getStringProperty(personaRecord, "company"))
      ) {
        return [];
      }

      const sourceUrl = getStringProperty(personaRecord, "sourceUrl");

      return [
        {
          ...personaRecord,
          vendorSourced: deriveVendorSourced({
            sourceUrl: sourceUrl ?? "",
            subjectWebsiteUrl,
          }),
        },
      ];
    }),
  };
}

// A model-authored persona gap alongside a floor-clearing persona set is
// contradictory — strip it so a complete section does not read as a gap.
// Below the floor the gap stays (the validator's honest-exit semantics).
function countValidatorGradePersonas(
  personaRealityRecord: Record<string, unknown>,
): number {
  if (!Array.isArray(personaRealityRecord.personas)) {
    return 0;
  }

  return personaRealityRecord.personas.filter((persona) => {
    const personaRecord = getRecord(persona);

    if (personaRecord === null) {
      return false;
    }

    const name = getStringProperty(personaRecord, "name") ?? "";
    const sourceUrl = getStringProperty(personaRecord, "sourceUrl") ?? "";

    return (
      /^https?:\/\//i.test(sourceUrl) &&
      isLikelyNamedBuyerIdentity(name, {
        company: getStringProperty(personaRecord, "company") ?? undefined,
        role: getStringProperty(personaRecord, "role") ?? undefined,
        seniority: getStringProperty(personaRecord, "seniority") ?? undefined,
        title: getStringProperty(personaRecord, "title") ?? undefined,
      })
    );
  }).length;
}

export function withNormalizedBuyerICPOutput(
  rawOutput: unknown,
  {
    subjectCompanyName,
    subjectWebsiteUrl,
  }: { subjectCompanyName?: string; subjectWebsiteUrl?: string } = {},
): unknown {
  const outputRecord = getRecord(rawOutput);

  if (outputRecord === null) {
    return rawOutput;
  }

  const bodyRecord = getRecord(outputRecord.body);

  if (bodyRecord === null) {
    return rawOutput;
  }

  const icpExistenceCheckRecord = getRecord(bodyRecord.icpExistenceCheck);
  const awarenessDistributionRecord = getRecord(bodyRecord.awarenessDistribution);
  const personaRealityRecord = getRecord(bodyRecord.personaReality);
  const normalizedPersonaReality =
    personaRealityRecord === null
      ? null
      : withDerivedVendorSourcedPersonas({
          personaRealityRecord: withoutEvidenceGapKeys(personaRealityRecord),
          subjectCompanyName,
          subjectWebsiteUrl,
        });
  const stripUnnecessaryGap =
    normalizedPersonaReality !== null &&
    bodyRecord.evidenceGap === true &&
    countValidatorGradePersonas(normalizedPersonaReality) >= 3;
  const {
    evidenceGap: _strippedEvidenceGap,
    evidenceGapReport: _strippedEvidenceGapReport,
    ...bodyWithoutGap
  } = bodyRecord;

  return {
    ...outputRecord,
    body: {
      ...(stripUnnecessaryGap ? bodyWithoutGap : bodyRecord),
      ...(normalizedPersonaReality === null
        ? {}
        : {
            personaReality: normalizedPersonaReality,
          }),
      ...(icpExistenceCheckRecord === null
        ? {}
        : {
            icpExistenceCheck: {
              ...icpExistenceCheckRecord,
              firmographicCuts: dedupeRecordArrayByStringKey({
                key: "cutType",
                value: icpExistenceCheckRecord.firmographicCuts,
              }),
            },
          }),
      ...(awarenessDistributionRecord === null
        ? {}
        : {
            awarenessDistribution: {
              ...awarenessDistributionRecord,
              levels: dedupeRecordArrayByStringKey({
                key: "level",
                value: awarenessDistributionRecord.levels,
              }),
            },
          }),
    },
  };
}

export function withNormalizedVoiceOfCustomerOutput(rawOutput: unknown): unknown {
  const outputWithSources = withSectionSourcesFromBody({
    minimumSources: 5,
    rawOutput,
  });
  const outputRecord = getRecord(outputWithSources);

  if (outputRecord === null) {
    return outputWithSources;
  }

  const bodyRecord = getRecord(outputRecord.body);

  if (bodyRecord === null) {
    return outputWithSources;
  }

  return {
    ...outputRecord,
    body: withNormalizedVoiceOfCustomerBody({ bodyRecord }),
  };
}

// Mechanical blockGap shape coercion (TAM-coercion precedent): DeepSeek's
// compat mode emits near-miss shapes for small optional strict objects —
// null for "absent", numeric strings for ints, a bare string for a
// single-step plan, stray extra keys. The coercion is shape-only; a blockGap
// missing real content (no summary, no plan) still fails bodySchema.parse
// with a precise issue that drives the repair attempt.
function normalizeVoiceOfCustomerBlockGapOnBlock(
  blockRecord: Record<string, unknown>,
): Record<string, unknown> {
  if (!("blockGap" in blockRecord)) {
    return blockRecord;
  }

  const blockGapRecord = getRecord(blockRecord.blockGap);

  if (blockGapRecord === null) {
    // null / non-object blockGap means "no gap filed" — drop the key so the
    // optional schema accepts it.
    const { blockGap: _droppedBlockGap, ...rest } = blockRecord;
    return rest;
  }

  const coerceCount = (value: unknown): unknown => {
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      Number.isFinite(Number(value))
    ) {
      return Math.trunc(Number(value));
    }
    return value;
  };
  const rawSourcingPlan = blockGapRecord.sourcingPlan;
  const sourcingPlan =
    typeof rawSourcingPlan === "string" && rawSourcingPlan.trim() !== ""
      ? [rawSourcingPlan]
      : rawSourcingPlan;

  return {
    ...blockRecord,
    blockGap: {
      ...("summary" in blockGapRecord ? { summary: blockGapRecord.summary } : {}),
      ...("foundCount" in blockGapRecord
        ? { foundCount: coerceCount(blockGapRecord.foundCount) }
        : {}),
      ...("requiredCount" in blockGapRecord
        ? { requiredCount: coerceCount(blockGapRecord.requiredCount) }
        : {}),
      ...(sourcingPlan === undefined ? {} : { sourcingPlan }),
    },
  };
}

function withNormalizedVoiceOfCustomerBody({
  bodyRecord,
}: {
  bodyRecord: Record<string, unknown>;
}): Record<string, unknown> {
  const painLanguageRecord = getRecord(bodyRecord.painLanguage);
  const objectionsRecord = getRecord(bodyRecord.objections);
  const switchingStoriesRecord = getRecord(bodyRecord.switchingStories);
  const decisionCriteriaRecord = getRecord(bodyRecord.decisionCriteria);
  const successLanguageRecord = getRecord(bodyRecord.successLanguage);

  return {
    ...bodyRecord,
    ...(painLanguageRecord === null
      ? {}
      : {
          painLanguage: (() => {
            // Pain has no per-block escape: a model-authored
            // painLanguage.blockGap is stripped, never honored.
            const { blockGap: _droppedPainBlockGap, ...painRest } =
              painLanguageRecord;
            return {
              ...painRest,
              quotes: normalizeArrayRecords({
                normalize: normalizeVoiceOfCustomerQuoteRecord,
                value: painLanguageRecord.quotes,
              }),
            };
          })(),
        }),
    ...(objectionsRecord === null
      ? {}
      : {
          objections: normalizeVoiceOfCustomerBlockGapOnBlock(objectionsRecord),
        }),
    ...(switchingStoriesRecord === null
      ? {}
      : {
          switchingStories: normalizeVoiceOfCustomerBlockGapOnBlock({
            ...switchingStoriesRecord,
            stories: normalizeArrayRecords({
              normalize: (story) =>
                removeEmptyStringProperty(story, "exampleCompany"),
              value: switchingStoriesRecord.stories,
            }),
          }),
        }),
    ...(decisionCriteriaRecord === null
      ? {}
      : {
          decisionCriteria: normalizeVoiceOfCustomerBlockGapOnBlock(
            decisionCriteriaRecord,
          ),
        }),
    ...(successLanguageRecord === null
      ? {}
      : {
          successLanguage: normalizeVoiceOfCustomerBlockGapOnBlock({
            ...successLanguageRecord,
            quotes: normalizeArrayRecords({
              normalize: normalizeVoiceOfCustomerQuoteRecord,
              value: successLanguageRecord.quotes,
            }),
          }),
        }),
  };
}

function withNormalizedMarketCategoryOutput(rawOutput: unknown): unknown {
  const outputRecord = getRecord(rawOutput);

  if (outputRecord === null) {
    return rawOutput;
  }

  const bodyRecord = getRecord(outputRecord.body);

  if (bodyRecord === null) {
    return rawOutput;
  }

  const marketSizeRecord = getRecord(bodyRecord.marketSize);
  const structuralForcesRecord = getRecord(bodyRecord.structuralForces);

  // Mechanical honest-shape coercion (ADR-0012 "repairs get cheaper"): a TAM
  // input the model already declared status="evidence-gap" but whose value
  // lacks the literal "evidence gap" phrase fails the minimum validator and
  // burned a full repair round on the Anura rerun. The status field carries
  // the honesty; prefixing the value is shape, not content.
  const bottomUpTamRecord =
    marketSizeRecord === null ? null : getRecord(marketSizeRecord.bottomUpTam);
  const normalizedBottomUpTam =
    bottomUpTamRecord === null || !Array.isArray(bottomUpTamRecord.inputs)
      ? bottomUpTamRecord
      : {
          ...bottomUpTamRecord,
          inputs: bottomUpTamRecord.inputs.map((input) => {
            const inputRecord = getRecord(input);
            if (
              inputRecord === null ||
              inputRecord.status !== "evidence-gap" ||
              typeof inputRecord.value !== "string" ||
              /evidence\s+gap/i.test(inputRecord.value)
            ) {
              return input;
            }
            return {
              ...inputRecord,
              value: `evidence gap: ${inputRecord.value}`,
            };
          }),
        };

  return {
    ...outputRecord,
    body: {
      ...bodyRecord,
      ...(marketSizeRecord === null
        ? {}
        : {
            marketSize: {
              ...marketSizeRecord,
              signals: dedupeRecordArrayByStringKey({
                key: "signalType",
                value: marketSizeRecord.signals,
              }),
              ...(normalizedBottomUpTam === null
                ? {}
                : { bottomUpTam: normalizedBottomUpTam }),
            },
          }),
      ...(structuralForcesRecord === null
        ? {}
        : {
            structuralForces: {
              ...structuralForcesRecord,
              forces: dedupeRecordArrayByStringKey({
                key: "forceType",
                value: structuralForcesRecord.forces,
              }),
            },
          }),
    },
  };
}

function withNormalizedPaidMediaPlanOutput(rawOutput: unknown): unknown {
  const outputRecord = getRecord(rawOutput);

  if (outputRecord === null) {
    return rawOutput;
  }

  const bodyRecord = getRecord(outputRecord.body);

  if (bodyRecord === null) {
    return rawOutput;
  }

  return {
    ...outputRecord,
    sources: normalizeStructuredRecordArray({
      allowedKeys: ["title", "url", "publisher"],
      stringKeys: ["title", "url", "publisher"],
      value: outputRecord.sources,
    }),
    body: normalizePaidMediaPlanBody(bodyRecord),
  };
}

function withNormalizedSectionOutput({
  normalizedAdEvidenceGroups,
  rawOutput,
  sectionId,
  subjectCompanyName,
  subjectWebsiteUrl,
}: {
  rawOutput: unknown;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  sectionId: SectionId;
  subjectCompanyName?: string;
  subjectWebsiteUrl?: string;
}): unknown {
  const outputWithAdEvidence = withNormalizedCompetitorAdEvidence({
    normalizedAdEvidenceGroups,
    rawOutput,
  });

  if (sectionId === "positioningBuyerICP") {
    return withNormalizedBuyerICPOutput(outputWithAdEvidence, {
      subjectCompanyName,
      subjectWebsiteUrl,
    });
  }

  if (sectionId === "positioningMarketCategory") {
    return withNormalizedMarketCategoryOutput(outputWithAdEvidence);
  }

  if (sectionId === "positioningVoiceOfCustomer") {
    return withNormalizedVoiceOfCustomerOutput(outputWithAdEvidence);
  }

  if (sectionId === "positioningPaidMediaPlan") {
    return withNormalizedPaidMediaPlanOutput(outputWithAdEvidence);
  }

  return outputWithAdEvidence;
}

export interface CompetitorAdProbeAdvertiser {
  advertiser: string;
  domain?: string;
}

function deriveDomainFromUrl(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function deriveCompetitorAdDomain(ad: CompetitorAd): string | undefined {
  return (
    deriveDomainFromUrl(ad.landingUrl) ??
    deriveDomainFromUrl(ad.sourceUrl) ??
    deriveDomainFromUrl(ad.creativeUrl)
  );
}

function buildCompetitorAdTopicContext(researchInput: ResearchInput): string {
  return [
    researchInput.company.category,
    researchInput.company.description,
    researchInput.company.targetCustomer,
    researchInput.onboarding.primaryGoal,
    ...researchInput.onboarding.targetSegments,
    ...researchInput.onboarding.keyOffers,
    ...researchInput.onboarding.distributionChannels,
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join("\n");
}

function advertiserDomainMatchesBrand({
  advertiser,
  domain,
}: {
  advertiser: string;
  domain: string;
}): boolean {
  const advertiserToken = normalizeBrandToken(
    cleanAdvertiserQuery(advertiser).split(/\s+/u)[0] ?? "",
  );
  const domainToken = getRegistrableDomainBrandToken(domain);

  return (
    advertiserToken.length >= 3 &&
    domainToken.length >= 3 &&
    advertiserToken === domainToken
  );
}

async function resolveAdvertiserDomainWithOrganicSearch({
  advertiser,
  apiKey,
  clientDomain,
  signal,
  topicContext,
}: {
  advertiser: string;
  apiKey: string;
  clientDomain?: string;
  signal?: AbortSignal;
  topicContext: string;
}): Promise<string | undefined> {
  if (signal?.aborted === true) {
    return undefined;
  }

  try {
    const organicResults = await fetchSearchApiOrganicResults({
      abortSignal: signal,
      apiKey,
      maxResults: competitorAdProbeDomainFallbackOrganicLimit,
      query: `${advertiser} official site`,
    });

    for (const organicResult of organicResults) {
      const domain = getRegistrableDomain(organicResult.url);
      const organicResultText = [
        organicResult.title?.trim(),
        organicResult.snippet?.trim(),
      ]
        .filter(
          (value): value is string =>
            value !== undefined && value.length > 0,
        )
        .join("\n");

      if (
        domain === null ||
        isSameRegistrableDomain(domain, clientDomain) ||
        !advertiserDomainMatchesBrand({ advertiser, domain }) ||
        !textReconcilesWithCompetitorAdTopicContext({
          text: organicResultText,
          topicContext,
        })
      ) {
        continue;
      }

      return domain;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function resolveCompetitorAdProbeAdvertiserDomains({
  advertisers,
  clientDomain,
  signal,
  topicContext,
}: {
  advertisers: readonly CompetitorAdProbeAdvertiser[];
  clientDomain?: string;
  signal?: AbortSignal;
  topicContext: string;
}): Promise<readonly CompetitorAdProbeAdvertiser[]> {
  const apiKey = process.env.SEARCHAPI_KEY?.trim();

  if (
    topicContext.trim().length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0
  ) {
    return advertisers;
  }

  const domainlessAdvertisers = advertisers
    .filter((advertiser) => advertiser.domain === undefined)
    .slice(0, competitorAdProbeDomainFallbackAdvertiserLimit);

  if (domainlessAdvertisers.length === 0) {
    return advertisers;
  }

  const resolvedDomains = await Promise.all(
    domainlessAdvertisers.map(async (advertiserRecord) => ({
      advertiser: advertiserRecord.advertiser,
      domain: await resolveAdvertiserDomainWithOrganicSearch({
        advertiser: advertiserRecord.advertiser,
        apiKey,
        clientDomain,
        signal,
        topicContext,
      }),
    })),
  );
  const domainByAdvertiser = new Map(
    resolvedDomains.flatMap((result): Array<[string, string]> =>
      result.domain === undefined
        ? []
        : [[result.advertiser.toLowerCase(), result.domain]],
    ),
  );

  return advertisers.map((advertiserRecord) => {
    if (advertiserRecord.domain !== undefined) {
      return advertiserRecord;
    }

    const domain = domainByAdvertiser.get(
      advertiserRecord.advertiser.toLowerCase(),
    );

    return domain === undefined
      ? advertiserRecord
      : { ...advertiserRecord, domain };
  });
}

function collectCompetitorAdProbeAdvertisers(
  researchInput: ResearchInput,
): readonly CompetitorAdProbeAdvertiser[] {
  const advertisers = new Map<string, CompetitorAdProbeAdvertiser>();

  // Brief-derived competitor seeds take priority (inserted first, so they win
  // the advertiser-limit slice). competitorAds is fixture/preview context.
  for (const seed of researchInput.competitorSeeds ?? []) {
    const advertiser = seed.name.trim();

    if (advertiser.length === 0) {
      continue;
    }

    const key = advertiser.toLowerCase();
    const existingAdvertiser = advertisers.get(key);

    if (existingAdvertiser === undefined) {
      advertisers.set(key, {
        advertiser,
        ...(seed.domain === undefined ? {} : { domain: seed.domain }),
      });
      continue;
    }

    if (existingAdvertiser.domain === undefined && seed.domain !== undefined) {
      existingAdvertiser.domain = seed.domain;
    }
  }

  for (const ad of researchInput.competitorAds) {
    const advertiser = ad.competitorName.trim();

    if (advertiser.length === 0) {
      continue;
    }

    const key = advertiser.toLowerCase();
    const existingAdvertiser = advertisers.get(key);
    const domain = deriveCompetitorAdDomain(ad);

    if (existingAdvertiser === undefined) {
      advertisers.set(key, {
        advertiser,
        ...(domain === undefined ? {} : { domain }),
      });
      continue;
    }

    if (existingAdvertiser.domain === undefined && domain !== undefined) {
      existingAdvertiser.domain = domain;
    }
  }

  return Array.from(advertisers.values()).slice(
    0,
    competitorAdProbeAdvertiserLimit,
  );
}

export async function getCompetitorAdProbeAdvertisers(
  researchInput: ResearchInput,
  signal?: AbortSignal,
): Promise<readonly CompetitorAdProbeAdvertiser[]> {
  return resolveCompetitorAdProbeAdvertiserDomains({
    advertisers: collectCompetitorAdProbeAdvertisers(researchInput),
    clientDomain: researchInput.company.websiteUrl,
    signal,
    topicContext: buildCompetitorAdTopicContext(researchInput),
  });
}


interface CompetitorAdProbeToolInput {
  advertiser: string;
  domain?: string;
  max_results: number;
}

type SearchApiAdToolName = "google_ads" | "meta_ads" | "linkedin_ads";

interface ProbeToolPair {
  toolCall: { toolName: string; input: unknown };
  toolResult: { toolName: string; output: unknown };
}

function buildProbeToolInput(
  advertiserRecord: CompetitorAdProbeAdvertiser,
): CompetitorAdProbeToolInput {
  return {
    max_results: competitorAdProbeMaxResults,
    advertiser: advertiserRecord.advertiser,
    ...(advertiserRecord.domain === undefined
      ? {}
      : { domain: advertiserRecord.domain }),
  };
}

// A settled rejection (transport throw) becomes a structured per-platform gap the
// adapter ingests as a sourceError, isolating one channel's failure instead of
// taking down the whole advertiser step.
function probeRejectionGap(toolName: SearchApiAdToolName, reason: unknown): ToolGap {
  const message = reason instanceof Error ? reason.message : String(reason);
  return {
    type: "gap",
    reason: "api_error",
    message: `${toolName} probe threw before returning a structured result: ${message}`,
  };
}

async function settleProbeTool({
  input,
  signal,
  tool,
  toolName,
}: {
  input: CompetitorAdProbeToolInput;
  signal: AbortSignal;
  tool: Tool<CompetitorAdProbeToolInput, unknown>;
  toolName: SearchApiAdToolName;
}): Promise<ProbeToolPair> {
  const settled = await Promise.allSettled([
    tool.execute?.(input, createToolExecutionOptions({ signal, toolName })),
  ]);
  const [result] = settled;
  const output =
    result.status === "fulfilled"
      ? result.value
      : probeRejectionGap(toolName, result.reason);

  return {
    toolCall: { toolName, input },
    toolResult: { toolName, output },
  };
}

// Foreplay direct prepass (NOT a registered tool): pull a brand by domain then its
// ads, normalize, and inject them as synthetic per-platform toolResults the
// adapter groups under this advertiser. Bounded by a timeout + try/catch; on any
// failure it emits a structured gap (never a silent empty) so the section's
// fabrication gate can see the attempt.
function withForeplayTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Foreplay prepass timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function buildForeplayToolPairs({
  advertiserRecord,
  normalizedAds,
}: {
  advertiserRecord: CompetitorAdProbeAdvertiser;
  normalizedAds: readonly NormalizedForeplayAd[];
}): ProbeToolPair[] {
  // Bucket by mapped platform so each synthetic result carries one ad-library
  // platform (the adapter reads platform off the result, not the toolName).
  const byPlatform = new Map<"meta" | "linkedin", NormalizedForeplayAd[]>();

  for (const normalized of normalizedAds) {
    const bucket = byPlatform.get(normalized.platform) ?? [];
    bucket.push(normalized);
    byPlatform.set(normalized.platform, bucket);
  }

  const input = buildProbeToolInput(advertiserRecord);

  return Array.from(byPlatform.entries()).map(([platform, ads]) => {
    const toolName: SearchApiAdToolName =
      platform === "linkedin" ? "linkedin_ads" : "meta_ads";
    // Strip the platform discriminator so each row validates against the strict
    // adLibraryAdSchema the adapter parses with. Foreplay ads reach here only
    // after the domain-corroborated brand guard, so they are identity-verified
    // (the adapter still re-checks language + per-ad advertiser reconciliation).
    const rows = ads.map((ad) => {
      const { platform: rawPlatform, ...rawAd } = ad;
      void rawPlatform;

      return {
        ...rawAd,
        identityVerified: true,
        identityBasis: "domain",
      };
    });

    return {
      toolCall: { toolName, input },
      toolResult: {
        toolName,
        output: {
          type: "result" as const,
          advertiser: advertiserRecord.advertiser,
          platform,
          ads: rows,
        },
      },
    };
  });
}

// Part B helper: pull the brand's Meta page id from Foreplay's domain-resolved
// brand record. Foreplay returns `page_id` ("Facebook page ID") and sometimes
// `ad_library_id`; both should be the long numeric Meta page id. Guard against
// non-numeric junk so we never feed a bad id to the Meta Ad Library engine.
export function extractForeplayMetaPageId(brand: {
  page_id?: string;
  ad_library_id?: string;
}): string | undefined {
  const candidate = (brand.page_id ?? brand.ad_library_id ?? "").trim();
  return /^\d{6,}$/.test(candidate) ? candidate : undefined;
}

async function runForeplayPrepassForAdvertiser(
  advertiserRecord: CompetitorAdProbeAdvertiser,
): Promise<ProbeToolPair[]> {
  if (advertiserRecord.domain === undefined) {
    return [];
  }

  const targetDomain = advertiserRecord.domain;
  const service = createForeplayService();

  if (service === null) {
    return [];
  }

  try {
    const { foreplay, metaPageOutput } = await withForeplayTimeout(
      (async () => {
        const brands = await service.searchBrands({
          domain: advertiserRecord.domain,
        });
        const brand = brands[0];
        const brandId = brand?.id;

        if (brandId === undefined || brandId.trim().length === 0) {
          return {
            foreplay: [] as NormalizedForeplayAd[],
            metaPageOutput: null,
          };
        }

        // Guard against Foreplay's domain->brand resolution returning the wrong
        // advertiser (most_ranked can resolve e.g. airtable.com to an unrelated
        // reseller). The brand was already resolved BY the competitor domain via
        // searchBrands(domain), so it is domain-anchored at the API level; the name
        // match catches most reseller drift. The live Foreplay API frequently omits
        // `brand.domain` (it is not always populated, despite the typed shape), so
        // we treat a brand domain as a REJECT signal ONLY when it is present AND
        // conflicts — never hard-require it (doing so both crashed on undefined and
        // zeroed all Foreplay recall in the 2026-06-03 live run).
        const brandDomainRaw =
          typeof brand.domain === "string" ? brand.domain.trim() : "";
        const brandDomainBase =
          brandDomainRaw.length > 0
            ? extractCompanyFromDomain(brandDomainRaw)
            : undefined;
        const targetDomainBase = extractCompanyFromDomain(targetDomain);
        const brandDomainConflicts =
          brandDomainBase !== undefined &&
          targetDomainBase !== undefined &&
          brandDomainBase !== targetDomainBase;

        if (
          brandDomainConflicts ||
          !isAdvertiserMatch(
            brand.name,
            advertiserRecord.advertiser,
            targetDomain,
          )
        ) {
          return {
            foreplay: [] as NormalizedForeplayAd[],
            metaPageOutput: null,
          };
        }

        // Part B — recover the brand's REAL Meta page ads via Foreplay's
        // domain-resolved page id, bypassing the conservative name/alias
        // resolution in the SearchAPI meta path (which quarantines legitimate
        // non-domain-shaped aliases like `rampcard`). Runs concurrently with the
        // Foreplay-native pull; both are domain-anchored by the brand guards
        // above, and the adapter still re-checks per-ad language + advertiser
        // reconciliation before anything reaches the verified wall.
        const metaPageId = extractForeplayMetaPageId(brand);
        const [foreplayAds, metaPageOutput] = await Promise.all([
          service.searchAds({
            brand_id: brandId,
            limit: competitorAdProbeForeplayMaxAds,
          }),
          metaPageId === undefined
            ? Promise.resolve(null)
            : fetchVerifiedMetaPageAds({
                advertiser: advertiserRecord.advertiser,
                domain: targetDomain,
                maxResults: competitorAdProbeMaxResults,
                pageId: metaPageId,
              }),
        ]);

        return {
          foreplay: foreplayAds.map((ad) => normalizeForeplayAd(ad)),
          metaPageOutput,
        };
      })(),
      competitorAdProbeForeplayDeadlineMs,
    );

    const pairs: ProbeToolPair[] = [];

    if (foreplay.length > 0) {
      pairs.push(
        ...buildForeplayToolPairs({ advertiserRecord, normalizedAds: foreplay }),
      );
    }

    // Synthetic meta_ads pair for the domain-verified Meta page ads (Part B).
    if (
      metaPageOutput !== null &&
      metaPageOutput.type === "result" &&
      metaPageOutput.ads.length > 0
    ) {
      pairs.push({
        toolCall: {
          toolName: "meta_ads",
          input: buildProbeToolInput(advertiserRecord),
        },
        toolResult: { toolName: "meta_ads", output: metaPageOutput },
      });
    }

    return pairs;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const input = buildProbeToolInput(advertiserRecord);
    const gap: ToolGap = {
      type: "gap",
      reason: "api_error",
      message: `Foreplay direct prepass failed for "${advertiserRecord.advertiser}": ${message}`,
    };

    return [
      {
        toolCall: { toolName: "meta_ads", input },
        toolResult: { toolName: "meta_ads", output: gap },
      },
    ];
  }
}

async function runCompetitorAdProbeAdvertiserStep({
  advertiserRecord,
  foreplayEnabled,
  googleAdsTool,
  index,
  linkedinAdsTool,
  metaAdsTool,
  signal,
}: {
  advertiserRecord: CompetitorAdProbeAdvertiser;
  foreplayEnabled: boolean;
  googleAdsTool: Tool<CompetitorAdProbeToolInput, unknown>;
  index: number;
  // LinkedIn is best-effort: when the tool is absent the probe stays google+meta.
  linkedinAdsTool?: Tool<CompetitorAdProbeToolInput, unknown>;
  metaAdsTool: Tool<CompetitorAdProbeToolInput, unknown>;
  signal: AbortSignal;
}): Promise<AgentStep> {
  const input = buildProbeToolInput(advertiserRecord);

  const searchApiTools: Array<{
    tool: Tool<CompetitorAdProbeToolInput, unknown>;
    toolName: SearchApiAdToolName;
  }> = [
    { tool: googleAdsTool, toolName: "google_ads" },
    { tool: metaAdsTool, toolName: "meta_ads" },
    ...(linkedinAdsTool === undefined
      ? []
      : [{ tool: linkedinAdsTool, toolName: "linkedin_ads" as const }]),
  ];

  // Per-channel failure isolation: a transport throw on one platform becomes a
  // structured gap rather than rejecting the whole advertiser step.
  const [searchApiPairs, foreplayPairs] = await Promise.all([
    Promise.all(
      searchApiTools.map(({ tool, toolName }) =>
        settleProbeTool({ input, signal, tool, toolName }),
      ),
    ),
    foreplayEnabled
      ? runForeplayPrepassForAdvertiser(advertiserRecord)
      : Promise.resolve<ProbeToolPair[]>([]),
  ]);

  const pairs = [...searchApiPairs, ...foreplayPairs];

  return {
    stepNumber: index,
    finishReason: "tool-calls",
    text: `Deterministic competitor ad evidence probe for ${advertiserRecord.advertiser}.`,
    toolCalls: pairs.map((pair) => pair.toolCall),
    toolResults: pairs.map((pair) => pair.toolResult),
  };
}

export async function runCompetitorAdProbeSteps({
  advertisers: explicitAdvertisers,
  maxAdvertisers,
  researchInput,
  researchTools,
  signal,
}: {
  // Explicit advertiser override used by the post-draft rescue probe (model-
  // discovered competitors). When omitted, advertisers derive from the
  // researchInput (brief competitorSeeds + fixture competitorAds) as before.
  advertisers?: readonly CompetitorAdProbeAdvertiser[];
  // When set, caps how many advertisers the probe covers. The reserved ad
  // budget is the binding constraint, so the caller passes the number of
  // advertisers the reserve can fully fund (google + meta + linkedin each).
  maxAdvertisers?: number;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<AgentStep[]> {
  const allAdvertisers =
    explicitAdvertisers ?? collectCompetitorAdProbeAdvertisers(researchInput);
  const cappedAdvertisers =
    maxAdvertisers === undefined
      ? allAdvertisers
      : allAdvertisers.slice(0, Math.max(0, maxAdvertisers));
  const hasGoogleAdsTool = hasExecutableTool(researchTools, "google_ads");
  const hasMetaAdsTool = hasExecutableTool(researchTools, "meta_ads");

  if (!hasGoogleAdsTool || !hasMetaAdsTool) {
    const [firstAdvertiser] = cappedAdvertisers;
    const advertiser = firstAdvertiser?.advertiser ?? "competitor ad evidence";
    const baseInput = {
      advertiser,
      max_results: competitorAdProbeMaxResults,
      ...(firstAdvertiser?.domain === undefined
        ? {}
        : { domain: firstAdvertiser.domain }),
    };
    const missingToolNames = [
      ...(hasGoogleAdsTool ? [] : (["google_ads"] as const)),
      ...(hasMetaAdsTool ? [] : (["meta_ads"] as const)),
    ];

    if (missingToolNames.length === 0) {
      return [];
    }

    return [
      {
        stepNumber: 0,
        finishReason: "tool-calls",
        text: "Competitor ad evidence probe could not run because required ad tools are unavailable.",
        toolCalls: missingToolNames.map((toolName) => ({
          toolName,
          input: baseInput,
        })),
        toolResults: missingToolNames.map((toolName) => ({
          toolName,
          output: {
            type: "gap",
            reason: "not_implemented",
            message: `${toolName} tool is unavailable; live competitor ad evidence could not be collected for "${advertiser}".`,
          },
        })),
      },
    ];
  }

  const topicContext = buildCompetitorAdTopicContext(researchInput);
  const advertisers = await resolveCompetitorAdProbeAdvertiserDomains({
    advertisers: cappedAdvertisers,
    clientDomain: researchInput.company.websiteUrl,
    signal,
    topicContext,
  });

  const googleAdsTool = getExecutableTool<CompetitorAdProbeToolInput>(
    researchTools,
    "google_ads",
  );
  const metaAdsTool = getExecutableTool<CompetitorAdProbeToolInput>(
    researchTools,
    "meta_ads",
  );
  // LinkedIn is best-effort: probe it only when the tool is present, and skip it
  // gracefully otherwise (it stays out of the hard google+meta guard above).
  const linkedinAdsTool = hasExecutableTool(researchTools, "linkedin_ads")
    ? getExecutableTool<CompetitorAdProbeToolInput>(
        researchTools,
        "linkedin_ads",
      )
    : undefined;
  // Resolve the Foreplay feature flag once for the whole probe; the per-advertiser
  // prepass additionally checks for a configured service + a usable domain.
  const foreplayEnabled = isForeplayEnabled();

  // Hard deadline so a slow ad API cannot drag the probe past the answer-tool
  // timeout. Combined with the parent signal; cleaned up in finally.
  const probeDeadline = createTimeoutSignal({
    parentSignal: signal,
    reasonLabel: "Competitor ad probe",
    timeoutMs: competitorAdProbeDeadlineMs,
  });

  try {
    return await mapWithBoundedConcurrency({
      concurrency: competitorAdProbeAdvertiserConcurrency,
      items: advertisers,
      mapper: (advertiserRecord, index) =>
        runCompetitorAdProbeAdvertiserStep({
          advertiserRecord,
          foreplayEnabled,
          googleAdsTool,
          index,
          linkedinAdsTool,
          metaAdsTool,
          signal: probeDeadline.signal,
        }),
    });
  } finally {
    probeDeadline.cleanup();
  }
}

async function callStructuredAttempt({
  definition,
  deps,
  input,
  maxOutputTokens,
  modelSteps,
  normalizedAdEvidenceGroups,
  prompt,
  researchInput,
  signal,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  maxOutputTokens?: number;
  modelSteps: readonly AgentStep[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  prompt: string;
  researchInput: ResearchInput;
  signal?: AbortSignal;
}): Promise<AttemptResult> {
  const callStructured = deps.callStructured ?? defaultStructuredCaller;
  const outputTimeoutMs = getDeadlineAwareModelTimeoutMs({
    deps,
    input,
    requestedMs: getStructuredOutputTimeoutMs(input.sectionId),
  });
  const timeoutSignal = createTimeoutSignal({
    parentSignal: signal,
    timeoutMs: outputTimeoutMs,
  });

  try {
    const rawOutput = await withStructuredTimeout(
      callStructured({
        model: getGenerationModel(),
        schema: getStructuredGenerationSchema(definition),
        schemaName: definition.sectionOutputSchemaName,
        schemaDescription: `${definition.title} section output for AI-GOS AI SDK Lab.`,
        prompt,
        maxOutputTokens: getStructuredOutputMaxTokens(definition, maxOutputTokens),
        signal: timeoutSignal.signal,
        telemetry: createLabSectionTelemetry({
          operation: "structured-output",
          runId: input.runId,
          schemaName: definition.sectionOutputSchemaName,
          sectionId: input.sectionId,
        }),
      }),
      outputTimeoutMs,
    );
    const output = definition.sectionOutputSchema.parse(
      withNormalizedSectionOutput({
        rawOutput,
        normalizedAdEvidenceGroups,
        sectionId: input.sectionId,
        subjectCompanyName: researchInput.company.name,
        subjectWebsiteUrl: researchInput.company.websiteUrl,
      }),
    );
    const verification = verifySectionBody({
      body: output.body,
      evidenceSteps: modelSteps,
      researchInput,
    });
    const artifact = buildEnvelope({
      definition,
      deps,
      input,
      output,
      verification,
    });
    const postRequiredEvidenceHook = ({
      artifact: candidateArtifact,
    }: PostRequiredEvidenceHookContext): HookOutcome => {
      if (input.sectionId === "positioningPaidMediaPlan") {
        // Media-Plan SOP channel policy — same gate as the answer-tool path,
        // so the single-call paid-media flow cannot ship Meta-templated
        // structures (labels included) on a forbidden-Meta brief.
        const channelPolicyErrors = checkPaidMediaChannelPolicy({
          body: candidateArtifact.body as PaidMediaPolicyCheckBody,
          policy: deriveChannelPolicy(researchInput.onboarding),
        });
        if (channelPolicyErrors.length > 0) {
          return { kind: "reject", errors: channelPolicyErrors };
        }
      }

      if (input.sectionId !== "positioningVoiceOfCustomer") {
        return { kind: "ok" };
      }

      const selfSourcing = checkVoiceOfCustomerSelfSourcing({
        artifact: candidateArtifact,
        subjectDomain: researchInput.company.websiteUrl,
      });

      if (!selfSourcing.ok) {
        return {
          kind: "reject",
          errors: selfSourcing.errors,
          gapArtifact: buildVoiceOfCustomerAttemptEvidenceGapArtifact({
            artifact: candidateArtifact,
            definition,
            deps,
            errors: selfSourcing.errors,
            input,
            researchInput,
          }),
        };
      }

      const modelAuthoredGapIssue =
        getVoiceOfCustomerModelAuthoredEvidenceGapIssue({
          artifact: candidateArtifact,
          input,
        });
      if (modelAuthoredGapIssue !== null) {
        return { kind: "reject", errors: [modelAuthoredGapIssue] };
      }

      return { kind: "ok" };
    };

    const verdict = evaluateCommittableAttempt({
      artifact,
      definition,
      env: deps.env ?? process.env,
      postRequiredEvidenceHook,
      verification,
    });

    if (verdict.kind === "minimumsFailed") {
      return {
        output,
        artifact: null,
        buyerICPEvidenceGapArtifact:
          buildBuyerICPPersonaEvidenceGapArtifact({
            artifact,
            definition,
            errors: [...verdict.errors],
            input,
          }),
        competitorStrategicEvidenceGapArtifact:
          buildCompetitorStrategicEvidenceGapArtifact({
            artifact,
            definition,
            errors: [...verdict.errors],
            input,
          }),
        errors: [...verdict.errors],
        voiceOfCustomerEvidenceGapArtifact:
          buildVoiceOfCustomerAttemptEvidenceGapArtifact({
            artifact,
            definition,
            deps,
            errors: [...verdict.errors],
            input,
            researchInput,
          }),
      };
    }

    if (verdict.kind === "requiredEvidenceMissing") {
      const failure = new RequiredEvidenceMissingError({
        missingClass: verdict.missingClass,
        sectionId: input.sectionId,
        unsupportedCount: verdict.unsupportedCount,
        verifiedCount: verdict.verifiedCount,
      });

      return {
        output,
        artifact: null,
        errors: [failure.message],
        requiredEvidenceMissing: failure,
      };
    }

    if (verdict.kind === "hookReject") {
      return {
        output,
        artifact: null,
        errors: [...verdict.errors],
        ...(input.sectionId === "positioningVoiceOfCustomer" &&
        verdict.gapArtifact !== undefined
          ? { voiceOfCustomerEvidenceGapArtifact: verdict.gapArtifact }
          : {}),
      };
    }

    if (verdict.kind === "evidenceShortfall") {
      return {
        output,
        artifact: annotateEvidenceSupportReview({
          artifact: verdict.committableArtifact,
          sectionId: input.sectionId,
          shortfall: verdict.shortfall,
        }),
        errors: [],
        evidenceSupportShortfall: verdict.shortfall,
      };
    }

    return {
      output,
      artifact: annotateEvidenceSupportReview({
        artifact: verdict.committableArtifact,
        sectionId: input.sectionId,
        shortfall: verdict.shortfall,
      }),
      errors: [],
      ...(verdict.shortfall === undefined
        ? {}
        : { evidenceSupportShortfall: verdict.shortfall }),
    };
  } catch (error) {
    return { output: null, artifact: null, errors: getErrorIssues(error) };
  } finally {
    timeoutSignal.cleanup();
  }
}

async function buildAnswerToolAdEvidence({
  deps,
  input,
  maxAdvertisers,
  researchInput,
  researchTools,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  maxAdvertisers?: number;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
}): Promise<{
  adProbeSteps: readonly AgentStep[];
  events: ActivityEvent[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
}> {
  if (input.sectionId !== "positioningCompetitorLandscape") {
    return { adProbeSteps: [], events: [] };
  }

  const adProbeSteps = await runCompetitorAdProbeSteps({
    maxAdvertisers,
    researchInput,
    researchTools,
    signal: input.signal,
  });
  const events = adProbeSteps.flatMap((step) =>
    buildToolEvents({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      step,
    }),
  );
  const normalizedAdEvidenceGroups = buildCompetitorAdEvidenceGroups({
    steps: adProbeSteps,
    observedAt: getNow(deps).toISOString(),
    topicContext: buildCompetitorAdTopicContext(researchInput),
  });

  return { adProbeSteps, events, normalizedAdEvidenceGroups };
}

// Pull the section agent's discovered competitor set out of the drafted answer
// payload (body.competitorSet.competitors[]): name is the advertiser, domain is
// derived from the competitor's url when parseable. Defensive over unknown
// because the payload is pre-schema-parse on the answer-tool path.
function extractDiscoveredCompetitorAdvertisers(
  answerInput: unknown,
): CompetitorAdProbeAdvertiser[] {
  const bodyRecord = getRecord(getRecord(answerInput)?.body);
  const competitorSetRecord = getRecord(bodyRecord?.competitorSet);
  const competitors = Array.isArray(competitorSetRecord?.competitors)
    ? competitorSetRecord.competitors
    : [];
  const advertisers = new Map<string, CompetitorAdProbeAdvertiser>();

  for (const competitor of competitors) {
    const competitorRecord = getRecord(competitor);
    const name = getStringProperty(competitorRecord, "name");

    if (name === null) {
      continue;
    }

    // Status-quo and DIY entries are buyer workflows ("spreadsheet pipeline
    // review", "founder memory"), not advertisers — probing ad libraries for
    // them spends paid lookups on guaranteed misses (and invites same-name
    // wrong-company matches). Surfaced when W5 raised the probe cap to the
    // full discovered set.
    const competitorType = getStringProperty(competitorRecord, "competitorType");

    if (competitorType === "status-quo" || competitorType === "diy") {
      continue;
    }

    const key = name.toLowerCase();

    if (advertisers.has(key)) {
      continue;
    }

    const domain = deriveDomainFromUrl(
      getStringProperty(competitorRecord, "url"),
    );
    advertisers.set(key, {
      advertiser: name,
      ...(domain === undefined ? {} : { domain }),
    });
  }

  return Array.from(advertisers.values());
}

// Post-draft rescue probe (competitor landscape only). When the GTM brief gave
// zero competitor seeds, the deterministic ad prepass probed nothing — but the
// section agent typically DISCOVERS real competitors while drafting (runs
// f06333b6 + 0eeebd93 shipped a gap-only wall despite a populated
// competitorSet). Rescue = run those discovered advertisers through the same
// deterministic probe once, post-loop, and hand the steps/groups back to the
// caller's EXISTING merge path. Fires only in the starved-seed case: a prepass
// that RAN always emits >=1 step (even with 0 ads found, or with the ad tools
// missing), so zero prepass steps <=> getCompetitorAdProbeAdvertisers() was
// empty AND google+meta tools are available. With brief seeds present this
// returns undefined and behavior is byte-identical to before.
async function runCompetitorAdRescueProbe({
  answerInput,
  deps,
  input,
  maxAdvertisers,
  prepassAdProbeSteps,
  researchInput,
  researchTools,
}: {
  answerInput: unknown;
  deps: RunSectionDeps;
  input: RunSectionInput;
  maxAdvertisers?: number;
  prepassAdProbeSteps: readonly AgentStep[];
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
}): Promise<
  | {
      events: ActivityEvent[];
      groups: readonly CompetitorAdEvidenceGroup[];
      steps: readonly AgentStep[];
    }
  | undefined
> {
  if (input.sectionId !== "positioningCompetitorLandscape") {
    return undefined;
  }

  // Only the starved-seed case: never a second probe when the first probe ran,
  // even if it found 0 ads (those gaps are already honest evidence).
  if (prepassAdProbeSteps.length > 0) {
    return undefined;
  }

  // Yield to the 270s job AbortController: never start fresh paid ad lookups
  // once the section has been aborted.
  if (input.signal?.aborted === true) {
    return undefined;
  }

  const advertisers = extractDiscoveredCompetitorAdvertisers(answerInput);

  if (advertisers.length === 0) {
    return undefined;
  }

  const steps = await runCompetitorAdProbeSteps({
    advertisers,
    maxAdvertisers,
    researchInput,
    researchTools,
    signal: input.signal,
  });

  if (steps.length === 0) {
    return undefined;
  }

  const events = steps.flatMap((step) =>
    buildToolEvents({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      step,
    }),
  );
  // Same observedAt + topicContext as the prepass adapter so recovered
  // creatives get the identical relevance badging (topicBadge) and dedup keys.
  const groups = buildCompetitorAdEvidenceGroups({
    steps,
    observedAt: getNow(deps).toISOString(),
    topicContext: buildCompetitorAdTopicContext(researchInput),
  }).map((group) => ({
    ...group,
    dataGaps: [...group.dataGaps, { reason: competitorAdRescueProbeNote }],
  }));

  return { events, groups, steps };
}

interface VoiceOfCustomerCandidatePrepass {
  acquisitionAttempts: VoiceOfCustomerAcquisitionAttempt[];
  acquisitionLedger: VoiceOfCustomerAcquisitionLedgerRow[];
  candidateBlock: string;
  classCandidates: VoiceOfCustomerClassCandidates;
  events: ActivityEvent[];
  result: VoiceOfCustomerCandidateResult;
  steps: AgentStep[];
  subjectDomain: string | null;
}

interface VoiceOfCustomerToolCallResult {
  output: unknown;
  step: AgentStep;
}

interface VoiceOfCustomerRecoveryTarget {
  source: Extract<VoiceOfCustomerCandidateSource, "reviews" | "web_search">;
  evidenceKind: VoiceOfCustomerEvidenceKind;
  title: string;
  url: string;
  domain: string;
}

interface VoiceOfCustomerCandidateCollection {
  candidates: VoiceOfCustomerCandidate[];
  recoveryTargets: VoiceOfCustomerRecoveryTarget[];
}

function buildResearchInputVoiceOfCustomerCandidates(
  researchInput: ResearchInput,
): VoiceOfCustomerCandidate[] {
  const excerpts =
    researchInput.corpus.sectionExcerpts?.positioningVoiceOfCustomer ??
    researchInput.corpus.excerpts;

  return excerpts.flatMap((excerpt) => {
    const domain = getRegistrableDomain(excerpt.sourceUrl);
    if (domain === null) {
      return [];
    }

    const evidenceKind = inferVoiceOfCustomerEvidenceKind({
      domain,
      source: "researchInput",
      snippet: excerpt.text,
      title: excerpt.title,
      url: excerpt.sourceUrl,
    });

    if (evidenceKind === "article") {
      return [];
    }

    const candidate = createVoiceOfCustomerCandidate({
      acquisitionMode: acquisitionModeForEvidenceKind(evidenceKind),
      auditedCompanyDomain: researchInput.company.websiteUrl,
      evidenceKind,
      source: "researchInput",
      title: excerpt.title,
      url: excerpt.sourceUrl,
      snippet: excerpt.text,
    });

    return candidate === null ? [] : [candidate];
  });
}

function readVoiceOfCustomerAcquisitionMode(
  value: unknown,
): VoiceOfCustomerAcquisitionMode | null {
  if (
    value === "review_body" ||
    value === "forum_comment" ||
    value === "support_thread"
  ) {
    return value;
  }

  return null;
}

function createVoiceOfCustomerRecoveryTarget({
  auditedCompanyDomain,
  evidenceKind,
  source,
  title,
  url,
}: {
  auditedCompanyDomain: string;
  evidenceKind?: VoiceOfCustomerEvidenceKind;
  source: Extract<VoiceOfCustomerCandidateSource, "reviews" | "web_search">;
  title?: string;
  url: string;
}): VoiceOfCustomerRecoveryTarget | null {
  const candidate = createVoiceOfCustomerCandidate({
    acquisitionMode: acquisitionModeForEvidenceKind(
      evidenceKind ?? "support-thread",
    ),
    auditedCompanyDomain,
    evidenceKind,
    source,
    title,
    url,
    snippet: "Pending quote recovery from a third-party surface.",
  });

  if (candidate === null || candidate.evidenceKind === "article") {
    return null;
  }

  return {
    source,
    evidenceKind: candidate.evidenceKind,
    title: candidate.title,
    url: candidate.url,
    domain: candidate.domain,
  };
}

function oneVoiceOfCustomerCandidateCollection({
  candidate,
  recoveryTarget,
}: {
  candidate: VoiceOfCustomerCandidate | null;
  recoveryTarget: VoiceOfCustomerRecoveryTarget | null;
}): VoiceOfCustomerCandidateCollection {
  return {
    candidates: candidate === null ? [] : [candidate],
    recoveryTargets: recoveryTarget === null ? [] : [recoveryTarget],
  };
}

function emptyVoiceOfCustomerCandidateCollection(): VoiceOfCustomerCandidateCollection {
  return { candidates: [], recoveryTargets: [] };
}

function mergeCandidateCollections(
  collections: readonly VoiceOfCustomerCandidateCollection[],
): VoiceOfCustomerCandidateCollection {
  return collections.reduce<VoiceOfCustomerCandidateCollection>(
    (merged, collection) => ({
      candidates: [...merged.candidates, ...collection.candidates],
      recoveryTargets: [
        ...merged.recoveryTargets,
        ...collection.recoveryTargets,
      ],
    }),
    emptyVoiceOfCustomerCandidateCollection(),
  );
}

function buildReviewVoiceOfCustomerCandidates({
  output,
  researchInput,
}: {
  output: unknown;
  researchInput: ResearchInput;
}): VoiceOfCustomerCandidateCollection {
  const outputRecord = getRecord(output);

  if (outputRecord?.type !== "result" || !Array.isArray(outputRecord.excerpts)) {
    return emptyVoiceOfCustomerCandidateCollection();
  }

  return mergeCandidateCollections(
    outputRecord.excerpts.map((item) => {
      const itemRecord = getRecord(item);
      const url = getStringProperty(itemRecord, "url");
      const acquisitionMode = readVoiceOfCustomerAcquisitionMode(
        itemRecord?.acquisitionMode,
      );
      const reviewText = getStringProperty(itemRecord, "reviewText");
      const sourceInstanceId = getStringProperty(itemRecord, "sourceInstanceId");
      const title = getStringProperty(itemRecord, "source") ?? "Review excerpt";

      if (itemRecord === null || url === null) {
        return emptyVoiceOfCustomerCandidateCollection();
      }

      const hasReviewText =
        reviewText !== null &&
        reviewText.trim().length > 0 &&
        acquisitionMode !== null;
      const candidate = hasReviewText
        ? createVoiceOfCustomerCandidate({
            acquisitionMode,
            auditedCompanyDomain: researchInput.company.websiteUrl,
            evidenceKind: "review",
            source: "reviews",
            title,
            url,
            snippet: reviewText,
            ...(sourceInstanceId === null ? {} : { sourceInstanceId }),
          })
        : null;
      const recoveryTarget = hasReviewText
        ? null
        : createVoiceOfCustomerRecoveryTarget({
            auditedCompanyDomain: researchInput.company.websiteUrl,
            evidenceKind: "review",
            source: "reviews",
            title,
            url,
          });

      return oneVoiceOfCustomerCandidateCollection({
        candidate,
        recoveryTarget,
      });
    }),
  );
}

function getStringArrayProperty(
  value: Record<string, unknown> | null,
  key: string,
): string[] {
  const propertyValue = value?.[key];

  if (!Array.isArray(propertyValue)) {
    return [];
  }

  return propertyValue.flatMap((item) => {
    if (typeof item !== "string") {
      return [];
    }

    const trimmed = item.trim();
    return trimmed.length === 0 ? [] : [trimmed];
  });
}

function hasVoiceOfCustomerSpeakerSignal(snippet: string): boolean {
  return /\b(users|customers|reviewers|teams|operators|finance teams|founders|admins)\s+(say|said|complain|complained|mention|mentioned|report|reported|describe|described|struggle|struggled)\b/i.test(
    snippet,
  );
}

function hasVoiceOfCustomerPainSignal(snippet: string): boolean {
  return /\b(manual|slow|missed|handoff|handoffs|scattered|confusing|cleanup|approval|approvals|support|expensive|hard to|difficult|pain|complaint|complaints|friction|blocked|delay|delays|trust)\b/i.test(
    snippet,
  );
}

function isPromotableVoiceOfCustomerSearchSnippet(snippet: string): boolean {
  return (
    snippet.length >= 40 &&
    hasVoiceOfCustomerSpeakerSignal(snippet) &&
    hasVoiceOfCustomerPainSignal(snippet)
  );
}

function inferWebSearchVoiceOfCustomerEvidenceKind({
  domain,
  snippet,
  title,
  url,
}: {
  domain: string;
  snippet: string;
  title: string;
  url: string;
}): VoiceOfCustomerEvidenceKind {
  const inferred = inferVoiceOfCustomerEvidenceKind({
    domain,
    source: "web_search",
    snippet,
    title,
    url,
  });

  if (inferred !== "article") {
    return inferred;
  }

  return /\breviews?\b/i.test(`${title} ${url}`) ? "review" : "article";
}

function buildWebSearchSnippetVoiceOfCustomerCandidates({
  itemRecord,
  researchInput,
  title,
  url,
}: {
  itemRecord: Record<string, unknown>;
  researchInput: ResearchInput;
  title: string;
  url: string;
}): VoiceOfCustomerCandidate[] {
  const domain = getRegistrableDomain(url);

  if (domain === null) {
    return [];
  }

  const snippets = [
    getStringProperty(itemRecord, "description"),
    ...getStringArrayProperty(itemRecord, "extra_snippets"),
  ].filter((snippet): snippet is string => snippet !== null);

  return snippets.flatMap((snippet, index) => {
    if (!isPromotableVoiceOfCustomerSearchSnippet(snippet)) {
      return [];
    }

    const evidenceKind = inferWebSearchVoiceOfCustomerEvidenceKind({
      domain,
      snippet,
      title,
      url,
    });

    if (evidenceKind === "article") {
      return [];
    }

    const candidate = createVoiceOfCustomerCandidate({
      acquisitionMode: acquisitionModeForEvidenceKind(evidenceKind),
      auditedCompanyDomain: researchInput.company.websiteUrl,
      evidenceKind,
      source: "web_search",
      sourceInstanceId: `${url}#snippet-${index + 1}`,
      title,
      url,
      snippet,
    });

    return candidate === null ? [] : [candidate];
  });
}

function parseVoiceOfCustomerAcquisitionAttempt(
  value: unknown,
): VoiceOfCustomerAcquisitionAttempt | null {
  const record = getRecord(value);
  const url = getStringProperty(record, "url");
  const domain = getStringProperty(record, "domain");
  const source = getStringProperty(record, "source");
  const acquisitionMode = readVoiceOfCustomerAcquisitionMode(
    record?.acquisitionMode,
  );
  const status = getStringProperty(record, "status");

  if (
    url === null ||
    domain === null ||
    source === null ||
    acquisitionMode === null ||
    (status !== "succeeded" && status !== "failed")
  ) {
    return null;
  }

  const gapReason = getStringProperty(record, "gapReason");
  const message = getStringProperty(record, "message");
  const title = getStringProperty(record, "title");

  return {
    acquisitionMode,
    domain,
    ...(gapReason === null
      ? {}
      : {
          gapReason: gapReason as VoiceOfCustomerAcquisitionAttempt["gapReason"],
        }),
    ...(message === null ? {} : { message }),
    source,
    status,
    ...(title === null ? {} : { title }),
    url,
  };
}

function extractVoiceOfCustomerAcquisitionAttempts(
  output: unknown,
): VoiceOfCustomerAcquisitionAttempt[] {
  const outputRecord = getRecord(output);
  if (outputRecord?.type !== "result" || !Array.isArray(outputRecord.attempts)) {
    return [];
  }

  return outputRecord.attempts
    .map(parseVoiceOfCustomerAcquisitionAttempt)
    .filter(
      (attempt): attempt is VoiceOfCustomerAcquisitionAttempt =>
        attempt !== null,
    );
}

function dedupeVoiceOfCustomerRecoveryTargets(
  targets: readonly VoiceOfCustomerRecoveryTarget[],
): VoiceOfCustomerRecoveryTarget[] {
  const seenUrls = new Set<string>();
  const dedupedTargets: VoiceOfCustomerRecoveryTarget[] = [];

  for (const target of targets) {
    if (seenUrls.has(target.url)) {
      continue;
    }

    seenUrls.add(target.url);
    dedupedTargets.push(target);
  }

  return dedupedTargets;
}

function buildWebSearchVoiceOfCustomerCandidates({
  output,
  researchInput,
}: {
  output: unknown;
  researchInput: ResearchInput;
}): VoiceOfCustomerCandidateCollection {
  const outputRecord = getRecord(output);

  if (outputRecord?.type !== "result" || !Array.isArray(outputRecord.results)) {
    return emptyVoiceOfCustomerCandidateCollection();
  }

  return mergeCandidateCollections(
    outputRecord.results.map((item) => {
      const itemRecord = getRecord(item);
      const url = getStringProperty(itemRecord, "url");
      const title = getStringProperty(itemRecord, "title") ?? "Search result";

      if (itemRecord === null || url === null) {
        return emptyVoiceOfCustomerCandidateCollection();
      }

      const candidates = buildWebSearchSnippetVoiceOfCustomerCandidates({
        itemRecord,
        researchInput,
        title,
        url,
      });
      const recoveryTarget = createVoiceOfCustomerRecoveryTarget({
        auditedCompanyDomain: researchInput.company.websiteUrl,
        source: "web_search",
        title,
        url,
      });

      return {
        candidates,
        recoveryTargets: recoveryTarget === null ? [] : [recoveryTarget],
      };
    }),
  );
}

function buildFirecrawlVoiceOfCustomerCandidate({
  evidenceKind,
  output,
  researchInput,
}: {
  evidenceKind: VoiceOfCustomerEvidenceKind;
  output: unknown;
  researchInput: ResearchInput;
}): VoiceOfCustomerCandidate | null {
  const outputRecord = getRecord(output);

  if (outputRecord?.type !== "result") {
    return null;
  }

  const markdown = getStringProperty(outputRecord, "markdown");
  const sourceUrl =
    getStringProperty(outputRecord, "sourceUrl") ??
    getStringProperty(outputRecord, "url");
  const title = getStringProperty(outputRecord, "title") ?? "Recovered quote";

  if (markdown === null || sourceUrl === null) {
    return null;
  }

  return createVoiceOfCustomerCandidate({
    acquisitionMode: acquisitionModeForEvidenceKind(evidenceKind),
    auditedCompanyDomain: researchInput.company.websiteUrl,
    evidenceKind,
    source: "firecrawl",
    title,
    url: sourceUrl,
    snippet: markdown,
  });
}

function getPrepassExecutableTool(
  researchTools: Record<string, unknown>,
  toolName: ToolName,
): Tool<unknown, unknown> | null {
  const tool = researchTools[toolName] as Tool<unknown, unknown> | undefined;

  return typeof tool?.execute === "function" ? tool : null;
}

async function executeVoiceOfCustomerPrepassTool({
  input,
  researchTools,
  stepNumber,
  toolInput,
  toolName,
}: {
  input: RunSectionInput;
  researchTools: Record<string, unknown>;
  stepNumber: number;
  toolInput: unknown;
  toolName: ToolName;
}): Promise<VoiceOfCustomerToolCallResult | null> {
  const tool = getPrepassExecutableTool(researchTools, toolName);

  if (tool === null || tool.execute === undefined) {
    return null;
  }

  let output: unknown;
  try {
    output = await tool.execute(toolInput, {
      abortSignal: input.signal,
    } as ToolExecutionOptions);
  } catch {
    // Best-effort prepass: a tool failure OR a prepass-deadline abort
    // (voiceOfCustomerPrepassDeadlineMs) must not fail the whole section. Skip
    // this lookup and let candidate selection proceed with whatever evidence was
    // already gathered — a fast honest gap beats a 270s orphaned abort.
    return null;
  }

  return {
    output,
    step: {
      stepNumber,
      finishReason: "tool-calls",
      text: `Voice of Customer candidate prepass used ${toolName}.`,
      toolCalls: [{ toolName, input: toolInput }],
      toolResults: [
        {
          toolName,
          input: toolInput,
          output,
          type: "tool-result",
        },
      ],
    },
  };
}

function buildVoiceOfCustomerSearchQuery(
  researchInput: ResearchInput,
  subjectDomain: string | null,
): string {
  const brand = researchInput.company.name.trim();
  // Bare-brand queries are dangerously ambiguous: the Anura run surfaced
  // r/TrueFilm threads about the film "Anora". Carry the category so the
  // SERP locks onto the product, not a homonym.
  const category = researchInput.company.category.trim();
  const domainExclusion =
    subjectDomain === null ? "" : ` -site:${subjectDomain}`;

  return `${brand} ${category} customer reviews complaints pain points reddit forum G2 Capterra Trustpilot${domainExclusion}`;
}

function normalizeVoiceOfCustomerReviewQuery(value: string): string | null {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length === 0 ||
    /^unknown\b/i.test(normalized) ||
    /^no\s+/i.test(normalized)
    ? null
    : normalized;
}

function buildVoiceOfCustomerReviewQueries(
  researchInput: ResearchInput,
): string[] {
  // VoC must capture the SUBJECT company's buyer voice only. Including
  // competitorSeeds polluted Ramp's VoC with Brex/Tipalti reviews (W2.4
  // de-contamination). Scope the prepass strictly to subject-brand variants —
  // never competitorSeeds. The "reviews"/"complaints" variants widen live
  // retrieval so more candidates clear the shared floor (B1); the loop in
  // buildVoiceOfCustomerCandidatePrepass stops as soon as the pack is valid.
  // Every variant carries the category disambiguator: the bare brand query on
  // the Anura run surfaced movie-subreddit threads for the film "Anora"
  // through the reviews tool's site:reddit.com filter. The tool appends its
  // own review terms + site filters; the prepass owns brand disambiguation.
  const companyName = researchInput.company.name;
  const category = researchInput.company.category.trim();
  const rawQueries = [
    `${companyName} ${category}`,
    `${companyName} ${category} reviews`,
    `${companyName} ${category} complaints`,
  ];
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const rawQuery of rawQueries) {
    const query = normalizeVoiceOfCustomerReviewQuery(rawQuery);
    const key = query?.toLowerCase();

    if (query === null || key === undefined || seen.has(key)) {
      continue;
    }

    seen.add(key);
    queries.push(query);

    if (queries.length >= VOC_PREPASS_MAX_LOOKUPS) {
      break;
    }
  }

  return queries;
}

function getFirecrawlRecoveryTarget({
  candidates,
  recoveryTargets,
  result,
}: {
  candidates: readonly VoiceOfCustomerCandidate[];
  recoveryTargets: readonly VoiceOfCustomerRecoveryTarget[];
  result: VoiceOfCustomerCandidateResult;
}): VoiceOfCustomerRecoveryTarget | null {
  if (result.ok) {
    return null;
  }

  const existingUrls = new Set(candidates.map((candidate) => candidate.url));
  const existingDomains = new Set(
    candidates.map((candidate) => candidate.domain),
  );
  const targets = dedupeVoiceOfCustomerRecoveryTargets(recoveryTargets).filter(
    (target) => !existingUrls.has(target.url),
  );

  if (targets.length === 0) {
    return null;
  }

  if (result.gap.reason === "insufficient_independent_domains") {
    return (
      targets.find((target) => !existingDomains.has(target.domain)) ?? targets[0]
    );
  }

  return targets[0];
}

function getFirecrawlEnrichmentTarget(
  result: VoiceOfCustomerCandidateResult,
): VoiceOfCustomerRecoveryTarget | null {
  if (!result.ok) {
    return null;
  }

  const candidate = result.pack.candidates.find(
    (item) => item.evidenceKind !== "article" && item.source !== "firecrawl",
  );

  if (candidate === undefined) {
    return null;
  }

  return {
    source:
      candidate.source === "reviews" || candidate.source === "web_search"
        ? candidate.source
        : "web_search",
    evidenceKind: candidate.evidenceKind,
    title: candidate.title,
    url: candidate.url,
    domain: candidate.domain,
  };
}

async function buildVoiceOfCustomerCandidatePrepass({
  deps,
  input,
  researchInput,
  researchTools,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
}): Promise<VoiceOfCustomerCandidatePrepass> {
  const subjectDomain = getRegistrableDomain(researchInput.company.websiteUrl);
  const candidates = buildResearchInputVoiceOfCustomerCandidates(researchInput);
  const recoveryTargets: VoiceOfCustomerRecoveryTarget[] = [];
  const steps: AgentStep[] = [];
  let result = selectVoiceOfCustomerCandidates(candidates);
  const tryTool = async (
    toolName: ToolName,
    toolInput: unknown,
  ): Promise<unknown | null> => {
    if (steps.length >= VOC_PREPASS_MAX_LOOKUPS) {
      return null;
    }

    const toolResult = await executeVoiceOfCustomerPrepassTool({
      input,
      researchTools,
      stepNumber: steps.length + 1,
      toolInput,
      toolName,
    });

    if (toolResult === null) {
      return null;
    }

    steps.push(toolResult.step);
    return toolResult.output;
  };

  const acquisitionAttempts: VoiceOfCustomerAcquisitionAttempt[] = [];
  const acquisitionAttemptsWithQuery: VoiceOfCustomerAcquisitionAttemptWithQuery[] =
    [];
  for (const reviewQuery of buildVoiceOfCustomerReviewQueries(researchInput)) {
    const reviewOutput = await tryTool("reviews", {
      brand: reviewQuery,
      max_body_pages: VOC_PREPASS_REVIEW_BODY_MAX_PAGES,
      max_results: VOC_CANDIDATE_PACK_MAX_SIZE,
      mode: "bodies",
    });
    const reviewAttempts =
      extractVoiceOfCustomerAcquisitionAttempts(reviewOutput);
    acquisitionAttempts.push(...reviewAttempts);
    acquisitionAttemptsWithQuery.push(
      ...reviewAttempts.map((attempt) => ({ attempt, query: reviewQuery })),
    );
    const reviewCandidates = buildReviewVoiceOfCustomerCandidates({
      output: reviewOutput,
      researchInput,
    });
    candidates.push(...reviewCandidates.candidates);
    recoveryTargets.push(...reviewCandidates.recoveryTargets);
    result = selectVoiceOfCustomerCandidates(candidates);

    if (result.ok || steps.length >= VOC_PREPASS_MAX_LOOKUPS - 1) {
      break;
    }
  }

  const webSearchQuery = buildVoiceOfCustomerSearchQuery(
    researchInput,
    subjectDomain,
  );
  const webSearchOutput = await tryTool("web_search", {
    q: webSearchQuery,
    count: VOC_CANDIDATE_PACK_MAX_SIZE,
    country: "US",
  });
  const webSearchCandidates = buildWebSearchVoiceOfCustomerCandidates({
    output: webSearchOutput,
    researchInput,
  });
  candidates.push(...webSearchCandidates.candidates);
  recoveryTargets.push(...webSearchCandidates.recoveryTargets);

  result = selectVoiceOfCustomerCandidates(candidates);
  const firecrawlTarget =
    getFirecrawlEnrichmentTarget(result) ??
    getFirecrawlRecoveryTarget({
      candidates,
      recoveryTargets,
      result,
    });

  if (firecrawlTarget !== null && steps.length < VOC_PREPASS_MAX_LOOKUPS) {
    const firecrawlOutput = await tryTool("firecrawl", {
      url: firecrawlTarget.url,
      onlyMainContent: true,
    });
    const recoveredCandidate = buildFirecrawlVoiceOfCustomerCandidate({
      evidenceKind: firecrawlTarget.evidenceKind,
      output: firecrawlOutput,
      researchInput,
    });

    if (recoveredCandidate !== null) {
      candidates.push(recoveredCandidate);
      result = selectVoiceOfCustomerCandidates(candidates);
    }
  }

  // W1a: after the pain loop settles, acquire all five quote classes via
  // parallel perplexity calls — the four SECONDARY classes for the tagged
  // candidate block plus a PAIN rescue channel (the Anura rerun proved
  // quotable pain can span <3 domains even when the candidate pack clears
  // its floors). The fan-out runs even on a pain-pack gap: a rescued pain
  // class can un-doom the section.
  let classCandidates = createEmptyVoiceOfCustomerClassCandidates();
  {
    const classSteps: AgentStep[] = [];
    // The class fan-out runs against the UNWRAPPED perplexity tool: its
    // structural cap (VOC_CLASS_MAX_PERPLEXITY_CALLS) IS its budget. Drawing
    // from the section's generic pool starved both the fan-out retries and
    // the agent loop's own lookups on the Anura rerun ("section budget
    // exhausted after 8 lookups").
    const classLookupTools: Record<string, unknown> = {
      perplexity_research: perplexityResearchAgentTool,
    };
    const classAcquisition = await acquireVoiceOfCustomerClassCandidates({
      company: {
        category: researchInput.company.category,
        name: researchInput.company.name,
        websiteUrl: researchInput.company.websiteUrl,
      },
      executeLookup: async (question: string): Promise<unknown> => {
        const toolResult = await executeVoiceOfCustomerPrepassTool({
          input,
          researchTools: classLookupTools,
          stepNumber: 0,
          toolInput: { question, recency: "any" },
          toolName: "perplexity_research",
        });

        if (toolResult === null) {
          return null;
        }

        classSteps.push(toolResult.step);
        return toolResult.output;
      },
    });
    classCandidates = classAcquisition.candidatesByClass;
    // Lookups ran in parallel, so renumber sequentially after the existing
    // pain-loop steps before they join the shared step list.
    classSteps.forEach((step, index) => {
      step.stepNumber = steps.length + index + 1;
    });
    steps.push(...classSteps);

    // Pain-class rescue candidates join the PAIN pack through the same
    // selector (dedup, ranking, per-domain caps, floors) — verbatim by
    // acquisition contract, so they widen the independent-domain spread the
    // commit floor demands.
    if (classCandidates.pain.length > 0) {
      candidates.push(...classCandidates.pain);
      result = selectVoiceOfCustomerCandidates(candidates);
    }
  }

  const acquisitionLedger = buildVoiceOfCustomerAcquisitionLedger({
    attempts: acquisitionAttemptsWithQuery,
    candidates,
    observedAt: getNow(deps).toISOString(),
    result,
    sourceQueries: {
      firecrawl: "firecrawl quote recovery",
      researchInput: "researchInput.sectionExcerpts.positioningVoiceOfCustomer",
      web_search: webSearchQuery,
    },
  });
  const events = steps.flatMap((step) =>
    buildToolEvents({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      step,
    }),
  );

  return {
    acquisitionAttempts,
    acquisitionLedger,
    candidateBlock: [
      formatVoiceOfCustomerCandidateBlock(result),
      ...(result.ok
        ? [formatVoiceOfCustomerClassCandidateBlock(classCandidates)]
        : []),
    ].join("\n\n"),
    classCandidates,
    events,
    result,
    steps,
    subjectDomain,
  };
}

interface BuyerPersonaCandidatePrepass {
  candidateBlock: string;
  candidates: BuyerPersonaCandidate[];
  events: ActivityEvent[];
  steps: AgentStep[];
}

// Venue fan-out is 2 parallel perplexity calls + at most one retry each;
// bounded so a slow venue pass cannot eat the section budget.
const buyerPersonaPrepassDeadlineMs = 45_000;

async function buildBuyerPersonaCandidatePrepass({
  deps,
  input,
  researchInput,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
}): Promise<BuyerPersonaCandidatePrepass> {
  const prepassSignal = createTimeoutSignal({
    parentSignal: input.signal,
    reasonLabel: "Buyer persona venue prepass",
    timeoutMs: buyerPersonaPrepassDeadlineMs,
  });
  const steps: AgentStep[] = [];
  // Unwrapped tool: the venue pass has its own structural cap and must not
  // drain the agent loop's generic lookup pool (same rationale as the VoC
  // class fan-out).
  const lookupTools: Record<string, unknown> = {
    perplexity_research: perplexityResearchAgentTool,
  };

  try {
    const acquisition = await acquireBuyerPersonaCandidates({
      company: {
        category: researchInput.company.category,
        name: researchInput.company.name,
        websiteUrl: researchInput.company.websiteUrl,
      },
      executeLookup: async (question: string): Promise<unknown> => {
        const toolResult = await executeVoiceOfCustomerPrepassTool({
          input: { ...input, signal: prepassSignal.signal },
          researchTools: lookupTools,
          stepNumber: 0,
          toolInput: { question, recency: "any" },
          toolName: "perplexity_research",
        });

        if (toolResult === null) {
          return null;
        }

        steps.push(toolResult.step);
        return toolResult.output;
      },
    });

    steps.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    return {
      candidateBlock: formatBuyerPersonaCandidateBlock(acquisition.candidates),
      candidates: acquisition.candidates,
      events: steps.flatMap((step) =>
        buildToolEvents({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          step,
        }),
      ),
      steps,
    };
  } finally {
    prepassSignal.cleanup();
  }
}

function formatVoiceOfCustomerCandidateGapIssue({
  gap,
  input,
  subjectDomain,
}: {
  gap: Exclude<VoiceOfCustomerCandidateResult, { ok: true }>["gap"];
  input: RunSectionInput;
  subjectDomain: string | null;
}): string {
  return [
    `VoC candidate prepass gap: reason=${gap.reason}`,
    `message=${gap.message}`,
    `observedDomains=${gap.domains.join(",") || "none"}`,
    `candidateCount=${gap.candidateCount}`,
    `runId=${input.runId}`,
    `sectionId=${input.sectionId}`,
    `subjectDomain=${subjectDomain ?? "unknown"}`,
  ].join("; ");
}

function buildMergedAnswerToolAdEvidenceGroups({
  deps,
  input,
  modelSteps,
  prepassGroups,
  researchInput,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  modelSteps: readonly AgentStep[];
  prepassGroups?: readonly CompetitorAdEvidenceGroup[];
  researchInput: ResearchInput;
}): readonly CompetitorAdEvidenceGroup[] | undefined {
  if (input.sectionId !== "positioningCompetitorLandscape") {
    return prepassGroups;
  }

  const modelGroups = buildCompetitorAdEvidenceGroups({
    steps: modelSteps,
    observedAt: getNow(deps).toISOString(),
    topicContext: buildCompetitorAdTopicContext(researchInput),
  });

  return mergeAdEvidenceGroups(prepassGroups ?? [], modelGroups);
}

function buildVerifierEvidenceSteps({
  adProbeSteps,
  input,
  modelSteps,
}: {
  adProbeSteps?: readonly AgentStep[];
  input: RunSectionInput;
  modelSteps: readonly AgentStep[];
}): readonly AgentStep[] {
  if (
    input.sectionId !== "positioningCompetitorLandscape" ||
    adProbeSteps === undefined ||
    adProbeSteps.length === 0
  ) {
    return modelSteps;
  }

  return [...modelSteps, ...adProbeSteps];
}


// T2a: under a keyword_volume (SpyFu) ToolGap, downgrade the SpyFu-claiming
// keyword rows to explicit data gaps and re-validate, mirroring the competitor
// strategic-text gap builder. The patched artifact MUST re-pass provenance
// (clean, with spyFuToolGap=false) AND section minimums or we return undefined
// and the caller nulls the artifact — never commit a still-dirty body.
function buildDemandIntentSpyFuToolGapArtifact({
  artifact,
  definition,
  modelSteps,
  softenableRowIndexes,
}: {
  artifact: ArtifactEnvelope & { body: DemandIntentBody };
  definition: RuntimeSectionDefinition;
  modelSteps: readonly AgentStep[];
  softenableRowIndexes: readonly number[];
}): ArtifactEnvelope | undefined {
  const softened = softenDemandIntentForSpyFuToolGap({
    artifact,
    softenableRowIndexes,
  });

  const candidate = artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse(softened);

  const recheck = checkDemandIntentKeywordProvenance({
    artifact: candidate,
    keywordTrendKeywords: keywordTrendKeywords(modelSteps),
    keywordVolumeKeywords: keywordVolumeKeywords(modelSteps),
  });
  if (!recheck.ok) {
    return undefined;
  }

  const minimums = definition.validateMinimums(candidate);
  return minimums.ok ? candidate : undefined;
}

interface BuildVerifiedAttemptArgs {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  modelSteps: readonly AgentStep[];
  output: SectionOutput<Record<string, unknown>>;
  researchInput: ResearchInput;
  verifierSteps?: readonly AgentStep[];
}

// W1 pro-pen/flash-hands: hand the narrative layer of the runner's draft to the
// stronger writer model BEFORE verification, so the verifier/redactor/gates
// police the prose the client actually reads. The pen is no-harm by
// construction: skips and failures keep the runner draft, and a penned draft
// that hard-fails the gate is retried once with the original draft so the pen
// can never sink an attempt that would have committed.
async function buildVerifiedAttemptFromOutput(
  args: BuildVerifiedAttemptArgs,
): Promise<AttemptResult> {
  const runWriterPass = args.deps.runWriterPass ?? defaultSectionWriterPassRunner;
  const pen = await runWriterPass({
    output: args.output,
    sectionId: args.input.sectionId,
    sectionTitle: args.definition.title,
    mission: args.definition.mission,
    companyName: args.researchInput.company.name,
    companyWebsiteUrl: args.researchInput.company.websiteUrl,
    remainingMs: getRemainingDeadlineMs(args.input, args.deps),
    signal: args.input.signal,
  });

  if (pen.applied) {
    console.info("[lab-section] writer pen rewrote narrative fields", {
      durationMs: pen.durationMs,
      rewrittenFieldCount: pen.rewrittenFieldCount,
      runId: args.input.runId,
      sectionId: args.input.sectionId,
      writerModelId: pen.writerModelId,
    });
  } else if (pen.skipReason !== "writer_pen_disabled") {
    console.info("[lab-section] writer pen skipped", {
      durationMs: pen.durationMs,
      runId: args.input.runId,
      sectionId: args.input.sectionId,
      skipReason: pen.skipReason,
    });
  }

  const attempt = await buildVerifiedAttemptFromFinalOutput({
    ...args,
    output: pen.output,
  });

  if (!pen.applied || attempt.artifact !== null) {
    return attempt;
  }

  console.warn(
    "[lab-section] writer pen attempt failed the gate; retrying with runner draft",
    {
      errors: attempt.errors.slice(0, 4),
      runId: args.input.runId,
      sectionId: args.input.sectionId,
    },
  );

  return buildVerifiedAttemptFromFinalOutput(args);
}

async function buildVerifiedAttemptFromFinalOutput({
  definition,
  deps,
  input,
  modelSteps,
  output,
  researchInput,
  verifierSteps,
}: BuildVerifiedAttemptArgs): Promise<AttemptResult> {
  const evidenceSteps = verifierSteps ?? modelSteps;
  const verification = verifySectionBody({
    body: output.body,
    evidenceSteps,
    researchInput,
  });
  const artifact = buildEnvelope({
    definition,
    deps,
    input,
    output,
    verification,
  });
  const postRequiredEvidenceHook = ({
    artifact: candidateArtifact,
  }: PostRequiredEvidenceHookContext): HookOutcome => {
    if (input.sectionId === "positioningVoiceOfCustomer") {
      const selfSourcing = checkVoiceOfCustomerSelfSourcing({
        artifact: candidateArtifact,
        subjectDomain: researchInput.company.websiteUrl,
      });

      if (!selfSourcing.ok) {
        return {
          kind: "reject",
          errors: selfSourcing.errors,
          gapArtifact: buildVoiceOfCustomerAttemptEvidenceGapArtifact({
            artifact: candidateArtifact,
            definition,
            deps,
            errors: selfSourcing.errors,
            input,
            researchInput,
          }),
        };
      }

      const modelAuthoredGapIssue =
        getVoiceOfCustomerModelAuthoredEvidenceGapIssue({
          artifact: candidateArtifact,
          input,
        });
      if (modelAuthoredGapIssue !== null) {
        return { kind: "reject", errors: [modelAuthoredGapIssue] };
      }
    }

    if (input.sectionId === "positioningPaidMediaPlan") {
      // Media-Plan SOP channel policy: re-derived from the same brief the
      // prompt block used, so a Meta-templated plan on a high-ACV brief
      // rejects with self-explanatory errors that drive the repair attempt.
      const channelPolicyErrors = checkPaidMediaChannelPolicy({
        body: candidateArtifact.body as PaidMediaPolicyCheckBody,
        policy: deriveChannelPolicy(researchInput.onboarding),
      });
      if (channelPolicyErrors.length > 0) {
        return { kind: "reject", errors: channelPolicyErrors };
      }
    }

    if (input.sectionId !== "positioningDemandIntent") {
      return { kind: "ok" };
    }

    // keyword_volume (SpyFu) returned a ToolGap when it surfaced zero keywords.
    // Under a ToolGap the SpyFu-absence failures are softenable: relabel the
    // SpyFu-claiming rows as explicit data gaps and commit needs_review, rather
    // than nulling the artifact and stalling the run < 6/6. A genuine
    // fabrication (model estimate / Trends claim without Trends evidence) still
    // hard-fails so we never let invented economics through.
    const spyFuToolGap = keywordVolumeKeywords(modelSteps).length === 0;
    const provenance = checkDemandIntentKeywordProvenance({
      artifact: candidateArtifact,
      keywordTrendKeywords: keywordTrendKeywords(modelSteps),
      keywordVolumeKeywords: keywordVolumeKeywords(modelSteps),
      spyFuToolGap,
    });

    if (!provenance.ok) {
      return { kind: "reject", errors: provenance.errors };
    }

    if (!spyFuToolGap || provenance.softenableRowIndexes.length === 0) {
      return { kind: "ok" };
    }

    const softened = buildDemandIntentSpyFuToolGapArtifact({
      artifact: candidateArtifact as ArtifactEnvelope & { body: DemandIntentBody },
      definition,
      modelSteps,
      softenableRowIndexes: provenance.softenableRowIndexes,
    });

    // The softened artifact MUST re-pass provenance (clean) + minimums or we
    // fall back to nulling — never commit a still-dirty body.
    if (softened === undefined) {
      return {
        kind: "softenFailed",
        errors: provenance.errors.length > 0
          ? provenance.errors
          : [
              "DemandIntent SpyFu ToolGap softening did not re-pass validation",
            ],
      };
    }

    return { kind: "soften", artifact: softened };
  };

  const verdict = evaluateCommittableAttempt({
    artifact,
    definition,
    env: deps.env ?? process.env,
    postRequiredEvidenceHook,
    verification,
  });

  if (verdict.kind === "minimumsFailed") {
    return {
      output,
      artifact: null,
      buyerICPEvidenceGapArtifact:
        buildBuyerICPPersonaEvidenceGapArtifact({
          artifact,
          definition,
          errors: [...verdict.errors],
          input,
        }),
      competitorStrategicEvidenceGapArtifact:
        buildCompetitorStrategicEvidenceGapArtifact({
          artifact,
          definition,
          errors: [...verdict.errors],
          input,
        }),
      offerDiagnosticEvidenceGapArtifact:
        buildOfferDiagnosticEvidenceGapArtifact({
          artifact,
          definition,
          errors: [...verdict.errors],
          input,
        }),
      errors: [...verdict.errors],
      voiceOfCustomerEvidenceGapArtifact:
        buildVoiceOfCustomerAttemptEvidenceGapArtifact({
          artifact,
          definition,
          deps,
          errors: [...verdict.errors],
          input,
          researchInput,
        }),
    };
  }

  if (verdict.kind === "requiredEvidenceMissing") {
    const failure = new RequiredEvidenceMissingError({
      missingClass: verdict.missingClass,
      sectionId: input.sectionId,
      unsupportedCount: verdict.unsupportedCount,
      verifiedCount: verdict.verifiedCount,
    });

    return {
      output,
      artifact: null,
      errors: [failure.message],
      requiredEvidenceMissing: failure,
    };
  }

  if (verdict.kind === "hookReject") {
    return {
      output,
      artifact: null,
      errors: [...verdict.errors],
      ...(input.sectionId === "positioningVoiceOfCustomer" &&
      verdict.gapArtifact !== undefined
        ? { voiceOfCustomerEvidenceGapArtifact: verdict.gapArtifact }
        : {}),
    };
  }

  if (verdict.kind === "evidenceShortfall") {
    return {
      output,
      artifact: annotateEvidenceSupportReview({
        artifact: verdict.committableArtifact,
        sectionId: input.sectionId,
        shortfall: verdict.shortfall,
      }),
      errors: [],
      evidenceSupportShortfall: verdict.shortfall,
    };
  }

  return {
    output,
    artifact: annotateEvidenceSupportReview({
      artifact: verdict.committableArtifact,
      sectionId: input.sectionId,
      shortfall: verdict.shortfall,
    }),
    errors: [],
    ...(verdict.shortfall === undefined
      ? {}
      : { evidenceSupportShortfall: verdict.shortfall }),
  };
}

async function buildAnswerToolAttempt({
  adProbeSteps,
  answerInput,
  definition,
  deps,
  input,
  modelSteps,
  normalizedAdEvidenceGroups,
  researchInput,
}: {
  adProbeSteps?: readonly AgentStep[];
  answerInput: unknown | undefined;
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  modelSteps: readonly AgentStep[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  researchInput: ResearchInput;
}): Promise<AttemptResult> {
  if (answerInput === undefined) {
    return {
      output: null,
      artifact: null,
      errors: [missingAnswerToolMessage],
    };
  }

  try {
    const output = definition.sectionOutputSchema.parse(
      withNormalizedSectionOutput({
        rawOutput: answerInput,
        sectionId: input.sectionId,
        normalizedAdEvidenceGroups,
        subjectCompanyName: researchInput.company.name,
        subjectWebsiteUrl: researchInput.company.websiteUrl,
      }),
    );
    return await buildVerifiedAttemptFromOutput({
      definition,
      deps,
      input,
      modelSteps,
      output,
      researchInput,
      verifierSteps: buildVerifierEvidenceSteps({
        adProbeSteps,
        input,
        modelSteps,
      }),
    });
  } catch (error) {
    return { output: null, artifact: null, errors: getErrorIssues(error) };
  }
}

function normalizeModelSource(value: unknown): ModelSourceInput | null {
  const record = getRecord(value);

  if (record === null) {
    return null;
  }

  const url = getValidHttpUrl(getStringProperty(record, "url"));

  if (url === null) {
    return null;
  }

  const title =
    getStringProperty(record, "title") ?? getSourceTitleFromUrl(url);
  const publisher = getStringProperty(record, "publisher");

  return {
    title,
    url,
    ...(publisher === null ? {} : { publisher }),
  };
}

function mergeModelSources(
  sources: readonly ModelSourceInput[],
): ModelSourceInput[] {
  const sourcesByUrl = new Map<string, ModelSourceInput>();

  for (const source of sources) {
    if (sourcesByUrl.has(source.url)) {
      continue;
    }
    sourcesByUrl.set(source.url, source);
  }

  return Array.from(sourcesByUrl.values());
}

function buildOutputFromStructuredBody({
  body,
  definition,
  input,
  normalizedAdEvidenceGroups,
  subjectCompanyName,
  subjectWebsiteUrl,
}: {
  body: unknown;
  definition: RuntimeSectionDefinition;
  input: RunSectionInput;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  subjectCompanyName?: string;
  subjectWebsiteUrl?: string;
}): SectionOutput<Record<string, unknown>> {
  const structuredRecord = getRecord(body);
  const rawBody = structuredRecord?.body ?? body;
  const rawBodyRecord = getRecord(rawBody);
  const normalizedRawBody =
    input.sectionId === "positioningVoiceOfCustomer" && rawBodyRecord !== null
      ? withNormalizedVoiceOfCustomerBody({ bodyRecord: rawBodyRecord })
      : rawBody;
  const parsedBody = definition.bodySchema.parse(
    normalizedRawBody,
  );
  const syntheticOutput = buildSyntheticSectionOutput({
    body: parsedBody,
    definition,
  });
  const authoredSources = Array.isArray(structuredRecord?.sources)
    ? structuredRecord.sources
        .map((source) => normalizeModelSource(source))
        .filter((source): source is ModelSourceInput => source !== null)
    : [];
  const authoredOutput = {
    ...syntheticOutput,
    verdict: getStringProperty(structuredRecord, "verdict") ?? syntheticOutput.verdict,
    statusSummary:
      getStringProperty(structuredRecord, "statusSummary") ??
      syntheticOutput.statusSummary,
    sources: mergeModelSources([
      ...authoredSources,
      ...syntheticOutput.sources,
    ]),
  };
  const normalizedOutput = withNormalizedSectionOutput({
    rawOutput: authoredOutput,
    normalizedAdEvidenceGroups,
    sectionId: input.sectionId,
    subjectCompanyName,
    subjectWebsiteUrl,
  });
  const normalizedOutputRecord = getRecord(normalizedOutput);
  const normalizedBody =
    normalizedOutputRecord === null
      ? parsedBody
      : definition.bodySchema.parse(normalizedOutputRecord.body);
  const existingSources = Array.isArray(normalizedOutputRecord?.sources)
    ? normalizedOutputRecord.sources
        .map((source) => normalizeModelSource(source))
        .filter((source): source is ModelSourceInput => source !== null)
    : [];

  return definition.sectionOutputSchema.parse({
    ...authoredOutput,
    ...(normalizedOutputRecord ?? {}),
    body: normalizedBody,
    sources: mergeModelSources([
      ...existingSources,
      ...collectModelSourcesFromBody(normalizedBody),
    ]),
  });
}

async function buildStructuredBodyAttempt({
  adProbeSteps,
  attempt,
  definition,
  deps,
  externalTools,
  input,
  maxOutputTokens,
  modelSteps,
  normalizedAdEvidenceGroups,
  partialSeqRef,
  prompt,
  researchInput,
  scheduleFlush,
  toolEvents,
}: {
  adProbeSteps?: readonly AgentStep[];
  attempt: number;
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  externalTools: Record<string, unknown>;
  input: RunSectionInput;
  maxOutputTokens?: number;
  modelSteps: AgentStep[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  partialSeqRef: SectionPartialSeqRef;
  prompt: string;
  researchInput: ResearchInput;
  scheduleFlush: () => Promise<void>;
  toolEvents: ActivityEvent[];
}): Promise<AttemptResult> {
  const streamStructured = deps.streamStructured ?? defaultStructuredStreamer;
  const outputTimeoutMs = getDeadlineAwareModelTimeoutMs({
    deps,
    input,
    requestedMs: getStructuredOutputTimeoutMs(input.sectionId),
  });
  const timeoutSignal = createTimeoutSignal({
    parentSignal: input.signal,
    timeoutMs: outputTimeoutMs,
  });
  const idleController = new AbortController();
  const structuredDraftSchema = buildStructuredSectionDraftSchema(definition);
  const partialBroadcaster = createThrottledSectionPartialBroadcaster({
    publish: deps.broadcastPartial,
    runId: input.runId,
    sectionId: input.sectionId,
    seqRef: partialSeqRef,
    zone: input.sectionId,
    onError: (error) => {
      console.warn("[lab-section] failed to broadcast artifact partial", {
        error: describeErrorForLog(error),
        runId: input.runId,
        sectionId: input.sectionId,
      });
    },
  });
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const refreshIdleTimer = (ms: number, reasonText: string): void => {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      idleController.abort(new Error(reasonText));
    }, ms);
  };
  const clearIdleTimer = (): void => {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  };

  refreshIdleTimer(
    structuredFirstChunkTimeoutMs,
    `Structured output first chunk not received within ${structuredFirstChunkTimeoutMs}ms.`,
  );

  try {
    const structuredStream = streamStructured({
      fallbackBudget: {
        minRemainingMs: getStructuredFallbackFloorMs(input.sectionId),
        remainingMs: () => getRemainingDeadlineMs(input, deps),
      },
      model: sectionRunnerModel,
      schema: structuredDraftSchema,
      schemaName: `${definition.sectionOutputSchemaName}Body`,
      schemaDescription: `${definition.title} section body for AI-GOS AI SDK Lab.`,
      prompt,
      tools: externalTools,
      maxStepCount: answerToolMaxStepCount,
      maxOutputTokens: getStructuredOutputMaxTokens(definition, maxOutputTokens),
      signal: AbortSignal.any([timeoutSignal.signal, idleController.signal]),
      telemetry: createLabSectionTelemetry({
        attempt,
        operation: "structured-output-stream",
        runId: input.runId,
        schemaName: `${definition.sectionOutputSchemaName}Body`,
        sectionId: input.sectionId,
      }),
      onStepFinish: (step) => {
        modelSteps.push(step);
        toolEvents.push(
          ...buildToolEvents({
            deps,
            runId: input.runId,
            sectionId: input.sectionId,
            step,
          }),
        );
        void scheduleFlush().catch(() => undefined);
      },
    });
    const structuredOutput = captureStructuredOutput(structuredStream.output);

    void structuredStream.consumeStream?.().then(undefined, (error: unknown) => {
      if (isAbortOrTimeoutMessage(error)) {
        return;
      }
      console.warn("[lab-section] structured stream consume failed", {
        error: describeErrorForLog(error),
        runId: input.runId,
        sectionId: input.sectionId,
      });
    });

    await consumePartialsUntilAbort({
      abortSignal: idleController.signal,
      iterable: structuredStream.partialOutputStream,
      onFirstChunk: () =>
        refreshIdleTimer(
          structuredChunkIdleTimeoutMs,
          `Structured output stream idle for ${structuredChunkIdleTimeoutMs}ms.`,
        ),
      onPartial: (partial) => {
        refreshIdleTimer(
          structuredChunkIdleTimeoutMs,
          `Structured output stream idle for ${structuredChunkIdleTimeoutMs}ms.`,
        );
        partialBroadcaster.enqueue(partial);
      },
    });
    clearIdleTimer();
    await partialBroadcaster.flush();

    await assertPaidMediaStructuredFinishReason({
      finishReason: structuredStream.finishReason,
      input,
      outputTimeoutMs,
      schemaName: `${definition.sectionOutputSchemaName}Body`,
    });

    const bodyResult = await withStructuredTimeout(
      structuredOutput,
      outputTimeoutMs,
    );
    if (!bodyResult.ok) {
      throw bodyResult.error;
    }
    const body = bodyResult.value;
    const output = buildOutputFromStructuredBody({
      body,
      definition,
      input,
      normalizedAdEvidenceGroups,
      subjectCompanyName: researchInput.company.name,
      subjectWebsiteUrl: researchInput.company.websiteUrl,
    });

    return await buildVerifiedAttemptFromOutput({
      definition,
      deps,
      input,
      modelSteps,
      output,
      researchInput,
      verifierSteps: buildVerifierEvidenceSteps({
        adProbeSteps,
        input,
        modelSteps,
      }),
    });
  } catch (error) {
    partialBroadcaster.cancel();
    return { output: null, artifact: null, errors: getErrorIssues(error) };
  } finally {
    clearIdleTimer();
    timeoutSignal.cleanup();
  }
}

// Explicit fallback kept for B2 streaming sign-off rollback via
// LAB_SECTION_STREAMING=false. Do not remove until streaming is signed off.
async function runSectionViaAnswerTool(
  input: RunSectionInput,
  deps: RunSectionDeps,
): Promise<RunSectionResult> {
  const definition = getRuntimeSectionDefinition(input.sectionId);
  const startedAt = getNow(deps).getTime();
  const record = await deps.store.readRun(input.runId);
  const researchInput: ResearchInput = record.input;
  const maxUnsupportedAllowed = getMaxUnsupportedAllowed(
    deps.env ?? process.env,
  );

  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "section-started",
      message: `${definition.title} started`,
      metadata: { sectionTitle: definition.title },
    }),
  );
  await deps.store.markSectionRunning(input.runId, input.sectionId);

  const toolEvents: ActivityEvent[] = [];
  const toolBudget = new SectionToolBudget(
    definition.maxExternalLookups,
    definition.adReservedLookups ?? 0,
    definition.scrapeReservedLookups ?? 0,
  );
  const externalTools = buildToolMap(getAllowedTools(definition, deps), {
    budget: toolBudget,
    webSearchMaxUses: definition.maxExternalLookups,
  });
  const externalToolNames = getExternalToolNames(externalTools);
  // Bound the live ad probe to the advertisers the reserved pool can fully fund
  // (google + meta + linkedin each). With adReservedLookups=9 this covers three
  // advertisers without borrowing generic budget.
  const adProbeMaxAdvertisers =
    definition.adReservedLookups !== undefined &&
    definition.adReservedLookups > 0
      ? Math.max(
          1,
          Math.floor(
            definition.adReservedLookups /
              competitorAdProbeAdLookupsPerAdvertiser,
          ),
        )
      : undefined;
  const adPrepassSignal = createForwardedAbortSignal(input.signal);
  const adEvidencePromise = buildAnswerToolAdEvidence({
    deps,
    input: { ...input, signal: adPrepassSignal.signal },
    maxAdvertisers: adProbeMaxAdvertisers,
    researchInput,
    researchTools: externalTools,
  });

  let skillMd: string;
  let adEvidence: Awaited<ReturnType<typeof buildAnswerToolAdEvidence>>;
  try {
    skillMd = await deps.loadSkill(definition.skillSlug);
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "skill-loaded",
        message: `Loaded ${definition.skillSlug}`,
        metadata: { skillSlug: definition.skillSlug },
      }),
    );

    // Append the reading-sources heartbeat before the first model attempt so
    // deriveSectionPhase advances past "Compiling context" immediately, instead
    // of waiting ~60-70s for the first real tool event to be persisted.
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "reading-sources-started",
        message: `${definition.title} gathering sources`,
        metadata: { sectionTitle: definition.title },
      }),
    );
    adEvidence = await adEvidencePromise;
  } catch (error) {
    adPrepassSignal.abort(error);
    await adEvidencePromise.catch(() => undefined);
    throw error;
  } finally {
    adPrepassSignal.cleanup();
  }

  toolEvents.push(...adEvidence.events);
  const runAnswerTool = deps.runAnswerTool ?? defaultAnswerToolRunner;
  let appendedEventCount = 0;
  // Hardened flush: a single failing appendEvent must not abort the section nor
  // desync the cursor. On failure we log and BREAK without advancing the cursor,
  // so the failed event is retried on the next flush rather than skipped.
  const flushBufferedEvents = async (): Promise<void> => {
    while (appendedEventCount < toolEvents.length) {
      try {
        await appendEvent(deps, input.runId, toolEvents[appendedEventCount]);
      } catch (error) {
        console.error(
          `[lab-section] failed to persist activity event for run ${input.runId} section ${input.sectionId}; will retry on next flush`,
          error,
        );
        break;
      }
      appendedEventCount += 1;
    }
  };
  // Serialize every flush through a single promise chain so re-entrant onStep
  // callbacks cannot interleave appendEvent calls and corrupt appendedEventCount.
  let flushChain: Promise<void> = Promise.resolve();
  const scheduleFlush = (): Promise<void> => {
    flushChain = flushChain.then(() => flushBufferedEvents());
    return flushChain;
  };

  // Bound the prepass so a slow reviews/web_search/firecrawl chain cannot eat
  // into the section budget and tip VoC past the 270s job timeout. On abort the
  // prepass tool degrades to partial candidates (executeVoiceOfCustomerPrepassTool).
  const voiceOfCustomerPrepassSignal = createTimeoutSignal({
    parentSignal: input.signal,
    reasonLabel: "VoC candidate prepass",
    timeoutMs: voiceOfCustomerPrepassDeadlineMs,
  });
  let voiceOfCustomerPrepass:
    | Awaited<ReturnType<typeof buildVoiceOfCustomerCandidatePrepass>>
    | undefined;
  try {
    voiceOfCustomerPrepass =
      input.sectionId === "positioningVoiceOfCustomer"
        ? await buildVoiceOfCustomerCandidatePrepass({
            deps,
            input: { ...input, signal: voiceOfCustomerPrepassSignal.signal },
            researchInput,
            researchTools: externalTools,
          })
        : undefined;
  } finally {
    voiceOfCustomerPrepassSignal.cleanup();
  }

  if (voiceOfCustomerPrepass !== undefined) {
    toolEvents.push(...voiceOfCustomerPrepass.events);
    await scheduleFlush();

    if (!voiceOfCustomerPrepass.result.ok) {
      const issue = formatVoiceOfCustomerCandidateGapIssue({
        gap: voiceOfCustomerPrepass.result.gap,
        input,
        subjectDomain: voiceOfCustomerPrepass.subjectDomain,
      });

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message: "Voice of Customer candidate prepass failed validation",
          metadata: { attempt: 1, issues: [issue] },
        }),
      );

      if (input.signal?.aborted === true) {
        await recordSectionFailure({
          definition,
          deps,
          errorMessage: issue,
          input,
        });

        throw new SectionRunnerError({
          runId: input.runId,
          sectionId: input.sectionId,
          errors: [issue],
        });
      }

      const evidenceGapArtifact = buildVoiceOfCustomerPrepassEvidenceGapArtifact({
        acquisitionAttempts: voiceOfCustomerPrepass.acquisitionAttempts,
        acquisitionLedger: voiceOfCustomerPrepass.acquisitionLedger,
        definition,
        deps,
        input,
        issue,
        researchInput,
        result: voiceOfCustomerPrepass.result,
      });

      return saveCompletedArtifact({
        artifact: evidenceGapArtifact,
        definition,
        deps,
        input,
        startedAt,
      });
    }
  }

  const voiceOfCustomerPrepassSteps = voiceOfCustomerPrepass?.steps ?? [];
  const buyerPersonaPrepass =
    input.sectionId === "positioningBuyerICP"
      ? await buildBuyerPersonaCandidatePrepass({ deps, input, researchInput })
      : undefined;
  if (buyerPersonaPrepass !== undefined) {
    toolEvents.push(...buyerPersonaPrepass.events);
    await scheduleFlush();
  }
  const buyerPersonaPrepassSteps = buyerPersonaPrepass?.steps ?? [];
  const answerToolInstructions = [
    buildAnswerToolInstructions(
      definition,
      researchInput,
      adEvidence.normalizedAdEvidenceGroups,
      {
        externalToolNames,
        inputSchemaMode: getAnswerToolInputSchemaMode(sectionRunnerModel),
      },
    ),
    ...(voiceOfCustomerPrepass === undefined
      ? []
      : ["", voiceOfCustomerPrepass.candidateBlock]),
    ...(buyerPersonaPrepass === undefined
      ? []
      : ["", buyerPersonaPrepass.candidateBlock]),
    "",
    "Skill analyst guidance:",
    skillMd,
    buildSectionObjectiveRecap(definition, researchInput),
  ].join("\n");
  const answerTool = createAnswerTool(definition.sectionOutputSchema, {
    model: sectionRunnerModel,
  });
  const runAnswerToolAttempt = async ({
    attempt,
    externalToolsOverride,
    prompt,
  }: {
    attempt: number;
    externalToolsOverride?: Record<string, unknown>;
    prompt: string;
  }): Promise<Awaited<ReturnType<AnswerToolRunner>>> =>
    runAnswerToolWithStallGuard({
      overallTimeoutMs: getDeadlineAwareModelTimeoutMs({
        deps,
        input,
        requestedMs: answerToolTimeoutMs,
      }),
      runAnswerTool,
      parentSignal: input.signal,
      params: {
        model: sectionRunnerModel,
        instructions: answerToolInstructions,
        prompt,
        externalTools: externalToolsOverride ?? externalTools,
        answerTool,
        maxStepCount: answerToolMaxStepCount,
        maxOutputTokens: getStructuredOutputMaxTokens(definition),
        telemetry: createLabSectionTelemetry({
          attempt,
          operation: "answer-tool",
          runId: input.runId,
          sectionId: input.sectionId,
        }),
      },
      onStep: (step) => {
        toolEvents.push(
          ...buildToolEvents({
            deps,
            runId: input.runId,
            sectionId: input.sectionId,
            step,
          }),
        );
        // Persist each tool event immediately (serialized via the flush chain)
        // so the reader sees live progress instead of a frozen phase until the
        // whole attempt resolves. A telemetry write must never abort the
        // section, so swallow flush rejections here.
        void scheduleFlush().catch(() => undefined);
      },
      onStall: async ({ attempt, timeoutMs }) => {
        // Persist progress immediately so the run record never sits frozen at
        // skill-loaded while a stalled attempt is being abandoned and retried.
        await scheduleFlush();
        toolEvents.push(
          createEvent({
            deps,
            runId: input.runId,
            sectionId: input.sectionId,
            type: "repair-started",
            message: `Answer tool stalled before first step; retrying (attempt ${attempt + 1} of ${answerToolMaxAttempts})`,
            metadata: {
              reason: `No answer-tool step within ${timeoutMs}ms on attempt ${attempt}`,
            },
          }),
        );
        await scheduleFlush();
      },
    });

  let answerResult: Awaited<ReturnType<AnswerToolRunner>>;
  try {
    answerResult = await runAnswerToolAttempt({
      attempt: 1,
      prompt: buildAnswerToolPrompt({ externalToolNames, input }),
    });
  } catch (error) {
    await recordSectionFailure({
      definition,
      deps,
      errorMessage: getErrorIssues(error).join("; "),
      input,
    });
    throw error;
  }

  await scheduleFlush();

  const answerResultSteps = [
    ...voiceOfCustomerPrepassSteps,
    ...buyerPersonaPrepassSteps,
    ...answerResult.steps,
  ];
  // Post-draft rescue probe: when the brief seeded zero advertisers the
  // prepass probed nothing, so probe the competitors the agent DISCOVERED in
  // its drafted competitorSet before the merge. No-op when seeds were present.
  const adRescue = await runCompetitorAdRescueProbe({
    answerInput: answerResult.answerInput,
    deps,
    input,
    maxAdvertisers: adProbeMaxAdvertisers,
    prepassAdProbeSteps: adEvidence.adProbeSteps,
    researchInput,
    researchTools: externalTools,
  });

  if (adRescue !== undefined) {
    toolEvents.push(...adRescue.events);
    await scheduleFlush();
  }

  const adProbeStepsWithRescue: readonly AgentStep[] =
    adRescue === undefined
      ? adEvidence.adProbeSteps
      : [...adEvidence.adProbeSteps, ...adRescue.steps];
  const prepassGroupsWithRescue =
    adRescue === undefined
      ? adEvidence.normalizedAdEvidenceGroups
      : mergeAdEvidenceGroups(
          adEvidence.normalizedAdEvidenceGroups ?? [],
          adRescue.groups,
        );
  let normalizedAdEvidenceGroups = buildMergedAnswerToolAdEvidenceGroups({
    deps,
    input,
    modelSteps: answerResultSteps,
    prepassGroups: prepassGroupsWithRescue,
    researchInput,
  });

  let attempt = await buildAnswerToolAttempt({
    adProbeSteps: adProbeStepsWithRescue,
    answerInput: answerResult.answerInput,
    definition,
    deps,
    input,
    modelSteps: answerResultSteps,
    normalizedAdEvidenceGroups,
    researchInput,
  });

  let bestCommittableAttempt = getBestCommittableAttempt(null, attempt);
  let validationAttempt = 1;

  // Coarse pre-filter: enter the repair block when an attempt is incomplete OR
  // carries any unsupported load-bearing claim. The WHILE below is the real
  // gate — shouldRepairAttempt() only spends a repair on a null artifact or a
  // gate-EXCEEDING unsupported count, so a within-gate shortfall enters here but
  // performs zero wasted re-runs. Keeping the inline `=== null` check also
  // preserves TS's non-null narrowing of attempt.artifact on the commit path.
  if (
    attempt.artifact === null ||
    attempt.evidenceSupportShortfall !== undefined
  ) {
    const repairEvidenceTranscript = buildEvidenceTranscript(answerResultSteps);
    const shouldForceAnswerOnlyRepair =
      attempt.errors.includes(missingAnswerToolMessage);
    let repairAttempt = 0;

    while (
      shouldRepairAttempt(attempt, maxUnsupportedAllowed) &&
      repairAttempt < answerToolMaxRepairAttempts &&
      // Yield to the 270s job AbortController: never START a fresh tool-heavy
      // repair once the section has been aborted. The post-loop path then
      // commits the best attempt so far or records a clean terminal failure,
      // rather than racing the outer controller into an orphaned 'running' row.
      input.signal?.aborted !== true &&
      canStartDeadlineFundedRepair(input, deps)
    ) {
      const repairIssues = getAttemptRepairIssues(attempt);

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message:
            validationAttempt === 1
              ? "Answer tool output failed validation"
              : "Answer tool repair output failed validation",
          metadata: { attempt: validationAttempt, issues: repairIssues },
        }),
      );

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "repair-started",
          message: "Answer tool repair started",
          metadata: {
            reason: getRepairReason(attempt),
          },
        }),
      );

      const repairResult = await runAnswerToolAttempt({
        attempt: validationAttempt + 1,
        ...(shouldForceAnswerOnlyRepair ? { externalToolsOverride: {} } : {}),
        prompt: buildRepairPrompt({
          definition,
          evidenceTranscript: repairEvidenceTranscript,
          externalToolNames,
          issues: repairIssues,
          normalizedAdEvidenceGroups,
          previousOutput: attempt.output,
          researchInput,
          skillMd,
        }),
      });
      await scheduleFlush();
      const repairResultSteps = [
        ...voiceOfCustomerPrepassSteps,
        ...buyerPersonaPrepassSteps,
        ...repairResult.steps,
      ];
      normalizedAdEvidenceGroups = buildMergedAnswerToolAdEvidenceGroups({
        deps,
        input,
        modelSteps: repairResultSteps,
        prepassGroups: normalizedAdEvidenceGroups,
        researchInput,
      });

      attempt = await buildAnswerToolAttempt({
        adProbeSteps: adProbeStepsWithRescue,
        answerInput: repairResult.answerInput,
        definition,
        deps,
        input,
        modelSteps: repairResultSteps,
        normalizedAdEvidenceGroups,
        researchInput,
      });
      bestCommittableAttempt = getBestCommittableAttempt(
        bestCommittableAttempt,
        attempt,
      );
      repairAttempt += 1;
      validationAttempt += 1;
    }

    if (
      shouldRepairAttempt(attempt, maxUnsupportedAllowed) &&
      repairAttempt < answerToolMaxRepairAttempts &&
      input.signal?.aborted !== true &&
      !canStartDeadlineFundedRepair(input, deps)
    ) {
      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message: "Answer tool repair skipped for deadline-aware salvage",
          metadata: {
            attempt: validationAttempt,
            issues: [
              ...getAttemptRepairIssues(attempt),
              formatDeadlineRepairSkipIssue(input, deps),
            ],
          },
        }),
      );
    }

    if (bestCommittableAttempt !== null) {
      attempt = bestCommittableAttempt;
    }

    const evidenceGapArtifact =
      getAttemptEvidenceGapArtifact(attempt) ??
      buildVoiceOfCustomerDeterministicSynthesisArtifact({
        definition,
        deps,
        errors: getAttemptRepairIssues(attempt),
        input,
        researchInput,
        voiceOfCustomerPrepass,
      }) ??
      buildVoiceOfCustomerStructuredFailureEvidenceGapArtifact({
        definition,
        deps,
        errors: getAttemptRepairIssues(attempt),
        input,
        researchInput,
        voiceOfCustomerPrepass,
      });
    if (
      attempt.artifact === null &&
      evidenceGapArtifact !== undefined &&
      input.signal?.aborted !== true
    ) {
      attempt = {
        ...attempt,
        artifact: evidenceGapArtifact,
        errors: [],
      };
    }

    if (attempt.artifact === null) {
      const repairIssues = getAttemptRepairIssues(attempt);

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message: "Answer tool repair output failed validation",
          metadata: { attempt: validationAttempt, issues: repairIssues },
        }),
      );
      await recordSectionFailure({
        definition,
        deps,
        errorMessage: repairIssues.join("; "),
        failure: attempt.requiredEvidenceMissing,
        input,
      });

      if (attempt.requiredEvidenceMissing !== undefined) {
        throw attempt.requiredEvidenceMissing;
      }

      throw new SectionRunnerError({
        runId: input.runId,
        sectionId: input.sectionId,
        errors: repairIssues,
      });
    }
  }

  const evidenceGateFailureReason = getEvidenceGateFailureReason(
    attempt,
    maxUnsupportedAllowed,
  );

  if (evidenceGateFailureReason !== null) {
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "validation-failed",
        message: "Answer tool repair output failed validation",
        metadata: {
          attempt: validationAttempt,
          issues: [evidenceGateFailureReason],
        },
      }),
    );
    await recordSectionFailure({
      definition,
      deps,
      errorMessage: evidenceGateFailureReason,
      input,
    });

    throw new SectionRunnerError({
      runId: input.runId,
      sectionId: input.sectionId,
      errors: [evidenceGateFailureReason],
    });
  }

  return saveCompletedArtifact({
    artifact: attempt.artifact,
    definition,
    deps,
    input,
    startedAt,
  });
}

async function runSectionViaStructuredBodyStream(
  input: RunSectionInput,
  deps: RunSectionDeps,
): Promise<RunSectionResult> {
  const definition = getRuntimeSectionDefinition(input.sectionId);
  const startedAt = getNow(deps).getTime();
  const record = await deps.store.readRun(input.runId);
  const researchInput: ResearchInput = record.input;
  const maxUnsupportedAllowed = getMaxUnsupportedAllowed(
    deps.env ?? process.env,
  );

  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "section-started",
      message: `${definition.title} started`,
      metadata: { sectionTitle: definition.title },
    }),
  );
  await deps.store.markSectionRunning(input.runId, input.sectionId);

  const toolEvents: ActivityEvent[] = [];
  const toolBudget = new SectionToolBudget(
    definition.maxExternalLookups,
    definition.adReservedLookups ?? 0,
    definition.scrapeReservedLookups ?? 0,
  );
  const externalTools = buildToolMap(getAllowedTools(definition, deps), {
    budget: toolBudget,
    webSearchMaxUses: definition.maxExternalLookups,
  });
  const externalToolNames = getExternalToolNames(externalTools);
  const adProbeMaxAdvertisers =
    definition.adReservedLookups !== undefined &&
    definition.adReservedLookups > 0
      ? Math.max(
          1,
          Math.floor(
            definition.adReservedLookups /
              competitorAdProbeAdLookupsPerAdvertiser,
          ),
        )
      : undefined;
  const adPrepassSignal = createForwardedAbortSignal(input.signal);
  const adEvidencePromise = buildAnswerToolAdEvidence({
    deps,
    input: { ...input, signal: adPrepassSignal.signal },
    maxAdvertisers: adProbeMaxAdvertisers,
    researchInput,
    researchTools: externalTools,
  });

  let skillMd: string;
  let adEvidence: Awaited<ReturnType<typeof buildAnswerToolAdEvidence>>;
  try {
    skillMd = await deps.loadSkill(definition.skillSlug);
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "skill-loaded",
        message: `Loaded ${definition.skillSlug}`,
        metadata: { skillSlug: definition.skillSlug },
      }),
    );
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "reading-sources-started",
        message: `${definition.title} gathering sources`,
        metadata: { sectionTitle: definition.title },
      }),
    );
    adEvidence = await adEvidencePromise;
  } catch (error) {
    adPrepassSignal.abort(error);
    await adEvidencePromise.catch(() => undefined);
    throw error;
  } finally {
    adPrepassSignal.cleanup();
  }

  toolEvents.push(...adEvidence.events);

  let appendedEventCount = 0;
  const flushBufferedEvents = async (): Promise<void> => {
    while (appendedEventCount < toolEvents.length) {
      try {
        await appendEvent(deps, input.runId, toolEvents[appendedEventCount]);
      } catch (error) {
        console.error(
          `[lab-section] failed to persist activity event for run ${input.runId} section ${input.sectionId}; will retry on next flush`,
          error,
        );
        break;
      }
      appendedEventCount += 1;
    }
  };
  let flushChain: Promise<void> = Promise.resolve();
  const scheduleFlush = (): Promise<void> => {
    flushChain = flushChain.then(() => flushBufferedEvents());
    return flushChain;
  };

  await scheduleFlush();

  // Bound the prepass so a slow reviews/web_search/firecrawl chain cannot eat
  // into the section budget and tip VoC past the 270s job timeout. On abort the
  // prepass tool degrades to partial candidates (executeVoiceOfCustomerPrepassTool).
  const voiceOfCustomerPrepassSignal = createTimeoutSignal({
    parentSignal: input.signal,
    reasonLabel: "VoC candidate prepass",
    timeoutMs: voiceOfCustomerPrepassDeadlineMs,
  });
  let voiceOfCustomerPrepass:
    | Awaited<ReturnType<typeof buildVoiceOfCustomerCandidatePrepass>>
    | undefined;
  try {
    voiceOfCustomerPrepass =
      input.sectionId === "positioningVoiceOfCustomer"
        ? await buildVoiceOfCustomerCandidatePrepass({
            deps,
            input: { ...input, signal: voiceOfCustomerPrepassSignal.signal },
            researchInput,
            researchTools: externalTools,
          })
        : undefined;
  } finally {
    voiceOfCustomerPrepassSignal.cleanup();
  }

  if (voiceOfCustomerPrepass !== undefined) {
    toolEvents.push(...voiceOfCustomerPrepass.events);
    await scheduleFlush();

    if (!voiceOfCustomerPrepass.result.ok) {
      const issue = formatVoiceOfCustomerCandidateGapIssue({
        gap: voiceOfCustomerPrepass.result.gap,
        input,
        subjectDomain: voiceOfCustomerPrepass.subjectDomain,
      });

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message: "Voice of Customer candidate prepass failed validation",
          metadata: { attempt: 1, issues: [issue] },
        }),
      );

      if (input.signal?.aborted === true) {
        await recordSectionFailure({
          definition,
          deps,
          errorMessage: issue,
          input,
        });

        throw new SectionRunnerError({
          runId: input.runId,
          sectionId: input.sectionId,
          errors: [issue],
        });
      }

      const evidenceGapArtifact = buildVoiceOfCustomerPrepassEvidenceGapArtifact({
        acquisitionAttempts: voiceOfCustomerPrepass.acquisitionAttempts,
        acquisitionLedger: voiceOfCustomerPrepass.acquisitionLedger,
        definition,
        deps,
        input,
        issue,
        researchInput,
        result: voiceOfCustomerPrepass.result,
      });

      return saveCompletedArtifact({
        artifact: evidenceGapArtifact,
        definition,
        deps,
        input,
        startedAt,
      });
    }
  }

  const buyerPersonaPrepass =
    input.sectionId === "positioningBuyerICP"
      ? await buildBuyerPersonaCandidatePrepass({ deps, input, researchInput })
      : undefined;
  if (buyerPersonaPrepass !== undefined) {
    toolEvents.push(...buyerPersonaPrepass.events);
    await scheduleFlush();
  }

  const modelSteps: AgentStep[] = [
    ...(voiceOfCustomerPrepass?.steps ?? []),
    ...(buyerPersonaPrepass?.steps ?? []),
  ];
  let normalizedAdEvidenceGroups = adEvidence.normalizedAdEvidenceGroups;
  let validationAttempt = 1;
  // One seq ref per RUN, shared across every repair attempt. Each
  // buildStructuredBodyAttempt builds a FRESH throttled broadcaster but aliases
  // this same ref (seqRef), so the broadcast seq keeps incrementing across
  // attempts instead of resetting. The consumer drops frames whose seq <= the
  // last seen one (applySectionPartialPayload), so a per-attempt reset would
  // make repair-attempt frames look stale and be silently dropped — sharing the
  // ref keeps repair partials monotonic and therefore visible.
  const partialSeqRef: SectionPartialSeqRef = { current: 0 };

  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "structured-output-started",
      message: "Structured body stream started",
      metadata: {
        schemaName: `${definition.sectionOutputSchemaName}Body`,
        attempt: validationAttempt,
      },
    }),
  );

  const structuredBodyPrompt = buildStructuredBodyPrompt({
    buyerPersonaCandidateBlock: buyerPersonaPrepass?.candidateBlock,
    definition,
    externalToolNames,
    normalizedAdEvidenceGroups,
    researchInput,
    skillMd,
    voiceOfCustomerCandidateBlock: voiceOfCustomerPrepass?.candidateBlock,
  });

  let attempt = await buildStructuredBodyAttempt({
    adProbeSteps: adEvidence.adProbeSteps,
    attempt: validationAttempt,
    definition,
    deps,
    externalTools,
    input,
    modelSteps,
    normalizedAdEvidenceGroups,
    partialSeqRef,
    prompt: structuredBodyPrompt,
    researchInput,
    scheduleFlush,
    toolEvents,
  });
  await scheduleFlush();
  normalizedAdEvidenceGroups = buildMergedAnswerToolAdEvidenceGroups({
    deps,
    input,
    modelSteps,
    prepassGroups: adEvidence.normalizedAdEvidenceGroups,
    researchInput,
  });

  if (
    input.sectionId === "positioningPaidMediaPlan" &&
    attempt.artifact === null &&
    hasPaidMediaLengthFinishError(getAttemptRepairIssues(attempt))
  ) {
    const retryIssues = getAttemptRepairIssues(attempt);
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "validation-failed",
        message: "Structured body output failed validation",
        metadata: { attempt: validationAttempt, issues: retryIssues },
      }),
    );

    validationAttempt += 1;
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "structured-output-started",
        message: "Structured body retry stream started",
        metadata: {
          attempt: validationAttempt,
          maxOutputTokens: paidMediaLengthRetryStructuredOutputMaxTokens,
          schemaName: `${definition.sectionOutputSchemaName}Body`,
        },
      }),
    );

    attempt = await buildStructuredBodyAttempt({
      adProbeSteps: adEvidence.adProbeSteps,
      attempt: validationAttempt,
      definition,
      deps,
      externalTools,
      input,
      maxOutputTokens: paidMediaLengthRetryStructuredOutputMaxTokens,
      modelSteps,
      normalizedAdEvidenceGroups,
      partialSeqRef,
      prompt: structuredBodyPrompt,
      researchInput,
      scheduleFlush,
      toolEvents,
    });
    await scheduleFlush();
    normalizedAdEvidenceGroups = buildMergedAnswerToolAdEvidenceGroups({
      deps,
      input,
      modelSteps,
      prepassGroups: normalizedAdEvidenceGroups,
      researchInput,
    });

    if (attempt.artifact === null) {
      const finalIssues = getAttemptRepairIssues(attempt);
      await recordSectionFailure({
        definition,
        deps,
        errorMessage: finalIssues.join("; "),
        failure: attempt.requiredEvidenceMissing,
        input,
      });

      throw new SectionRunnerError({
        runId: input.runId,
        sectionId: input.sectionId,
        errors: finalIssues,
      });
    }
  }

  // Post-draft rescue probe (mirrors the answer-tool path): when the brief
  // seeded zero advertisers the prepass probed nothing, so probe the
  // competitors the agent DISCOVERED in its streamed competitorSet, then fold
  // the recovered wall into THIS attempt by re-running the existing
  // answer-tool normalization + verification over the already-parsed output.
  // No-op when seeds were present (prepass emitted >=1 step).
  let adProbeStepsWithRescue: readonly AgentStep[] = adEvidence.adProbeSteps;
  const adRescue = await runCompetitorAdRescueProbe({
    answerInput: attempt.output,
    deps,
    input,
    maxAdvertisers: adProbeMaxAdvertisers,
    prepassAdProbeSteps: adEvidence.adProbeSteps,
    researchInput,
    researchTools: externalTools,
  });

  if (adRescue !== undefined) {
    toolEvents.push(...adRescue.events);
    await scheduleFlush();
    adProbeStepsWithRescue = [...adEvidence.adProbeSteps, ...adRescue.steps];
    normalizedAdEvidenceGroups = mergeAdEvidenceGroups(
      [...adRescue.groups],
      normalizedAdEvidenceGroups ?? [],
    );

    if (attempt.output !== null) {
      attempt = await buildAnswerToolAttempt({
        adProbeSteps: adProbeStepsWithRescue,
        answerInput: attempt.output,
        definition,
        deps,
        input,
        modelSteps,
        normalizedAdEvidenceGroups,
        researchInput,
      });
    }
  }

  let bestCommittableAttempt = getBestCommittableAttempt(null, attempt);

  // Coarse pre-filter: enter the repair block when an attempt is incomplete OR
  // carries any unsupported load-bearing claim. The WHILE below is the real
  // gate — shouldRepairAttempt() only spends a repair on a null artifact or a
  // gate-EXCEEDING unsupported count, so a within-gate shortfall enters here but
  // performs zero wasted re-runs. Keeping the inline `=== null` check also
  // preserves TS's non-null narrowing of attempt.artifact on the commit path.
  if (
    attempt.artifact === null ||
    attempt.evidenceSupportShortfall !== undefined
  ) {
    let repairAttempt = 0;

    while (
      shouldRepairAttempt(attempt, maxUnsupportedAllowed) &&
      repairAttempt < answerToolMaxRepairAttempts &&
      // Yield to the 270s job AbortController: never START a fresh tool-heavy
      // repair once the section has been aborted. The post-loop path then
      // commits the best attempt so far or records a clean terminal failure,
      // rather than racing the outer controller into an orphaned 'running' row.
      input.signal?.aborted !== true &&
      canStartDeadlineFundedRepair(input, deps)
    ) {
      const repairIssues = getAttemptRepairIssues(attempt);

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message:
            validationAttempt === 1
              ? "Structured body output failed validation"
              : "Structured body repair output failed validation",
          metadata: { attempt: validationAttempt, issues: repairIssues },
        }),
      );

      if (
        hasTerminalStructuredError(repairIssues) ||
        hasVoiceOfCustomerStructuredSynthesisFailure({
          errors: repairIssues,
          input,
          voiceOfCustomerPrepass,
        })
      ) {
        break;
      }

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "repair-started",
          message: "Structured body repair started",
          metadata: {
            reason: getRepairReason(attempt),
          },
        }),
      );

      validationAttempt += 1;
      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "structured-output-started",
          message: "Structured body repair stream started",
          metadata: {
            schemaName: `${definition.sectionOutputSchemaName}Body`,
            attempt: validationAttempt,
          },
        }),
      );

      attempt = await buildStructuredBodyAttempt({
        adProbeSteps: adProbeStepsWithRescue,
        attempt: validationAttempt,
        definition,
        deps,
        externalTools,
        input,
        modelSteps,
        normalizedAdEvidenceGroups,
        partialSeqRef,
        prompt: buildStructuredBodyRepairPrompt({
          buyerPersonaCandidateBlock: buyerPersonaPrepass?.candidateBlock,
          definition,
          evidenceTranscript: buildEvidenceTranscript(modelSteps),
          externalToolNames,
          issues: repairIssues,
          normalizedAdEvidenceGroups,
          previousOutput: attempt.output,
          researchInput,
          skillMd,
          voiceOfCustomerCandidateBlock:
            voiceOfCustomerPrepass?.candidateBlock,
        }),
        researchInput,
        scheduleFlush,
        toolEvents,
      });
      await scheduleFlush();
      normalizedAdEvidenceGroups = buildMergedAnswerToolAdEvidenceGroups({
        deps,
        input,
        modelSteps,
        prepassGroups: normalizedAdEvidenceGroups,
        researchInput,
      });
      bestCommittableAttempt = getBestCommittableAttempt(
        bestCommittableAttempt,
        attempt,
      );
      repairAttempt += 1;
    }

    if (
      shouldRepairAttempt(attempt, maxUnsupportedAllowed) &&
      repairAttempt < answerToolMaxRepairAttempts &&
      input.signal?.aborted !== true &&
      !canStartDeadlineFundedRepair(input, deps)
    ) {
      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message: "Structured body repair skipped for deadline-aware salvage",
          metadata: {
            attempt: validationAttempt,
            issues: [
              ...getAttemptRepairIssues(attempt),
              formatDeadlineRepairSkipIssue(input, deps),
            ],
          },
        }),
      );
    }

    if (bestCommittableAttempt !== null) {
      attempt = bestCommittableAttempt;
    }

    const evidenceGapArtifact =
      getAttemptEvidenceGapArtifact(attempt) ??
      buildVoiceOfCustomerDeterministicSynthesisArtifact({
        definition,
        deps,
        errors: getAttemptRepairIssues(attempt),
        input,
        researchInput,
        voiceOfCustomerPrepass,
      }) ??
      buildVoiceOfCustomerStructuredFailureEvidenceGapArtifact({
        definition,
        deps,
        errors: getAttemptRepairIssues(attempt),
        input,
        researchInput,
        voiceOfCustomerPrepass,
      });
    if (
      attempt.artifact === null &&
      evidenceGapArtifact !== undefined &&
      input.signal?.aborted !== true
    ) {
      attempt = {
        ...attempt,
        artifact: evidenceGapArtifact,
        errors: [],
      };
    }

    if (attempt.artifact === null) {
      const repairIssues = getAttemptRepairIssues(attempt);

      if (!hasTerminalStructuredError(repairIssues)) {
        await appendEvent(
          deps,
          input.runId,
          createEvent({
            deps,
            runId: input.runId,
            sectionId: input.sectionId,
            type: "validation-failed",
            message: "Structured body repair output failed validation",
            metadata: { attempt: validationAttempt, issues: repairIssues },
          }),
        );
      }

      await recordSectionFailure({
        definition,
        deps,
        errorMessage: repairIssues.join("; "),
        failure: attempt.requiredEvidenceMissing,
        input,
      });

      if (attempt.requiredEvidenceMissing !== undefined) {
        throw attempt.requiredEvidenceMissing;
      }

      throw new SectionRunnerError({
        runId: input.runId,
        sectionId: input.sectionId,
        errors: repairIssues,
      });
    }
  }

  const evidenceGateFailureReason = getEvidenceGateFailureReason(
    attempt,
    maxUnsupportedAllowed,
  );

  if (evidenceGateFailureReason !== null) {
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "validation-failed",
        message: "Structured body repair output failed validation",
        metadata: {
          attempt: validationAttempt,
          issues: [evidenceGateFailureReason],
        },
      }),
    );
    await recordSectionFailure({
      definition,
      deps,
      errorMessage: evidenceGateFailureReason,
      input,
    });

    throw new SectionRunnerError({
      runId: input.runId,
      sectionId: input.sectionId,
      errors: [evidenceGateFailureReason],
    });
  }

  return saveCompletedArtifact({
    artifact: attempt.artifact,
    definition,
    deps,
    input,
    startedAt,
  });
}

export async function runSection(
  input: RunSectionInput,
  deps: RunSectionDeps,
): Promise<RunSectionResult> {
  if (!isSupportedSectionId(input.sectionId)) {
    throw new Error(`Unsupported sectionId ${input.sectionId}`);
  }

  if (answerToolSectionIds.has(input.sectionId)) {
    if (isLabSectionStreamingEnabled(deps.env ?? process.env)) {
      return runSectionViaStructuredBodyStream(input, deps);
    }

    return runSectionViaAnswerTool(input, deps);
  }

  const definition = getRuntimeSectionDefinition(input.sectionId);
  const startedAt = getNow(deps).getTime();
  const record = await deps.store.readRun(input.runId);
  const researchInput: ResearchInput = record.input;
  // Gate is armed by default. LAB_VERIFIER_MAX_UNSUPPORTED can raise the
  // threshold for calibrated sections. Mirrors the answer-tool path.
  const maxUnsupportedAllowed = getMaxUnsupportedAllowed(
    deps.env ?? process.env,
  );

  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "section-started",
      message: `${definition.title} started`,
      metadata: { sectionTitle: definition.title },
    }),
  );
  await deps.store.markSectionRunning(input.runId, input.sectionId);

  const skillMd = await deps.loadSkill(definition.skillSlug);
  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "skill-loaded",
      message: `Loaded ${definition.skillSlug}`,
      metadata: { skillSlug: definition.skillSlug },
    }),
  );

  const toolEvents: ActivityEvent[] = [];
  const runEvidencePass = deps.runEvidencePass ?? defaultEvidencePassRunner;
  const toolBudget = new ToolBudget(definition.maxExternalLookups);
  const researchTools = buildToolMap(getAllowedTools(definition, deps), {
    budget: toolBudget,
    webSearchMaxUses: definition.maxExternalLookups,
  });
  const fixtureTools = createFixtureTools({
    store: deps.store,
    expectedRunId: input.runId,
  });
  let evidenceResult: Awaited<ReturnType<EvidencePassRunner>>;

  try {
    evidenceResult = await runEvidencePass({
      model: getGenerationModel(),
      instructions: [
        `You are the AI-GOS section analyst for ${definition.title}.`,
        `Mission: ${definition.mission}`,
        "Follow this skill:",
        skillMd,
      ].join("\n\n"),
      prompt: [
        `Call readResearchInput with runId ${input.runId}.`,
        "Produce a concise evidence brief with concrete source URLs.",
        `RunId: ${input.runId}.`,
        `SectionId: ${input.sectionId}.`,
      ].join(" "),
      tools: {
        readResearchInput: fixtureTools.readResearchInput,
        ...researchTools,
      },
      requiredToolSequence: buildRequiredToolSequence(
        getAllowedTools(definition, deps),
      ),
      maxStepCount: 4,
      maxOutputTokens: 2048,
      signal: input.signal,
      telemetry: createLabSectionTelemetry({
        operation: "evidence-pass",
        runId: input.runId,
        sectionId: input.sectionId,
      }),
      onStepFinish: (step) => {
        toolEvents.push(
          ...buildToolEvents({
            deps,
            runId: input.runId,
            sectionId: input.sectionId,
            step,
          }),
        );
      },
    });
  } catch (error) {
    await recordSectionFailure({
      definition,
      deps,
      errorMessage: getErrorIssues(error).join("; "),
      input,
    });
    throw error;
  }

  const adProbeSteps =
    input.sectionId === "positioningCompetitorLandscape"
      ? await runCompetitorAdProbeSteps({
          researchInput,
          researchTools,
          signal: input.signal,
        })
      : [];

  for (const adProbeStep of adProbeSteps) {
    toolEvents.push(
      ...buildToolEvents({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        step: adProbeStep,
      }),
    );
  }

  for (const event of toolEvents) {
    await appendEvent(deps, input.runId, event);
  }

  const evidenceSteps = [...evidenceResult.steps, ...adProbeSteps];
  const evidenceTranscript = buildEvidenceTranscript(evidenceSteps);
  const normalizedAdEvidenceGroups =
    input.sectionId === "positioningCompetitorLandscape"
      ? buildCompetitorAdEvidenceGroups({
          steps: evidenceSteps,
          observedAt: getNow(deps).toISOString(),
          topicContext: buildCompetitorAdTopicContext(researchInput),
        })
      : undefined;
  const structuredPrompt = buildStructuredPrompt({
    definition,
    evidenceTranscript,
    normalizedAdEvidenceGroups,
    researchInput,
    skillMd,
  });

  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "structured-output-started",
      message: "Structured output started",
      metadata: { schemaName: definition.sectionOutputSchemaName, attempt: 1 },
    }),
  );

  const firstAttempt = await callStructuredAttempt({
    definition,
    deps,
    input,
    modelSteps: evidenceSteps,
    normalizedAdEvidenceGroups,
    prompt: structuredPrompt,
    researchInput,
    signal: input.signal,
  });

  let committedAttempt: AttemptResult = firstAttempt;
  let artifact = firstAttempt.artifact;

  if (artifact === null) {
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "validation-failed",
        message: "Structured output failed validation",
        metadata: { attempt: 1, issues: firstAttempt.errors },
      }),
    );

    if (
      input.sectionId === "positioningPaidMediaPlan" &&
      hasPaidMediaLengthFinishError(firstAttempt.errors)
    ) {
      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "structured-output-started",
          message: "Structured output retry started",
          metadata: {
            attempt: 2,
            maxOutputTokens: paidMediaLengthRetryStructuredOutputMaxTokens,
            schemaName: definition.sectionOutputSchemaName,
          },
        }),
      );

      const retryAttempt = await callStructuredAttempt({
        definition,
        deps,
        input,
        maxOutputTokens: paidMediaLengthRetryStructuredOutputMaxTokens,
        modelSteps: evidenceSteps,
        normalizedAdEvidenceGroups,
        prompt: structuredPrompt,
        researchInput,
        signal: input.signal,
      });

      committedAttempt = retryAttempt;
      artifact = retryAttempt.artifact;

      if (artifact === null) {
        await recordSectionFailure({
          definition,
          deps,
          errorMessage: retryAttempt.errors.join("; "),
          input,
        });

        throw new SectionRunnerError({
          runId: input.runId,
          sectionId: input.sectionId,
          errors: retryAttempt.errors,
        });
      }
    } else {
      if (hasTerminalStructuredError(firstAttempt.errors)) {
        await recordSectionFailure({
          definition,
          deps,
          errorMessage: firstAttempt.errors.join("; "),
          input,
        });

        throw new SectionRunnerError({
          runId: input.runId,
          sectionId: input.sectionId,
          errors: firstAttempt.errors,
        });
      }

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "repair-started",
          message: "Repair attempt started",
          metadata: {
            reason: firstAttempt.errors.join("; ").slice(0, 200),
          },
        }),
      );
      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "structured-output-started",
          message: "Structured output repair started",
          metadata: { schemaName: definition.sectionOutputSchemaName, attempt: 2 },
        }),
      );

      const repairAttempt = await callStructuredAttempt({
        definition,
        deps,
        input,
        modelSteps: evidenceSteps,
        normalizedAdEvidenceGroups,
        prompt: buildRepairPrompt({
          definition,
          evidenceTranscript,
          issues: firstAttempt.errors,
          normalizedAdEvidenceGroups,
          previousOutput: firstAttempt.output,
          researchInput,
          skillMd,
        }),
        researchInput,
        signal: input.signal,
      });

      committedAttempt = repairAttempt;
      artifact = repairAttempt.artifact;

      if (artifact === null) {
        await recordSectionFailure({
          definition,
          deps,
          errorMessage: repairAttempt.errors.join("; "),
          input,
        });

        throw new SectionRunnerError({
          runId: input.runId,
          sectionId: input.sectionId,
          errors: repairAttempt.errors,
        });
      }
    }
  }

  // Evidence gate. The structured path has no grounding repair loop, so this is
  // fail-and-degrade: when the threshold is exceeded the section fails instead
  // of committing an ungrounded artifact.
  const evidenceGateFailureReason = getEvidenceGateFailureReason(
    committedAttempt,
    maxUnsupportedAllowed,
  );

  if (evidenceGateFailureReason !== null) {
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "validation-failed",
        message: "Structured output failed the evidence gate",
        metadata: {
          attempt: committedAttempt === firstAttempt ? 1 : 2,
          issues: [evidenceGateFailureReason],
        },
      }),
    );
    await recordSectionFailure({
      definition,
      deps,
      errorMessage: evidenceGateFailureReason,
      input,
    });

    throw new SectionRunnerError({
      runId: input.runId,
      sectionId: input.sectionId,
      errors: [evidenceGateFailureReason],
    });
  }

  let verifierGate = await runPaidMediaVerifierGate({
    artifact,
    deps,
    input,
    researchInput,
  });

  if (verifierGate.result?.hardFail === true) {
    const verifierIssues = getPaidMediaVerifierIssues(verifierGate.result);
    const currentAttemptNumber = committedAttempt === firstAttempt ? 1 : 2;

    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "validation-failed",
        message: "Structured output failed the paid-media verifier",
        metadata: {
          attempt: currentAttemptNumber,
          issues: verifierIssues,
        },
      }),
    );
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "repair-started",
        message: "Paid-media verifier repair attempt started",
        metadata: {
          reason: verifierIssues.join("; ").slice(0, 200),
        },
      }),
    );
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "structured-output-started",
        message: "Structured output verifier repair started",
        metadata: {
          schemaName: definition.sectionOutputSchemaName,
          attempt: currentAttemptNumber + 1,
        },
      }),
    );

    const verifierRepairAttempt = await callStructuredAttempt({
      definition,
      deps,
      input,
      modelSteps: evidenceSteps,
      normalizedAdEvidenceGroups,
      prompt: buildRepairPrompt({
        definition,
        evidenceTranscript,
        issues: verifierIssues,
        normalizedAdEvidenceGroups,
        previousOutput: committedAttempt.output ?? artifact,
        researchInput,
        skillMd,
      }),
      researchInput,
      signal: input.signal,
    });

    committedAttempt = verifierRepairAttempt;
    artifact = verifierRepairAttempt.artifact;

    if (artifact === null) {
      await recordSectionFailure({
        definition,
        deps,
        errorMessage: verifierRepairAttempt.errors.join("; "),
        input,
      });

      throw new SectionRunnerError({
        runId: input.runId,
        sectionId: input.sectionId,
        errors: verifierRepairAttempt.errors,
      });
    }

    const verifierRepairEvidenceGateFailureReason =
      getEvidenceGateFailureReason(committedAttempt, maxUnsupportedAllowed);

    if (verifierRepairEvidenceGateFailureReason !== null) {
      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message: "Structured output failed the evidence gate",
          metadata: {
            attempt: currentAttemptNumber + 1,
            issues: [verifierRepairEvidenceGateFailureReason],
          },
        }),
      );
      await recordSectionFailure({
        definition,
        deps,
        errorMessage: verifierRepairEvidenceGateFailureReason,
        input,
      });

      throw new SectionRunnerError({
        runId: input.runId,
        sectionId: input.sectionId,
        errors: [verifierRepairEvidenceGateFailureReason],
      });
    }

    verifierGate = await runPaidMediaVerifierGate({
      artifact,
      deps,
      input,
      researchInput,
    });

    if (verifierGate.result?.hardFail === true) {
      const remainingVerifierIssues = getPaidMediaVerifierIssues(
        verifierGate.result,
      );

      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message: "Paid-media verifier repair failed",
          metadata: {
            attempt: currentAttemptNumber + 1,
            issues: remainingVerifierIssues,
          },
        }),
      );
      await recordSectionFailure({
        definition,
        deps,
        errorMessage: remainingVerifierIssues.join("; "),
        input,
      });

      throw new SectionRunnerError({
        runId: input.runId,
        sectionId: input.sectionId,
        errors: remainingVerifierIssues,
      });
    }
  }

  artifact = verifierGate.artifact;

  await appendSubSectionCommittedEvents({
    artifact,
    deps,
    input,
  });
  await deps.store.saveArtifact(input.runId, artifact);
  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "artifact-saved",
      message: `${definition.title} artifact saved`,
      metadata: { artifactId: artifact.id },
    }),
  );
  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "section-completed",
      message: `${definition.title} completed`,
      metadata: {
        sectionTitle: definition.title,
        durationMs: Math.max(0, getNow(deps).getTime() - startedAt),
      },
    }),
  );

  return {
    runId: input.runId,
    sectionId: input.sectionId,
    artifact,
  };
}
