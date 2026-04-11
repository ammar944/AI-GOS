import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { fathomFetchRequestSchema } from '@/lib/fathom/schemas';
import { getFathomClient, FathomResolutionError } from '@/lib/fathom/client';
import { formatTranscriptAsMarkdown, estimateTokenCount } from '@/lib/fathom/transcript-formatter';
import { createAdminClient } from '@/lib/supabase/server';
import type { FathomCallMeta } from '@/lib/fathom/types';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = fathomFetchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const { shareUrl, runId } = parsed.data;

  try {
    const fathom = getFathomClient();

    // Step 1: Resolve share URL → meeting metadata
    const meeting = await fathom.resolveShareUrl(shareUrl);

    // Step 2: Check for duplicate
    const supabase = createAdminClient();
    const { data: session } = await supabase
      .from('journey_sessions')
      .select('fathom_calls')
      .eq('user_id', userId)
      .eq('run_id', runId)
      .maybeSingle();

    const existingCalls = (session?.fathom_calls ?? []) as FathomCallMeta[];
    if (existingCalls.some((c) => c.recordingId === meeting.recording_id)) {
      return NextResponse.json(
        { error: 'This call is already linked to this session' },
        { status: 409 },
      );
    }

    // Step 3: Fetch transcript
    const transcriptData = await fathom.fetchTranscript(meeting.recording_id);
    const markdown = formatTranscriptAsMarkdown(transcriptData.transcript);

    // Step 4: Compute metadata
    const durationSeconds =
      meeting.scheduled_end_time && meeting.scheduled_start_time
        ? Math.round(
            (new Date(meeting.scheduled_end_time).getTime() -
              new Date(meeting.scheduled_start_time).getTime()) /
              1000,
          )
        : 0;

    const attendees = (meeting.calendar_invitees ?? []).map((inv) => ({
      name: inv.name,
      email: inv.email,
      isExternal: inv.is_external,
    }));

    const actionItems = (meeting.action_items ?? []).map((ai) => ({
      description: ai.description,
      assignee: ai.assignee?.name,
      completed: ai.completed,
    }));

    // Step 5: Get business_profile for FK
    const { data: profile } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    // Step 6: Store transcript as business_profile_document
    const { data: doc, error: docError } = await supabase
      .from('business_profile_documents')
      .insert({
        user_id: userId,
        business_profile_id: profile?.id ?? null,
        file_name: `Fathom: ${meeting.title} — ${new Date(meeting.scheduled_start_time).toLocaleDateString('en-US')}`,
        mime_type: 'application/json',
        file_size_bytes: new TextEncoder().encode(markdown).length,
        parsed_markdown: markdown,
        extracted_fields: {},
        section_tags: ['industryMarket', 'icpValidation', 'competitors', 'offerAnalysis', 'crossAnalysis'],
        doc_kind: 'sales_call_transcript',
        token_count: estimateTokenCount(markdown),
      })
      .select('id')
      .single();

    if (docError || !doc) {
      console.error('[fathom/fetch] Failed to store document:', docError);
      return NextResponse.json({ error: 'Failed to store transcript' }, { status: 500 });
    }

    // Step 7: Build call metadata and store in journey_sessions
    const callMeta: FathomCallMeta = {
      recordingId: meeting.recording_id,
      shareUrl,
      title: meeting.title,
      date: meeting.scheduled_start_time,
      durationSeconds,
      attendees,
      summary: meeting.default_summary?.markdown_formatted ?? null,
      actionItems,
      documentId: doc.id,
      status: 'extracting',
    };

    await supabase.rpc('merge_journey_session_fathom_call', {
      p_user_id: userId,
      p_run_id: runId,
      p_recording_id: meeting.recording_id,
      p_call_data: callMeta,
    });

    // Step 8: Dispatch extraction to worker (fire-and-forget)
    const workerUrl = process.env.RAILWAY_WORKER_URL;
    const workerKey = process.env.RAILWAY_API_KEY;
    if (workerUrl) {
      void fetch(`${workerUrl}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(workerKey ? { Authorization: `Bearer ${workerKey}` } : {}),
        },
        body: JSON.stringify({
          tool: 'extractFathomCall',
          context: markdown,
          userId,
          jobId: crypto.randomUUID(),
          runId,
          documentId: doc.id,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.error('[fathom/fetch] Dispatch extraction failed:', err);
      });
    }

    return NextResponse.json({
      documentId: doc.id,
      recordingId: meeting.recording_id,
      title: meeting.title,
      date: meeting.scheduled_start_time,
      durationSeconds,
      attendees,
      summary: meeting.default_summary?.markdown_formatted ?? null,
      actionItems,
      status: 'extracting',
    });
  } catch (err) {
    if (err instanceof FathomResolutionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[fathom/fetch] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
