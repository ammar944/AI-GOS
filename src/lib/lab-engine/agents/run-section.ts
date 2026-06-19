import { randomUUID } from "node:crypto";

import {
  generateText,
  type TelemetrySettings,
  type Tool,
  type ToolExecutionOptions,
} from "ai";
import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
  type CompetitorAd,
  type DecodeRepair,
  type ResearchInput,
  type RunRecord,
  type VerificationReportEnvelope,
} from "../artifacts/artifact-envelope";
import {
  createTolerantDecodeShortfallError,
  takeDecodeRepairsMetadata,
  tolerantDecode,
} from "../artifacts/tolerant-decode";
import {
  getRegistrableDomain,
  getRegistrableDomainBrandToken,
  isSameRegistrableDomain,
  normalizeBrandToken,
} from "../domain-utils";
import {
  buyerICPEvidenceGapReason,
  isHttpUrl,
  modelEstimateLabel,
  validateBuyerICPMinimums,
  type BuyerICPBody,
} from "../artifacts/schemas/buyer-icp";
import type { CompetitorAdEvidenceGroup } from "../artifacts/schemas/competitor-landscape";
import {
  adCreativeFingerprint,
  checkCompetitorPricingSourceDiversity,
  normalizeCompetitorLandscapeBody,
} from "../artifacts/schemas/competitor-landscape";
import {
  normalizePaidMediaPlanBody,
  parsePaidMediaPercentToFraction,
} from "../artifacts/schemas/paid-media-plan";
import {
  checkDemandIntentIntentSignalIndependence,
  checkDemandIntentKeywordProvenance,
  softenDemandIntentForSpyFuToolGap,
  type DemandIntentBody,
} from "../artifacts/schemas/demand-intent";
import {
  buildOfferDiagnosticBlockGapBody,
  buildOfferDiagnosticEvidenceGapBody,
  parseOfferDiagnosticStrategicEvidenceGapPath,
} from "../artifacts/schemas/offer-diagnostic";
import {
  classifyVoiceOfCustomerEvidenceGap,
  checkVoiceOfCustomerSelfSourcing,
  type VoiceOfCustomerEvidenceGapClassification,
} from "../artifacts/schemas/voice-of-customer";
import {
  resolveLabThinkerMode,
  sectionRunnerModel,
  sectionThinkerModel,
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
  buildStructurerPrompt,
  buildThinkerPrompt,
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
import { buildAdEvidenceWallDigestStep } from "./ad-evidence-wall-digest";
import {
  VOC_MIN_DOMAINS,
  VOC_MIN_QUOTES,
} from "../artifacts/voice-of-customer-floors";
import { sleepWithAbort, ToolGapSchema, type ToolGap } from "./tools/_shared";
import { perplexityResearchAgentTool } from "./tools/perplexity-research";
import {
  acquireBuyerPersonaCandidates,
  deriveVendorSourced,
  formatBuyerPersonaCandidateBlock,
  type BuyerPersonaCandidate,
  type BuyerPersonaLookup,
} from "./buyer-persona-acquisition";
import { acquireCaseStudyChampionCandidates } from "./buyer-persona-case-study-mining";
import { withBuyerICPAcquisitionLedger } from "./buyer-icp-acquisition-ledger";
import { withPaidMediaEvidencePack } from "./paid-media-evidence-pack";
import { computeAcquisitionSufficiency } from "../artifacts/schemas/strategic-insight";
import {
  cleanAdvertiserQuery,
  extractCompanyFromDomain,
  isAdvertiserMatch,
} from "./tools/advertiser-match";
import {
  buildCompetitorAdEvidenceGroups,
  buildEmptyCompetitorAdEvidenceGapGroup,
  markSubjectAdvertiserGroups,
  reconcileAdEvidenceProseWithVerifiedCounts,
  summarizeCompetitorAdEvidenceGroups,
  textReconcilesWithCompetitorAdTopicContext,
} from "./tools/competitor-ad-adapter";
import {
  KeywordVolumeOutputSchema,
  spyfuKeywordUrl,
} from "./tools/keyword-volume";
import { KeywordDiscoveryOutputSchema } from "./tools/keyword-discovery";
import {
  isReviewPermalinkUrl,
  ReviewsOutputSchema,
} from "./tools/reviews";
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
  collectBriefMoneyDigits,
  deriveClaimSupportCountsForTrust,
  deriveGroundedConfidence,
  getMaxUnsupportedAllowed,
  moneyDigitVariants,
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
  buildPlaceholderTrustedHosts,
  downgradeUnpermalinkedVerbatimQuotes,
  downgradeUnpermalinkedVocQuotes,
  scrubQuoteEmails,
  stripExemplarEchoes,
  stripPlaceholderSourceUrls,
  stripUncontainedSourceUrls,
  stripUnverifiedSourceUrls,
  type DowngradedVerbatimQuote,
} from "./verification/provenance-gate";
import {
  buildSectionNumericTruth,
  enforceNumericCoherence,
  gateProseNumbers,
  scrubBodyInternalJargon,
  scrubInternalJargon,
  type InternalJargonStrike,
  type NumericCoherenceStrike,
} from "./verification/numeric-coherence";
import {
  dedupeQuoteBearingFields,
  isAdmissibleQuote,
  isDirectionalAdmissibleQuote,
  type DroppedDuplicateQuoteField,
} from "./verification/quote-admission";
import {
  applySourceLivenessGate,
  collectPreverifiedSourceUrlsFromSteps,
  collectSubjectSiteObservations,
  collectSubjectSiteObservationsFromSteps,
  extractSubjectSiteObservation,
  stripContradictedSubjectCtaClaims,
  type SourceLivenessDrop,
  type SourceLivenessFetch,
  type SourceLivenessResult,
  type SubjectSiteObservation,
  type SubjectCtaClaimStrip,
} from "./verification/source-liveness";
import { isValidGroundedBuyerUnit } from "./verification/grounded-buyer-unit";
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
import {
  appendEvidencePoolEntries,
  formatEvidencePoolSlice,
  readEvidencePoolFromArtifactData,
  STRUCTURER_EVIDENCE_POOL_CHAR_LIMIT,
  THINKER_EVIDENCE_POOL_CHAR_LIMIT,
  type EvidencePoolEntry,
  type EvidencePoolEntryKind,
  type EvidencePoolStore,
} from "../evidence/evidence-pool";

export interface RunSectionInput {
  runId: string;
  sectionId: SupportedSectionId;
  signal?: AbortSignal;
  deadlineAt?: number;
}

export type PreparedCorpusRowScope = "global" | "section";

export interface PreparedCorpusRow {
  id: string;
  sourceUrl: string;
  title: string;
  text: string;
  observedAt: string;
  sourceId: string;
  scope: PreparedCorpusRowScope;
}

export interface PreparedFactRow {
  id: string;
  sourceUrl: string;
  title: string;
  text: string;
  observedAt: string;
  sourceId: string;
}

export interface PreparedCoverageRow {
  sectionId: SupportedSectionId;
  requirementId: string;
  status: "satisfied" | "gap";
  foundCount: number;
  requiredCount: number;
  message: string;
}

export interface PreparedToolGapRow {
  sectionId: SupportedSectionId;
  toolName: ToolName;
  reason: ToolGap["reason"];
  message?: string;
}

export interface PreparedSectionContext {
  sectionId: SupportedSectionId;
  corpusRows: readonly PreparedCorpusRow[];
  factRows: readonly PreparedFactRow[];
  coverageRows: readonly PreparedCoverageRow[];
  toolGapRows: readonly PreparedToolGapRow[];
  researchUseful: boolean;
}

export interface PrepareSectionContextInput {
  runId: string;
  sectionId: SupportedSectionId;
}

export interface PrepareSectionContextDeps {
  store: Pick<RunStore, "readRun">;
}

export interface SectionThinkerPassParams {
  maxOutputTokens: number;
  model: SectionLanguageModel;
  prompt: string;
  signal?: AbortSignal;
  telemetry?: TelemetrySettings;
}

export type SectionThinkerPassRunner = (
  params: SectionThinkerPassParams,
) => Promise<string>;

