import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import type { ResearchTelemetry } from '@/lib/journey/research-observability';
import {
  normalizeStoredResearchResults,
  type StoredResearchResult,
} from '@/lib/journey/research-result-contract';

export type JourneyResearchSandboxSection =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'crossAnalysis'
  | 'keywordIntel'
  | 'mediaPlan';

export interface JourneyResearchSandboxSectionConfig {
  section: JourneyResearchSandboxSection;
  label: string;
  toolName:
    | 'researchIndustry'
    | 'researchCompetitors'
    | 'researchICP'
    | 'researchOffer'
    | 'synthesizeResearch'
    | 'researchKeywords'
    | 'researchMediaPlan';
  dependsOn: JourneyResearchSandboxSection[];
}

export const JOURNEY_RESEARCH_SANDBOX_SECTIONS: readonly JourneyResearchSandboxSectionConfig[] = [
  {
    section: 'industryMarket',
    label: 'Market Overview',
    toolName: 'researchIndustry',
    dependsOn: [],
  },
  {
    section: 'competitors',
    label: 'Competitor Intel',
    toolName: 'researchCompetitors',
    dependsOn: ['industryMarket'],
  },
  {
    section: 'icpValidation',
    label: 'ICP Validation',
    toolName: 'researchICP',
    dependsOn: ['industryMarket'],
  },
  {
    section: 'offerAnalysis',
    label: 'Offer Analysis',
    toolName: 'researchOffer',
    dependsOn: ['industryMarket', 'competitors'],
  },
  {
    section: 'crossAnalysis',
    label: 'Strategic Synthesis',
    toolName: 'synthesizeResearch',
    dependsOn: [
      'industryMarket',
      'competitors',
      'icpValidation',
      'offerAnalysis',
    ],
  },
  {
    section: 'keywordIntel',
    label: 'Keywords',
    toolName: 'researchKeywords',
    dependsOn: ['crossAnalysis', 'competitors'],
  },
  {
    section: 'mediaPlan',
    label: 'Media Plan',
    toolName: 'researchMediaPlan',
    dependsOn: ['crossAnalysis', 'keywordIntel'],
  },
] as const;

export const JOURNEY_RESEARCH_SANDBOX_SECTION_MAP = Object.freeze(
  Object.fromEntries(
    JOURNEY_RESEARCH_SANDBOX_SECTIONS.map((config) => [config.section, config]),
  ) as Record<
    JourneyResearchSandboxSection,
    JourneyResearchSandboxSectionConfig
  >,
);

const JOURNEY_RESEARCH_SANDBOX_SECTION_ALIASES: Record<
  JourneyResearchSandboxSection,
  readonly string[]
> = {
  industryMarket: ['industryMarket', 'industryResearch'],
  competitors: ['competitors', 'competitorIntel'],
  icpValidation: ['icpValidation'],
  offerAnalysis: ['offerAnalysis'],
  crossAnalysis: ['crossAnalysis', 'strategicSynthesis'],
  keywordIntel: ['keywordIntel', 'keywords'],
  mediaPlan: ['mediaPlan'],
};

export const JOURNEY_RESEARCH_PRODUCTION_SEQUENCE: readonly JourneyResearchSandboxSection[] = [
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
  'crossAnalysis',
  'keywordIntel',
  'mediaPlan',
] as const;

export const JOURNEY_RESEARCH_SANDBOX_RUN_ALL_SEQUENCE: readonly JourneyResearchSandboxSection[] =
  JOURNEY_RESEARCH_PRODUCTION_SEQUENCE.filter(
    (section) => section !== 'mediaPlan',
  ) as JourneyResearchSandboxSection[];

export type PersistedResearchResult = StoredResearchResult<unknown, string>;

export interface PersistedResearchJobStatusRow {
  status: 'running' | 'complete' | 'error';
  tool: string;
  startedAt: string;
  completedAt?: string;
  lastHeartbeat?: string;
  error?: string;
  updates?: Array<{
    at: string;
    id: string;
    message: string;
    phase: 'runner' | 'tool' | 'analysis' | 'output' | 'error';
  }>;
  telemetry?: ResearchTelemetry;
}

