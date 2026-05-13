// GET /api/research-v2/audit-state?run_id=<uuid>
//
// Live state of the orchestrator run for AgentArtifactSurface — six worker
// chips + the projected per-zone artifact body. The UI polls this until all
// chips are terminal. Pure read: query research_section_runs +
// research_artifact_sections under the parent.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { createAdminClient } from '@/lib/supabase/server';

export type WorkerStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'error'
  | 'aborted';

export interface SectionEvent {
  id: string;
  event_type: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditStateResponse {
  parent_audit_run_id: string | null;
  parent_status: string | null;
  children_complete: number;
  children_total: number;
  workerStates: Array<{
    section_id: PositioningSectionId;
    status: WorkerStatus;
  }>;
  sectionsByZone: Record<string, { markdown?: string; title?: string }>;
  /**
   * P2a — live agent-activity feed per zone. Up to the 12 most recent
   * events per zone, ordered ascending so a render-time `.slice(-N)` is
   * cheap. Populated only while a section is non-terminal; the UI uses
   * these to show a Claude.ai-style live activity panel during the run.
   */
  eventsByZone: Record<string, SectionEvent[]>;
}

const TERMINAL: ReadonlySet<string> = new Set(['complete', 'error', 'aborted']);

function normalizeStatus(raw: unknown): WorkerStatus {
  if (typeof raw !== 'string') return 'queued';
  if (raw === 'running' || raw === 'complete' || raw === 'error' || raw === 'aborted') {
    return raw;
  }
  return 'queued';
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
          status: 'queued' as WorkerStatus,
        })),
        sectionsByZone: {},
        eventsByZone: {},
      },
      { status: 200 },
    );
  }

  const parentId = parent.id as string;

  const [runsResp, sectionsResp, eventsResp] = await Promise.all([
    supabase
      .from('research_section_runs')
      .select('zone, status, started_at')
      .eq('artifact_id', parentId)
      .order('started_at', { ascending: true }),
    supabase
      .from('research_artifact_sections')
      .select('zone, status, title, markdown')
      .eq('artifact_id', parentId),
    // P2a — last 60 events across all zones for this parent run (cap so a
    // single request never balloons; the 6 zones × ~10 events each fit
    // comfortably). Ordered ascending so the UI can render chronologically.
    supabase
      .from('research_section_events')
      .select('id, zone, event_type, message, payload, created_at')
      .eq('artifact_id', parentId)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  if (runsResp.error || sectionsResp.error) {
    console.warn(
      '[audit-state] children lookup failed:',
      runsResp.error?.message ?? sectionsResp.error?.message,
    );
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  if (eventsResp.error) {
    // Events are best-effort — log and continue with empty events.
    console.warn('[audit-state] events lookup failed:', eventsResp.error.message);
  }

  // Pick the most recent non-terminal run per zone for the chip; fall back
  // to the latest row if all are terminal.
  const byZone = new Map<string, WorkerStatus>();
  for (const row of runsResp.data ?? []) {
    const zone = row.zone as string;
    const status = normalizeStatus(row.status);
    const current = byZone.get(zone);
    if (!current) {
      byZone.set(zone, status);
      continue;
    }
    // Prefer non-terminal; otherwise keep first.
    if (TERMINAL.has(current) && !TERMINAL.has(status)) {
      byZone.set(zone, status);
    }
  }

  const sectionsByZone: Record<string, { markdown?: string; title?: string }> = {};
  for (const row of sectionsResp.data ?? []) {
    const zone = row.zone as string;
    const status = row.status as string | null;
    const title = row.title as string | null | undefined;
    const markdown = row.markdown as string | null | undefined;
    if (status === 'complete' && (markdown || title)) {
      sectionsByZone[zone] = {
        ...(title ? { title } : {}),
        ...(markdown ? { markdown } : {}),
      };
    }
  }

  const workerStates = POSITIONING_SECTION_IDS.map((section_id) => ({
    section_id,
    status: byZone.get(section_id) ?? ('queued' as WorkerStatus),
  }));

  // P2a — group events by zone, cap at 12 newest per zone (events came
  // back ordered desc by created_at — we re-sort ascending so the UI
  // shows chronological flow).
  const eventsByZone: Record<string, SectionEvent[]> = {};
  for (const row of eventsResp.data ?? []) {
    const zone = row.zone as string;
    const event: SectionEvent = {
      id: row.id as string,
      event_type: row.event_type as string,
      message: (row.message as string | null) ?? null,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
      created_at: row.created_at as string,
    };
    if (!eventsByZone[zone]) eventsByZone[zone] = [];
    if (eventsByZone[zone].length < 12) eventsByZone[zone].push(event);
  }
  for (const zone of Object.keys(eventsByZone)) {
    eventsByZone[zone].reverse();
  }

  return NextResponse.json(
    {
      parent_audit_run_id: parentId,
      parent_status: (parent.status as string | null) ?? null,
      children_complete: (parent.children_complete as number | null) ?? 0,
      children_total: (parent.children_total as number | null) ?? 0,
      workerStates,
      sectionsByZone,
      eventsByZone,
    },
    { status: 200 },
  );
}
