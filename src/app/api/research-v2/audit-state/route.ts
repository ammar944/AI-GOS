// GET /api/research-v2/audit-state?run_id=<uuid>
//
// Live state of the orchestrator run for AgentArtifactSurface — six worker
// chips + the projected per-zone artifact body. The UI polls this until all
// chips are terminal. Pure read: query research_section_runs +
// research_artifact_sections under the parent.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  isPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import type {
  AllPositioningSectionId,
  PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { createAdminClient } from '@/lib/supabase/server';

export type WorkerStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'error'
  | 'aborted';

export type AuditSectionPhase =
  | 'Queued'
  | 'Compiling context'
  | 'Reading sources'
  | 'Drafting'
  | 'Validating'
  | 'Draft ready'
  | 'Committed'
  | 'Needs review';

export interface SectionEvent {
  id: string;
  event_type: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface SectionRuntimeTimings {
  sectionStartedAt?: string;
  firstPartialAt?: string;
  finalObjectAt?: string;
  validationCompleteAt?: string;
  timeoutFiredAt?: string;
  abortSignalObservedAt?: string;
  commitStartedAt?: string;
  commitCompleteAt?: string;
  terminalStatusWrittenAt?: string;
}

export interface AuditStateResponse {
  parent_audit_run_id: string | null;
  parent_status: string | null;
  children_complete: number;
  children_total: number;
  workerStates: Array<{
    section_id: AllPositioningSectionId;
    status: WorkerStatus;
    phase: AuditSectionPhase;
    phaseLabel: AuditSectionPhase;
    phaseStartedAt: string | null;
    latestTool: string | null;
    latestSource: string | null;
    latestActivity: string | null;
    nextStep: string | null;
    wave: number | null;
    totalWaves: number | null;
    concurrency: number | null;
    elapsedMs: number | null;
    capabilityGaps: Array<Record<string, unknown>>;
    executionMode: 'draft' | 'deep' | 'lab' | null;
    runtimeTimings: SectionRuntimeTimings;
  }>;
  sectionsByZone: Record<
    string,
    { markdown?: string; title?: string; data?: unknown }
  >;
  /**
   * P2a — live agent-activity feed per zone. Up to the 12 most recent
   * events per zone, ordered ascending so a render-time `.slice(-N)` is
   * cheap. Populated only while a section is non-terminal; the UI uses
   * these to show a Claude.ai-style live activity panel during the run.
   */
  eventsByZone: Record<string, SectionEvent[]>;
}

const TERMINAL: ReadonlySet<string> = new Set(['complete', 'error', 'aborted']);
const PHASES: ReadonlySet<string> = new Set([
  'Queued',
  'Compiling context',
  'Reading sources',
  'Drafting',
  'Validating',
  'Draft ready',
  'Committed',
  'Needs review',
]);

function normalizeStatus(raw: unknown): WorkerStatus {
  if (typeof raw !== 'string') return 'queued';
  if (raw === 'running' || raw === 'complete' || raw === 'error' || raw === 'aborted') {
    return raw;
  }
  return 'queued';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function defaultPhaseForStatus(
  status: WorkerStatus,
  executionMode: 'draft' | 'deep' | 'lab' | null,
): AuditSectionPhase {
  if (status === 'complete' && executionMode === 'draft') return 'Draft ready';
  if (status === 'complete') return 'Committed';
  if (status === 'error' || status === 'aborted') return 'Needs review';
  if (status === 'running') return 'Reading sources';
  return 'Queued';
}

function normalizePhase(
  raw: unknown,
  status: WorkerStatus,
  executionMode: 'draft' | 'deep' | 'lab' | null,
): AuditSectionPhase {
  if (status === 'complete' && executionMode === 'draft') return 'Draft ready';
  if (status === 'error' || status === 'aborted') return 'Needs review';
  const phase = pickString(raw);
  if (phase && PHASES.has(phase)) return phase as AuditSectionPhase;
  return defaultPhaseForStatus(status, executionMode);
}

function normalizeCapabilityGaps(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
}

interface WorkerStateReadModel {
  status: WorkerStatus;
  phase: AuditSectionPhase;
  phaseLabel: AuditSectionPhase;
  phaseStartedAt: string | null;
  latestTool: string | null;
  latestSource: string | null;
  latestActivity: string | null;
  nextStep: string | null;
  wave: number | null;
  totalWaves: number | null;
  concurrency: number | null;
  elapsedMs: number | null;
  capabilityGaps: Array<Record<string, unknown>>;
  executionMode: 'draft' | 'deep' | 'lab' | null;
  runtimeTimings: SectionRuntimeTimings;
}

interface EventDerivedWorkerSignal {
  latestTool: string | null;
  latestSource: string | null;
  capabilityGaps: Array<Record<string, unknown>>;
}

function normalizeExecutionMode(value: unknown): 'draft' | 'deep' | 'lab' | null {
  return value === 'draft' || value === 'deep' || value === 'lab'
    ? value
    : null;
}

function normalizeRuntimeTimings(value: unknown): SectionRuntimeTimings {
  const raw = asRecord(value);
  if (!raw) return {};
  const out: SectionRuntimeTimings = {};
  const keys = [
    'sectionStartedAt',
    'firstPartialAt',
    'finalObjectAt',
    'validationCompleteAt',
    'timeoutFiredAt',
    'abortSignalObservedAt',
    'commitStartedAt',
    'commitCompleteAt',
    'terminalStatusWrittenAt',
  ] as const;
  for (const key of keys) {
    const timestamp = pickString(raw[key]);
    if (timestamp) out[key] = timestamp;
  }
  return out;
}

function getEventMetadata(
  payload: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!payload) return null;
  return asRecord(payload.metadata) ?? payload;
}

function buildEventsByZone(rows: readonly unknown[]): Record<string, SectionEvent[]> {
  const eventsByZone: Record<string, SectionEvent[]> = {};
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const zone = pickString(record.zone);
    const id = pickString(record.id);
    const eventType = pickString(record.event_type);
    const createdAt = pickString(record.created_at);
    if (!zone || !id || !eventType || !createdAt) continue;
    const event: SectionEvent = {
      id,
      event_type: eventType,
      message: pickString(record.message),
      payload: asRecord(record.payload),
      created_at: createdAt,
    };
    if (!eventsByZone[zone]) eventsByZone[zone] = [];
    if (eventsByZone[zone].length < 12) eventsByZone[zone].push(event);
  }
  for (const zone of Object.keys(eventsByZone)) {
    eventsByZone[zone].reverse();
  }
  return eventsByZone;
}

