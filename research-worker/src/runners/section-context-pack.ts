import type { WorkerCapabilities } from '../capabilities';
import {
  POSITIONING_SECTION_SPECS,
  type PositioningSectionId,
} from './positioning';

export const MAX_SECTION_CONTEXT_PACK_CHARS = 12_000;
const DEFAULT_MAX_EXTERNAL_LOOKUPS = 2;
const MAX_SOURCE_REFS = 10;
const MAX_EXCERPTS = 6;
const MAX_EXCERPT_CHARS = 1_200;

export interface SectionCorpusExcerpt {
  id: string;
  title: string;
  text: string;
  sourceRefId: string | null;
  path: string;
  score: number;
}

export interface SectionSourceRef {
  id: string;
  title: string;
  url: string;
  quote: string | null;
  claim: string | null;
  snippet: string | null;
  confidence: number | null;
}

export interface SectionCapabilityGap {
  tool: string;
  reason: string;
  impact: string;
}

export interface SectionEvidenceGap {
  id: string;
  question: string;
  suggestedTool: string | null;
}

export interface SectionToolBudget {
  maxExternalLookups: number;
  allowedTools: string[];
}

export interface SectionContextPack {
  sectionId: PositioningSectionId;
  sectionTitle: string;
  gtmBriefSnapshot: Record<string, unknown>;
  gtmBriefReview: Record<string, unknown> | null;
  corpusExcerpts: SectionCorpusExcerpt[];
  sourceRefs: SectionSourceRef[];
  capabilityGaps: SectionCapabilityGap[];
  evidenceGaps: SectionEvidenceGap[];
  toolBudget: SectionToolBudget;
  maxChars: number;
}

export interface BuildSectionContextPackInput {
  sectionId: PositioningSectionId;
  gtmBriefSnapshot: Record<string, unknown>;
  gtmBriefReview?: Record<string, unknown> | null;
  corpus: unknown;
  capabilities: WorkerCapabilities['tools'];
  maxChars?: number;
}

interface CandidateExcerpt {
  title: string;
  text: string;
  path: string;
  url: string | null;
}

const SECTION_KEYWORDS: Record<PositioningSectionId, string[]> = {
  positioningMarketCategory: [
    'category',
    'market',
    'maturity',
    'adjacent',
    'trend',
    'trajectory',
    'structural',
  ],
  positioningBuyerICP: [
    'icp',
    'buyer',
    'persona',
    'customer',
    'firmographic',
    'trigger',
    'awareness',
  ],
  positioningCompetitorLandscape: [
    'competitor',
    'alternative',
    'pricing',
    'positioning',
    'share of voice',
    'weakness',
  ],
  positioningVoiceOfCustomer: [
    'review',
    'voc',
    'objection',
    'pain',
    'buyer language',
    'switching',
    'complain',
  ],
  positioningDemandIntent: [
    'demand',
    'keyword',
    'search',
    'question',
    'intent',
    'venue',
    'content gap',
  ],
  positioningOfferDiagnostic: [
    'offer',
    'activation',
    'first value',
    'retention',
    'funnel',
    'conversion',
    'cac',
    'ltv',
  ],
};

const SECTION_TOOLS: Record<PositioningSectionId, Array<keyof WorkerCapabilities['tools']>> = {
  positioningMarketCategory: ['webSearch', 'firecrawl'],
  positioningBuyerICP: ['webSearch', 'firecrawl'],
  positioningCompetitorLandscape: ['webSearch', 'spyfu', 'googleAds', 'metaAds', 'firecrawl'],
  positioningVoiceOfCustomer: ['webSearch', 'firecrawl'],
  positioningDemandIntent: ['webSearch', 'firecrawl'],
  positioningOfferDiagnostic: ['webSearch', 'ga4', 'firecrawl'],
};

