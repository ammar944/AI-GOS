import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  researchInputSchema,
  type ArtifactEnvelope,
  type ResearchInput,
  type RunRecord,
} from "@/lib/lab-engine/artifacts/artifact-envelope";
import { selectedSectionModelMetadata } from "@/lib/lab-engine/ai/models";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import { createRunStore } from "@/lib/lab-engine/runs/run-store";
import {
  SECTION_REGISTRY,
  type SectionOutput,
  type SupportedSectionId,
} from "@/lib/lab-engine/sections/section-registry";

import { runSection } from "../run-section";

const runOllamaCanary = process.env.RUN_OLLAMA_CORPUS_CANARY === "true";
const ollamaCanarySectionIds = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
] as const satisfies readonly SupportedSectionId[];

interface CanaryValidationResult {
  ok: boolean;
  errors: string[];
}

type CanaryProvider = "deepseek-direct" | "deepseek-ollama";

interface CanarySectionDefinition {
  title: string;
  sectionOutputSchema: z.ZodType<SectionOutput<Record<string, unknown>>>;
  validateMinimums: (
    artifact: ArtifactEnvelope & { body: Record<string, unknown> },
  ) => CanaryValidationResult;
}

interface CanarySectionResult {
  sectionId: SupportedSectionId;
  ok: boolean;
  wallClockSeconds: string;
  schema: "pass" | "fail";
  validateMinimums: "pass" | "fail" | "not-run";
  error?: string;
}

function getTrimmedEnvValue(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCanarySectionDefinition(
  sectionId: SupportedSectionId,
): CanarySectionDefinition {
  return SECTION_REGISTRY[sectionId] as unknown as CanarySectionDefinition;
}

function assertCanaryProvider(): CanaryProvider {
  const provider = selectedSectionModelMetadata.provider;

  if (provider === "deepseek-direct" || provider === "deepseek-ollama") {
    return provider;
  }

  throw new Error(
    `RUN_OLLAMA_CORPUS_CANARY requires LAB_ENGINE_PROVIDER=deepseek-direct or deepseek-ollama; received ${provider}.`,
  );
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length === 0 ? "(root)" : issue.path.join(".");
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function toSectionOutput(
  artifact: ArtifactEnvelope & { body: Record<string, unknown> },
): SectionOutput<Record<string, unknown>> {
  return {
    sectionTitle: artifact.sectionTitle,
    verdict: artifact.verdict,
    statusSummary: artifact.statusSummary,
    confidence: artifact.confidence,
    sources: artifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher === undefined ? {} : { publisher: source.publisher }),
    })),
    body: artifact.body,
  };
}

function assertValidatedArtifact({
  artifact,
  sectionId,
}: {
  artifact: ArtifactEnvelope;
  sectionId: SupportedSectionId;
}): void {
  const definition = getCanarySectionDefinition(sectionId);
  const artifactWithBody = artifact as ArtifactEnvelope & {
    body: Record<string, unknown>;
  };
  const schemaResult = definition.sectionOutputSchema.safeParse(
    toSectionOutput(artifactWithBody),
  );

  if (!schemaResult.success) {
    throw new Error(
      `${sectionId} failed sectionOutputSchema: ${formatZodIssues(
        schemaResult.error,
      )}`,
    );
  }

  const minimums = definition.validateMinimums(artifactWithBody);

  if (!minimums.ok) {
    throw new Error(
      `${sectionId} failed validateMinimums: ${minimums.errors.join("; ")}`,
    );
  }
}

function assertFirstTryConformance({
  record,
  sectionId,
}: {
  record: RunRecord;
  sectionId: SupportedSectionId;
}): void {
  const sectionEvents = record.events.filter(
    (event) => event.sectionId === sectionId,
  );
  const retryEvents = sectionEvents.filter(
    (event) =>
      event.type === "validation-failed" || event.type === "repair-started",
  );

  if (retryEvents.length > 0) {
    throw new Error(
      `${sectionId} needed validation repair: ${retryEvents
        .map((event) => event.message)
        .join("; ")}`,
    );
  }

  const nonAnswerToolNames = sectionEvents.flatMap((event) =>
    event.type === "tool-started" && event.metadata.toolName !== "answer"
      ? [event.metadata.toolName]
      : [],
  );

  if (nonAnswerToolNames.length > 0) {
    throw new Error(
      `${sectionId} used non-corpus tool calls: ${nonAnswerToolNames.join(
        ", ",
      )}`,
    );
  }
}

async function readCanaryResearchInput(): Promise<ResearchInput> {
  const runRecordPath = getTrimmedEnvValue("OLLAMA_CORPUS_RUN_PATH");

  if (runRecordPath === undefined) {
    return saaslaunchResearchInput;
  }

  const rawJson = JSON.parse(await readFile(runRecordPath, "utf8")) as unknown;

  if (!isRecord(rawJson) || rawJson.input === undefined) {
    throw new Error(
      `OLLAMA_CORPUS_RUN_PATH ${runRecordPath} must point to a run record with an input object.`,
    );
  }

  return researchInputSchema.parse(rawJson.input);
}

