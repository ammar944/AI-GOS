import { generateText } from "ai";
import { z } from "zod";

import {
  artifactEnvelopeSchema,
  strategicCritiqueSchema,
  type StrategicCritique,
} from "@/lib/lab-engine/artifacts/artifact-envelope";
import {
  crossSectionReasoningBodySchema,
  type CrossSectionReasoningBody,
  type CrossSectionReasoningArtifact,
} from "@/lib/lab-engine/artifacts/schemas/cross-section-reasoning";
import { validateCrossSectionReasoningMinimums } from "@/lib/lab-engine/artifacts/schemas/cross-section-reasoning";
import type { SectionLanguageModel } from "@/lib/lab-engine/ai/models";
import {
  buildStrategicRubricPromptBlock,
  STRATEGIC_KNEW_THAT_PASS_FLOOR,
} from "@/lib/lab-engine/artifacts/strategic-rubric";

const DEFAULT_STRATEGIC_CRITIC_TIMEOUT_MS = 45_000;
const MAX_ARTIFACT_JSON_CHARS = 32_000;
const MAX_DIAGNOSTIC_CHARS = 1_000;
const STRATEGIC_CRITIC_PATTERN =
  /<strategic_critic>([\s\S]*?)<\/strategic_critic>/u;

const strategicCriticResponseSchema = z
  .object({
    body: crossSectionReasoningBodySchema,
    critique: strategicCritiqueSchema.omit({
      checkedAt: true,
      modelId: true,
      target: true,
    }),
  })
  .strict();

export interface CrossSectionStrategicCriticInput {
  artifact: CrossSectionReasoningArtifact;
  checkedAt: string;
  model: SectionLanguageModel;
  modelId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface CrossSectionStrategicCriticResult {
  artifact: CrossSectionReasoningArtifact;
  errorDiagnostics?: StrategicCriticErrorDiagnostics;
  outcome: "upgraded" | "fallback";
  summary: string;
}

export interface StrategicCriticErrorDiagnostics {
  name?: string;
  message: string;
  cause?: string;
  statusCode?: number;
  responseBody?: string;
}

export class StrategicCriticError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StrategicCriticError";
  }
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

function buildStrategicCriticErrorDiagnostics(
  error: unknown,
): StrategicCriticErrorDiagnostics {
  const message =
    error instanceof Error
      ? error.message
      : formatDiagnosticValue(error) ?? "Unknown strategic critic error";
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

interface SourceSectionRef {
  sectionId: string;
  sourceUrl: string;
}

function collectSourceSectionRefs(value: unknown): SourceSectionRef[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSourceSectionRefs(item));
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const current =
    typeof record.sectionId === "string" && typeof record.sourceUrl === "string"
      ? [{ sectionId: record.sectionId, sourceUrl: record.sourceUrl }]
      : [];

  return [
    ...current,
    ...Object.values(record).flatMap((item) => collectSourceSectionRefs(item)),
  ];
}

function sourceSectionRefKey(ref: SourceSectionRef): string {
  return `${ref.sectionId}\u0000${ref.sourceUrl}`;
}

function buildAllowedSourceSectionRefs(
  artifact: CrossSectionReasoningArtifact,
): ReadonlySet<string> {
  return new Set(collectSourceSectionRefs(artifact.body).map(sourceSectionRefKey));
}

function collectResponseSourceSectionRefs(
  body: CrossSectionReasoningBody,
): SourceSectionRef[] {
  return collectSourceSectionRefs(body);
}

function validateNoNewSourceSectionRefs(input: {
  allowedRefs: ReadonlySet<string>;
  body: CrossSectionReasoningBody;
}): void {
  const newRefs = Array.from(
    new Set(
      collectResponseSourceSectionRefs(input.body)
        .filter((ref) => !input.allowedRefs.has(sourceSectionRefKey(ref)))
        .map((ref) => `${ref.sectionId}:${ref.sourceUrl}`),
    ),
  );

  if (newRefs.length > 0) {
    throw new StrategicCriticError(
      `strategic critic introduced unsupported source section ref(s): ${newRefs.join(
        ", ",
      )}`,
    );
  }
}

