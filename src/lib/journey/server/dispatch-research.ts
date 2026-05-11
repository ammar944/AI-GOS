import { createHash } from 'crypto';
import {
  dispatchResearchForUser,
  type DispatchResult,
} from '@/lib/ai/tools/research/dispatch';
import type { BaselineMetrics } from '@/lib/journey/baseline-metrics';
import type { MeetingInsights, MeetingMeta } from '@/lib/meeting-intel/types';
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

export const SECTION_TO_TOOL = {
  identityResolution: 'resolveIdentity',
  industryMarket: 'researchIndustry',
  competitors: 'researchCompetitors',
  icpValidation: 'researchICP',
  offerAnalysis: 'researchOffer',
  crossAnalysis: 'synthesizeResearch',
  keywordIntel: 'researchKeywords',
  mediaPlan: 'researchMediaPlan',
  deepResearchProgram: 'runDeepResearchProgram',
  positioningMarketCategory: 'positioningMarketCategory',
  positioningBuyerICP: 'positioningBuyerICP',
  positioningCompetitorLandscape: 'positioningCompetitorLandscape',
  positioningVoiceOfCustomer: 'positioningVoiceOfCustomer',
  positioningDemandIntent: 'positioningDemandIntent',
  positioningOfferDiagnostic: 'positioningOfferDiagnostic',
} as const;

export type JourneyResearchSection = keyof typeof SECTION_TO_TOOL;

const RUNNER_WIKI_TOPICS: Record<string, string[]> = {
  industryMarket: ['identity_*'],
  icpValidation: ['identity_*', 'market_*', 'pain_*', 'trend_*'],
  competitors: ['identity_*', 'market_*', 'icp_*'],
  offerAnalysis: ['identity_*', 'market_*', 'icp_*', 'competitor_*'],
  keywordIntel: ['identity_*', 'market_*', 'icp_*', 'competitor_*', 'offer_*'],
  crossAnalysis: ['*'],
  mediaPlan: ['*'],
};

const SECTION_DOC_BUDGETS: Record<string, number> = {
  identityResolution: 0,
  industryMarket: 10_000,
  keywordIntel: 10_000,
  icpValidation: 20_000,
  competitors: 20_000,
  offerAnalysis: 20_000,
  crossAnalysis: 25_000,
  mediaPlan: 25_000,
};

const MAX_DEEP_RESEARCH_CONTEXT_CHARS = 12_000;

interface WikiEntry {
  topic: string;
  content: string;
  source_runner: string;
  provenance: string;
  confidence: number;
  source_url?: string;
}

export interface JourneyResearchDispatchParams {
  userId: string;
  section: string;
  runId?: string | null;
  context: string;
  baselineMetrics?: BaselineMetrics;
}

/** Extract key summary fields from upstream research for synthesis context.
 *  Reduces full section JSON to essential upstream data. Exported for testing. */
export function summarizeForSynthesis(key: string, payload: unknown): string {
  const d = payload as Record<string, unknown>;
  try {
    switch (key) {
      case 'identityResolution':
        // Identity card is small, so pass it in full for category, keywords,
        // confidence, and evidence.
        return JSON.stringify(d, null, 1);
      case 'industryMarket':
        return JSON.stringify(
          {
            categorySnapshot: d.categorySnapshot,
            trendSignals: d.trendSignals,
            messagingOpportunities: (d.messagingOpportunities as Record<string, unknown>)
              ?.summaryRecommendations,
            marketOpportunities: d.marketOpportunities,
          },
          null,
          1,
        );
      case 'icpValidation':
        return JSON.stringify(
          {
            validatedPersona: d.validatedPersona,
            triggers: d.triggers,
            finalVerdict: d.finalVerdict,
            audienceRefinements: d.audienceRefinements,
          },
          null,
          1,
        );
      case 'offerAnalysis':
        return JSON.stringify(
          {
            overallScore: (d.offerStrength as Record<string, unknown>)?.overallScore,
            status: (d.recommendation as Record<string, unknown>)?.status,
            pricingPosition: (d.pricingAnalysis as Record<string, unknown>)
              ?.pricingPosition,
            redFlags: d.redFlags,
          },
          null,
          1,
        );
      case 'competitors': {
        const comps = Array.isArray(d.competitors) ? d.competitors.slice(0, 3) : [];
        const compSummary = comps.map((c: Record<string, unknown>) => ({
          name: c.name,
          positioning: c.positioning,
          weaknesses: c.weaknesses,
        }));
        return JSON.stringify(
          {
            competitors: compSummary,
            positioningMoves: d.positioningMoves,
          },
          null,
          1,
        );
      }
      default:
        return JSON.stringify(payload, null, 1);
    }
  } catch {
    return JSON.stringify(payload, null, 1);
  }
}