export interface RunSectionDeps {
  store: RunStore;
  loadSkill: (slug: string) => Promise<string>;
  allowedTools?: readonly ToolName[];
  preparedContext?: PreparedSectionContext;
  env?: Record<string, string | undefined>;
  evidencePoolStore?: EvidencePoolStore;
  parentAuditRunId?: string;
  runAnswerTool?: AnswerToolRunner;
  runEvidencePass?: EvidencePassRunner;
  runThinkerPass?: SectionThinkerPassRunner;
  runWriterPass?: SectionWriterPassRunner;
  callStructured?: StructuredCaller;
  streamStructured?: StructuredStreamer;
  verifyPaidMediaPlan?: (
    input: VerifyPaidMediaPlanInput,
  ) => Promise<PaidMediaPlanVerificationResult>;
  fetchImpl?: SourceLivenessFetch;
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

function normalizePreparedCorpusKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildPreparedCorpusRowKey(row: PreparedCorpusRow): string {
  return [
    normalizePreparedCorpusKeyPart(row.id),
    normalizePreparedCorpusKeyPart(row.sourceId),
    normalizePreparedCorpusKeyPart(row.sourceUrl),
    normalizePreparedCorpusKeyPart(row.text),
  ].join("\u001f");
}

function toPreparedCorpusRow({
  excerpt,
  scope,
}: {
  excerpt: ResearchInput["corpus"]["excerpts"][number];
  scope: PreparedCorpusRowScope;
}): PreparedCorpusRow {
  return {
    id: excerpt.id,
    sourceUrl: excerpt.sourceUrl,
    title: excerpt.title,
    text: excerpt.text,
    observedAt: excerpt.observedAt,
    sourceId: excerpt.sourceId,
    scope,
  };
}

function buildPreparedCorpusRows({
  researchInput,
  sectionId,
}: {
  researchInput: ResearchInput;
  sectionId: SupportedSectionId;
}): readonly PreparedCorpusRow[] {
  const rowsByKey = new Map<string, PreparedCorpusRow>();
  const globalRows = researchInput.corpus.excerpts.map((excerpt) =>
    toPreparedCorpusRow({ excerpt, scope: "global" }),
  );
  const sectionRows = (
    researchInput.corpus.sectionExcerpts?.[sectionId] ?? []
  ).map((excerpt) => toPreparedCorpusRow({ excerpt, scope: "section" }));

  for (const row of [...globalRows, ...sectionRows]) {
    const key = buildPreparedCorpusRowKey(row);
    const existing = rowsByKey.get(key);
    if (existing === undefined || row.scope === "section") {
      rowsByKey.set(key, row);
    }
  }

  return [...rowsByKey.values()];
}

function buildPreparedSectionContext({
  researchInput,
  sectionId,
}: {
  researchInput: ResearchInput;
  sectionId: SupportedSectionId;
}): PreparedSectionContext {
  const corpusRows = buildPreparedCorpusRows({ researchInput, sectionId });
  const factRows: readonly PreparedFactRow[] = [];

  return {
    sectionId,
    corpusRows,
    factRows,
    coverageRows: [],
    toolGapRows: [],
    researchUseful: corpusRows.length > 0 || factRows.length > 0,
  };
}

function assertPreparedContextMatchesInput({
  input,
  preparedContext,
}: {
  input: RunSectionInput;
  preparedContext: PreparedSectionContext;
}): void {
  if (preparedContext.sectionId !== input.sectionId) {
    throw new Error(
      `PreparedSectionContext sectionId ${preparedContext.sectionId} does not match input sectionId ${input.sectionId}`,
    );
  }
}

function getPreparedSectionContext({
  deps,
  input,
  record,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  record: RunRecord;
}): PreparedSectionContext {
  if (deps.preparedContext !== undefined) {
    assertPreparedContextMatchesInput({
      input,
      preparedContext: deps.preparedContext,
    });
    return deps.preparedContext;
  }

  return buildPreparedSectionContext({
    researchInput: record.input,
    sectionId: input.sectionId,
  });
}

function shouldUsePreparedContext(
  deps: Pick<RunSectionDeps, "preparedContext">,
): boolean {
  return deps.preparedContext !== undefined;
}

function ensurePreparedSectionContext({
  deps,
  input,
  record,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  record: RunRecord;
}): void {
  getPreparedSectionContext({ deps, input, record });
}

export async function prepareSectionContext(
  input: PrepareSectionContextInput,
  deps: PrepareSectionContextDeps,
): Promise<PreparedSectionContext> {
  if (!isSupportedSectionId(input.sectionId)) {
    throw new Error(`Unsupported sectionId ${input.sectionId}`);
  }

  const record = await deps.store.readRun(input.runId);
  return buildPreparedSectionContext({
    researchInput: record.input,
    sectionId: input.sectionId,
  });
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

export function getRuntimeSectionDefinition(
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
export const labSectionThinkerPassTimeoutMs = 120_000;
export const labSectionThinkerPassMaxOutputTokens = 12_288;

type ThinkerProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

function getThinkerProviderOptions(): ThinkerProviderOptions {
  return {
    deepseek: {
      thinking: {
        type: "disabled",
      },
    },
  };
}

export async function defaultSectionThinkerPassRunner(
  params: SectionThinkerPassParams,
): Promise<string> {
  const result = await generateText({
    model: params.model,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens,
    temperature: 0.1,
    experimental_telemetry: params.telemetry,
    providerOptions: getThinkerProviderOptions(),
    ...(params.signal === undefined ? {} : { abortSignal: params.signal }),
  });

  return result.text;
}

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

// The fallback floor is the MINIMUM remaining section budget at which we still
// attempt the non-streaming structured fallback. It is deliberately the 120s
// minimum (not 240s+emit) because the fallback shares the attempt's
// deadline-aware timeoutSignal (buildStructuredBodyAttempt -> createTimeoutSignal
// clamped to min(structuredOutputTimeout, remaining - emit)); the fallback can
// therefore never run a fresh full-length call past the deadline. Demanding the
// old 260s floor made the fallback unreachable inside the 300s Vercel cap once a
// slow first attempt had already consumed budget — the section died instead of
// retrying with whatever (clamped) budget remained. sectionId is retained for
// signature parity with the call site.
export function getStructuredFallbackFloorMs(_sectionId: SectionId): number {
  return labSectionStructuredFallbackMinFloorMs;
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

function getEvidencePoolStorageContext(
  deps: RunSectionDeps,
): { parentAuditRunId: string; store: EvidencePoolStore } | null {
  if (
    deps.parentAuditRunId === undefined ||
    deps.evidencePoolStore === undefined
  ) {
    return null;
  }

  return {
    parentAuditRunId: deps.parentAuditRunId,
    store: deps.evidencePoolStore,
  };
}

function inferEvidencePoolEntryKind(toolName: string): EvidencePoolEntryKind {
  const normalized = toolName.toLowerCase();

  if (
    normalized.includes("keyword_volume") ||
    normalized.includes("keyword_trends") ||
    normalized.includes("spyfu")
  ) {
    return "spyfuKeywordTable";
  }

  if (
    normalized.includes("adlibrary") ||
    normalized.includes("google_ads") ||
    normalized.includes("meta_ads") ||
    normalized.includes("linkedin_ads") ||
    normalized.includes("foreplay")
  ) {
    return "adLibraryPull";
  }

  if (normalized.includes("review")) {
    return "reviewScrape";
  }

  if (normalized.includes("perplexity")) {
    return "perplexityAnswer";
  }

  if (
    normalized.includes("web_search") ||
    normalized.includes("searchapi") ||
    normalized.includes("organic")
  ) {
    return "webSearchResult";
  }

  if (normalized.includes("cta") || normalized.includes("subject_site")) {
    return "ctaObservation";
  }

  return "toolResult";
}

function findFirstSourceUrl(value: unknown, depth = 0): string | undefined {
  if (depth > 4) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findFirstSourceUrl(item, depth + 1);
      if (url !== undefined) {
        return url;
      }
    }

    return undefined;
  }

  const record = getRecord(value);
  if (record === null) {
    return undefined;
  }

  const direct =
    getValidHttpUrl(getStringProperty(record, "sourceUrl")) ??
    getValidHttpUrl(getStringProperty(record, "url")) ??
    getValidHttpUrl(getStringProperty(record, "source_url"));

  if (direct !== null) {
    return direct;
  }

  for (const item of Object.values(record)) {
    const url = findFirstSourceUrl(item, depth + 1);
    if (url !== undefined) {
      return url;
    }
  }

  return undefined;
}

function buildCorpusEvidencePoolEntries({
  input,
  researchInput,
}: {
  input: RunSectionInput;
  researchInput: ResearchInput;
}): EvidencePoolEntry[] {
  const entries: EvidencePoolEntry[] = [];
  const seen = new Set<string>();
  const appendExcerpt = (
    excerpt: ResearchInput["corpus"]["excerpts"][number],
    sectionId: SectionId | undefined,
  ): void => {
    const key = `${sectionId ?? "run"}:${excerpt.id}:${excerpt.sourceUrl}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    entries.push({
      kind: "corpusExcerpt",
      sourceUrl: excerpt.sourceUrl,
      fetchedAt: excerpt.observedAt,
      toolName: "deepResearchProgram",
      payload: {
        id: excerpt.id,
        sourceId: excerpt.sourceId,
        text: excerpt.text,
        title: excerpt.title,
      },
      ...(sectionId === undefined ? {} : { sectionId }),
    });
  };

  for (const excerpt of researchInput.corpus.excerpts) {
    appendExcerpt(excerpt, undefined);
  }

  const sectionExcerpts = researchInput.corpus.sectionExcerpts;
  if (sectionExcerpts !== undefined) {
    for (const [sectionId, excerpts] of Object.entries(sectionExcerpts)) {
      if (!isSupportedSectionId(sectionId)) {
        continue;
      }

      for (const excerpt of excerpts) {
        appendExcerpt(excerpt, sectionId);
      }
    }
  }

  return entries;
}

function buildStepEvidencePoolEntries({
  deps,
  input,
  steps,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  steps: readonly AgentStep[];
}): EvidencePoolEntry[] {
  const fetchedAt = getNow(deps).toISOString();

  return steps.flatMap((step) =>
    step.toolResults.flatMap((toolResult): EvidencePoolEntry[] => {
      if (toolResult.toolName === "answer") {
        return [];
      }

      const sourceUrl =
        findFirstSourceUrl(toolResult.output) ??
        findFirstSourceUrl(toolResult.input);

      return [
        {
          kind: inferEvidencePoolEntryKind(toolResult.toolName),
          ...(sourceUrl === undefined ? {} : { sourceUrl }),
          fetchedAt,
          toolName: toolResult.toolName,
          payload: {
            input: toolResult.input,
            output: toolResult.output,
            stepNumber: step.stepNumber,
            type: toolResult.type ?? "tool-result",
          },
          sectionId: input.sectionId,
        },
      ];
    }),
  );
}

function buildCaseStudyPageEvidencePoolEntries({
  deps,
  input,
  pages,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  pages: readonly { url: string; markdown: string }[] | undefined;
}): EvidencePoolEntry[] {
  if (pages === undefined) {
    return [];
  }

  const fetchedAt = getNow(deps).toISOString();

  return pages.map((page): EvidencePoolEntry => ({
    kind: "webSearchResult",
    sourceUrl: page.url,
    fetchedAt,
    toolName: "buyerPersonaCaseStudyMining",
    payload: {
      url: page.url,
      markdown: page.markdown,
    },
    sectionId: input.sectionId,
  }));
}

async function appendEvidencePoolBestEffort({
  context,
  deps,
  entries,
  input,
}: {
  context: string;
  deps: RunSectionDeps;
  entries: readonly EvidencePoolEntry[];
  input: RunSectionInput;
}): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const storage = getEvidencePoolStorageContext(deps);
  if (storage === null) {
    return;
  }

  try {
    await appendEvidencePoolEntries({
      entries,
      parentAuditRunId: storage.parentAuditRunId,
      runId: input.runId,
      store: storage.store,
      now: () => getNow(deps),
    });
  } catch (error) {
    console.warn("[lab-section] evidence pool append failed", {
      context,
      message: describeErrorForLog(error),
      parentAuditRunId: storage.parentAuditRunId,
      runId: input.runId,
      sectionId: input.sectionId,
    });
  }
}

async function readEvidencePoolBlockBestEffort({
  deps,
  input,
  maxChars,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  maxChars: number;
}): Promise<string | undefined> {
  const storage = getEvidencePoolStorageContext(deps);
  if (storage === null) {
    return undefined;
  }

  try {
    const data = await storage.store.readArtifactData({
      parentAuditRunId: storage.parentAuditRunId,
      runId: input.runId,
    });
    const pool = readEvidencePoolFromArtifactData(data, () => getNow(deps));

    return formatEvidencePoolSlice({
      heading: "Run-level evidence pool",
      maxChars,
      pool,
      sectionId: input.sectionId,
    });
  } catch (error) {
    console.warn("[lab-section] evidence pool read failed", {
      message: describeErrorForLog(error),
      parentAuditRunId: storage.parentAuditRunId,
      runId: input.runId,
      sectionId: input.sectionId,
    });

    return undefined;
  }
}

async function runThinkerAnalysisBestEffort({
  deps,
  input,
  prompt,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  prompt: string;
}): Promise<string | null> {
  if (resolveLabThinkerMode((deps.env ?? process.env) as NodeJS.ProcessEnv) === "off") {
    return null;
  }

  const timeoutSignal = createTimeoutSignal({
    parentSignal: input.signal,
    reasonLabel: "section thinker pass",
    timeoutMs: getDeadlineAwareModelTimeoutMs({
      deps,
      input,
      requestedMs: labSectionThinkerPassTimeoutMs,
    }),
  });

  try {
    const runThinkerPass = deps.runThinkerPass ?? defaultSectionThinkerPassRunner;
    const analysis = await runThinkerPass({
      model: sectionThinkerModel,
      prompt,
      maxOutputTokens: labSectionThinkerPassMaxOutputTokens,
      signal: timeoutSignal.signal,
      telemetry: createLabSectionTelemetry({
        operation: "thinker-pass",
        runId: input.runId,
        sectionId: input.sectionId,
      }),
    });
    const trimmed = analysis.trim();

    return trimmed.length === 0 ? null : trimmed;
  } catch (error) {
    console.warn(
      "[lab-section] thinker pass failed; falling back to single-call structurer",
      {
        message: describeErrorForLog(error),
        runId: input.runId,
        sectionId: input.sectionId,
      },
    );

    return null;
  } finally {
    timeoutSignal.cleanup();
  }
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

function warnDecodeRepairs({
  decodeRepairs,
  input,
  schemaName,
}: {
  decodeRepairs: readonly DecodeRepair[];
  input: RunSectionInput;
  schemaName: string;
}): void {
  if (decodeRepairs.length === 0) {
    return;
  }

  console.warn("[lab-section] tolerant decode repaired model output", {
    repairCount: decodeRepairs.length,
    repairs: decodeRepairs.map((repair) => ({
      action: repair.action,
      path: repair.path,
      detail: repair.detail,
    })),
    runId: input.runId,
    schemaName,
    sectionId: input.sectionId,
  });
}

function decodeModelBoundary<TValue>({
  input,
  rawValue,
  schema,
  schemaName,
  upstreamRepairs = [],
}: {
  input: RunSectionInput;
  rawValue: unknown;
  schema: z.ZodType<TValue>;
  schemaName: string;
  upstreamRepairs?: readonly DecodeRepair[];
}): { value: TValue; decodeRepairs: DecodeRepair[] } {
  const metadata = takeDecodeRepairsMetadata(rawValue);
  const decoded = tolerantDecode(schema, metadata.value, {
    sectionId: input.sectionId,
  });
  const decodeRepairs = [
    ...upstreamRepairs,
    ...metadata.snaps,
    ...decoded.snaps,
  ];

  if (decoded.ok) {
    warnDecodeRepairs({ decodeRepairs, input, schemaName });
    return {
      value: decoded.value,
      decodeRepairs,
    };
  }

  throw createTolerantDecodeShortfallError({
    context: `${schemaName} failed tolerant decode for section ${input.sectionId}`,
    shortfalls: decoded.shortfalls,
  });
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

// R1 gate: true ONLY when the structured first attempt failed for lack of
// deadline budget — remaining section budget is below the fallback floor AND the
// failure is the deadline-fallback-skip / structured-timeout signal AND this is
// NOT a real abort. Infra failures WITH budget remaining (remaining >= floor)
// and real aborts (signal.aborted) are deliberately excluded so they still
// surface as a genuine error.
function isDeadlineExhaustionFailure(
  errors: readonly string[],
  input: RunSectionInput,
  deps: RunSectionDeps,
): boolean {
  if (input.signal?.aborted === true) {
    return false;
  }

  const remainingMs = getRemainingDeadlineMs(input, deps);
  if (
    remainingMs === null ||
    remainingMs >= getStructuredFallbackFloorMs(input.sectionId)
  ) {
    return false;
  }

  return errors.some(
    (error) =>
      error.includes("deadline-aware structured fallback skipped:") ||
      error.includes("Structured output timed out"),
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
  decodeRepairs,
  definition,
  deps,
  input,
  output,
  verification,
}: {
  decodeRepairs?: readonly DecodeRepair[];
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
      ...(decodeRepairs === undefined || decodeRepairs.length === 0
        ? {}
        : { decodeRepairs: [...decodeRepairs] }),
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

function buildVoiceOfCustomerBlockGap({
  foundCount,
  requiredCount,
  summary,
}: {
  foundCount: number;
  requiredCount: number;
  summary: string;
}): Record<string, unknown> {
  return {
    summary,
    foundCount,
    requiredCount,
    sourcingPlan: [
      "Recover independent review, forum, or support-thread evidence before promoting this block.",
    ],
  };
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

// The promoted VoC quotes here failed the verified-admission bar — they lack a
// per-review permalink, so they read as directional buyer signal, not
// independently confirmed VoC. Calling them "verified" is a lie, and quoting the
// "6 quotes across 3 sites" bar once the pack EXCEEDS it self-contradicts (an
// over-floor pack is still directional for the permalink reason, not the count).
// State the count, the directional status, and the real reason; only add the
// under-floor line when the pack is genuinely below the quote floor.
export function buildVoiceOfCustomerShortfallNote(
  facts: VoiceOfCustomerEvidenceGapFacts,
): string {
  const collected = `We collected ${facts.foundPainQuoteCount} directional ${pluralize(
    facts.foundPainQuoteCount,
    "quote",
    "quotes",
  )} across ${facts.foundDistinctPainSourceCount} independent ${pluralize(
    facts.foundDistinctPainSourceCount,
    "source site",
    "source sites",
  )} that lack per-review permalinks, so they read as directional buyer signal, not independently confirmed VoC.`;

  if (facts.foundPainQuoteCount >= voiceOfCustomerRequiredPainQuoteCount) {
    return collected;
  }

  return [
    collected,
    `That is below our bar of ${voiceOfCustomerRequiredPainQuoteCount} quotes across ${voiceOfCustomerRequiredDistinctPainSourceCount} sites, so treat the themes as directional.`,
  ].join(" ");
}

function getVoiceOfCustomerCandidateQuoteSource(
  candidate: VoiceOfCustomerCandidate,
): string {
  if (candidate.domain === "g2.com") {
    return "g2";
  }

  if (candidate.domain === "capterra.com") {
    return "capterra";
  }

  if (candidate.domain === "trustpilot.com") {
    return "trustpilot";
  }

  if (candidate.domain === "trustradius.com") {
    return "trustradius";
  }

  if (candidate.domain === "reddit.com") {
    return "reddit";
  }

  if (
    candidate.domain === "news.ycombinator.com" ||
    candidate.domain === "ycombinator.com"
  ) {
    return "hackernews";
  }

  if (candidate.evidenceKind === "support-thread") {
    return "support-thread";
  }

  return "other";
}

// After-state / positive-language detector (mirrors the synthesis-path patterns
// so the gap path classifies the same way without coupling to synthesis.ts).
// Snippets that read as a recovered/positive outcome are NOT pain and must be
// excluded before pain-theme mapping.
const vocExplicitAfterStatePattern =
  /\b(?:after|finally|now|knows?|clear|fewer|less|restored|rebuilding|matters next|fixed|solved)\b/iu;
const vocEfficiencyControlAfterStatePattern =
  /\b(?:takes? (?:literally )?seconds?|instant(?:ly)?|fast approval|easy to use|easier to manage|real-time visibility|under control|surfac(?:e|es|ing) (?:patterns|duplicate|unexpected)|flag(?:s|ging)? duplicate|highlight(?:s|ing)? unexpected|simple to (?:create|revoke|monitor|manage))\b/iu;
const vocPositiveSentimentPattern =
  /\b(?:love|great|excellent|amazing|works? well|highly recommend|happy|smooth|seamless|life ?saver|worth it|game ?changer)\b/iu;

function vocSnippetExpressesAfterState(snippet: string): boolean {
  return (
    vocExplicitAfterStatePattern.test(snippet) ||
    vocEfficiencyControlAfterStatePattern.test(snippet) ||
    vocPositiveSentimentPattern.test(snippet)
  );
}

// Theme assignment from the SUBJECT'S own candidate-snippet vocabulary — not a
// 2-branch keyword collapse. Each branch is a distinct buyer-friction theme, so
// a real ≥6-quote pack surfaces multiple themes instead of one repeated label.
function vocInferPainTheme(snippet: string): string {
  const text = snippet.toLowerCase();

  if (/\b(price|pricing|cost|expensive|overpriced|charge|billing|refund)\b/u.test(text)) {
    return "pricing and cost friction";
  }
  if (/\b(support|response|ticket|help desk|customer service|no reply|ignored)\b/u.test(text)) {
    return "support responsiveness pain";
  }
  if (/\b(bug|crash|broken|glitch|error|slow|lag|downtime|unstable|freeze)\b/u.test(text)) {
    return "reliability and performance pain";
  }
  if (/\b(handoff|hand-off|follow-up|follow up|dropped|fell through|missed)\b/u.test(text)) {
    return "follow-up handoff pain";
  }
  if (/\b(integration|integrat|sync|api|connect|export|import|migrat)\b/u.test(text)) {
    return "integration and data-flow pain";
  }
  if (/\b(confus|complicated|hard to use|steep|learning curve|clunky|unintuitive|onboarding)\b/u.test(text)) {
    return "usability and onboarding friction";
  }
  if (/\b(trust|black-box|black box|control|transparen|account|context)\b/u.test(text)) {
    return "trust and control anxiety";
  }
  if (/\b(missing|lack|no way to|cannot|can't|limited|feature)\b/u.test(text)) {
    return "feature-gap friction";
  }

  return "buyer workflow friction";
}

const vocHighSeverityPattern =
  /\b(terrible|awful|horrible|unusable|worst|nightmare|furious|disaster|useless|hate|cancel(?:led|ling)?|switch(?:ed|ing)? away|gave up|never again|waste of money|ripoff|rip-off|scam)\b/iu;
const vocMediumSeverityPattern =
  /\b(frustrat|annoy|disappoint|struggle|painful|difficult|problem|issue|complain|let down|wish|should|lacking|missing|slow|confus|broken|bug|crash)\b/iu;
// Pain / friction vocabulary used to tell a "mostly positive" snippet apart
// from a snippet that leads with pain and only mentions a recovered outcome.
const vocPainSignalPattern =
  /\b(missed?|miss|handoff|hand-off|drop(?:ped)?|scatter(?:ed)?|manual|cleanup|fell through|expensive|overpriced|billing|refund|ignored|no reply|bug|crash|broken|glitch|error|slow|lag|downtime|unstable|freeze|confus|complicated|hard to use|clunky|unintuitive|trust|black-box|black box|lack|cannot|can't|limited)\b/iu;

function vocSnippetExpressesPain(snippet: string): boolean {
  return (
    vocPainSignalPattern.test(snippet) ||
    vocHighSeverityPattern.test(snippet) ||
    vocMediumSeverityPattern.test(snippet)
  );
}

// Snippet-derived severity: strong frustration vocabulary => high, mild =>
// medium, otherwise low. Replaces the positional index<3 heuristic, which mis-
// rated quote order as quote intensity.
function vocInferPainIntensity(snippet: string): "high" | "medium" | "low" {
  if (vocHighSeverityPattern.test(snippet) || snippet.includes("!!")) {
    return "high";
  }
  if (vocMediumSeverityPattern.test(snippet)) {
    return "medium";
  }
  return "low";
}

// Pain candidates only — a snippet is excluded ONLY when it reads as a purely
// positive / after-state testimonial with NO pain signal. A snippet that leads
// with friction and merely mentions a recovered outcome STAYS in pain (matches
// the synthesis path, where pain = all candidates and success is the after-state
// subset, not a mutually-exclusive partition).
function selectVoiceOfCustomerPainCandidates(
  candidates: readonly VoiceOfCustomerCandidate[],
): VoiceOfCustomerCandidate[] {
  return candidates.filter(
    (candidate) =>
      !vocSnippetExpressesAfterState(candidate.snippet) ||
      vocSnippetExpressesPain(candidate.snippet),
  );
}

export function buildVoiceOfCustomerShortfallPainQuotes(
  candidates: readonly VoiceOfCustomerCandidate[],
): Array<Record<string, unknown>> {
  return selectVoiceOfCustomerPainCandidates(candidates).map((candidate) => ({
    painIntensity: vocInferPainIntensity(candidate.snippet),
    painTheme: vocInferPainTheme(candidate.snippet),
    source: getVoiceOfCustomerCandidateQuoteSource(candidate),
    sourceUrl: candidate.url,
    verbatimText: candidate.snippet,
  }));
}

function buildVoiceOfCustomerEvidenceGapSources({
  baseSources,
  observedAt,
  quoteCandidates,
}: {
  baseSources: ReadonlyArray<ArtifactEnvelope["sources"][number]>;
  observedAt: string;
  quoteCandidates?: readonly VoiceOfCustomerCandidate[];
}): ArtifactEnvelope["sources"] {
  const sources = [...baseSources];
  const seenUrls = new Set(sources.map((source) => source.url));
  const surfacedPainCandidates =
    quoteCandidates === undefined
      ? []
      : selectVoiceOfCustomerPainCandidates(quoteCandidates);

  for (const candidate of surfacedPainCandidates) {
    if (seenUrls.has(candidate.url)) {
      continue;
    }

    sources.push({
      id: deriveSourceId(candidate.url, sources.length),
      observedAt,
      publisher: candidate.domain,
      title: candidate.title,
      url: candidate.url,
    });
    seenUrls.add(candidate.url);
  }

  return sources;
}

const readerTelemetryTokenPattern =
  /\b(runId|sectionId|subjectDomain|candidateCount|painQuoteCount|successQuoteCount|promotedContentCount|observedDomains|message|reason)=\S*/giu;
const genericReaderTelemetrySegmentPattern = /\b[\w]+=[^\s;]+;?/gu;

function stripReaderTelemetryTail(value: string): string {
  return value
    .replace(readerTelemetryTokenPattern, "")
    .replace(genericReaderTelemetrySegmentPattern, "")
    .replace(/(?:\s*;\s*){2,}/gu, "; ")
    .replace(/^[\s;]+|[\s;]+$/gu, "")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

export function buildVoiceOfCustomerEvidenceGapBody({
  acquisitionAttempts,
  acquisitionLedger,
  facts,
  issue,
  quoteCandidates,
  subjectDomain,
}: {
  acquisitionAttempts?: readonly VoiceOfCustomerAcquisitionAttempt[];
  acquisitionLedger?: readonly VoiceOfCustomerAcquisitionLedgerRow[];
  facts: VoiceOfCustomerEvidenceGapFacts;
  issue: string;
  quoteCandidates?: readonly VoiceOfCustomerCandidate[];
  subjectDomain: string | null;
}): Record<string, unknown> {
  const shortfallNote = buildVoiceOfCustomerShortfallNote(facts);
  const promotableCandidates =
    quoteCandidates === undefined || quoteCandidates.length === 0
      ? []
      : quoteCandidates;
  const painQuotes = buildVoiceOfCustomerShortfallPainQuotes(
    promotableCandidates,
  );
  const hasPromotedPainQuotes = painQuotes.length > 0;
  // Sparse evidence-gap mode must not fan the same captured snippets into
  // objections, switching stories, and decision criteria. Keep surfaced extracts
  // in painLanguage only; every secondary block carries its own honest blockGap.
  const directionalObjections: Array<Record<string, unknown>> = [];
  const directionalSwitchingStories: Array<Record<string, unknown>> = [];
  const directionalDecisionCriteria: Array<Record<string, unknown>> = [];
  const observedDomains =
    facts.observedPainSourceDomains.length === 0
      ? "none"
      : facts.observedPainSourceDomains.join(", ");
  const issueForReader = stripReaderTelemetryTail(issue);
  const summary = hasPromotedPainQuotes
    ? [
        shortfallNote,
        `Observed domains: ${observedDomains}.`,
        ...(issueForReader === "" ? [] : [issueForReader]),
      ].join(" ")
    : [
        "Evidence gap: independent Voice of Customer acquisition did not meet the committed evidence bar.",
        `Found ${facts.foundPainQuoteCount} usable pain-language candidate(s) across ${facts.foundDistinctPainSourceCount} independent source domain(s); required ${voiceOfCustomerRequiredPainQuoteCount} quotes across ${voiceOfCustomerRequiredDistinctPainSourceCount} domains.`,
        `Observed domains: ${observedDomains}.`,
        ...(issueForReader === "" ? [] : [issueForReader]),
      ].join(" ");

  return {
    retrievalSummary: summary,
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
      quotes: painQuotes,
      blockGap: buildVoiceOfCustomerBlockGap({
        foundCount: facts.foundPainQuoteCount,
        requiredCount: voiceOfCustomerRequiredPainQuoteCount,
        summary:
          hasPromotedPainQuotes
            ? shortfallNote
            : "No pain-language quotes were promoted because independent VoC sourcing did not clear the quote floor.",
      }),
    },
    objections: {
      prose:
        directionalObjections.length > 0
          ? "Directional objections promoted from captured review extracts (not independently-confirmed objections); treat them as signal to probe, not settled buyer objections."
          : "Objection language was not promoted because the run lacked enough independent customer-review or forum evidence.",
      items: directionalObjections,
      ...(directionalObjections.length > 0
        ? {}
        : {
            blockGap: buildVoiceOfCustomerBlockGap({
              foundCount: 0,
              requiredCount: 1,
              summary:
                "No objection language was promoted from independently sourced VoC.",
            }),
          }),
    },
    switchingStories: {
      prose:
        directionalSwitchingStories.length > 0
          ? "Directional switching stories promoted from captured review extracts (not independently-confirmed switches); validate each as a real switch trigger before relying on it."
          : "Switching stories were not promoted because the available independent VoC surfaces were below the sourcing floor.",
      stories: directionalSwitchingStories,
      ...(directionalSwitchingStories.length > 0
        ? {}
        : {
            blockGap: buildVoiceOfCustomerBlockGap({
              foundCount: 0,
              requiredCount: 1,
              summary:
                "No switching stories were promoted from independently sourced VoC.",
            }),
          }),
    },
    decisionCriteria: {
      prose:
        directionalDecisionCriteria.length > 0
          ? "Directional decision criteria promoted from captured review extracts (not independently-confirmed criteria); treat them as candidate criteria to confirm with the buyer."
          : "Decision criteria were not promoted because the run could not corroborate buyer criteria from enough independent VoC sources.",
      criteria: directionalDecisionCriteria,
      ...(directionalDecisionCriteria.length > 0
        ? {}
        : {
            blockGap: buildVoiceOfCustomerBlockGap({
              foundCount: 0,
              requiredCount: 1,
              summary:
                "No decision criteria were promoted from independently sourced VoC.",
            }),
          }),
    },
    successLanguage: {
      prose:
        "Success language was not promoted because the run did not acquire enough independent customer after-state quotes.",
      quotes: [],
      blockGap: buildVoiceOfCustomerBlockGap({
        foundCount: 0,
        requiredCount: 1,
        summary:
          "No success-language quotes were promoted from independently sourced VoC.",
      }),
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
      // Wave 2B: deterministic sufficiency roll-up computed from the ledger above.
      // VoC reports "sufficient" only at >= the promoted-quote floor OR >= the
      // independent promoted-domain floor; otherwise it is honestly partial /
      // insufficient. Never overrides a real quote floor downstream (advisory).
      ...(!acquisitionLedger || acquisitionLedger.length === 0
        ? {}
        : {
            sufficiency: computeAcquisitionSufficiency(acquisitionLedger, {
              promotedFloor: voiceOfCustomerRequiredPainQuoteCount,
              promotedDomainFloor: voiceOfCustomerRequiredDistinctPainSourceCount,
            }),
          }),
      sourcingPlan: [
        "Recover full review bodies from approved third-party review surfaces such as G2, Capterra, Trustpilot, Reddit, Hacker News, or support/community threads.",
        "When a surfaced URL has no snippet, retry with Firecrawl only if the rendered page returns usable markdown; record JS-challenge or empty-body pages as acquisition gaps.",
        `Exclude the audited company domain (${subjectDomain ?? "unknown"}) and require at least three independent domains before promoting buyer pain language.`,
      ],
    },
  };
}

function buildVoiceOfCustomerGapVerdict({
  hasUnpermalinkedQuotes,
  surfacedQuoteCount,
}: {
  hasUnpermalinkedQuotes: boolean;
  surfacedQuoteCount: number;
}): string {
  const quoteNoun =
    surfacedQuoteCount === 1 ? "customer-pain extract" : "customer-pain extracts";

  if (hasUnpermalinkedQuotes) {
    return `Captured ${surfacedQuoteCount} ${quoteNoun} from review pages, but at least one lacks a per-review permalink; treat the block as directional buyer signal, not independently verified VoC.`;
  }

  return `Captured ${surfacedQuoteCount} ${quoteNoun} from review-page permalinks, but the source floor is still unmet; treat the block as directional buyer signal, not independently verified VoC.`;
}

function buildVoiceOfCustomerGapStatusSummary({
  hasUnpermalinkedQuotes,
  surfacedQuoteCount,
}: {
  hasUnpermalinkedQuotes: boolean;
  surfacedQuoteCount: number;
}): string {
  const quoteNoun =
    surfacedQuoteCount === 1 ? "real pain extract" : "real pain extracts";

  if (hasUnpermalinkedQuotes) {
    return `Surfaced ${surfacedQuoteCount} ${quoteNoun}; at least one lacks a per-review permalink, so the block is directional and below the VoC sourcing floor.`;
  }

  return `Surfaced ${surfacedQuoteCount} ${quoteNoun} with review-page permalinks, but the block is still below the VoC sourcing floor.`;
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
  quoteCandidates,
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
  quoteCandidates?: readonly VoiceOfCustomerCandidate[];
  researchInput: ResearchInput;
}): ArtifactEnvelope {
  const observedAt = getNow(deps).toISOString();
  const subjectDomain = getRegistrableDomain(researchInput.company.websiteUrl);
  const surfacedPainCandidates =
    quoteCandidates === undefined
      ? []
      : selectVoiceOfCustomerPainCandidates(quoteCandidates);
  const body = buildVoiceOfCustomerEvidenceGapBody({
    acquisitionAttempts,
    acquisitionLedger,
    facts,
    issue,
    quoteCandidates,
    subjectDomain,
  });
  const surfacedQuoteCount = surfacedPainCandidates.length;
  const hasSurfacedQuotes = surfacedQuoteCount > 0;
  // Surfaced gap-path quotes carry a block-level provenance verdict/status
  // summary, so the per-quote paraphrase prefix would duplicate that caveat
  // inside client-facing verbatimText.
  const provenanceCheck = hasSurfacedQuotes
    ? downgradeUnpermalinkedVocQuotes({ body, prefixQuoteText: false })
    : { body, stripped: [] };
  const provenanceCheckedBody = provenanceCheck.body;
  const hasUnpermalinkedQuotes = provenanceCheck.stripped.length > 0;

  return artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      id: getNewId(deps),
      runId: input.runId,
      sectionId: input.sectionId,
      sectionTitle: definition.title,
      // When real customer-pain extracts WERE captured, the section is NOT
      // empty; it is an honest directional signal that remains below the source
      // floor. Keep the strict gap verdict ONLY when nothing was captured.
      verdict: hasSurfacedQuotes
        ? buildVoiceOfCustomerGapVerdict({
            hasUnpermalinkedQuotes,
            surfacedQuoteCount,
          })
        : "Voice of Customer evidence is below the independent-source bar; treat this section as a sourcing gap, not buyer-language truth.",
      statusSummary: hasSurfacedQuotes
        ? buildVoiceOfCustomerGapStatusSummary({
            hasUnpermalinkedQuotes,
            surfacedQuoteCount,
          })
        : "The section completed with an evidence gap so downstream synthesis can proceed without fabricating customer quotes.",
      confidence: hasSurfacedQuotes ? 0.45 : 0.2,
      sources: buildVoiceOfCustomerEvidenceGapSources({
        baseSources: baseArtifact?.sources ?? researchInput.sources,
        observedAt,
        quoteCandidates: surfacedPainCandidates,
      }),
      body: provenanceCheckedBody,
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

// Structural count-floor escape hatch for CompetitorLandscape — mirrors the
// OfferDiagnostic blockGap injector. Each entry maps a count-floor error to its
// block field + floor value; the section-level sources floor is waived once any
// block carries a blockGap (validateCompetitorLandscapeMinimums bodyHasAnyBlockGap).
const competitorStructuralFloorMatchers: ReadonlyArray<{
  block: string;
  requiredCount: number;
  noun: string;
  matches: (error: string) => number | null;
}> = [
  {
    block: "competitorSet",
    requiredCount: 3,
    noun: "competitors",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.competitorSet\.competitors: have (\d+), need >=3 competitors\.$/,
      ),
  },
  {
    block: "positioningTaxonomy",
    requiredCount: 2,
    noun: "positioning axes",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.positioningTaxonomy\.axes: have (\d+), need >=2 axes\.$/,
      ),
  },
  {
    block: "pricingReality",
    requiredCount: 2,
    noun: "pricing data points",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.pricingReality\.dataPoints: have (\d+), need >=2 pricing data points\.$/,
      ) ??
      parseCompetitorFoundCount(
        error,
        /^body\.pricingReality\.dataPoints: need pricing evidence for >=2 distinct competitors, have (\d+)\.$/,
      ),
  },
  {
    block: "shareOfVoice",
    requiredCount: 1,
    noun: "share-of-voice surfaces",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.shareOfVoice\.slices: have (\d+), need >=1 surface or a blockGap\.$/,
      ),
  },
  {
    block: "publicWeaknesses",
    requiredCount: 1,
    noun: "public weaknesses",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.publicWeaknesses\.items: have (\d+), need >=1 weakness or a blockGap\.$/,
      ),
  },
  {
    block: "narrativeArcs",
    requiredCount: 1,
    noun: "narrative arcs",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.narrativeArcs\.arcs: have (\d+), need >=1 arc or a blockGap\.$/,
      ),
  },
];

const competitorSourcesFloorPattern =
  /^sources: have \d+, need >=5 Section-level sources\.$/;

function parseCompetitorFoundCount(
  error: string,
  pattern: RegExp,
): number | null {
  const match = pattern.exec(error);
  if (match === null) {
    return null;
  }
  const found = Number(match[1]);
  return Number.isInteger(found) ? found : null;
}

// Inject schema-valid blockGaps onto the failing CompetitorLandscape structural
// blocks. Existing rows are preserved; only each block's `blockGap` is set.
// Returns null when ANY error is neither a recognized structural floor nor the
// (waivable) sources floor, so the caller hard-fails on genuinely unknown
// failures. Returns the unchanged body when no structural floors were flagged.
function buildCompetitorStructuralBlockGapBody({
  body,
  errors,
}: {
  body: Record<string, unknown>;
  errors: readonly string[];
}): { body: Record<string, unknown>; injected: boolean } | null {
  const resolved: Array<{
    block: string;
    requiredCount: number;
    noun: string;
    foundCount: number;
  }> = [];

  for (const error of errors) {
    let matched = false;
    for (const matcher of competitorStructuralFloorMatchers) {
      const foundCount = matcher.matches(error);
      if (foundCount !== null) {
        resolved.push({
          block: matcher.block,
          requiredCount: matcher.requiredCount,
          noun: matcher.noun,
          foundCount,
        });
        matched = true;
        break;
      }
    }
    if (matched) {
      continue;
    }
    // The section-level sources floor is waived once any block carries a
    // blockGap — accept it here without a body change.
    if (competitorSourcesFloorPattern.test(error)) {
      continue;
    }
    return null;
  }

  if (resolved.length === 0) {
    return { body, injected: false };
  }

  const patched = structuredClone(body);
  for (const entry of resolved) {
    const block = getRecord(patched[entry.block]);
    if (block === null) {
      return null;
    }
    patched[entry.block] = {
      ...block,
      blockGap: {
        summary: `Only ${entry.foundCount} of the required ${entry.requiredCount} ${entry.noun} could be sourced from the fetched competitor evidence.`,
        foundCount: entry.foundCount,
        requiredCount: entry.requiredCount,
        sourcingPlan: [
          `Re-run acquisition for ${entry.block} to source ${entry.requiredCount - entry.foundCount} more ${entry.noun} from verified sources.`,
        ],
      },
    };
  }

  return { body: patched, injected: true };
}

export function buildCompetitorStrategicEvidenceGapArtifact({
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

  if (errors.length === 0) {
    return undefined;
  }

  const originalBody = getRecord(artifact.body);
  if (originalBody === null) {
    return undefined;
  }

  // Partition: strategic-text paths get evidence-gap strings; structural
  // count-floors get schema-valid blockGaps. Any error in neither bucket (nor
  // the waivable sources floor) falls through to a hard fail.
  const strategicErrors = errors.filter(
    (error) => parseCompetitorStrategicEvidenceGapPath(error) !== null,
  );
  const structuralErrors = errors.filter(
    (error) => parseCompetitorStrategicEvidenceGapPath(error) === null,
  );

  let body: Record<string, unknown> | null = structuredClone(originalBody);

  for (const error of strategicErrors) {
    const path = parseCompetitorStrategicEvidenceGapPath(error);
    if (path === null || body === null) {
      return undefined;
    }
    body = withCompetitorStrategicEvidenceGapField({ body, path });
  }

  if (body === null) {
    return undefined;
  }

  let hasStructuralGap = false;
  if (structuralErrors.length > 0) {
    const next = buildCompetitorStructuralBlockGapBody({
      body,
      errors: structuralErrors,
    });
    if (next === null) {
      return undefined;
    }
    body = next.body;
    hasStructuralGap = next.injected;
  }

  // When a structural blockGap was injected, force the artifact to read as an
  // honest gap (mirrors the OfferDiagnostic gap builder).
  const gapOverrides = hasStructuralGap
    ? {
        verdict:
          "Some competitor-landscape blocks are below the evidence bar; treat the gapped findings as unproven.",
        statusSummary:
          "The section completed with structural evidence gaps so downstream synthesis can proceed without fabricated rows.",
        confidence: Math.min(artifact.confidence, 0.3),
      }
    : {};

  const candidate = artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      ...artifact,
      ...gapOverrides,
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

  // Partition the flagged minimums errors: strategic-text/falsifiability paths
  // get evidence-gap strings; structural count-floors get schema-valid
  // blockGaps. Any error in neither bucket falls through to a hard fail.
  const strategicErrors = errors.filter(
    (error) => parseOfferDiagnosticStrategicEvidenceGapPath(error) !== null,
  );
  const structuralErrors = errors.filter(
    (error) => parseOfferDiagnosticStrategicEvidenceGapPath(error) === null,
  );

  let patchedBody: Record<string, unknown> = originalBody;

  if (strategicErrors.length > 0) {
    const next = buildOfferDiagnosticEvidenceGapBody({
      body: patchedBody,
      errors: strategicErrors,
    });
    if (next === null) {
      return undefined;
    }
    patchedBody = next;
  }

  let hasStructuralGap = false;
  if (structuralErrors.length > 0) {
    const next = buildOfferDiagnosticBlockGapBody({
      body: patchedBody,
      errors: structuralErrors,
    });
    if (next === null) {
      return undefined;
    }
    patchedBody = next;
    hasStructuralGap = true;
  }

  // When a structural blockGap was injected, force the artifact to read as an
  // honest gap so the commit tiers to needs_review/insufficient (mirrors the
  // BuyerICP gap builder).
  const gapOverrides = hasStructuralGap
    ? {
        verdict:
          "Some offer-diagnostic blocks are below the evidence bar; treat the gapped findings as unproven.",
        statusSummary:
          "The section completed with structural evidence gaps so downstream synthesis can proceed without fabricated rows.",
        confidence: Math.min(artifact.confidence, 0.3),
      }
    : {};

  const candidate = artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      ...artifact,
      ...gapOverrides,
      body: patchedBody,
    });
  const minimums = definition.validateMinimums(candidate);

  return minimums.ok ? candidate : undefined;
}

// MarketCategory evidence-gap escape hatch — mirrors the OfferDiagnostic builder.
// Softenable failures: categoryPowerBet strategic text (evidence-gap string),
// the four structural count-floors (schema-valid blockGap), and the section-level
// sources floor (backfilled from researchInput). Any error outside these buckets
// falls through to a hard fail because a rerun, not a gap string, is the fix.
const marketCategoryStrategicTextErrorSuffix = competitorStrategicTextErrorSuffix;
const marketCategoryStrategicEvidenceGapPaths = new Set([
  "body.categoryPowerBet.bet",
  "body.categoryPowerBet.whyNow",
  "body.categoryPowerBet.riskAccepted",
]);

function parseMarketCategoryStrategicEvidenceGapPath(
  error: string,
): string | null {
  if (!error.endsWith(marketCategoryStrategicTextErrorSuffix)) {
    return null;
  }
  const path = error.slice(0, -marketCategoryStrategicTextErrorSuffix.length);
  return marketCategoryStrategicEvidenceGapPaths.has(path) ? path : null;
}

const marketCategoryStructuralFloorMatchers: ReadonlyArray<{
  block: string;
  requiredCount: number;
  noun: string;
  matches: (error: string) => number | null;
}> = [
  {
    block: "categoryDefinition",
    requiredCount: 2,
    noun: "adjacent categories",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.categoryDefinition\.adjacentCategories: have (\d+), need >=2 categories buyers confuse this with\.$/,
      ),
  },
  {
    block: "marketSize",
    requiredCount: 2,
    noun: "market trajectory signals",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.marketSize\.signals: have (\d+), need >=2 public trajectory signals or body\.marketSize\.blockGap\.$/,
      ),
  },
  {
    block: "structuralForces",
    requiredCount: 1,
    noun: "structural forces",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.structuralForces\.forces: have (\d+), need >=1 structural force with evidence or body\.structuralForces\.blockGap\.$/,
      ),
  },
  {
    block: "categoryMaturity",
    requiredCount: 2,
    noun: "maturity signals",
    matches: (error) =>
      parseCompetitorFoundCount(
        error,
        /^body\.categoryMaturity\.classification\.supportingSignals: have (\d+), need >=2 maturity signals\.$/,
      ),
  },
];

const marketCategorySourcesFloorPattern =
  /^sources: have \d+, need >=3 Section-level sources\.$/;

export function buildMarketCategoryEvidenceGapArtifact({
  artifact,
  definition,
  errors,
  input,
  researchInput,
}: {
  artifact: ArtifactEnvelope;
  definition: RuntimeSectionDefinition;
  errors: readonly string[];
  input: RunSectionInput;
  researchInput: ResearchInput;
}): ArtifactEnvelope | undefined {
  if (input.sectionId !== "positioningMarketCategory") {
    return undefined;
  }

  if (errors.length === 0) {
    return undefined;
  }

  const originalBody = getRecord(artifact.body);
  if (originalBody === null) {
    return undefined;
  }

  let body: Record<string, unknown> = structuredClone(originalBody);
  let hasGap = false;
  let needsSourceBackfill = false;

  for (const error of errors) {
    const strategicPath = parseMarketCategoryStrategicEvidenceGapPath(error);
    if (strategicPath !== null) {
      const [, groupKey, fieldKey] = strategicPath.split(".");
      const group = getRecord(body[groupKey]);
      if (group === null) {
        return undefined;
      }
      body = {
        ...body,
        [groupKey]: {
          ...group,
          [fieldKey]:
            buildCompetitorStrategicEvidenceGapValue(strategicPath),
        },
      };
      hasGap = true;
      continue;
    }

    const structuralMatcher = marketCategoryStructuralFloorMatchers.find(
      (matcher) => matcher.matches(error) !== null,
    );
    if (structuralMatcher !== undefined) {
      const foundCount = structuralMatcher.matches(error) ?? 0;
      const block = getRecord(body[structuralMatcher.block]);
      if (block === null) {
        return undefined;
      }
      body[structuralMatcher.block] = {
        ...block,
        blockGap: {
          summary: `Only ${foundCount} of the required ${structuralMatcher.requiredCount} ${structuralMatcher.noun} could be sourced from the fetched market evidence.`,
          foundCount,
          requiredCount: structuralMatcher.requiredCount,
          sourcingPlan: [
            `Re-run acquisition for ${structuralMatcher.block} to source ${structuralMatcher.requiredCount - foundCount} more ${structuralMatcher.noun} from verified sources.`,
          ],
        },
      };
      hasGap = true;
      continue;
    }

    if (marketCategorySourcesFloorPattern.test(error)) {
      needsSourceBackfill = true;
      hasGap = true;
      continue;
    }

    // Unrecognized failure — hard-fail (rerun is the fix).
    return undefined;
  }

  if (!hasGap) {
    return undefined;
  }

  // Backfill section sources from the research input when below the floor — the
  // researchInput sources are real SourceRefs, never fabricated.
  const backfilledSources = needsSourceBackfill
    ? [
        ...artifact.sources,
        ...researchInput.sources.filter(
          (source) =>
            !artifact.sources.some((existing) => existing.url === source.url),
        ),
      ].slice(0, 12)
    : artifact.sources;

  const candidate = artifactEnvelopeSchema
    .extend({ body: definition.bodySchema })
    .parse({
      ...artifact,
      verdict:
        "Some market-category blocks are below the evidence bar; treat the gapped findings as unproven.",
      statusSummary:
        "The section completed with evidence gaps so downstream synthesis can proceed without fabricated rows.",
      confidence: Math.min(artifact.confidence, 0.3),
      sources: backfilledSources,
      body,
    });
  const minimums = definition.validateMinimums(candidate);

  return minimums.ok ? candidate : undefined;
}

// DemandIntent evidence-gap escape hatch. No softenable strategic-text/structural
// partition is needed: the deadline-exhaustion honest body (which ALREADY passes
// validateDemandIntentMinimums via per-block blockGaps + ordered moves) is the
// honest degraded shape. Wrap it in the envelope with an evidence-gap verdict so
// any non-deadline minimums/required-evidence/hook failure commits degraded
// instead of hard-erroring the run and blocking the 6/6 rollup.
export function buildDemandIntentEvidenceGapArtifact({
  artifact,
  definition,
  deps,
  input,
  researchInput,
}: {
  artifact: ArtifactEnvelope;
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
}): ArtifactEnvelope | undefined {
  if (input.sectionId !== "positioningDemandIntent") {
    return undefined;
  }

  const body = buildDeadlineExhaustionHonestGapBody(input.sectionId);
  if (body === undefined) {
    return undefined;
  }

  const observedAt = getNow(deps).toISOString();
  // DemandIntent requires >=5 section sources. Backfill from the real research
  // input, then pad with deadline-gap placeholders so the floor is met without
  // ever fabricating evidence.
  const sources = [
    ...artifact.sources,
    ...researchInput.sources.filter(
      (source) =>
        !artifact.sources.some((existing) => existing.url === source.url),
    ),
    ...buildDeadlineExhaustionGapSources(researchInput, observedAt),
  ].slice(0, 12);

  let candidate: ArtifactEnvelope;
  try {
    candidate = artifactEnvelopeSchema
      .extend({ body: definition.bodySchema })
      .parse({
        ...artifact,
        verdict:
          "Demand & intent signals are below the evidence bar; treat the gapped findings as unproven.",
        statusSummary:
          "The section completed with evidence gaps so downstream synthesis can proceed without fabricated demand signals.",
        confidence: Math.min(artifact.confidence, 0.3),
        sources,
        body,
      });
  } catch {
    return undefined;
  }

  return definition.validateMinimums(candidate).ok ? candidate : undefined;
}

function buildVoiceOfCustomerPrepassEvidenceGapArtifact({
  acquisitionAttempts,
  acquisitionLedger,
  definition,
  deps,
  input,
  issue,
  quoteCandidates,
  researchInput,
  result,
}: {
  acquisitionAttempts?: readonly VoiceOfCustomerAcquisitionAttempt[];
  acquisitionLedger?: readonly VoiceOfCustomerAcquisitionLedgerRow[];
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  issue: string;
  quoteCandidates?: readonly VoiceOfCustomerCandidate[];
  researchInput: ResearchInput;
  result: Exclude<VoiceOfCustomerCandidateResult, { ok: true }>;
}): ArtifactEnvelope {
  return buildVoiceOfCustomerEvidenceGapArtifact({
    acquisitionAttempts,
    acquisitionLedger,
    definition,
    deps,
    facts: getVoiceOfCustomerCandidateEvidenceGapFacts({
      quoteCandidates,
      result,
    }),
    input,
    issue,
    quoteCandidates,
    researchInput,
  });
}

function getVoiceOfCustomerCandidateDomains(
  candidates: readonly VoiceOfCustomerCandidate[],
): string[] {
  return Array.from(new Set(candidates.map((candidate) => candidate.domain)));
}

export function getVoiceOfCustomerCandidateEvidenceGapFacts({
  quoteCandidates,
  result,
}: {
  quoteCandidates?: readonly VoiceOfCustomerCandidate[];
  result: VoiceOfCustomerCandidateResult;
}): VoiceOfCustomerEvidenceGapFacts {
  if (quoteCandidates !== undefined && quoteCandidates.length > 0) {
    const surfacedPainCandidates =
      selectVoiceOfCustomerPainCandidates(quoteCandidates);
    const observedPainSourceDomains =
      getVoiceOfCustomerCandidateDomains(surfacedPainCandidates);

    return {
      ok: true,
      foundPainQuoteCount: surfacedPainCandidates.length,
      foundDistinctPainSourceCount: observedPainSourceDomains.length,
      observedPainSourceDomains,
    };
  }

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

function getVoiceOfCustomerStructuredFailureIssue(
  errors: readonly string[],
): string | undefined {
  if (errors.length === 0) {
    return undefined;
  }

  return hasTerminalStructuredError(errors)
    ? "Voice of Customer structured synthesis timed out before a source-backed artifact could be promoted."
    : "Voice of Customer structured synthesis failed to produce a parseable source-backed artifact before repair could be trusted.";
}

const voiceOfCustomerModelAuthoredEvidenceGapIssue =
  "Voice of Customer structured synthesis returned a mixed model-authored gap; the runner must promote deterministic candidate synthesis or a runner-owned evidence-gap artifact instead of committing promoted content with body.evidenceGap=true.";

function isVoiceOfCustomerCandidateFloorGap(reason: string): boolean {
  return (
    reason === "insufficient_candidates" ||
    reason === "insufficient_independent_domains"
  );
}

// Synthesis gaps whose captured candidate pack is SAFE to surface as honest-gap
// evidence (low-confidence, evidenceGap=true). A `validation_failed` pack has
// already cleared the self_sourced_candidate (synthesis :436) and
// single_source_majority (synthesis :448) integrity gates — both return BEFORE
// validation_failed (:475/:489) — so its real verbatims would otherwise be
// discarded into empty blocks for no integrity reason. ALLOW-LIST by design:
// self_sourced_candidate / single_source_majority / candidate_pack_gap are
// deliberately excluded so this can never re-surface the laundered/empty packs
// the integrity gate rejects. Never convert this to a deny-list.
function isVoiceOfCustomerSurfaceableSynthesisGap(reason: string): boolean {
  return (
    reason === "insufficient_candidates" ||
    reason === "insufficient_independent_domains" ||
    reason === "insufficient_success_language" ||
    reason === "validation_failed"
  );
}

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

  return voiceOfCustomerModelAuthoredEvidenceGapIssue;
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

  // Safety net for the structured-failure path: when the candidate pack itself
  // cleared its floors (result.ok), surface its real captured verbatims rather
  // than discarding them into empty evidence-gap blocks. Path #2 has already
  // excluded the self_sourced_candidate / single_source_majority integrity
  // reasons before this point, so this cannot re-launder a tainted pack.
  const quoteCandidates = prepass.result.ok
    ? prepass.result.pack.candidates
    : prepass.directionalCandidates;
  const facts = getVoiceOfCustomerCandidateEvidenceGapFacts({
    quoteCandidates,
    result: prepass.result,
  });
  const structuredFailureIssue =
    getVoiceOfCustomerStructuredFailureIssue(errors);
  const issue = [
    ...(structuredFailureIssue === undefined ? [] : [structuredFailureIssue]),
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
    quoteCandidates,
    researchInput,
  });
}

// R1 deadline-exhaustion honest-gap builder. When a heavy section's structured
// first attempt fails AND there is no budget left for the deadline-aware
// fallback (isDeadlineExhaustionFailure), there is no partial to salvage — the
// partial is discarded and structurally unusable. Author a from-scratch
// schema-valid empty-but-honest body so deadline exhaustion degrades to an
// honest-gap COMMIT (needs_review/insufficient) instead of status=error, which
// would stall the run below 6/6. VALIDATE the skeleton via bodySchema.parse +
// validateMinimums and return undefined if it does not pass, so a schema-drift
// skeleton never commits — it falls through to a genuine error.
const deadlineGapNote =
  "evidence gap: section exceeded its time budget — rerun to retry";
const deadlineGapSourcingPlan = [
  "Rerun this section to retry — it exceeded its time budget",
];

function buildDeadlineExhaustionGapBlock(requiredCount: number): {
  summary: string;
  foundCount: number;
  requiredCount: number;
  sourcingPlan: string[];
} {
  return {
    summary: deadlineGapNote,
    foundCount: 0,
    requiredCount,
    sourcingPlan: [...deadlineGapSourcingPlan],
  };
}

// >=5 placeholder gap sources derived from the subject/company URL. They read
// as gap placeholders (deadline-exhaustion titles + #section-gap fragments),
// not fabricated evidence, and satisfy the section source floors (>=5).
function buildDeadlineExhaustionGapSources(
  researchInput: ResearchInput,
  observedAt: string,
): ArtifactEnvelope["sources"] {
  const baseUrl = researchInput.company.websiteUrl;
  return Array.from({ length: 5 }, (_unused, index) => ({
    id: `deadline-gap-${index + 1}`,
    observedAt,
    title:
      "Placeholder — section exceeded its time budget before sources were committed",
    url: `${baseUrl}#section-gap-${index + 1}`,
  }));
}

