import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { trimResearchForScripts } from '@/lib/scripts/trim-research-context';

export const maxDuration = 30;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { profileId, sessionId } = body;

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

  // Fetch research results (use run_id lookup — frontend passes run_id as sessionId)
  const { data: session, error: sessionErr } = await supabase
    .from('journey_sessions')
    .select('id, research_results')
    .eq('run_id', sessionId)
    .single();

  if (sessionErr || !session?.research_results) {
    return NextResponse.json({ error: 'Research session not found' }, { status: 404 });
  }

  // Only pass completed research sections — ignore in-progress or failed ones
  const rawResults = session.research_results as Record<string, { data?: unknown; status?: string }>;
  const completedResults: Record<string, { data?: unknown }> = {};
  for (const [key, value] of Object.entries(rawResults)) {
    if (value && value.status === 'complete' && value.data) {
      completedResults[key] = value;
    }
  }

  if (Object.keys(completedResults).length === 0) {
    return NextResponse.json({ error: 'No completed research sections found' }, { status: 400 });
  }

  const trimmed = trimResearchForScripts(completedResults);

  // Create script_packs row
  const { data: pack, error: packErr } = await supabase
    .from('script_packs')
    .insert({
      profile_id: profileId,
      session_id: session.id,
      user_id: userId,
      status: 'generating',
      style_references_snapshot: profile.style_references ?? [],
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
