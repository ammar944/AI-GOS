import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import {
  applyJourneySandboxSectionResets,
  buildJourneyResearchSandboxContext,
  clearJourneySandboxSectionJobs,
  clearJourneySandboxSectionResult,
  getJourneyResearchSandboxConfig,
  JOURNEY_RESEARCH_SANDBOX_SECTIONS,
  getJourneyResearchSandboxUserId,
  getJourneySandboxContextDrafts,
  isJourneyResearchSandboxEnabled,
  mergeJourneySandboxMetadata,
  sanitizeJourneyResearchSandboxKey,
  type JourneyResearchSandboxSection,
  type JourneyResearchSandboxBackendStatus,
  type JourneyResearchSandboxSessionSnapshot,
  type JourneyResearchSandboxSnapshot,
} from '@/lib/journey/research-sandbox';

export const maxDuration = 60;

interface JourneySessionRow {
  id: string;
  user_id: string;
  phase: string | null;
  metadata: Record<string, unknown> | null;
  research_results: Record<string, unknown> | null;
  job_status: Record<string, unknown> | null;
  updated_at: string | null;
}

interface SandboxActionBody {
  action: 'seed' | 'run' | 'clear';
  sandboxKey?: string;
  section?: JourneyResearchSandboxSection;
  context?: string;
  scope?: 'section' | 'all';
}

function featureDisabledResponse() {
  return Response.json({ error: 'Not found' }, { status: 404 });
}

