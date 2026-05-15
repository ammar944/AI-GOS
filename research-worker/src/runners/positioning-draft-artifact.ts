import { streamObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import { SourceSchema } from '../agents/subagents/schemas/_shared';
import type { PositioningSubagentId } from '../agents/subagents';
import { emitRunnerProgress, type RunnerProgressReporter } from '../runner';
import type { JourneySectionSpec } from './journey-section-synthesis';

const POSITIONING_DRAFT_SCHEMA_VERSION = 1;

const PositioningDraftFindingSchema = z
  .object({
    finding: z.string().describe('Concise first-pass finding from the Section Context Pack.'),
    evidence: z.string().describe('Evidence summary or explicit limitation supporting the finding.'),
    sourceUrl: z
      .string()
      .optional()
      .describe('Source URL from the Section Context Pack when available.'),
  })
  .describe('Thin draft finding. Not a full Section sub-section card.');

const PositioningDraftEvidenceGapSchema = z
  .object({
    gap: z.string().describe('Missing evidence or unavailable capability that limits the draft.'),
    impact: z.string().describe('Why this gap matters for the final deep Section Artifact.'),
  })
  .describe('Evidence or capability gap that deep mode should fill.');

export const PositioningSectionDraftSchema = z
  .object({
    schemaVersion: z
      .literal(POSITIONING_DRAFT_SCHEMA_VERSION)
      .describe('Draft schema version.'),
    artifactLayer: z.literal('draft').describe('Artifact layer. Always draft.'),
    sectionId: z.string().describe('Positioning section id.'),
    sectionTitle: z.string().describe('Human-readable Section title.'),
    verdict: z.string().describe('One-sentence first-pass verdict.'),
    statusSummary: z
      .string()
      .describe('Two to four sentence summary of what the draft can and cannot prove.'),
    coreThesis: z
      .string()
      .describe('Compact thesis synthesized only from the Section Context Pack.'),
    findings: z
      .array(PositioningDraftFindingSchema)
      .describe('Three to five first-pass findings.'),
    evidenceGaps: z
      .array(PositioningDraftEvidenceGapSchema)
      .describe('Evidence and capability gaps to keep visible.'),
    sources: z
      .array(SourceSchema)
      .describe('Sources referenced by the Section Context Pack.'),
    confidence: z
      .number()
      .describe('0-10 confidence score. Range is enforced by runner validation.'),
    recommendedDeepFillTargets: z
      .array(z.string())
      .describe('Specific targets for the explicit deep enrichment pass.'),
  })
  .describe('Thin first-pass positioning Section draft.');

export type PositioningSectionDraft = z.infer<typeof PositioningSectionDraftSchema>;

export interface DraftValidationResult {
  ok: boolean;
  errors: string[];
}

interface StreamPositioningSectionDraftArgs {
  model: LanguageModel;
  spec: JourneySectionSpec;
  businessContext: string;
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clampConfidence(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(10, Math.round(value))) : 3;
}

function nonEmptyString(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function countPopulatedDraftFields(partial: unknown): number {
  if (!isRecord(partial)) return 0;
  const fields = [
    'verdict',
    'statusSummary',
    'coreThesis',
    'findings',
    'evidenceGaps',
    'sources',
    'recommendedDeepFillTargets',
  ] as const;

  return fields.filter((field) => {
    const value = partial[field];
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  }).length;
}

function formatSource(source: PositioningSectionDraft['sources'][number]): string {
  const why = source.whyItMatters ? ` - ${source.whyItMatters}` : '';
  return `- [${source.title}](${source.url})${why}`;
}

export function normalizePositioningSectionDraft(
  draft: PositioningSectionDraft,
  spec: JourneySectionSpec,
): PositioningSectionDraft {
  return {
    ...draft,
    schemaVersion: POSITIONING_DRAFT_SCHEMA_VERSION,
    artifactLayer: 'draft',
    sectionId: spec.section,
    sectionTitle: nonEmptyString(draft.sectionTitle, spec.title),
    verdict: nonEmptyString(draft.verdict, `${spec.title} needs deep review`),
    statusSummary: nonEmptyString(
      draft.statusSummary,
      'The draft was generated from the Section Context Pack and needs deep enrichment before it should be treated as final.',
    ),
    coreThesis: nonEmptyString(
      draft.coreThesis,
      'The Section Context Pack was too thin to support a confident thesis.',
    ),
    findings: draft.findings.map((finding) => ({
      finding: nonEmptyString(finding.finding, 'Draft finding needs evidence'),
      evidence: nonEmptyString(finding.evidence, 'Evidence gap'),
      ...(finding.sourceUrl ? { sourceUrl: finding.sourceUrl } : {}),
    })),
    evidenceGaps: draft.evidenceGaps.map((gap) => ({
      gap: nonEmptyString(gap.gap, 'Unspecified evidence gap'),
      impact: nonEmptyString(gap.impact, 'Deep enrichment should resolve this before final use.'),
    })),
    sources: draft.sources,
    confidence: clampConfidence(draft.confidence),
    recommendedDeepFillTargets: draft.recommendedDeepFillTargets.map((target) =>
      nonEmptyString(target, 'Deepen unsupported claim'),
    ),
  };
}

export function validatePositioningSectionDraft(
  draft: PositioningSectionDraft,
  expectedSectionId: PositioningSubagentId,
): DraftValidationResult {
  const errors: string[] = [];
  if (draft.artifactLayer !== 'draft') errors.push('artifactLayer must be draft');
  if (draft.sectionId !== expectedSectionId) {
    errors.push(`sectionId must match ${expectedSectionId}`);
  }
  if (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 10) {
    errors.push('confidence must be between 0 and 10');
  }
  if (draft.findings.length < 2 || draft.findings.length > 5) {
    errors.push('findings must contain 2-5 compact findings');
  }
  if (draft.recommendedDeepFillTargets.length === 0) {
    errors.push('recommendedDeepFillTargets must identify at least one deep fill target');
  }
  return { ok: errors.length === 0, errors };
}

export function annotateDraftWithValidationGaps(
  draft: PositioningSectionDraft,
  errors: string[],
): PositioningSectionDraft {
  if (errors.length === 0) return draft;
  return {
    ...draft,
    confidence: Math.min(draft.confidence, 4),
    statusSummary: `${draft.statusSummary}\n\nDraft validation gaps: ${errors.join('; ')}.`,
    evidenceGaps: [
      ...draft.evidenceGaps,
      ...errors.map((error) => ({
        gap: error,
        impact: 'The deep enrichment pass must resolve this before finalizing the Section Artifact.',
      })),
    ],
  };
}

export function createPositioningSectionDraftFallback(args: {
  spec: JourneySectionSpec;
  errorMessage: string;
  context: string;
}): PositioningSectionDraft {
  const contextPreview = args.context.slice(0, 700);
  return {
    schemaVersion: POSITIONING_DRAFT_SCHEMA_VERSION,
    artifactLayer: 'draft',
    sectionId: args.spec.section,
    sectionTitle: args.spec.title,
    verdict: `${args.spec.title} needs review before use`,
    statusSummary:
      'Draft generation failed before a complete first-pass object could be emitted. The fallback preserves the failure and keeps deep enrichment targets visible.',
    coreThesis: contextPreview
      ? `The runner could not produce a reliable thesis. Context preview: ${contextPreview}`
      : 'The runner could not produce a reliable thesis from the available context.',
    findings: [
      {
        finding: 'Draft generation failed',
        evidence: args.errorMessage,
      },
      {
        finding: 'Deep enrichment required',
        evidence: 'The section needs a clean rerun before being treated as usable.',
      },
    ],
    evidenceGaps: [
      {
        gap: args.errorMessage,
        impact: 'The deep enrichment pass must rerun this section from the Section Context Pack.',
      },
    ],
    sources: [],
    confidence: 1,
    recommendedDeepFillTargets: [
      'Rerun the section in deep mode',
      'Verify source coverage and fill missing evidence gaps',
    ],
  };
}

export function formatPositioningSectionDraftMarkdown(
  draft: PositioningSectionDraft,
): string {
  const findingLines = draft.findings.map((finding, index) => {
    const source = finding.sourceUrl ? ` Source: ${finding.sourceUrl}` : '';
    return `${index + 1}. ${finding.finding}\n   Evidence: ${finding.evidence}${source}`;
  });
  const gapLines =
    draft.evidenceGaps.length > 0
      ? draft.evidenceGaps.map((gap) => `- ${gap.gap}: ${gap.impact}`)
      : ['- No evidence gaps were declared by the draft.'];
  const sourceLines =
    draft.sources.length > 0
      ? draft.sources.map(formatSource)
      : ['- No source URLs were available in the Section Context Pack.'];
  const deepTargetLines = draft.recommendedDeepFillTargets.map((target) => `- ${target}`);

  return [
    `# ${draft.sectionTitle}`,
    '',
    `**Artifact layer:** Draft`,
    `**Confidence:** ${draft.confidence}/10`,
    '',
    `## Verdict`,
    draft.verdict,
    '',
    `## Status Summary`,
    draft.statusSummary,
    '',
    `## Core Thesis`,
    draft.coreThesis,
    '',
    `## Findings`,
    ...findingLines,
    '',
    `## Evidence Gaps`,
    ...gapLines,
    '',
    `## Sources`,
    ...sourceLines,
    '',
    `## Recommended Deep Fill Targets`,
    ...deepTargetLines,
  ].join('\n');
}

export async function streamPositioningSectionDraftArtifact(
  args: StreamPositioningSectionDraftArgs,
): Promise<PositioningSectionDraft> {
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] draft streamObject: starting', {
    section: args.spec.section,
    status: 'drafting',
    artifactLayer: 'draft',
  });

  const system = [
    'You produce a thin first-pass positioning Section draft.',
    'Use only the supplied Section Context Pack. Do not call tools. Do not infer unavailable market data.',
    'Do not emit a full Section Artifact schema or subsection card arrays.',
    'Keep evidence gaps and capability gaps visible. This draft will be deepened later.',
  ].join('\n');

  const prompt = [
    `Section id: ${args.spec.section}`,
    `Section title: ${args.spec.title}`,
    `Mission: ${args.spec.mission}`,
    `Output emphasis: ${args.spec.outputEmphasis.join(', ')}`,
    '',
    '## Section Context Pack',
    args.businessContext,
  ].join('\n');

  const result = streamObject({
    model: args.model,
    schema: PositioningSectionDraftSchema,
    schemaName: 'PositioningSectionDraft',
    schemaDescription: 'Thin first-pass positioning draft for one Section.',
    system,
    prompt,
    abortSignal: args.abortSignal,
  });

  for await (const partial of result.partialObjectStream) {
    const populatedFields = countPopulatedDraftFields(partial);
    await emitRunnerProgress(
      args.onProgress,
      'runner',
      `[runner] draft streamObject: ${populatedFields}/7 fields partial`,
      {
        section: args.spec.section,
        status: 'drafting',
        artifactLayer: 'draft',
        resultCount: populatedFields,
      },
    );
  }

  const draft = await result.object;
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] draft streamObject: complete', {
    section: args.spec.section,
    status: 'complete',
    artifactLayer: 'draft',
  });

  return normalizePositioningSectionDraft(draft, args.spec);
}
