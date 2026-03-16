import type { z } from 'zod';
import {
  getResearchCitations,
  getResearchProvenance,
  type ResearchCitation,
  type ResearchProvenance,
} from './research-output';
import {
  getBoundaryResearchSectionId,
  normalizeResearchSectionId,
  type CanonicalResearchSectionId,
} from './research-sections';
import type { ResearchTelemetry } from './research-observability';
import { JOURNEY_SECTION_DATA_SCHEMAS, type JourneySectionDataMap } from './schemas';

export type StoredResearchResultStatus = 'complete' | 'partial' | 'error';

export interface ResearchValidationIssue {
  code:
    | 'invalid_result'
    | 'schema_validation'
    | 'fallback_language'
    | 'unknown_section';
  message: string;
  path?: string;
}

export interface ResearchValidationMetadata {
  section: CanonicalResearchSectionId;
  issues: ResearchValidationIssue[];
}

export interface StoredResearchResult<
  TData = unknown,
  TSection extends string = CanonicalResearchSectionId,
> {
  status: StoredResearchResultStatus;
  section: TSection;
  data?: TData;
  error?: string;
  durationMs: number;
  rawText?: string;
  citations?: ResearchCitation[];
  provenance?: ResearchProvenance;
  validation?: ResearchValidationMetadata;
  telemetry?: ResearchTelemetry;
}

type CanonicalStoredResearchResult = StoredResearchResult<
  JourneySectionDataMap[CanonicalResearchSectionId],
  CanonicalResearchSectionId
>;

type BoundaryStoredResearchResult = StoredResearchResult<
  JourneySectionDataMap[CanonicalResearchSectionId],
  string
>;

type NormalizedResearchResult =
  | CanonicalStoredResearchResult
  | BoundaryStoredResearchResult;

type ResultTarget = 'canonical' | 'boundary';

const WRAPPER_KEYS = new Set([
  'status',
  'section',
  'data',
  'error',
  'durationMs',
  'rawText',
  'validation',
  'citations',
  'sources',
  'provenance',
  'telemetry',
  'runId',
]);

const ROOT_METADATA_KEYS = new Set(['citations', 'sources', 'provenance']);

const FALLBACK_LANGUAGE_PATTERNS = [
  /\btimed out\b/i,
  /\btimeout\b/i,
  /\bfallback\b/i,
  /\bplaceholder\b/i,
  /\bbenchmark-only\b/i,
  /\busing fallback\b/i,
] as const;

const USER_FACING_FALLBACK_SECTIONS = new Set<CanonicalResearchSectionId>([
  'strategicSynthesis',
  'keywordIntel',
  'mediaPlan',
]);
const TREND_DIRECTION_ALIASES = new Map<
  string,
  'rising' | 'stable' | 'declining'