async function readBackendStatus(): Promise<JourneyResearchSandboxBackendStatus> {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    return {
      workerUrlConfigured: false,
      workerReachable: false,
      workerHealth: null,
      capabilities: null,
      warnings: ['RAILWAY_WORKER_URL is not configured in the app environment.'],
    };
  }

  const warnings: string[] = [];
  let workerReachable = false;
  let workerHealth: Record<string, unknown> | null = null;
  let capabilities: JourneyResearchSandboxBackendStatus['capabilities'] = null;

  try {
    const [healthResponse, capabilitiesResponse] = await Promise.all([
      fetch(`${workerUrl}/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      }),
      fetch(`${workerUrl}/capabilities`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      }),
    ]);

    if (healthResponse.ok) {
      workerHealth = (await healthResponse.json()) as Record<string, unknown>;
      workerReachable = true;
    } else {
      warnings.push(`Worker health returned HTTP ${healthResponse.status}.`);
    }

    if (capabilitiesResponse.ok) {
      const payload = (await capabilitiesResponse.json()) as {
        tools?: JourneyResearchSandboxBackendStatus['capabilities'];
      };
      capabilities = payload.tools ?? null;
    } else {
      warnings.push(`Worker capabilities returned HTTP ${capabilitiesResponse.status}.`);
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Worker check failed: ${error.message}`
        : 'Worker check failed.',
    );
  }

  if (capabilities) {
    if (!capabilities.spyfu) {
      warnings.push('SpyFu is unavailable in the worker, so Keywords QA will degrade or fail.');
    }
    if (!capabilities.firecrawl) {
      warnings.push('Firecrawl is unavailable in the worker, so Offer Analysis cannot scrape pricing pages.');
    }
    if (!capabilities.googleAds || !capabilities.metaAds || !capabilities.ga4) {
      warnings.push('Media Plan can still run, but some live platform connectors are unavailable and will fall back to benchmark-only planning.');
    }
  }

  return {
    workerUrlConfigured: true,
    workerReachable,
    workerHealth,
    capabilities,
    warnings,
  };
}

async function requireAuthedUser(): Promise<string | Response> {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return userId;
}

async function readJourneySessionRow(
  userId: string,
): Promise<JourneySessionRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('journey_sessions')
    .select(
      'id, user_id, phase, metadata, research_results, job_status, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  return (data as JourneySessionRow | null | undefined) ?? null;
}

function toSessionSnapshot(
  row: JourneySessionRow | null,
  userId: string,
): JourneyResearchSandboxSessionSnapshot {
  const filtered = applyJourneySandboxSectionResets({
    metadata: row?.metadata ?? null,
    researchResults: row?.research_results,
    jobStatus:
      (row?.job_status as JourneyResearchSandboxSessionSnapshot['jobStatus']) ?? {},
  });

  return {
    exists: Boolean(row),
    id: row?.id ?? null,
    userId,
    updatedAt: row?.updated_at ?? null,
    metadata: row?.metadata ?? null,
    researchResults: filtered.researchResults,
    jobStatus: filtered.jobStatus,
    contextDrafts: getJourneySandboxContextDrafts(row?.metadata ?? null),
  };
}

async function buildSnapshot(
  liveUserId: string,
  sandboxKey: string,
  section: JourneyResearchSandboxSection,
): Promise<JourneyResearchSandboxSnapshot> {
  const normalizedSandboxKey = sanitizeJourneyResearchSandboxKey(sandboxKey);
  const sandboxUserId = getJourneyResearchSandboxUserId(
    liveUserId,
    normalizedSandboxKey,
  );

  const [liveRow, sandboxRow] = await Promise.all([
    readJourneySessionRow(liveUserId),
    readJourneySessionRow(sandboxUserId),
  ]);

  const liveSession = toSessionSnapshot(liveRow, liveUserId);
  const sandboxSession = toSessionSnapshot(sandboxRow, sandboxUserId);
  const backendStatus = await readBackendStatus();
  const mergedSandboxResults = {
    ...liveSession.researchResults,
    ...sandboxSession.researchResults,
  };

  return {
    section,
    sandboxKey: normalizedSandboxKey,
    sandboxUserId,
    liveSession,
    sandboxSession,
    backendStatus,
    suggestedContext: {
      live: buildJourneyResearchSandboxContext(section, {
        metadata: liveSession.metadata,
        researchResults: liveSession.researchResults,
      }),
      sandbox:
        sandboxSession.contextDrafts[section] ??
        buildJourneyResearchSandboxContext(section, {
          metadata: sandboxSession.metadata ?? liveSession.metadata,
          researchResults: mergedSandboxResults,
        }),
    },
  };
}

async function ensureSandboxRow(
  liveUserId: string,
  sandboxKey: string,
  section: JourneyResearchSandboxSection,
  contextDraft?: string,
): Promise<{
  sandboxUserId: string;
  liveRow: JourneySessionRow | null;
  sandboxRow: JourneySessionRow | null;
}> {
  const normalizedSandboxKey = sanitizeJourneyResearchSandboxKey(sandboxKey);
  const sandboxUserId = getJourneyResearchSandboxUserId(
    liveUserId,
    normalizedSandboxKey,
  );
  const [liveRow, sandboxRow] = await Promise.all([
    readJourneySessionRow(liveUserId),
    readJourneySessionRow(sandboxUserId),
  ]);

  const baseMetadata = sandboxRow?.metadata ?? liveRow?.metadata ?? {};
  const nextMetadata = mergeJourneySandboxMetadata(baseMetadata, {
    sandboxKey: normalizedSandboxKey,
    liveUserId,
    contextDrafts: contextDraft ? { [section]: contextDraft } : undefined,
  });

  if (!sandboxRow) {
    const supabase = createAdminClient();
    await supabase.from('journey_sessions').upsert(
      {
        user_id: sandboxUserId,
        phase: 'sandbox',
        metadata: nextMetadata,
        research_results: null,
        job_status: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } else if (nextMetadata !== sandboxRow.metadata) {
    const supabase = createAdminClient();
    await supabase
      .from('journey_sessions')
      .update({
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sandboxRow.id);
  }

  return {
    sandboxUserId,
    liveRow,
    sandboxRow: await readJourneySessionRow(sandboxUserId),
  };
}

export async function GET(request: Request) {
  if (!isJourneyResearchSandboxEnabled()) {
    return featureDisabledResponse();
  }

  const authedUser = await requireAuthedUser();
  if (authedUser instanceof Response) {
    return authedUser;
  }

  const url = new URL(request.url);
  const sandboxKey = url.searchParams.get('sandboxKey') ?? 'default';
  const sectionParam = url.searchParams.get('section') ?? 'industryMarket';
  const config = getJourneyResearchSandboxConfig(sectionParam);
  if (!config) {
    return Response.json({ error: 'Invalid section' }, { status: 400 });
  }

  const snapshot = await buildSnapshot(
    authedUser,
    sandboxKey,
    config.section,
  );

  return Response.json(snapshot);
}

export async function POST(request: Request) {
  if (!isJourneyResearchSandboxEnabled()) {
    return featureDisabledResponse();
  }

  const authedUser = await requireAuthedUser();
  if (authedUser instanceof Response) {
    return authedUser;
  }

  let body: SandboxActionBody;
  try {
    body = (await request.json()) as SandboxActionBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sandboxKey = body.sandboxKey ?? 'default';
  const section = body.section ?? 'industryMarket';
  const config = getJourneyResearchSandboxConfig(section);
  if (!config) {
    return Response.json({ error: 'Invalid section' }, { status: 400 });
  }

  if (body.action === 'seed') {
    const liveRow = await readJourneySessionRow(authedUser);
    if (!liveRow) {
      return Response.json(
        { error: 'No live Journey session found to seed from.' },
        { status: 422 },
      );
    }

    const normalizedSandboxKey = sanitizeJourneyResearchSandboxKey(sandboxKey);
    const sandboxUserId = getJourneyResearchSandboxUserId(
      authedUser,
      normalizedSandboxKey,
    );
    const existingSandboxRow = await readJourneySessionRow(sandboxUserId);
    const mergedMetadata = mergeJourneySandboxMetadata(
      liveRow.metadata ?? existingSandboxRow?.metadata ?? {},
      {
        sandboxKey: normalizedSandboxKey,
        liveUserId: authedUser,
        contextDrafts: getJourneySandboxContextDrafts(
          existingSandboxRow?.metadata ?? null,
        ),
        clearSectionResetAt: true,
      },
    );

    const supabase = createAdminClient();
    await supabase.from('journey_sessions').upsert(
      {
        user_id: sandboxUserId,
        phase: 'sandbox',
        metadata: mergedMetadata,
        research_results: liveRow.research_results ?? null,
        job_status: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    return Response.json({
      ok: true,
      snapshot: await buildSnapshot(authedUser, sandboxKey, config.section),
    });
  }

  if (body.action === 'clear') {
    const normalizedSandboxKey = sanitizeJourneyResearchSandboxKey(sandboxKey);
    const sandboxUserId = getJourneyResearchSandboxUserId(
      authedUser,
      normalizedSandboxKey,
    );
    const sandboxRow = await readJourneySessionRow(sandboxUserId);

    if (!sandboxRow) {
      return Response.json({
        ok: true,
        snapshot: await buildSnapshot(authedUser, sandboxKey, config.section),
      });
    }

    const supabase = createAdminClient();
    const resetAt = new Date().toISOString();
    const nextMetadata = mergeJourneySandboxMetadata(sandboxRow.metadata ?? {}, {
      sandboxKey: normalizedSandboxKey,
      liveUserId: authedUser,
      sectionResetAt:
        (body.scope ?? 'section') === 'all'
          ? Object.fromEntries(
              JOURNEY_RESEARCH_SANDBOX_SECTIONS.map((entry) => [entry.section, resetAt]),
            )
          : { [config.section]: resetAt },
    });
    if ((body.scope ?? 'section') === 'all') {
      await supabase
        .from('journey_sessions')
        .update({
          metadata: nextMetadata,
          research_results: null,
          job_status: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sandboxRow.id);
    } else {
      await supabase
        .from('journey_sessions')
        .update({
          metadata: nextMetadata,
          research_results: clearJourneySandboxSectionResult(
            sandboxRow.research_results,
            config.section,
          ),
          job_status: clearJourneySandboxSectionJobs(
            sandboxRow.job_status,
            config.section,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sandboxRow.id);
    }

    return Response.json({
      ok: true,
      snapshot: await buildSnapshot(authedUser, sandboxKey, config.section),
    });
  }

  if (body.action !== 'run') {
    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const context = body.context?.trim();
  if (!context) {
    return Response.json({ error: 'context is required' }, { status: 400 });
  }

  const { sandboxUserId, sandboxRow } = await ensureSandboxRow(
    authedUser,
    sandboxKey,
    config.section,
    context,
  );
  const refreshedSandboxRow = sandboxRow ?? (await readJourneySessionRow(sandboxUserId));

  if (refreshedSandboxRow) {
    const supabase = createAdminClient();
    const resetAt = new Date().toISOString();
    await supabase
      .from('journey_sessions')
      .update({
        metadata: mergeJourneySandboxMetadata(refreshedSandboxRow.metadata ?? {}, {
          sandboxKey: sanitizeJourneyResearchSandboxKey(sandboxKey),
          liveUserId: authedUser,
          sectionResetAt: {
            [config.section]: resetAt,
          },
        }),
        research_results: clearJourneySandboxSectionResult(
          refreshedSandboxRow.research_results,
          config.section,
        ),
        job_status: clearJourneySandboxSectionJobs(
          refreshedSandboxRow.job_status,
          config.section,
        ),
        updated_at: new Date().toISOString(),
      })
      .eq('id', refreshedSandboxRow.id);
  }

  const dispatchResult = await dispatchResearchForUser(
    config.toolName,
    config.section,
    context,
    sandboxUserId,
  );

  if (dispatchResult.status !== 'queued') {
    return Response.json(
      {
        error: dispatchResult.error ?? `Failed to dispatch ${config.label}.`,
        dispatchResult,
        snapshot: await buildSnapshot(authedUser, sandboxKey, config.section),
      },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    dispatchResult,
    snapshot: await buildSnapshot(authedUser, sandboxKey, config.section),
  });
}
