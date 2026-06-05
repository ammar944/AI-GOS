import { generateText } from "ai";

import {
  sectionReviewResultSchema,
  type ArtifactEnvelope,
  type ResearchInput,
  type SectionReviewResult,
} from "@/lib/lab-engine/artifacts/artifact-envelope";
import type { SectionId } from "@/lib/lab-engine/events/activity-event";
import type { SectionLanguageModel } from "@/lib/lab-engine/ai/models";

const MAX_CORPUS_EXCERPTS = 12;
const MAX_EXCERPT_CHARS = 1_200;
const MAX_ARTIFACT_JSON_CHARS = 24_000;
const MAX_DIAGNOSTIC_CHARS = 1_000;
const DEFAULT_REVIEW_TIMEOUT_MS = 45_000;
const REVIEW_METADATA_PATTERN =
  /<review_metadata>([\s\S]*?)<\/review_metadata>/u;

export interface ReviewAndUpgradeSectionInput {
  artifact: ArtifactEnvelope | null;
  researchInput: ResearchInput;
  sectionId: SectionId;
  model: SectionLanguageModel;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ModelErrorDiagnostics {
  name?: string;
  message: string;
  cause?: string;
  statusCode?: number;
  responseBody?: string;
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n[truncated]`;
}

function formatJson(value: unknown, maxChars: number): string {
  return truncateText(JSON.stringify(value, null, 2), maxChars);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readProperty(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function formatDiagnosticValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.length === 0
      ? undefined
      : truncateText(value, MAX_DIAGNOSTIC_CHARS);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return truncateText(String(value), MAX_DIAGNOSTIC_CHARS);
  }

  if (value instanceof Error) {
    return truncateText(value.message, MAX_DIAGNOSTIC_CHARS);
  }

  try {
    return truncateText(JSON.stringify(value), MAX_DIAGNOSTIC_CHARS);
  } catch {
    return truncateText(String(value), MAX_DIAGNOSTIC_CHARS);
  }
}

function readDiagnosticStatusCode(error: unknown): number | undefined {
  const value =
    readProperty(error, "statusCode") ?? readProperty(error, "status");

  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function readDiagnosticResponseBody(error: unknown): string | undefined {
  return formatDiagnosticValue(
    readProperty(error, "responseBody") ?? readProperty(error, "body"),
  );
}

export function buildModelErrorDiagnostics(
  error: unknown,
): ModelErrorDiagnostics {
  const message =
    error instanceof Error
      ? error.message
      : formatDiagnosticValue(error) ?? "Unknown model error";
  const name =
    error instanceof Error && error.name.length > 0
      ? truncateText(error.name, MAX_DIAGNOSTIC_CHARS)
      : undefined;
  const cause =
    error instanceof Error
      ? formatDiagnosticValue(error.cause)
      : formatDiagnosticValue(readProperty(error, "cause"));
  const statusCode = readDiagnosticStatusCode(error);
  const responseBody = readDiagnosticResponseBody(error);

  return {
    ...(name === undefined ? {} : { name }),
    message: truncateText(message, MAX_DIAGNOSTIC_CHARS),
    ...(cause === undefined ? {} : { cause }),
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(responseBody === undefined ? {} : { responseBody }),
  };
}

function formatSectionLabel(sectionId: SectionId): string {
  return sectionId
    .replace(/^positioning/u, "")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .trim();
}

export function buildOriginalArtifactMarkdown(
  artifact: ArtifactEnvelope | null,
  sectionId: SectionId,
): string {
  if (artifact === null) {
    return [
      `# ${formatSectionLabel(sectionId)}`,
      "",
      "Insufficient verified evidence was available to produce this section.",
    ].join("\n");
  }

  return [
    `# ${artifact.sectionTitle}`,
    "",
    `## Verdict`,
    artifact.verdict,
    "",
    `## Summary`,
    artifact.statusSummary,
    "",
    `## Structured artifact`,
    "```json",
    formatJson(artifact.body, MAX_ARTIFACT_JSON_CHARS),
    "```",
  ].join("\n");
}

function buildResearchContext(input: ResearchInput): Record<string, unknown> {
  return {
    company: input.company,
    onboarding: input.onboarding,
    sources: input.sources,
    corpusExcerpts: input.corpus.excerpts
      .slice(0, MAX_CORPUS_EXCERPTS)
      .map((excerpt) => ({
        id: excerpt.id,
        title: excerpt.title,
        sourceUrl: excerpt.sourceUrl,
        text: truncateText(excerpt.text, MAX_EXCERPT_CHARS),
      })),
  };
}

