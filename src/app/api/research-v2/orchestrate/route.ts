// Phase 1 of the orchestrator + artifact UI cycle.
//
// POST /api/research-v2/orchestrate
//
// Body: { journey_session_id: uuid, run_id: uuid }
// Returns 200: { parent_audit_run_id, section_run_ids[6] }
// Returns 400: malformed body (Zod failure).
// Returns 401: no Clerk user.
// Returns 404: session_id is not owned by the Clerk user.
// Returns 409: deepResearchProgram corpus has not finished yet.
//
// Idempotent: a second call with the same (journey_session_id, run_id) returns
// the same parent_audit_run_id and the same six section_run_ids — guaranteed
// by the seed_orchestration Postgres RPC.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { runSection } from '@/lib/lab-engine/agents/run-section';
import type { RunStore } from '@/lib/lab-engine/runs/run-store';
import {
  isSupportedSectionId,
  type SupportedSectionId,
} from '@/lib/lab-engine/sections/section-registry';
import { startManagedAudit } from '@/lib/managed-agents/start-audit';
import { corpusToResearchInput } from '@/lib/research-v2/corpus-to-research-input';
import {
  freezeReviewedBriefSnapshot,
  OrchestrateRpcError,
  type SeedOrchestrationResult,
  seedOrchestration,
} from '@/lib/research-v2/orchestrate-db';
import { createSupabaseRunStore } from '@/lib/research-v2/supabase-run-store';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const RequestSchema = z
  .object({
    run_id: z.string().uuid(),
    journey_session_id: z.string().uuid().optional(),
    // 'managed' is gated behind MANAGED_AGENTS_POSITIONING_ENABLED; Phase 3
    // will flip the default away from 'deep'.
    executionMode: z.enum(['draft', 'deep', 'managed', 'lab']).optional(),
  })
  .passthrough();

function managedAgentsPositioningEnabled(): boolean {
  return process.env.MANAGED_AGENTS_POSITIONING_ENABLED === 'true';
}

interface JourneySessionRow {
  id: string;
  user_id: string;
  run_id: string | null;
  research_results: Record<string, unknown> | null;
  onboarding_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

async function loadOwnedSession(
  userId: string,
  runId: string,
): Promise<JourneySessionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id,user_id,run_id,research_results,onboarding_data,metadata')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    console.warn('[orchestrate] journey_sessions read failed:', error.message);
    return null;
  }
  return (data as JourneySessionRow | null) ?? null;
}

