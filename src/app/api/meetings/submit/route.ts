import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { meetingTranscriptSubmitSchema } from '@/lib/meeting-intel/schemas';
import { estimateTokenCount } from '@/lib/meeting-intel/transcript-formatter';
import { createAdminClient } from '@/lib/supabase/server';
import type { MeetingMeta } from '@/lib/meeting-intel/types';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = meetingTranscriptSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const { title, meetingType, transcript, runId } = parsed.data;

  try {
    const supabase = createAdminClient();

    // Get business_profile for FK
    const { data: profile } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    // Store transcript as business_profile_document
    const tokenCount = estimateTokenCount(transcript);
    const { data: doc, error: docError } = await supabase
      .from('business_profile_documents')
      .insert({
        user_id: userId,
        business_profile_id: profile?.id ?? null,
        file_name: `Meeting: ${title} — ${meetingType}`,
        mime_type: 'text/plain',
        file_size_bytes: new TextEncoder().encode(transcript).length,
        parsed_markdown: transcript,
        extracted_fields: {},
        section_tags: ['industryMarket', 'icpValidation', 'competitors', 'offerAnalysis', 'crossAnalysis'],
        doc_kind: 'meeting_transcript',
        token_count: tokenCount,
      })
      .select('id')
      .single();

    if (docError || !doc) {
      console.error('[meetings/submit] Failed to store document:', docError);
      return NextResponse.json({ error: 'Failed to store transcript' }, { status: 500 });
    }

    // Build meeting metadata
    const meetingId = crypto.randomUUID();
    const meetingMeta: MeetingMeta = {
      id: meetingId,
      title,
      meetingType,
      transcriptLength: transcript.length,
      documentId: doc.id,
      status: 'extracting',
      dateAdded: new Date().toISOString(),
    };

    // Store in journey_sessions.meeting_transcripts
    await supabase.rpc('merge_journey_session_meeting', {
      p_user_id: userId,
      p_run_id: runId,
      p_meeting_id: meetingId,
      p_meeting_data: meetingMeta,
    });

    // Fire-and-forget dispatch to worker
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
          tool: 'extractMeetingTranscript',
          context: transcript,
          userId,
          jobId: crypto.randomUUID(),
          runId,
          documentId: doc.id,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.error('[meetings/submit] Dispatch extraction failed:', err);
      });
    }

    return NextResponse.json(meetingMeta);
  } catch (err) {
    console.error('[meetings/submit] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
