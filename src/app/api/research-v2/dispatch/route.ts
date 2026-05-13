// Research-v2 dispatch route — Pre-Pitch Positioning Audit (6 sections).
//
// Body: { runId, sectionId, context? }
// - sectionId: one of POSITIONING_SECTION_IDS.
// - context: optional. When omitted, the dispatch service still injects
//   prior research, reference docs, meeting intel, and identity classifications
//   from the existing buildJourneyResearchDispatchContext path.
// - runId: required so writes land on the active journey session row.
//
// Idempotency: before proxying to the worker, read the section's current
// status from journey_sessions.research_results[sectionId]. Already-running
// → 409. Already-complete → 200 with the existing payload status. Otherwise
// proceed via the existing dispatchJourneyResearchForUser pipeline (which
// also stamps activeJourneyRunId, prevents stale writes, and forwards to the
// Railway worker /run endpoint).

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  POSITIONING_SECTION_IDS,
} from '@/lib/ai/prompts/positioning-skills';
import {
  dispatchJourneyResearchForUser,
  SECTION_TO_TOOL,
} from '@/lib/journey/server/dispatch-research';
import { createAdminClient } from '@/lib/supabase/server';

const ACCEPTED_DISPATCH_SECTIONS = [
  'deepResearchProgram',
  ...POSITIONING_SECTION_IDS,
] as const;
type AcceptedDispatchSection = (typeof ACCEPTED_DISPATCH_SECTIONS)[number];

function isAcceptedDispatchSection(value: string): value is AcceptedDispatchSection {
  return (ACCEPTED_DISPATCH_SECTIONS as readonly string[]).includes(value);
}

interface ResearchV2DispatchRequest {
  runId?: unknown;
  sectionId?: unknown;
  context?: unknown;
  chatRefinement?: unknown;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

interface ExistingSectionStatus {
  status: 'running' | 'complete' | 'partial' | 'error' | 'unknown';
  hasMarkdown: boolean;
}

interface JobStatusEntry {
  status?: string;
  tool?: string;
  startedAt?: string;
}

// Mirror of research-worker TOOL_STALE_THRESHOLDS. The dispatch route uses
// these to ignore stale 'running' job_status rows left behind by a crashed
// worker (the worker's own in-memory stale-check only runs while the
// process is alive).
const STALE_THRESHOLD_MS = 300_000; // 5 min default — match worker value
const TOOL_STALE_THRESHOLDS: Record<string, number> = {
  runDeepResearchProgram: 900_000, // 15 min — corpus extraction is slow
};

async function readSectionStatus(
  userId: string,
  runId: string,
  sectionId: string,
): Promise<ExistingSectionStatus | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    console.warn(
      `[research-v2] Failed to read existing status for ${sectionId}:`,
      error.message,
    );
    return null;
  }

  const results = data?.research_results as
    | Record<string, { status?: string; artifact?: { markdown?: string } }>
    | null
    | undefined;
  const entry = results?.[sectionId];
  if (!entry) {
    return null;
  }

  const status =
    typeof entry.status === 'string' &&
    ['running', 'complete', 'partial', 'error'].includes(entry.status)
      ? (entry.status as ExistingSectionStatus['status'])
      : 'unknown';
  const hasMarkdown = Boolean(entry.artifact?.markdown);

  return { status, hasMarkdown };
}

/**
 * Look up the journey_sessions.job_status JSONB column for an active worker
 * job targeting `sectionId`. Returns the jobId of the first running entry, or
 * null when no active job exists. Used to block duplicate reruns while a
 * worker is already in flight for the same section.
 */