const TOOL_LABELS: Record<keyof WorkerCapabilities['tools'], string> = {
  webSearch: 'web_search',
  spyfu: 'spyfu',
  firecrawl: 'firecrawl',
  googleAds: 'googleAds',
  metaAds: 'metaAds',
  ga4: 'ga4',
  charting: 'charting',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 16)).trimEnd()} [truncated]`;
}

function pickFirstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function walkRecords(
  value: unknown,
  path: string,
  visit: (record: Record<string, unknown>, path: string) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkRecords(item, `${path}[${index}]`, visit));
    return;
  }
  if (!isRecord(value)) return;
  visit(value, path);
  for (const [key, child] of Object.entries(value)) {
    walkRecords(child, path ? `${path}.${key}` : key, visit);
  }
}

function extractSourceRefs(corpus: unknown): SectionSourceRef[] {
  const refs: SectionSourceRef[] = [];
  const seen = new Set<string>();

  walkRecords(corpus, 'corpus', (record) => {
    const url = pickFirstString(record, ['url', 'sourceUrl', 'link']);
    if (!url || seen.has(url)) return;
    seen.add(url);
    refs.push({
      id: `src-${String(refs.length + 1).padStart(3, '0')}`,
      title: pickFirstString(record, ['title', 'sourceTitle', 'name']) ?? url,
      url,
      quote: pickFirstString(record, ['quote', 'evidenceQuote']),
      claim: pickFirstString(record, ['claim', 'reasoning']),
      snippet: pickFirstString(record, ['snippet', 'summary', 'text', 'value']),
      confidence: asNumber(record.confidence),
    });
  });

  return refs.slice(0, MAX_SOURCE_REFS);
}

function extractCandidateExcerpts(corpus: unknown): CandidateExcerpt[] {
  const candidates: CandidateExcerpt[] = [];

  walkRecords(corpus, 'corpus', (record, path) => {
    const text =
      pickFirstString(record, ['snippet', 'summary', 'claim', 'quote', 'text', 'value']) ??
      null;
    if (!text || text.length < 20) return;
    candidates.push({
      title: pickFirstString(record, ['title', 'sourceTitle', 'name']) ?? path,
      text,
      path,
      url: pickFirstString(record, ['url', 'sourceUrl', 'link']),
    });
  });

  return candidates;
}

function scoreExcerpt(sectionId: PositioningSectionId, excerpt: CandidateExcerpt): number {
  const haystack = `${excerpt.title}\n${excerpt.text}`.toLowerCase();
  const keywords = SECTION_KEYWORDS[sectionId];
  return keywords.reduce(
    (score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
}

function selectCorpusExcerpts(
  sectionId: PositioningSectionId,
  corpus: unknown,
  sourceRefs: SectionSourceRef[],
): SectionCorpusExcerpt[] {
  const sourceIdByUrl = new Map(sourceRefs.map((source) => [source.url, source.id]));
  return extractCandidateExcerpts(corpus)
    .map((candidate) => ({
      candidate,
      score: scoreExcerpt(sectionId, candidate),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.path.localeCompare(b.candidate.path))
    .slice(0, MAX_EXCERPTS)
    .map((entry, index) => ({
      id: `ex-${String(index + 1).padStart(3, '0')}`,
      title: entry.candidate.title,
      text: truncate(entry.candidate.text, MAX_EXCERPT_CHARS),
      sourceRefId: entry.candidate.url
        ? sourceIdByUrl.get(entry.candidate.url) ?? null
        : null,
      path: entry.candidate.path,
      score: entry.score,
    }));
}

function buildCapabilityGaps(
  sectionId: PositioningSectionId,
  capabilities: WorkerCapabilities['tools'],
): SectionCapabilityGap[] {
  return SECTION_TOOLS[sectionId]
    .filter((tool) => !capabilities[tool])
    .map((tool) => ({
      tool: TOOL_LABELS[tool],
      reason: `${TOOL_LABELS[tool]} is not configured for this worker run.`,
      impact: `Treat missing ${TOOL_LABELS[tool]} data as an explicit evidence gap; do not infer it.`,
    }));
}

function buildEvidenceGaps(
  sectionId: PositioningSectionId,
  capabilityGaps: SectionCapabilityGap[],
): SectionEvidenceGap[] {
  const keywords = SECTION_KEYWORDS[sectionId].slice(0, 3).join(', ');
  const base: SectionEvidenceGap[] = [
    {
      id: 'gap-001',
      question: `Verify Section-specific evidence for: ${keywords}.`,
      suggestedTool: 'web_search',
    },
  ];

  return [
    ...base,
    ...capabilityGaps.map((gap, index) => ({
      id: `gap-${String(index + 2).padStart(3, '0')}`,
      question: gap.impact,
      suggestedTool: gap.tool,
    })),
  ];
}

function allowedTools(
  sectionId: PositioningSectionId,
  capabilities: WorkerCapabilities['tools'],
): string[] {
  return SECTION_TOOLS[sectionId]
    .filter((tool) => capabilities[tool])
    .map((tool) => TOOL_LABELS[tool]);
}

export function buildSectionContextPack(
  input: BuildSectionContextPackInput,
): SectionContextPack {
  const sourceRefs = extractSourceRefs(input.corpus);
  const capabilityGaps = buildCapabilityGaps(input.sectionId, input.capabilities);

  return {
    sectionId: input.sectionId,
    sectionTitle: POSITIONING_SECTION_SPECS[input.sectionId].title,
    gtmBriefSnapshot: input.gtmBriefSnapshot,
    gtmBriefReview: input.gtmBriefReview ?? null,
    corpusExcerpts: selectCorpusExcerpts(input.sectionId, input.corpus, sourceRefs),
    sourceRefs,
    capabilityGaps,
    evidenceGaps: buildEvidenceGaps(input.sectionId, capabilityGaps),
    toolBudget: {
      maxExternalLookups: DEFAULT_MAX_EXTERNAL_LOOKUPS,
      allowedTools: allowedTools(input.sectionId, input.capabilities),
    },
    maxChars: input.maxChars ?? MAX_SECTION_CONTEXT_PACK_CHARS,
  };
}

function formatRecordLines(record: Record<string, unknown>): string[] {
  return Object.entries(record)
    .filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && String(value).trim().length > 0;
    })
    .map(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
      return `- ${key}: ${truncate(displayValue, 500)}`;
    });
}

export function serializeSectionContextPack(pack: SectionContextPack): string {
  const lines: string[] = [
    'SECTION CONTEXT PACK',
    `Section: ${pack.sectionId}`,
    `Title: ${pack.sectionTitle}`,
    `maxExternalLookups: ${pack.toolBudget.maxExternalLookups}`,
    `Allowed tools: ${pack.toolBudget.allowedTools.length > 0 ? pack.toolBudget.allowedTools.join(', ') : 'none'}`,
    '',
    'Frozen GTM Brief',
    ...formatRecordLines(pack.gtmBriefSnapshot),
    '',
    'Review metadata',
    `- fieldCount: ${String(pack.gtmBriefReview?.fieldCount ?? 'unknown')}`,
    `- pinnedFieldKeys: ${Array.isArray(pack.gtmBriefReview?.pinnedFieldKeys) ? pack.gtmBriefReview?.pinnedFieldKeys.join(', ') : 'none provided'}`,
    '',
    'Source refs',
    ...pack.sourceRefs.map((source) => {
      const detail = source.claim ?? source.quote ?? source.snippet ?? 'source reference';
      return `- [${source.id}] ${source.title} — ${source.url} — ${truncate(detail, 320)}`;
    }),
    '',
    'Selected corpus excerpts',
    ...pack.corpusExcerpts.map((excerpt) => {
      const source = excerpt.sourceRefId ? ` ${excerpt.sourceRefId}` : '';
      return `- [${excerpt.id}]${source} ${excerpt.title} (${excerpt.path})\n  ${excerpt.text}`;
    }),
    '',
    'Capability gaps',
    ...(pack.capabilityGaps.length > 0
      ? pack.capabilityGaps.map((gap) => `- ${gap.tool}: ${gap.reason} ${gap.impact}`)
      : ['- none']),
    '',
    'Evidence gaps',
    ...pack.evidenceGaps.map((gap) => `- ${gap.id}: ${gap.question}`),
    '',
    'Pack-first instructions',
    '- Read this Section Context Pack before using external tools.',
    '- Synthesize from source-backed evidence in the frozen brief, source refs, and excerpts.',
    '- Use external tools only for listed evidence gaps and stay within maxExternalLookups: 2.',
    '- If a tool or data source is unavailable, preserve it as a capability gap instead of inventing data.',
  ];

  const serialized = lines.join('\n');
  return truncate(serialized, pack.maxChars);
}