/**
 * Normalize wiki entries from DB: handles legacy double-encoded JSON strings.
 * If an entry is a string instead of an object, parse it; if parsing fails,
 * drop it and warn.
 */
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
      const hasRequired =
        typeof item.topic === 'string' && typeof item.content === 'string';
      if (!hasRequired) {
        console.warn('[dispatch] Dropped malformed wiki entry:', item);
      }
      return hasRequired;
    });
}

export function getJourneyResearchTool(section: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(SECTION_TO_TOOL, section)) {
    return null;
  }

  return SECTION_TO_TOOL[section as JourneyResearchSection];
}

function createDispatchError(section: string, error: string): DispatchResult {
  return {
    status: 'error',
    section: section || 'unknown',
    error,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function summarizeDeepResearchProgram(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (payload.status === 'error') {
    const error = typeof payload.error === 'string' ? payload.error : 'unknown error';
    return `Company research failed: ${error}`;
  }

  if (payload.status !== 'complete') {
    return null;
  }

  const data = isRecord(payload.data) ? payload.data : payload;
  const corpus = isRecord(data.corpus) ? data.corpus : data;
  const serialized = JSON.stringify(corpus, null, 1);

  return serialized.length > MAX_DEEP_RESEARCH_CONTEXT_CHARS
    ? `${serialized.slice(0, MAX_DEEP_RESEARCH_CONTEXT_CHARS)}\n... [company research corpus truncated]`
    : serialized;
}

async function stampActiveJourneyRunId(
  userId: string,
  runId: string | null | undefined,
): Promise<void> {
  if (!runId) return;

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

async function injectPriorResearchContext(
  section: string,
  runId: string | null | undefined,
  userId: string,
  context: string,
): Promise<string> {
  const sectionIndex = (DISPATCH_PIPELINE_ORDER as readonly string[]).indexOf(section);
  if (sectionIndex <= 0 || !runId) {
    return context;
  }

  try {
    const supabase = createAdminClient();
    const { data: sessionData } = await supabase
      .from('journey_sessions')
      .select('research_results, research_wiki')
      .eq('user_id', userId)
      .eq('run_id', runId)
      .maybeSingle();

    const rawWiki = sessionData?.research_wiki as {
      entries?: unknown;
      version?: number;
    } | null;
    const wikiEntries = normalizeWikiEntries(rawWiki?.entries);
    const wikiTopics = RUNNER_WIKI_TOPICS[section] ?? [];
    const useWiki =
      process.env.USE_RESEARCH_WIKI !== 'false' &&
      wikiEntries.length > 0 &&
      wikiTopics.length > 0;

    if (useWiki) {
      const filtered = wikiEntries.filter((entry) => {
        if (wikiTopics.includes('*')) return true;
        return wikiTopics.some((pattern) => {
          if (pattern.endsWith('*')) {
            return entry.topic.startsWith(pattern.slice(0, -1));
          }
          return entry.topic === pattern;
        });
      });

      if (filtered.length > 0) {
        filtered.sort(
          (a, b) =>
            a.topic.localeCompare(b.topic) ||
            a.source_runner.localeCompare(b.source_runner),
        );

        const lines = filtered.map((entry) => {
          const provenance =
            entry.provenance === 'template_default' ? ' (industry default)' : '';
          const url = entry.source_url ? ` [${entry.source_url}]` : '';
          return `- [${entry.topic}] ${entry.content}${provenance}${url}`;
        });

        const nextContext = `${context}\n\n# Research Knowledge Base (${filtered.length} findings from prior analysis)\n\n${lines.join('\n')}`;
        console.log(
          `[dispatch] Wiki context for ${section}: ${filtered.length}/${wikiEntries.length} entries, ${nextContext.length} chars`,
        );
        return nextContext;
      }
    }

    const research = sessionData?.research_results as Record<string, unknown> | null;
    if (!research || Object.keys(research).length === 0) {
      return context;
    }

    const deepResearchContext =
      section === 'deepResearchProgram'
        ? null
        : summarizeDeepResearchProgram(research.deepResearchProgram);
    const upstreamSections = DISPATCH_PIPELINE_ORDER.slice(0, sectionIndex);
    const researchSections: string[] = [];
    if (deepResearchContext) {
      researchSections.push(`## Company Research Corpus\n${deepResearchContext}`);
    }

    for (const key of upstreamSections) {
      const value = research[key];
      if (!value) continue;
      const payload = (value as Record<string, unknown>)?.data ?? value;
      const content =
        section === 'crossAnalysis'
          ? summarizeForSynthesis(key, payload)
          : JSON.stringify(payload, null, 1);
      researchSections.push(`## ${key}\n${content}`);
    }

    if (researchSections.length === 0) {
      return context;
    }

    return `${context}\n\n# Prior Research Results (use these to inform your analysis)\n\n${researchSections.join('\n\n')}`;
  } catch (error) {
    console.warn(`[dispatch] Failed to fetch prior research for ${section}:`, error);
    return context;
  }
}

async function injectReferenceDocuments(
  section: string,
  userId: string,
  context: string,
): Promise<string> {
  const docBudget = SECTION_DOC_BUDGETS[section] ?? 15_000;
  if (docBudget <= 0) {
    return context;
  }

  try {
    const docSupabase = createAdminClient();
    const { data: docs } = await docSupabase
      .from('business_profile_documents')
      .select('file_name, parsed_markdown, doc_kind, token_count')
      .eq('user_id', userId)
      .overlaps('section_tags', [section])
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    if (!docs || docs.length === 0) {
      return context;
    }

    let budgetRemaining = docBudget;
    const selected: typeof docs = [];
    for (const doc of docs) {
      if (doc.token_count <= budgetRemaining) {
        selected.push(doc);
        budgetRemaining -= doc.token_count;
      }
    }

    if (selected.length === 0) {
      return context;
    }

    const docBlock = selected
      .map(
        (doc) =>
          `--- ${doc.file_name} (${doc.doc_kind ?? 'document'}) ---\n${doc.parsed_markdown}`,
      )
      .join('\n\n');

    return `${context}\n\n# Reference Documents (uploaded by user — use to inform your analysis)\n\n${docBlock}`;
  } catch (error) {
    console.warn(`[dispatch] Failed to fetch user documents for ${section}:`, error);
    return context;
  }
}

async function injectMeetingIntelligence(
  runId: string | null | undefined,
  userId: string,
  context: string,
): Promise<string> {
  if (!runId) {
    return context;
  }

  try {
    const meetingSupabase = createAdminClient();
    const { data: meetingSession } = await meetingSupabase
      .from('journey_sessions')
      .select('meeting_transcripts')
      .eq('user_id', userId)
      .eq('run_id', runId)
      .maybeSingle();

    const meetings = (meetingSession?.meeting_transcripts ?? []) as MeetingMeta[];
    const readyMeetings = meetings.filter((meeting) => meeting.status === 'ready');
    if (readyMeetings.length === 0) {
      return context;
    }

    const docIds = readyMeetings.map((meeting) => meeting.documentId);
    const { data: docs } = await meetingSupabase
      .from('business_profile_documents')
      .select('id, extracted_fields')
      .in('id', docIds);

    if (!docs || docs.length === 0) {
      return context;
    }

    const { buildAllMeetingIntelBlocks } = await import('@/lib/meeting-intel/context-block');
    const extractedMap: Record<string, MeetingInsights> = {};
    for (const doc of docs) {
      if (
        doc.extracted_fields &&
        Object.keys(doc.extracted_fields as Record<string, unknown>).length > 0
      ) {
        extractedMap[doc.id] = doc.extracted_fields as MeetingInsights;
      }
    }

    const meetingBlock = buildAllMeetingIntelBlocks(readyMeetings, extractedMap);
    return meetingBlock ? `${meetingBlock}\n\n${context}` : context;
  } catch (error) {
    console.warn('[dispatch] Failed to inject meeting intelligence:', error);
    return context;
  }
}

function injectMeetingPriorityInstruction(context: string): string {
  const hasMeetingIntelligence =
    context.startsWith('══ MEETING INTELLIGENCE ══') ||
    /\n══ MEETING INTELLIGENCE ══/.test(context);

  if (!hasMeetingIntelligence) {
    return context;
  }

  const meetingInstruction = `\n\n# Meeting Intelligence Priority\nIf "MEETING INTELLIGENCE" blocks appear below, these contain data extracted from actual client conversations.\n- Fields with direct quotes (marked with "—") are HIGH CONFIDENCE — prioritize over web-scraped data.\n- Fields WITHOUT quotes are AI-inferred summaries — treat as MEDIUM CONFIDENCE, on par with web research.\n- When meeting data contradicts web research, note the discrepancy. Prefer the meeting version ONLY if it includes a direct quote.\n- Cite meeting quotes using format: [Meeting: "exact quote"].\n- Use pain points to inform targeting, budget signals to ground spend, competitor mentions to focus competitive analysis.\n`;

  return meetingInstruction + context;
}

async function injectIdentityClassifications(
  section: string,
  runId: string | null | undefined,
  userId: string,
  context: string,
): Promise<string> {
  if (section === 'identityResolution' || !runId) {
    return context;
  }

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

    if (!identityData || typeof identityData !== 'object') {
      return context;
    }

    const businessModelType =
      typeof identityData.businessModelType === 'string'
        ? identityData.businessModelType
        : 'unknown';
    const awarenessLevel =
      typeof identityData.awarenessLevel === 'string'
        ? identityData.awarenessLevel
        : 'unknown';

    return `[businessModelType:${businessModelType}]\n[awarenessLevel:${awarenessLevel}]\n\n${context}`;
  } catch (error) {
    console.warn('[dispatch] Failed to inject identity classifications:', error);
    return context;
  }
}

async function injectOnboardingAnswers(
  runId: string | null | undefined,
  userId: string,
  context: string,
): Promise<string> {
  if (!runId) {
    return context;
  }

  try {
    const supabase = createAdminClient();
    const { data: sessionRow } = await supabase
      .from('journey_sessions')
      .select('onboarding_data')
      .eq('user_id', userId)
      .eq('run_id', runId)
      .maybeSingle();

    const onboardingData = sessionRow?.onboarding_data as Record<string, unknown> | null;
    if (!onboardingData || Object.keys(onboardingData).length === 0) {
      return context;
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(onboardingData)) {
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;
      const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
      lines.push(`${key}: ${displayValue}`);
    }

    if (lines.length === 0) {
      return context;
    }

    const block = `### User Onboarding Answers (Pre-Pitch Positioning Audit)\n${lines.join('\n')}`;
    return `${block}\n\n${context}`;
  } catch (error) {
    console.warn('[dispatch] Failed to inject onboarding answers:', error);
    return context;
  }
}

export async function buildJourneyResearchDispatchContext(
  params: JourneyResearchDispatchParams,
): Promise<string> {
  let enrichedContext = params.context;
  enrichedContext = await injectOnboardingAnswers(
    params.runId,
    params.userId,
    enrichedContext,
  );
  enrichedContext = await injectPriorResearchContext(
    params.section,
    params.runId,
    params.userId,
    enrichedContext,
  );
  enrichedContext = await injectReferenceDocuments(
    params.section,
    params.userId,
    enrichedContext,
  );
  enrichedContext = await injectMeetingIntelligence(
    params.runId,
    params.userId,
    enrichedContext,
  );
  enrichedContext = injectMeetingPriorityInstruction(enrichedContext);
  enrichedContext = await injectIdentityClassifications(
    params.section,
    params.runId,
    params.userId,
    enrichedContext,
  );

  return enrichedContext;
}

export async function dispatchJourneyResearchForUser(
  params: JourneyResearchDispatchParams,
): Promise<DispatchResult> {
  const section = params.section.trim();
  const context = params.context.trim();
  const runId = typeof params.runId === 'string' ? params.runId.trim() : '';

  if (!section) {
    return createDispatchError(
      section,
      'Missing required fields: section',
    );
  }

  const tool = getJourneyResearchTool(section);
  if (!tool) {
    return createDispatchError(section, `Unknown section: ${section}`);
  }

  if (!runId) {
    return createDispatchError(section, 'Missing required field: runId');
  }

  await stampActiveJourneyRunId(params.userId, runId);

  const enrichedContext = await buildJourneyResearchDispatchContext({
    ...params,
    section,
    runId,
    context,
  });
  const contextHash = createHash('sha256')
    .update(enrichedContext)
    .digest('hex')
    .slice(0, 16);

  console.log(
    `[dispatch] section=${section} contextHash=${contextHash} len=${enrichedContext.length}`,
  );

  return dispatchResearchForUser(tool, section, enrichedContext, params.userId, {
    activeRunId: runId,
    baselineMetrics: params.baselineMetrics,
  });
}