function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function tokenizeBodyPath(path: string): Array<string | number> | null {
  if (!path.startsWith("body.")) {
    return null;
  }

  const rest = path.slice("body.".length);
  const tokens: Array<string | number> = [];
  let index = 0;

  while (index < rest.length) {
    const propertyMatch = /^[A-Za-z][A-Za-z0-9_]*/u.exec(rest.slice(index));
    if (propertyMatch === null) {
      return null;
    }
    tokens.push(propertyMatch[0]);
    index += propertyMatch[0].length;

    while (rest[index] === "[") {
      const arrayMatch = /^\[(\d+)\]/u.exec(rest.slice(index));
      if (arrayMatch === null) {
        return null;
      }
      tokens.push(Number(arrayMatch[1]));
      index += arrayMatch[0].length;
    }

    if (index === rest.length) {
      break;
    }
    if (rest[index] !== ".") {
      return null;
    }
    index += 1;
  }

  return tokens;
}

function readBodyPath(
  body: CrossSectionReasoningBody,
  path: string,
): unknown {
  const tokens = tokenizeBodyPath(path);
  if (tokens === null) {
    return undefined;
  }

  let current: unknown = body;
  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(current) || token >= current.length) {
        return undefined;
      }
      current = current[token];
      continue;
    }

    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }

  return current;
}

function validateCritiqueItemsReferenceBody(input: {
  body: CrossSectionReasoningBody;
  critique: StrategicCritique;
}): void {
  const mismatches = input.critique.items.flatMap((item) => {
    if (item.action === "cut") {
      return [];
    }

    const bodyValue = readBodyPath(input.body, item.path);
    if (typeof bodyValue !== "string") {
      return [`${item.path} is not a final body string`];
    }

    return normalizeComparableText(bodyValue) ===
      normalizeComparableText(item.text)
      ? []
      : [`${item.path} text does not match final body`];
  });

  if (mismatches.length > 0) {
    throw new StrategicCriticError(
      `strategic critic metadata does not map to final body: ${mismatches.join(
        "; ",
      )}`,
    );
  }
}

function computeKnewThatPassShare(critique: StrategicCritique): {
  passCount: number;
  passShare: number;
  totalCount: number;
} {
  const keptOrDeepened = critique.items.filter((item) => item.action !== "cut");
  const passCount = keptOrDeepened.filter(
    (item) => item.verdict === "passes",
  ).length;
  const totalCount = critique.items.length;

  return {
    passCount,
    passShare: totalCount === 0 ? 0 : passCount / totalCount,
    totalCount,
  };
}

function withKnewThatFloorMetadata(input: {
  body: CrossSectionReasoningBody;
  critique: StrategicCritique;
}): { body: CrossSectionReasoningBody; critique: StrategicCritique } {
  const knewThat = computeKnewThatPassShare(input.critique);
  const belowFloor = knewThat.passShare < STRATEGIC_KNEW_THAT_PASS_FLOOR;
  const { belowFloor: _bodyBelowFloor, ...bodyWithoutFloor } = input.body;
  const { belowFloor: _critiqueBelowFloor, ...critiqueWithoutFloor } =
    input.critique;
  const body = belowFloor
    ? { ...bodyWithoutFloor, belowFloor: true }
    : bodyWithoutFloor;
  const critique = belowFloor
    ? { ...critiqueWithoutFloor, belowFloor: true }
    : critiqueWithoutFloor;

  return { body, critique };
}

function parseStrategicCriticJson(text: string): unknown {
  const match = STRATEGIC_CRITIC_PATTERN.exec(text);
  if (match === null) {
    throw new StrategicCriticError(
      "Strategic critic response missing <strategic_critic> tail.",
    );
  }

  return JSON.parse(match[1] ?? "");
}

