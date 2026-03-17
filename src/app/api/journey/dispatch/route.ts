// Direct research dispatch — no lead agent.
// Frontend calls this when a section needs to start researching.
//
// IMPORTANT: This route stamps the activeJourneyRunId into Supabase metadata
// BEFORE dispatching to the worker. The worker's isActiveJourneyRun() guard
// reads this value to decide whether to write results — if the run ID hasn't
// been committed yet, the worker silently drops the write.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import { createAdminClient } from '@/lib/supabase/server';

const SECTION_TO_TOOL: Record<string, string> = {
  industryMarket: 'researchIndustry',
  competitors: 'researchCompetitors',
  icpValidation: 'researchICP',
  offerAnalysis: 'researchOffer',
  crossAnalysis: 'synthesizeResearch',
  keywordIntel: 'researchKeywords',
  mediaPlan: 'researchMediaPlan',
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { section, runId, context } = body as {
    section: string;
    runId: string;
    context: string;
  };

  if (!section || !context) {
    return NextResponse.json(
      { error: 'Missing required fields: section, context' },
      { status: 400 },
    );
  }

  const tool = SECTION_TO_TOOL[section];
  if (!tool) {
    return NextResponse.json(
      { error: `Unknown section: ${section}` },
      { status: 400 },
    );
  }

  // Ensure the activeJourneyRunId is committed to Supabase BEFORE the worker
  // checks isActiveJourneyRun(). Without this, the fire-and-forget PATCH from
  // resetResearchState may not have landed yet, causing the worker to silently
  // drop the write.
  if (runId) {
    const supabase = createAdminClient();
    await supabase.rpc('merge_journey_session_metadata_keys', {
      p_user_id: userId,
      p_keys: {
        activeJourneyRunId: runId,
        lastUpdated: new Date().toISOString(),
      },
    });
  }

  // For mediaPlan: inject prior research results so the model synthesizes
  // from real data instead of hallucinating evidence. The 6 research sections
  // are already in Supabase — fetch and append them to the context string.
  let enrichedContext = context;
  if (section === 'mediaPlan' && runId) {
    try {
      const supabase = createAdminClient();
      const { data: sessionData } = await supabase
        .from('journey_sessions')
        .select('research_results')
        .eq('user_id', userId)
        .eq('run_id', runId)
        .maybeSingle();

      const research = sessionData?.research_results as Record<string, unknown> | null;
      if (research && Object.keys(research).length > 0) {
        const researchSections: string[] = [];
        for (const [key, value] of Object.entries(research)) {
          if (key === 'mediaPlan' || !value) continue;
          // Extract the data payload — research results wrap data in { status, data, ... }
          const payload = (value as Record<string, unknown>)?.data ?? value;
          researchSections.push(`## ${key}\n${JSON.stringify(payload, null, 1)}`);
        }
        if (researchSections.length > 0) {
          enrichedContext = `${context}\n\n# Approved Research Results\n\n${researchSections.join('\n\n')}`;
        }
      }
    } catch (err) {
      // Non-fatal: proceed with original context if research fetch fails
      console.warn('[dispatch] Failed to fetch research results for mediaPlan:', err);
    }
  }

  const result = await dispatchResearchForUser(tool, section, enrichedContext, userId, {
    activeRunId: runId,
  });

  return NextResponse.json(result);
}