>([
  ['rising', 'rising'],
  ['rise', 'rising'],
  ['up', 'rising'],
  ['upward', 'rising'],
  ['growing', 'rising'],
  ['increasing', 'rising'],
  ['stable', 'stable'],
  ['steady', 'stable'],
  ['flat', 'stable'],
  ['neutral', 'stable'],
  ['declining', 'declining'],
  ['decline', 'declining'],
  ['down', 'declining'],
  ['downward', 'declining'],
  ['falling', 'declining'],
  ['decreasing', 'declining'],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function asDurationMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function asTelemetry(value: unknown): ResearchTelemetry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const usage = isRecord(value.usage)
    ? {
        inputTokens:
          typeof value.usage.inputTokens === 'number' ? value.usage.inputTokens : 0,
        outputTokens:
          typeof value.usage.outputTokens === 'number' ? value.usage.outputTokens : 0,
        totalTokens:
          typeof value.usage.totalTokens === 'number' ? value.usage.totalTokens : 0,
        cacheCreationInputTokens:
          typeof value.usage.cacheCreationInputTokens === 'number'
            ? value.usage.cacheCreationInputTokens
            : undefined,
        cacheReadInputTokens:
          typeof value.usage.cacheReadInputTokens === 'number'
            ? value.usage.cacheReadInputTokens
            : undefined,
        serverToolUseCount:
          typeof value.usage.serverToolUseCount === 'number'
            ? value.usage.serverToolUseCount
            : undefined,
        iterations:
          typeof value.usage.iterations === 'number'
            ? value.usage.iterations
            : undefined,
      }
    : undefined;

  const charts = Array.isArray(value.charts)
    ? value.charts
        .map((chart) => {
          if (!isRecord(chart)) {
            return null;
          }

          const chartType = asString(chart.chartType);
          const title = asString(chart.title);
          if (!chartType || !title) {
            return null;
          }

          return {
            chartType,
            title,
            imageUrl: asString(chart.imageUrl),
          };
        })
        .filter((chart) => chart !== null)
    : undefined;

  return {
    model: asString(value.model),
    stopReason: asString(value.stopReason) ?? null,
    usage,
    estimatedCostUsd:
      typeof value.estimatedCostUsd === 'number' && Number.isFinite(value.estimatedCostUsd)
        ? value.estimatedCostUsd
        : undefined,
    charts: charts && charts.length > 0 ? charts : undefined,
  };
}

function toIssueMessage(issues: ResearchValidationIssue[]): string {
  return issues.map((issue) => issue.message).join('; ');
}

function getCanonicalSectionId(
  section: unknown,
  result: Record<string, unknown> | null,
): CanonicalResearchSectionId | null {
  return normalizeResearchSectionId(result?.section ?? section);
}

function splitPayloadMetadata(
  payload: Record<string, unknown>,
): {
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (ROOT_METADATA_KEYS.has(key)) {
      metadata[key] = value;
      continue;
    }

    data[key] = value;
  }

  return { data, metadata };
}

function getPayloadRecord(
  result: Record<string, unknown>,
): Record<string, unknown> | null {
  if (isRecord(result.data)) {
    return result.data;
  }

  const payloadEntries = Object.entries(result).filter(
    ([key]) => !WRAPPER_KEYS.has(key),
  );
  if (payloadEntries.length === 0) {
    return null;
  }

  return Object.fromEntries(payloadEntries);
}

function hasFallbackLanguage(
  section: CanonicalResearchSectionId,
  data: unknown,
): boolean {
  if (!USER_FACING_FALLBACK_SECTIONS.has(section)) {
    return false;
  }

  const haystack =
    typeof data === 'string'
      ? data
      : JSON.stringify(data);

  return FALLBACK_LANGUAGE_PATTERNS.some((pattern) => pattern.test(haystack));
}

function mapSchemaIssues(
  error: z.ZodError,
): ResearchValidationIssue[] {
  return error.issues.map((issue) => ({
    code: 'schema_validation',
    message: issue.message,
    path: issue.path.map(String).join('.'),
  }));
}

function normalizeTrendDirection(
  value: unknown,
): 'rising' | 'stable' | 'declining' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return TREND_DIRECTION_ALIASES.get(value.trim().toLowerCase());
}

function normalizeIndustryResearchData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const trendSignals = Array.isArray(data.trendSignals)
    ? data.trendSignals.map((signal) => {
        if (!isRecord(signal)) {
          return signal;
        }

        const direction =
          normalizeTrendDirection(signal.direction) ??
          normalizeTrendDirection(signal.description);

        return direction
          ? {
              ...signal,
              direction,
            }
          : signal;
      })
    : data.trendSignals;

  return trendSignals === data.trendSignals
    ? data
    : {
        ...data,
        trendSignals,
      };
}

function ensureStringArray(
  value: unknown,
  fallback: string,
): string[] {
  if (Array.isArray(value)) {
    const filtered = value.filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
    if (filtered.length > 0) return filtered;
  }
  return [fallback];
}