async function assertOllamaModelAvailable(): Promise<void> {
  const baseURL = selectedSectionModelMetadata.baseURL;

  if (baseURL === undefined) {
    throw new Error("deepseek-ollama metadata must expose a baseURL.");
  }

  const modelsURL = new URL(
    "models",
    baseURL.endsWith("/") ? baseURL : `${baseURL}/`,
  );
  const response = await fetch(modelsURL);

  if (!response.ok) {
    throw new Error(
      `Ollama model list request failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as unknown;
  const modelIds = isRecord(payload)
    ? z
        .array(z.object({ id: z.string().min(1) }))
        .parse(payload.data)
        .map((model) => model.id)
    : [];

  expect(modelIds).toContain(selectedSectionModelMetadata.modelId);
}

async function assertSelectedModelAvailable(
  provider: CanaryProvider,
): Promise<void> {
  if (provider === "deepseek-ollama") {
    await assertOllamaModelAvailable();
  }
}

function formatSeconds(startMs: number, endMs: number): string {
  return ((endMs - startMs) / 1000).toFixed(1);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function classifySectionFailure(errorMessage: string): Pick<
  CanarySectionResult,
  "schema" | "validateMinimums"
> {
  const minimumFailureNeedles = [
    "failed validateMinimums",
    "need >=",
    "need at least",
    "must include",
    "have ",
  ];

  if (minimumFailureNeedles.some((needle) => errorMessage.includes(needle))) {
    return { schema: "pass", validateMinimums: "fail" };
  }

  return { schema: "fail", validateMinimums: "not-run" };
}

describe.skipIf(!runOllamaCanary)("DeepSeek corpus canary", (): void => {
  it(
    "validates all six corpus-only sections through the answer-tool path",
    async (): Promise<void> => {
      const provider = assertCanaryProvider();
      await assertSelectedModelAvailable(provider);

      const researchInput = await readCanaryResearchInput();
      const rootDir = await mkdtemp(join(tmpdir(), "aigos-ollama-corpus-"));
      const runStartedMs = performance.now();
      const store = createRunStore({
        rootDir,
        defaultSectionIds: [...ollamaCanarySectionIds],
        now: () => new Date("2026-05-25T12:00:00.000Z"),
      });

      await store.createRun(researchInput);
      const sectionResults: CanarySectionResult[] = [];

      for (const sectionId of ollamaCanarySectionIds) {
        const definition = getCanarySectionDefinition(sectionId);

        console.info(
          `[ollama-corpus] starting ${sectionId} (${definition.title})`,
        );

        const sectionStartedMs = performance.now();
        try {
          const result = await runSection(
            {
              runId: researchInput.runId,
              sectionId,
            },
            {
              allowedTools: [],
              loadSkill: async (slug): Promise<string> =>
                readFile(
                  join(
                    process.cwd(),
                    "src/lib/lab-engine/skills",
                    slug,
                    "SKILL.md",
                  ),
                  "utf8",
                ),
              now: () => new Date("2026-05-25T12:00:00.000Z"),
              store,
            },
          );

          assertValidatedArtifact({ artifact: result.artifact, sectionId });

          const record = await store.readRun(researchInput.runId);
          assertFirstTryConformance({ record, sectionId });

          const wallClockSeconds = formatSeconds(
            sectionStartedMs,
            performance.now(),
          );
          sectionResults.push({
            ok: true,
            schema: "pass",
            sectionId,
            validateMinimums: "pass",
            wallClockSeconds,
          });
          console.info(
            `[ollama-corpus] completed ${sectionId} wallClockSeconds=${wallClockSeconds} schema=pass validateMinimums=pass provider=${provider}`,
          );
        } catch (error) {
          const wallClockSeconds = formatSeconds(
            sectionStartedMs,
            performance.now(),
          );
          const errorMessage = oneLine(getErrorMessage(error));
          const validation = classifySectionFailure(errorMessage);
          sectionResults.push({
            error: errorMessage,
            ok: false,
            schema: validation.schema,
            sectionId,
            validateMinimums: validation.validateMinimums,
            wallClockSeconds,
          });
          console.info(
            `[ollama-corpus] failed ${sectionId} wallClockSeconds=${wallClockSeconds} schema=${validation.schema} validateMinimums=${validation.validateMinimums} provider=${provider} error=${errorMessage}`,
          );
        }
      }

      const completedRecord = await store.readRun(researchInput.runId);
      const completedSections = ollamaCanarySectionIds.filter(
        (sectionId) => completedRecord.sections[sectionId]?.status === "completed",
      );

      console.info(
        `[ollama-corpus] ${completedSections.length}/6 complete for runId=${
          researchInput.runId
        } model=${selectedSectionModelMetadata.modelId} provider=${provider} totalWallClockSeconds=${formatSeconds(
          runStartedMs,
          performance.now(),
        )}`,
      );
      const failedSections = sectionResults.filter((result) => !result.ok);

      if (failedSections.length > 0) {
        throw new Error(
          `[ollama-corpus] ${failedSections.length}/6 failed: ${failedSections
            .map((result) => `${result.sectionId}: ${result.error}`)
            .join(" | ")}`,
        );
      }

      expect(completedSections).toEqual([...ollamaCanarySectionIds]);
    },
    4_800_000,
  );
});