export interface JourneyResearchSandboxUnifiedSectionReport {
  section: JourneyResearchSandboxSection;
  label: string;
  toolName: JourneyResearchSandboxSectionConfig['toolName'];
  status: 'idle' | 'blocked' | 'running' | 'complete' | 'partial' | 'error';
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  lastHeartbeat: string | null;
  missingPrerequisites: JourneyResearchSandboxSection[];
  logCount: number;
  latestLog: string | null;
  logs: Array<{
    at: string;
    id: string;
    message: string;
    phase: 'runner' | 'tool' | 'analysis' | 'output' | 'error';
  }>;
  hasCharts: boolean;
  chartCount: number;
  telemetry: ResearchTelemetry | null;
  sandboxResult: PersistedResearchResult | null;
  liveResult: PersistedResearchResult | null;
}

export interface JourneyResearchSandboxUnifiedReport {
  sections: JourneyResearchSandboxUnifiedSectionReport[];
  totals: {
    completedSections: number;
    totalDurationMs: number;
    totalTokens: number;
    totalEstimatedCostUsd: number;
    totalCharts: number;
  };
}

function stringifyUnifiedReportValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildJourneyResearchSandboxUnifiedExport(
  report: JourneyResearchSandboxUnifiedReport,
): string {
  const sections = report.sections.map((section) => {
    const header = `## ${section.label} (${section.section})`;
    const summary = [
      `status: ${section.status}`,
      `durationMs: ${section.durationMs ?? 'n/a'}`,
      `tokens: ${section.telemetry?.usage?.totalTokens ?? 0}`,
      `estimatedCostUsd: ${section.telemetry?.estimatedCostUsd ?? 0}`,
    ];
    const body = stringifyUnifiedReportValue(section.sandboxResult ?? null);

    return [header, ...summary, '', body].join('\n');
  });

  return [
    '# Journey Research Sandbox Unified Output',
    '',
    `completedSections: ${report.totals.completedSections}`,
    `totalDurationMs: ${report.totals.totalDurationMs}`,
    `totalTokens: ${report.totals.totalTokens}`,
    `totalEstimatedCostUsd: ${report.totals.totalEstimatedCostUsd}`,
    `totalCharts: ${report.totals.totalCharts}`,
    '',
    ...sections,
  ].join('\n');
}

export interface JourneyResearchSandboxSessionSnapshot {
  exists: boolean;
  id: string | null;
  userId: string;
  updatedAt: string | null;
  metadata: Record<string, unknown> | null;
  researchResults: Record<string, PersistedResearchResult>;
  jobStatus: Record<string, PersistedResearchJobStatusRow>;
  contextDrafts: Partial<Record<JourneyResearchSandboxSection, string>>;
}

export interface JourneyResearchSandboxSnapshot {
  section: JourneyResearchSandboxSection;
  sandboxKey: string;
  sandboxUserId: string;
  liveSession: JourneyResearchSandboxSessionSnapshot;
  sandboxSession: JourneyResearchSandboxSessionSnapshot;
  backendStatus: JourneyResearchSandboxBackendStatus;
  suggestedContext: {
    live: string;
    sandbox: string;
  };
}

export interface JourneyResearchSandboxBackendStatus {
  workerUrlConfigured: boolean;
  workerReachable: boolean;
  workerHealth: Record<string, unknown> | null;
  capabilities: {
    webSearch: boolean;
    spyfu: boolean;
    firecrawl: boolean;
    googleAds: boolean;
    metaAds: boolean;
    ga4: boolean;
    charting: boolean;
  } | null;
  warnings: string[];
}

const SANDBOX_PREFIX = 'journey-research-sandbox';

const CONTEXT_FIELD_ORDER: Record<
  JourneyResearchSandboxSection,
  readonly string[]