function normalizeCompetitorIntelData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const competitors = Array.isArray(data.competitors)
    ? data.competitors.map((competitor) => {
        if (!isRecord(competitor)) return competitor;

        const strengths = ensureStringArray(competitor.strengths, 'Data not available');
        const weaknesses = ensureStringArray(competitor.weaknesses, 'Data not available');
        const opportunities = ensureStringArray(competitor.opportunities, 'Further research needed');

        const adActivity = isRecord(competitor.adActivity)
          ? {
              ...competitor.adActivity,
              platforms: ensureStringArray(competitor.adActivity.platforms, 'Not verified'),
              themes: ensureStringArray(competitor.adActivity.themes, 'Not available'),
            }
          : {
              activeAdCount: 0,
              platforms: ['Not verified'],
              themes: ['Not available'],
              evidence: 'Limited coverage: ad data not collected.',
              sourceConfidence: 'low',
            };

        return {
          ...competitor,
          strengths,
          weaknesses,
          opportunities,
          adActivity,
        };
      })
    : data.competitors;

  const whiteSpaceGaps =
    Array.isArray(data.whiteSpaceGaps) && data.whiteSpaceGaps.length > 0
      ? data.whiteSpaceGaps
      : [
          {
            gap: 'Insufficient data to identify specific white space gaps',
            type: 'messaging',
            evidence: 'Competitor analysis did not surface clear gaps — further research recommended',
            exploitability: 3,
            impact: 3,
            recommendedAction: 'Conduct deeper competitive analysis with manual review',
          },
        ];

  return {
    ...data,
    ...(competitors !== data.competitors ? { competitors } : {}),
    whiteSpaceGaps,
  };
}

function normalizeCandidateData(
  section: CanonicalResearchSectionId,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (section === 'industryResearch') {
    return normalizeIndustryResearchData(data);
  }

  if (section === 'competitorIntel') {
    return normalizeCompetitorIntelData(data);
  }

  return data;
}

function buildInvalidResult(
  section: CanonicalResearchSectionId,
  durationMs: number,
  rawText: string | undefined,
  issues: ResearchValidationIssue[],
): CanonicalStoredResearchResult {
  return {
    status: 'partial',
    section,
    durationMs,
    rawText,
    error: `Validation failed: ${toIssueMessage(issues)}`,
    validation: {
      section,
      issues,
    },
  };
}

function projectSectionId(
  section: CanonicalResearchSectionId,
  target: ResultTarget,
): string {
  if (target === 'canonical') {
    return section;
  }

  return getBoundaryResearchSectionId(section) ?? section;
}

function projectResult<T extends CanonicalStoredResearchResult>(
  result: T,
  target: ResultTarget,
): T | BoundaryStoredResearchResult {
  if (target === 'canonical') {
    return result;
  }

  return {
    ...result,
    section: projectSectionId(result.section, target),
  };
}

