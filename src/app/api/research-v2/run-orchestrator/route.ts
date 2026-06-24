// P4a — chained-lambda GLM orchestrator runner.
//
// POST /api/research-v2/run-orchestrator
//
// Body: { run_id: uuid, parent_audit_run_id: string }
// Returns 202: { ok: true, run_id } — ACKs fast, then runs the work in after().
// Returns 400: malformed body (Zod failure).
// Returns 401: no Clerk user.
// Returns 404: run is not owned by the Clerk user.
//
// /orchestrate seeds the orchestration (parent + 6 section run ids) and returns
// the seeded 200 immediately, then kicks this route off as a chained lambda so
// the long GLM orchestrator (~161-340s) never blocks /orchestrate's response.
// Mirrors /run-lab-section: ACK 202, defer the long job to Next.js after()
// (bounded by this route's maxDuration=800 on Vercel Pro + Fluid).
//
// The deferred work: run the GLM research orchestrator over the owned session's
// website + onboarding brief, promote its transcript facts to the shared
// research_facts ledger under the SAME parent_audit_run_id the sections filter
// on, then fan out the six positioning sections to /run-lab-section so they
// start AFTER the orchestrator facts are written (sections currently start cold;
// this seeds the ledger first).

import { auth } from '@clerk/nextjs/server';
import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import { jsonError, requireApiUser } from '@/lib/auth/app-access';
import {
  generateAgenticGLMOrchestrator,
  promoteOrchestratorFactsToLedger,
} from '@/lib/lab-engine/agents/orchestrator-glm';
import {
  createResearchArtifactsResearchFactStore,
  type ResearchFactsSupabaseClient,
} from '@/lib/lab-engine/evidence/research-fact';
import { loadOwnedResearchSession } from '@/lib/research-v2/orchestration-session';
import { persistOrchestratorEnrichment } from '@/lib/research-v2/orchestrator-enrichment';
import { broadcastSectionPartial } from '@/lib/research-v2/realtime-broadcast';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
// Vercel Pro + Fluid: 800s GA. The orchestrator (~161-340s) + the fast section
// fan-out kickoffs run inside after(), which is bounded by this budget.
export const maxDuration = 800;

// Keep the orchestrator's own deadline well under the 800s lambda budget so the
// abort fires (and fan-out still runs) before Vercel reclaims the invocation.
const ORCHESTRATOR_ABORT_MS = 700_000;

// Same fast-ACK kickoff budget /orchestrate uses: run-lab-section ACKs 202 in
// milliseconds (it defers the long job to after()).
const LAB_SECTION_KICKOFF_TIMEOUT_MS = 30_000;

const RequestSchema = z
  .object({
    run_id: z.string().uuid(),
    parent_audit_run_id: z.string().min(1),
  })
  .passthrough();

function buildForwardedLabSectionHeaders(
  request: Request,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');

  if (cookie) {
    headers.Cookie = cookie;
  }

  if (authorization) {
    headers.Authorization = authorization;
  }

  return headers;
}

function getWebsiteUrl(onboardingData: Record<string, unknown>): string {
  const direct = onboardingData.websiteUrl ?? onboardingData.website_url;
  return typeof direct === 'string' ? direct.trim() : '';
}

/**
 * Best-effort orchestrator progress broadcaster. The orchestrator runs
 * ~161-340s; this surfaces each gather step over the SAME Realtime channel the
 * UI already subscribes to for section partials (`section-partials:<runId>`),
 * under the reserved `orchestrator` sectionId so the operator sees gather
 * progress instead of a silent multi-minute gap. Never throws — a realtime
 * outage must not stall or fail the orchestrator loop.
 */
