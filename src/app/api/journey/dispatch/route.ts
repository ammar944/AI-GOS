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

/**
 * Normalize wiki entries from DB: handles legacy double-encoded JSON strings
 * (bug from commit before e2a23c34). If an entry is a string instead of an
 * object, parse it; if parsing fails, drop it and warn. See: e2a23c34.
 */
interface WikiEntry {
  topic: string;
  content: string;
  source_runner: string;
  provenance: string;
  confidence: number;
  source_url?: string;
}

export function normalizeWikiEntries(raw: unknown): WikiEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        try {
          const parsed = JSON.parse(item);
          return typeof parsed === 'object' && parsed !== null ? parsed : null;
        } catch {
          return null;
        }
      }
      return typeof item === 'object' && item !== null ? item : null;
    })
    .filter((item): item is WikiEntry => {
      if (!item) return false;
      const hasRequired = typeof item.topic === 'string' && typeof item.content === 'string';
      if (!hasRequired) {
        console.warn('[dispatch] Dropped malformed wiki entry:', item);
      }
      return hasRequired;
    });
}

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

  // Wiki topic filters: each runner declares what upstream knowledge it needs.
  // '*' means all entries. Patterns match topic prefixes (e.g., 'identity_*' matches 'identity_category').
  const RUNNER_WIKI_TOPICS: Record<string, string[]> = {
    industryMarket: ['identity_*'],
    icpValidation: ['identity_*', 'market_*', 'pain_*', 'trend_*'],
    competitors: ['identity_*', 'market_*', 'icp_*'],
    offerAnalysis: ['identity_*', 'market_*', 'icp_*', 'competitor_*'],
    keywordIntel: ['identity_*', 'market_*', 'icp_*', 'competitor_*', 'offer_*'],
    crossAnalysis: ['*'],
    mediaPlan: ['*'],
  };

  // Only enrich if this section has upstream sections AND we have a runId
  if (sectionIndex > 0 && runId) {
    try {
      const supabase = createAdminClient();
      const { data: sessionData } = await supabase
        .from('journey_sessions')
        .select('research_results, research_wiki')
        .eq('user_id', userId)
        .eq('run_id', runId)
        .maybeSingle();

      // --- Research Wiki path (preferred): structured entries from all upstream runners ---
      const rawWiki = sessionData?.research_wiki as { entries?: unknown; version?: number } | null;
      const wikiEntries = normalizeWikiEntries(rawWiki?.entries);
      const wikiTopics = RUNNER_WIKI_TOPICS[section] ?? [];
      const useWiki = process.env.USE_RESEARCH_WIKI !== 'false' && wikiEntries.length > 0 && wikiTopics.length > 0;

      if (useWiki) {
        // Filter entries by this runner's topic needs
        const filtered = wikiEntries.filter((e) => {
          if (wikiTopics.includes('*')) return true;
          return wikiTopics.some((pattern) => {
            if (pattern.endsWith('*')) {
              return e.topic.startsWith(pattern.slice(0, -1));
            }
            return e.topic === pattern;
          });
        });

        if (filtered.length > 0) {
          // Sort deterministically: topic alpha → source_runner pipeline order → content
          filtered.sort((a, b) => a.topic.localeCompare(b.topic) || a.source_runner.localeCompare(b.source_runner));

          // Format as structured context block
          const lines = filtered.map((e) => {
            const prov = e.provenance === 'template_default' ? ' (industry default)' : '';
            const url = e.source_url ? ` [${e.source_url}]` : '';
            return `- [${e.topic}] ${e.content}${prov}${url}`;
          });

          enrichedContext = `${context}\n\n# Research Knowledge Base (${filtered.length} findings from prior analysis)\n\n${lines.join('\n')}`;
          console.log(`[dispatch] Wiki context for ${section}: ${filtered.length}/${wikiEntries.length} entries, ${enrichedContext.length} chars`);
        }
      }

      // --- Fallback: legacy summarization path (for pre-wiki sessions or wiki disabled) ---
      if (enrichedContext === context) {
        const research = sessionData?.research_results as Record<string, unknown> | null;
        if (research && Object.keys(research).length > 0) {
          const upstreamSections = PIPELINE_ORDER.slice(0, sectionIndex);
          const researchSections: string[] = [];
          for (const key of upstreamSections) {
            const value = research[key];
            if (!value) continue;
            const payload = (value as Record<string, unknown>)?.data ?? value;
            const content = section === 'crossAnalysis'
              ? summarizeForSynthesis(key, payload)
              : JSON.stringify(payload, null, 1);
            researchSections.push(`## ${key}\n${content}`);
          }
          if (researchSections.length > 0) {
            enrichedContext = `${context}\n\n# Prior Research Results (use these to inform your analysis)\n\n${researchSections.join('\n\n')}`;
          }
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
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

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

  // --- Meeting Intelligence injection ---
  // When the session has meeting transcripts with extracted insights, inject a
  // structured "Meeting Intelligence" block into the runner context.
  // This is higher-signal than uploaded documents and appears first.
  if (runId) {
    try {
      const meetingSupabase = createAdminClient();
      const { data: meetingSession } = await meetingSupabase
        .from('journey_sessions')
        .select('meeting_transcripts')
        .eq('user_id', userId)
        .eq('run_id', runId)
        .maybeSingle();

      const meetings = (meetingSession?.meeting_transcripts ?? []) as import('@/lib/meeting-intel/types').MeetingMeta[];
      const readyMeetings = meetings.filter((m) => m.status === 'ready');

      if (readyMeetings.length > 0) {
        const docIds = readyMeetings.map((m) => m.documentId);
        const { data: docs } = await meetingSupabase
          .from('business_profile_documents')
          .select('id, extracted_fields')
          .in('id', docIds);

        if (docs && docs.length > 0) {
          const { buildAllMeetingIntelBlocks } = await import('@/lib/meeting-intel/context-block');
          const extractedMap: Record<string, import('@/lib/meeting-intel/types').MeetingInsights> = {};
          for (const doc of docs) {
            if (doc.extracted_fields && Object.keys(doc.extracted_fields as Record<string, unknown>).length > 0) {
              extractedMap[doc.id] = doc.extracted_fields as import('@/lib/meeting-intel/types').MeetingInsights;
            }
          }

          const meetingBlock = buildAllMeetingIntelBlocks(readyMeetings, extractedMap);
          if (meetingBlock) {
            enrichedContext = `${meetingBlock}\n\n${enrichedContext}`;
          }
        }
      }
    } catch (err) {
      console.warn('[dispatch] Failed to inject meeting intelligence:', err);
    }
  }

  // --- Conditional runner instruction for meeting intelligence priority ---
  // Use explicit flag set when meeting block is built (above), not string scan —
  // wiki entries can contain similar strings.
  const hasMeetingIntelligence = enrichedContext.startsWith('══ MEETING INTELLIGENCE ══') ||
    /\n══ MEETING INTELLIGENCE ══/.test(enrichedContext);
  if (hasMeetingIntelligence) {
    const meetingInstruction = `\n\n# Meeting Intelligence Priority\nIf "MEETING INTELLIGENCE" blocks appear below, these contain data extracted from actual client conversations.\n- Fields with direct quotes (marked with "—") are HIGH CONFIDENCE — prioritize over web-scraped data.\n- Fields WITHOUT quotes are AI-inferred summaries — treat as MEDIUM CONFIDENCE, on par with web research.\n- When meeting data contradicts web research, note the discrepancy. Prefer the meeting version ONLY if it includes a direct quote.\n- Cite meeting quotes using format: [Meeting: "exact quote"].\n- Use pain points to inform targeting, budget signals to ground spend, competitor mentions to focus competitive analysis.\n`;
    enrichedContext = meetingInstruction + enrichedContext;
  }

  // --- Identity card classifications injection ---
  // The media-plan runner (and, in Phase 2, other runners) reads
  // `[businessModelType:X]` and `[awarenessLevel:Y]` metadata lines to route
  // funnel / channel / creative decisions. These classifications live on the
  // identity card. Skip the fetch for the identityResolution section itself
  // (it produces the card; doesn't consume it).
  if (section !== 'identityResolution' && runId) {
    try {
      const metaSupabase = createAdminClient();
      const { data: sessionRow } = await metaSupabase
        .from('journey_sessions')
        .select('research_results')
        .eq('user_id', userId)
        .eq('run_id', runId)
        .maybeSingle();
      const identityData = (
        sessionRow?.research_results as
          | { identityResolution?: { data?: Record<string, unknown> } }
          | null
      )?.identityResolution?.data;
      if (identityData && typeof identityData === 'object') {
        const bmType = typeof identityData.businessModelType === 'string'
          ? identityData.businessModelType
          : 'unknown';
        const awareness = typeof identityData.awarenessLevel === 'string'
          ? identityData.awarenessLevel
          : 'unknown';
        const metaLines = `[businessModelType:${bmType}]\n[awarenessLevel:${awareness}]\n\n`;
        enrichedContext = metaLines + enrichedContext;
      }
    } catch (err) {
      console.warn('[dispatch] Failed to inject identity classifications:', err);
    }
  }

  // Context hash for debugging non-determinism across runs
  const { createHash } = await import('crypto');
  const contextHash = createHash('sha256').update(enrichedContext).digest('hex').slice(0, 16);
  console.log(`[dispatch] section=${section} contextHash=${contextHash} len=${enrichedContext.length}`);

  const result = await dispatchResearchForUser(tool, section, enrichedContext, userId, {
    activeRunId: runId,
  });

  return NextResponse.json(result);
}