function buildEventSignalsByZone(
  eventsByZone: Record<string, SectionEvent[]>,
): Map<string, EventDerivedWorkerSignal> {
  const signalsByZone = new Map<string, EventDerivedWorkerSignal>();

  for (const [zone, events] of Object.entries(eventsByZone)) {
    let latestTool: string | null = null;
    let latestSource: string | null = null;
    const capabilityGaps: Array<Record<string, unknown>> = [];
    let hasToolEvent = false;

    for (const event of events) {
      if (
        event.event_type !== 'tool-started' &&
        event.event_type !== 'tool-finished'
      ) {
        continue;
      }
      const metadata = getEventMetadata(event.payload);
      if (!metadata) continue;
      const toolName = pickString(metadata.toolName);
      const source = pickString(metadata.sourceUrl) ?? pickString(metadata.query);
      if (toolName || source) {
        hasToolEvent = true;
        latestTool = toolName ?? latestTool;
        latestSource = source ?? latestSource;
      }
      if (event.event_type === 'tool-finished') {
        const gap = asRecord(metadata.gap);
        if (gap) capabilityGaps.push(gap);
      }
    }

    if (hasToolEvent || capabilityGaps.length > 0) {
      signalsByZone.set(zone, {
        latestTool,
        latestSource,
        capabilityGaps,
      });
    }
  }

  return signalsByZone;
}