> = {
  industryMarket: [
    'companyName',
    'websiteUrl',
    'businessModel',
    'productDescription',
    'primaryIcpDescription',
    'pricingTiers',
    'marketProblem',
    'valueProp',
    'goals',
  ],
  competitors: [
    'companyName',
    'websiteUrl',
    'businessModel',
    'productDescription',
    'topCompetitors',
    'uniqueEdge',
    'competitorFrustrations',
    'marketBottlenecks',
  ],
  icpValidation: [
    'companyName',
    'websiteUrl',
    'businessModel',
    'productDescription',
    'primaryIcpDescription',
    'jobTitles',
    'companySize',
    'geography',
    'buyingTriggers',
    'bestClientSources',
    'goals',
  ],
  offerAnalysis: [
    'companyName',
    'websiteUrl',
    'businessModel',
    'productDescription',
    'coreDeliverables',
    'pricingTiers',
    'monthlyAdBudget',
    'valueProp',
    'guarantees',
    'testimonialQuote',
    'pricingUrl',
    'caseStudiesUrl',
    'demoUrl',
  ],
  crossAnalysis: [
    'companyName',
    'websiteUrl',
    'businessModel',
    'productDescription',
    'primaryIcpDescription',
    'topCompetitors',
    'pricingTiers',
    'monthlyAdBudget',
    'goals',
    'brandPositioning',
    'situationBeforeBuying',
    'desiredTransformation',
    'commonObjections',
    'salesCycleLength',
    'salesProcessOverview',
    'targetCpl',
    'targetCac',
  ],
  keywordIntel: [
    'companyName',
    'websiteUrl',
    'businessModel',
    'productDescription',
    'topCompetitors',
    'goals',
    'primaryIcpDescription',
  ],
  mediaPlan: [
    'companyName',
    'websiteUrl',
    'businessModel',
    'productDescription',
    'primaryIcpDescription',
    'pricingTiers',
    'monthlyAdBudget',
    'goals',
    'campaignDuration',
    'targetCpl',
    'targetCac',
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isJourneyResearchSandboxEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_JOURNEY_RESEARCH_SANDBOX === '1'
  );
}

export function sanitizeJourneyResearchSandboxKey(
  sandboxKey: string | null | undefined,
): string {
  const normalized = (sandboxKey ?? 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized) {
    return 'default';
  }

  return normalized.slice(0, 48);
}

export function getJourneyResearchSandboxUserId(
  liveUserId: string,
  sandboxKey: string | null | undefined,
): string {
  return `${liveUserId}::${SANDBOX_PREFIX}::${sanitizeJourneyResearchSandboxKey(
    sandboxKey,
  )}`;
}

export function getJourneyResearchSandboxConfig(
  section: string,
): JourneyResearchSandboxSectionConfig | null {
  return (JOURNEY_RESEARCH_SANDBOX_SECTION_MAP as Record<string, JourneyResearchSandboxSectionConfig>)[
    section
  ] ?? null;
}

export function normalizeJourneyResearchSandboxSection(
  section: string | null | undefined,
): JourneyResearchSandboxSection | null {
  if (!section) {
    return null;
  }

  for (const config of JOURNEY_RESEARCH_SANDBOX_SECTIONS) {
    if (JOURNEY_RESEARCH_SANDBOX_SECTION_ALIASES[config.section].includes(section)) {
      return config.section;
    }
  }

  return null;
}

export function normalizeJourneySandboxResearchResults(
  researchResults: Record<string, unknown> | null | undefined,
): Record<string, PersistedResearchResult> {
  const normalizedResults = normalizeStoredResearchResults(
    researchResults,
    'boundary',
  );

  return Object.fromEntries(
    Object.entries(normalizedResults).filter(([section]) =>
      Boolean(normalizeJourneyResearchSandboxSection(section)),
    ),
  );
}

export function getJourneySandboxContextDrafts(
  metadata: Record<string, unknown> | null | undefined,
): Partial<Record<JourneyResearchSandboxSection, string>> {
  const sandboxMeta = isRecord(metadata?.researchSandbox)
    ? metadata.researchSandbox
    : null;
  const drafts = isRecord(sandboxMeta?.contextDrafts)
    ? sandboxMeta.contextDrafts
    : null;

  const normalized: Partial<Record<JourneyResearchSandboxSection, string>> = {};
  for (const config of JOURNEY_RESEARCH_SANDBOX_SECTIONS) {
    const draft = drafts?.[config.section];
    if (typeof draft === 'string' && draft.trim().length > 0) {
      normalized[config.section] = draft;
    }
  }

  return normalized;
}

export function getJourneySandboxSectionResetAt(
  metadata: Record<string, unknown> | null | undefined,
): Partial<Record<JourneyResearchSandboxSection, string>> {
  const sandboxMeta = isRecord(metadata?.researchSandbox)
    ? metadata.researchSandbox
    : null;
  const resets = isRecord(sandboxMeta?.sectionResetAt)
    ? sandboxMeta.sectionResetAt
    : null;

  const normalized: Partial<Record<JourneyResearchSandboxSection, string>> = {};
  for (const config of JOURNEY_RESEARCH_SANDBOX_SECTIONS) {
    const resetAt = resets?.[config.section];
    if (typeof resetAt === 'string' && resetAt.trim().length > 0) {
      normalized[config.section] = resetAt;
    }
  }

  return normalized;
}

