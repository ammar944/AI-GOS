// POST /api/profiles/insights — save AI insights from research back to business profile
// Called fire-and-forget when any research section completes

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { saveProfileInsights } from '@/lib/profiles/business-profiles';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId, section, data } = body as {
    sessionId?: string;
    section?: string;
    data?: Record<string, unknown>;
  };

  if (!sessionId || !section || !data) {
    return Response.json({ error: 'sessionId, section, and data required' }, { status: 400 });
  }

  // Look up the session to get the company name
  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from('journey_sessions')
    .select('metadata')
    .eq('run_id', sessionId)
    .eq('user_id', userId)
    .single();

  const metadata = (session?.metadata ?? {}) as Record<string, unknown>;
  const companyName = (metadata.companyName as string) ?? '';

  if (!companyName) {
    // No company name — can't match to a profile
    return Response.json({ ok: false, reason: 'no company name' });
  }

  // Build insights payload based on section — extract intelligence fields from each research type
  const insights: Record<string, unknown> = {};

  if (section === 'industryMarket') {
    insights.marketOpportunities = data.marketOpportunities ?? null;
    insights.trendSignals = data.trendSignals ?? null;
    insights.categorySnapshot = data.categorySnapshot ?? null;
  }

  if (section === 'icpValidation') {
    insights.decisionFactors = data.decisionFactors ?? null;
    insights.audienceRefinements = data.audienceRefinements ?? null;
    insights.icpVerdict = data.finalVerdict ?? null;
  }

  if (section === 'competitors') {
    insights.whiteSpaceGaps = data.whiteSpaceGaps ?? null;
    insights.positioningMoves = data.positioningMoves ?? null;
    insights.reviewCrossAnalysis = data.reviewCrossAnalysis ?? null;
  }

  if (section === 'offerAnalysis') {
    insights.offerScore = data.offerStrength ?? null;
    insights.pricingAnalysis = data.pricingAnalysis ?? null;
    insights.offerRedFlags = data.redFlags ?? null;
  }

  if (section === 'keywordIntel') {
    insights.topKeywordOpportunities = data.topOpportunities ?? null;
    insights.competitorKeywordGaps = data.competitorGaps ?? null;
    insights.keywordQuickWins = data.quickWins ?? null;
  }

  if (section === 'crossAnalysis') {
    insights.positioningStrategy = data.positioningStrategy ?? null;
    insights.keyInsights = data.keyInsights ?? [];
    insights.messagingAngles = data.messagingAngles ?? null;
    insights.readinessScorecard = data.readinessScorecard ?? null;
    insights.platformRecommendations = data.platformRecommendations ?? null;
  }

  const saved = await saveProfileInsights(userId, companyName, insights);

  return Response.json({ ok: saved });
}
