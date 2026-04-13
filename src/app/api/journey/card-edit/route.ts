import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Persist a card edit to Supabase research_results.
 *
 * Stores the full updated card content as an overlay under
 * `research_results[section].__cardEdits[cardId]`.
 * This sits outside the `data` sub-object so the research
 * normalization pipeline (Zod schema validation) ignores it,
 * while the workspace bridge can read it back for cold-start recovery.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    runId: string;
    sectionKey: string;
    cardId: string;
    updatedContent: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { runId, sectionKey, cardId, updatedContent } = body;
  if (!runId || !sectionKey || !cardId || !updatedContent) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Read current research_results (raw JSONB)
  const { data, error: readError } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (readError) {
    return Response.json({ error: readError.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const results = (data.research_results ?? {}) as Record<string, unknown>;
  const section = (results[sectionKey] ?? {}) as Record<string, unknown>;

  // Store overlay at the section level (sibling to `data`, not inside it)
  // so the Zod normalization pipeline ignores it.
  const existingEdits = (section.__cardEdits ?? {}) as Record<string, unknown>;
  section.__cardEdits = { ...existingEdits, [cardId]: updatedContent };
  results[sectionKey] = section;

  const { error: writeError } = await supabase
    .from('journey_sessions')
    .update({
      research_results: results,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('run_id', runId);

  if (writeError) {
    return Response.json({ error: writeError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