export function normalizeStoredResearchResult(
  section: unknown,
  candidate: unknown,
  target: ResultTarget = 'canonical',
): NormalizedResearchResult | null {
  const result = isRecord(candidate) ? candidate : null;
  const canonicalSection = getCanonicalSectionId(section, result);

  if (!canonicalSection) {
    return null;
  }

  if (!result) {
    return projectResult(
      {
        status: 'error',
        section: canonicalSection,
        durationMs: 0,
        error: 'Research result is not an object payload.',
        validation: {
          section: canonicalSection,
          issues: [
            {
              code: 'invalid_result',
              message: 'Research result is not an object payload.',
            },
          ],
        },
      },
      target,
    );
  }

  const hasExplicitStatus =
    result.status === 'complete' ||
    result.status === 'partial' ||
    result.status === 'error';
  const durationMs = asDurationMs(result.durationMs);
  const rawText = asString(result.rawText);
  const payloadRecord = getPayloadRecord(result);
  const status = hasExplicitStatus
    ? result.status
    : payloadRecord
      ? 'complete'
      : 'error';
  const { data: candidateData, metadata } = payloadRecord
    ? splitPayloadMetadata(payloadRecord)
    : { data: {}, metadata: {} };
  const metadataRecord = {
    ...metadata,
    citations: result.citations ?? metadata.citations,
    sources: result.sources ?? metadata.sources,
    provenance: result.provenance ?? metadata.provenance,
    content: rawText,
  };
  const citations = getResearchCitations(metadataRecord);
  const provenance = getResearchProvenance(metadataRecord, citations);
  const telemetry = asTelemetry(result.telemetry);

  if (status === 'error') {
    return projectResult(
      {
        status,
        section: canonicalSection,
        durationMs,
        error: asString(result.error) ?? 'Research failed.',
        rawText,
        citations,
        provenance,
        telemetry,
      },
      target,
    );
  }

  if (status === 'partial' && !payloadRecord) {
    return projectResult(
      {
        status: 'partial',
        section: canonicalSection,
        durationMs,
        error: asString(result.error) ?? 'Research artifact requires review.',
        rawText,
        citations,
        provenance,
        telemetry,
        validation: isRecord(result.validation)
          ? {
              section: canonicalSection,
              issues: Array.isArray(result.validation.issues)
                ? result.validation.issues
                    .filter((issue) => isRecord(issue))
                    .map(
                      (issue) =>
                        issue as unknown as ResearchValidationIssue,
                    )
                : [],
            }
          : undefined,
      },
      target,
    );
  }

  const normalizedData = normalizeCandidateData(canonicalSection, candidateData);
  const parseResult =
    JOURNEY_SECTION_DATA_SCHEMAS[canonicalSection].safeParse(normalizedData);
  if (!parseResult.success) {
    const issues = mapSchemaIssues(parseResult.error);
    return projectResult(
      buildInvalidResult(canonicalSection, durationMs, rawText, issues),
      target,
    );
  }

  const fallbackIssues = hasFallbackLanguage(
    canonicalSection,
    parseResult.data,
  )
    ? [
        {
          code: 'fallback_language' as const,
          message:
            'Fallback or timeout language leaked into a user-facing artifact.',
        },
      ]
    : [];

  const normalizedResult: CanonicalStoredResearchResult = {
    status: fallbackIssues.length > 0 || status === 'partial' ? 'partial' : 'complete',
    section: canonicalSection,
    durationMs,
    data: parseResult.data as JourneySectionDataMap[typeof canonicalSection],
    rawText,
    citations,
    provenance,
    telemetry,
    error:
      fallbackIssues.length > 0
        ? toIssueMessage(fallbackIssues)
        : status === 'partial'
          ? asString(result.error) ?? 'Research artifact requires review.'
          : undefined,
    validation:
      fallbackIssues.length > 0
        ? {
            section: canonicalSection,
            issues: fallbackIssues,
          }
        : status === 'partial' && isRecord(result.validation)
          ? {
              section: canonicalSection,
              issues: Array.isArray(result.validation.issues)
                ? result.validation.issues
                    .filter((issue) => isRecord(issue))
                    .map((issue) => issue as unknown as ResearchValidationIssue)
                : [],
            }
          : undefined,
  };

  return projectResult(normalizedResult, target);
}

export function normalizeStoredResearchResults(
  results: Record<string, unknown> | null | undefined,
  target: ResultTarget = 'canonical',
): Record<string, NormalizedResearchResult> {
  const normalized: Record<string, NormalizedResearchResult> = {};

  for (const [section, candidate] of Object.entries(results ?? {})) {
    const normalizedResult = normalizeStoredResearchResult(
      section,
      candidate,
      target,
    );

    if (!normalizedResult) {
      continue;
    }

    normalized[normalizedResult.section] = normalizedResult;
  }

  return normalized;
}

export { getBoundaryResearchSectionId } from './research-sections';