export function parseSectionReviewResponse(input: {
  text: string;
  fallbackMarkdown: string;
}): SectionReviewResult {
  const match = REVIEW_METADATA_PATTERN.exec(input.text);

  if (match === null) {
    throw new Error("Section review response missing <review_metadata> tail.");
  }

  const upgradedMarkdown = input.text.slice(0, match.index).trim();

  if (upgradedMarkdown.length === 0) {
    throw new Error("Section review response returned empty upgraded markdown.");
  }

  const parsedMetadata = JSON.parse(match[1] ?? "");

  return sectionReviewResultSchema.parse({
    ...parsedMetadata,
    upgradedMarkdown,
  });
}

function buildFallbackReview(input: {
  artifact: ArtifactEnvelope | null;
  error: unknown;
  fallbackMarkdown: string;
}): SectionReviewResult {
  const errorDiagnostics = buildModelErrorDiagnostics(input.error);

  return {
    upgradedMarkdown: input.fallbackMarkdown,
    tier: input.artifact === null ? "insufficient" : "unavailable",
    tierRationale: `Agentic review unavailable: ${errorDiagnostics.message}`,
    removedItems: [],
    clientQuestions:
      input.artifact === null
        ? ["Which customer evidence sources should be used to complete this section?"]
        : [],
    errorDiagnostics,
  };
}

function buildReviewPrompt(input: {
  artifact: ArtifactEnvelope | null;
  researchInput: ResearchInput;
  sectionId: SectionId;
  fallbackMarkdown: string;
}): string {
  return [
    "Review and upgrade the AI-GOS positioning research section below.",
    "",
    "You are a senior GTM strategist and fact-checker. Your job is to make the client-facing section honest, source-grounded, and strategically useful.",
    "",
    "Rules:",
    "- Remove fabricated or contaminated facts instead of merely flagging them.",
    "- Credit client-provided onboarding economics as (client brief), not as tool-measured facts.",
    "- Label model estimates as [model estimate - not tool-measured].",
    "- Label plausible but unfetched claims as [unverified - confirm before use].",
    "- If evidence is too thin, author an honest evidence-gap section that says what is missing and what to ask next.",
    "- Do not invent market data, prices, competitors, quotes, statistics, URLs, reviewer names, or dates.",
    "- Keep the output as polished markdown for the client.",
    "",
    "Return upgraded markdown first. End with exactly one metadata tail:",
    '<review_metadata>{"tier":"verified|needs_review|insufficient","tierRationale":"one sentence","removedItems":["..."],"clientQuestions":["..."]}</review_metadata>',
    "",
    `Section id: ${input.sectionId}`,
    "",
    "Current section markdown:",
    input.fallbackMarkdown,
    "",
    "Validated artifact JSON:",
    formatJson(input.artifact, MAX_ARTIFACT_JSON_CHARS),
    "",
    "Research context JSON:",
    formatJson(buildResearchContext(input.researchInput), MAX_ARTIFACT_JSON_CHARS),
  ].join("\n");
}

function createReviewTimeoutSignal(input: {
  parentSignal?: AbortSignal;
  timeoutMs: number;
}): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new Error(
        `Agentic section review exceeded ${input.timeoutMs}ms timeout.`,
      ),
    );
  }, input.timeoutMs);
  const signal =
    input.parentSignal === undefined
      ? controller.signal
      : AbortSignal.any([input.parentSignal, controller.signal]);

  return {
    cleanup: () => clearTimeout(timeout),
    signal,
  };
}

export async function reviewAndUpgradeSection(
  input: ReviewAndUpgradeSectionInput,
): Promise<SectionReviewResult> {
  const fallbackMarkdown = buildOriginalArtifactMarkdown(
    input.artifact,
    input.sectionId,
  );
  const timeoutSignal = createReviewTimeoutSignal({
    parentSignal: input.signal,
    timeoutMs: input.timeoutMs ?? DEFAULT_REVIEW_TIMEOUT_MS,
  });

  try {
    const result = await generateText({
      abortSignal: timeoutSignal.signal,
      maxOutputTokens: 8_000,
      maxRetries: 1,
      model: input.model,
      prompt: buildReviewPrompt({
        artifact: input.artifact,
        fallbackMarkdown,
        researchInput: input.researchInput,
        sectionId: input.sectionId,
      }),
      temperature: 0.1,
    });

    return parseSectionReviewResponse({
      fallbackMarkdown,
      text: result.text,
    });
  } catch (error) {
    return buildFallbackReview({
      artifact: input.artifact,
      error,
      fallbackMarkdown,
    });
  } finally {
    timeoutSignal.cleanup();
  }
}