function corpusReady(session: JourneySessionRow): boolean {
  const results = session.research_results ?? {};
  const corpus = asRecord(results['deepResearchProgram']);
  return corpus?.status === 'complete';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getOnboardingReviewMetadata(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  return asRecord(metadata?.researchV2OnboardingReview);
}

function getDeepResearchProgramData(session: JourneySessionRow): unknown | null {
  const result = asRecord(session.research_results?.deepResearchProgram);
  return result?.data ?? null;
}

function buildSectionRunIdByZone(
  seeded: SeedOrchestrationResult,
): Record<PositioningSectionId, string> {
  const sectionRunIdByZone: Partial<Record<PositioningSectionId, string>> = {};

  for (const row of seeded.section_run_ids) {
    sectionRunIdByZone[row.section_id] = row.section_run_id;
  }

  for (const sectionId of POSITIONING_SECTION_IDS) {
    if (!sectionRunIdByZone[sectionId]) {
      throw new Error(`seed_orchestration did not return ${sectionId}`);
    }
  }

  return sectionRunIdByZone as Record<PositioningSectionId, string>;
}

function toSupportedSectionId(sectionId: PositioningSectionId): SupportedSectionId {
  if (!isSupportedSectionId(sectionId)) {
    throw new Error(`Unsupported lab section id ${sectionId}`);
  }

  return sectionId;
}

function getLabEngineAllowedTools(): readonly [] | undefined {
  return process.env.LAB_ENGINE_LIVE_TOOLS === 'true' ? undefined : [];
}

async function loadLabSkill(slug: string): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid lab skill slug ${slug}`);
  }

  const skillPath = join(
    process.cwd(),
    'src',
    'lib',
    'lab-engine',
    'skills',
    slug,
    'SKILL.md',
  );

  return readFile(skillPath, 'utf8');
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const currentTask = task(item).finally(() => {
      executing.delete(currentTask);
    });
    executing.add(currentTask);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function runLabSection(input: {
  runId: string;
  sectionId: PositioningSectionId;
  store: RunStore;
}): Promise<void> {
  const sectionId = toSupportedSectionId(input.sectionId);

  try {
    await runSection(
      { runId: input.runId, sectionId },
      {
        store: input.store,
        loadSkill: loadLabSkill,
        allowedTools: getLabEngineAllowedTools(),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[orchestrate:lab] section failed', {
      runId: input.runId,
      sectionId: input.sectionId,
      message,
    });
    await input.store.markSectionFailed(input.runId, sectionId, message);
  }
}

async function runLabOrchestration(input: {
  runId: string;
  seeded: SeedOrchestrationResult;
  session: JourneySessionRow;
}): Promise<void> {
  const deepResearchProgramData = getDeepResearchProgramData(input.session);

  if (deepResearchProgramData === null) {
    throw new Error(
      `deepResearchProgram status is complete for run ${input.runId}, but data is missing`,
    );
  }

  const researchInput = corpusToResearchInput({
    runId: input.runId,
    deepResearchProgramData,
    onboardingData: input.session.onboarding_data ?? {},
  });
  const store = createSupabaseRunStore({
    supabase: createAdminClient(),
    parentAuditRunId: input.seeded.parent_audit_run_id,
    sectionRunIdByZone: buildSectionRunIdByZone(input.seeded),
    researchInput,
  });
  await store.createRun(researchInput);

  await runWithConcurrency(POSITIONING_SECTION_IDS, 3, (sectionId) =>
    runLabSection({
      runId: input.runId,
      sectionId,
      store,
    }),
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let userId: string | null;
  try {
    const result = await auth();
    userId = result.userId ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'request body must be JSON' },
      { status: 400 },
    );
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'invalid_body', issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const session = await loadOwnedSession(userId, body.run_id);
  if (!session) {
    return NextResponse.json(
      { error: 'session_not_found' },
      { status: 404 },
    );
  }

  if (!corpusReady(session)) {
    return NextResponse.json(
      {
        error: 'corpus_not_ready',
        message: 'deepResearchProgram corpus must finish before orchestrating',
      },
      { status: 409 },
    );
  }

  try {
    // Managed Agents is the default path when the feature flag is on.
    // Frontend dispatch sites send only { run_id }, so the default fires
    // there. Explicit body.executionMode ('draft' | 'deep' | 'managed' | 'lab')
    // still wins — used by tests and the rerun-section flow.
    const effectiveExecutionMode =
      body.executionMode
      ?? (managedAgentsPositioningEnabled() ? 'managed' : 'draft');

    if (effectiveExecutionMode === 'managed') {
      if (!managedAgentsPositioningEnabled()) {
        return NextResponse.json(
          {
            error: 'managed_agents_disabled',
            message:
              'executionMode=managed requires MANAGED_AGENTS_POSITIONING_ENABLED=true',
          },
          { status: 403 },
        );
      }
      const managed = await startManagedAudit({
        userId,
        runId: body.run_id,
        gtmBrief: session.onboarding_data ?? {},
        corpusExcerpt:
          (session.research_results?.['deepResearchProgram'] as Record<
            string,
            unknown
          > | null) ?? null,
      });
      await freezeReviewedBriefSnapshot({
        parentAuditRunId: managed.parentAuditRunId,
        gtmBriefSnapshot: session.onboarding_data ?? {},
        gtmBriefReview: getOnboardingReviewMetadata(session.metadata),
      });
      return NextResponse.json(
        {
          parent_audit_run_id: managed.parentAuditRunId,
          section_run_ids: managed.sectionRunIds.map((row) => ({
            section_id: row.sectionId,
            section_run_id: row.sectionRunId,
            ordinal: row.ordinal,
            reused: row.reused,
          })),
          managed_agents: {
            session_id: managed.sessionId,
            coordinator_agent_id: managed.coordinatorAgentId,
            environment_id: managed.environmentId,
            specialist_agent_ids: managed.specialistAgentIds,
          },
        },
        { status: 200 },
      );
    }

    const seeded = await seedOrchestration({
      userId,
      runId: body.run_id,
      zones: POSITIONING_SECTION_IDS,
    });

    await freezeReviewedBriefSnapshot({
      parentAuditRunId: seeded.parent_audit_run_id,
      gtmBriefSnapshot: session.onboarding_data ?? {},
      gtmBriefReview: getOnboardingReviewMetadata(session.metadata),
    });

    if (effectiveExecutionMode === 'lab') {
      await runLabOrchestration({
        runId: body.run_id,
        seeded,
        session,
      });
      return NextResponse.json(seeded, { status: 200 });
    }

    const workerExecutionMode: 'draft' | 'deep' =
      effectiveExecutionMode === 'draft' || effectiveExecutionMode === 'deep'
        ? effectiveExecutionMode
        : 'deep';
    void kickoffWorker({
      parentAuditRunId: seeded.parent_audit_run_id,
      runId: body.run_id,
      executionMode: workerExecutionMode,
    });

    return NextResponse.json(seeded, { status: 200 });
  } catch (err) {
    if (err instanceof OrchestrateRpcError) {
      console.error('[orchestrate] seed_orchestration RPC failed:', err.message);
      return NextResponse.json(
        { error: 'seed_failed', message: err.message },
        { status: 500 },
      );
    }
    throw err;
  }
}

const WORKER_KICKOFF_TIMEOUT_MS = 5000;

async function kickoffWorker(input: {
  parentAuditRunId: string;
  runId: string;
  executionMode: 'draft' | 'deep';
}): Promise<void> {
  const workerUrl = process.env.RAILWAY_WORKER_URL?.trim();
  const workerKey = process.env.RAILWAY_API_KEY?.trim();
  if (!workerUrl || !workerKey) {
    console.warn(
      '[orchestrate] worker kickoff skipped — RAILWAY_WORKER_URL/RAILWAY_API_KEY missing',
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
        executionMode: input.executionMode,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(
        `[orchestrate] worker kickoff returned ${res.status} for run ${input.runId}: ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn(
      `[orchestrate] worker kickoff ${isAbort ? 'timed out' : 'failed'} for run ${input.runId}:`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}