export function parseCrossSectionStrategicCriticResponse(input: {
  artifact: CrossSectionReasoningArtifact;
  checkedAt: string;
  modelId: string;
  text: string;
}): CrossSectionReasoningArtifact {
  const parsed = strategicCriticResponseSchema.parse(
    parseStrategicCriticJson(input.text),
  );
  const strategicCritique = strategicCritiqueSchema.parse({
    target: "cross_section_reasoning",
    checkedAt: input.checkedAt,
    modelId: input.modelId,
    ...parsed.critique,
  });
  const critiqueWithFloor = withKnewThatFloorMetadata({
    body: parsed.body,
    critique: strategicCritique,
  });

  validateCritiqueItemsReferenceBody({
    body: critiqueWithFloor.body,
    critique: critiqueWithFloor.critique,
  });
  validateNoNewSourceSectionRefs({
    allowedRefs: buildAllowedSourceSectionRefs(input.artifact),
    body: critiqueWithFloor.body,
  });

  const candidate = artifactEnvelopeSchema
    .extend({ body: crossSectionReasoningBodySchema })
    .parse({
      ...input.artifact,
      body: critiqueWithFloor.body,
      strategicCritique: critiqueWithFloor.critique,
    });
  const minimums = validateCrossSectionReasoningMinimums(candidate);

  if (!minimums.ok) {
    throw new StrategicCriticError(
      `strategic critic output failed cross-section minimums: ${minimums.errors.join(
        "; ",
      )}`,
    );
  }

  return candidate;
}

function throwIfCallerAborted(signal: AbortSignal | undefined): void {
  if (signal === undefined || !signal.aborted) {
    return;
  }

  const reason = signal.reason;
  if (reason instanceof Error) {
    throw reason;
  }

  throw new Error(
    reason === undefined
      ? "Strategic critic aborted."
      : `Strategic critic aborted: ${String(reason)}`,
  );
}

function createTimeoutSignal(input: {
  parentSignal?: AbortSignal;
  timeoutMs: number;
}): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new Error(`Strategic critic exceeded ${input.timeoutMs}ms timeout.`),
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

function buildStrategicCriticPrompt(
  artifact: CrossSectionReasoningArtifact,
): string {
  return [
    "Adversarially critique the AI-GOS cross-section reasoning artifact.",
    "",
    "You are a senior GTM strategist applying the 'so what - I knew that' test. Your job is to deepen or cut weak strategic claims before downstream capstones consume them.",
    "",
    "Rules:",
    "- Preserve evidence discipline. Do not add sources, URLs, source sections, market facts, prices, competitors, quotes, statistics, or dates.",
    "- Use only the existing `sourceSections[].sourceUrl` values already present in the artifact.",
    "- Keep each final claim grounded in at least two distinct committed section IDs.",
    "- A claim passes only if a sharp GTM consultant would not dismiss it as obvious, summary, generic, or unsupported.",
    "- Deepen weak claims by making the tension, trade-off, second-order consequence, or inversion more specific.",
    "- Cut weak claims only when they cannot be deepened without new evidence.",
    "- Return a complete replacement `body` with exactly the same body keys.",
    "",
    buildStrategicRubricPromptBlock(),
    "",
    "Return only explanatory text if useful, then end with exactly one JSON tail:",
    '<strategic_critic>{"body":{...},"critique":{"summary":"one sentence","items":[{"path":"body.crossSectionThreads[0].claim","text":"final text reviewed","verdict":"passes|knew_that|too_vague|summary|unsupported","action":"kept|deepened|cut","rationale":"one sentence"}]}}</strategic_critic>',
    "",
    "Current artifact JSON:",
    formatJson(artifact, MAX_ARTIFACT_JSON_CHARS),
  ].join("\n");
}

