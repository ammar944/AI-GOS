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
import type { CompetitorAdEvidenceGroup } from "../artifacts/schemas/competitor-landscape";
import { adCreativeFingerprint } from "../artifacts/schemas/competitor-landscape";
import {
  paidMediaMoneyProvenanceValues,
  snapAngleTypesInMix,
  snapCreativeType,
} from "../artifacts/schemas/paid-media-plan";
import { checkDemandIntentKeywordProvenance } from "../artifacts/schemas/demand-intent";
import {
  classifyVoiceOfCustomerEvidenceGap,
  checkVoiceOfCustomerSelfSourcing,
  type VoiceOfCustomerEvidenceGapClassification,
} from "../artifacts/schemas/voice-of-customer";
import { sectionRunnerModel } from "../ai/models";
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
import { createLabSectionTelemetry } from "./telemetry";
import { consumePartialsUntilAbort } from "./consume-partials";
import { createFixtureTools } from "./section-tools";
import { SectionToolBudget, ToolBudget } from "./budget";
import { buildToolMap } from "./tool-registry";
import {
  VOC_CANDIDATE_PACK_MAX_SIZE,
  VOC_PREPASS_MAX_LOOKUPS,
  createVoiceOfCustomerCandidate,
  formatVoiceOfCustomerCandidateBlock,
  getRegistrableDomain,
  selectVoiceOfCustomerCandidates,
  type VoiceOfCustomerCandidate,
  type VoiceOfCustomerCandidateResult,
  type VoiceOfCustomerEvidenceKind,
  type VoiceOfCustomerCandidateSource,
} from "./voice-of-customer-candidates";
import { ToolGapSchema, type ToolGap } from "./tools/_shared";
import {
  extractCompanyFromDomain,
  isAdvertiserMatch,
} from "./tools/advertiser-match";
import {
  buildCompetitorAdEvidenceGroups,
  summarizeCompetitorAdEvidenceGroups,
} from "./tools/competitor-ad-adapter";
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
  evaluateEvidenceSupport,
  getMaxUnsupportedAllowed,
  paidMediaLoadBearingKinds,
  voiceOfCustomerLoadBearingKinds,
  type EvidenceSupportShortfall,
} from "./verification/evidence-support";
import {
  structuralVerifier,
} from "./verification/structural-verifier";
import {
  createThrottledSectionPartialBroadcaster,
  type SectionPartialPublishFn,
  type SectionPartialSeqRef,
} from "@/lib/research-v2/section-partial-broadcaster";

export interface RunSectionInput {
  runId: string;
  sectionId: SupportedSectionId;
  signal?: AbortSignal;
}

export interface RunSectionDeps {
  store: RunStore;
  loadSkill: (slug: string) => Promise<string>;
  allowedTools?: readonly ToolName[];
  env?: Record<string, string | undefined>;
  runAnswerTool?: AnswerToolRunner;
  runEvidencePass?: EvidencePassRunner;
  callStructured?: StructuredCaller;
  streamStructured?: StructuredStreamer;
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
      error.toLowerCase().includes("abort"),
  );
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

const voiceOfCustomerRequiredPainQuoteCount = 10;
const voiceOfCustomerRequiredDistinctPainSourceCount = 3;

function buildVoiceOfCustomerEvidenceGapBody({
  facts,
  issue,
  subjectDomain,
}: {
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
      sourcingPlan: [
        "Recover full review bodies from approved third-party review surfaces such as G2, Capterra, Trustpilot, Reddit, Hacker News, or support/community threads.",
        "When a surfaced URL has no snippet, retry with Firecrawl only if the rendered page returns usable markdown; record JS-challenge or empty-body pages as acquisition gaps.",
        `Exclude the audited company domain (${subjectDomain ?? "unknown"}) and require at least three independent domains before promoting buyer pain language.`,
      ],
    },
  };
}

