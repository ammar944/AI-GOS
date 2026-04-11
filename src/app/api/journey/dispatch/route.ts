// Direct research dispatch — frontend-driven pipeline.
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

/** Ordered list of dispatch pipeline sections. Exported for testing. */
export const DISPATCH_PIPELINE_ORDER = [
  'identityResolution',
  'industryMarket',
  'icpValidation',
  'competitors',
  'offerAnalysis',
  'keywordIntel',
  'crossAnalysis',
  'mediaPlan',
] as const;

/** Extract key summary fields from upstream research for synthesis context.
 *  Reduces ~15K tokens of full JSON to ~5-7K of essential data. Exported for testing. */
export function summarizeForSynthesis(key: string, payload: unknown): string {
  const d = payload as Record<string, unknown>;
  try {
    switch (key) {
      case 'identityResolution':
        // Identity card is small (~500 tokens) — pass in full so every downstream
        // runner sees category, coreKeywords, negativeKeywords, confidence, and evidence.
        return JSON.stringify(d, null, 1);
      case 'industryMarket':
        // categorySnapshot and trendSignals are the actual top-level fields
        return JSON.stringify(
          {
            categorySnapshot: d.categorySnapshot,
            trendSignals: d.trendSignals,
            messagingOpportunities: (d.messagingOpportunities as Record<string, unknown>)?.summaryRecommendations,
            marketOpportunities: d.marketOpportunities,
          },
          null, 1,
        );
      case 'icpValidation':
        // validatedPersona and triggers are the actual top-level fields
        return JSON.stringify(
          {
            validatedPersona: d.validatedPersona,
            triggers: d.triggers,
            finalVerdict: d.finalVerdict,
            audienceRefinements: d.audienceRefinements,
          },
          null, 1,
        );
      case 'offerAnalysis':
        return JSON.stringify({
          overallScore: (d.offerStrength as Record<string, unknown>)?.overallScore,
          status: (d.recommendation as Record<string, unknown>)?.status,
          pricingPosition: (d.pricingAnalysis as Record<string, unknown>)?.pricingPosition,
          redFlags: d.redFlags,
        }, null, 1);
      case 'competitors': {
        const comps = Array.isArray(d.competitors) ? d.competitors.slice(0, 3) : [];
        const compSummary = comps.map((c: Record<string, unknown>) => ({
          name: c.name, positioning: c.positioning, weaknesses: c.weaknesses,
        }));
        return JSON.stringify({
          competitors: compSummary,
          positioningMoves: d.positioningMoves,
        }, null, 1);
      }
      default:
        return JSON.stringify(payload, null, 1);
    }
  } catch {
    return JSON.stringify(payload, null, 1);
  }
}