function buildDeadlineExhaustionStrategicInsight(): Record<string, unknown> {
  return {
    strategicVerdict: deadlineGapNote,
    keyTension: {
      tension: `${deadlineGapNote} — no tension could be sourced in time`,
      side: `${deadlineGapNote} — no side could be sourced in time`,
      costOfPosition: `${deadlineGapNote} — cost of position not sourced in time`,
    },
  };
}

function buildDeadlineExhaustionOrderedMoves(): Array<Record<string, unknown>> {
  return [
    {
      rank: 1,
      move: `${deadlineGapNote} — first move not derivable until a rerun completes`,
      dependsOn: [],
      rationale: `${deadlineGapNote} — rationale not derivable until a rerun completes`,
    },
    {
      rank: 2,
      move: `${deadlineGapNote} — second move not derivable until a rerun completes`,
      dependsOn: [1],
      rationale: `${deadlineGapNote} — second rationale not derivable until a rerun completes`,
    },
  ];
}

function buildDeadlineExhaustionProvesWrongIf(): Record<string, unknown> {
  return {
    metric: deadlineGapNote,
    threshold: deadlineGapNote,
    window: deadlineGapNote,
  };
}

// Deadline-salvage persona rescue. When BuyerICP exhausts its clock, the gap
// body used to hardcode personas:[] and silently discard the named customer
// champions the venue/case-study prepass had ALREADY acquired (run b0d12b45:
// grounded buyers thrown away, then committed as an empty "evidence gap" — the
// acquisitionLedger "not_selected" labels were a mirror of the empty body, not
// a quality decision). Promote the grounded, named candidates we already hold
// into real personas instead. NO fabrication: only candidates that pass the
// SAME named-identity + http-url + shared-listing-laundering gates the normal
// commit path enforces are promoted.
const DEADLINE_FINANCE_BUYER_TITLE_PATTERN =
  /\b(cfo|controller|treasur\w*|fp&a|finance|accounting|spend)\b/i;
const DEADLINE_EXECUTIVE_TITLE_PATTERN =
  /\b(chief|c[a-z]o|controller|vp|vice\s+president|head|director|founder|owner|president|partner)\b/i;
const DEADLINE_MANAGER_TITLE_PATTERN = /\b(manager|lead|principal|senior)\b/i;

function inferDeadlinePersonaRole(title: string): string {
  return DEADLINE_FINANCE_BUYER_TITLE_PATTERN.test(title)
    ? "economic-buyer"
    : "champion";
}

function inferDeadlinePersonaSeniority(title: string): string {
  if (DEADLINE_EXECUTIVE_TITLE_PATTERN.test(title)) {
    return "executive";
  }
  if (DEADLINE_MANAGER_TITLE_PATTERN.test(title)) {
    return "manager";
  }
  return "individual-contributor";
}

export function promoteDeadlineBuyerICPPersonas(
  buyerPersonaCandidates: readonly BuyerPersonaCandidate[],
): Array<Record<string, unknown>> {
  const seenNameKeys = new Set<string>();
  const personas: Array<Record<string, unknown>> = [];
  for (const candidate of buyerPersonaCandidates) {
    if (
      candidate.venue !== "case_study_champions" &&
      candidate.venue !== "event_speakers"
    ) {
      continue;
    }
    if (!isHttpUrl(candidate.url)) {
      continue;
    }
    // Option B: validate as a grounded buyer unit (named human OR sourced
    // role/segment). Mined champions carry a human name in `name`, which still
    // passes; the unified validator centralizes the gate.
    if (
      !isValidGroundedBuyerUnit({
        name: candidate.name,
        title: candidate.title,
        company: candidate.company,
        sourceUrl: candidate.url,
      })
    ) {
      continue;
    }
    const nameKey = normalizeNameKey(candidate.name);
    if (nameKey.length === 0 || seenNameKeys.has(nameKey)) {
      continue;
    }
    seenNameKeys.add(nameKey);
    personas.push({
      name: candidate.name,
      title: candidate.title,
      company: candidate.company,
      sourceUrl: candidate.url,
      role: inferDeadlinePersonaRole(candidate.title),
      seniority: inferDeadlinePersonaSeniority(candidate.title),
      evidence:
        candidate.venue === "case_study_champions"
          ? `Named customer champion on ${candidate.company}'s public case study (${candidate.url}).`
          : `Named as a customer/speaker in public event materials (${candidate.url}).`,
    });
  }

  // Same shared-listing laundering gate the normal commit path applies: >=2
  // personas behind one non-permalink URL are dropped unless they are
  // co-champions mined from that exact case-study page.
  const guarded = suppressSharedListingUrlPersonas(
    { prose: deadlineGapNote, personas },
    buyerPersonaCandidates,
  );
  return Array.isArray(guarded.personas)
    ? (guarded.personas as Array<Record<string, unknown>>)
    : personas;
}

