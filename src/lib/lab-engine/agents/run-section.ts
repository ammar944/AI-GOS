import { randomUUID } from "node:crypto";

import type { Tool, ToolExecutionOptions } from "ai";
import type { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
  type ResearchInput,
} from "../artifacts/artifact-envelope";
import type { CompetitorAdEvidenceGroup } from "../artifacts/schemas/competitor-landscape";
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
import { getSectionSubSections } from "../sections/sub-sections";
import type { RunStore } from "../runs/run-store";
import {
  buildAnswerToolInstructions,
  buildEvidenceTranscript,
  buildRepairPrompt,
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
import { ToolBudget } from "./budget";
import { buildToolMap } from "./tool-registry";
import { ToolGapSchema, type ToolGap } from "./tools/_shared";
import {
  buildCompetitorAdEvidenceGroups,
  summarizeCompetitorAdEvidenceGroups,
} from "./tools/competitor-ad-adapter";
import type { ToolName } from "./tools/index";
import type { RunSectionStreamWriter } from "../streaming/run-section-ui-message";

export interface RunSectionInput {
  runId: string;
  sectionId: SupportedSectionId;
  signal?: AbortSignal;
}

export interface RunSectionDeps {
  store: RunStore;
  loadSkill: (slug: string) => Promise<string>;
  allowedTools?: readonly ToolName[];
  runAnswerTool?: AnswerToolRunner;
  runEvidencePass?: EvidencePassRunner;
  callStructured?: StructuredCaller;
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
  streamStructured?: StructuredStreamer;
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
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  output: SectionOutput<Record<string, unknown>>;
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
      confidence: output.confidence,
      sources: output.sources.map((source, index) => ({
        id: deriveSourceId(source.url, index),
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        observedAt,
      })),
      body: output.body,
      createdAt: observedAt,
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
    events.push(
      createEvent({
        deps,
        runId,
        sectionId,
        type: "tool-started",
        message: `${toolCall.toolName} started`,
        metadata: { toolName: toolCall.toolName },
      }),
    );
  }

  for (const toolResult of step.toolResults) {
    const gap = parseToolGap(toolResult.output);
    const metadata =
      gap === null
        ? {
            toolName: toolResult.toolName,
            outputSummary: shortenForEvent(toolResult.output),
          }
        : {
            toolName: toolResult.toolName,
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

  if (allowedTools.includes("spyfu")) {
    toolSequence.push("spyfu");
  }

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
  input,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  errorMessage: string;
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
      metadata: { error: errorMessage },
    }),
  );
  await markSectionFailed({
    deps,
    errorMessage,
    runId: input.runId,
    sectionId: input.sectionId,
  });
}

interface AttemptResult {
  output: SectionOutput<Record<string, unknown>> | null;
  artifact: ArtifactEnvelope | null;
  errors: string[];
}