async function findActiveJobForSection(
  userId: string,
  runId: string,
  sectionId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('job_status')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    console.warn(
      `[research-v2] Failed to read job_status for active-job check on ${sectionId}:`,
      error.message,
    );
    return null;
  }

  const jobStatus = data?.job_status as Record<string, JobStatusEntry> | null;
  if (!jobStatus) return null;

  // Translate dispatch sectionId → worker tool name. The worker persists
  // job_status[jobId].tool using the worker tool name (e.g.
  // 'runDeepResearchProgram'), not the dispatch sectionId
  // ('deepResearchProgram'). Fall back to sectionId so unknown sections
  // still get the (loose) guard rather than no guard.
  const toolName =
    (SECTION_TO_TOOL as Record<string, string>)[sectionId] ?? sectionId;

  const now = Date.now();
  for (const [jobId, entry] of Object.entries(jobStatus)) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      entry.status !== 'running' ||
      entry.tool !== toolName
    ) {
      continue;
    }

    const threshold =
      TOOL_STALE_THRESHOLDS[toolName] ?? STALE_THRESHOLD_MS;
    const startedAtMs =
      typeof entry.startedAt === 'string'
        ? Date.parse(entry.startedAt)
        : NaN;

    if (!Number.isFinite(startedAtMs)) {
      // Missing/unparseable startedAt — fail open on retry rather than
      // blocking forever.
      console.warn(
        '[research-v2] Ignoring running job with missing/unparseable startedAt',
        {
          jobId,
          sectionId,
          toolName,
          tool: entry.tool,
          startedAt: entry.startedAt,
        },
      );
      continue;
    }

    const ageMs = now - startedAtMs;
    if (ageMs > threshold) {
      console.warn('[research-v2] Ignoring stale running job', {
        jobId,
        sectionId,
        toolName,
        tool: entry.tool,
        ageMs,
        threshold,
      });
      continue;
    }

    return jobId;
  }
  return null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as ResearchV2DispatchRequest;
  const sectionId = readString(body.sectionId);
  const runId = readString(body.runId);
  const context = readString(body.context) ?? '';
  const chatRefinement = readString(body.chatRefinement);

  if (!sectionId || !runId) {
    return NextResponse.json(
      {
        error: 'Missing required fields: runId, sectionId',
        sectionIds: ACCEPTED_DISPATCH_SECTIONS,
      },
      { status: 400 },
    );
  }

  if (!isAcceptedDispatchSection(sectionId)) {
    return NextResponse.json(
      {
        error: `Unknown sectionId: ${sectionId}`,
        sectionIds: ACCEPTED_DISPATCH_SECTIONS,
      },
      { status: 400 },
    );
  }

  const existing = await readSectionStatus(userId, runId, sectionId);
  if (existing?.status === 'running') {
    return NextResponse.json(
      { status: 'already_running', sectionId, runId },
      { status: 409 },
    );
  }

  // Defense-in-depth: research_results[section].status is only written at
  // completion, so it can't catch a dispatch that races with an in-flight
  // worker. journey_sessions.job_status is the authoritative in-flight
  // signal — check it for both chat reruns and normal-path dispatches
  // (e.g. a manual "Run section" click during the post-onboarding fan-out
  // window, where the sections view briefly renders idle buttons before polling
  // sees the queued jobs).
  const activeJobId = await findActiveJobForSection(userId, runId, sectionId);
  if (activeJobId) {
    return NextResponse.json(
      {
        error: 'section already running',
        sectionId,
        runId,
        jobId: activeJobId,
      },
      { status: 409 },
    );
  }

  // Chat-driven reruns intentionally bypass the already_complete short-circuit:
  // the operator explicitly asked the chat to re-run this section with a new
  // refinement, so we must re-dispatch even if a prior artifact exists.
  if (existing?.status === 'complete' && existing.hasMarkdown && !chatRefinement) {
    return NextResponse.json(
      { status: 'already_complete', sectionId, runId },
      { status: 200 },
    );
  }

  const result = await dispatchJourneyResearchForUser({
    userId,
    section: sectionId,
    runId,
    context,
    ...(chatRefinement ? { chatRefinement } : {}),
  });

  return NextResponse.json(result);
}