function buildVoiceOfCustomerEvidenceGapArtifact({
  baseArtifact,
  definition,
  deps,
  facts,
  input,
  issue,
  researchInput,
}: {
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

function buildVoiceOfCustomerPrepassEvidenceGapArtifact({
  definition,
  deps,
  input,
  issue,
  researchInput,
  result,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  issue: string;
  researchInput: ResearchInput;
  result: Exclude<VoiceOfCustomerCandidateResult, { ok: true }>;
}): ArtifactEnvelope {
  const facts: VoiceOfCustomerEvidenceGapFacts = {
    ok: true,
    foundPainQuoteCount: result.gap.candidateCount,
    foundDistinctPainSourceCount: result.gap.domains.length,
    observedPainSourceDomains: result.gap.domains,
  };

  return buildVoiceOfCustomerEvidenceGapArtifact({
    definition,
    deps,
    facts,
    input,
    issue,
    researchInput,
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
  errors: string[];
  requiredEvidenceMissing?: RequiredEvidenceMissingError;
  evidenceSupportShortfall?: EvidenceSupportShortfall;
  voiceOfCustomerEvidenceGapArtifact?: ArtifactEnvelope;
}

function getAttemptRepairIssues(attempt: AttemptResult): string[] {
  return [
    ...attempt.errors,
    ...(attempt.evidenceSupportShortfall?.issues ?? []),
  ];
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
// Must fire well under undici's default headersTimeout (~5 min) so the
// server records a terminal failure before the verifier's fetch dies and
// abandons the run record in `running` state.
const structuredOutputTimeoutMs = 240_000;
// Inner backstop in the timeout hierarchy (Cluster A target, Option A):
// answer-tool 255s < job timeout (LAB_SECTION_JOB_TIMEOUT_MS = 270s) <
// route maxDuration (300s). The answer-tool timeout trips first as an inner
// guard; the 270s job-timeout AbortController is the canonical controlled
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
// wall-clock — the 270s job AbortController is the real ceiling under repairs.
// The repair loops therefore yield to input.signal?.aborted (see the while
// guards) so an aborted section commits its best attempt or fails cleanly
// rather than racing the controller into an orphaned 'running' row. A true
// cumulative section budget is a follow-up best calibrated with live latency.
export const answerToolTimeoutMs = 255_000;
// The first agent step (a model response or tool call) must arrive within this
// window. A stalled provider transport produces zero steps, so we abandon the
// attempt here instead of waiting out the full answer-tool budget.
const defaultAnswerToolFirstStepTimeoutMs = 120_000;
// One retry on a zero-step stall: the stall is a transient transport fault, so a
// fresh attempt usually proceeds. A second stall fails the section terminally.
const answerToolMaxAttempts = 2;
const structuredFirstChunkTimeoutMs = 60_000;
const structuredChunkIdleTimeoutMs = 60_000;
const competitorAdProbeAdvertiserLimit = 5;
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
// Per-advertiser ceiling on the optional Foreplay direct prepass (searchBrands ->
// searchAds). Foreplay runs alongside the SearchAPI probe inside the
// per-advertiser step; this bound keeps a slow Foreplay round-trip from eating the
// shared probe deadline.
const competitorAdProbeForeplayDeadlineMs = 9_000;
// Cap on Foreplay ads pulled per advertiser. Mirrors the SearchAPI max_results so
// one channel cannot flood the per-advertiser creative budget.
const competitorAdProbeForeplayMaxAds = 6;
// Hard ceiling on the VoC candidate prepass (reviews -> web_search -> firecrawl).
// Unlike the ad probe, the prepass ran on the critical path with NO deadline,
// so a slow scrape could eat into the section budget and tip VoC past the 270s
// job timeout. Bounding it here (and degrading to partial candidates on abort,
// see executeVoiceOfCustomerPrepassTool) caps the front-loaded prepass wall-clock.
const voiceOfCustomerPrepassDeadlineMs = 45_000;
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
      body: definition.bodySchema,
    })
    // .strict() is load-bearing: the draft schema must REJECT a full SectionOutput
    // (extra sectionTitle/confidence keys) so the draft shape stays distinct
    // from the committed envelope. The repair prompt already tells the model to drop
    // stray envelope fields. (run-section-artifact-streaming.test.ts:135 asserts this.)
    .strict();
}
const paidMediaPlanGenerationSchema = z
  .object({
    body: z.unknown(),
    confidence: z.unknown(),
    sectionTitle: z.unknown(),
    sources: z.unknown(),
    statusSummary: z.unknown(),
    verdict: z.unknown(),
  })
  .passthrough();
// Synthesis mirrors the paid-media structured path: a permissive generation
// schema lets the model emit freely, then the normalizer + strict parse clean
// it up. Sending the strict nested schema to the model over-constrains it.
const positioningSynthesisGenerationSchema = z
  .object({
    body: z.unknown(),
    confidence: z.unknown(),
    sectionTitle: z.unknown(),
    sources: z.unknown(),
    statusSummary: z.unknown(),
    verdict: z.unknown(),
  })
  .passthrough();

function getPositiveIntegerEnvValue(key: string): number | undefined {
  const rawValue = process.env[key]?.trim();

  if (rawValue === undefined || rawValue.length === 0) {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer number of milliseconds.`);
  }

  return value;
}

function getAnswerToolFirstStepTimeoutMs(): number {
  return (
    getPositiveIntegerEnvValue("LAB_ENGINE_ANSWER_TOOL_FIRST_STEP_TIMEOUT_MS") ??
    defaultAnswerToolFirstStepTimeoutMs
  );
}

function getStructuredOutputMaxTokens(
  definition: RuntimeSectionDefinition,
): number {
  return (
    definition.structuredOutputMaxTokens ?? defaultStructuredOutputMaxTokens
  );
}

function getStructuredGenerationSchema(
  definition: RuntimeSectionDefinition,
): z.ZodType<unknown> {
  if (definition.id === "positioningSynthesis") {
    return positioningSynthesisGenerationSchema;
  }

  if (definition.id === "positioningPaidMediaPlan") {
    return paidMediaPlanGenerationSchema;
  }

  return definition.sectionOutputSchema;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringProperty(
  value: Record<string, unknown> | null,
  key: string,
): string | null {
  const propertyValue = value?.[key];

  if (typeof propertyValue !== "string") {
    return null;
  }

  const trimmedValue = propertyValue.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function getUrlProperty(
  value: Record<string, unknown> | null,
  key: string,
): string | null {
  const candidate = getStringProperty(value, key);
  if (candidate === null) {
    return null;
  }

  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
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

function withNormalizedCompetitorAdEvidence({
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
  const prose =
    getStringProperty(adEvidenceRecord, "prose") ??
    summarizeCompetitorAdEvidenceGroups(normalizedAdEvidenceGroups);

  return {
    ...outputRecord,
    body: {
      ...bodyRecord,
      adEvidence: {
        prose,
        advertiserGroups: normalizedAdEvidenceGroups,
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
  };
}

function mergeAdEvidenceGroups(
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

function dedupeRecordArrayByStringKey({
  key,
  value,
}: {
  key: string;
  value: unknown;
}): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const seen = new Set<string>();

  return value.filter((item) => {
    const itemRecord = getRecord(item);
    const keyValue = getStringProperty(itemRecord, key);

    if (keyValue === null) {
      return true;
    }

    if (seen.has(keyValue)) {
      return false;
    }

    seen.add(keyValue);

    return true;
  });
}

function getValidHttpUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getSourceTitleFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");

    return `Evidence source: ${hostname}`;
  } catch {
    return "Evidence source";
  }
}

function collectStringValuesByKey(value: unknown, key: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValuesByKey(item, key));
  }

  const record = getRecord(value);

  if (record === null) {
    return [];
  }

  const currentValue = getStringProperty(record, key);
  const childValues = Object.values(record).flatMap((item) =>
    collectStringValuesByKey(item, key),
  );

  return currentValue === null ? childValues : [currentValue, ...childValues];
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

function removeEmptyStringProperty(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = record[key];

  if (value === null) {
    return Object.fromEntries(
      Object.entries(record).filter(([entryKey]) => entryKey !== key),
    );
  }

  if (typeof value !== "string" || value.trim().length > 0) {
    return record;
  }

  return Object.fromEntries(
    Object.entries(record).filter(([entryKey]) => entryKey !== key),
  );
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

type PaidMediaPlanGroundedSourceSection =
  | "positioningCompetitorLandscape"
  | "positioningDemandIntent"
  | "positioningOfferDiagnostic"
  | "positioningVoiceOfCustomer";

function normalizePaidMediaGroundedSourceSections({
  fallbackSourceSection,
  value,
}: {
  fallbackSourceSection: PaidMediaPlanGroundedSourceSection;
  value: unknown;
}): unknown {
  return normalizeArrayRecords({
    value,
    normalize: (record) => {
      if (getStringProperty(record, "sourceSection") !== "gtmBrief") {
        return record;
      }

      return {
        ...record,
        sourceSection: fallbackSourceSection,
      };
    },
  });
}

function normalizePaidMediaGroundedRecordArray({
  allowedKeys,
  fallbackSourceSection,
  numberKeys,
  stringArrayKeys,
  stringKeys,
  value,
}: {
  allowedKeys: readonly string[];
  fallbackSourceSection: PaidMediaPlanGroundedSourceSection;
  numberKeys?: readonly string[];
  stringArrayKeys?: readonly string[];
  stringKeys?: readonly string[];
  value: unknown;
}): unknown {
  return normalizePaidMediaGroundedSourceSections({
    fallbackSourceSection,
    value: normalizeStructuredRecordArray({
      allowedKeys,
      numberKeys,
      stringArrayKeys,
      stringKeys,
      value,
    }),
  });
}

function normalizePaidMediaMoneyProvenance(value: unknown): string {
  if (
    typeof value === "string" &&
    (paidMediaMoneyProvenanceValues as readonly string[]).includes(value)
  ) {
    return value;
  }

  return "unknown";
}

function withPaidMediaMoneyProvenanceDefaults(
  record: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return {
    ...record,
    ...Object.fromEntries(
      keys.map((key) => [
        key,
        normalizePaidMediaMoneyProvenance(record[key]),
      ]),
    ),
  };
}

function withPaidMediaMoneyProvenanceDefaultsForRecordArray(
  value: unknown,
  keys: readonly string[],
): unknown {
  return normalizeArrayRecords({
    value,
    normalize: (record) =>
      withPaidMediaMoneyProvenanceDefaults(record, keys),
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

function withNormalizedBuyerICPOutput(rawOutput: unknown): unknown {
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

  return {
    ...outputRecord,
    body: {
      ...bodyRecord,
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

function withNormalizedVoiceOfCustomerOutput(rawOutput: unknown): unknown {
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

  const painLanguageRecord = getRecord(bodyRecord.painLanguage);
  const switchingStoriesRecord = getRecord(bodyRecord.switchingStories);
  const successLanguageRecord = getRecord(bodyRecord.successLanguage);

  return {
    ...outputRecord,
    body: {
      ...bodyRecord,
      ...(painLanguageRecord === null
        ? {}
        : {
            painLanguage: {
              ...painLanguageRecord,
              quotes: normalizeArrayRecords({
                normalize: normalizeVerbatimTextRecord,
                value: painLanguageRecord.quotes,
              }),
            },
          }),
      ...(switchingStoriesRecord === null
        ? {}
        : {
            switchingStories: {
              ...switchingStoriesRecord,
              stories: normalizeArrayRecords({
                normalize: (story) =>
                  removeEmptyStringProperty(story, "exampleCompany"),
                value: switchingStoriesRecord.stories,
              }),
            },
          }),
      ...(successLanguageRecord === null
        ? {}
        : {
            successLanguage: {
              ...successLanguageRecord,
              quotes: normalizeArrayRecords({
                normalize: normalizeVerbatimTextRecord,
                value: successLanguageRecord.quotes,
              }),
            },
          }),
    },
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

  const campaignOverviewRecord = getRecord(bodyRecord.campaignOverview);
  const campaignPhasesRecord = getRecord(bodyRecord.campaignPhases);
  const audienceTypesRecord = getRecord(bodyRecord.audienceTypes);
  const creativeStrategyRecord = getRecord(bodyRecord.creativeStrategy);
  const anglesToTestRecord = getRecord(bodyRecord.anglesToTest);
  const creativeFrameworkRecord = getRecord(bodyRecord.creativeFramework);
  const competitorReviewInsightsRecord = getRecord(
    bodyRecord.competitorReviewInsights,
  );
  const competitorMarketingInsightsRecord = getRecord(
    bodyRecord.competitorMarketingInsights,
  );
  const funnelIdeationRecord = getRecord(bodyRecord.funnelIdeation);
  const salesProcessRecord = getRecord(bodyRecord.salesProcess);
  const channelSuggestionsRecord = getRecord(bodyRecord.channelSuggestions);
  const kpisRecord = getRecord(bodyRecord.kpis);

  return {
    ...outputRecord,
    sources: normalizeStructuredRecordArray({
      allowedKeys: ["title", "url", "publisher"],
      stringKeys: ["title", "url", "publisher"],
      value: outputRecord.sources,
    }),
    body: {
      ...bodyRecord,
      ...(campaignOverviewRecord === null
        ? {}
        : {
            campaignOverview: withPaidMediaMoneyProvenanceDefaults(
              normalizeStructuredRecord({
                allowedKeys: [
                  "prose",
                  "monthlyBudget",
                  "monthlyBudgetValue",
                  "monthlyBudgetProvenance",
                  "totalMonths",
                  "phaseCount",
                  "dailySpend",
                  "dailySpendValue",
                  "dailySpendProvenance",
                  "primaryKpi",
                  "platform",
                ],
                numberKeys: [
                  "monthlyBudgetValue",
                  "totalMonths",
                  "phaseCount",
                  "dailySpendValue",
                ],
                record: campaignOverviewRecord,
                stringKeys: [
                  "prose",
                  "monthlyBudget",
                  "monthlyBudgetProvenance",
                  "dailySpend",
                  "dailySpendProvenance",
                  "primaryKpi",
                  "platform",
                ],
              }),
              ["monthlyBudgetProvenance", "dailySpendProvenance"],
            ),
          }),
      ...(campaignPhasesRecord === null
        ? {}
        : {
            campaignPhases: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "phases"],
                record: campaignPhasesRecord,
                stringKeys: ["prose"],
              }),
              phases: withPaidMediaMoneyProvenanceDefaultsForRecordArray(
                normalizeStructuredRecordArray({
                  allowedKeys: [
                    "phaseName",
                    "monthsLabel",
                    "monthlyBudget",
                    "monthlyBudgetValue",
                    "monthlyBudgetProvenance",
                    "bullets",
                  ],
                  numberKeys: ["monthlyBudgetValue"],
                  stringKeys: [
                    "phaseName",
                    "monthsLabel",
                    "monthlyBudget",
                    "monthlyBudgetProvenance",
                  ],
                  value: campaignPhasesRecord.phases,
                }),
                ["monthlyBudgetProvenance"],
              ),
            },
          }),
      ...(audienceTypesRecord === null
        ? {}
        : {
            audienceTypes: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "audiences"],
                record: audienceTypesRecord,
                stringKeys: ["prose"],
              }),
              audiences: (() => {
                const normalized = normalizeStructuredRecordArray({
                  allowedKeys: [
                    "slot",
                    "archetype",
                    "dailyBudget",
                    "dailyBudgetValue",
                    "dailyBudgetProvenance",
                    "detail",
                    "sourceSection",
                    "sourceUrl",
                  ],
                  numberKeys: ["dailyBudgetValue"],
                  stringKeys: [
                    "slot",
                    "archetype",
                    "dailyBudget",
                    "dailyBudgetProvenance",
                    "detail",
                    "sourceSection",
                    "sourceUrl",
                  ],
                  value: audienceTypesRecord.audiences,
                });

                return withPaidMediaMoneyProvenanceDefaultsForRecordArray(
                  normalized,
                  ["dailyBudgetProvenance"],
                );
              })(),
            },
          }),
      ...(creativeStrategyRecord === null
        ? {}
        : {
            creativeStrategy: (() => {
              const normalized = normalizeStructuredRecord({
                allowedKeys: [
                  "prose",
                  "staticCount",
                  "videoCount",
                  "totalPerAudience",
                  "angleTypesInMix",
                ],
                numberKeys: ["staticCount", "videoCount", "totalPerAudience"],
                record: creativeStrategyRecord,
                stringArrayKeys: ["angleTypesInMix"],
                stringKeys: ["prose"],
              });

              return {
                ...normalized,
                angleTypesInMix: snapAngleTypesInMix(
                  normalized.angleTypesInMix,
                ),
              };
            })(),
          }),
      ...(anglesToTestRecord === null
        ? {}
        : {
            anglesToTest: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "angles"],
                record: anglesToTestRecord,
                stringKeys: ["prose"],
              }),
              angles: normalizePaidMediaGroundedRecordArray({
                allowedKeys: [
                  "angleName",
                  "primaryText",
                  "supportingLine",
                  "insight",
                  "sourceSection",
                  "sourceUrl",
                ],
                fallbackSourceSection: "positioningVoiceOfCustomer",
                stringKeys: [
                  "angleName",
                  "primaryText",
                  "supportingLine",
                  "insight",
                  "sourceSection",
                  "sourceUrl",
                ],
                value: anglesToTestRecord.angles,
              }),
            },
          }),
      ...(creativeFrameworkRecord === null
        ? {}
        : {
            creativeFramework: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "creatives"],
                record: creativeFrameworkRecord,
                stringKeys: ["prose"],
              }),
              creatives: (() => {
                const normalized = normalizePaidMediaGroundedRecordArray({
                  allowedKeys: [
                    "creativeType",
                    "uspSentence",
                    "problem",
                    "solution",
                    "transformation",
                    "objection",
                    "objectionAnswer",
                    "founderScriptBeat",
                    "sourceSection",
                    "sourceUrl",
                  ],
                  fallbackSourceSection: "positioningOfferDiagnostic",
                  stringKeys: [
                    "creativeType",
                    "uspSentence",
                    "problem",
                    "solution",
                    "transformation",
                    "objection",
                    "objectionAnswer",
                    "founderScriptBeat",
                    "sourceSection",
                    "sourceUrl",
                  ],
                  value: creativeFrameworkRecord.creatives,
                });

                if (!Array.isArray(normalized)) {
                  return normalized;
                }

                return normalized.map((creative) => {
                  const creativeRecord = getRecord(creative);
                  return creativeRecord === null
                    ? creative
                    : {
                        ...creativeRecord,
                        creativeType: snapCreativeType(
                          creativeRecord.creativeType,
                        ),
                      };
                });
              })(),
            },
          }),
      ...(competitorReviewInsightsRecord === null
        ? {}
        : {
            competitorReviewInsights: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "insights"],
                record: competitorReviewInsightsRecord,
                stringKeys: ["prose"],
              }),
              insights: normalizePaidMediaGroundedRecordArray({
                allowedKeys: [
                  "competitor",
                  "verbatimComplaint",
                  "adLeverage",
                  "sourceSection",
                  "sourceUrl",
                ],
                fallbackSourceSection: "positioningCompetitorLandscape",
                stringKeys: [
                  "competitor",
                  "verbatimComplaint",
                  "adLeverage",
                  "sourceSection",
                  "sourceUrl",
                ],
                value: competitorReviewInsightsRecord.insights,
              }),
            },
          }),
      ...(competitorMarketingInsightsRecord === null
        ? {}
        : {
            competitorMarketingInsights: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "competitors"],
                record: competitorMarketingInsightsRecord,
                stringKeys: ["prose"],
              }),
              competitors: (() => {
                const normalized = normalizePaidMediaGroundedRecordArray({
                  allowedKeys: [
                    "competitor",
                    "messaging",
                    "adPlatforms",
                    "estSpend",
                    "estSpendProvenance",
                    "icpTargeted",
                    "anglesTested",
                    "positioningClaim",
                    "offer",
                    "sourceSection",
                    "sourceUrl",
                  ],
                  fallbackSourceSection: "positioningCompetitorLandscape",
                  stringArrayKeys: ["adPlatforms"],
                  stringKeys: [
                    "competitor",
                    "messaging",
                    "estSpend",
                    "estSpendProvenance",
                    "icpTargeted",
                    "anglesTested",
                    "positioningClaim",
                    "offer",
                    "sourceSection",
                    "sourceUrl",
                  ],
                  value: competitorMarketingInsightsRecord.competitors,
                });

                return withPaidMediaMoneyProvenanceDefaultsForRecordArray(
                  normalized,
                  ["estSpendProvenance"],
                );
              })(),
            },
          }),
      ...(funnelIdeationRecord === null
        ? {}
        : {
            funnelIdeation: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "recommendations"],
                record: funnelIdeationRecord,
                stringKeys: ["prose"],
              }),
              recommendations: normalizePaidMediaGroundedRecordArray({
                allowedKeys: [
                  "funnelType",
                  "recommendation",
                  "optInToBookedCall",
                  "sourceSection",
                ],
                fallbackSourceSection: "positioningOfferDiagnostic",
                stringKeys: [
                  "funnelType",
                  "recommendation",
                  "optInToBookedCall",
                  "sourceSection",
                ],
                value: funnelIdeationRecord.recommendations,
              }),
            },
          }),
      ...(salesProcessRecord === null
        ? {}
        : {
            salesProcess: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "assets"],
                record: salesProcessRecord,
                stringKeys: ["prose"],
              }),
              assets: normalizeStructuredRecordArray({
                allowedKeys: ["label", "url", "assetType"],
                stringKeys: ["label", "url", "assetType"],
                value: salesProcessRecord.assets,
              }),
            },
          }),
      ...(channelSuggestionsRecord === null
        ? {}
        : {
            channelSuggestions: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "suggestions"],
                record: channelSuggestionsRecord,
                stringKeys: ["prose"],
              }),
              suggestions: normalizePaidMediaGroundedRecordArray({
                allowedKeys: [
                  "channel",
                  "observation",
                  "recommendation",
                  "verdict",
                  "sourceSection",
                ],
                fallbackSourceSection: "positioningDemandIntent",
                stringKeys: [
                  "channel",
                  "observation",
                  "recommendation",
                  "verdict",
                  "sourceSection",
                ],
                value: channelSuggestionsRecord.suggestions,
              }),
            },
          }),
      ...(kpisRecord === null
        ? {}
        : {
            kpis: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "gtmMotion", "kpis"],
                record: kpisRecord,
                stringKeys: ["prose", "gtmMotion"],
              }),
              kpis: normalizeStructuredRecordArray({
                allowedKeys: ["metric", "role", "definition"],
                stringKeys: ["metric", "role", "definition"],
                value: kpisRecord.kpis,
              }),
            },
          }),
    },
  };
}

function withNormalizedPositioningSynthesisOutput(rawOutput: unknown): unknown {
  const outputRecord = getRecord(rawOutput);

  if (outputRecord === null) {
    return rawOutput;
  }

  const bodyRecord = getRecord(outputRecord.body);

  if (bodyRecord === null) {
    return rawOutput;
  }

  const situationThesisRecord = getRecord(bodyRecord.situationThesis);
  const positioningOptionsRecord = getRecord(bodyRecord.positioningOptions);
  const recommendedMoveRecord = getRecord(bodyRecord.recommendedMove);
  const messagingDirectionsRecord = getRecord(bodyRecord.messagingDirections);

  return {
    ...outputRecord,
    sources: normalizeStructuredRecordArray({
      allowedKeys: ["title", "url", "publisher"],
      stringKeys: ["title", "url", "publisher"],
      value: outputRecord.sources,
    }),
    body: {
      ...bodyRecord,
      ...(situationThesisRecord === null
        ? {}
        : {
            situationThesis: normalizeStructuredRecord({
              allowedKeys: ["prose"],
              record: situationThesisRecord,
              stringKeys: ["prose"],
            }),
          }),
      ...(positioningOptionsRecord === null
        ? {}
        : {
            positioningOptions: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "options"],
                record: positioningOptionsRecord,
                stringKeys: ["prose"],
              }),
              // Synthesis is the honest-provenance capstone: unlike the
              // paid-media grounded normalizer, do NOT launder a 'gtmBrief'
              // sourceSection into a positioning section. Keep what the model
              // claimed so the validator's non-gtmBrief floor can actually bite
              // (a missing sourceSection still fails the strict parse -> repair).
              options: normalizeStructuredRecordArray({
                allowedKeys: [
                  "optionName",
                  "angle",
                  "rationale",
                  "sourceSection",
                  "sourceUrl",
                ],
                stringKeys: [
                  "optionName",
                  "angle",
                  "rationale",
                  "sourceSection",
                  "sourceUrl",
                ],
                value: positioningOptionsRecord.options,
              }),
            },
          }),
      ...(recommendedMoveRecord === null
        ? {}
        : {
            recommendedMove: normalizeStructuredRecord({
              allowedKeys: ["optionAngle", "rationale", "nextSteps"],
              record: recommendedMoveRecord,
              stringKeys: ["optionAngle", "rationale", "nextSteps"],
            }),
          }),
      ...(messagingDirectionsRecord === null
        ? {}
        : {
            messagingDirections: {
              ...normalizeStructuredRecord({
                allowedKeys: ["prose", "directions"],
                record: messagingDirectionsRecord,
                stringKeys: ["prose"],
              }),
              directions: normalizeStructuredRecordArray({
                allowedKeys: [
                  "direction",
                  "copyPoint",
                  "sourceSection",
                  "sourceUrl",
                ],
                stringKeys: [
                  "direction",
                  "copyPoint",
                  "sourceSection",
                  "sourceUrl",
                ],
                value: messagingDirectionsRecord.directions,
              }),
            },
          }),
    },
  };
}

function withNormalizedSectionOutput({
  normalizedAdEvidenceGroups,
  rawOutput,
  sectionId,
}: {
  rawOutput: unknown;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  sectionId: SectionId;
}): unknown {
  const outputWithAdEvidence = withNormalizedCompetitorAdEvidence({
    normalizedAdEvidenceGroups,
    rawOutput,
  });

  if (sectionId === "positioningBuyerICP") {
    return withNormalizedBuyerICPOutput(outputWithAdEvidence);
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

  if (sectionId === "positioningSynthesis") {
    return withNormalizedPositioningSynthesisOutput(outputWithAdEvidence);
  }

  return outputWithAdEvidence;
}

interface CompetitorAdProbeAdvertiser {
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

function getCompetitorAdProbeAdvertisers(
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

function createToolExecutionOptions({
  signal,
  toolName,
}: {
  toolName: string;
  signal?: AbortSignal;
}): ToolExecutionOptions {
  return {
    abortSignal: signal,
    messages: [],
    toolCallId: `${toolName}_${randomUUID()}`,
  };
}

function createTimeoutSignal({
  parentSignal,
  reasonLabel = "Structured output",
  timeoutMs,
}: {
  parentSignal?: AbortSignal;
  reasonLabel?: string;
  timeoutMs: number;
}): { abort: (reason?: unknown) => void; cleanup: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`${reasonLabel} timed out after ${timeoutMs}ms.`));
  }, timeoutMs);
  const abortFromParent = (): void => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal?.aborted === true) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    abort: (reason?: unknown): void => {
      controller.abort(reason);
    },
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
    signal: controller.signal,
  };
}

function createForwardedAbortSignal(
  parentSignal?: AbortSignal,
): { abort: (reason?: unknown) => void; cleanup: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  const abortFromParent = (): void => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal?.aborted === true) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    abort: (reason?: unknown): void => {
      controller.abort(reason);
    },
    cleanup: () => {
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
    signal: controller.signal,
  };
}

async function withStructuredTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Structured output timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

// Thrown when an answer-tool attempt produces no step before the first-step
// watchdog fires. Distinct from a generic timeout so the caller can retry a
// zero-step stall while still failing fast on real, step-producing errors.
class AnswerToolStalledError extends Error {
  readonly attempt: number;
  readonly timeoutMs: number;

  constructor(attempt: number, timeoutMs: number) {
    super(
      `Answer tool produced no step within ${timeoutMs}ms (attempt ${attempt}).`,
    );
    this.name = "AnswerToolStalledError";
    this.attempt = attempt;
    this.timeoutMs = timeoutMs;
  }
}

// Runs the answer tool with a first-step watchdog layered over the overall
// budget. If an attempt produces no step within the first-step window we
// abandon it WITHOUT awaiting the (possibly never-settling) provider promise,
// emit a retry event, and start a fresh attempt. Once any step has arrived the
// watchdog disarms and the run proceeds under the remaining overall budget, so
// long-but-progressing runs are never killed early.
async function runAnswerToolWithStallGuard({
  onStall,
  onStep,
  params,
  parentSignal,
  runAnswerTool,
}: {
  onStall: (info: {
    attempt: number;
    timeoutMs: number;
  }) => void | Promise<void>;
  onStep: (step: AgentStep) => void;
  params: Omit<Parameters<AnswerToolRunner>[0], "onStepFinish" | "signal">;
  parentSignal?: AbortSignal;
  runAnswerTool: AnswerToolRunner;
}): Promise<Awaited<ReturnType<AnswerToolRunner>>> {
  const overallDeadline = Date.now() + answerToolTimeoutMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= answerToolMaxAttempts; attempt += 1) {
    const remainingMs = overallDeadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    const timeoutSignal = createTimeoutSignal({
      parentSignal,
      reasonLabel: "Answer tool",
      timeoutMs: remainingMs,
    });
    const firstStepDeadlineMs = Math.min(
      getAnswerToolFirstStepTimeoutMs(),
      remainingMs,
    );
    let firstStepSeen = false;
    let attemptActive = true;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;

    const stallPromise = new Promise<never>((_resolve, reject) => {
      stallTimer = setTimeout(() => {
        if (!firstStepSeen) {
          reject(new AnswerToolStalledError(attempt, firstStepDeadlineMs));
        }
      }, firstStepDeadlineMs);
    });

    const runnerPromise = runAnswerTool({
      ...params,
      signal: timeoutSignal.signal,
      onStepFinish: (step) => {
        if (!attemptActive) {
          return;
        }
        firstStepSeen = true;
        onStep(step);
      },
    });

    try {
      return await Promise.race([runnerPromise, stallPromise]);
    } catch (error) {
      lastError = error;
      if (error instanceof AnswerToolStalledError) {
        // Stop counting steps from the abandoned attempt, free its request, and
        // swallow its eventual rejection so it does not surface as unhandled.
        attemptActive = false;
        timeoutSignal.abort(error);
        void runnerPromise.catch(() => undefined);
        if (attempt < answerToolMaxAttempts) {
          await onStall({ attempt, timeoutMs: firstStepDeadlineMs });
          continue;
        }
      }
      throw error;
    } finally {
      if (stallTimer !== undefined) {
        clearTimeout(stallTimer);
      }
      timeoutSignal.cleanup();
    }
  }

  throw (
    lastError ??
    new AnswerToolStalledError(
      answerToolMaxAttempts,
      getAnswerToolFirstStepTimeoutMs(),
    )
  );
}

function hasExecutableTool(
  tools: Record<string, unknown>,
  toolName: string,
): boolean {
  const tool = tools[toolName] as Tool<unknown, unknown> | undefined;
  return tool?.execute !== undefined;
}

function getExecutableTool<TInput>(
  tools: Record<string, unknown>,
  toolName: string,
): Tool<TInput, unknown> {
  const tool = tools[toolName] as Tool<TInput, unknown> | undefined;

  if (tool?.execute === undefined) {
    throw new Error(`Required tool ${toolName} has no execute function.`);
  }

  return tool;
}

async function mapWithBoundedConcurrency<TItem, TResult>({
  concurrency,
  items,
  mapper,
}: {
  concurrency: number;
  items: readonly TItem[];
  mapper: (item: TItem, index: number) => Promise<TResult>;
}): Promise<TResult[]> {
  const boundedConcurrency = Math.max(1, Math.floor(concurrency));
  const batches: TResult[][] = [];

  for (let start = 0; start < items.length; start += boundedConcurrency) {
    const batch = items.slice(start, start + boundedConcurrency);
    batches.push(
      await Promise.all(
        batch.map((item, offset) => mapper(item, start + offset)),
      ),
    );
  }

  return batches.flat();
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
  maxAdvertisers,
  researchInput,
  researchTools,
  signal,
}: {
  // When set, caps how many advertisers the probe covers. The reserved ad
  // budget is the binding constraint, so the caller passes the number of
  // advertisers the reserve can fully fund (google + meta + linkedin each).
  maxAdvertisers?: number;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<AgentStep[]> {
  const allAdvertisers = getCompetitorAdProbeAdvertisers(researchInput);
  const advertisers =
    maxAdvertisers === undefined
      ? allAdvertisers
      : allAdvertisers.slice(0, Math.max(0, maxAdvertisers));
  const hasGoogleAdsTool = hasExecutableTool(researchTools, "google_ads");
  const hasMetaAdsTool = hasExecutableTool(researchTools, "meta_ads");

  if (!hasGoogleAdsTool || !hasMetaAdsTool) {
    const [firstAdvertiser] = advertisers;
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
  modelSteps,
  normalizedAdEvidenceGroups,
  prompt,
  researchInput,
  signal,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  modelSteps: readonly AgentStep[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  prompt: string;
  researchInput: ResearchInput;
  signal?: AbortSignal;
}): Promise<AttemptResult> {
  const callStructured = deps.callStructured ?? defaultStructuredCaller;
  const timeoutSignal = createTimeoutSignal({
    parentSignal: signal,
    timeoutMs: structuredOutputTimeoutMs,
  });

  try {
    const rawOutput = await withStructuredTimeout(
      callStructured({
        model: sectionRunnerModel,
        schema: getStructuredGenerationSchema(definition),
        schemaName: definition.sectionOutputSchemaName,
        schemaDescription: `${definition.title} section output for AI-GOS AI SDK Lab.`,
        prompt,
        maxOutputTokens: getStructuredOutputMaxTokens(definition),
        signal: timeoutSignal.signal,
        telemetry: createLabSectionTelemetry({
          operation: "structured-output",
          runId: input.runId,
          schemaName: definition.sectionOutputSchemaName,
          sectionId: input.sectionId,
        }),
      }),
      structuredOutputTimeoutMs,
    );
    const output = definition.sectionOutputSchema.parse(
      withNormalizedSectionOutput({
        rawOutput,
        normalizedAdEvidenceGroups,
        sectionId: input.sectionId,
      }),
    );
    const verification = verifySectionBody({
      body: output.body,
      evidenceSteps: modelSteps,
      researchInput,
    });
    const evidenceSupportShortfall = evaluateEvidenceSupport({
      verification,
      ...(input.sectionId === "positioningPaidMediaPlan"
        ? { loadBearingKinds: paidMediaLoadBearingKinds }
        : {}),
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
      return {
        output,
        artifact: null,
        errors: minimums.errors,
        voiceOfCustomerEvidenceGapArtifact:
          buildVoiceOfCustomerAttemptEvidenceGapArtifact({
            artifact,
            definition,
            deps,
            errors: minimums.errors,
            input,
            researchInput,
          }),
      };
    }

    const missingClass = checkRequiredEvidenceClasses({
      body: artifact.body,
      requiredEvidenceClasses: definition.requiredEvidenceClasses,
      sectionId: input.sectionId,
    });

    if (missingClass !== null) {
      const failure = new RequiredEvidenceMissingError({
        missingClass,
        sectionId: input.sectionId,
        unsupportedCount: verification.unsupportedCount,
        verifiedCount: verification.verifiedCount,
      });

      return {
        output,
        artifact: null,
        errors: [failure.message],
        requiredEvidenceMissing: failure,
      };
    }

    if (input.sectionId === "positioningVoiceOfCustomer") {
      const selfSourcing = checkVoiceOfCustomerSelfSourcing({
        artifact,
        subjectDomain: researchInput.company.websiteUrl,
      });

      if (!selfSourcing.ok) {
        return {
          output,
          artifact: null,
          errors: selfSourcing.errors,
          voiceOfCustomerEvidenceGapArtifact:
            buildVoiceOfCustomerAttemptEvidenceGapArtifact({
              artifact,
              definition,
              deps,
              errors: selfSourcing.errors,
              input,
              researchInput,
            }),
        };
      }
    }

    return { output, artifact, errors: [], evidenceSupportShortfall };
  } catch (error) {
    return { output: null, artifact: null, errors: getErrorIssues(error) };
  } finally {
    timeoutSignal.cleanup();
  }
}

async function callStructuredStreamAttempt({
  attempt,
  definition,
  deps,
  input,
  modelSteps,
  normalizedAdEvidenceGroups,
  prompt,
  researchInput,
  signal,
}: {
  attempt: number;
  definition: RuntimeSectionDefinition;
  deps: StreamRunSectionDeps;
  input: RunSectionInput;
  modelSteps: readonly AgentStep[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  prompt: string;
  researchInput: ResearchInput;
  signal?: AbortSignal;
}): Promise<AttemptResult> {
  const streamStructured = deps.streamStructured ?? defaultStructuredStreamer;
  const timeoutSignal = createTimeoutSignal({
    parentSignal: signal,
    timeoutMs: structuredOutputTimeoutMs,
  });
  const idleController = new AbortController();
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

  writeValidationEvent({
    attempt,
    deps,
    issues: [],
    runId: input.runId,
    sectionId: input.sectionId,
    state: "started",
  });

  try {
    const structuredStream = streamStructured({
      model: sectionRunnerModel,
      schema: getStructuredGenerationSchema(definition),
      schemaName: definition.sectionOutputSchemaName,
      schemaDescription: `${definition.title} section output for AI-GOS AI SDK Lab.`,
      prompt,
      maxOutputTokens: getStructuredOutputMaxTokens(definition),
      signal: AbortSignal.any([
        timeoutSignal.signal,
        idleController.signal,
      ]),
      telemetry: createLabSectionTelemetry({
        attempt,
        operation: "structured-output-stream",
        runId: input.runId,
        schemaName: definition.sectionOutputSchemaName,
        sectionId: input.sectionId,
      }),
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
        writeArtifactPartial({
          deps,
          partial,
          runId: input.runId,
          sectionId: input.sectionId,
        });
      },
    });
    clearIdleTimer();

    const rawOutput = await withStructuredTimeout(
      Promise.resolve(structuredStream.output),
      structuredOutputTimeoutMs,
    );
    const output = definition.sectionOutputSchema.parse(
      withNormalizedSectionOutput({
        rawOutput,
        normalizedAdEvidenceGroups,
        sectionId: input.sectionId,
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
    const minimums = definition.validateMinimums(artifact);

    if (!minimums.ok) {
      writeValidationEvent({
        attempt,
        deps,
        issues: minimums.errors,
        runId: input.runId,
        sectionId: input.sectionId,
        state: "failed",
      });

      return { output, artifact: null, errors: minimums.errors };
    }

    const missingClass = checkRequiredEvidenceClasses({
      body: artifact.body,
      requiredEvidenceClasses: definition.requiredEvidenceClasses,
      sectionId: input.sectionId,
    });

    if (missingClass !== null) {
      const failure = new RequiredEvidenceMissingError({
        missingClass,
        sectionId: input.sectionId,
        unsupportedCount: verification.unsupportedCount,
        verifiedCount: verification.verifiedCount,
      });

      writeValidationEvent({
        attempt,
        deps,
        issues: [failure.message],
        runId: input.runId,
        sectionId: input.sectionId,
        state: "failed",
      });

      return {
        output,
        artifact: null,
        errors: [failure.message],
        requiredEvidenceMissing: failure,
      };
    }

    if (input.sectionId === "positioningVoiceOfCustomer") {
      const selfSourcing = checkVoiceOfCustomerSelfSourcing({
        artifact,
        subjectDomain: researchInput.company.websiteUrl,
      });

      if (!selfSourcing.ok) {
        return {
          output,
          artifact: null,
          errors: selfSourcing.errors,
          voiceOfCustomerEvidenceGapArtifact:
            buildVoiceOfCustomerAttemptEvidenceGapArtifact({
              artifact,
              definition,
              deps,
              errors: selfSourcing.errors,
              input,
              researchInput,
            }),
        };
      }
    }

    writeValidationEvent({
      attempt,
      deps,
      issues: [],
      runId: input.runId,
      sectionId: input.sectionId,
      state: "passed",
    });

    return { output, artifact, errors: [] };
  } catch (error) {
    const errors = getErrorIssues(error);
    writeValidationEvent({
      attempt,
      deps,
      issues: errors,
      runId: input.runId,
      sectionId: input.sectionId,
      state: "failed",
    });

    return { output: null, artifact: null, errors };
  } finally {
    clearIdleTimer();
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

interface VoiceOfCustomerCandidatePrepass {
  candidateBlock: string;
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
    const candidate = createVoiceOfCustomerCandidate({
      auditedCompanyDomain: researchInput.company.websiteUrl,
      source: "researchInput",
      title: excerpt.title,
      url: excerpt.sourceUrl,
      snippet: excerpt.text,
    });

    return candidate === null ? [] : [candidate];
  });
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
      const reviewText = getStringProperty(itemRecord, "reviewText");
      const title = getStringProperty(itemRecord, "source") ?? "Review excerpt";

      if (url === null) {
        return emptyVoiceOfCustomerCandidateCollection();
      }

      const hasReviewText =
        reviewText !== null && reviewText.trim().length > 0;
      const candidate = hasReviewText
        ? createVoiceOfCustomerCandidate({
            auditedCompanyDomain: researchInput.company.websiteUrl,
            evidenceKind: "review",
            source: "reviews",
            title,
            url,
            snippet: reviewText,
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

function getWebSearchSnippet(itemRecord: Record<string, unknown> | null): string {
  const description = getStringProperty(itemRecord, "description");
  const rawExtraSnippets = itemRecord?.extra_snippets;
  const extraSnippets = Array.isArray(rawExtraSnippets)
    ? rawExtraSnippets.flatMap((snippet: unknown): string[] => {
        if (typeof snippet !== "string") {
          return [];
        }

        const trimmed = snippet.trim();
        return trimmed.length === 0 ? [] : [trimmed];
      })
    : [];

  return Array.from(
    new Set(
      description === null ? extraSnippets : [description, ...extraSnippets],
    ),
  ).join(" ");
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
      const snippet = getWebSearchSnippet(itemRecord);

      if (url === null) {
        return emptyVoiceOfCustomerCandidateCollection();
      }

      const hasSnippet = snippet.trim().length > 0;
      const candidate = hasSnippet
        ? createVoiceOfCustomerCandidate({
            auditedCompanyDomain: researchInput.company.websiteUrl,
            source: "web_search",
            title,
            url,
            snippet,
          })
        : null;
      const recoveryTarget = hasSnippet
        ? null
        : createVoiceOfCustomerRecoveryTarget({
            auditedCompanyDomain: researchInput.company.websiteUrl,
            source: "web_search",
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
  const domainExclusion =
    subjectDomain === null ? "" : ` -site:${subjectDomain}`;

  return `${brand} customer reviews complaints pain points reddit forum G2 Capterra Trustpilot${domainExclusion}`;
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

  const reviewOutput = await tryTool("reviews", {
    brand: researchInput.company.name,
    max_results: VOC_CANDIDATE_PACK_MAX_SIZE,
    mode: "bodies",
  });
  const reviewCandidates = buildReviewVoiceOfCustomerCandidates({
    output: reviewOutput,
    researchInput,
  });
  candidates.push(...reviewCandidates.candidates);
  recoveryTargets.push(...reviewCandidates.recoveryTargets);

  const webSearchOutput = await tryTool("web_search", {
    q: buildVoiceOfCustomerSearchQuery(researchInput, subjectDomain),
    count: VOC_CANDIDATE_PACK_MAX_SIZE,
    country: "US",
  });
  const webSearchCandidates = buildWebSearchVoiceOfCustomerCandidates({
    output: webSearchOutput,
    researchInput,
  });
  candidates.push(...webSearchCandidates.candidates);
  recoveryTargets.push(...webSearchCandidates.recoveryTargets);

  let result = selectVoiceOfCustomerCandidates(candidates);
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

  const events = steps.flatMap((step) =>
    buildToolEvents({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      step,
    }),
  );

  return {
    candidateBlock: formatVoiceOfCustomerCandidateBlock(result),
    events,
    result,
    steps,
    subjectDomain,
  };
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

/**
 * True iff some model step's toolResults includes a SUCCESSFUL keyword_volume
 * call (SpyFu). The tool returns a discriminated union: success is
 * `{ type: 'result', source: 'SpyFu', ... }`, a gap (e.g. rate-limited) is
 * `{ type: 'gap', ... }`. Drives checkDemandIntentKeywordProvenance so the
 * model cannot claim SpyFu provenance when the tool failed.
 */
export function keywordVolumeSucceeded(modelSteps: readonly AgentStep[]): boolean {
  return modelSteps.some((step) =>
    step.toolResults.some(
      (toolResult) =>
        toolResult.toolName === "keyword_volume" &&
        typeof toolResult.output === "object" &&
        toolResult.output !== null &&
        (toolResult.output as { type?: unknown }).type === "result",
    ),
  );
}

async function buildVerifiedAttemptFromOutput({
  definition,
  deps,
  input,
  modelSteps,
  output,
  researchInput,
  verifierSteps,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  modelSteps: readonly AgentStep[];
  output: SectionOutput<Record<string, unknown>>;
  researchInput: ResearchInput;
  verifierSteps?: readonly AgentStep[];
}): Promise<AttemptResult> {
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
  const minimums = definition.validateMinimums(artifact);

  if (!minimums.ok) {
    return {
      output,
      artifact: null,
      errors: minimums.errors,
      voiceOfCustomerEvidenceGapArtifact:
        buildVoiceOfCustomerAttemptEvidenceGapArtifact({
          artifact,
          definition,
          deps,
          errors: minimums.errors,
          input,
          researchInput,
        }),
    };
  }

  const missingClass = checkRequiredEvidenceClasses({
    body: artifact.body,
    requiredEvidenceClasses: definition.requiredEvidenceClasses,
    sectionId: input.sectionId,
  });

  if (missingClass !== null) {
    const failure = new RequiredEvidenceMissingError({
      missingClass,
      sectionId: input.sectionId,
      unsupportedCount: verification.unsupportedCount,
      verifiedCount: verification.verifiedCount,
    });

    return {
      output,
      artifact: null,
      errors: [failure.message],
      requiredEvidenceMissing: failure,
    };
  }

  if (input.sectionId === "positioningVoiceOfCustomer") {
    const selfSourcing = checkVoiceOfCustomerSelfSourcing({
      artifact,
      subjectDomain: researchInput.company.websiteUrl,
    });

    if (!selfSourcing.ok) {
      return {
        output,
        artifact: null,
        errors: selfSourcing.errors,
        voiceOfCustomerEvidenceGapArtifact:
          buildVoiceOfCustomerAttemptEvidenceGapArtifact({
            artifact,
            definition,
            deps,
            errors: selfSourcing.errors,
            input,
            researchInput,
          }),
      };
    }
  }

  if (input.sectionId === "positioningDemandIntent") {
    const provenance = checkDemandIntentKeywordProvenance({
      artifact,
      keywordVolumeSucceeded: keywordVolumeSucceeded(modelSteps),
    });

    if (!provenance.ok) {
      return { output, artifact: null, errors: provenance.errors };
    }
  }

  const evidenceSupportShortfall = evaluateEvidenceSupport({
    verification,
    ...(input.sectionId === "positioningVoiceOfCustomer"
      ? { loadBearingKinds: voiceOfCustomerLoadBearingKinds }
      : {}),
  });

  if (evidenceSupportShortfall.unsupportedLoadBearing.length > 0) {
    return {
      output,
      artifact,
      errors: [],
      evidenceSupportShortfall,
    };
  }

  return { output, artifact, errors: [] };
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
}: {
  body: unknown;
  definition: RuntimeSectionDefinition;
  input: RunSectionInput;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
}): SectionOutput<Record<string, unknown>> {
  const structuredRecord = getRecord(body);
  const parsedBody = definition.bodySchema.parse(
    structuredRecord?.body ?? body,
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
  modelSteps: AgentStep[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  partialSeqRef: SectionPartialSeqRef;
  prompt: string;
  researchInput: ResearchInput;
  scheduleFlush: () => Promise<void>;
  toolEvents: ActivityEvent[];
}): Promise<AttemptResult> {
  const streamStructured = deps.streamStructured ?? defaultStructuredStreamer;
  const timeoutSignal = createTimeoutSignal({
    parentSignal: input.signal,
    timeoutMs: structuredOutputTimeoutMs,
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
      model: sectionRunnerModel,
      schema: structuredDraftSchema,
      schemaName: `${definition.sectionOutputSchemaName}Body`,
      schemaDescription: `${definition.title} section body for AI-GOS AI SDK Lab.`,
      prompt,
      tools: externalTools,
      maxStepCount: answerToolMaxStepCount,
      maxOutputTokens: getStructuredOutputMaxTokens(definition),
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

    const body = await withStructuredTimeout(
      Promise.resolve(structuredStream.output),
      structuredOutputTimeoutMs,
    );
    const output = buildOutputFromStructuredBody({
      body,
      definition,
      input,
      normalizedAdEvidenceGroups,
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
    ...answerResult.steps,
  ];
  let normalizedAdEvidenceGroups = buildMergedAnswerToolAdEvidenceGroups({
    deps,
    input,
    modelSteps: answerResultSteps,
    prepassGroups: adEvidence.normalizedAdEvidenceGroups,
    researchInput,
  });

  let attempt = await buildAnswerToolAttempt({
    adProbeSteps: adEvidence.adProbeSteps,
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
      input.signal?.aborted !== true
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
        adProbeSteps: adEvidence.adProbeSteps,
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

    if (bestCommittableAttempt !== null) {
      attempt = bestCommittableAttempt;
    }

    if (
      attempt.artifact === null &&
      attempt.voiceOfCustomerEvidenceGapArtifact !== undefined &&
      input.signal?.aborted !== true
    ) {
      attempt = {
        ...attempt,
        artifact: attempt.voiceOfCustomerEvidenceGapArtifact,
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

  const modelSteps: AgentStep[] = [...(voiceOfCustomerPrepass?.steps ?? [])];
  let normalizedAdEvidenceGroups = adEvidence.normalizedAdEvidenceGroups;
  let validationAttempt = 1;
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
    prompt: buildStructuredBodyPrompt({
      definition,
      externalToolNames,
      normalizedAdEvidenceGroups,
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
    prepassGroups: adEvidence.normalizedAdEvidenceGroups,
    researchInput,
  });
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
      input.signal?.aborted !== true
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

      if (hasTerminalStructuredError(repairIssues)) {
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
        adProbeSteps: adEvidence.adProbeSteps,
        attempt: validationAttempt,
        definition,
        deps,
        externalTools,
        input,
        modelSteps,
        normalizedAdEvidenceGroups,
        partialSeqRef,
        prompt: buildStructuredBodyRepairPrompt({
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

    if (bestCommittableAttempt !== null) {
      attempt = bestCommittableAttempt;
    }

    if (
      attempt.artifact === null &&
      attempt.voiceOfCustomerEvidenceGapArtifact !== undefined &&
      input.signal?.aborted !== true
    ) {
      attempt = {
        ...attempt,
        artifact: attempt.voiceOfCustomerEvidenceGapArtifact,
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

// UNUSED-in-production: dead partial-streaming path. Sections commit atomically via the
// answer-tool path (runSection); do not revive without deliberately rewiring the dispatch.
async function streamSectionViaAnswerTool(
  input: RunSectionInput,
  deps: StreamRunSectionDeps,
): Promise<RunSectionResult> {
  const definition = getRuntimeSectionDefinition(input.sectionId);
  const startedAt = getNow(deps).getTime();
  const record = await deps.store.readRun(input.runId);
  const researchInput: ResearchInput = record.input;

  writeSectionStatus({
    deps,
    message: `${definition.title} starting`,
    runId: input.runId,
    sectionId: input.sectionId,
    status: "starting",
  });
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
  writeSectionStatus({
    deps,
    message: `${definition.title} running`,
    runId: input.runId,
    sectionId: input.sectionId,
    status: "running",
  });

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
  const toolBudget = new ToolBudget(definition.maxExternalLookups);
  const externalTools = buildToolMap(getAllowedTools(definition, deps), {
    budget: toolBudget,
    webSearchMaxUses: definition.maxExternalLookups,
  });
  const externalToolNames = getExternalToolNames(externalTools);
  const adEvidence = await buildAnswerToolAdEvidence({
    deps,
    input,
    researchInput,
    researchTools: externalTools,
  });
  toolEvents.push(...adEvidence.events);
  writeToolEvents({ deps, events: adEvidence.events });
  const streamAnswerTool =
    deps.streamAnswerTool ?? defaultAnswerToolStreamer;
  let answerResult: Awaited<ReturnType<AnswerToolStreamer>>;
  let appendedEventCount = 0;
  const flushBufferedEvents = async (): Promise<void> => {
    while (appendedEventCount < toolEvents.length) {
      await appendEvent(deps, input.runId, toolEvents[appendedEventCount]);
      appendedEventCount += 1;
    }
  };

  try {
    answerResult = await runAnswerToolWithStallGuard({
      runAnswerTool: streamAnswerTool,
      parentSignal: input.signal,
      params: {
        model: sectionRunnerModel,
        instructions: [
          buildAnswerToolInstructions(
            definition,
            researchInput,
            adEvidence.normalizedAdEvidenceGroups,
            {
              externalToolNames,
              inputSchemaMode:
                getAnswerToolInputSchemaMode(sectionRunnerModel),
            },
          ),
          "",
          "Skill analyst guidance:",
          skillMd,
          buildSectionObjectiveRecap(definition, researchInput),
        ].join("\n"),
        prompt: buildAnswerToolPrompt({ externalToolNames, input }),
        externalTools,
        answerTool: createAnswerTool(definition.sectionOutputSchema, {
          model: sectionRunnerModel,
        }),
        maxStepCount: answerToolMaxStepCount,
        maxOutputTokens: getStructuredOutputMaxTokens(definition),
        telemetry: createLabSectionTelemetry({
          operation: "answer-tool-stream",
          runId: input.runId,
          sectionId: input.sectionId,
        }),
      },
      onStep: (step) => {
        const events = buildToolEvents({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          step,
        });
        toolEvents.push(...events);
        writeToolEvents({ deps, events });
      },
      onStall: async ({ attempt, timeoutMs }) => {
        await flushBufferedEvents();
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
        await flushBufferedEvents();
      },
    });
  } catch (error) {
    writeSectionStatus({
      deps,
      message: getErrorIssues(error).join("; "),
      runId: input.runId,
      sectionId: input.sectionId,
      status: "failed",
    });
    await recordSectionFailure({
      definition,
      deps,
      errorMessage: getErrorIssues(error).join("; "),
      input,
    });
    throw error;
  }

  await flushBufferedEvents();
  const normalizedAdEvidenceGroups = buildMergedAnswerToolAdEvidenceGroups({
    deps,
    input,
    modelSteps: answerResult.steps,
    prepassGroups: adEvidence.normalizedAdEvidenceGroups,
    researchInput,
  });

  writeSectionStatus({
    deps,
    message: "Answer tool output validating",
    runId: input.runId,
    sectionId: input.sectionId,
    status: "validating",
  });
  writeValidationEvent({
    attempt: 1,
    deps,
    issues: [],
    runId: input.runId,
    sectionId: input.sectionId,
    state: "started",
  });

  const attempt = await buildAnswerToolAttempt({
    adProbeSteps: adEvidence.adProbeSteps,
    answerInput: answerResult.answerInput,
    definition,
    deps,
    input,
    modelSteps: answerResult.steps,
    normalizedAdEvidenceGroups,
    researchInput,
  });

  if (attempt.artifact === null) {
    writeValidationEvent({
      attempt: 1,
      deps,
      issues: attempt.errors,
      runId: input.runId,
      sectionId: input.sectionId,
      state: "failed",
    });
    writeSectionStatus({
      deps,
      message: attempt.errors.join("; "),
      runId: input.runId,
      sectionId: input.sectionId,
      status: "failed",
    });
    await appendEvent(
      deps,
      input.runId,
      createEvent({
        deps,
        runId: input.runId,
        sectionId: input.sectionId,
        type: "validation-failed",
        message: "Answer tool output failed validation",
        metadata: { attempt: 1, issues: attempt.errors },
      }),
    );
    await recordSectionFailure({
      definition,
      deps,
      errorMessage: attempt.errors.join("; "),
      failure: attempt.requiredEvidenceMissing,
      input,
    });

    if (attempt.requiredEvidenceMissing !== undefined) {
      throw attempt.requiredEvidenceMissing;
    }

    throw new SectionRunnerError({
      runId: input.runId,
      sectionId: input.sectionId,
      errors: attempt.errors,
    });
  }

  writeValidationEvent({
    attempt: 1,
    deps,
    issues: [],
    runId: input.runId,
    sectionId: input.sectionId,
    state: "passed",
  });
  await appendSubSectionCommittedEvents({
    artifact: attempt.artifact,
    deps,
    input,
  });
  await deps.store.saveArtifact(input.runId, attempt.artifact);
  await appendEvent(
    deps,
    input.runId,
    createEvent({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      type: "artifact-saved",
      message: `${definition.title} artifact saved`,
      metadata: { artifactId: attempt.artifact.id },
    }),
  );
  writeArtifactFinal({
    artifactId: attempt.artifact.id,
    deps,
    runId: input.runId,
    sectionId: input.sectionId,
  });
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
  writeSectionStatus({
    deps,
    message: `${definition.title} completed`,
    runId: input.runId,
    sectionId: input.sectionId,
    status: "completed",
  });

  return {
    runId: input.runId,
    sectionId: input.sectionId,
    artifact: attempt.artifact,
  };
}

// UNUSED-in-production: dead partial-streaming entrypoint. Sections commit atomically via the
// answer-tool path (runSection); do not revive without deliberately rewiring the dispatch.
export async function streamRunSection(
  input: RunSectionInput,
  deps: StreamRunSectionDeps,
): Promise<RunSectionResult> {
  if (!isSupportedSectionId(input.sectionId)) {
    throw new Error(`Unsupported sectionId ${input.sectionId}`);
  }

  if (answerToolSectionIds.has(input.sectionId)) {
    return streamSectionViaAnswerTool(input, deps);
  }

  const definition = getRuntimeSectionDefinition(input.sectionId);
  const startedAt = getNow(deps).getTime();
  const record = await deps.store.readRun(input.runId);
  const researchInput: ResearchInput = record.input;

  writeSectionStatus({
    deps,
    message: `${definition.title} starting`,
    runId: input.runId,
    sectionId: input.sectionId,
    status: "starting",
  });
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
  writeSectionStatus({
    deps,
    message: `${definition.title} running`,
    runId: input.runId,
    sectionId: input.sectionId,
    status: "running",
  });

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
  const streamEvidencePass =
    deps.streamEvidencePass ?? defaultEvidenceStreamRunner;
  const toolBudget = new ToolBudget(definition.maxExternalLookups);
  const researchTools = buildToolMap(getAllowedTools(definition, deps), {
    budget: toolBudget,
    webSearchMaxUses: definition.maxExternalLookups,
  });
  const fixtureTools = createFixtureTools({
    store: deps.store,
    expectedRunId: input.runId,
  });
  let evidenceResult: Awaited<ReturnType<EvidenceStreamRunner>>;

  try {
    evidenceResult = await streamEvidencePass({
      model: sectionRunnerModel,
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
        operation: "evidence-pass-stream",
        runId: input.runId,
        sectionId: input.sectionId,
      }),
      onStepFinish: (step) => {
        const events = buildToolEvents({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          step,
        });
        toolEvents.push(...events);
        writeToolEvents({ deps, events });
      },
    });
  } catch (error) {
    writeSectionStatus({
      deps,
      message: getErrorIssues(error).join("; "),
      runId: input.runId,
      sectionId: input.sectionId,
      status: "failed",
    });
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
    const events = buildToolEvents({
      deps,
      runId: input.runId,
      sectionId: input.sectionId,
      step: adProbeStep,
    });
    toolEvents.push(...events);
    writeToolEvents({ deps, events });
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
  writeSectionStatus({
    deps,
    message: "Structured output validating",
    runId: input.runId,
    sectionId: input.sectionId,
    status: "validating",
  });

  const firstAttempt = await callStructuredStreamAttempt({
    attempt: 1,
    definition,
    deps,
    input,
    modelSteps: evidenceSteps,
    normalizedAdEvidenceGroups,
    prompt: structuredPrompt,
    researchInput,
    signal: input.signal,
  });
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

    if (hasTerminalStructuredError(firstAttempt.errors)) {
      writeSectionStatus({
        deps,
        message: firstAttempt.errors.join("; "),
        runId: input.runId,
        sectionId: input.sectionId,
        status: "failed",
      });
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

    writeSectionStatus({
      deps,
      message: "Repair attempt started",
      runId: input.runId,
      sectionId: input.sectionId,
      status: "repairing",
    });
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

    const repairAttempt = await callStructuredStreamAttempt({
      attempt: 2,
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

    artifact = repairAttempt.artifact;

    if (artifact === null) {
      writeSectionStatus({
        deps,
        message: repairAttempt.errors.join("; "),
        runId: input.runId,
        sectionId: input.sectionId,
        status: "failed",
      });
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
  writeArtifactFinal({
    artifactId: artifact.id,
    deps,
    runId: input.runId,
    sectionId: input.sectionId,
  });
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
  writeSectionStatus({
    deps,
    message: `${definition.title} completed`,
    runId: input.runId,
    sectionId: input.sectionId,
    status: "completed",
  });

  return {
    runId: input.runId,
    sectionId: input.sectionId,
    artifact,
  };
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
      model: sectionRunnerModel,
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