const SECTION_TO_TOOL: Record<string, string> = {
  identityResolution: 'resolveIdentity',
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
      p_run_id: runId,
      p_keys: {
        activeJourneyRunId: runId,
        lastUpdated: new Date().toISOString(),
      },
    });
  }

  // Intelligence chain: inject prior research results into the context so each
  // runner builds on what came before. The pipeline order determines which
  // sections are "upstream" of the current one. industryMarket (first step)
  // gets no prior results; every subsequent step gets all completed sections
  // that precede it in the pipeline.
  //
  // Pipeline order: identityResolution → industryMarket → icpValidation → competitors → offerAnalysis → keywordIntel → crossAnalysis → mediaPlan
  // Identity first so every downstream runner gets the canonical product identity card.
  // Competitors before offer so the offer runner gets Firecrawl-verified pricing tiers
  // via the intelligence chain, enabling accurate market benchmarking.
  const PIPELINE_ORDER = DISPATCH_PIPELINE_ORDER;

  let enrichedContext = context;
  const sectionIndex = (PIPELINE_ORDER as readonly string[]).indexOf(section);

  // Only enrich if this section has upstream sections AND we have a runId
  if (sectionIndex > 0 && runId) {
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
        // Only include sections that come BEFORE this one in the pipeline
        const upstreamSections = PIPELINE_ORDER.slice(0, sectionIndex);
        const researchSections: string[] = [];
        for (const key of upstreamSections) {
          const value = research[key];
          if (!value) continue;
          // Extract the data payload — research results wrap data in { status, data, ... }
          const payload = (value as Record<string, unknown>)?.data ?? value;
          // Pass trimmed summaries for synthesis to reduce context (~15K → ~5-7K tokens)
          const content = section === 'crossAnalysis'
            ? summarizeForSynthesis(key, payload)
            : JSON.stringify(payload, null, 1);
          researchSections.push(`## ${key}\n${content}`);
        }
        if (researchSections.length > 0) {
          enrichedContext = `${context}\n\n# Prior Research Results (use these to inform your analysis)\n\n${researchSections.join('\n\n')}`;
        }
      }
    } catch (err) {
      // Non-fatal: proceed with original context if research fetch fails
      console.warn(`[dispatch] Failed to fetch prior research for ${section}:`, err);
    }
  }

  // --- Document injection: uploaded reference docs ---
  // Query the user's persisted documents tagged for this section.
  // Per-section token budgets based on runner model + timeout profile:
  //   - identityResolution: SKIP (Haiku, only needs fields)
  //   - industryMarket: 10K (Haiku primary, tight repair timeout)
  //   - keywordIntel: 10K (multi-cascade with tight timeouts)
  //   - icpValidation, competitors, offerAnalysis: 20K (Sonnet, 120-180s)
  //   - crossAnalysis, mediaPlan: 25K (Sonnet, 180s+, benefit most from docs)
  // Non-fatal: if the query fails, proceed with original context.
  const SECTION_DOC_BUDGETS: Record<string, number> = {
    identityResolution: 0,      // Skip — Haiku, only needs basic fields
    industryMarket: 10_000,     // Haiku primary, 60s repair timeout
    keywordIntel: 10_000,       // Multi-cascade with tight timeouts
    icpValidation: 20_000,      // Sonnet, 120s
    competitors: 20_000,        // Sonnet parallel pipeline, 120s
    offerAnalysis: 20_000,      // Sonnet, 180s
    crossAnalysis: 25_000,      // Sonnet, 180s — synthesis benefits most
    mediaPlan: 25_000,          // Sonnet 6-block, 300s stale threshold
  };

  const docBudget = SECTION_DOC_BUDGETS[section] ?? 15_000;

  if (docBudget > 0) {
    try {
      const docSupabase = createAdminClient();
      const { data: docs } = await docSupabase
        .from('business_profile_documents')
        .select('file_name, parsed_markdown, doc_kind, token_count')
        .eq('user_id', userId)
        .overlaps('section_tags', [section])
        .order('created_at', { ascending: false });

      if (docs && docs.length > 0) {
        let budgetRemaining = docBudget;
        const selected: typeof docs = [];
        for (const doc of docs) {
          if (doc.token_count <= budgetRemaining) {
            selected.push(doc);
            budgetRemaining -= doc.token_count;
          }
        }
        if (selected.length > 0) {
          const docBlock = selected
            .map(
              (d) =>
                `--- ${d.file_name} (${d.doc_kind ?? 'document'}) ---\n${d.parsed_markdown}`,
            )
            .join('\n\n');
          enrichedContext += `\n\n# Reference Documents (uploaded by user — use to inform your analysis)\n\n${docBlock}`;
        }
      }
    } catch (err) {
      // Non-fatal: proceed without docs if query fails
      console.warn(`[dispatch] Failed to fetch user documents for ${section}:`, err);
    }
  }

  // --- Sales Call Intelligence injection ---
  // When the session has Fathom calls with extracted insights, inject a
  // structured "Sales Call Intelligence" block into the runner context.
  // This is higher-signal than uploaded documents and appears first.
  if (runId) {
    try {
      const fathomSupabase = createAdminClient();
      const { data: fathomSession } = await fathomSupabase
        .from('journey_sessions')
        .select('fathom_calls')
        .eq('user_id', userId)
        .eq('run_id', runId)
        .maybeSingle();

      const fathomCalls = (fathomSession?.fathom_calls ?? []) as import('@/lib/fathom/types').FathomCallMeta[];
      const readyCalls = fathomCalls.filter((c) => c.status === 'ready');

      if (readyCalls.length > 0) {
        const docIds = readyCalls.map((c) => c.documentId);
        const { data: docs } = await fathomSupabase
          .from('business_profile_documents')
          .select('id, extracted_fields')
          .in('id', docIds);

        if (docs && docs.length > 0) {
          const { buildAllSalesCallBlocks } = await import('@/lib/fathom/context-block');
          const extractedMap: Record<string, import('@/lib/fathom/types').SalesCallInsights> = {};
          for (const doc of docs) {
            if (doc.extracted_fields && Object.keys(doc.extracted_fields as Record<string, unknown>).length > 0) {
              extractedMap[doc.id] = doc.extracted_fields as import('@/lib/fathom/types').SalesCallInsights;
            }
          }

          const salesCallBlock = buildAllSalesCallBlocks(readyCalls, extractedMap);
          if (salesCallBlock) {
            enrichedContext = `${salesCallBlock}\n\n${enrichedContext}`;
          }
        }
      }
    } catch (err) {
      console.warn('[dispatch] Failed to inject sales call intelligence:', err);
    }
  }

  // --- Conditional runner instruction for sales call priority ---
  if (enrichedContext.includes('SALES CALL INTELLIGENCE')) {
    const salesCallInstruction = `\n\n# Sales Call Intelligence Priority\nIf "SALES CALL INTELLIGENCE" blocks appear below, these contain verified first-party data from actual client conversations. Prioritize sales call data over web-scraped or inferred data. When sales call data contradicts web research, note the discrepancy and prefer the sales call version. Cite sales call quotes using format: [Sales Call: "exact quote"]. Use pain points to inform targeting, budget signals to ground spend recommendations, and competitor mentions to focus competitive analysis.\n`;
    enrichedContext = salesCallInstruction + enrichedContext;
  }

  const result = await dispatchResearchForUser(tool, section, enrichedContext, userId, {
    activeRunId: runId,
  });

  return NextResponse.json(result);
}