export function mergeJourneySandboxMetadata(
  metadata: Record<string, unknown> | null | undefined,
  input: {
    sandboxKey: string;
    liveUserId: string;
    contextDrafts?: Partial<Record<JourneyResearchSandboxSection, string>>;
    sectionResetAt?: Partial<Record<JourneyResearchSandboxSection, string>>;
    clearSectionResetAt?: boolean;
  },
): Record<string, unknown> {
  const nextMetadata = { ...(metadata ?? {}) };
  const currentSandboxMeta = isRecord(nextMetadata.researchSandbox)
    ? nextMetadata.researchSandbox
    : {};
  const mergedDrafts = {
    ...getJourneySandboxContextDrafts(nextMetadata),
    ...(input.contextDrafts ?? {}),
  };
  const mergedResetAt = input.clearSectionResetAt
    ? {}
    : {
        ...getJourneySandboxSectionResetAt(nextMetadata),
        ...(input.sectionResetAt ?? {}),
      };

  nextMetadata.researchSandbox = {
    ...currentSandboxMeta,
    key: sanitizeJourneyResearchSandboxKey(input.sandboxKey),
    sourceUserId: input.liveUserId,
    contextDrafts: mergedDrafts,
    sectionResetAt: mergedResetAt,
    updatedAt: new Date().toISOString(),
  };

  return nextMetadata;
}

export function readJourneyMetadataField(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): unknown {
  if (!metadata) {
    return undefined;
  }

  const directValue = metadata[key];
  if (directValue !== undefined) {
    if (isRecord(directValue) && 'value' in directValue) {
      return directValue.value;
    }

    return directValue;
  }

  const confirmedFields = isRecord(metadata.confirmedFields)
    ? metadata.confirmedFields
    : null;
  const confirmedValue = confirmedFields?.[key];
  if (isRecord(confirmedValue) && 'value' in confirmedValue) {
    return confirmedValue.value;
  }

  return confirmedValue;
}

function stringifyMetadataValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value
      .map((entry) => stringifyMetadataValue(entry))
      .filter((entry): entry is string => Boolean(entry));
    return items.length > 0 ? items.join(', ') : null;
  }

  if (isRecord(value)) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return null;
    }
  }

  return null;
}

function formatSectionResultForContext(result: unknown): string | null {
  if (!isRecord(result)) {
    return null;
  }

  const payload = result.data ?? result;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return null;
  }
}

export function buildJourneyResearchSandboxContext(
  section: JourneyResearchSandboxSection,
  input: {
    metadata: Record<string, unknown> | null | undefined;
    researchResults: Record<string, unknown> | null | undefined;
  },
): string {
  const config = JOURNEY_RESEARCH_SANDBOX_SECTION_MAP[section];
  const normalizedResults = normalizeJourneySandboxResearchResults(
    input.researchResults,
  );
  const lines: string[] = [
    `Journey research sandbox context`,
    `Section: ${config.label}`,
    '',
    'Business context:',
  ];

  let appendedField = false;
  for (const fieldKey of CONTEXT_FIELD_ORDER[section]) {
    const rawValue = readJourneyMetadataField(input.metadata, fieldKey);
    const value = stringifyMetadataValue(rawValue);
    if (!value) {
      continue;
    }

    appendedField = true;
    lines.push(`- ${JOURNEY_FIELD_LABELS[fieldKey] ?? fieldKey}: ${value}`);
  }

  if (!appendedField) {
    lines.push('- No saved Journey metadata found. Paste the exact context you want to run.');
  }

  const dependencyBlocks = config.dependsOn
    .map((dependency) => {
      const dependencyConfig = JOURNEY_RESEARCH_SANDBOX_SECTION_MAP[dependency];
      const formatted = formatSectionResultForContext(normalizedResults[dependency]);
      if (!formatted) {
        return null;
      }

      return `## ${dependencyConfig.label}\n${formatted}`;
    })
    .filter((block): block is string => Boolean(block));

  if (dependencyBlocks.length > 0) {
    lines.push('');
    lines.push('Existing persisted research to reuse:');
    lines.push('');
    lines.push(dependencyBlocks.join('\n\n'));
  }

  return lines.join('\n').trim();
}

