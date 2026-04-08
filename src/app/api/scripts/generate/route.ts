import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { trimResearchForScripts } from '@/lib/scripts/trim-research-context';
import { getResearchPipelineReadiness, SECTION_PIPELINE_LABELS } from '@/lib/workspace/pipeline';

export const maxDuration = 30;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { profileId, sessionId, userNote } = body;

  if (!profileId || !sessionId) {
    return NextResponse.json({ error: 'profileId and sessionId required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch profile
  const { data: profile, error: profileErr } = await supabase
    .from('business_profiles')
    .select('id, company_name, style_references, proof_points')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Fetch research results (run_id from UI); must belong to this user + profile
  const { data: session, error: sessionErr } = await supabase
    .from('journey_sessions')
    .select('id, research_results, created_at')
    .eq('run_id', sessionId)
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .single();

  if (sessionErr || !session?.research_results) {
    return NextResponse.json({ error: 'Research session not found' }, { status: 404 });
  }

  const rawResults = session.research_results as Record<string, unknown>;
  const readiness = getResearchPipelineReadiness(rawResults);

  if (!readiness.ready) {
    const labels = readiness.missingSections.map((k) => SECTION_PIPELINE_LABELS[k]);
    return NextResponse.json(
      {
        error:
          'Research pipeline incomplete — finish every section (including the media plan) before generating scripts.',
        missingSections: readiness.missingSections,
        missingSectionLabels: labels,
      },
      { status: 400 },
    );
  }

  // Only pass completed research sections — ignore stray keys outside the pipeline
  const typed = rawResults as Record<string, { data?: unknown; status?: string }>;
  const completedResults: Record<string, { data?: unknown }> = {};
  for (const [key, value] of Object.entries(typed)) {
    if (value && value.status === 'complete' && value.data) {
      completedResults[key] = value;
    }
  }

  if (Object.keys(completedResults).length === 0) {
    return NextResponse.json({ error: 'No completed research sections found' }, { status: 400 });
  }

  const trimmed = trimResearchForScripts(completedResults);

  const generationContext = {
    researchSessionId: session.id,
    researchSessionRunId: sessionId,
    researchSessionDate: session.created_at,
    researchSectionCount: Object.keys(completedResults).length,
    styleReferencesUsed: ((profile.style_references as Array<{name: string; source: string; content: string}>) ?? []).map((r: {name: string; source: string}) => ({ name: r.name, source: r.source })),
    proofPointsUsed: ((profile.proof_points as Array<{headline: string; type: string}>) ?? []).map((p: {headline: string; type: string}) => ({ headline: p.headline, type: p.type })),
    userNote: userNote ?? null,
    styleReferencesSnapshot: profile.style_references ?? [],
  };

  // Create script_packs row
  const { data: pack, error: packErr } = await supabase
    .from('script_packs')
    .insert({
      profile_id: profileId,
      session_id: session.id,
      user_id: userId,
      status: 'generating',
      style_references_snapshot: profile.style_references ?? [],
      generation_context: generationContext,
    })
    .select('id')
    .single();

  if (packErr || !pack) {
    return NextResponse.json({ error: 'Failed to create script pack' }, { status: 500 });
  }

  // Dispatch to worker — await acknowledgment so we can surface failures immediately
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  if (!workerUrl) {
    await supabase.from('script_packs').update({ status: 'error', error_message: 'RAILWAY_WORKER_URL not configured' }).eq('id', pack.id);
    return NextResponse.json({ error: 'Worker not configured — check RAILWAY_WORKER_URL' }, { status: 500 });
  }

  try {
    const workerRes = await fetch(`${workerUrl}/api/scripts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RAILWAY_API_KEY}`,
      },
      body: JSON.stringify({
        packId: pack.id,
        profileId,
        sessionId: session.id,
        userId,
        companyName: profile.company_name,
        researchContext: trimmed,
        styleReferences: profile.style_references ?? [],
        proofPoints: profile.proof_points ?? [],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!workerRes.ok) {
      const errText = await workerRes.text().catch(() => 'Unknown error');
      console.error(`[scripts/generate] Worker rejected: ${workerRes.status} ${errText}`);
      await supabase.from('script_packs').update({ status: 'error', error_message: `Worker error: ${workerRes.status}` }).eq('id', pack.id);
      return NextResponse.json({ error: `Worker rejected the request (${workerRes.status})` }, { status: 502 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scripts/generate] Dispatch failed:', msg);
    await supabase.from('script_packs').update({ status: 'error', error_message: `Dispatch failed: ${msg}` }).eq('id', pack.id);
    return NextResponse.json({ error: `Could not reach worker: ${msg}` }, { status: 502 });
  }

  return NextResponse.json({ packId: pack.id, status: 'generating' });
}
