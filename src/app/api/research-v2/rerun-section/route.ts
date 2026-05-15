// Phase 5 — retry a single positioning section, optionally with the prior
// partial output as context.
//
// Body: { runId, zone, usePartialContext?, refinement? }
//
// Flow:
//   1. Best-effort abort the section's current section_run_id (idempotent —
//      a 404 or "no active run" is fine).
//   2. If usePartialContext is true, load the partial markdown from
//      research_artifact_sections and inject it into chatRefinement under
//      a stable <previous_attempt_partial> wrapper. The stable wrapper lets
//      Anthropic prompt-cache hits reuse the surrounding context across
//      retries within the 5-minute default TTL.
//   3. Seed only this zone and kick the worker /orchestrate path in deep
//      mode by default.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import {
  OrchestrateRpcError,
  seedOrchestration,
} from '@/lib/research-v2/orchestrate-db';
import { createAdminClient } from '@/lib/supabase/server';

const ABORT_TIMEOUT_MS = 3_000;
const WORKER_KICKOFF_TIMEOUT_MS = 5_000;
type ExecutionMode = 'draft' | 'deep';

interface RerunSectionRequest {
  runId?: unknown;
  zone?: unknown;
  executionMode?: unknown;
  usePartialContext?: unknown;
  refinement?: unknown;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function isPositioningZone(value: string): boolean {
  return (POSITIONING_SECTION_IDS as readonly string[]).includes(value);
}

function readExecutionMode(value: unknown): ExecutionMode {
  return value === 'draft' || value === 'deep' ? value : 'deep';
}

async function abortIfRunning(opts: {
  workerUrl: string;
  workerKey: string;
  sectionRunId: string;
}): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);
  try {
    await fetch(`${opts.workerUrl}/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.workerKey}`,
      },
      body: JSON.stringify({ sectionRunId: opts.sectionRunId }),
      signal: controller.signal,
    });
  } catch (err) {
    // Best-effort — a worker that's already dropped the controller is fine.
    console.warn('[rerun-section] /abort threw (best-effort):', err);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function kickoffWorker(input: {
  parentAuditRunId: string;
  zone: PositioningSectionId;
  executionMode: ExecutionMode;
  refinement?: string;
}): Promise<void> {
  const workerUrl = process.env.RAILWAY_WORKER_URL?.trim();
  const workerKey = process.env.RAILWAY_API_KEY?.trim();
  if (!workerUrl || !workerKey) {
    console.warn(
      '[rerun-section] worker kickoff skipped - RAILWAY_WORKER_URL/RAILWAY_API_KEY missing',
    );
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_KICKOFF_TIMEOUT_MS);
  try {
    const res = await fetch(`${workerUrl}/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerKey}`,
      },
      body: JSON.stringify({
        parent_audit_run_id: input.parentAuditRunId,
        zones: [input.zone],
        executionMode: input.executionMode,
        ...(input.refinement ? { refinement: input.refinement } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(
        `[rerun-section] worker kickoff returned ${res.status}: ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn(
      `[rerun-section] worker kickoff ${isAbort ? 'timed out' : 'failed'}:`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as RerunSectionRequest;
  const runId = readString(body.runId);
  const zone = readString(body.zone);
  const executionMode = readExecutionMode(body.executionMode);
  const usePartialContext = body.usePartialContext === true;
  const refinement = readString(body.refinement);

  if (!runId || !zone) {
    return NextResponse.json(
      { error: 'Missing required fields: runId, zone' },
      { status: 400 },
    );
  }
  if (!isPositioningZone(zone)) {
    return NextResponse.json(
      { error: `zone "${zone}" is not a positioning section` },
      { status: 400 },
    );
  }
  const positioningZone = zone as PositioningSectionId;

  const supabase = createAdminClient();
  const { data: artifact } = await supabase
    .from('research_artifacts')
    .select('id')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  let partialMarkdown: string | null = null;
  let activeSectionRunId: string | null = null;
  let sectionStatus: string | null = null;
  if (artifact) {
    const { data: section } = await supabase
      .from('research_artifact_sections')
      .select('section_run_id, markdown, status, error')
      .eq('artifact_id', artifact.id)
      .eq('zone', zone)
      .maybeSingle();

    if (section) {
      if (typeof section.section_run_id === 'string') {
        activeSectionRunId = section.section_run_id;
      }
      sectionStatus = typeof section.status === 'string' ? section.status : null;
      const errorPayload =
        section.error && typeof section.error === 'object'
          ? (section.error as Record<string, unknown>)
          : null;
      const wasPartial =
        errorPayload?.partial === true ||
        typeof errorPayload?.partialAt === 'number';
      if (
        usePartialContext &&
        wasPartial &&
        typeof section.markdown === 'string' &&
        section.markdown.trim().length > 0
      ) {
        partialMarkdown = section.markdown;
      }
    }
  }

  // Best-effort abort the prior run, but only if it's still active.
  // Calling /abort on a terminal run would stamp aborted_at onto a
  // historical row and confuse the canvas projector.
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  const workerKey = process.env.RAILWAY_API_KEY;
  if (
    workerUrl &&
    workerKey &&
    activeSectionRunId &&
    sectionStatus === 'running'
  ) {
    await abortIfRunning({
      workerUrl,
      workerKey,
      sectionRunId: activeSectionRunId,
    });
  }

  const refinementParts: string[] = [];
  if (refinement) refinementParts.push(refinement);
  if (partialMarkdown) {
    refinementParts.push(
      `<previous_attempt_partial>\n${partialMarkdown}\n</previous_attempt_partial>\n\nThe previous attempt failed before producing a complete envelope. Build on the snapshot above where it adds signal; replace anything you can improve. Produce a clean envelope — do not echo the partial verbatim.`,
    );
  }
  const chatRefinement =
    refinementParts.length > 0 ? refinementParts.join('\n\n') : undefined;

  try {
    const seeded = await seedOrchestration({
      userId,
      runId,
      zones: [positioningZone],
    });

    void kickoffWorker({
      parentAuditRunId: seeded.parent_audit_run_id,
      zone: positioningZone,
      executionMode,
      ...(chatRefinement ? { refinement: chatRefinement } : {}),
    });

    return NextResponse.json({
      ...seeded,
      executionMode,
    });
  } catch (err) {
    if (err instanceof OrchestrateRpcError) {
      console.error('[rerun-section] seed_orchestration RPC failed:', err.message);
      return NextResponse.json(
        { error: 'seed_failed', message: err.message },
        { status: 500 },
      );
    }
    throw err;
  }
}