export function clearJourneySandboxSectionResult(
  researchResults: Record<string, unknown> | null | undefined,
  section: JourneyResearchSandboxSection,
): Record<string, unknown> | null {
  const next = { ...(researchResults ?? {}) };
  for (const alias of JOURNEY_RESEARCH_SANDBOX_SECTION_ALIASES[section]) {
    delete next[alias];
  }

  return Object.keys(next).length > 0 ? next : null;
}

export function clearJourneySandboxSectionJobs(
  jobStatus: Record<string, unknown> | null | undefined,
  section: JourneyResearchSandboxSection,
): Record<string, unknown> | null {
  const toolName = JOURNEY_RESEARCH_SANDBOX_SECTION_MAP[section].toolName;
  const nextEntries = Object.entries(jobStatus ?? {}).filter(([, value]) => {
    return !isRecord(value) || value.tool !== toolName;
  });

  if (nextEntries.length === 0) {
    return null;
  }

  return Object.fromEntries(nextEntries);
}

export function getJourneySandboxMissingPrerequisites(
  section: JourneyResearchSandboxSection,
  researchResults: Record<string, unknown> | null | undefined,
): JourneyResearchSandboxSection[] {
  const config = JOURNEY_RESEARCH_SANDBOX_SECTION_MAP[section];
  const results = normalizeJourneySandboxResearchResults(researchResults);

  return config.dependsOn.filter((dependency) => {
    const result = results[dependency];
    return !isRecord(result) || result.status !== 'complete';
  });
}