function buildWorkerStateReadModel(
  row: {
    status?: unknown;
    telemetry?: unknown;
  },
  eventSignal?: EventDerivedWorkerSignal,
): WorkerStateReadModel {
  const status = normalizeStatus(row.status);
  const telemetry = asRecord(row.telemetry) ?? {};
  const executionMode = normalizeExecutionMode(telemetry.executionMode);
  const phase = normalizePhase(telemetry.phase, status, executionMode);

  return {
    status,
    phase,
    phaseLabel: phase,
    phaseStartedAt: pickString(telemetry.phaseStartedAt),
    latestTool: eventSignal
      ? eventSignal.latestTool
      : pickString(telemetry.latestTool),
    latestSource: eventSignal
      ? eventSignal.latestSource
      : pickString(telemetry.latestSource),
    latestActivity: pickString(telemetry.latestActivity),
    nextStep: pickString(telemetry.nextStep),
    wave: pickNumber(telemetry.wave),
    totalWaves: pickNumber(telemetry.totalWaves),
    concurrency: pickNumber(telemetry.concurrency),
    elapsedMs: pickNumber(telemetry.elapsedMs),
    capabilityGaps: eventSignal
      ? eventSignal.capabilityGaps
      : normalizeCapabilityGaps(telemetry.capabilityGaps),
    executionMode,
    runtimeTimings: normalizeRuntimeTimings(telemetry.runtimeTimings),
  };
}

function queuedWorkerState(): WorkerStateReadModel {
  return buildWorkerStateReadModel({ status: 'queued', telemetry: null });
}

function deriveParentStatus(
  parentStatus: string | null,
  workerStates: AuditStateResponse['workerStates'],
): string | null {
  const positioningWorkerStates = workerStates.filter(
    (
      worker,
    ): worker is AuditStateResponse['workerStates'][number] & {
      section_id: PositioningSectionId;
    } => isPositioningSectionId(worker.section_id),
  );

  if (
    positioningWorkerStates.length === POSITIONING_SECTION_IDS.length &&
    positioningWorkerStates.every((worker) => worker.status === 'complete')
  ) {
    return 'complete';
  }

  return parentStatus;
}

