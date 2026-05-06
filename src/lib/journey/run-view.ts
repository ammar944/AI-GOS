import { createAdminClient } from '@/lib/supabase/server';
import { getJourneyRunIdFromMetadata } from '@/lib/journey/journey-run';
import {
  normalizeStoredResearchResults,
  type StoredResearchResult,
} from '@/lib/journey/research-result-contract';
import {
  extractResearchJobActivity,
  type ResearchJobActivity,
  type ResearchJobStatusRow,
  type ResearchJobUpdate,
} from '@/lib/journey/research-job-activity-core';
import {
  SECTION_PIPELINE,
  SECTION_PIPELINE_LABELS,
  getResearchPipelineReadiness,
} from '@/lib/workspace/pipeline';
import {
  parseResearchToCards,
  resetCardIdCounter,
} from '@/lib/workspace/card-taxonomy';
import type { CardState, SectionKey, SectionPhase } from '@/lib/workspace/types';

export type JourneyRunViewStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed';

export type JourneySectionViewStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'partial'
  | 'error';

export interface JourneyRunViewMetadata {
  sessionId: string | null;
  profileId: string | null;
  runId: string | null;
  companyName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  raw: Record<string, unknown> | null;
}

export interface JourneyRunEvent {
  id: string;
  section: SectionKey;
  type: ResearchJobUpdate['phase'] | 'job';
  message: string;
  status: ResearchJobStatusRow['status'];
  createdAt: string;
  metadata?: ResearchJobUpdate['meta'];
}

export interface JourneyRunMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string | null;
}

export interface JourneySectionView {
  id: SectionKey;
  label: string;
  order: number;
  phase: SectionPhase;
  status: JourneySectionViewStatus;
  result: StoredResearchResult<unknown, string> | null;
  activity: ResearchJobActivity | null;
  cards: CardState[];
  latestEvent: JourneyRunEvent | null;
  events: JourneyRunEvent[];
  blocker: string | null;
  pendingDependencyReason: string | null;
}

export interface JourneyRunView {
  run: JourneyRunViewMetadata;
  status: JourneyRunViewStatus;
  sections: JourneySectionView[];
  latestEventBySection: Partial<Record<SectionKey, JourneyRunEvent>>;
  eventsBySection: Partial<Record<SectionKey, JourneyRunEvent[]>>;
  artifactsBySection: Partial<Record<SectionKey, StoredResearchResult<unknown, string>>>;
  artifactsByTool: Record<string, StoredResearchResult<unknown, string>[]>;
  messages: JourneyRunMessage[];
  readiness: ReturnType<typeof getResearchPipelineReadiness>;
}

export interface JourneySessionRunRow {
  id?: string | null;
  profile_id?: string | null;
  metadata?: unknown;
  research_results?: unknown;
  job_status?: unknown;
  messages?: unknown;
  run_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export class JourneyRunViewLoadError extends Error {
  constructor(userId: string, runId: string | null, message: string) {
    super(
      `Failed to load journey run view for user ${userId}${
        runId ? ` and run ${runId}` : ''
      }: ${message}`,
    );
    this.name = 'JourneyRunViewLoadError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asJobStatus(value: unknown): ResearchJobStatusRow['status'] | null {
  return value === 'running' || value === 'complete' || value === 'error'
    ? value
    : null;
}

function asUpdatePhase(value: unknown): ResearchJobUpdate['phase'] | null {
  return value === 'runner' ||
    value === 'tool' ||
    value === 'analysis' ||
    value === 'output' ||
    value === 'error'
    ? value
    : null;
}

function normalizeUpdateMeta(value: unknown): Record<string, unknown> | undefined {
  return asRecord(value) ?? undefined;
}

function normalizeJobUpdates(value: unknown): ResearchJobUpdate[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const updates: ResearchJobUpdate[] = [];
  value.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      return;
    }

    const at = asString(candidate.at);
    const message = asString(candidate.message);
    const phase = asUpdatePhase(candidate.phase);
    if (!at || !message || !phase) {
      return;
    }

    updates.push({
      at,
      id: asString(candidate.id) ?? `update-${index}`,
      message,
      phase,
      meta: normalizeUpdateMeta(candidate.meta),
    });
  });

  return updates.length > 0 ? updates : undefined;
}