const defaultStructuredOutputMaxTokens = 8192;
// Must fire well under undici's default headersTimeout (~5 min) so the
// server records a terminal failure before the verifier's fetch dies and
// abandons the run record in `running` state.
const structuredOutputTimeoutMs = 240_000;
// Must fire well under the /start route's maxDuration so the server appends a
// terminal failure event before the platform kills the request.
const answerToolTimeoutMs = 540_000;
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
const competitorAdProbeMaxResults = 4;
const answerToolMaxStepCount = 12;
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

  return outputWithAdEvidence;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function getCompetitorAdProbeAdvertisers(
  researchInput: ResearchInput,
): readonly string[] {
  return uniqueStrings(
    researchInput.competitorAds.map((ad) => ad.competitorName.trim()),
  )
    .filter((name) => name.length > 0)
    .slice(0, competitorAdProbeAdvertiserLimit);
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

async function runCompetitorAdProbeSteps({
  researchInput,
  researchTools,
  signal,
}: {
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<AgentStep[]> {
  const advertisers = getCompetitorAdProbeAdvertisers(researchInput);

  if (
    !hasExecutableTool(researchTools, "google_ads") ||
    !hasExecutableTool(researchTools, "meta_ads")
  ) {
    return [];
  }

  const googleAdsTool = getExecutableTool<{
    advertiser: string;
    max_results: number;
  }>(researchTools, "google_ads");
  const metaAdsTool = getExecutableTool<{
    advertiser: string;
    max_results: number;
  }>(researchTools, "meta_ads");
  const steps: AgentStep[] = [];

  for (const [index, advertiser] of advertisers.entries()) {
    const googleInput = {
      advertiser,
      max_results: competitorAdProbeMaxResults,
    };
    const metaInput = {
      advertiser,
      max_results: competitorAdProbeMaxResults,
    };
    const [googleOutput, metaOutput] = await Promise.all([
      googleAdsTool.execute?.(
        googleInput,
        createToolExecutionOptions({ signal, toolName: "google_ads" }),
      ),
      metaAdsTool.execute?.(
        metaInput,
        createToolExecutionOptions({ signal, toolName: "meta_ads" }),
      ),
    ]);

    steps.push({
      stepNumber: index,
      finishReason: "tool-calls",
      text: `Deterministic competitor ad evidence probe for ${advertiser}.`,
      toolCalls: [
        { toolName: "google_ads", input: googleInput },
        { toolName: "meta_ads", input: metaInput },
      ],
      toolResults: [
        { toolName: "google_ads", output: googleOutput },
        { toolName: "meta_ads", output: metaOutput },
      ],
    });
  }

  return steps;
}

async function callStructuredAttempt({
  definition,
  deps,
  input,
  normalizedAdEvidenceGroups,
  prompt,
  signal,
}: {
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  prompt: string;
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
        schema: definition.sectionOutputSchema,
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
    const artifact = buildEnvelope({
      definition,
      deps,
      input,
      output,
    });
    const minimums = definition.validateMinimums(artifact);

    if (!minimums.ok) {
      return { output, artifact: null, errors: minimums.errors };
    }

    return { output, artifact, errors: [] };
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
  normalizedAdEvidenceGroups,
  prompt,
  signal,
}: {
  attempt: number;
  definition: RuntimeSectionDefinition;
  deps: StreamRunSectionDeps;
  input: RunSectionInput;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
  prompt: string;
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
      schema: definition.sectionOutputSchema,
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
    const artifact = buildEnvelope({
      definition,
      deps,
      input,
      output,
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
  researchInput,
  researchTools,
}: {
  deps: RunSectionDeps;
  input: RunSectionInput;
  researchInput: ResearchInput;
  researchTools: Record<string, unknown>;
}): Promise<{
  events: ActivityEvent[];
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
}> {
  if (input.sectionId !== "positioningCompetitorLandscape") {
    return { events: [] };
  }

  const adProbeSteps = await runCompetitorAdProbeSteps({
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
  });

  return { events, normalizedAdEvidenceGroups };
}

function buildAnswerToolAttempt({
  answerInput,
  definition,
  deps,
  input,
  normalizedAdEvidenceGroups,
}: {
  answerInput: unknown | undefined;
  definition: RuntimeSectionDefinition;
  deps: RunSectionDeps;
  input: RunSectionInput;
  normalizedAdEvidenceGroups?: readonly CompetitorAdEvidenceGroup[];
}): AttemptResult {
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
    const artifact = buildEnvelope({
      definition,
      deps,
      input,
      output,
    });
    const minimums = definition.validateMinimums(artifact);

    if (!minimums.ok) {
      return { output, artifact: null, errors: minimums.errors };
    }

    return { output, artifact, errors: [] };
  } catch (error) {
    return { output: null, artifact: null, errors: getErrorIssues(error) };
  }
}

async function runSectionViaAnswerTool(
  input: RunSectionInput,
  deps: RunSectionDeps,
): Promise<RunSectionResult> {
  const definition = getRuntimeSectionDefinition(input.sectionId);
  const startedAt = getNow(deps).getTime();
  const record = await deps.store.readRun(input.runId);
  const researchInput: ResearchInput = record.input;

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
  const runAnswerTool = deps.runAnswerTool ?? defaultAnswerToolRunner;
  let appendedEventCount = 0;
  const flushBufferedEvents = async (): Promise<void> => {
    while (appendedEventCount < toolEvents.length) {
      await appendEvent(deps, input.runId, toolEvents[appendedEventCount]);
      appendedEventCount += 1;
    }
  };
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
    "",
    "Skill analyst guidance:",
    skillMd,
  ].join("\n");
  const answerTool = createAnswerTool(definition.sectionOutputSchema, {
    model: sectionRunnerModel,
  });
  const runAnswerToolAttempt = async ({
    attempt,
    prompt,
  }: {
    attempt: number;
    prompt: string;
  }): Promise<Awaited<ReturnType<AnswerToolRunner>>> =>
    runAnswerToolWithStallGuard({
      runAnswerTool,
      parentSignal: input.signal,
      params: {
        model: sectionRunnerModel,
        instructions: answerToolInstructions,
        prompt,
        externalTools,
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
      },
      onStall: async ({ attempt, timeoutMs }) => {
        // Persist progress immediately so the run record never sits frozen at
        // skill-loaded while a stalled attempt is being abandoned and retried.
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

  await flushBufferedEvents();

  let attempt = buildAnswerToolAttempt({
    answerInput: answerResult.answerInput,
    definition,
    deps,
    input,
    normalizedAdEvidenceGroups: adEvidence.normalizedAdEvidenceGroups,
  });

  if (attempt.artifact === null) {
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
          reason: attempt.errors.join("; ").slice(0, 200),
        },
      }),
    );

    const repairResult = await runAnswerToolAttempt({
      attempt: 2,
      prompt: buildRepairPrompt({
        definition,
        evidenceTranscript: "",
        issues: attempt.errors,
        normalizedAdEvidenceGroups: adEvidence.normalizedAdEvidenceGroups,
        previousOutput: attempt.output,
        researchInput,
        skillMd,
      }),
    });
    await flushBufferedEvents();

    attempt = buildAnswerToolAttempt({
      answerInput: repairResult.answerInput,
      definition,
      deps,
      input,
      normalizedAdEvidenceGroups: adEvidence.normalizedAdEvidenceGroups,
    });

    if (attempt.artifact === null) {
      await appendEvent(
        deps,
        input.runId,
        createEvent({
          deps,
          runId: input.runId,
          sectionId: input.sectionId,
          type: "validation-failed",
          message: "Answer tool repair output failed validation",
          metadata: { attempt: 2, issues: attempt.errors },
        }),
      );
      await recordSectionFailure({
        definition,
        deps,
        errorMessage: attempt.errors.join("; "),
        input,
      });

      throw new SectionRunnerError({
        runId: input.runId,
        sectionId: input.sectionId,
        errors: attempt.errors,
      });
    }
  }

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
    artifact: attempt.artifact,
  };
}

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

  const attempt = buildAnswerToolAttempt({
    answerInput: answerResult.answerInput,
    definition,
    deps,
    input,
    normalizedAdEvidenceGroups: adEvidence.normalizedAdEvidenceGroups,
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
      input,
    });

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
    normalizedAdEvidenceGroups,
    prompt: structuredPrompt,
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
    return runSectionViaAnswerTool(input, deps);
  }

  const definition = getRuntimeSectionDefinition(input.sectionId);
  const startedAt = getNow(deps).getTime();
  const record = await deps.store.readRun(input.runId);
  const researchInput: ResearchInput = record.input;

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
    normalizedAdEvidenceGroups,
    prompt: structuredPrompt,
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
      signal: input.signal,
    });

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