function makeOrchestratorProgressEmitter(
  runId: string,
): (step: unknown) => Promise<void> {
  let seq = 0;
  return async (step: unknown): Promise<void> => {
    seq += 1;
    const stepNumber =
      step !== null &&
      typeof step === 'object' &&
      typeof (step as { stepNumber?: unknown }).stepNumber === 'number'
        ? (step as { stepNumber: number }).stepNumber
        : seq - 1;
    try {
      await broadcastSectionPartial({
        runId,
        zone: 'orchestrator',
        sectionId: 'orchestrator',
        seq,
        snapshot: {
          phase: 'gathering',
          step: stepNumber,
          message: `Orchestrator gathering evidence (step ${stepNumber + 1})`,
        },
      });
    } catch (err) {
      console.warn('[run-orchestrator] progress broadcast failed', {
        runId,
        seq,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

async function kickoffLabSectionJob(input: {
  headers: Record<string, string>;
  runId: string;
  sectionId: (typeof POSITIONING_SECTION_IDS)[number];
  url: string;
}): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    LAB_SECTION_KICKOFF_TIMEOUT_MS,
  );

  try {
    const res = await fetch(input.url, {
      method: 'POST',
      headers: input.headers,
      body: JSON.stringify({
        run_id: input.runId,
        section_id: input.sectionId,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch((): string => '');
      console.warn('[run-orchestrator] section kickoff returned non-2xx', {
        runId: input.runId,
        sectionId: input.sectionId,
        status: res.status,
        body: body.slice(0, 200),
      });
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn('[run-orchestrator] section kickoff failed', {
      runId: input.runId,
      sectionId: input.sectionId,
      reason: isAbort ? 'timeout' : 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fanOutLabSections(input: {
  request: Request;
  runId: string;
}): Promise<void> {
  const url = new URL(
    '/api/research-v2/run-lab-section',
    input.request.url,
  ).toString();
  const headers = buildForwardedLabSectionHeaders(input.request);

  console.info('[run-orchestrator] fanning out sections', {
    runId: input.runId,
    sections: POSITIONING_SECTION_IDS.length,
    note: 'GLM section loops run unbounded across separate lambdas (no real pool)',
  });

  for (const sectionId of POSITIONING_SECTION_IDS) {
    await kickoffLabSectionJob({
      headers,
      runId: input.runId,
      sectionId,
      url,
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiUser = await requireApiUser();
  if (apiUser instanceof Response) return apiUser;
  if (apiUser.actorUserId !== userId) {
    return jsonError('Unauthorized', 401);
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

  const session = await loadOwnedResearchSession({
    userId,
    runId: body.run_id,
  });
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  const onboardingData = session.onboarding_data ?? {};
  const websiteUrl = getWebsiteUrl(onboardingData);
  const parentAuditRunId = body.parent_audit_run_id;
  const runId = body.run_id;

  // Defer the long orchestrator + fan-out to after(): the route ACKs 202
  // immediately so /orchestrate's kickoff fetch returns fast. The work is
  // bounded by maxDuration=800 (Vercel Pro + Fluid).
  after(async (): Promise<void> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ORCHESTRATOR_ABORT_MS);
    try {
      const result = await generateAgenticGLMOrchestrator({
        websiteUrl,
        onboardingBrief: JSON.stringify(onboardingData),
        env: process.env,
        signal: controller.signal,
        // Stream gather progress over the section-partials channel so the
        // operator sees the ~161-340s orchestrator wait advance (best-effort).
        onStepFinish: makeOrchestratorProgressEmitter(runId),
      });

      const store = createResearchArtifactsResearchFactStore(
        createAdminClient() as unknown as ResearchFactsSupabaseClient,
        parentAuditRunId,
      );
      await promoteOrchestratorFactsToLedger(store, result.transcript, {
        runId,
        createdAt: new Date().toISOString(),
        parentAuditRunId,
      });

      // Deliver the orchestrator's discovered GTM fields (topCompetitors ->
      // competitor seeds, marketProblem -> voiceOfClient) + research digest
      // into the session's onboarding_data so the sections' ResearchInput
      // builder (corpusToResearchInput) reads them. Gap-fill only — a
      // user-supplied field is never overwritten. Best-effort (never throws).
      await persistOrchestratorEnrichment({
        supabase: createAdminClient() as unknown as Parameters<
          typeof persistOrchestratorEnrichment
        >[0]['supabase'],
        userId,
        runId,
        onboardingData,
        gtmFields: result.gtmFields,
        researchDigest: result.researchDigest,
      });
    } catch (err) {
      // The orchestrator is best-effort: if it (or the ledger write) fails the
      // sections must still fan out so the run is never stuck cold. They read
      // an empty ledger and gather their own evidence (pre-orchestrator
      // behavior).
      console.error('[run-orchestrator] orchestrator pass failed', {
        runId,
        parentAuditRunId,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }

    try {
      await fanOutLabSections({ request, runId });
    } catch (err) {
      console.error('[run-orchestrator] section fan-out failed', {
        runId,
        parentAuditRunId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return NextResponse.json({ ok: true, run_id: runId }, { status: 202 });
}