function normalizeJobStatusRecord(
  value: unknown,
): Record<string, ResearchJobStatusRow> | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const normalized: Record<string, ResearchJobStatusRow> = {};
  for (const [jobId, candidate] of Object.entries(record)) {
    if (!isRecord(candidate)) {
      continue;
    }

    const status = asJobStatus(candidate.status);
    const tool = asString(candidate.tool);
    const startedAt = asString(candidate.startedAt);
    if (!status || !tool || !startedAt) {
      continue;
    }

    normalized[jobId] = {
      status,
      tool,
      startedAt,
      completedAt: asString(candidate.completedAt) ?? undefined,
      lastHeartbeat: asString(candidate.lastHeartbeat) ?? undefined,
      error: asString(candidate.error) ?? undefined,
      updates: normalizeJobUpdates(candidate.updates),
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeMessages(value: unknown): JourneyRunMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((candidate, index): JourneyRunMessage | null => {
      if (!isRecord(candidate)) {
        return null;
      }

      const content =
        asString(candidate.content) ??
        asString(candidate.text) ??
        (Array.isArray(candidate.parts) ? JSON.stringify(candidate.parts) : '');

      return {
        id: asString(candidate.id) ?? `message-${index}`,
        role: asString(candidate.role) ?? 'unknown',
        content,
        createdAt:
          asString(candidate.createdAt) ??
          asString(candidate.created_at) ??
          asString(candidate.timestamp),
      };
    })
    .filter((message): message is JourneyRunMessage => message !== null)
    .sort((left, right) => {
      if (!left.createdAt || !right.createdAt) {
        return 0;
      }

      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    });
}

function getLatestUpdate(activity: ResearchJobActivity): ResearchJobUpdate | null {
  const updates = [...(activity.updates ?? [])].sort((left, right) =>
    left.at.localeCompare(right.at),
  );

  return updates.at(-1) ?? null;
}

function createLatestEvent(
  section: SectionKey,
  activity: ResearchJobActivity | null,
): JourneyRunEvent | null {
  if (!activity) {
    return null;
  }

  const latestUpdate = getLatestUpdate(activity);
  if (latestUpdate) {
    return {
      id: latestUpdate.id,
      section,
      type: latestUpdate.phase,
      message: latestUpdate.message,
      status: activity.status,
      createdAt: latestUpdate.at,
      metadata: latestUpdate.meta,
    };
  }

  return {
    id: activity.jobId,
    section,
    type: 'job',
    message:
      activity.status === 'running'
        ? `${SECTION_PIPELINE_LABELS[section]} is running.`
        : activity.status === 'complete'
          ? `${SECTION_PIPELINE_LABELS[section]} completed.`
          : `${SECTION_PIPELINE_LABELS[section]} failed.`,
    status: activity.status,
    createdAt: activity.completedAt ?? activity.lastHeartbeat ?? activity.startedAt,
  };
}

function createEvents(
  section: SectionKey,
  activity: ResearchJobActivity | null,
): JourneyRunEvent[] {
  if (!activity) {
    return [];
  }

  const updates = [...(activity.updates ?? [])].sort((left, right) =>
    left.at.localeCompare(right.at),
  );

  if (updates.length === 0) {
    const latest = createLatestEvent(section, activity);
    return latest ? [latest] : [];
  }

  return updates.map((update) => ({
    id: update.id,
    section,
    type: update.phase,
    message: update.message,
    status: activity.status,
    createdAt: update.at,
    metadata: update.meta,
  }));
}

function getSectionStatus(
  result: StoredResearchResult<unknown, string> | null,
  activity: ResearchJobActivity | null,
): JourneySectionViewStatus {
  if (result?.status === 'complete') {
    return 'complete';
  }

  if (result?.status === 'partial') {
    return 'partial';
  }

  if (result?.status === 'error' || activity?.status === 'error') {
    return 'error';
  }

  if (activity?.status === 'running') {
    return 'running';
  }

  return 'queued';
}

function getSectionPhase(status: JourneySectionViewStatus): SectionPhase {
  if (status === 'running') {
    return 'researching';
  }

  if (status === 'complete' || status === 'partial') {
    return 'review';
  }

  if (status === 'error') {
    return 'error';
  }

  return 'queued';
}

function getBlocker(
  status: JourneySectionViewStatus,
  result: StoredResearchResult<unknown, string> | null,
  activity: ResearchJobActivity | null,
): string | null {
  if (status === 'partial') {
    return result?.error ?? 'Research artifact needs review before it can be trusted.';
  }

  if (status === 'error') {
    return result?.error ?? activity?.error ?? 'Research failed without a persisted error message.';
  }

  return null;
}

function getCompleteIntelData(
  researchResults: Record<string, unknown> | null,
  key:
    | 'opportunityIntel'
    | 'whiteSpaceGapIntel'
    | 'offerStatementIntel'
    | 'strategicSynthesisIntel',
): Record<string, unknown> | undefined {
  const result = asRecord(researchResults?.[key]);
  return result?.status === 'complete' && isRecord(result.data)
    ? result.data
    : undefined;
}

function buildIntelData(
  researchResults: Record<string, unknown> | null,
): {
  opportunityIntel?: Record<string, unknown>;
  whiteSpaceGapIntel?: Record<string, unknown>;
  offerStatementIntel?: Record<string, unknown>;
  strategicSynthesisIntel?: Record<string, unknown>;
} {
  return {
    opportunityIntel: getCompleteIntelData(researchResults, 'opportunityIntel'),
    whiteSpaceGapIntel: getCompleteIntelData(researchResults, 'whiteSpaceGapIntel'),
    offerStatementIntel: getCompleteIntelData(researchResults, 'offerStatementIntel'),
    strategicSynthesisIntel: getCompleteIntelData(
      researchResults,
      'strategicSynthesisIntel',
    ),
  };
}

function buildCards(
  section: SectionKey,
  result: StoredResearchResult<unknown, string> | null,
  intelData: ReturnType<typeof buildIntelData>,
): CardState[] {
  if (!result?.data || !isRecord(result.data)) {
    return [];
  }

  return parseResearchToCards(section, result.data, intelData);
}

function dependencyReason(
  section: JourneySectionView,
): string {
  if (section.status === 'running') {
    return `Waiting for ${section.label} to finish.`;
  }

  if (section.status === 'partial') {
    return `Waiting for ${section.label} to be reviewed.`;
  }

  if (section.status === 'error') {
    return `Waiting for ${section.label} to recover from an error.`;
  }

  return `Waiting for ${section.label}.`;
}

function attachPendingDependencyReasons(
  sections: JourneySectionView[],
): JourneySectionView[] {
  return sections.map((section, index) => {
    if (section.status !== 'queued' || index === 0) {
      return section;
    }

    const dependency = sections
      .slice(0, index)
      .find((candidate) => candidate.status !== 'complete');

    return dependency
      ? {
          ...section,
          pendingDependencyReason: dependencyReason(dependency),
        }
      : section;
  });
}

function getRunStatus(sections: JourneySectionView[]): JourneyRunViewStatus {
  if (sections.some((section) => section.status === 'error')) {
    return 'failed';
  }

  if (sections.some((section) => section.status === 'running')) {
    return 'running';
  }

  if (sections.every((section) => section.status === 'complete')) {
    return 'completed';
  }

  if (sections.some((section) => section.status === 'complete' || section.status === 'partial')) {
    return 'partial';
  }

  return 'queued';
}

function groupArtifactsByTool(
  artifactsBySection: Partial<Record<SectionKey, StoredResearchResult<unknown, string>>>,
  activityBySection: Record<string, ResearchJobActivity>,
): Record<string, StoredResearchResult<unknown, string>[]> {
  const grouped: Record<string, StoredResearchResult<unknown, string>[]> = {};

  for (const [section, artifact] of Object.entries(artifactsBySection)) {
    if (!artifact) {
      continue;
    }

    const tool = activityBySection[section]?.tool ?? 'persisted-result';
    grouped[tool] = [...(grouped[tool] ?? []), artifact];
  }

  return grouped;
}

export function buildJourneyRunView(
  row: JourneySessionRunRow,
): JourneyRunView {
  const metadata = asRecord(row.metadata);
  const rawResearchResults = asRecord(row.research_results);
  const jobStatus = normalizeJobStatusRecord(row.job_status);
  const researchResults = normalizeStoredResearchResults(
    rawResearchResults,
    'boundary',
  ) as Record<string, StoredResearchResult<unknown, string>>;
  const intelData = buildIntelData(rawResearchResults);
  const activityBySection = extractResearchJobActivity(jobStatus);
  const artifactsBySection: Partial<Record<SectionKey, StoredResearchResult<unknown, string>>> = {};
  resetCardIdCounter();

  const sections = attachPendingDependencyReasons(
    SECTION_PIPELINE.map((section, index) => {
      const result =
        (researchResults[section] as StoredResearchResult<unknown, string> | undefined) ??
        null;
      const activity = activityBySection[section] ?? null;
      const status = getSectionStatus(result, activity);
      const events = createEvents(section, activity);

      if (result) {
        artifactsBySection[section] = result;
      }

      return {
        id: section,
        label: SECTION_PIPELINE_LABELS[section],
        order: index,
        phase: getSectionPhase(status),
        status,
        result,
        activity,
        cards: buildCards(section, result, intelData),
        latestEvent: createLatestEvent(section, activity),
        events,
        blocker: getBlocker(status, result, activity),
        pendingDependencyReason: null,
      };
    }),
  );

  const latestEventBySection: Partial<Record<SectionKey, JourneyRunEvent>> = {};
  const eventsBySection: Partial<Record<SectionKey, JourneyRunEvent[]>> = {};
  for (const section of sections) {
    if (section.latestEvent) {
      latestEventBySection[section.id] = section.latestEvent;
    }
    eventsBySection[section.id] = section.events;
  }

  return {
    run: {
      sessionId: row.id ?? null,
      profileId: row.profile_id ?? null,
      runId: getJourneyRunIdFromMetadata(metadata) ?? row.run_id ?? null,
      companyName: asString(metadata?.companyName),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      raw: metadata,
    },
    status: getRunStatus(sections),
    sections,
    latestEventBySection,
    eventsBySection,
    artifactsBySection,
    artifactsByTool: groupArtifactsByTool(artifactsBySection, activityBySection),
    messages: normalizeMessages(row.messages),
    readiness: getResearchPipelineReadiness(rawResearchResults),
  };
}

export async function getJourneyRunView(
  userId: string,
  runId?: string | null,
): Promise<JourneyRunView | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from('journey_sessions')
    .select('id, profile_id, metadata, research_results, job_status, messages, updated_at, run_id, created_at')
    .eq('user_id', userId);

  if (runId) {
    query = query.eq('run_id', runId);
  } else {
    query = query.order('created_at', { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new JourneyRunViewLoadError(userId, runId ?? null, error.message);
  }

  return data ? buildJourneyRunView(data as JourneySessionRunRow) : null;
}