export async function GET(req: Request): Promise<NextResponse<AuditStateResponse | { error: string }>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const runId = url.searchParams.get('run_id');
  if (!runId) {
    return NextResponse.json({ error: 'run_id required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: parent, error: parentErr } = await supabase
    .from('research_artifacts')
    .select('id, status, children_total, children_complete')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (parentErr) {
    console.warn('[audit-state] parent lookup failed:', parentErr.message);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  if (!parent) {
    return NextResponse.json(
      {
        parent_audit_run_id: null,
        parent_status: null,
        children_complete: 0,
        children_total: 0,
        workerStates: POSITIONING_SECTION_IDS.map((section_id) => ({
          section_id,
          ...queuedWorkerState(),
        })),
        sectionsByZone: {},
        eventsByZone: {},
      },
      { status: 200 },
    );
  }

  const parentId = parent.id as string;

  const [runsResp, sectionsResp] = await Promise.all([
    supabase
      .from('research_section_runs')
      .select('id, zone, status, started_at, telemetry')
      .eq('artifact_id', parentId)
      .order('started_at', { ascending: false }),
    supabase
      .from('research_artifact_sections')
      .select('zone, section_run_id, status, title, markdown, data')
      .eq('artifact_id', parentId),
  ]);

  if (runsResp.error || sectionsResp.error) {
    console.warn(
      '[audit-state] children lookup failed:',
      runsResp.error?.message ?? sectionsResp.error?.message,
    );
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }

  const committedCompleteSectionRunByZone = new Map<string, string>();
  for (const row of sectionsResp.data ?? []) {
    const zone = row.zone as string;
    const status = row.status as string | null;
    const sectionRunId =
      typeof row.section_run_id === 'string' ? row.section_run_id : null;
    if (sectionRunId && status === 'complete') {
      committedCompleteSectionRunByZone.set(zone, sectionRunId);
    }
  }

  const runRows = (runsResp.data ?? []).map((row) => ({
    id: row.id as string,
    zone: row.zone as string,
    status: row.status,
    telemetry: row.telemetry,
  }));

  // Pick an active run first. If all runs are terminal, prefer the run that
  // the committed artifact section currently references instead of an older
  // terminal row.
  const byZone = new Map<string, WorkerStateReadModel>();
  const sectionRows = sectionsResp.data ?? [];
  const hasPaidMediaPlanRow =
    runRows.some((row) => row.zone === PAID_MEDIA_PLAN_SECTION_ID) ||
    sectionRows.some((row) => row.zone === PAID_MEDIA_PLAN_SECTION_ID);
  const workerSectionIds: readonly AllPositioningSectionId[] = hasPaidMediaPlanRow
    ? [...POSITIONING_SECTION_IDS, PAID_MEDIA_PLAN_SECTION_ID]
    : POSITIONING_SECTION_IDS;
  const eventLimit = 12 * workerSectionIds.length;
  const eventsResp = await supabase
    .from('research_section_events')
    .select('id, zone, event_type, message, payload, created_at')
    .eq('artifact_id', parentId)
    .order('created_at', { ascending: false })
    .limit(eventLimit);
  if (eventsResp.error) {
    // Events are best-effort — log and continue with empty events.
    console.warn('[audit-state] events lookup failed:', eventsResp.error.message);
  }
  const eventsByZone = buildEventsByZone(eventsResp.data ?? []);
  const eventSignalsByZone = buildEventSignalsByZone(eventsByZone);

  for (const sectionId of workerSectionIds) {
    const rowsForZone = runRows.filter((row) => row.zone === sectionId);
    const committedRunId = committedCompleteSectionRunByZone.get(sectionId);
    const committed = committedRunId
      ? rowsForZone.find((row) => row.id === committedRunId)
      : null;
    const active = rowsForZone.find((row) => !TERMINAL.has(normalizeStatus(row.status)));
    const selected =
      active && normalizeStatus(active.status) === 'running'
        ? active
        : committed ?? active ?? rowsForZone[0] ?? null;
    if (!selected) continue;
    byZone.set(
      sectionId,
      buildWorkerStateReadModel(
        {
          status: selected.status,
          telemetry: selected.telemetry,
        },
        eventSignalsByZone.get(sectionId),
      ),
    );
  }

  const sectionsByZone: AuditStateResponse['sectionsByZone'] = {};
  for (const row of sectionRows) {
    const zone = row.zone as string;
    const status = row.status as string | null;
    const title = row.title as string | null | undefined;
    const markdown = row.markdown as string | null | undefined;
    const typedData = row.data as unknown;
    const hasTypedData = typedData !== null && typedData !== undefined;
    if (status === 'complete' && (markdown || title || hasTypedData)) {
      sectionsByZone[zone] = {
        ...(title ? { title } : {}),
        ...(markdown ? { markdown } : {}),
        ...(hasTypedData ? { data: typedData } : {}),
      };
    }
  }

  const workerStates = workerSectionIds.map((section_id) => ({
    section_id,
    ...(byZone.get(section_id) ?? queuedWorkerState()),
  }));
  const derivedChildrenComplete = workerStates.filter(
    (worker) =>
      isPositioningSectionId(worker.section_id) && worker.status === 'complete',
  ).length;
  const childrenComplete = Math.max(
    (parent.children_complete as number | null) ?? 0,
    derivedChildrenComplete,
  );
  const childrenTotal =
    (parent.children_total as number | null) ?? POSITIONING_SECTION_IDS.length;
  const parentStatus = deriveParentStatus(
    (parent.status as string | null) ?? null,
    workerStates,
  );

  return NextResponse.json(
    {
      parent_audit_run_id: parentId,
      parent_status: parentStatus,
      children_complete: childrenComplete,
      children_total: childrenTotal,
      workerStates,
      sectionsByZone,
      eventsByZone,
    },
    { status: 200 },
  );
}
