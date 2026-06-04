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
const REVIEW_METADATA_PATTERN =
  /<review_metadata>([\s\S]*?)<\/review_metadata>/u;

export interface ReviewAndUpgradeSectionInput {
  artifact: ArtifactEnvelope | null;
  researchInput: ResearchInput;
  sectionId: SectionId;
  model: SectionLanguageModel;
  signal?: AbortSignal;
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
  const errorMessage =
    input.error instanceof Error ? input.error.message : String(input.error);

  return {
    upgradedMarkdown: input.fallbackMarkdown,
    tier: input.artifact === null ? "insufficient" : "needs_review",
    tierRationale: `Agentic review unavailable: ${errorMessage}`,
    removedItems: [],
    clientQuestions:
      input.artifact === null
        ? ["Which customer evidence sources should be used to complete this section?"]
        : [],
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

export async function reviewAndUpgradeSection(
  input: ReviewAndUpgradeSectionInput,
): Promise<SectionReviewResult> {
  const fallbackMarkdown = buildOriginalArtifactMarkdown(
    input.artifact,
    input.sectionId,
  );

  try {
    const result = await generateText({
      abortSignal: input.signal,
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
  }
}