export function buildDeadlineExhaustionHonestGapBody(
  sectionId: SectionId,
  buyerPersonaCandidates: readonly BuyerPersonaCandidate[] = [],
): Record<string, unknown> | undefined {
  const strategicInsight = buildDeadlineExhaustionStrategicInsight();
  switch (sectionId) {
    case "positioningMarketCategory":
      return {
        strategicInsight,
        categoryPowerBet: {
          bet: deadlineGapNote,
          whyNow: `${deadlineGapNote} — timing not derivable until a rerun completes`,
          riskAccepted: `${deadlineGapNote} — risk not derivable until a rerun completes`,
        },
        categoryDefinition: {
          prose: deadlineGapNote,
          adjacentCategories: [],
          blockGap: buildDeadlineExhaustionGapBlock(2),
        },
        marketSize: {
          prose: deadlineGapNote,
          signals: [],
          bottomUpTam: {
            recipeName: "keyword-demand-reachable-revenue",
            formula: deadlineGapNote,
            reachableRevenueEstimate: deadlineGapNote,
            inputs: [],
            caveats: [deadlineGapNote],
          },
          blockGap: buildDeadlineExhaustionGapBlock(2),
        },
        structuralForces: {
          prose: deadlineGapNote,
          forces: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        categoryMaturity: {
          prose: deadlineGapNote,
          classification: {
            stage: "emerging",
            evidenceSummary: deadlineGapNote,
            supportingSignals: [],
          },
          blockGap: buildDeadlineExhaustionGapBlock(2),
        },
      };
    case "positioningBuyerICP": {
      // Rescue the named champions the prepass already acquired instead of
      // committing an empty persona block (run b0d12b45). Drop the persona
      // blockGap only when >=3 grounded personas clear the floor by count;
      // 1-2 commit alongside an honest gap; 0 keeps the original empty gap.
      const rescuedPersonas =
        promoteDeadlineBuyerICPPersonas(buyerPersonaCandidates);
      const personaReality =
        rescuedPersonas.length >= 3
          ? {
              prose:
                "Full ICP rerun pending, but named customer champions were recovered from public case studies before the deadline.",
              personas: rescuedPersonas,
            }
          : rescuedPersonas.length > 0
            ? {
                prose:
                  "Partial named-champion evidence recovered before the deadline; the full persona panel is incomplete pending a rerun.",
                personas: rescuedPersonas,
                blockGap: buildDeadlineExhaustionGapBlock(3),
              }
            : {
                prose: deadlineGapNote,
                personas: [],
                blockGap: buildDeadlineExhaustionGapBlock(3),
              };
      return {
        strategicInsight,
        icpExistenceCheck: {
          prose: deadlineGapNote,
          firmographicCuts: [],
          blockGap: buildDeadlineExhaustionGapBlock(3),
        },
        personaReality,
        awarenessDistribution: {
          prose: deadlineGapNote,
          levels: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        buyingContext: {
          prose: deadlineGapNote,
          triggers: [],
          blockGap: buildDeadlineExhaustionGapBlock(3),
        },
        clusters: {
          prose: deadlineGapNote,
          venues: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
      };
    }
    case "positioningCompetitorLandscape":
      return {
        strategicInsight,
        whereToAttackVsConcede: {
          attack: deadlineGapNote,
          concede: `${deadlineGapNote} — concede stance not derivable until a rerun completes`,
          rationale: `${deadlineGapNote} — rationale not derivable until a rerun completes`,
        },
        incumbentBlindSpot: {
          incumbent: deadlineGapNote,
          blindSpot: `${deadlineGapNote} — blind spot not derivable until a rerun completes`,
          whyTheyMissIt: `${deadlineGapNote} — reason not derivable until a rerun completes`,
        },
        competitorSet: {
          prose: deadlineGapNote,
          competitors: [],
          blockGap: buildDeadlineExhaustionGapBlock(3),
        },
        positioningTaxonomy: {
          prose: deadlineGapNote,
          axes: [],
          blockGap: buildDeadlineExhaustionGapBlock(2),
        },
        pricingReality: {
          prose: deadlineGapNote,
          dataPoints: [],
          blockGap: buildDeadlineExhaustionGapBlock(2),
        },
        shareOfVoice: {
          prose: deadlineGapNote,
          slices: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        publicWeaknesses: {
          prose: deadlineGapNote,
          items: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        narrativeArcs: {
          prose: deadlineGapNote,
          arcs: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        adPresence: {
          prose: deadlineGapNote,
          signals: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        adEvidence: {
          prose: deadlineGapNote,
          advertiserGroups: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
      };
    case "positioningVoiceOfCustomer":
      return {
        retrievalSummary: deadlineGapNote,
        strategicInsight,
        fourForcesBalanceVerdict: {
          push: deadlineGapNote,
          pull: `${deadlineGapNote} — pull not derivable until a rerun completes`,
          anxiety: `${deadlineGapNote} — anxiety not derivable until a rerun completes`,
          habit: `${deadlineGapNote} — habit not derivable until a rerun completes`,
          balanceVerdict: `${deadlineGapNote} — balance verdict not derivable until a rerun completes`,
        },
        painLanguage: {
          prose: deadlineGapNote,
          quotes: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        objections: {
          prose: deadlineGapNote,
          items: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        switchingStories: {
          prose: deadlineGapNote,
          stories: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        decisionCriteria: {
          prose: deadlineGapNote,
          criteria: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        successLanguage: {
          prose: deadlineGapNote,
          quotes: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
      };
    case "positioningDemandIntent":
      return {
        strategicInsight,
        orderedMoves: buildDeadlineExhaustionOrderedMoves(),
        provesWrongIf: buildDeadlineExhaustionProvesWrongIf(),
        keywordDemand: {
          prose: deadlineGapNote,
          keywords: [],
          blockGap: buildDeadlineExhaustionGapBlock(5),
        },
        questionMining: {
          prose: deadlineGapNote,
          questions: [],
          blockGap: buildDeadlineExhaustionGapBlock(10),
        },
        contentGaps: {
          prose: deadlineGapNote,
          gaps: [],
          blockGap: buildDeadlineExhaustionGapBlock(3),
        },
        intentSignals: {
          prose: deadlineGapNote,
          items: [],
          blockGap: buildDeadlineExhaustionGapBlock(5),
        },
        venueMap: {
          prose: deadlineGapNote,
          venues: [],
          blockGap: buildDeadlineExhaustionGapBlock(4),
        },
      };
    case "positioningOfferDiagnostic":
      return {
        strategicInsight,
        orderedMoves: buildDeadlineExhaustionOrderedMoves(),
        provesWrongIf: buildDeadlineExhaustionProvesWrongIf(),
        singleBindingConstraint: {
          constraint: deadlineGapNote,
          whyBinding: `${deadlineGapNote} — why binding not derivable until a rerun completes`,
          unlockCondition: `${deadlineGapNote} — unlock condition not derivable until a rerun completes`,
        },
        offerMarketFit: {
          prose: deadlineGapNote,
          proofPoints: [],
          blockGap: buildDeadlineExhaustionGapBlock(3),
        },
        funnelDiagnosis: {
          prose: deadlineGapNote,
          breaks: [],
          blockGap: buildDeadlineExhaustionGapBlock(2),
        },
        channelTruth: {
          prose: deadlineGapNote,
          channels: [],
          blockGap: buildDeadlineExhaustionGapBlock(3),
        },
        retentionHealth: {
          prose: deadlineGapNote,
          signals: [],
          blockGap: buildDeadlineExhaustionGapBlock(1),
        },
        redFlags: {
          prose: deadlineGapNote,
          items: [],
          blockGap: buildDeadlineExhaustionGapBlock(3),
        },
      };
    default:
      return undefined;
  }
}

function buildDeadlineExhaustionHonestGapArtifact({
  buyerPersonaCandidates,
  definition,
  deps,
  input,
  researchInput,
}: {
  buyerPersonaCandidates?: readonly BuyerPersonaCandidate[];
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
}): ArtifactEnvelope | undefined {
  const body = buildDeadlineExhaustionHonestGapBody(
    input.sectionId,
    buyerPersonaCandidates ?? [],
  );
  if (body === undefined) {
    return undefined;
  }

  const observedAt = getNow(deps).toISOString();
  let candidate: ArtifactEnvelope;
  try {
    candidate = artifactEnvelopeSchema
      .extend({ body: definition.bodySchema })
      .parse({
        id: getNewId(deps),
        runId: input.runId,
        sectionId: input.sectionId,
        sectionTitle: definition.title,
        verdict: deadlineGapNote,
        statusSummary: deadlineGapNote,
        confidence: 0.1,
        sources: buildDeadlineExhaustionGapSources(researchInput, observedAt),
        body,
        createdAt: observedAt,
      });
  } catch {
    return undefined;
  }

  return definition.validateMinimums(candidate).ok ? candidate : undefined;
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
    !hasVoiceOfCustomerStructuredSynthesisFailure({
      errors,
      input,
      voiceOfCustomerPrepass,
    })
  ) {
    return undefined;
  }

  if (!voiceOfCustomerPrepass.result.ok) {
    if (
      voiceOfCustomerPrepass.directionalCandidates.length === 0 ||
      !isVoiceOfCustomerCandidateFloorGap(
        voiceOfCustomerPrepass.result.gap.reason,
      )
    ) {
      return undefined;
    }

    const structuredFailureIssue =
      getVoiceOfCustomerStructuredFailureIssue(errors);
    const issue = [
      voiceOfCustomerPrepass.result.gap.message,
      ...(structuredFailureIssue === undefined ? [] : [structuredFailureIssue]),
      `Structured attempt issues: ${errors.join("; ")}`,
    ].join(" ");

    return buildVoiceOfCustomerEvidenceGapArtifact({
      acquisitionAttempts: voiceOfCustomerPrepass.acquisitionAttempts,
      acquisitionLedger: voiceOfCustomerPrepass.acquisitionLedger,
      definition,
      deps,
      facts: getVoiceOfCustomerCandidateEvidenceGapFacts({
        quoteCandidates: voiceOfCustomerPrepass.directionalCandidates,
        result: voiceOfCustomerPrepass.result,
      }),
      input,
      issue,
      quoteCandidates: voiceOfCustomerPrepass.directionalCandidates,
      researchInput,
    });
  }

  const synthesis = synthesizeVoiceOfCustomerFromCandidates({
    candidateResult: voiceOfCustomerPrepass.result,
    now: () => getNow(deps),
    researchInput,
  });

  if (!synthesis.ok) {
    if (
      voiceOfCustomerPrepass.result.pack.candidates.length === 0 ||
      !isVoiceOfCustomerSurfaceableSynthesisGap(synthesis.gap.reason)
    ) {
      return undefined;
    }

    const structuredFailureIssue =
      getVoiceOfCustomerStructuredFailureIssue(errors);
    const issue = [
      synthesis.gap.message,
      ...(structuredFailureIssue === undefined ? [] : [structuredFailureIssue]),
      `Structured attempt issues: ${errors.join("; ")}`,
    ].join(" ");

    return buildVoiceOfCustomerEvidenceGapArtifact({
      acquisitionAttempts: voiceOfCustomerPrepass.acquisitionAttempts,
      acquisitionLedger: voiceOfCustomerPrepass.acquisitionLedger,
      definition,
      deps,
      facts: getVoiceOfCustomerCandidateEvidenceGapFacts({
        quoteCandidates: voiceOfCustomerPrepass.result.pack.candidates,
        result: voiceOfCustomerPrepass.result,
      }),
      input,
      issue,
      quoteCandidates: voiceOfCustomerPrepass.result.pack.candidates,
      researchInput,
    });
  }

  // Safety net: even though the deterministic partition assigns each candidate
  // to exactly one block, dedupe the body so any within-pack duplicate snippet
  // (the same review reached via two index URLs) cannot ship as two "verbatim"
  // quotes. With a disjoint partition this is a no-op; it only fires on real
  // duplicates.
  const { body: dedupedBody } = dedupeQuoteBearingFields({
    body: synthesis.output.body as Record<string, unknown>,
  });
  const output: SectionOutput<Record<string, unknown>> = {
    ...synthesis.output,
    body: dedupedBody,
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
    // Dedup dropped a required block below floor (or synthesis produced an
    // otherwise sub-floor body). Ship an HONEST evidence gap rather than a
    // confident statusSummary that claims source-backed coverage it no longer
    // has — and never silently kill the section.
    const issue = [
      `Deterministic VoC body failed minimums after dedup: ${minimums.errors.join(
        "; ",
      )}`,
      `Structured attempt issues: ${errors.join("; ")}`,
    ].join(" ");

    return buildVoiceOfCustomerEvidenceGapArtifact({
      acquisitionAttempts: voiceOfCustomerPrepass.acquisitionAttempts,
      acquisitionLedger: voiceOfCustomerPrepass.acquisitionLedger,
      definition,
      deps,
      facts: getVoiceOfCustomerCandidateEvidenceGapFacts({
        quoteCandidates: voiceOfCustomerPrepass.result.pack.candidates,
        result: voiceOfCustomerPrepass.result,
      }),
      input,
      issue,
      quoteCandidates: voiceOfCustomerPrepass.result.pack.candidates,
      researchInput,
    });
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
  /^body\.personaReality\.personas\[\d+\]\.name: must be a named person, public reviewer handle, or a sourced role\/segment buyer unit \(segmentLabel grounded on the live source\); a bare generic role\/segment\/company label with no grounding does not qualify\.$/;
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
  // Option B: a valid grounded buyer unit (live-sourced role/segment OR named
  // human), not strictly a named human. Keeps grounded role/segment personas
  // when the gap-artifact partition runs.
  return isValidGroundedBuyerUnit(
    persona as unknown as Record<string, unknown>,
  );
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
      lowerError.includes("response did not match schema") ||
      lowerError.includes("failed tolerant decode")
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
  if (shouldUsePreparedContext(deps)) {
    return [];
  }

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
  artifact: committedArtifact,
  buyerPersonaCandidates,
  buyerPersonaLookups,
  committedArtifacts,
  definition,
  deps,
  input,
  startedAt,
}: {
  artifact: ArtifactEnvelope;
  buyerPersonaCandidates?: readonly BuyerPersonaCandidate[];
  buyerPersonaLookups?: readonly BuyerPersonaLookup[];
  committedArtifacts?: Record<string, unknown>;
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  startedAt: number;
}): Promise<RunSectionResult> {
  // Wave 2B: attach the BuyerICP acquisition ledger + sufficiency derived from the
  // persona-venue prepass candidates — or honest query-level attempt rows when the
  // prepass ran but surfaced no candidate. No-op for non-BuyerICP sections or when
  // the committed body carries no evidenceGapReport.
  // Final honest-floor guard before persistence (BuyerICP only; no-op otherwise):
  // re-inject any blockGap a downstream step dropped so a thinned block commits
  // degraded instead of hard-erroring the run + blocking the 6-section rollup.
  const flooredArtifact =
    input.sectionId === "positioningBuyerICP"
      ? withBuyerICPCommitFloorRepair(committedArtifact)
      : committedArtifact;
  const ledgerArtifact = withBuyerICPAcquisitionLedger({
    artifact: flooredArtifact,
    candidates: buyerPersonaCandidates ?? [],
    lookups: buyerPersonaLookups,
    observedAt: getNow(deps).toISOString(),
  });
  // Wave 2C: attach the deterministic, code-built row-level evidence pack tying
  // each synthesized paid-media row to its exact upstream committed row(s) (or an
  // honest gap). No-op for non-paid-media sections.
  const artifact = withPaidMediaEvidencePack({
    artifact: ledgerArtifact,
    committedArtifacts,
  });
  await appendSubSectionCommittedEvents({
    artifact,
    deps,
    input,
  });
  // Sandbox-only, env-gated, best-effort: dump the fully-built artifact before
  // persistence validation so a CLI proof run can inspect it even when the
  // persistence gate throws (e.g. an authoring-minimum shortfall). Off in prod.
  if (process.env.ZZ_DUMP_ARTIFACT !== undefined) {
    try {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync("tmp/zz-section-out", { recursive: true });
      writeFileSync(
        `tmp/zz-section-out/_dump-${input.sectionId}.json`,
        JSON.stringify(artifact, null, 2),
      );
    } catch {
      // best-effort debug aid; never affects the run
    }
  }
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
  demandIntentEvidenceGapArtifact?: ArtifactEnvelope;
  marketCategoryEvidenceGapArtifact?: ArtifactEnvelope;
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
    attempt.offerDiagnosticEvidenceGapArtifact ??
    attempt.marketCategoryEvidenceGapArtifact ??
    attempt.demandIntentEvidenceGapArtifact
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

const smallNContainmentProbeFloor = 4;
const jsWalledContainmentDomains = new Set([
  "capterra.com",
  "g2.com",
  "reddit.com",
  "trustradius.com",
  "trustpilot.com",
  "youtu.be",
  "youtube.com",
]);
const forumHostPattern = /(^|\.)(?:community|discourse|forum|forums)(\.|$)/i;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isGapSubstitutedEvidenceBlock(value: unknown): boolean {
  const record = getRecord(value);

  if (record === null) {
    return false;
  }

  const blockGap = getRecord(record.blockGap);

  if (blockGap === null || !hasText(blockGap.summary)) {
    return false;
  }

  return Object.entries(record).some(
    ([key, childValue]) =>
      key !== "blockGap" &&
      Array.isArray(childValue) &&
      childValue.length === 0,
  );
}

function isSectionEvidenceGapReport(value: unknown): boolean {
  const record = getRecord(value);

  if (record === null) {
    return false;
  }

  const evidenceGapReport = getRecord(record.evidenceGapReport);

  return record.evidenceGap === true && evidenceGapReport !== null;
}

export function hasHonestEmptyCore(value: unknown): boolean {
  if (isGapSubstitutedEvidenceBlock(value) || isSectionEvidenceGapReport(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(hasHonestEmptyCore);
  }

  const record = getRecord(value);
  if (record === null) {
    return false;
  }

  return Object.values(record).some(hasHonestEmptyCore);
}

function isJsWalledContainmentUrl(sourceUrl: string): boolean {
  const registrableDomain = getRegistrableDomain(sourceUrl);

  if (
    registrableDomain !== null &&
    jsWalledContainmentDomains.has(registrableDomain)
  ) {
    return true;
  }

  try {
    const hostname = new URL(sourceUrl).hostname
      .toLowerCase()
      .replace(/^www\./, "");

    return forumHostPattern.test(hostname);
  } catch {
    return false;
  }
}

function deriveContainmentKnownRate(
  sourceLiveness: SourceLivenessResult,
): {
  containmentKnownRate: number;
  smallNContainmentUnknownCount: number;
} {
  if (sourceLiveness.containmentPassRate === null) {
    return {
      containmentKnownRate: 1,
      smallNContainmentUnknownCount: 0,
    };
  }

  const containmentChecks = sourceLiveness.checkedUrls.filter(
    (check) => check.containmentChecked,
  );

  if (
    containmentChecks.length === 0 ||
    containmentChecks.length >= smallNContainmentProbeFloor
  ) {
    return {
      containmentKnownRate: sourceLiveness.containmentPassRate,
      smallNContainmentUnknownCount: 0,
    };
  }

  const knownChecks = containmentChecks.filter(
    (check) =>
      check.containmentPassed || !isJsWalledContainmentUrl(check.sourceUrl),
  );
  const smallNContainmentUnknownCount =
    containmentChecks.length - knownChecks.length;

  return {
    containmentKnownRate:
      knownChecks.length === 0
        ? 1
        : knownChecks.filter((check) => check.containmentPassed).length /
          knownChecks.length,
    smallNContainmentUnknownCount,
  };
}

function deriveClaimSupportShare({
  body,
  briefMoneyDigits,
  report,
  sectionId,
  shortfall,
}: {
  body: Record<string, unknown>;
  briefMoneyDigits?: ReadonlySet<string>;
  report: VerificationReportEnvelope;
  sectionId: SectionId;
  shortfall?: EvidenceSupportShortfall;
}): number {
  const supportCounts = deriveClaimSupportCountsForTrust({
    body,
    ...(briefMoneyDigits === undefined ? {} : { briefMoneyDigits }),
    report,
    sectionId,
  });
  const provenancePenalty = shortfall?.provenanceFlags.length ?? 0;
  const total =
    supportCounts.verifiedCount +
    supportCounts.unsupportedCount +
    provenancePenalty;

  if (total === 0) {
    return 0;
  }

  return supportCounts.verifiedCount / total;
}

export function deriveWave2TrustConfidence({
  artifact,
  briefMoneyDigits,
  honestEmptyCore,
  quoteForceEmptied,
  sectionId,
  shortfall,
  sourceLiveness,
}: {
  artifact: ArtifactEnvelope;
  briefMoneyDigits?: ReadonlySet<string>;
  honestEmptyCore: boolean;
  quoteForceEmptied: boolean;
  sectionId: SectionId;
  shortfall?: EvidenceSupportShortfall;
  sourceLiveness: SourceLivenessResult;
}): {
  claimSupportShare: number;
  confidence: number;
  containmentKnownRate: number;
  quoteForceEmptied: boolean;
  honestEmptyCore: boolean;
  smallNContainmentUnknownCount: number;
} | null {
  if (artifact.verification === undefined) {
    return null;
  }

  const claimSupportShare = deriveClaimSupportShare({
    body: artifact.body,
    ...(briefMoneyDigits === undefined ? {} : { briefMoneyDigits }),
    report: artifact.verification,
    sectionId,
    shortfall,
  });
  const livenessKnownRate =
    sourceLiveness.livenessPassRate === null ? 1 : sourceLiveness.livenessPassRate;
  const {
    containmentKnownRate,
    smallNContainmentUnknownCount,
  } = deriveContainmentKnownRate(sourceLiveness);
  const rawConfidence = Math.min(
    livenessKnownRate,
    containmentKnownRate,
    claimSupportShare,
  );
  const quoteCapped = quoteForceEmptied
    ? Math.min(rawConfidence, 0.6)
    : rawConfidence;
  const confidence = honestEmptyCore ? Math.min(quoteCapped, 0.4) : quoteCapped;

  return {
    claimSupportShare,
    confidence,
    containmentKnownRate,
    honestEmptyCore,
    quoteForceEmptied,
    smallNContainmentUnknownCount,
  };
}

// R-E: the offer diagnostic laundered a FABRICATED customer-acquisition figure
// ("$4,200 CAC exceeds the $3,000 target by 40%") as "operator-reported / client
// brief" fact. Only the brief's stated economics ($3,000 target, $25K budget,
// $18K LTV) are real operator numbers — the $4,200 CAC and the 40% overshoot
// derived from it are invented. The verifier accepts the laundered figure and
// numeric-coherence can't catch it (the model planted 4200/40 across its own
// structured fields, so each reads as self-traceable). This deterministic gate
// relabels any CAC/LTV/CPA money figure that does NOT appear in the brief
// operator economics — only brief-sourced operator numbers may stand as figures;
// everything else is relabeled "operator-reported (actual figure not disclosed)"
// so the read stays honest without fabricating or hard-failing the section.

// A CAC / LTV / CPA / acquisition-cost economics cue scoped tightly enough that a
// sourced non-economics money figure ("$13B valuation", "70,000+ customers") is
// never touched — only customer-economics claims fall in scope.
const offerAcquisitionEconomicsCuePattern =
  /\b(cac|ltv|cpa|cpl|customer acquisition cost|acquisition cost|cost per acquisition|lifetime value)\b/iu;
// A money token: "$4,200", "$3,000", "$25K", "$13B", "$1K–$10K" each match once.
const offerMoneyTokenPattern = /\$\s?\d[\d,]*(?:\.\d+)?\s?[kmb]?/giu;
// A derived overshoot percent ("by 40%", "40% overshoot", "40% above target")
// computed FROM the fabricated CAC — when the figure goes, the derived margin
// goes with it (it is not an independently measured percent).
const offerDerivedOvershootPercentPattern =
  /\b\d{1,3}(?:\.\d+)?\s?%(?=[^%]*\b(overshoot|over target|above target|over the target)\b)|\b(?:by|of)\s\d{1,3}(?:\.\d+)?\s?%/giu;

const offerUnattributedMoneyRelabel = "operator-reported (actual figure not disclosed)";
const offerDerivedOvershootRelabel = "an undisclosed margin";

function tokenInBriefMoneyDigits(
  token: string,
  briefMoneyDigits: ReadonlySet<string>,
): boolean {
  return moneyDigitVariants(token).some((variant) =>
    briefMoneyDigits.has(variant),
  );
}

// Relabel fabricated CAC/LTV money figures (and the overshoot percent derived
// from them) in a single string; returns the cleaned string + whether anything
// was struck. A string is in scope only if it carries an acquisition-economics
// cue, so non-economics money ("$13B valuation") is left untouched.
function relabelUnattributedEconomicsString(
  value: string,
  briefMoneyDigits: ReadonlySet<string>,
): { value: string; struck: boolean } {
  if (!offerAcquisitionEconomicsCuePattern.test(value)) {
    return { value, struck: false };
  }

  let struck = false;
  const moneyRelabeled = value.replace(offerMoneyTokenPattern, (token) => {
    if (tokenInBriefMoneyDigits(token, briefMoneyDigits)) {
      return token;
    }
    struck = true;
    return offerUnattributedMoneyRelabel;
  });

  if (!struck) {
    // Every money figure traces to the brief — nothing fabricated to relabel,
    // so the derived-percent neutralization must not fire either.
    return { value, struck: false };
  }

  const overshootNeutralized = moneyRelabeled.replace(
    offerDerivedOvershootPercentPattern,
    offerDerivedOvershootRelabel,
  );

  return { value: overshootNeutralized, struck: true };
}

export interface StrippedOperatorEconomicsClaim {
  field: string;
  removedText: string;
}

// Walk every string leaf of the offer body and relabel fabricated operator
// economics. Mirrors the whole-body string walk the CTA-contradiction strip uses
// so the figure is scrubbed wherever it was asserted (prose AND structured
// magnitude/value cells). Brief-sourced operator numbers are preserved.
export function stripUnattributedOperatorEconomics({
  body,
  briefMoneyDigits,
}: {
  body: Record<string, unknown>;
  briefMoneyDigits: ReadonlySet<string>;
}): { body: Record<string, unknown>; stripped: StrippedOperatorEconomicsClaim[] } {
  const cloned = structuredClone(body);
  const stripped: StrippedOperatorEconomicsClaim[] = [];

  const visit = (holder: Record<string, unknown>): void => {
    for (const [key, child] of Object.entries(holder)) {
      if (typeof child === "string") {
        const relabeled = relabelUnattributedEconomicsString(
          child,
          briefMoneyDigits,
        );
        if (relabeled.struck) {
          holder[key] = relabeled.value;
          stripped.push({
            field: key,
            removedText: child,
          });
        }
      } else if (Array.isArray(child)) {
        for (const item of child) {
          const record = getRecord(item);
          if (record !== null) {
            visit(record);
          }
        }
      } else {
        const record = getRecord(child);
        if (record !== null) {
          visit(record);
        }
      }
    }
  };

  visit(cloned);

  return stripped.length === 0 ? { body, stripped } : { body: cloned, stripped };
}

async function annotateEvidenceSupportReview({
  artifact,
  fetchImpl,
  preverifiedSourceUrls,
  researchInput,
  sectionId,
  shortfall,
  signal,
  subjectSiteObservations,
}: {
  artifact: ArtifactEnvelope;
  fetchImpl?: SourceLivenessFetch;
  preverifiedSourceUrls?: ReadonlySet<string>;
  // Every call site passes researchInput: the clean commit path must never
  // run with a SMALLER numeric-coherence truth universe than the shortfall
  // path (run d838ed4e inverted severity by omitting it on clean commits).
  researchInput?: ResearchInput;
  sectionId: SectionId;
  shortfall?: EvidenceSupportShortfall;
  signal?: AbortSignal;
  subjectSiteObservations?: readonly SubjectSiteObservation[];
}): Promise<ArtifactEnvelope> {
  const provenanceFlags = shortfall?.provenanceFlags ?? [];
  // Sourced facts the claim verifier matched to a tool result or corpus
  // excerpt: threaded into the coherence truth so a source-verified figure is
  // never struck as incoherent.
  const verifiedClaimValues =
    artifact.verification === undefined
      ? []
      : artifact.verification.claims
          .filter((verdict) => verdict.status === "verified")
          .map((verdict) => verdict.claim.value);
  // url-claims the verifier graded unsupported (no_match): the model authored
  // a link no tool ever saw — quote/objection/story rows citing one get the
  // evidence-gap relabel below.
  const unsupportedUrlClaims = new Set(
    (artifact.verification?.claims ?? [])
      .filter(
        (verdict) =>
          verdict.status === "unsupported" && verdict.claim.kind === "url",
      )
      .map((verdict) => verdict.claim.value),
  );
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
  // Provenance gate (run 8081e646 cold-judge fixes): SKILL.md exemplar echoes
  // out of deployable copy, index-page "verbatim" quotes downgraded to
  // explicit paraphrased patterns, emails scrubbed from quote cards.
  const exemplarEcho = stripExemplarEchoes({
    body: exemplarDrop.body,
    sectionId,
  });
  const verbatimDowngrade =
    sectionId === "positioningCompetitorLandscape"
      ? downgradeUnpermalinkedVerbatimQuotes({ body: exemplarEcho.body })
      : sectionId === "positioningVoiceOfCustomer"
        ? downgradeUnpermalinkedVocQuotes({ body: exemplarEcho.body })
        : {
            body: exemplarEcho.body,
            stripped: [] as DowngradedVerbatimQuote[],
          };
  const emailScrub = scrubQuoteEmails({ body: verbatimDowngrade.body });
  // Placeholder-URL strike (run 314d5f02): fabricated placeholder sourceUrls
  // (example.com, short-digit LinkedIn groups, Reddit pseudo-permalinks,
  // sequential-digit ids) are relabeled to the evidence-gap marker URL so a
  // made-up link never ships as provenance; the row and its claim survive.
  // Hosts vouched for by the runner-owned ResearchInput (subject site, corpus
  // excerpts, source refs) exempt the example-host shape only.
  const placeholderUrlStrip = stripPlaceholderSourceUrls({
    body: emailScrub.body,
    trustedHosts: buildPlaceholderTrustedHosts(researchInput),
  });
  const sourceLiveness = await applySourceLivenessGate({
    body: placeholderUrlStrip.body,
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
    ...(preverifiedSourceUrls === undefined
      ? {}
      : { preverifiedUrls: preverifiedSourceUrls }),
    signal,
  });
  // Runs AFTER the liveness gate so the evidence-gap relabel URL is never
  // itself probed (and fetch-error-dropped) by the gate above.
  const unverifiedUrlStrip = stripUnverifiedSourceUrls({
    body: sourceLiveness.body,
    unsupportedUrls: unsupportedUrlClaims,
  });
  // Systemic containment strip (Wave-3 lever): stripUnverifiedSourceUrls is
  // narrowly gated on a quote-card field + tool-observed sibling, so fabricated
  // persona URLs, laundered/wrong-source competitor URLs and inline market-stat
  // URLs the verifier graded unsupported still slip through with false
  // provenance. This unconditionally relabels any unsupported, non-trusted-host
  // sourceUrl to a per-row UNIQUE evidence-gap marker — catching all three at
  // once while the unique marker host preserves the VoC distinct-source minimum.
  const containmentStrip = stripUncontainedSourceUrls({
    body: unverifiedUrlStrip.body,
    unsupportedUrls: unsupportedUrlClaims,
    trustedHosts: buildPlaceholderTrustedHosts(researchInput),
  });
  const placeholderUrlStrikes = [
    ...placeholderUrlStrip.stripped,
    ...unverifiedUrlStrip.stripped,
    ...containmentStrip.stripped,
  ];
  const quoteDedup = dedupeQuoteBearingFields({
    body: containmentStrip.body,
  });
  const subjectCta = stripContradictedSubjectCtaClaims({
    body: quoteDedup.body,
    observations:
      (sectionId === "positioningOfferDiagnostic" ||
        sectionId === "positioningDemandIntent" ||
        sectionId === "positioningPaidMediaPlan") &&
      researchInput !== undefined
        ? [
            ...collectSubjectSiteObservations({
              corpusExcerpts: researchInput.corpus.excerpts,
              subjectWebsiteUrl: researchInput.company.websiteUrl,
            }),
            ...(subjectSiteObservations ?? []),
          ]
        : [],
  });
  // R-E: relabel fabricated CAC/LTV operator economics the model laundered as
  // brief-sourced fact (offer only). Only money figures that actually appear in
  // the brief operator economics may stand; an invented CAC + its derived
  // overshoot percent are relabeled honestly so the read never asserts a number
  // the operator did not supply.
  const offerEconomics =
    sectionId === "positioningOfferDiagnostic"
      ? stripUnattributedOperatorEconomics({
          body: subjectCta.body,
          briefMoneyDigits: collectBriefMoneyDigits(
            researchInput?.onboarding?.economics,
          ),
        })
      : { body: subjectCta.body, stripped: [] as StrippedOperatorEconomicsClaim[] };
  // Coherence pack (run 8081e646 cold-judge fixes): pipeline vocabulary out of
  // client prose, then narrative numbers must trace to the section's own
  // structured evidence (values, column sums, lengths, group counts) or the
  // sentence goes. Runs before the verification-driven numeric redactor so the
  // table-contradiction class is caught even for claims the verifier graded.
  const jargonScrub = scrubBodyInternalJargon({
    body: offerEconomics.body,
    sectionId,
  });
  const numericCoherence = enforceNumericCoherence({
    ...(researchInput === undefined ? {} : { auxiliaryEvidence: researchInput }),
    body: jargonScrub.body,
    sectionId,
    verifiedClaimValues,
  });
  const namedEntityStrip =
    sectionId === "positioningPaidMediaPlan" &&
    artifact.verification !== undefined
      ? stripUngroundedNamedEntityMetrics({
          body: numericCoherence.body,
          verification: artifact.verification,
        })
      : {
          body: numericCoherence.body,
          stripped: [] as StrippedNamedEntityMetric[],
        };
  const numericStrip =
    artifact.verification === undefined
      ? { body: namedEntityStrip.body, stripped: [] as StrippedNumericClaim[] }
      : redactUnsupportedNumericClaims({
          body: namedEntityStrip.body,
          // Money figures may only claim "user-supplied" provenance when they
          // actually appear in the brief economics.
          briefMoneyDigits: collectBriefMoneyDigits(
            researchInput?.onboarding?.economics,
          ),
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
  // Hero copy (statusSummary/verdict) obeys the same contract as body prose:
  // no pipeline jargon, no figures the section's own evidence cannot back.
  const sectionTruth = buildSectionNumericTruth({
    ...(researchInput === undefined ? {} : { auxiliaryEvidence: researchInput }),
    body: numericStrip.body,
    sectionId,
    verifiedClaimValues,
  });
  const statusSummaryJargon = scrubInternalJargon({
    field: "statusSummary",
    value: statusSummaryStrip.value,
  });
  const statusSummaryCoherence = gateProseNumbers({
    field: "statusSummary",
    truth: sectionTruth,
    value: statusSummaryJargon.value,
  });
  const verdictJargon = scrubInternalJargon({
    field: "verdict",
    value: verdictStrip.value,
  });
  const verdictCoherence = gateProseNumbers({
    field: "verdict",
    truth: sectionTruth,
    value: verdictJargon.value,
  });
  const internalJargonStrikes: InternalJargonStrike[] = [
    ...jargonScrub.stripped,
    ...statusSummaryJargon.strikes,
    ...verdictJargon.strikes,
  ];
  const numericCoherenceStrikes: NumericCoherenceStrike[] = [
    ...numericCoherence.stripped,
    ...statusSummaryCoherence.strikes,
    ...verdictCoherence.strikes,
  ];
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
  const honestEmptyCore = hasHonestEmptyCore(numericStrip.body);
  const quoteForceEmptied =
    sectionId === "positioningVoiceOfCustomer" &&
    sourceLiveness.droppedRows.length > 0 &&
    honestEmptyCore;
  const trust = deriveWave2TrustConfidence({
    artifact,
    briefMoneyDigits: collectBriefMoneyDigits(
      researchInput?.onboarding?.economics,
    ),
    honestEmptyCore,
    quoteForceEmptied,
    sectionId,
    shortfall,
    sourceLiveness,
  });
  // Single writer for confidence: whenever trust was computed it IS the
  // envelope confidence — even with no shortfall object — so the top-level
  // confidence always equals verifierSummary.computedTrust.confidence.
  // (Previously the trust number was dropped on clean commits, leaving two
  // diverging confidences per artifact.)
  const trustShortfall =
    trust === null
      ? shortfall
      : {
          unsupportedLoadBearing: [],
          issues: [],
          provenanceFlags: [],
          ...(shortfall ?? {}),
          computedTrustConfidence: trust.confidence,
        };
  const confidence =
    trust === null
      ? artifact.confidence
      : deriveGroundedConfidence(
          artifact.verification as VerificationReportEnvelope,
          trustShortfall,
        );
  const confidenceChanged =
    artifact.verification !== undefined &&
    Math.abs(confidence - artifact.confidence) > 0.000001;

  if (
    provenanceFlags.length === 0 &&
    strip.stripped.length === 0 &&
    exemplarDrop.stripped.length === 0 &&
    exemplarEcho.stripped.length === 0 &&
    verbatimDowngrade.stripped.length === 0 &&
    emailScrub.stripped.length === 0 &&
    placeholderUrlStrikes.length === 0 &&
    sourceLiveness.droppedRows.length === 0 &&
    quoteDedup.dropped.length === 0 &&
    subjectCta.stripped.length === 0 &&
    offerEconomics.stripped.length === 0 &&
    internalJargonStrikes.length === 0 &&
    numericCoherenceStrikes.length === 0 &&
    namedEntityStrip.stripped.length === 0 &&
    strippedNumericClaims.length === 0 &&
    strippedVerificationMarkers.length === 0 &&
    !confidenceChanged
  ) {
    return artifact;
  }

  return artifactEnvelopeSchema.parse({
    ...artifact,
    body: numericStrip.body,
    statusSummary: statusSummaryCoherence.value,
    verdict: verdictCoherence.value,
    confidence,
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
      ...(exemplarEcho.stripped.length > 0
        ? { strippedExemplarEchoes: exemplarEcho.stripped }
        : {}),
      ...(verbatimDowngrade.stripped.length > 0
        ? { downgradedVerbatimQuotes: verbatimDowngrade.stripped }
        : {}),
      ...(emailScrub.stripped.length > 0
        ? { scrubbedQuoteEmails: emailScrub.stripped }
        : {}),
      ...(placeholderUrlStrikes.length > 0
        ? { strippedPlaceholderUrls: placeholderUrlStrikes }
        : {}),
      ...(sourceLiveness.droppedRows.length > 0 ||
      sourceLiveness.checkedUrls.length > 0
        ? {
            sourceLiveness: {
              checkedUrlCount: sourceLiveness.checkedUrls.length,
              containmentPassRate: sourceLiveness.containmentPassRate,
              droppedRows: sourceLiveness.droppedRows satisfies SourceLivenessDrop[],
              livenessPassRate: sourceLiveness.livenessPassRate,
              ...(sourceLiveness.livenessUnknownRows.length > 0
                ? {
                    livenessUnknownCount:
                      sourceLiveness.livenessUnknownRows.length,
                    livenessUnknownRows: sourceLiveness.livenessUnknownRows,
                  }
                : {}),
              ...(sourceLiveness.networkUnavailable
                ? { networkUnavailable: true }
                : {}),
            },
          }
        : {}),
      ...(quoteDedup.dropped.length > 0
        ? {
            droppedDuplicateQuoteFields:
              quoteDedup.dropped satisfies DroppedDuplicateQuoteField[],
          }
        : {}),
      ...(subjectCta.stripped.length > 0
        ? {
            strippedSubjectCtaClaims:
              subjectCta.stripped satisfies SubjectCtaClaimStrip[],
          }
        : {}),
      ...(offerEconomics.stripped.length > 0
        ? { strippedUnattributedOperatorEconomics: offerEconomics.stripped }
        : {}),
      ...(internalJargonStrikes.length > 0
        ? { internalJargonStrikes }
        : {}),
      ...(numericCoherenceStrikes.length > 0
        ? { numericCoherenceStrikes }
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
      ...(trust === null
        ? {}
        : {
            computedTrust: {
              claimSupportShare: trust.claimSupportShare,
              confidence: trust.confidence,
              containmentKnownRate: trust.containmentKnownRate,
              containmentPassRate: sourceLiveness.containmentPassRate,
              honestEmptyCore: trust.honestEmptyCore,
              livenessPassRate: sourceLiveness.livenessPassRate,
              ...(trust.smallNContainmentUnknownCount > 0
                ? {
                    smallNContainmentUnknownCount:
                      trust.smallNContainmentUnknownCount,
                  }
                : {}),
              ...(sourceLiveness.networkUnavailable
                ? { networkUnavailable: true }
                : {}),
              quoteForceEmptied: trust.quoteForceEmptied,
            },
          }),
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

// Finite repair trigger, decoupled from the hard-fail ceiling: with
// LAB_VERIFIER_MAX_UNSUPPORTED unset the gate defaults to Infinity, so a
// gate-coupled trigger never repaired anything — a section with 18/48
// unsupported load-bearing claims committed on attempt one with zero
// grounding repairs (run d838ed4e BuyerICP). Above this many unsupported
// load-bearing claims a grounding repair is worth one of the bounded
// answerToolMaxRepairAttempts; the hard-fail ceiling itself stays Infinity.
const repairUnsupportedLoadBearingThreshold = 6;

// Repair only when it can change the committed outcome: a genuine schema/parse
// failure (no committable artifact), an unsupported-load-bearing count above
// the finite repair threshold, OR a count that exceeds the evidence gate
// (getEvidenceGateFailureReason !== null).
//
// The trigger stays COUNT-based, never presence-based: it used to fire on the
// mere PRESENCE of any shortfall (evidenceSupportShortfall !== undefined) — so
// every section burned up to answerToolMaxRepairAttempts full agentic re-runs
// grounding claims it could still accept (the per-section repair storm).
function shouldRepairAttempt(
  attempt: AttemptResult,
  maxUnsupportedAllowed: number,
): boolean {
  return (
    attempt.artifact === null ||
    getUnsupportedLoadBearingCount(attempt) >
      repairUnsupportedLoadBearingThreshold ||
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

// 8192 truncated DemandIntent/MarketCategory bodies mid-JSON once keyFindings
// and gap shapes landed (live run d838ed4e: finishReason=length at exactly
// 8192 on every attempt -> parse fail -> repair loop -> budget death).
// DeepSeek v4-flash handles 20k+ (paid-media retry already uses 20480).
const defaultStructuredOutputMaxTokens = 16_384;
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
  const clientFacingGroups = normalizedAdEvidenceGroups.map(
    toClientFacingAdEvidenceGroup,
  );
  const adEvidenceRecord = getRecord(bodyRecord.adEvidence);
  // The model's free-text prose is unverified narration. When the deterministic
  // ad evidence has zero displayable creatives, prose that claims specific
  // competitor ad counts cannot be grounded (e.g. a poisoned "idk" advertiser
  // query that returned nothing) — fall back to the deterministic summary so the
  // prose and the (empty) advertiserGroups wall agree. (run 73dfbc0d, 2026-06-09.)
  const deterministicSummary = toClientFacingAdEvidenceProse(
    summarizeCompetitorAdEvidenceGroups(clientFacingGroups),
  );
  const modelProse = getStringProperty(adEvidenceRecord, "prose");
  const hasVerifiedAdEvidence = clientFacingGroups.some(
    hasVerifiedAdEvidenceGroup,
  );
  const prose =
    hasVerifiedAdEvidence && modelProse !== null
      ? reconcileAdEvidenceProseWithVerifiedCounts({
          prose: modelProse,
          groups: normalizedAdEvidenceGroups,
          deterministicSummary,
        })
      : deterministicSummary;

  // Never persist an empty advertiserGroups wall: hasAdEvidenceOrGap iterates
  // the groups, so [] fails the adEvidence_or_gap gate and hard-errors the whole
  // section (prod run 0eeebd93). Substitute one explicit gap group so the rich
  // competitor body commits with an honest "no ad evidence observed" wall.
  const advertiserGroups =
    clientFacingGroups.length === 0
      ? [
          toClientFacingAdEvidenceGroup(
            buildEmptyCompetitorAdEvidenceGapGroup(new Date().toISOString()),
          ),
        ]
      : clientFacingGroups;

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

const adGapNoVerifiedAdsReason =
  "Fewer verified ads than expected for this advertiser.";
const adGapNoRowsReason =
  "No ad-library rows were found for this advertiser on this platform.";
const adGapInsufficientCreativeReason =
  "The ad library returned rows, but none had enough creative content to review.";
const adGapReportBoundedReason =
  "Some ad examples were omitted to keep the report readable.";
const adGapLookupFailedReason =
  "This ad-library lookup could not be completed.";
const adGapLowConfidenceOffTopicReason =
  "Some low-confidence ad results were excluded because they did not appear related to the category.";
const adGapLinkedInNotCheckedReason = "LinkedIn ads were not checked in this run.";
const adGapRescueProbeReason =
  "Additional ad evidence was checked after competitors were identified in the draft.";
const adGapNoAdvertisersReason =
  "No competitor advertisers were identified for live ad checks.";

function withClientFacingAdGapReason(
  gap: AdEvidenceDataGap,
  reason: string,
): AdEvidenceDataGap {
  if (gap.reason === reason) {
    return gap;
  }

  return {
    ...gap,
    internalDetail: gap.internalDetail ?? gap.reason,
    reason,
  };
}

function withClientFacingAdSourceError(
  sourceError: AdEvidenceSourceError,
): AdEvidenceSourceError {
  if (sourceError.message === adGapLookupFailedReason) {
    return sourceError;
  }

  return {
    ...sourceError,
    internalDetail: sourceError.internalDetail ?? sourceError.message,
    message: adGapLookupFailedReason,
  };
}

function toClientFacingAdDataGap(gap: AdEvidenceDataGap): AdEvidenceDataGap {
  const reason = gap.reason;

  if (/Identity-unverified ad signals only/i.test(reason)) {
    return withClientFacingAdGapReason(gap, adGapNoVerifiedAdsReason);
  }

  if (/returned no raw ad-library rows/i.test(reason)) {
    return withClientFacingAdGapReason(gap, adGapNoRowsReason);
  }

  if (/no row had headline, body, image, or video evidence/i.test(reason)) {
    return withClientFacingAdGapReason(gap, adGapInsufficientCreativeReason);
  }

  if (/^Returned \d+ of \d+ displayable creatives/i.test(reason)) {
    return withClientFacingAdGapReason(gap, adGapReportBoundedReason);
  }

  if (/lookup failed:/i.test(reason)) {
    return withClientFacingAdGapReason(gap, adGapLookupFailedReason);
  }

  if (/low-confidence creatives?.*topic tokens/i.test(reason)) {
    return withClientFacingAdGapReason(gap, adGapLowConfidenceOffTopicReason);
  }

  if (/not-probed sentinel|not probed this run/i.test(reason)) {
    return withClientFacingAdGapReason(gap, adGapLinkedInNotCheckedReason);
  }

  if (reason === competitorAdRescueProbeNote) {
    return withClientFacingAdGapReason(gap, adGapRescueProbeReason);
  }

  if (
    /No competitor advertisers were identified.*ad-library wall/i.test(reason)
  ) {
    return withClientFacingAdGapReason(gap, adGapNoAdvertisersReason);
  }

  return gap;
}

function toClientFacingAdEvidenceGroup(
  group: CompetitorAdEvidenceGroup,
): CompetitorAdEvidenceGroup {
  return {
    ...group,
    dataGaps: group.dataGaps.map(toClientFacingAdDataGap),
    sourceErrors: group.sourceErrors.map(withClientFacingAdSourceError),
  };
}

function toClientFacingAdEvidenceProse(value: string): string {
  return value
    .replace(
      /No live ad-library tool results were normalized for this section\./g,
      "No live ad-library tool results were collected for this section.",
    )
    .replace(
      /Live ad-library evidence was normalized/g,
      "Live ad-library evidence was collected",
    )
    .replace(
      /Displayable creatives by platform/g,
      "Reviewable ad examples by platform",
    )
    .replace(/Returned creative count/g, "Returned ad example count")
    .replace(
      /Verified competitor ad creatives: 0\. Quarantine-tier ad signals: (\d+); these are identity-unverified and must be described as an evidence gap, not confirmed competitor advertising\./g,
      "Confirmed competitor ad examples: 0. Unverified ad samples requiring caution: $1.",
    )
    .replace(
      /Verified competitor ad creatives: (\d+)\. Identity-unverified quarantine samples: (\d+)\./g,
      "Confirmed competitor ad examples: $1. Unverified ad samples requiring caution: $2.",
    )
    .replace(
      /Evidence gaps are preserved in advertiserGroups\.dataGaps and advertiserGroups\.sourceErrors\./g,
      "Evidence gaps are preserved in the ad evidence notes.",
    )
    .replace(
      /No ad-library data gaps were reported by the normalized tool results\./g,
      "No ad-library data gaps were reported by the collected tool results.",
    );
}

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

// Kept in lockstep with vocSourceTypes in artifacts/schemas/voice-of-customer.ts.
const voiceOfCustomerQuoteSourceValues = new Set([
  "g2",
  "capterra",
  "trustpilot",
  "trustradius",
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
// Honest row drop: remove rows whose `sourceUrl` is not a real http(s) URL.
// Per-row sourceUrl floors (firmographicCuts, clusters.venues) have NO blockGap
// escape, so an unsourced row would HARD-ERROR the whole section; dropping it is
// honest (never fabricates a URL) and lets the count floor inject a blockGap.
function dropRowsWithoutHttpSourceUrl(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.filter((item) => {
    const sourceUrl = getStringProperty(getRecord(item), "sourceUrl");
    return sourceUrl !== null && isHttpUrl(sourceUrl);
  });
}

const inlineHttpUrlPattern = /https?:\/\/[^\s)>"'\]]+/;

// Ground-don't-drop: when a row's sourceUrl is missing/non-http but a real
// http(s) URL is already present in the row's own citation text (e.g. the model
// wrote the link into `source`/`whyItMatters` but left `sourceUrl` empty), lift
// that URL into sourceUrl so the grounded row survives the per-row floor instead
// of being dropped. The URL comes from the row itself — never invented. Rows with
// no URL anywhere are left untouched (dropRowsWithoutHttpSourceUrl still gaps them
// honestly).
function liftSourceUrlFromTextFields(
  value: unknown,
  textFields: readonly string[],
): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    const record = getRecord(item);
    if (record === null) {
      return item;
    }
    const existing = getStringProperty(record, "sourceUrl");
    if (existing !== null && isHttpUrl(existing)) {
      return item;
    }
    for (const field of textFields) {
      const text = getStringProperty(record, field);
      if (text === null) {
        continue;
      }
      const match = inlineHttpUrlPattern.exec(text);
      if (match === null) {
        continue;
      }
      const candidate = match[0].replace(/[.,;]+$/, "");
      if (isHttpUrl(candidate)) {
        return { ...record, sourceUrl: candidate };
      }
    }
    return item;
  });
}

function normalizeNameKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A persona's company is compatible with a candidate's when it is absent (can't
// disconfirm) or shares the company identity (equality / containment / a shared
// 3+ char token). Guards the name-keyed backfill against a same-name, different-
// company collision attaching the wrong page.
function caseStudyCompanyCompatible(
  personaCompany: string | null,
  candidateCompany: string,
): boolean {
  if (personaCompany === null || personaCompany.trim().length === 0) {
    return true;
  }
  const a = normalizeNameKey(personaCompany);
  const b = normalizeNameKey(candidateCompany);
  if (
    a.length === 0 ||
    b.length === 0 ||
    a === b ||
    a.includes(b) ||
    b.includes(a)
  ) {
    return true;
  }
  const aTokens = new Set(a.split(" ").filter((token) => token.length > 2));
  return b.split(" ").some((token) => token.length > 2 && aTokens.has(token));
}

// Deterministic source-URL backfill for personas the writer authored from the
// case-study champion LEADS. The miner extracts each champion's name+employer
// FROM a specific case-study page, so that page is guaranteed to contain them on
// the source-liveness re-fetch (Gate C). DeepSeek frequently cites a different,
// JS-rendered, non-containing URL (live: containmentPassRate 0.077 on Ramp), which
// Gate C then strips, emptying the persona block. When a persona's name matches a
// mined candidate and the company is compatible, pin sourceUrl to the candidate's
// page. This NEVER invents a URL — it only relocates the citation to the page the
// lead was actually scraped from. Runs BEFORE the non-http drop so it can also
// rescue a persona the writer left without any sourceUrl.
// Persona-laundering gate (B.1): the writer sometimes files MANY distinct
// "named" reviewers under ONE shared aggregate review-listing URL (e.g. seven
// personas all citing g2.com/products/<x>/reviews — the run d2abf018 failure).
// An aggregate listing page lists hundreds of reviewers; it cannot individually
// ground a specific named person, so >=2 personas sharing one NON-permalink URL
// are laundered, not grounded — suppress them deterministically. Exempt: a
// per-review permalink (isReviewPermalinkUrl, unique-by-construction) and a
// case-study champion whose name was actually mined from that exact page (two
// co-champions legitimately share their customer-story page). The thinned set
// then hits the >=3 floor, which injects an honest gap downstream.
function suppressSharedListingUrlPersonas(
  personaRealityRecord: Record<string, unknown>,
  caseStudyCandidates: readonly BuyerPersonaCandidate[],
): Record<string, unknown> {
  if (!Array.isArray(personaRealityRecord.personas)) {
    return personaRealityRecord;
  }

  // (name-key :: url) pairs the case-study miner actually scraped the name from.
  const groundedCaseStudyPairs = new Set<string>();
  for (const candidate of caseStudyCandidates) {
    if (
      candidate.venue !== "case_study_champions" ||
      !isHttpUrl(candidate.url)
    ) {
      continue;
    }
    const key = normalizeNameKey(candidate.name);
    if (key.length > 0) {
      groundedCaseStudyPairs.add(`${key}::${candidate.url}`);
    }
  }

  const personaCountByUrl = new Map<string, number>();
  for (const persona of personaRealityRecord.personas) {
    const url = getStringProperty(getRecord(persona) ?? {}, "sourceUrl");
    if (url !== null) {
      personaCountByUrl.set(url, (personaCountByUrl.get(url) ?? 0) + 1);
    }
  }

  return {
    ...personaRealityRecord,
    personas: personaRealityRecord.personas.filter((persona) => {
      const personaRecord = getRecord(persona);
      if (personaRecord === null) {
        return true;
      }
      const url = getStringProperty(personaRecord, "sourceUrl");
      // Unsourced rows are handled by the vendor-sourced drop, not here.
      if (url === null) {
        return true;
      }
      const sharedListing =
        (personaCountByUrl.get(url) ?? 0) >= 2 && !isReviewPermalinkUrl(url);
      if (!sharedListing) {
        return true;
      }
      const name = getStringProperty(personaRecord, "name");
      const nameKey = name === null ? "" : normalizeNameKey(name);
      return (
        nameKey.length > 0 &&
        groundedCaseStudyPairs.has(`${nameKey}::${url}`)
      );
    }),
  };
}

// Add the named champions the prepass mined but the writer OMITTED. The normal
// commit path only relocated sourceUrls for personas the model authored by name
// (withCaseStudyPersonaSourceUrlBackfill) — it never added a champion the model
// dropped. Run jsl0fh: the prepass mined Bill Cox / Lauren Feeney / Alicia
// Coleman, the model authored an ungrounded persona instead, so all three were
// dropped → <3 → empty section. Promote the mined leads through the SAME gate
// the deadline path uses (promoteDeadlineBuyerICPPersonas already filters by
// isValidGroundedBuyerUnit + isHttpUrl + venue + shared-listing laundering),
// keep only those the model did not already author (name-key dedup), and append
// them so they count toward the >=3 floor. Never fabricates — only mined leads.
function withMinedCaseStudyChampionBackfill(
  personaRealityRecord: Record<string, unknown>,
  caseStudyCandidates: readonly BuyerPersonaCandidate[],
): Record<string, unknown> {
  if (
    caseStudyCandidates.length === 0 ||
    !Array.isArray(personaRealityRecord.personas)
  ) {
    return personaRealityRecord;
  }

  const existingNameKeys = new Set<string>();
  for (const persona of personaRealityRecord.personas) {
    const name = getStringProperty(getRecord(persona) ?? {}, "name");
    if (name !== null) {
      const key = normalizeNameKey(name);
      if (key.length > 0) {
        existingNameKeys.add(key);
      }
    }
  }

  const minedToAppend = promoteDeadlineBuyerICPPersonas(caseStudyCandidates).filter(
    (persona) => {
      const name = getStringProperty(persona, "name");
      const key = name === null ? "" : normalizeNameKey(name);
      return key.length > 0 && !existingNameKeys.has(key);
    },
  );

  if (minedToAppend.length === 0) {
    return personaRealityRecord;
  }

  return {
    ...personaRealityRecord,
    personas: [...personaRealityRecord.personas, ...minedToAppend],
  };
}

function withCaseStudyPersonaSourceUrlBackfill(
  personaRealityRecord: Record<string, unknown>,
  caseStudyCandidates: readonly BuyerPersonaCandidate[],
): Record<string, unknown> {
  if (
    caseStudyCandidates.length === 0 ||
    !Array.isArray(personaRealityRecord.personas)
  ) {
    return personaRealityRecord;
  }

  const candidateByName = new Map<string, BuyerPersonaCandidate>();
  for (const candidate of caseStudyCandidates) {
    // Only case-study-mined leads carry a URL that was actually scraped to find
    // the name (so it re-fetches with the name present). Perplexity-venue leads
    // carry answer-parsed URLs with no such guarantee — never pin to those.
    if (candidate.venue !== "case_study_champions") {
      continue;
    }
    const key = normalizeNameKey(candidate.name);
    if (key.length > 0 && isHttpUrl(candidate.url) && !candidateByName.has(key)) {
      candidateByName.set(key, candidate);
    }
  }
  if (candidateByName.size === 0) {
    return personaRealityRecord;
  }

  return {
    ...personaRealityRecord,
    personas: personaRealityRecord.personas.map((persona) => {
      const personaRecord = getRecord(persona);
      if (personaRecord === null) {
        return persona;
      }
      const name = getStringProperty(personaRecord, "name");
      if (name === null) {
        return persona;
      }
      const candidate = candidateByName.get(normalizeNameKey(name));
      if (
        candidate === undefined ||
        !caseStudyCompanyCompatible(
          getStringProperty(personaRecord, "company"),
          candidate.company,
        )
      ) {
        return persona;
      }
      if (getStringProperty(personaRecord, "sourceUrl") === candidate.url) {
        return persona;
      }
      return { ...personaRecord, sourceUrl: candidate.url };
    }),
  };
}

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

      // Tolerant-out (R1): a persona whose sourceUrl is not a real http(s) URL
      // cannot pass the per-row sourceUrl floor (which has NO blockGap escape)
      // and would HARD-ERROR the section. Drop the unsourced row honestly — the
      // thinned array then hits the >=3 count floor, which DOES inject a
      // blockGap downstream (repairBuyerICPEscapableFloors). Never fabricate.
      if (sourceUrl === null || !/^https?:\/\//i.test(sourceUrl)) {
        return [];
      }

      return [
        {
          ...personaRecord,
          vendorSourced: deriveVendorSourced({
            sourceUrl,
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

    // Option B: a valid grounded buyer unit is a live-sourced ROLE/SEGMENT or a
    // named human (names optional). source-liveness has already strict-contained
    // the segmentLabel/name on the live page upstream, so here we only check the
    // unit shape (live URL + grounded claim).
    return isValidGroundedBuyerUnit(personaRecord);
  }).length;
}

type BuyerICPFloorRepairResult = { output: unknown; changed: boolean };

const BUYER_ICP_BLOCK_GAP_TARGETS: ReadonlyArray<{
  pattern: RegExp;
  key: string;
  rowsKey: string;
  required: number;
  label: string;
}> = [
  {
    pattern: /^body\.icpExistenceCheck\.firmographicCuts:/,
    key: "icpExistenceCheck",
    rowsKey: "firmographicCuts",
    required: 3,
    label: "firmographic cuts",
  },
  {
    pattern: /^body\.buyingContext\.triggers:/,
    key: "buyingContext",
    rowsKey: "triggers",
    required: 3,
    label: "buying triggers",
  },
  {
    pattern: /^body\.clusters\.venues:/,
    key: "clusters",
    rowsKey: "venues",
    required: 1,
    label: "buyer venues",
  },
  {
    pattern: /^body\.awarenessDistribution: include at least/,
    key: "awarenessDistribution",
    rowsKey: "levels",
    required: 1,
    label: "awareness levels",
  },
  {
    pattern: /^body\.personaReality\.personas: have/,
    key: "personaReality",
    rowsKey: "personas",
    required: 3,
    label: "named buyer personas",
  },
];

function setNestedStringField(
  record: Record<string, unknown>,
  fieldPath: string,
  value: string,
): { record: Record<string, unknown>; changed: boolean } {
  const [head, ...rest] = fieldPath.split(".");

  if (rest.length === 0) {
    if (typeof record[head] !== "string") {
      return { record, changed: false };
    }
    return { record: { ...record, [head]: value }, changed: true };
  }

  const child = getRecord(record[head]);
  if (child === null) {
    return { record, changed: false };
  }

  const updatedChild = setNestedStringField(child, rest.join("."), value);
  if (!updatedChild.changed) {
    return { record, changed: false };
  }
  return { record: { ...record, [head]: updatedChild.record }, changed: true };
}

// Tolerant-out (R1) backstop for the buyer-ICP floors the persona-gap injection
// does NOT cover. Each floor below publishes an HONEST escape the model simply
// failed to emit:
//   - an awarenessDistribution share with no provenance basis -> the exact
//     "[model estimate - not tool-measured]" label (the share IS a model
//     estimate; labeling it is honest and preserves the distribution),
//   - strategicInsight text that reads as a restatement / carries unsupported
//     numeric precision -> the literal "evidence gap: <signal>",
//   - a count floor with a blockGap escape (firmographicCuts, buyingContext
//     triggers, clusters venues, an empty awarenessDistribution) -> an honest
//     blockGap.
// Repairs are keyed off the cited error paths from the REAL validator so the
// normalizer can never drift from it (the failure mode that let the persona fix
// ship incomplete). Per-row floors with no honest auto-repair (a non-named
// persona, an invalid sourceUrl, a duplicate key) are left for the validator to
// reject — we never fabricate a name, URL, or number to pass a gate.
function applyBuyerICPHonestFloorRepairs(
  output: unknown,
  errors: readonly string[],
): BuyerICPFloorRepairResult {
  const outputRecord = getRecord(output);
  if (outputRecord === null) {
    return { output, changed: false };
  }
  const bodyRecord = getRecord(outputRecord.body);
  if (bodyRecord === null) {
    return { output, changed: false };
  }

  const body: Record<string, unknown> = { ...bodyRecord };
  let changed = false;

  for (const error of errors) {
    const shareMatch =
      /^body\.awarenessDistribution\.levels\[(\d+)\]\.share:/.exec(error);
    if (shareMatch !== null) {
      const index = Number(shareMatch[1]);
      const awareness = getRecord(body.awarenessDistribution);
      if (awareness !== null && Array.isArray(awareness.levels)) {
        const levels = [...awareness.levels];
        const level = getRecord(levels[index]);
        if (
          level !== null &&
          typeof level.share === "string" &&
          !level.share.includes(modelEstimateLabel)
        ) {
          levels[index] = {
            ...level,
            share: `${level.share.trim()} ${modelEstimateLabel}`.trim(),
          };
          body.awarenessDistribution = { ...awareness, levels };
          changed = true;
        }
      }
      continue;
    }

    const strategicMatch =
      /^body\.strategicInsight\.([A-Za-z.]+): (?:must be a specific|duplicates|repeats the evidence gap)/.exec(
        error,
      );
    if (strategicMatch !== null) {
      const fieldPath = strategicMatch[1];
      const insight = getRecord(body.strategicInsight);
      if (insight !== null) {
        const updated = setNestedStringField(
          { ...insight },
          fieldPath,
          `evidence gap: fetched evidence did not support a distinct ${fieldPath} judgment`,
        );
        if (updated.changed) {
          body.strategicInsight = updated.record;
          changed = true;
        }
      }
      continue;
    }

    const blockGapTarget = BUYER_ICP_BLOCK_GAP_TARGETS.find((target) =>
      target.pattern.test(error),
    );
    if (blockGapTarget !== undefined) {
      const block = getRecord(body[blockGapTarget.key]);
      if (block !== null && getRecord(block.blockGap) === null) {
        const rows = block[blockGapTarget.rowsKey];
        const foundCount = Array.isArray(rows) ? rows.length : 0;
        body[blockGapTarget.key] = {
          ...block,
          blockGap: {
            summary: `Fewer than the required ${blockGapTarget.label} could be grounded in fetched evidence; treat this block as directional.`,
            foundCount,
            requiredCount: blockGapTarget.required,
            sourcingPlan: [
              `Re-run acquisition for ${blockGapTarget.label} with verified, source-bearing evidence.`,
            ],
          },
        };
        changed = true;
      }
      continue;
    }
  }

  if (!changed) {
    return { output, changed: false };
  }
  return { output: { ...outputRecord, body }, changed: true };
}

const BUYER_ICP_FLOOR_REPAIR_PLACEHOLDER_ISO = "2020-01-01T00:00:00.000Z";

// Drive honest floor repairs off the real validator until the section either
// passes its minimums or no further honest repair is possible — guaranteeing a
// thin buyer-ICP commits DEGRADED instead of hard-erroring the run + blocking
// the downstream paid-media dispatch.
//
// The normalizer runs on the section OUTPUT (pre-envelope), but the validator
// parses a full artifact envelope. We wrap the body in a synthetic envelope so
// the repair is driven off the REAL validator (no drift). Only body + verdict +
// statusSummary affect the floor checks (verdict/statusSummary are the strategic
// near-duplicate comparison texts); the rest are structural placeholders the
// floors never read.
function repairBuyerICPEscapableFloors(output: unknown): unknown {
  const outputRecord = getRecord(output);
  if (outputRecord === null) {
    return output;
  }

  let candidateBody = getRecord(outputRecord.body);
  if (candidateBody === null) {
    return output;
  }

  const verdict =
    typeof outputRecord.verdict === "string" && outputRecord.verdict.length > 0
      ? outputRecord.verdict
      : "Buyer ICP verdict";
  const statusSummary =
    typeof outputRecord.statusSummary === "string" &&
    outputRecord.statusSummary.length > 0
      ? outputRecord.statusSummary
      : "Buyer ICP status";
  const sectionTitle =
    typeof outputRecord.sectionTitle === "string" &&
    outputRecord.sectionTitle.length > 0
      ? outputRecord.sectionTitle
      : "Buyer ICP";
  const confidence =
    typeof outputRecord.confidence === "number" ? outputRecord.confidence : 0;

  for (let pass = 0; pass < 6; pass += 1) {
    const syntheticEnvelope = {
      id: "buyer-icp-floor-repair",
      runId: "buyer-icp-floor-repair",
      sectionId: "positioningBuyerICP",
      sectionTitle,
      verdict,
      statusSummary,
      confidence,
      sources: [
        {
          id: "buyer-icp-floor-repair",
          title: "Floor-repair placeholder",
          url: "https://example.com",
          observedAt: BUYER_ICP_FLOOR_REPAIR_PLACEHOLDER_ISO,
        },
      ],
      body: candidateBody,
      createdAt: BUYER_ICP_FLOOR_REPAIR_PLACEHOLDER_ISO,
    };

    let result: { ok: boolean; errors: string[] };
    try {
      result = validateBuyerICPMinimums(
        syntheticEnvelope as Parameters<typeof validateBuyerICPMinimums>[0],
      );
    } catch {
      // Body does not parse against the schema -> not a minimums repair; let the
      // normal persistence path surface the precise zod issue.
      return { ...outputRecord, body: candidateBody };
    }

    if (result.ok) {
      return { ...outputRecord, body: candidateBody };
    }

    const repaired = applyBuyerICPHonestFloorRepairs(
      { ...outputRecord, body: candidateBody },
      result.errors,
    );
    if (!repaired.changed) {
      return { ...outputRecord, body: candidateBody };
    }

    const repairedRecord = getRecord(repaired.output);
    const repairedBody =
      repairedRecord === null ? null : getRecord(repairedRecord.body);
    if (repairedBody === null) {
      return repaired.output;
    }
    candidateBody = repairedBody;
  }

  return { ...outputRecord, body: candidateBody };
}

// Persistence-time guard: a downstream step (a source-liveness row drop, the
// narrative writer pass) can push a BuyerICP count floor below threshold AFTER
// the body builder's floor repair already ran, leaving no blockGap and hard-
// failing persistence (e.g. triggers 3 -> 2 with no gap). Re-drive the SAME
// honest blockGap repair off the real validator at the commit chokepoint so a
// thinned block commits DEGRADED instead of erroring the whole run. Idempotent:
// a body that already clears its floors is returned unchanged. Never fabricates.
export function withBuyerICPCommitFloorRepair(
  artifact: ArtifactEnvelope,
): ArtifactEnvelope {
  return repairBuyerICPEscapableFloors(artifact) as ArtifactEnvelope;
}

export function withNormalizedBuyerICPOutput(
  rawOutput: unknown,
  {
    subjectCompanyName,
    subjectWebsiteUrl,
    caseStudyCandidates = [],
  }: {
    subjectCompanyName?: string;
    subjectWebsiteUrl?: string;
    caseStudyCandidates?: readonly BuyerPersonaCandidate[];
  } = {},
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
  const clustersRecord = getRecord(bodyRecord.clusters);
  const personaRealityRecord = getRecord(bodyRecord.personaReality);
  const normalizedPersonaReality =
    personaRealityRecord === null
      ? null
      : withDerivedVendorSourcedPersonas({
          personaRealityRecord: suppressSharedListingUrlPersonas(
            withCaseStudyPersonaSourceUrlBackfill(
              withMinedCaseStudyChampionBackfill(
                withoutEvidenceGapKeys(personaRealityRecord),
                caseStudyCandidates,
              ),
              caseStudyCandidates,
            ),
            caseStudyCandidates,
          ),
          subjectCompanyName,
          subjectWebsiteUrl,
        });
  const validatorGradePersonaCount =
    normalizedPersonaReality === null
      ? 0
      : countValidatorGradePersonas(normalizedPersonaReality);
  const stripUnnecessaryGap =
    normalizedPersonaReality !== null &&
    bodyRecord.evidenceGap === true &&
    validatorGradePersonaCount >= 3;
  // Tolerant-out (R1): when the model under-produces grounded named personas
  // (containment dropped an unverifiable name, or DeepSeek emitted a thin
  // skeleton) and did NOT self-declare the gap, inject the canonical honest
  // persona evidence-gap instead of letting the >=3 floor HARD-ERROR the whole
  // section. A hard error blocks the run rollup AND the downstream client-side
  // paid-media dispatch (which gates on six committed positioning sections);
  // an honest degraded commit ships the buyer picture as directional.
  const personaRealityHasBlockGap =
    normalizedPersonaReality !== null &&
    getRecord(normalizedPersonaReality.blockGap) !== null;
  const alreadyDeclaresPersonaGap =
    bodyRecord.evidenceGap === true &&
    getRecord(bodyRecord.evidenceGapReport)?.reason === buyerICPEvidenceGapReason;
  const injectPersonaGap =
    normalizedPersonaReality !== null &&
    !stripUnnecessaryGap &&
    validatorGradePersonaCount < 3 &&
    !personaRealityHasBlockGap &&
    !alreadyDeclaresPersonaGap;
  const {
    evidenceGap: _strippedEvidenceGap,
    evidenceGapReport: _strippedEvidenceGapReport,
    ...bodyWithoutGap
  } = bodyRecord;

  const normalizedBuyerICPOutput = {
    ...outputRecord,
    body: {
      ...(stripUnnecessaryGap ? bodyWithoutGap : bodyRecord),
      ...(injectPersonaGap
        ? {
            evidenceGap: true,
            evidenceGapReport: {
              reason: buyerICPEvidenceGapReason,
              summary: `Only ${validatorGradePersonaCount} named buyer persona${
                validatorGradePersonaCount === 1 ? "" : "s"
              } could be grounded in fetched evidence with a live source URL — below the 3-persona floor. Treat the buyer picture as directional until more named reviewers or case-study buyers are sourced.`,
              foundNamedPersonaCount: validatorGradePersonaCount,
              requiredNamedPersonaCount: 3,
              rejectedPersonaLabels: [],
              sourcingPlan: [
                "Mine named reviewers and case-study buyers from G2, Capterra, TrustRadius, and vendor case-study pages for this subject, capturing each name with a live source URL.",
              ],
            },
          }
        : {}),
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
              // Tolerant-out (R1): drop firmographic cuts whose sourceUrl is not
              // a real http(s) URL — that per-row floor has NO blockGap escape
              // and would hard-error the section. The thinned array hits the >=3
              // count floor, which DOES inject a blockGap downstream. Honest row
              // removal, never fabrication.
              firmographicCuts: dedupeRecordArrayByStringKey({
                key: "cutType",
                value: dropRowsWithoutHttpSourceUrl(
                  liftSourceUrlFromTextFields(
                    icpExistenceCheckRecord.firmographicCuts,
                    ["source"],
                  ),
                ),
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
      ...(clustersRecord === null
        ? {}
        : {
            clusters: {
              ...clustersRecord,
              // Same honest drop for cluster venues (per-row sourceUrl floor has
              // no blockGap escape); the >=1 venue count floor then injects a
              // blockGap downstream. Lift an in-row URL from whyItMatters first so
              // a grounded venue the model misfiled is kept, not gapped.
              venues: dropRowsWithoutHttpSourceUrl(
                liftSourceUrlFromTextFields(clustersRecord.venues, [
                  "whyItMatters",
                ]),
              ),
            },
          }),
    },
  };

  return repairBuyerICPEscapableFloors(normalizedBuyerICPOutput);
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

function withNormalizedCompetitorLandscapeOutput(rawOutput: unknown): unknown {
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
    body: normalizeCompetitorLandscapeBody(bodyRecord),
  };
}

// VoC laundering signal for the paid-media plan: read the COMMITTED sibling
// Voice-of-Customer artifact (paid-media runs last, so it is already in the run
// record) and report a gap when VoC declared body.evidenceGap === true OR it
// produced zero usable quotes (painLanguage + successLanguage both empty). This
// mirrors the buyer-eval VOC-LAUNDERING check (vocUsableQuoteRecords === 0); a
// true result re-stamps VoC-sourced paid-media insights to 'unattributed'.
async function readSiblingVoiceOfCustomerEvidenceGap(
  deps: RunSectionDeps,
  runId: string,
): Promise<boolean> {
  let record: RunRecord;
  try {
    record = await deps.store.readRun(runId);
  } catch {
    return false;
  }
  const sections = getRecord(record.sections) ?? {};
  const vocSection = getRecord(sections.positioningVoiceOfCustomer) ?? {};
  const vocBody = getRecord(getRecord(vocSection.artifact)?.body) ?? {};
  if (vocBody.evidenceGap === true) {
    return true;
  }
  const painQuotes = (getRecord(vocBody.painLanguage) ?? {}).quotes;
  const successQuotes = (getRecord(vocBody.successLanguage) ?? {}).quotes;
  const painCount = Array.isArray(painQuotes) ? painQuotes.length : 0;
  const successCount = Array.isArray(successQuotes) ? successQuotes.length : 0;
  return painCount === 0 && successCount === 0;
}

function withNormalizedPaidMediaPlanOutput(
  rawOutput: unknown,
  onboarding?: ResearchInput["onboarding"],
  fallbackSources?: ResearchInput["sources"],
  voiceOfCustomerEvidenceGap?: boolean,
): unknown {
  const outputRecord = getRecord(rawOutput);

  if (outputRecord === null) {
    return rawOutput;
  }

  const bodyRecord = getRecord(outputRecord.body);

  if (bodyRecord === null) {
    return rawOutput;
  }

  const normalizedSources = normalizeStructuredRecordArray({
    allowedKeys: ["title", "url", "publisher"],
    stringKeys: ["title", "url", "publisher"],
    value: outputRecord.sources,
  });

  // The paid-media plan does zero fresh research — its sources ARE the
  // research inputs it synthesized from. A model that emits an empty source
  // list must not kill the section on the envelope floor (run f3993043);
  // backfill from the research input instead.
  const backfilledSources =
    Array.isArray(normalizedSources) && normalizedSources.length > 0
      ? normalizedSources
      : (fallbackSources ?? []).slice(0, 12).map((source) => ({
          title: source.title,
          url: source.url,
          ...(source.publisher === undefined
            ? {}
            : { publisher: source.publisher }),
        }));

  return {
    ...outputRecord,
    sources: backfilledSources,
    // Brief-derived context for the single-writer paid-media math: the
    // target CAC bridges SOP projected-results rows whose KPI cost is
    // honestly unknown, and creativeCapacity keys the computed creative
    // counts. Both are code-owned — the model's values never survive.
    body: normalizePaidMediaPlanBody(bodyRecord, {
      ...(onboarding?.creativeCapacity === undefined
        ? {}
        : { creativeCapacity: onboarding.creativeCapacity }),
      ...(onboarding?.economics?.targetCac === undefined
        ? {}
        : { targetCac: onboarding.economics.targetCac }),
      ...(onboarding?.economics?.targetTrialsPerMonth === undefined
        ? {}
        : { targetTrialsPerMonth: onboarding.economics.targetTrialsPerMonth }),
      // Funnel conversion rates drive the FORWARD demand projection (spend ->
      // clicks -> conversions); the count is never back-solved from target CAC.
      ...(onboarding?.economics === undefined
        ? {}
        : {
            cvrChain: {
              visitorToSignup: parsePaidMediaPercentToFraction(
                onboarding.economics.visitorToSignup,
              ),
              signupToActivation: parsePaidMediaPercentToFraction(
                onboarding.economics.signupToActivation,
              ),
              activationToPaid: parsePaidMediaPercentToFraction(
                onboarding.economics.activationToPaid,
              ),
            },
          }),
      ...(onboarding?.distributionChannels === undefined
        ? {}
        : { channelHint: onboarding.distributionChannels.join(" ") }),
      // VoC laundering guard: when the sibling VoC section produced no usable
      // customer-voice truth, re-stamp any VoC-sourced competitor insight to
      // 'unattributed' so the plan never cites a VoC that disowned its own
      // buyer-language proof (run 3b568ea0 VOC-LAUNDERING).
      ...(voiceOfCustomerEvidenceGap === true
        ? { voiceOfCustomerEvidenceGap: true }
        : {}),
    }),
  };
}

function withNormalizedSectionOutput({
  buyerPersonaCandidates,
  normalizedAdEvidenceGroups,
  onboarding,
  rawOutput,
  researchInputSources,
  sectionId,
  subjectCompanyName,
  subjectWebsiteUrl,
  voiceOfCustomerEvidenceGap,
}: {
  rawOutput: unknown;
  buyerPersonaCandidates?: readonly BuyerPersonaCandidate[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  onboarding?: ResearchInput["onboarding"];
  researchInputSources?: ResearchInput["sources"];
  sectionId: SectionId;
  subjectCompanyName?: string;
  subjectWebsiteUrl?: string;
  voiceOfCustomerEvidenceGap?: boolean;
}): unknown {
  const outputWithAdEvidence = withNormalizedCompetitorAdEvidence({
    normalizedAdEvidenceGroups,
    rawOutput,
  });

  if (sectionId === "positioningBuyerICP") {
    return withNormalizedBuyerICPOutput(outputWithAdEvidence, {
      subjectCompanyName,
      subjectWebsiteUrl,
      caseStudyCandidates: buyerPersonaCandidates,
    });
  }

  if (sectionId === "positioningMarketCategory") {
    return withNormalizedMarketCategoryOutput(outputWithAdEvidence);
  }

  if (sectionId === "positioningCompetitorLandscape") {
    return withNormalizedCompetitorLandscapeOutput(outputWithAdEvidence);
  }

  if (sectionId === "positioningVoiceOfCustomer") {
    return withNormalizedVoiceOfCustomerOutput(outputWithAdEvidence);
  }

  if (sectionId === "positioningPaidMediaPlan") {
    return withNormalizedPaidMediaPlanOutput(
      outputWithAdEvidence,
      onboarding,
      researchInputSources,
      voiceOfCustomerEvidenceGap,
    );
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

  // The SUBJECT's own live ads are first-class evidence (the minute-one media
  // buyer question: "what is the subject running right now?"). Inserted first
  // so the subject always wins the advertiser-limit slice, with its domain
  // pinned from the brief URL — identity is domain-corroborated by
  // construction, never resolver-dependent.
  const subjectName = researchInput.company.name.trim();
  const subjectDomain = getRegistrableDomain(researchInput.company.websiteUrl);

  if (subjectName.length > 0) {
    advertisers.set(subjectName.toLowerCase(), {
      advertiser: subjectName,
      ...(subjectDomain === null ? {} : { domain: subjectDomain }),
    });
  }

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
    const rawOutputMetadata = takeDecodeRepairsMetadata(rawOutput);
    const voiceOfCustomerEvidenceGap =
      input.sectionId === "positioningPaidMediaPlan"
        ? await readSiblingVoiceOfCustomerEvidenceGap(deps, input.runId)
        : false;
    const decodedOutput = decodeModelBoundary({
      input,
      rawValue: withNormalizedSectionOutput({
        rawOutput: rawOutputMetadata.value,
        normalizedAdEvidenceGroups,
        onboarding: researchInput.onboarding,
        researchInputSources: researchInput.sources,
        sectionId: input.sectionId,
        subjectCompanyName: researchInput.company.name,
        subjectWebsiteUrl: researchInput.company.websiteUrl,
        voiceOfCustomerEvidenceGap,
      }),
      schema: definition.sectionOutputSchema,
      schemaName: definition.sectionOutputSchemaName,
      upstreamRepairs: rawOutputMetadata.snaps,
    });
    const output = decodedOutput.value;
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
      decodeRepairs: decodedOutput.decodeRepairs,
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

      if (input.sectionId === "positioningDemandIntent") {
        // Subject-domain independence for intent signals — same gate as the
        // answer-tool path: vendor self-sourced "demand" rows reject with
        // errors that drive the repair toward an honest blockGap.
        const intentIndependence = checkDemandIntentIntentSignalIndependence({
          artifact: candidateArtifact,
          subjectDomain: researchInput.company.websiteUrl,
        });

        if (!intentIndependence.ok) {
          return { kind: "reject", errors: intentIndependence.errors };
        }

        // keyword_volume is in demand-intent's allowedTools AND a deterministic
        // prepass already measured it, so the top-ranked move must NOT be the
        // engine's own unfinished measurement job ("measure keyword volume").
        // Reject so repair re-ranks a real strategic move first.
        const topMove = (
          candidateArtifact.body as { orderedMoves?: { move: string }[] }
        ).orderedMoves?.[0]?.move;
        if (topMove !== undefined && isUnfilledKeywordMeasurementMove(topMove)) {
          return {
            kind: "reject",
            errors: [
              "body.orderedMoves[0].move: the top strategic move is the engine's own unfinished measurement (\"measure keyword volume\") — keyword_volume was available and already measured in the prepass. Replace it with a real strategic move that ACTS on the measured demand, and demote any remaining measurement step.",
            ],
          };
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
        marketCategoryEvidenceGapArtifact:
          buildMarketCategoryEvidenceGapArtifact({
            artifact,
            definition,
            errors: [...verdict.errors],
            input,
            researchInput,
          }),
        demandIntentEvidenceGapArtifact:
          buildDemandIntentEvidenceGapArtifact({
            artifact,
            definition,
            deps,
            input,
            researchInput,
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
        demandIntentEvidenceGapArtifact:
          buildDemandIntentEvidenceGapArtifact({
            artifact,
            definition,
            deps,
            input,
            researchInput,
          }),
      };
    }

    if (verdict.kind === "hookReject") {
      return {
        output,
        artifact: null,
        errors: [...verdict.errors],
        demandIntentEvidenceGapArtifact:
          buildDemandIntentEvidenceGapArtifact({
            artifact,
            definition,
            deps,
            input,
            researchInput,
          }),
        ...(input.sectionId === "positioningVoiceOfCustomer" &&
        verdict.gapArtifact !== undefined
          ? { voiceOfCustomerEvidenceGapArtifact: verdict.gapArtifact }
          : {}),
      };
    }

    if (verdict.kind === "evidenceShortfall") {
      return {
        output,
        artifact: await annotateEvidenceSupportReview({
          artifact: verdict.committableArtifact,
          fetchImpl: deps.fetchImpl,
          preverifiedSourceUrls: collectPreverifiedSourceUrlsFromSteps({
            steps: modelSteps,
          }),
          researchInput,
          sectionId: input.sectionId,
          shortfall: verdict.shortfall,
          signal: timeoutSignal.signal,
          subjectSiteObservations: collectSubjectSiteObservationsFromSteps({
            steps: modelSteps,
            subjectWebsiteUrl: researchInput.company.websiteUrl,
          }),
        }),
        errors: [],
        evidenceSupportShortfall: verdict.shortfall,
      };
    }

    return {
      output,
      artifact: await annotateEvidenceSupportReview({
        artifact: verdict.committableArtifact,
        fetchImpl: deps.fetchImpl,
        preverifiedSourceUrls: collectPreverifiedSourceUrlsFromSteps({
          steps: modelSteps,
        }),
        researchInput,
        sectionId: input.sectionId,
        shortfall: verdict.shortfall,
        signal: timeoutSignal.signal,
        subjectSiteObservations: collectSubjectSiteObservationsFromSteps({
          steps: modelSteps,
          subjectWebsiteUrl: researchInput.company.websiteUrl,
        }),
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
  if (
    input.sectionId !== "positioningCompetitorLandscape" ||
    shouldUsePreparedContext(deps)
  ) {
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
  const normalizedAdEvidenceGroups = markSubjectAdvertiserGroups({
    groups: buildCompetitorAdEvidenceGroups({
      steps: adProbeSteps,
      observedAt: getNow(deps).toISOString(),
      topicContext: buildCompetitorAdTopicContext(researchInput),
    }),
    subjectDomain: getRegistrableDomain(researchInput.company.websiteUrl),
    subjectName: researchInput.company.name,
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
// zero competitor seeds, the deterministic ad prepass probed no COMPETITOR —
// but the section agent typically DISCOVERS real competitors while drafting
// (runs f06333b6 + 0eeebd93 shipped a gap-only wall despite a populated
// competitorSet). Rescue = run those discovered advertisers through the same
// deterministic probe once, post-loop, and hand the steps/groups back to the
// caller's EXISTING merge path. Fires only in the starved-seed case. The
// subject is now always seeded into the prepass (its own ads are first-class
// evidence), so "starved" means the prepass probed nobody EXCEPT the subject —
// a subject-only prepass must still rescue discovered competitors. With brief
// seeds present this returns undefined and behavior is byte-identical to
// before.
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
  if (
    input.sectionId !== "positioningCompetitorLandscape" ||
    shouldUsePreparedContext(deps)
  ) {
    return undefined;
  }

  // Only the starved-seed case: never a second probe when the first probe ran
  // against a real competitor, even if it found 0 ads (those gaps are already
  // honest evidence). A prepass that probed only the SUBJECT does not count —
  // the wall would still carry zero competitor evidence without the rescue.
  const normalizedSubjectName = researchInput.company.name.trim().toLowerCase();
  const advertiserOfToolCall = (callInput: unknown): string | undefined => {
    if (
      typeof callInput === "object" &&
      callInput !== null &&
      typeof (callInput as { advertiser?: unknown }).advertiser === "string"
    ) {
      return (callInput as { advertiser: string }).advertiser;
    }

    return undefined;
  };
  const prepassProbedCompetitor = prepassAdProbeSteps.some((step) =>
    step.toolCalls.some((toolCall) => {
      const advertiser = advertiserOfToolCall(toolCall.input);

      return (
        advertiser !== undefined &&
        advertiser.trim().toLowerCase() !== normalizedSubjectName
      );
    }),
  );

  if (prepassProbedCompetitor) {
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
  // FIX-VOC directional lane: usableCandidates plus clean trusted-host quotes
  // whose only gap is the missing per-review permalink. The evidence-gap paths
  // surface this pool so a second independent domain reaches the gap body
  // (relabeled directional), instead of collapsing to a single permalinked
  // domain. The commit path still uses the strict pool.
  directionalCandidates: VoiceOfCustomerCandidate[];
  events: ActivityEvent[];
  result: VoiceOfCustomerCandidateResult;
  steps: AgentStep[];
  subjectDomain: string | null;
  usableCandidates: VoiceOfCustomerCandidate[];
}

interface VoiceOfCustomerToolCallResult {
  output: unknown;
  step: AgentStep;
}

interface SubjectSiteObservationPrepass {
  candidateBlock: string;
  events: ActivityEvent[];
  observations: SubjectSiteObservation[];
  steps: AgentStep[];
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
    // Synthetic corpus-topic-summary excerpts are model PARAPHRASES (the corpus
    // `quote` field invites them), not verbatim customer language. Surfacing
    // them here would launder a topic summary that merely reconciles to a
    // review/forum domain into a first-person VoC pain quote. Skip them — only
    // real captured source excerpts may become VoC candidates.
    if (
      excerpt.title.startsWith("Corpus topic:") ||
      excerpt.id?.endsWith("_summary")
    ) {
      return [];
    }

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

// Reject reviews-tool text that is not genuine first-person customer voice:
// affiliate/advertising disclosures, generic aggregator article intros, and
// third-person "reviewers report ..." paraphrases. Promoting these as pain
// quotes would surface boilerplate as verified customer voice (live-proven on
// findstack.com aggregator pages, run 3b568ea0: an "Advertising disclosure"
// line and two generic "workflow management is critical" article intros were
// promoted as Airtable customer pain).
const vocAdvertisingDisclosurePattern =
  /\b(advertising disclosure|affiliate links?|may earn a commission|editorially independent|sponsored content)\b/i;
const vocReviewerParaphrasePattern =
  /\b(reviewers?|users?|customers?)\s+(?:also\s+|often\s+|frequently\s+|generally\s+|commonly\s+|sometimes\s+|may\s+|will\s+|tend to\s+|that\s+)?(report|reports|reported|say|says|mention|mentions|describe|describes|note|notes|complain|complains|interpret|cite|claim)\b/i;
const vocAccordingToReviewsPattern =
  /\baccording to (?:the\s+)?(reviews?|reviewers?|users?|customers?|trustpilot|g2|capterra)\b/i;
const vocFirstPersonVoicePattern =
  /\b(i|i'?ve|i'?m|i'?d|me|we|we'?ve|we'?re|my|our|us|mine|ours)\b/i;
const vocCustomerExperiencePattern =
  // Additions stay review-specific: benefit PHRASES ("works great/well",
  // "saves time") and negative sentiment ("useless", "poor", "rude"). Bare
  // positive adjectives (great/reliable/useful/helpful/excellent/amazing) were
  // deliberately NOT added — they pollute generic category/product intro prose
  // ("a reliable project management system is critical for modern teams"),
  // which would let aggregator boilerplate survive as customer voice.
  /(pain|frustrat|disappoint|love|hate|terrible|awful|horrible|slow|buggy|\bbugs?\b|crash|broke|broken|confus|difficult|hard to|can'?t|cannot|won'?t|wouldn'?t|doesn'?t|didn'?t|isn'?t|\bissues?\b|\bproblems?\b|complain|limit|lack|missing|expensive|overpriced|pricey|steep|learning curve|clunky|annoying|spam|ignore|unhelpful|missed|scattered|disappear|forced|stuck|waste|refund|cancel|glitch|workaround|handoff|works? (?:great|well)|saves? time|useless|poor|rude)/i;

export function looksLikeNonReviewBoilerplate(snippet: string): boolean {
  const text = snippet.trim();
  if (text.length === 0) {
    return true;
  }
  if (vocAdvertisingDisclosurePattern.test(text)) {
    return true;
  }
  // A paraphrase signal ("reviewers report…", "according to reviews…") only
  // marks boilerplate when the text ALSO lacks any first-person voice and any
  // concrete experience/sentiment signal. Gating both-absent keeps genuine
  // (if paraphrased) reviews like "I agree with what other users say about the
  // slow support" — first-person + experience present — from being dropped.
  if (
    (vocReviewerParaphrasePattern.test(text) ||
      vocAccordingToReviewsPattern.test(text)) &&
    !vocFirstPersonVoicePattern.test(text) &&
    !vocCustomerExperiencePattern.test(text)
  ) {
    return true;
  }
  // Generic aggregator/article intro: a real review carries either a
  // first-person voice or a concrete experience/sentiment signal; text with
  // neither is almost always boilerplate intro copy, not customer voice.
  return (
    !vocFirstPersonVoicePattern.test(text) &&
    !vocCustomerExperiencePattern.test(text)
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
      // Drop boilerplate / non-customer-voice scraped text entirely. Surfacing
      // it would present junk as verified customer voice, and a recovery
      // re-fetch would only return the same boilerplate from the same URL.
      if (
        hasReviewText &&
        reviewText !== null &&
        looksLikeNonReviewBoilerplate(reviewText)
      ) {
        return emptyVoiceOfCustomerCandidateCollection();
      }
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

function buildSubjectSiteObservationTargets(websiteUrl: string): string[] {
  const rootUrl = getValidHttpUrl(websiteUrl);

  if (rootUrl === null) {
    return [];
  }

  try {
    const parsed = new URL(rootUrl);
    const root = parsed.origin;
    const pricing = new URL("/pricing", root).toString();

    return Array.from(new Set([root, pricing]));
  } catch {
    return [];
  }
}

function subjectSiteObservationFromFirecrawlOutput({
  fallbackUrl,
  output,
}: {
  fallbackUrl: string;
  output: unknown;
}): SubjectSiteObservation | null {
  const record = getRecord(output);

  if (record === null || getStringProperty(record, "type") !== "result") {
    return null;
  }

  const markdown = getStringProperty(record, "markdown");
  if (markdown === null) {
    return null;
  }

  const sourceUrl =
    getValidHttpUrl(getStringProperty(record, "sourceUrl")) ??
    getValidHttpUrl(getStringProperty(record, "url")) ??
    fallbackUrl;
  const observation = extractSubjectSiteObservation({
    sourceUrl,
    text: markdown,
  });

  return observation.ctas.length === 0 ? null : observation;
}

function formatSubjectSiteObservationBlock(
  observations: readonly SubjectSiteObservation[],
): string {
  if (observations.length === 0) {
    return "";
  }

  const rows = observations.map((observation) => {
    const ctas = observation.ctas.length === 0
      ? "none observed"
      : observation.ctas.join("; ");

    return `- ${observation.sourceUrl}: observed CTAs: ${ctas}`;
  });

  return [
    "Subject-site CTA observation prepass:",
    ...rows,
    "Use these fetched subject-page observations for demo/trial/signup/self-serve claims. If they contradict a no-self-serve/no-trial claim, state an evidence gap instead of the contradicted claim.",
  ].join("\n");
}

async function buildSubjectSiteObservationPrepass({
  deps,
  input,
  researchInput,
  researchTools,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
}): Promise<SubjectSiteObservationPrepass | undefined> {
  const targets = buildSubjectSiteObservationTargets(
    researchInput.company.websiteUrl,
  );
  const firecrawlTool = getPrepassExecutableTool(researchTools, "firecrawl");

  if (firecrawlTool === null || firecrawlTool.execute === undefined) {
    return undefined;
  }

  const steps: AgentStep[] = [];
  const observations: SubjectSiteObservation[] = [];

  for (const target of targets) {
    let output: unknown;
    try {
      output = await firecrawlTool.execute(
        { onlyMainContent: true, url: target },
        { abortSignal: input.signal } as ToolExecutionOptions,
      );
    } catch {
      continue;
    }

    const step: AgentStep = {
      stepNumber: steps.length + 1,
      finishReason: "tool-calls",
      text: "Subject-site CTA observation prepass used firecrawl.",
      toolCalls: [
        { toolName: "firecrawl", input: { onlyMainContent: true, url: target } },
      ],
      toolResults: [
        {
          toolName: "firecrawl",
          input: { onlyMainContent: true, url: target },
          output,
          type: "tool-result",
        },
      ],
    };
    const observation = subjectSiteObservationFromFirecrawlOutput({
      fallbackUrl: target,
      output,
    });

    steps.push(step);
    if (observation !== null) {
      observations.push(observation);
    }
  }

  if (steps.length === 0) {
    return undefined;
  }

  return {
    candidateBlock: formatSubjectSiteObservationBlock(observations),
    events: steps.flatMap((step) =>
      buildToolEvents({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        step,
      }),
    ),
    observations,
    steps,
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

function getAdmissibleVoiceOfCustomerCandidates({
  candidates,
  subjectDomain,
}: {
  candidates: readonly VoiceOfCustomerCandidate[];
  subjectDomain: string | null;
}): VoiceOfCustomerCandidate[] {
  const seen = new Set<string>();
  const admissible: VoiceOfCustomerCandidate[] = [];

  for (const candidate of candidates) {
    if (
      !isAdmissibleQuote({
        sourceUrl: candidate.url,
        subjectDomain,
        text: candidate.snippet,
      })
    ) {
      continue;
    }

    const dedupeKey = candidate.sourceInstanceId ?? candidate.url;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    admissible.push(candidate);
  }

  return admissible;
}

// FIX-VOC directional lane: the tolerant counterpart to
// getAdmissibleVoiceOfCustomerCandidates. It keeps every strictly-admissible
// candidate AND keeps clean independent-domain quotes on trusted review/forum
// hosts whose ONLY failure is the missing per-review permalink (Trustpilot /
// TrustRadius / Reddit LISTING urls). The strict pool drops those before any
// surfacing, collapsing the section to a single G2 domain + empty blocks; this
// pool keeps them so a second independent domain reaches the gap body, where
// downgradeUnpermalinkedVocQuotes relabels them as directional (never verbatim).
// Chrome / truncation / not-human-voice / subject-domain rejections stay fatal.
export function getDirectionalVoiceOfCustomerCandidates({
  candidates,
  subjectDomain,
}: {
  candidates: readonly VoiceOfCustomerCandidate[];
  subjectDomain: string | null;
}): VoiceOfCustomerCandidate[] {
  const seen = new Set<string>();
  const directional: VoiceOfCustomerCandidate[] = [];

  for (const candidate of candidates) {
    if (
      !isDirectionalAdmissibleQuote({
        sourceUrl: candidate.url,
        subjectDomain,
        text: candidate.snippet,
      })
    ) {
      continue;
    }

    const dedupeKey = candidate.sourceInstanceId ?? candidate.url;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    directional.push(candidate);
  }

  return directional;
}

function selectAdmissibleVoiceOfCustomerCandidates({
  candidates,
  subjectDomain,
}: {
  candidates: readonly VoiceOfCustomerCandidate[];
  subjectDomain: string | null;
}): VoiceOfCustomerCandidateResult {
  return selectVoiceOfCustomerCandidates(
    getAdmissibleVoiceOfCustomerCandidates({ candidates, subjectDomain }),
  );
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
  let result = selectAdmissibleVoiceOfCustomerCandidates({
    candidates,
    subjectDomain,
  });
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
    result = selectAdmissibleVoiceOfCustomerCandidates({
      candidates,
      subjectDomain,
    });

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

  result = selectAdmissibleVoiceOfCustomerCandidates({
    candidates,
    subjectDomain,
  });
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
      result = selectAdmissibleVoiceOfCustomerCandidates({
        candidates,
        subjectDomain,
      });
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
      result = selectAdmissibleVoiceOfCustomerCandidates({
        candidates,
        subjectDomain,
      });
    }
  }

  const usableCandidates = getAdmissibleVoiceOfCustomerCandidates({
    candidates,
    subjectDomain,
  });
  const directionalCandidates = getDirectionalVoiceOfCustomerCandidates({
    candidates,
    subjectDomain,
  });
  const promotedCandidates = result.ok
    ? result.pack.candidates
    : selectVoiceOfCustomerPainCandidates(usableCandidates);
  const acquisitionLedger = buildVoiceOfCustomerAcquisitionLedger({
    attempts: acquisitionAttemptsWithQuery,
    candidates,
    observedAt: getNow(deps).toISOString(),
    promotedCandidates,
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
    directionalCandidates,
    events,
    result,
    steps,
    subjectDomain,
    usableCandidates,
  };
}

interface BuyerPersonaCandidatePrepass {
  candidateBlock: string;
  candidates: BuyerPersonaCandidate[];
  caseStudyPages: Array<{ url: string; markdown: string }>;
  lookups: BuyerPersonaLookup[];
  events: ActivityEvent[];
  steps: AgentStep[];
}

// Branded demand prepass (demand-intent only): ONE deterministic SpyFu
// keyword_volume call over the subject's branded head terms before the agent
// runs, so the section always carries the branded demand floor a media buyer
// checks first (run 8081e646 cold judge: "no branded keyword volumes").
// Best-effort: a tool gap becomes an honest gap instruction, never a section
// failure. The recorded step rides the model-steps list, so the keyword
// provenance validator accepts the rows and claim verification can match them.
const brandedKeywordPrepassDeadlineMs = 20_000;

// One bounded re-attempt after a short delay: a single transient SpyFu failure
// at t0 must not freeze a "returned no data" gap block into every subsequent
// prompt for the rest of the run (SpyFu-resilience lane).
export const brandedKeywordPrepassRetryDelayMs = 8_000;

// keyword_discovery (SpyFu kombat gap-keyword) deadline + volume floor for the
// non-branded measured rows. The branded keyword_volume call only measures the
// brand defending itself + a handful of stable category descriptors; discovery
// surfaces the keywords COMPETITORS rank/bid on that the subject does not — the
// real non-branded demand a media buyer sizes feasibility against. Best-effort:
// no seed domains, a tool gap, or a 429 keeps the honest-gap fallback.
const keywordDiscoveryPrepassDeadlineMs = 20_000;
const keywordDiscoveryPrepassMinSearchVolume = 50;
const keywordDiscoveryPrepassMaxRows = 12;

interface BrandedKeywordPrepass {
  candidateBlock: string;
  events: ActivityEvent[];
  steps: readonly AgentStep[];
}

type BrandedKeywordMeasuredRow = Extract<
  z.infer<typeof KeywordVolumeOutputSchema>,
  { type: "result" }
>["keywords"][number];

export function buildBrandedKeywordTerms(companyName: string): string[] {
  const brand = companyName.trim().toLowerCase();

  if (brand.length === 0) {
    return [];
  }

  return [
    brand,
    `${brand} pricing`,
    `${brand} alternatives`,
    `${brand} reviews`,
  ];
}

// Non-branded / problem-aware demand seeds derived from a STABLE corpus field
// (company.category) — NOT from model-generated orderedMoves text, which would
// be circular. Branded terms only measure the brand defending itself; category
// terms measure whether the market is searching for the problem at all, which
// is the demand read a media buyer checks before committing budget. Returned
// terms are deterministic, deduped, lowercased, and exclude any term that
// collapses into a branded head term already measured by buildBrandedKeywordTerms.
// Over-generic umbrella heads that are not useful commercial keywords on their
// own — a SpyFu lookup on "financial technology" or "software" returns noise,
// not the category demand a media buyer sizes against. Dropped when a parsed
// head EQUALS one of these (single over-generic token). Multi-word heads that
// merely CONTAIN one of these are kept ("spend management" survives).
const categoryDemandOverGenericHeads = new Set<string>([
  "financial technology",
  "fintech",
  "technology",
  "software",
  "platform",
  "saas",
  "solution",
  "solutions",
  "tool",
  "tools",
  "service",
  "services",
  "company",
  "app",
  "apps",
  "system",
  "systems",
  "industry",
  "sector",
]);

// Parse a prose category descriptor into clean, searchable commercial head
// phrases. The descriptor often wraps the searchable heads in parentheses and
// joins multiple heads with "&"/","/"and"/"/" (e.g. Ramp's "Financial
// technology (corporate cards & spend management)"). Splitting on those
// separators — across BOTH the parenthetical and outside text — yields the
// commercial heads a SpyFu lookup can actually measure, instead of the
// unsearchable whole-string wrap. Over-generic umbrella heads are dropped.
function parseCategoryDemandHeads(category: string): string[] {
  const normalizedCategory = category.trim().toLowerCase();
  if (normalizedCategory.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const heads: string[] = [];
  // Split on parentheses first (so the inside and outside become separate
  // segments), then on the head separators within each segment.
  for (const segment of normalizedCategory.split(/[()]/u)) {
    for (const rawHead of segment.split(/&|,|;|\/|\sand\s/u)) {
      const head = rawHead.trim().replace(/\s+/gu, " ");
      if (
        head.length === 0 ||
        seen.has(head) ||
        categoryDemandOverGenericHeads.has(head)
      ) {
        continue;
      }
      seen.add(head);
      heads.push(head);
    }
  }

  return heads;
}

// The token set across all clean category heads — used by the demand-discovery
// relevance filter to keep keyword rows that share a category token. Exported
// so the filter predicate can be driven from a single source of head tokens.
export function categoryDemandHeadTokens(category: string): ReadonlySet<string> {
  const tokens = new Set<string>();
  for (const head of parseCategoryDemandHeads(category)) {
    for (const token of head.split(/\s+/u)) {
      if (token.length > 0) {
        tokens.add(token);
      }
    }
  }
  return tokens;
}

export function buildCategoryDemandKeywordTerms(
  category: string,
  companyName: string,
): string[] {
  const heads = parseCategoryDemandHeads(category);
  if (heads.length === 0) {
    return [];
  }

  const brand = companyName.trim().toLowerCase();
  const brandedTerms = new Set(buildBrandedKeywordTerms(companyName));
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const head of heads) {
    for (const term of [head, `${head} software`, `${head} alternatives`]) {
      const trimmed = term.trim();
      if (
        trimmed.length === 0 ||
        seen.has(trimmed) ||
        brandedTerms.has(trimmed) ||
        // A category head that is literally the brand name adds no non-branded
        // signal — drop it so the seed stays a real demand probe.
        (brand.length > 0 && trimmed === brand)
      ) {
        continue;
      }
      seen.add(trimmed);
      terms.push(trimmed);
    }
  }

  // Bound the keyword_volume call: a noisy multi-head category descriptor must
  // not blow the seed list out (~3 variants per head). Cap total at 8 terms.
  return terms.slice(0, 8);
}

// Commercial-intent modifier pattern: a keyword carrying one of these tokens is
// a real buyer-intent search a media buyer measures demand against, regardless
// of which category head it shares. Conservative + generalizable — no
// per-subject dictionary. The filter keeps a row when it matches this pattern
// OR shares a token with the cleaned category heads; everything else (the
// educational / definitional / government junk SpyFu kombat surfaces) is dropped.
const commercialDemandModifierPattern =
  /\b(software|pricing|alternative|alternatives|vs|versus|best|top|tool|tools|platform|automation|management|solution|competitor|competitors|review|reviews|demo|trial|for (startups|business|teams|enterprise))\b/iu;

// Keep a discovered demand keyword only if it shares a token with the category
// heads OR carries a commercial-intent modifier. Drops educational /
// definitional / government junk ("opportunity cost", "california secretary of
// state", "mission statement examples"). Relevance, NOT volume — a low-volume
// commercial row is still kept.
export function isCommercialDemandKeyword(
  keyword: string,
  categoryHeadTokens: ReadonlySet<string>,
): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  if (commercialDemandModifierPattern.test(normalized)) {
    return true;
  }
  for (const token of normalized.split(/\s+/u)) {
    if (token.length > 0 && categoryHeadTokens.has(token)) {
      return true;
    }
  }
  return false;
}

// The demand-intent agent is handed a deterministic keyword_volume prepass and
// keyword_volume in allowedTools — so an orderedMoves[0] that just says "go
// measure keyword volume" is the engine handing the user its own unfinished
// job. Detect that self-instruction so the verifier can treat it as an
// unfilled-core gap instead of shipping the measurement as advice.
export function isUnfilledKeywordMeasurementMove(move: string): boolean {
  const text = move.trim().toLowerCase();
  if (text.length === 0) {
    return false;
  }
  const mentionsMeasurement =
    /\b(measure|pull|gather|collect|run|fetch|get|obtain|capture|quantify|determine|find|check|assess|validate|verify|estimate|size)\b/u.test(
      text,
    );
  const mentionsKeywordVolume =
    /\bkeyword\b/u.test(text) &&
    /\b(volume|search volume|demand|cpc|traffic|searches?)\b/u.test(text);
  return mentionsMeasurement && mentionsKeywordVolume;
}

// R-A: the Market & Category branch of the keyword_volume prepass. The same
// measured commercial rows that feed demand-intent's keyword table source a
// sourced bottom-up TAM read here: every row becomes a search-trend
// marketSize.signal, and the rows source the bottomUpTam keyword-volume +
// commercial-intent-share inputs. conversion-rate stays an HONEST evidence gap
// (the section schema then keeps reachableRevenueEstimate "directional only" —
// the correct cap), and acv is operator-reported from the brief when present.
// No fabricated TAM number — the win is real sourced demand, not invented revenue.
function buildMarketTamCandidateBlock({
  categoryTerms,
  dateObserved,
  operatorAcv,
  rows,
}: {
  categoryTerms: readonly string[];
  dateObserved: string;
  operatorAcv: string | undefined;
  rows: readonly BrandedKeywordMeasuredRow[];
}): string {
  const renderRow = (row: BrandedKeywordMeasuredRow): string =>
    `- ${row.display} | sourceUrl "${spyfuKeywordUrl(row.keyword)}"`;
  const hasOperatorAcv =
    operatorAcv !== undefined && operatorAcv.trim().length > 0;

  if (rows.length === 0) {
    return [
      "MARKET DEMAND PREPASS (deterministic SpyFu monthly search volume — already ran):",
      `SpyFu returned no monthly search volume for the category demand terms${categoryTerms.length === 0 ? " (no category descriptor available)" : ` (${categoryTerms.join(", ")})`}.`,
      "Leave marketSize.signals empty and set every bottomUpTam input status:'evidence-gap'; never estimate a TAM. The schema keeps reachableRevenueEstimate 'directional only — not computed', which is correct.",
    ].join("\n");
  }

  return [
    "MARKET DEMAND PREPASS (deterministic SpyFu monthly search volume — already ran; do NOT re-fetch these terms):",
    "The measured commercial keyword rows below are real SpyFu monthly volume/CPC. Source the market-size read from them — do NOT write a keywordDemand keyword table (that is the demand section's job).",
    "1) Copy EVERY row into marketSize.signals as a signal with signalType 'search-trend', methodology 'bottom-up', sourceTitle 'SpyFu monthly search volume', the row's OWN per-keyword sourceUrl shown below, and dateObserved " +
      `"${dateObserved}".`,
    "2) Populate bottomUpTam.inputs (recipe 'keyword-demand-reachable-revenue'):",
    "   - inputType 'keyword-volume': status 'sourced', value = the summed measured monthly volume across the rows, sourceUrl = a measured row's permalink.",
    "   - inputType 'commercial-intent-share': status 'sourced', value = the commercial-intent volume as a share of total measured volume (commercial vs. total split), sourceTitle 'SpyFu monthly search volume'.",
    hasOperatorAcv
      ? `   - inputType 'acv': status 'sourced', value "${operatorAcv} (operator-reported)"; this is the brief-supplied ACV — never invent one.`
      : "   - inputType 'acv': status 'evidence-gap' (no operator ACV supplied in the brief; never invent one).",
    "   - inputType 'conversion-rate': status 'evidence-gap' (no sourced category conversion rate; this is an honest evidence gap, not an estimate).",
    "Because conversion-rate stays an evidence gap, the schema keeps reachableRevenueEstimate 'directional only — not computed'. That honest cap is correct — do NOT fabricate a TAM revenue figure.",
    "MEASURED COMMERCIAL KEYWORD ROWS:",
    ...rows.map(renderRow),
  ].join("\n");
}

export async function buildBrandedKeywordPrepass({
  deps,
  input,
  researchInput,
  researchTools,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
}): Promise<BrandedKeywordPrepass | undefined> {
  const brandedTerms = buildBrandedKeywordTerms(researchInput.company.name);

  if (brandedTerms.length === 0) {
    return undefined;
  }

  // Seed problem-aware / category terms alongside the branded head terms so the
  // single keyword_volume call also measures non-branded demand + CPC. Seeds
  // come from the stable corpus category descriptor, never from orderedMoves.
  const categoryTerms = buildCategoryDemandKeywordTerms(
    researchInput.company.category,
    researchInput.company.name,
  );
  const brandedTermSet = new Set(brandedTerms);
  const terms = [...brandedTerms, ...categoryTerms];

  const attemptCall = async (
    stepNumber: number,
  ): Promise<VoiceOfCustomerToolCallResult | null> => {
    const prepassSignal = createTimeoutSignal({
      parentSignal: input.signal,
      reasonLabel: "Branded keyword prepass",
      timeoutMs: brandedKeywordPrepassDeadlineMs,
    });
    try {
      return await executeVoiceOfCustomerPrepassTool({
        input: { ...input, signal: prepassSignal.signal },
        researchTools,
        stepNumber,
        toolInput: { keywords: terms },
        toolName: "keyword_volume",
      });
    } finally {
      prepassSignal.cleanup();
    }
  };

  const measuredRows = (
    call: VoiceOfCustomerToolCallResult | null,
  ): BrandedKeywordMeasuredRow[] => {
    if (call === null) {
      return [];
    }
    const parsed = KeywordVolumeOutputSchema.safeParse(call.output);
    return parsed.success && parsed.data.type === "result"
      ? parsed.data.keywords
      : [];
  };

  const firstCall = await attemptCall(0);
  const calls: VoiceOfCustomerToolCallResult[] =
    firstCall === null ? [] : [firstCall];
  let rows = measuredRows(firstCall);

  // One delayed re-attempt before committing the gap block: a transient SpyFu
  // failure (429 burst, cold key) at t0 must not poison the whole section.
  // Still best-effort — a second miss commits the honest gap block, never a
  // section failure.
  if (
    rows.length === 0 &&
    getPrepassExecutableTool(researchTools, "keyword_volume") !== null
  ) {
    try {
      await sleepWithAbort(brandedKeywordPrepassRetryDelayMs, input.signal);
      const retryCall = await attemptCall(1);
      if (retryCall !== null) {
        calls.push(retryCall);
        rows = measuredRows(retryCall);
      }
    } catch {
      // Aborted during the retry delay — keep whatever the first attempt produced.
    }
  }

  // Non-branded gap-keyword discovery (SpyFu kombat): the branded keyword_volume
  // call above measures the brand defending itself plus a few stable category
  // descriptors — it can NOT surface the keywords competitors actually rank/bid
  // on that the subject does not. That gap set IS the non-branded measured
  // demand a media buyer sizes Paid Media feasibility against; without it the
  // section reports "unknown" non-branded demand. One deterministic
  // keyword_discovery call over the subject domain vs the discovered competitor
  // seed domains supplies it. Best-effort — no seed domains, a tool gap, or a
  // 429 leaves the honest-gap fallback untouched.
  const discoveryRows = await discoverNonBrandedDemandRows({
    input,
    researchInput,
    researchTools,
    stepNumber: calls.length,
  });
  if (discoveryRows.call !== null) {
    calls.push(discoveryRows.call);
  }

  const gapBlock = [
    "DEMAND PREPASS (deterministic SpyFu monthly search volume — already ran):",
    `SpyFu returned no data for the subject's branded head terms (${brandedTerms.join(", ")})${categoryTerms.length === 0 ? "" : ` or category demand terms (${categoryTerms.join(", ")})`}.`,
    "State the branded-volume and non-branded-demand gap honestly in keywordDemand.prose; never estimate volumes.",
  ].join("\n");

  const events = calls.flatMap((recordedCall) =>
    buildToolEvents({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      step: recordedCall.step,
    }),
  );
  const steps = calls.map((recordedCall) => recordedCall.step);

  // R-A: the Market & Category section reuses this exact keyword_volume prepass,
  // but the same measured commercial rows source a sourced TAM read
  // (marketSize.signals + bottomUpTam.inputs) instead of the demand keyword
  // table. Branch the candidate-block text on sectionId; Market never has
  // keyword_discovery in allowedTools, so discoveryRows is empty here and the
  // branded/category split below is the whole measured set.
  if (input.sectionId === "positioningMarketCategory") {
    return {
      candidateBlock: buildMarketTamCandidateBlock({
        categoryTerms,
        dateObserved: getNow(deps).toISOString().slice(0, 10),
        // The brief economics carries avgLtv + targetCac + monthlyBudget — but
        // NOT an ACV. LTV (lifetime value) is not ACV (annual contract value);
        // feeding LTV into the TAM ACV input would overstate per-customer value
        // 3–6x. With no real operator ACV, leave it an honest evidence gap.
        operatorAcv: undefined,
        rows,
      }),
      events,
      steps,
    };
  }

  // Only the pure-gap block ships when BOTH the branded keyword_volume call AND
  // non-branded discovery came back empty — discovery rows alone are enough to
  // carry real non-branded measured demand even when branded volume is missing.
  if (rows.length === 0 && discoveryRows.rows.length === 0) {
    return { candidateBlock: gapBlock, events, steps };
  }

  const dateObserved = getNow(deps).toISOString().slice(0, 10);
  const brandedRows = rows.filter((row) => brandedTermSet.has(row.keyword));
  const categoryRows = rows.filter((row) => !brandedTermSet.has(row.keyword));
  const renderRow = (row: BrandedKeywordMeasuredRow): string =>
    `- ${row.display} | sourceUrl "${spyfuKeywordUrl(row.keyword)}"`;
  // Discovery rows carry their OWN per-keyword permalink as returned by SpyFu;
  // cite it exactly, never recompute the URL.
  const renderDiscoveryRow = (row: KeywordDiscoveryMeasuredRow): string =>
    `- ${row.display} | sourceUrl "${row.sourceUrl}"`;
  const hasNonBrandedRows =
    categoryRows.length > 0 || discoveryRows.rows.length > 0;
  const candidateBlock = [
    "DEMAND PREPASS (deterministic SpyFu monthly search volume + competitor-gap keywords — already ran; do NOT re-fetch these terms):",
    "The measured terms below are real SpyFu volume/CPC. Include EVERY row in keywordDemand.keywords with:",
    `- sourceTitle "SpyFu monthly search volume"; dateObserved "${dateObserved}"; and the row's OWN per-keyword sourceUrl shown below (each is a distinct spyfu.com/keyword/overview permalink — cite it exactly, NEVER the bare homepage root);`,
    "- monthlyVolume/cpc copied in the row's display formatting (keep the (SpyFu-estimated) label; a null cpc renders as n/a, never $0).",
    "Open keywordDemand.prose with the branded-vs-non-branded demand split — the branded floor is the denominator a media buyer checks first, the category/problem-aware rows are the real market demand.",
    `BRANDED HEAD TERMS (intentType "navigational"):`,
    ...(brandedRows.length === 0
      ? ["- (none measured — state the branded-volume gap honestly)"]
      : brandedRows.map(renderRow)),
    hasNonBrandedRows
      ? `NON-BRANDED CATEGORY / PROBLEM-AWARE TERMS (classify intentType per the term — typically "commercial" or "informational", NOT "navigational"):`
      : `NON-BRANDED CATEGORY / PROBLEM-AWARE TERMS: none measured${categoryTerms.length === 0 ? " (no category descriptor available)" : ` (SpyFu returned no monthly search volume for ${categoryTerms.join(", ")}); state this non-branded-demand gap honestly`}.`,
    ...categoryRows.map(renderRow),
    ...(discoveryRows.rows.length === 0
      ? []
      : [
          `NON-BRANDED COMPETITOR GAP KEYWORDS (keywords competitors rank/bid on that ${researchInput.company.name} does not; classify intentType "commercial" or "informational", NEVER "navigational"; sourceTitle "SpyFu competitor-gap keywords"):`,
          ...discoveryRows.rows.map(renderDiscoveryRow),
        ]),
  ].join("\n");

  return { candidateBlock, events, steps };
}

type KeywordDiscoveryMeasuredRow = Extract<
  z.infer<typeof KeywordDiscoveryOutputSchema>,
  { type: "result" }
>["keywords"][number];

// One deterministic keyword_discovery (SpyFu kombat) call over the subject
// domain vs the discovered competitor seed domains. Returns the non-branded gap
// keywords (keywords competitors rank/bid on that the subject does not) plus the
// recorded step so the keyword provenance validator accepts the rows. Returns
// no rows (best-effort) when the tool is absent, no usable seed domains resolve,
// or the call gaps (credential / rate_limited / api_error).
async function discoverNonBrandedDemandRows({
  input,
  researchInput,
  researchTools,
  stepNumber,
}: {
  input: RunSectionInput;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
  stepNumber: number;
}): Promise<{
  call: VoiceOfCustomerToolCallResult | null;
  rows: KeywordDiscoveryMeasuredRow[];
}> {
  if (getPrepassExecutableTool(researchTools, "keyword_discovery") === null) {
    return { call: null, rows: [] };
  }

  const subjectDomain = getHostname(
    getValidHttpUrl(researchInput.company.websiteUrl),
  );
  if (subjectDomain === null) {
    return { call: null, rows: [] };
  }

  // Seed competitor domains the section already resolved (corpus-derived or
  // user-supplied) — the same source the ad probe and competitor review prepass
  // read. Drop seeds with no domain and any that collapse onto the subject's own
  // registrable domain (a self-comparison surfaces no gap).
  const competitorDomains = Array.from(
    new Set(
      (researchInput.competitorSeeds ?? [])
        .map((seed) => seed.domain)
        .filter(
          (domain): domain is string =>
            domain !== undefined &&
            domain.trim().length > 0 &&
            !isSameRegistrableDomain(domain, subjectDomain),
        )
        .map((domain) => domain.trim().toLowerCase()),
    ),
  );

  if (competitorDomains.length === 0) {
    return { call: null, rows: [] };
  }

  const discoverySignal = createTimeoutSignal({
    parentSignal: input.signal,
    reasonLabel: "Keyword discovery prepass",
    timeoutMs: keywordDiscoveryPrepassDeadlineMs,
  });
  let call: VoiceOfCustomerToolCallResult | null;
  try {
    call = await executeVoiceOfCustomerPrepassTool({
      input: { ...input, signal: discoverySignal.signal },
      researchTools,
      stepNumber,
      toolInput: {
        domain: subjectDomain,
        competitorDomains,
        minSearchVolume: keywordDiscoveryPrepassMinSearchVolume,
      },
      toolName: "keyword_discovery",
    });
  } finally {
    discoverySignal.cleanup();
  }

  if (call === null) {
    return { call: null, rows: [] };
  }

  const parsed = KeywordDiscoveryOutputSchema.safeParse(call.output);
  if (!parsed.success || parsed.data.type !== "result") {
    // A gap (credential / rate_limited / api_error) still records the step so
    // the activity feed shows the attempt, but contributes no measured rows.
    return { call, rows: [] };
  }

  // SpyFu kombat gap mode returns the highest-VOLUME competitor terms, which
  // skews toward generic educational/definitional/government junk ("opportunity
  // cost", "california secretary of state", "mission statement examples"). Keep
  // only rows that read as commercial category demand — share a category token
  // or carry a commercial-intent modifier — before they reach the candidate
  // block. Relevance, not volume: a low-volume commercial row is still kept.
  const categoryHeadTokens = categoryDemandHeadTokens(
    researchInput.company.category,
  );
  const commercialRows = parsed.data.keywords.filter((row) =>
    isCommercialDemandKeyword(row.keyword, categoryHeadTokens),
  );

  return {
    call,
    rows: commercialRows.slice(0, keywordDiscoveryPrepassMaxRows),
  };
}

// Competitor review-permalink prepass (competitor landscape only): the W5 VoC
// permalink machinery pointed at the brief's top competitors, so
// publicWeaknesses can carry REAL per-review permalinks instead of index-page
// paraphrases (run 8081e646 cold judge: competitor quotes were "honestly
// paraphrased, not the permalinked real quotes a 9 needs"). Bounded: top 3
// seeded competitors, one reviews-tool call each (mode "bodies"), parallel
// under one 60s deadline. Best-effort — no permalinks means the block tells
// the agent to paraphrase honestly; never a section failure. The provenance
// gate downstream enforces the same contract deterministically.
const competitorReviewPrepassDeadlineMs = 60_000;
const competitorReviewPrepassMaxCompetitors = 3;
const competitorReviewPrepassQuotesPerCompetitor = 2;

interface CompetitorReviewPrepass {
  candidateBlock: string;
  events: ActivityEvent[];
  steps: readonly AgentStep[];
}

interface CompetitorReviewPermalinkQuote {
  date?: string;
  reviewText: string;
  reviewer?: string;
  role?: string;
  source: string;
  url: string;
}

function competitorReviewPermalinkQuotes(output: unknown): CompetitorReviewPermalinkQuote[] {
  const parsed = ReviewsOutputSchema.safeParse(output);

  if (!parsed.success || parsed.data.type !== "result") {
    return [];
  }

  return parsed.data.excerpts
    .filter(
      (excerpt): excerpt is typeof excerpt & { reviewText: string } =>
        typeof excerpt.reviewText === "string" &&
        excerpt.reviewText.trim().length > 0 &&
        isReviewPermalinkUrl(excerpt.url),
    )
    .slice(0, competitorReviewPrepassQuotesPerCompetitor)
    .map((excerpt) => ({
      reviewText: excerpt.reviewText.trim(),
      source: excerpt.source,
      url: excerpt.url,
      ...(excerpt.date === undefined ? {} : { date: excerpt.date }),
      ...(excerpt.reviewer === undefined ? {} : { reviewer: excerpt.reviewer }),
      ...(excerpt.role === undefined ? {} : { role: excerpt.role }),
    }));
}

export async function buildCompetitorReviewPrepass({
  deps,
  input,
  researchInput,
  researchTools,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
}): Promise<CompetitorReviewPrepass | undefined> {
  const seeds = (researchInput.competitorSeeds ?? [])
    .map((seed) => seed.name.trim())
    .filter((name) => name.length > 0)
    .slice(0, competitorReviewPrepassMaxCompetitors);

  if (seeds.length === 0) {
    return undefined;
  }

  const prepassSignal = createTimeoutSignal({
    parentSignal: input.signal,
    reasonLabel: "Competitor review prepass",
    timeoutMs: competitorReviewPrepassDeadlineMs,
  });
  let calls: Array<{
    brand: string;
    call: Awaited<ReturnType<typeof executeVoiceOfCustomerPrepassTool>>;
  }>;
  try {
    calls = await Promise.all(
      seeds.map(async (brand, index) => ({
        brand,
        call: await executeVoiceOfCustomerPrepassTool({
          input: { ...input, signal: prepassSignal.signal },
          researchTools,
          stepNumber: index,
          toolInput: {
            brand,
            max_body_pages: 2,
            max_results: 5,
            mode: "bodies",
          },
          toolName: "reviews",
        }),
      })),
    );
  } finally {
    prepassSignal.cleanup();
  }

  const steps: AgentStep[] = [];
  const events: ActivityEvent[] = [];
  const brandLines: string[] = [];

  for (const { brand, call } of calls) {
    if (call !== null) {
      steps.push(call.step);
      events.push(
        ...buildToolEvents({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          step: call.step,
        }),
      );
    }

    const quotes =
      call === null ? [] : competitorReviewPermalinkQuotes(call.output);

    brandLines.push(`## ${brand}`);

    if (quotes.length === 0) {
      brandLines.push(
        "- no per-review permalinks retrieved — paraphrase from your other evidence with a page-level sourceUrl; never label it verbatim",
      );
      continue;
    }

    for (const quote of quotes) {
      const attribution = [quote.reviewer, quote.role, quote.date]
        .filter((part): part is string => typeof part === "string")
        .join(", ");

      brandLines.push(
        `- [${quote.source} permalink] ${quote.url}`,
        `  "${quote.reviewText.slice(0, 280)}"${attribution.length === 0 ? "" : ` (${attribution})`}`,
      );
    }
  }

  const candidateBlock = [
    "COMPETITOR REVIEW PREPASS (deterministic — real per-review permalinks fetched before you ran):",
    "publicWeaknesses verbatim contract: a verbatimQuote may ONLY be copied exactly from the quotes below, with sourceUrl set to that quote's permalink. Competitors without quotes below get a paraphrased pattern from your other evidence with a page-level sourceUrl — never labeled verbatim.",
    ...brandLines,
  ].join("\n");

  return { candidateBlock, events, steps };
}

// Venue fan-out is 2 parallel perplexity calls + at most one retry each;
// bounded so a slow venue pass cannot eat the section budget.
// 45s covered the two-venue first pass; the W5 thin-pack second pass adds one
// more serial perplexity round (two venues in parallel), so the deadline gets
// room for it. Conditional: typical runs with a healthy pack stay ~first-pass
// latency. On timeout the second pass yields nothing and the prepass commits
// whatever the first pass found — never a failure.
const buyerPersonaPrepassDeadlineMs = 70_000;

async function buildBuyerPersonaCandidatePrepass({
  deps,
  input,
  researchInput,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
}): Promise<BuyerPersonaCandidatePrepass> {
  // Clamp the fixed prepass deadline to the remaining section budget (minus the
  // emit floor) so the prepass can't time out under 6-way fan-out contention —
  // mirrors getDeadlineAwareModelTimeoutMs.
  const remainingMs = getRemainingDeadlineMs(input, deps);
  const prepassDeadlineMs =
    remainingMs === null
      ? buyerPersonaPrepassDeadlineMs
      : Math.max(
          1,
          Math.min(
            buyerPersonaPrepassDeadlineMs,
            remainingMs - labSectionEmitFloorMs,
          ),
        );
  const prepassSignal = createTimeoutSignal({
    parentSignal: input.signal,
    reasonLabel: "Buyer persona venue prepass",
    timeoutMs: prepassDeadlineMs,
  });
  const steps: AgentStep[] = [];
  // Unwrapped tool: the venue pass has its own structural cap and must not
  // drain the agent loop's generic lookup pool (same rationale as the VoC
  // class fan-out).
  const lookupTools: Record<string, unknown> = {
    perplexity_research: perplexityResearchAgentTool,
  };

  try {
    const caseStudy = await acquireCaseStudyChampionCandidates({
      subject: {
        name: researchInput.company.name,
        websiteUrl: researchInput.company.websiteUrl,
      },
      signal: prepassSignal.signal,
    });
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

    // Case-study champions are the subject's own named external buyers (already
    // proven to clear the source-liveness gate on re-fetch); merge them AHEAD of
    // the less-reliable Perplexity leads.
    const mergedCandidates = [...caseStudy.candidates, ...acquisition.candidates];

    return {
      candidateBlock: formatBuyerPersonaCandidateBlock(mergedCandidates),
      candidates: mergedCandidates,
      caseStudyPages: caseStudy.pages,
      lookups: acquisition.lookups,
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

export function formatVoiceOfCustomerCandidateGapIssue({
  gap,
}: {
  gap: Exclude<VoiceOfCustomerCandidateResult, { ok: true }>["gap"];
  input: RunSectionInput;
  subjectDomain: string | null;
}): string {
  return gap.message;
}

function formatVoiceOfCustomerCandidateGapMetadataIssue({
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
  adEvidenceGroups,
  adProbeSteps,
  input,
  modelSteps,
}: {
  adEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  adProbeSteps?: readonly AgentStep[];
  input: RunSectionInput;
  modelSteps: readonly AgentStep[];
}): readonly AgentStep[] {
  if (input.sectionId !== "positioningCompetitorLandscape") {
    return modelSteps;
  }

  // W5 provenance bridge: the body's wall copy cites counts/URLs measured by
  // the deterministic wall builder, not present verbatim in any per-platform
  // probe result — the digest step makes honest wall claims verifiable.
  const digestStep = buildAdEvidenceWallDigestStep(adEvidenceGroups ?? []);
  const probeSteps = adProbeSteps ?? [];

  if (probeSteps.length === 0 && digestStep === undefined) {
    return modelSteps;
  }

  return [
    ...modelSteps,
    ...probeSteps,
    ...(digestStep === undefined ? [] : [digestStep]),
  ];
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
  decodeRepairs?: readonly DecodeRepair[];
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
  decodeRepairs,
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
    decodeRepairs,
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

    if (input.sectionId === "positioningDemandIntent") {
      // Subject-domain independence for intent signals (mirrors the VoC
      // self-sourcing gate above): "job-posting"-style signals citing the
      // subject's own marketing pages are vendor self-vouching, not
      // third-party demand — reject so the repair drops the row and carries
      // the shortfall in body.intentSignals.blockGap.
      const intentIndependence = checkDemandIntentIntentSignalIndependence({
        artifact: candidateArtifact,
        subjectDomain: researchInput.company.websiteUrl,
      });

      if (!intentIndependence.ok) {
        return { kind: "reject", errors: intentIndependence.errors };
      }

      // keyword_volume was allowed AND already measured in the prepass, so the
      // top-ranked move must not be the engine's own unfinished measurement.
      const topMove = (
        candidateArtifact.body as { orderedMoves?: { move: string }[] }
      ).orderedMoves?.[0]?.move;
      if (topMove !== undefined && isUnfilledKeywordMeasurementMove(topMove)) {
        return {
          kind: "reject",
          errors: [
            "body.orderedMoves[0].move: the top strategic move is the engine's own unfinished measurement (\"measure keyword volume\") — keyword_volume was available and already measured in the prepass. Replace it with a real strategic move that ACTS on the measured demand, and demote any remaining measurement step.",
          ],
        };
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

    if (input.sectionId === "positioningCompetitorLandscape") {
      // Pricing source-diversity (mirrors the VoC self-sourcing gate): a single
      // non-vendor listicle/blog monopolizing the pricing rows is laundered
      // third-party data, not corroborated pricing — reject so the repair drops
      // or diversifies the rows rather than shipping a one-source pricing table.
      const pricingDiversity = checkCompetitorPricingSourceDiversity({
        artifact: candidateArtifact,
        subjectDomain: researchInput.company.websiteUrl,
      });

      if (!pricingDiversity.ok) {
        return { kind: "reject", errors: pricingDiversity.errors };
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
      marketCategoryEvidenceGapArtifact:
        buildMarketCategoryEvidenceGapArtifact({
          artifact,
          definition,
          errors: [...verdict.errors],
          input,
          researchInput,
        }),
      demandIntentEvidenceGapArtifact:
        buildDemandIntentEvidenceGapArtifact({
          artifact,
          definition,
          deps,
          input,
          researchInput,
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
      demandIntentEvidenceGapArtifact:
        buildDemandIntentEvidenceGapArtifact({
          artifact,
          definition,
          deps,
          input,
          researchInput,
        }),
    };
  }

  if (verdict.kind === "hookReject") {
    return {
      output,
      artifact: null,
      errors: [...verdict.errors],
      demandIntentEvidenceGapArtifact:
        buildDemandIntentEvidenceGapArtifact({
          artifact,
          definition,
          deps,
          input,
          researchInput,
        }),
      ...(input.sectionId === "positioningVoiceOfCustomer" &&
      verdict.gapArtifact !== undefined
        ? { voiceOfCustomerEvidenceGapArtifact: verdict.gapArtifact }
        : {}),
    };
  }

  if (verdict.kind === "evidenceShortfall") {
    return {
      output,
      artifact: await annotateEvidenceSupportReview({
        artifact: verdict.committableArtifact,
        fetchImpl: deps.fetchImpl,
        preverifiedSourceUrls: collectPreverifiedSourceUrlsFromSteps({
          steps: evidenceSteps,
        }),
        researchInput,
        sectionId: input.sectionId,
        shortfall: verdict.shortfall,
        signal: input.signal,
        subjectSiteObservations: collectSubjectSiteObservationsFromSteps({
          steps: evidenceSteps,
          subjectWebsiteUrl: researchInput.company.websiteUrl,
        }),
      }),
      errors: [],
      evidenceSupportShortfall: verdict.shortfall,
    };
  }

  return {
    output,
    artifact: await annotateEvidenceSupportReview({
      artifact: verdict.committableArtifact,
      fetchImpl: deps.fetchImpl,
      preverifiedSourceUrls: collectPreverifiedSourceUrlsFromSteps({
        steps: evidenceSteps,
      }),
      // The clean commit path passes the same researchInput as the shortfall
      // path above: a clean section must never face a SMALLER numeric-
      // coherence truth universe than a shortfall section.
      researchInput,
      sectionId: input.sectionId,
      shortfall: verdict.shortfall,
      signal: input.signal,
      subjectSiteObservations: collectSubjectSiteObservationsFromSteps({
        steps: evidenceSteps,
        subjectWebsiteUrl: researchInput.company.websiteUrl,
      }),
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
  buyerPersonaCandidates,
  definition,
  deps,
  input,
  modelSteps,
  normalizedAdEvidenceGroups,
  researchInput,
}: {
  adProbeSteps?: readonly AgentStep[];
  answerInput: unknown | undefined;
  buyerPersonaCandidates?: readonly BuyerPersonaCandidate[];
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
    const answerInputMetadata = takeDecodeRepairsMetadata(answerInput);
    const voiceOfCustomerEvidenceGap =
      input.sectionId === "positioningPaidMediaPlan"
        ? await readSiblingVoiceOfCustomerEvidenceGap(deps, input.runId)
        : false;
    const decodedOutput = decodeModelBoundary({
      input,
      rawValue: withNormalizedSectionOutput({
        rawOutput: answerInputMetadata.value,
        sectionId: input.sectionId,
        buyerPersonaCandidates,
        normalizedAdEvidenceGroups,
        onboarding: researchInput.onboarding,
        researchInputSources: researchInput.sources,
        subjectCompanyName: researchInput.company.name,
        subjectWebsiteUrl: researchInput.company.websiteUrl,
        voiceOfCustomerEvidenceGap,
      }),
      schema: definition.sectionOutputSchema,
      schemaName: definition.sectionOutputSchemaName,
      upstreamRepairs: answerInputMetadata.snaps,
    });
    return await buildVerifiedAttemptFromOutput({
      decodeRepairs: decodedOutput.decodeRepairs,
      definition,
      deps,
      input,
      modelSteps,
      output: decodedOutput.value,
      researchInput,
      verifierSteps: buildVerifierEvidenceSteps({
        adEvidenceGroups: normalizedAdEvidenceGroups,
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

interface DecodedSectionOutput {
  decodeRepairs: DecodeRepair[];
  output: SectionOutput<Record<string, unknown>>;
}

export function buildOutputFromStructuredBody({
  body,
  buyerPersonaCandidates,
  definition,
  input,
  normalizedAdEvidenceGroups,
  onboarding,
  researchInputSources,
  subjectCompanyName,
  subjectWebsiteUrl,
}: {
  body: unknown;
  buyerPersonaCandidates?: readonly BuyerPersonaCandidate[];
  definition: RuntimeSectionDefinition;
  input: RunSectionInput;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  onboarding?: ResearchInput["onboarding"];
  researchInputSources?: ResearchInput["sources"];
  subjectCompanyName?: string;
  subjectWebsiteUrl?: string;
}): DecodedSectionOutput {
  const bodyMetadata = takeDecodeRepairsMetadata(body);
  const structuredRecord = getRecord(bodyMetadata.value);
  const rawBody = structuredRecord?.body ?? bodyMetadata.value;
  const rawBodyRecord = getRecord(rawBody);
  const normalizedRawBody =
    input.sectionId === "positioningVoiceOfCustomer" && rawBodyRecord !== null
      ? withNormalizedVoiceOfCustomerBody({ bodyRecord: rawBodyRecord })
      : rawBody;
  const decodedBody = decodeModelBoundary({
    input,
    rawValue: normalizedRawBody,
    schema: definition.bodySchema,
    schemaName: `${definition.sectionOutputSchemaName}Body`,
    upstreamRepairs: bodyMetadata.snaps,
  });
  const parsedBody = decodedBody.value;
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
    buyerPersonaCandidates,
    normalizedAdEvidenceGroups,
    onboarding,
    researchInputSources,
    sectionId: input.sectionId,
    subjectCompanyName,
    subjectWebsiteUrl,
  });
  const normalizedOutputRecord = getRecord(normalizedOutput);
  const decodedNormalizedBody =
    normalizedOutputRecord === null
      ? { value: parsedBody, decodeRepairs: [] }
      : decodeModelBoundary({
          input,
          rawValue: normalizedOutputRecord.body,
          schema: definition.bodySchema,
          schemaName: `${definition.sectionOutputSchemaName}NormalizedBody`,
        });
  const normalizedBody = decodedNormalizedBody.value;
  const existingSources = Array.isArray(normalizedOutputRecord?.sources)
    ? normalizedOutputRecord.sources
        .map((source) => normalizeModelSource(source))
        .filter((source): source is ModelSourceInput => source !== null)
    : [];

  const decodedOutput = decodeModelBoundary({
    input,
    rawValue: {
      ...authoredOutput,
      ...(normalizedOutputRecord ?? {}),
      body: normalizedBody,
      sources: mergeModelSources([
        ...existingSources,
        ...collectModelSourcesFromBody(normalizedBody),
      ]),
    },
    schema: definition.sectionOutputSchema,
    schemaName: definition.sectionOutputSchemaName,
    upstreamRepairs: [
      ...decodedBody.decodeRepairs,
      ...decodedNormalizedBody.decodeRepairs,
    ],
  });

  return {
    decodeRepairs: decodedOutput.decodeRepairs,
    output: decodedOutput.value,
  };
}

async function buildStructuredBodyAttempt({
  adProbeSteps,
  attempt,
  buyerPersonaCandidates,
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
  buyerPersonaCandidates?: readonly BuyerPersonaCandidate[];
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
    const decodedOutput = buildOutputFromStructuredBody({
      body,
      buyerPersonaCandidates,
      definition,
      input,
      normalizedAdEvidenceGroups,
      onboarding: researchInput.onboarding,
      researchInputSources: researchInput.sources,
      subjectCompanyName: researchInput.company.name,
      subjectWebsiteUrl: researchInput.company.websiteUrl,
    });

    return await buildVerifiedAttemptFromOutput({
      decodeRepairs: decodedOutput.decodeRepairs,
      definition,
      deps,
      input,
      modelSteps,
      output: decodedOutput.output,
      researchInput,
      verifierSteps: buildVerifierEvidenceSteps({
        adEvidenceGroups: normalizedAdEvidenceGroups,
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
  ensurePreparedSectionContext({ deps, input, record });
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
      input.sectionId === "positioningVoiceOfCustomer" &&
      !shouldUsePreparedContext(deps)
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
      const metadataIssue = formatVoiceOfCustomerCandidateGapMetadataIssue({
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
          metadata: { attempt: 1, issues: [metadataIssue] },
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
        // FIX-VOC: surface the directional pool (strict-admissible + trusted-host
        // non-permalink quotes) so a second independent domain reaches the gap
        // body, relabeled directional rather than dropped.
        quoteCandidates: voiceOfCustomerPrepass.directionalCandidates,
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
    input.sectionId === "positioningBuyerICP" && !shouldUsePreparedContext(deps)
      ? await buildBuyerPersonaCandidatePrepass({ deps, input, researchInput })
      : undefined;
  if (buyerPersonaPrepass !== undefined) {
    toolEvents.push(...buyerPersonaPrepass.events);
    await scheduleFlush();
  }
  const buyerPersonaPrepassSteps = buyerPersonaPrepass?.steps ?? [];
  const brandedKeywordPrepass =
    !shouldUsePreparedContext(deps) &&
    (input.sectionId === "positioningDemandIntent" ||
      input.sectionId === "positioningMarketCategory")
      ? await buildBrandedKeywordPrepass({
          deps,
          input,
          researchInput,
          researchTools: externalTools,
        })
      : undefined;
  if (brandedKeywordPrepass !== undefined) {
    toolEvents.push(...brandedKeywordPrepass.events);
    await scheduleFlush();
  }
  const brandedKeywordPrepassSteps = brandedKeywordPrepass?.steps ?? [];
  const competitorReviewPrepass =
    input.sectionId === "positioningCompetitorLandscape" &&
    !shouldUsePreparedContext(deps)
      ? await buildCompetitorReviewPrepass({
          deps,
          input,
          researchInput,
          researchTools: externalTools,
        })
      : undefined;
  if (competitorReviewPrepass !== undefined) {
    toolEvents.push(...competitorReviewPrepass.events);
    await scheduleFlush();
  }
  const competitorReviewPrepassSteps = competitorReviewPrepass?.steps ?? [];
  const subjectSiteObservationPrepass =
    input.sectionId === "positioningOfferDiagnostic" &&
    !shouldUsePreparedContext(deps)
      ? await buildSubjectSiteObservationPrepass({
          deps,
          input,
          researchInput,
          researchTools: externalTools,
        })
      : undefined;
  if (subjectSiteObservationPrepass !== undefined) {
    toolEvents.push(...subjectSiteObservationPrepass.events);
    await scheduleFlush();
  }
  const subjectSiteObservationPrepassSteps =
    subjectSiteObservationPrepass?.steps ?? [];
  await appendEvidencePoolBestEffort({
    context: "answer-tool-initial",
    deps,
    entries: [
      ...buildCorpusEvidencePoolEntries({ input, researchInput }),
      ...buildStepEvidencePoolEntries({
        deps,
        input,
        steps: [
          ...adEvidence.adProbeSteps,
          ...voiceOfCustomerPrepassSteps,
          ...buyerPersonaPrepassSteps,
          ...brandedKeywordPrepassSteps,
          ...competitorReviewPrepassSteps,
          ...subjectSiteObservationPrepassSteps,
        ],
      }),
      ...buildCaseStudyPageEvidencePoolEntries({
        deps,
        input,
        pages: buyerPersonaPrepass?.caseStudyPages,
      }),
    ],
    input,
  });
  const answerToolEvidencePoolBlock = await readEvidencePoolBlockBestEffort({
    deps,
    input,
    maxChars: STRUCTURER_EVIDENCE_POOL_CHAR_LIMIT,
  });
  const answerToolInstructions = [
    buildAnswerToolInstructions(
      definition,
      researchInput,
      adEvidence.normalizedAdEvidenceGroups,
      {
        evidencePoolBlock: answerToolEvidencePoolBlock,
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
    ...(brandedKeywordPrepass === undefined
      ? []
      : ["", brandedKeywordPrepass.candidateBlock]),
    ...(competitorReviewPrepass === undefined
      ? []
      : ["", competitorReviewPrepass.candidateBlock]),
    ...(subjectSiteObservationPrepass === undefined ||
    subjectSiteObservationPrepass.candidateBlock.length === 0
      ? []
      : ["", subjectSiteObservationPrepass.candidateBlock]),
    "",
    "Skill analyst guidance:",
    skillMd,
    buildSectionObjectiveRecap(definition, researchInput),
  ].join("\n");
  const answerTool = createAnswerTool(definition.sectionOutputSchema, {
    model: sectionRunnerModel,
    sectionId: input.sectionId,
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
  await appendEvidencePoolBestEffort({
    context: "answer-tool-attempt",
    deps,
    entries: buildStepEvidencePoolEntries({
      deps,
      input,
      steps: answerResult.steps,
    }),
    input,
  });

  const answerResultSteps = [
    ...voiceOfCustomerPrepassSteps,
    ...buyerPersonaPrepassSteps,
    ...brandedKeywordPrepassSteps,
    ...competitorReviewPrepassSteps,
    ...subjectSiteObservationPrepassSteps,
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
    await appendEvidencePoolBestEffort({
      context: "answer-tool-ad-rescue",
      deps,
      entries: buildStepEvidencePoolEntries({
        deps,
        input,
        steps: adRescue.steps,
      }),
      input,
    });
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
    buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
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
          evidencePoolBlock: answerToolEvidencePoolBlock,
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
      await appendEvidencePoolBestEffort({
        context: "answer-tool-repair",
        deps,
        entries: buildStepEvidencePoolEntries({
          deps,
          input,
          steps: repairResult.steps,
        }),
        input,
      });
      const repairResultSteps = [
        ...voiceOfCustomerPrepassSteps,
        ...buyerPersonaPrepassSteps,
        ...brandedKeywordPrepassSteps,
        ...competitorReviewPrepassSteps,
        ...subjectSiteObservationPrepassSteps,
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
        buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
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

    let evidenceGapArtifact =
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
      evidenceGapArtifact === undefined &&
      isDeadlineExhaustionFailure(getAttemptRepairIssues(attempt), input, deps)
    ) {
      evidenceGapArtifact = buildDeadlineExhaustionHonestGapArtifact({
        buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
        definition,
        deps,
        input,
        researchInput,
      });
    }
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
    buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
    buyerPersonaLookups: buyerPersonaPrepass?.lookups,
    committedArtifacts: researchInput.committedPositioningArtifacts,
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
  ensurePreparedSectionContext({ deps, input, record });
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
      input.sectionId === "positioningVoiceOfCustomer" &&
      !shouldUsePreparedContext(deps)
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
      const metadataIssue = formatVoiceOfCustomerCandidateGapMetadataIssue({
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
          metadata: { attempt: 1, issues: [metadataIssue] },
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
        // FIX-VOC: surface the directional pool (strict-admissible + trusted-host
        // non-permalink quotes) so a second independent domain reaches the gap
        // body, relabeled directional rather than dropped.
        quoteCandidates: voiceOfCustomerPrepass.directionalCandidates,
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
    input.sectionId === "positioningBuyerICP" && !shouldUsePreparedContext(deps)
      ? await buildBuyerPersonaCandidatePrepass({ deps, input, researchInput })
      : undefined;
  if (buyerPersonaPrepass !== undefined) {
    toolEvents.push(...buyerPersonaPrepass.events);
    await scheduleFlush();
  }

  const brandedKeywordPrepass =
    !shouldUsePreparedContext(deps) &&
    (input.sectionId === "positioningDemandIntent" ||
      input.sectionId === "positioningMarketCategory")
      ? await buildBrandedKeywordPrepass({
          deps,
          input,
          researchInput,
          researchTools: externalTools,
        })
      : undefined;
  if (brandedKeywordPrepass !== undefined) {
    toolEvents.push(...brandedKeywordPrepass.events);
    await scheduleFlush();
  }

  const competitorReviewPrepass =
    input.sectionId === "positioningCompetitorLandscape" &&
    !shouldUsePreparedContext(deps)
      ? await buildCompetitorReviewPrepass({
          deps,
          input,
          researchInput,
          researchTools: externalTools,
        })
      : undefined;
  if (competitorReviewPrepass !== undefined) {
    toolEvents.push(...competitorReviewPrepass.events);
    await scheduleFlush();
  }

  const subjectSiteObservationPrepass =
    input.sectionId === "positioningOfferDiagnostic" &&
    !shouldUsePreparedContext(deps)
      ? await buildSubjectSiteObservationPrepass({
          deps,
          input,
          researchInput,
          researchTools: externalTools,
        })
      : undefined;
  if (subjectSiteObservationPrepass !== undefined) {
    toolEvents.push(...subjectSiteObservationPrepass.events);
    await scheduleFlush();
  }

  const modelSteps: AgentStep[] = [
    ...(voiceOfCustomerPrepass?.steps ?? []),
    ...(buyerPersonaPrepass?.steps ?? []),
    ...(brandedKeywordPrepass?.steps ?? []),
    ...(competitorReviewPrepass?.steps ?? []),
    ...(subjectSiteObservationPrepass?.steps ?? []),
  ];
  let normalizedAdEvidenceGroups = adEvidence.normalizedAdEvidenceGroups;
  let validationAttempt = 1;
  await appendEvidencePoolBestEffort({
    context: "structured-body-initial",
    deps,
    entries: [
      ...buildCorpusEvidencePoolEntries({ input, researchInput }),
      ...buildStepEvidencePoolEntries({
        deps,
        input,
        steps: [...adEvidence.adProbeSteps, ...modelSteps],
      }),
      ...buildCaseStudyPageEvidencePoolEntries({
        deps,
        input,
        pages: buyerPersonaPrepass?.caseStudyPages,
      }),
    ],
    input,
  });
  const thinkerEvidencePoolBlock = await readEvidencePoolBlockBestEffort({
    deps,
    input,
    maxChars: THINKER_EVIDENCE_POOL_CHAR_LIMIT,
  });
  const structurerEvidencePoolBlock = await readEvidencePoolBlockBestEffort({
    deps,
    input,
    maxChars: STRUCTURER_EVIDENCE_POOL_CHAR_LIMIT,
  });
  const thinkerAnalysis = await runThinkerAnalysisBestEffort({
    deps,
    input,
    prompt: buildThinkerPrompt({
      brandedKeywordCandidateBlock: brandedKeywordPrepass?.candidateBlock,
      buyerPersonaCandidateBlock: buyerPersonaPrepass?.candidateBlock,
      competitorReviewCandidateBlock: competitorReviewPrepass?.candidateBlock,
      definition,
      evidencePoolBlock: thinkerEvidencePoolBlock,
      externalToolNames,
      normalizedAdEvidenceGroups,
      researchInput,
      skillMd,
      voiceOfCustomerCandidateBlock: voiceOfCustomerPrepass?.candidateBlock,
    }),
  });
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

  const structuredBodyPrompt =
    thinkerAnalysis === null
      ? buildStructuredBodyPrompt({
          brandedKeywordCandidateBlock: brandedKeywordPrepass?.candidateBlock,
          buyerPersonaCandidateBlock: buyerPersonaPrepass?.candidateBlock,
          competitorReviewCandidateBlock:
            competitorReviewPrepass?.candidateBlock,
          definition,
          evidencePoolBlock: structurerEvidencePoolBlock,
          externalToolNames,
          normalizedAdEvidenceGroups,
          researchInput,
          skillMd,
          voiceOfCustomerCandidateBlock: voiceOfCustomerPrepass?.candidateBlock,
        })
      : buildStructurerPrompt({
          brandedKeywordCandidateBlock: brandedKeywordPrepass?.candidateBlock,
          buyerPersonaCandidateBlock: buyerPersonaPrepass?.candidateBlock,
          competitorReviewCandidateBlock:
            competitorReviewPrepass?.candidateBlock,
          definition,
          evidencePoolBlock: structurerEvidencePoolBlock,
          externalToolNames,
          normalizedAdEvidenceGroups,
          researchInput,
          skillMd,
          thinkerAnalysis,
          voiceOfCustomerCandidateBlock: voiceOfCustomerPrepass?.candidateBlock,
        });

  let attempt = await buildStructuredBodyAttempt({
    adProbeSteps: adEvidence.adProbeSteps,
    attempt: validationAttempt,
    buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
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
  await appendEvidencePoolBestEffort({
    context: "structured-body-attempt",
    deps,
    entries: buildStepEvidencePoolEntries({ deps, input, steps: modelSteps }),
    input,
  });
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
      buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
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
    await appendEvidencePoolBestEffort({
      context: "structured-body-length-retry",
      deps,
      entries: buildStepEvidencePoolEntries({ deps, input, steps: modelSteps }),
      input,
    });
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
    await appendEvidencePoolBestEffort({
      context: "structured-body-ad-rescue",
      deps,
      entries: buildStepEvidencePoolEntries({
        deps,
        input,
        steps: adRescue.steps,
      }),
      input,
    });
    normalizedAdEvidenceGroups = mergeAdEvidenceGroups(
      [...adRescue.groups],
      normalizedAdEvidenceGroups ?? [],
    );

    if (attempt.output !== null) {
      attempt = await buildAnswerToolAttempt({
        adProbeSteps: adProbeStepsWithRescue,
        answerInput: attempt.output,
        buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
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
        buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
        definition,
        deps,
        externalTools,
        input,
        modelSteps,
        normalizedAdEvidenceGroups,
        partialSeqRef,
        prompt: buildStructuredBodyRepairPrompt({
          brandedKeywordCandidateBlock: brandedKeywordPrepass?.candidateBlock,
          buyerPersonaCandidateBlock: buyerPersonaPrepass?.candidateBlock,
          competitorReviewCandidateBlock: competitorReviewPrepass?.candidateBlock,
          definition,
          evidencePoolBlock: structurerEvidencePoolBlock,
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
      await appendEvidencePoolBestEffort({
        context: "structured-body-repair",
        deps,
        entries: buildStepEvidencePoolEntries({ deps, input, steps: modelSteps }),
        input,
      });
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

    let evidenceGapArtifact =
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
      evidenceGapArtifact === undefined &&
      isDeadlineExhaustionFailure(getAttemptRepairIssues(attempt), input, deps)
    ) {
      evidenceGapArtifact = buildDeadlineExhaustionHonestGapArtifact({
        buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
        definition,
        deps,
        input,
        researchInput,
      });
    }
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
    buyerPersonaCandidates: buyerPersonaPrepass?.candidates,
    buyerPersonaLookups: buyerPersonaPrepass?.lookups,
    committedArtifacts: researchInput.committedPositioningArtifacts,
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
  ensurePreparedSectionContext({ deps, input, record });
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
  const allowedTools = getAllowedTools(definition, deps);
  const researchTools = buildToolMap(allowedTools, {
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
      requiredToolSequence: buildRequiredToolSequence(allowedTools),
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
    input.sectionId === "positioningCompetitorLandscape" &&
    !shouldUsePreparedContext(deps)
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
  await appendEvidencePoolBestEffort({
    context: "structured-legacy-initial",
    deps,
    entries: [
      ...buildCorpusEvidencePoolEntries({ input, researchInput }),
      ...buildStepEvidencePoolEntries({ deps, input, steps: evidenceSteps }),
    ],
    input,
  });
  const structuredEvidencePoolBlock = await readEvidencePoolBlockBestEffort({
    deps,
    input,
    maxChars: STRUCTURER_EVIDENCE_POOL_CHAR_LIMIT,
  });
  const structuredPrompt = buildStructuredPrompt({
    definition,
    evidencePoolBlock: structuredEvidencePoolBlock,
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
          evidencePoolBlock: structuredEvidencePoolBlock,
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
        evidencePoolBlock: structuredEvidencePoolBlock,
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

  artifact = withPaidMediaEvidencePack({
    artifact: verifierGate.artifact,
    committedArtifacts: researchInput.committedPositioningArtifacts,
  });

  await appendSubSectionCommittedEvents({
    artifact,
    deps,
    input,
  });
  // Sandbox-only, env-gated, best-effort: dump the fully-built artifact before
  // persistence validation so a CLI proof run can inspect it even when the
  // persistence gate throws (e.g. an authoring-minimum shortfall). Off in prod.
  if (process.env.ZZ_DUMP_ARTIFACT !== undefined) {
    try {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync("tmp/zz-section-out", { recursive: true });
      writeFileSync(
        `tmp/zz-section-out/_dump-${input.sectionId}.json`,
        JSON.stringify(artifact, null, 2),
      );
    } catch {
      // best-effort debug aid; never affects the run
    }
  }
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
