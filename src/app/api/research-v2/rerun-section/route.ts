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
//   3. Dispatch the section via the shared journey dispatch helper —
//      reuses the worker-bound enrichment + active-run stamping that the
//      regular /api/research-v2/dispatch path uses.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import { dispatchJourneyResearchForUser } from '@/lib/journey/server/dispatch-research';
import { createAdminClient } from '@/lib/supabase/server';

const ABORT_TIMEOUT_MS = 3_000;

interface RerunSectionRequest {
  runId?: unknown;
  zone?: unknown;
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

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as RerunSectionRequest;
  const runId = readString(body.runId);
  const zone = readString(body.zone);
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

  const result = await dispatchJourneyResearchForUser({
    userId,
    section: zone,
    runId,
    context: '',
    ...(chatRefinement ? { chatRefinement } : {}),
  });

  return NextResponse.json(result);
}