function statusTimestamp(row: PersistedResearchJobStatusRow): number {
  const raw = row.completedAt ?? row.lastHeartbeat ?? row.startedAt;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getJobSection(tool: string): JourneyResearchSandboxSection | null {
  return (
    normalizeJourneyResearchSandboxSection(tool) ??
    JOURNEY_RESEARCH_SANDBOX_SECTIONS.find((config) => config.toolName === tool)?.section ??
    null
  );
}

function sectionResetTimestamp(
  resets: Partial<Record<JourneyResearchSandboxSection, string>>,
  section: JourneyResearchSandboxSection,
): number | null {
  const resetAt = resets[section];
  if (!resetAt) {
    return null;
  }

  const parsed = Date.parse(resetAt);
  return Number.isNaN(parsed) ? null : parsed;
}

export function applyJourneySandboxSectionResets(input: {
  metadata: Record<string, unknown> | null | undefined;
  researchResults: Record<string, unknown> | null | undefined;
  jobStatus: Record<string, PersistedResearchJobStatusRow> | null | undefined;
}): {
  researchResults: Record<string, PersistedResearchResult>;
  jobStatus: Record<string, PersistedResearchJobStatusRow>;
} {
  const resets = getJourneySandboxSectionResetAt(input.metadata);
  const filteredJobStatus = Object.fromEntries(
    Object.entries(input.jobStatus ?? {}).filter(([, row]) => {
      const section = getJobSection(row.tool);
      if (!section) {
        return true;
      }

      const resetAt = sectionResetTimestamp(resets, section);
      if (resetAt == null) {
        return true;
      }

      const startedAt = Date.parse(row.startedAt);
      return !Number.isNaN(startedAt) && startedAt >= resetAt;
    }),
  ) as Record<string, PersistedResearchJobStatusRow>;

  const latestJobsBySection = getLatestJobBySection(filteredJobStatus);
  const filteredResearchResults = Object.fromEntries(
    Object.entries(normalizeJourneySandboxResearchResults(input.researchResults)).filter(
      ([section, result]) => {
        const normalizedSection = normalizeJourneyResearchSandboxSection(section);
        if (!normalizedSection) {
          return false;
        }

        const resetAt = sectionResetTimestamp(resets, normalizedSection);
        if (resetAt == null) {
          return true;
        }

        if (result.status === 'complete' || result.status === 'partial' || result.status === 'error') {
          return Boolean(latestJobsBySection[normalizedSection]);
        }

        return true;
      },
    ),
  ) as Record<string, PersistedResearchResult>;

  return {
    researchResults: filteredResearchResults,
    jobStatus: filteredJobStatus,
  };
}

function getLatestJobBySection(
  jobStatus: Record<string, PersistedResearchJobStatusRow> | null | undefined,
): Partial<Record<JourneyResearchSandboxSection, PersistedResearchJobStatusRow>> {
  const latest: Partial<Record<JourneyResearchSandboxSection, PersistedResearchJobStatusRow>> = {};

  for (const row of Object.values(jobStatus ?? {})) {
    const mappedSection = getJobSection(row.tool);
    if (!mappedSection) {
      continue;
    }

    const current = latest[mappedSection];
    if (!current || statusTimestamp(row) >= statusTimestamp(current)) {
      latest[mappedSection] = row;
    }
  }

  return latest;
}

function asCompleteDuration(
  result: PersistedResearchResult | null,
  job: PersistedResearchJobStatusRow | undefined,
): number | null {
  if (typeof result?.durationMs === 'number') {
    return result.durationMs;
  }

  if (!job?.startedAt || !job.completedAt) {
    return null;
  }

  const startedAt = Date.parse(job.startedAt);
  const completedAt = Date.parse(job.completedAt);
  if (Number.isNaN(startedAt) || Number.isNaN(completedAt)) {
    return null;
  }

  return Math.max(0, completedAt - startedAt);
}

export function getJourneyResearchSandboxRunAllSequence(): JourneyResearchSandboxSection[] {
  return [...JOURNEY_RESEARCH_SANDBOX_RUN_ALL_SEQUENCE];
}

export function buildJourneyResearchSandboxUnifiedReport(input: {
  sandboxResults: Record<string, unknown> | null | undefined;
  sandboxJobStatus: Record<string, PersistedResearchJobStatusRow> | null | undefined;
  liveResults?: Record<string, unknown> | null | undefined;
}): JourneyResearchSandboxUnifiedReport {
  const sandboxResults = normalizeJourneySandboxResearchResults(input.sandboxResults);
  const liveResults = normalizeJourneySandboxResearchResults(input.liveResults);
  const latestJobs = getLatestJobBySection(input.sandboxJobStatus);

  const sections = JOURNEY_RESEARCH_SANDBOX_RUN_ALL_SEQUENCE.map((section) => {
    const config = JOURNEY_RESEARCH_SANDBOX_SECTION_MAP[section];
    const sandboxResult = sandboxResults[section] ?? null;
    const liveResult = liveResults[section] ?? null;
    const latestJob = latestJobs[section];
    const missingPrerequisites = getJourneySandboxMissingPrerequisites(
      section,
      sandboxResults,
    );
    const status =
      sandboxResult?.status ??
      latestJob?.status ??
      (missingPrerequisites.length > 0 ? 'blocked' : 'idle');
    const telemetry = sandboxResult?.telemetry ?? latestJob?.telemetry ?? null;
    const updates = latestJob?.updates ?? [];
    const latestLog = updates.length > 0 ? updates[updates.length - 1]?.message ?? null : null;
    const charts =
      telemetry?.charts ??
      (Array.isArray(sandboxResult?.data) ? undefined : undefined);
    const chartCount =
      telemetry?.charts?.length ??
      (isRecord(sandboxResult?.data) && Array.isArray(sandboxResult.data.charts)
        ? sandboxResult.data.charts.length
        : 0);

    return {
      section,
      label: config.label,
      toolName: config.toolName,
      status,
      durationMs: asCompleteDuration(sandboxResult, latestJob),
      startedAt: latestJob?.startedAt ?? null,
      completedAt: latestJob?.completedAt ?? null,
      lastHeartbeat: latestJob?.lastHeartbeat ?? null,
      missingPrerequisites,
      logCount: updates.length,
      latestLog,
      logs: updates,
      hasCharts: chartCount > 0 || Boolean(charts?.length),
      chartCount,
      telemetry,
      sandboxResult,
      liveResult,
    } satisfies JourneyResearchSandboxUnifiedSectionReport;
  });

  return {
    sections,
    totals: {
      completedSections: sections.filter((section) => section.status === 'complete').length,
      totalDurationMs: sections.reduce(
        (sum, section) => sum + (section.durationMs ?? 0),
        0,
      ),
      totalTokens: sections.reduce(
        (sum, section) => sum + (section.telemetry?.usage?.totalTokens ?? 0),
        0,
      ),
      totalEstimatedCostUsd: sections.reduce(
        (sum, section) => sum + (section.telemetry?.estimatedCostUsd ?? 0),
        0,
      ),
      totalCharts: sections.reduce((sum, section) => sum + section.chartCount, 0),
    },
  };
}