function buildStrategicCriticDeepenPrompt(
  artifact: CrossSectionReasoningArtifact,
): string {
  const failingItems =
    artifact.strategicCritique?.items.filter(
      (item) => item.verdict !== "passes",
    ) ?? [];

  return [
    "Deepen the AI-GOS cross-section reasoning artifact one more time.",
    "",
    "The first strategic critic pass ran, but the knew-that pass share was below the required floor. Deepen only the failing items listed below; preserve the rest unless a small wording change is needed for consistency.",
    "",
    "Rules:",
    "- Do not add sources, URLs, source sections, market facts, prices, competitors, quotes, statistics, or dates.",
    "- Use only existing `sourceSections[].sourceUrl` values already present in the artifact.",
    "- Return a complete replacement `body` and complete `critique` metadata.",
    "- A claim passes only if a senior GTM consultant would not dismiss it as obvious, summary, generic, or unsupported.",
    "",
    "Failing critique items:",
    formatJson(failingItems, 8_000),
    "",
    buildStrategicRubricPromptBlock(),
    "",
    "Return only explanatory text if useful, then end with exactly one JSON tail:",
    '<strategic_critic>{"body":{...},"critique":{"summary":"one sentence","items":[{"path":"body.crossSectionThreads[0].claim","text":"final text reviewed","verdict":"passes|knew_that|too_vague|summary|unsupported","action":"kept|deepened|cut","rationale":"one sentence"}]}}</strategic_critic>',
    "",
    "Current artifact JSON:",
    formatJson(artifact, MAX_ARTIFACT_JSON_CHARS),
  ].join("\n");
}

function isBelowKnewThatFloor(
  artifact: CrossSectionReasoningArtifact,
): boolean {
  return artifact.strategicCritique?.belowFloor === true;
}

export async function applyCrossSectionStrategicCritic(
  input: CrossSectionStrategicCriticInput,
): Promise<CrossSectionStrategicCriticResult> {
  throwIfCallerAborted(input.signal);

  const timeoutSignal = createTimeoutSignal({
    parentSignal: input.signal,
    timeoutMs: input.timeoutMs ?? DEFAULT_STRATEGIC_CRITIC_TIMEOUT_MS,
  });

  try {
    const result = await generateText({
      abortSignal: timeoutSignal.signal,
      maxOutputTokens: 8_000,
      maxRetries: 1,
      model: input.model,
      prompt: buildStrategicCriticPrompt(input.artifact),
      temperature: 0.1,
    });
    throwIfCallerAborted(input.signal);

    const artifact = parseCrossSectionStrategicCriticResponse({
      artifact: input.artifact,
      checkedAt: input.checkedAt,
      modelId: input.modelId,
      text: result.text,
    });

    if (isBelowKnewThatFloor(artifact)) {
      try {
        const retry = await generateText({
          abortSignal: timeoutSignal.signal,
          maxOutputTokens: 8_000,
          maxRetries: 1,
          model: input.model,
          prompt: buildStrategicCriticDeepenPrompt(artifact),
          temperature: 0.1,
        });
        throwIfCallerAborted(input.signal);

        const retriedArtifact = parseCrossSectionStrategicCriticResponse({
          artifact: input.artifact,
          checkedAt: input.checkedAt,
          modelId: input.modelId,
          text: retry.text,
        });

        return {
          artifact: retriedArtifact,
          outcome: "upgraded",
          summary:
            retriedArtifact.strategicCritique?.summary ??
            (isBelowKnewThatFloor(retriedArtifact)
              ? "Strategic critic completed below the knew-that floor after one deepen retry."
              : "Strategic critic deepened the cross-section reasoning after one retry."),
        };
      } catch (retryError) {
        throwIfCallerAborted(input.signal);
        const retryDiagnostics =
          buildStrategicCriticErrorDiagnostics(retryError);

        return {
          artifact,
          errorDiagnostics: retryDiagnostics,
          outcome: "upgraded",
          summary: `Strategic critic preserved below-floor critique after deepen retry failed: ${retryDiagnostics.message}`,
        };
      }
    }

    return {
      artifact,
      outcome: "upgraded",
      summary:
        artifact.strategicCritique?.summary ??
        "Strategic critic upgraded the cross-section reasoning.",
    };
  } catch (error) {
    throwIfCallerAborted(input.signal);
    const errorDiagnostics = buildStrategicCriticErrorDiagnostics(error);

    return {
      artifact: input.artifact,
      errorDiagnostics,
      outcome: "fallback",
      summary: errorDiagnostics.message,
    };
  } finally {
    timeoutSignal.cleanup();
  }
}
