import type { CardState, SectionKey } from './types';

let cardIdCounter = 0;
function nextCardId(section: string, type: string): string {
  return `${section}-${type}-${++cardIdCounter}`;
}

export function resetCardIdCounter() {
  cardIdCounter = 0;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function makeCard(
  section: SectionKey,
  cardType: string,
  label: string,
  content: Record<string, unknown>,
): CardState {
  return {
    id: nextCardId(section, cardType),
    sectionKey: section,
    cardType,
    label,
    content,
    status: 'draft',
    versions: [],
  };
}

function parseIndustryMarket(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'industryMarket';

  // Category Snapshot StatGrid
  const snapshot = asRecord(data.categorySnapshot);
  if (snapshot) {
    const stats = [
      { label: 'Category', value: asString(snapshot.category) },
      { label: 'Market Size', value: asString(snapshot.marketSize) },
      { label: 'Maturity', value: asString(snapshot.marketMaturity) },
      { label: 'Awareness', value: asString(snapshot.awarenessLevel) },
      { label: 'Buying Behavior', value: asString(snapshot.buyingBehavior)?.replaceAll('_', ' ') },
      { label: 'Sales Cycle', value: asString(snapshot.averageSalesCycle) },
    ].filter((s): s is { label: string; value: string } => s.value !== null);

    if (stats.length > 0) {
      cards.push(makeCard(section, 'stat-grid', 'Category Snapshot', { stats }));
    }
  }

  // Pain Points
  const painPoints = asRecord(data.painPoints);
  const painItems = asStringArray(painPoints?.primary);
  if (painItems.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Pain Points', {
      items: painItems,
      accent: 'var(--section-market)',
    }));
  }

  // Demand Drivers
  const dynamics = asRecord(data.marketDynamics);
  const drivers = asStringArray(dynamics?.demandDrivers);
  if (drivers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Demand Drivers', {
      items: drivers,
      accent: 'var(--section-market)',
    }));
  }

  // Buying Triggers
  const triggers = asStringArray(dynamics?.buyingTriggers);
  if (triggers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Buying Triggers', {
      items: triggers,
      accent: 'var(--section-market)',
    }));
  }

  // Barriers
  const barriers = asStringArray(dynamics?.barriersToPurchase);
  if (barriers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Barriers to Purchase', {
      items: barriers,
      accent: 'var(--section-market)',
    }));
  }

  // Trend Signals
  const trends = Array.isArray(data.trendSignals) ? data.trendSignals : [];
  for (const trend of trends) {
    const t = asRecord(trend);
    if (t && asString(t.trend)) {
      cards.push(makeCard(section, 'trend-card', 'Trend Signal', {
        trend: asString(t.trend)!,
        direction: asString(t.direction) ?? 'stable',
        evidence: asString(t.evidence) ?? '',
      }));
    }
  }

  // Messaging Opportunities
  const messaging = asRecord(data.messagingOpportunities);
  const recs = asStringArray(messaging?.summaryRecommendations);
  if (recs.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Messaging Opportunities', {
      items: recs,
      accent: 'var(--accent-green)',
    }));
  }

  return cards;
}

// -- Competitors ---------------------------------------------------------------

function parseCompetitorIntel(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'competitors';

  const competitors = asRecordArray(data.competitors);
  for (const competitor of competitors) {
    const name = asString(competitor.name) ?? 'Unknown Competitor';
    const adActivity = asRecord(competitor.adActivity);
    const threat = asRecord(competitor.threatAssessment);
    const libraryLinks = asRecord(competitor.libraryLinks);

    cards.push(makeCard(section, 'competitor-card', name, {
      name,
      website: asString(competitor.website),
      positioning: asString(competitor.positioning),
      price: asString(competitor.price),
      pricingConfidence: asString(competitor.pricingConfidence),
      strengths: asStringArray(competitor.strengths),
      weaknesses: asStringArray(competitor.weaknesses),
      opportunities: asStringArray(competitor.opportunities),
      ourAdvantage: asString(competitor.ourAdvantage),
      adActivity: adActivity
        ? {
            activeAdCount: asNumber(adActivity.activeAdCount) ?? 0,
            platforms: asStringArray(adActivity.platforms),
            themes: asStringArray(adActivity.themes),
            evidence: asString(adActivity.evidence) ?? '',
            sourceConfidence: (asString(adActivity.sourceConfidence) as 'high' | 'medium' | 'low') ?? 'low',
          }
        : undefined,
      adCreatives: Array.isArray(competitor.adCreatives)
        ? (competitor.adCreatives as Array<Record<string, unknown>>)
            .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
            .map((c) => ({
              platform: (asString(c.platform) ?? 'meta') as 'linkedin' | 'meta' | 'google',
              id: asString(c.id) ?? '',
              advertiser: asString(c.advertiser) ?? '',
              headline: asString(c.headline),
              body: asString(c.body),
              imageUrl: asString(c.imageUrl),
              videoUrl: asString(c.videoUrl),
              format: (asString(c.format) ?? 'unknown') as 'video' | 'image' | 'carousel' | 'text' | 'message' | 'unknown',
              isActive: c.isActive === true,
              detailsUrl: asString(c.detailsUrl),
              firstSeen: asString(c.firstSeen),
              lastSeen: asString(c.lastSeen),
            }))
        : undefined,
      libraryLinks: libraryLinks
        ? {
            metaLibraryUrl: asString(libraryLinks.metaLibraryUrl),
            linkedInLibraryUrl: asString(libraryLinks.linkedInLibraryUrl),
            googleAdvertiserUrl: asString(libraryLinks.googleAdvertiserUrl),
          }
        : undefined,
      topAdHooks: asStringArray(threat?.topAdHooks),
      counterPositioning: asString(threat?.counterPositioning),
    }));
  }

  // Market Patterns
  const marketPatterns = asStringArray(data.marketPatterns);
  if (marketPatterns.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Market Patterns', {
      items: marketPatterns,
      accent: 'var(--accent-cyan)',
    }));
  }

  // White-Space Gaps
  const gaps = asRecordArray(data.whiteSpaceGaps);
  for (const gap of gaps) {
    const gapName = asString(gap.gap);
    if (gapName) {
      cards.push(makeCard(section, 'gap-card', gapName, {
        gap: gapName,
        type: asString(gap.type),
        evidence: asString(gap.evidence),
        exploitability: asNumber(gap.exploitability),
        impact: asNumber(gap.impact),
        recommendedAction: asString(gap.recommendedAction),
      }));
    }
  }

  return cards;
}

// -- ICP Validation ------------------------------------------------------------

function parseICPValidation(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'icpValidation';

  // Persona stats
  const stats = [
    { label: 'Validated Persona', value: asString(data.validatedPersona) },
    { label: 'Audience Size', value: asString(data.audienceSize) },
    { label: 'Confidence', value: asNumber(data.confidenceScore) !== null ? `${asNumber(data.confidenceScore)}/100` : null },
    { label: 'Demographics', value: asString(data.demographics) },
  ].filter((s): s is { label: string; value: string } => s.value !== null);

  if (stats.length > 0) {
    cards.push(makeCard(section, 'stat-grid', 'ICP Overview', { stats }));
  }

  // Final Verdict
  const finalVerdict = asRecord(data.finalVerdict);
  if (finalVerdict && asString(finalVerdict.status)) {
    cards.push(makeCard(section, 'verdict-card', 'Final Verdict', {
      status: asString(finalVerdict.status)!,
      reasoning: asString(finalVerdict.reasoning),
    }));
  }

  // Decision Process
  const decisionProcess = asString(data.decisionProcess);
  if (decisionProcess) {
    cards.push(makeCard(section, 'prose-card', 'Decision Process', { text: decisionProcess }));
  }

  // Channels, Triggers, Objections
  const channels = asStringArray(data.channels);
  if (channels.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Best Channels', {
      items: channels,
      accent: 'var(--accent-cyan)',
    }));
  }

  const triggers = asStringArray(data.triggers);
  if (triggers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Buying Triggers', {
      items: triggers,
      accent: 'var(--accent-blue)',
    }));
  }

  const objections = asStringArray(data.objections);
  if (objections.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Core Objections', {
      items: objections,
      accent: 'var(--accent-red)',
    }));
  }

  // Recommendations
  const recommendations = asStringArray(finalVerdict?.recommendations);
  if (recommendations.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Recommendations', {
      items: recommendations,
      accent: 'var(--accent-green)',
    }));
  }

  return cards;
}

// -- Offer Analysis ------------------------------------------------------------

function parseOfferAnalysis(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'offerAnalysis';

  // Score + Status
  const offerStrength = asRecord(data.offerStrength);
  const recommendation = asRecord(data.recommendation);
  const scoreStats = [
    { label: 'Overall Score', value: asNumber(offerStrength?.overallScore) !== null ? `${asNumber(offerStrength?.overallScore)}/10` : null },
    { label: 'Recommendation', value: asString(recommendation?.status)?.replaceAll('_', ' ') ?? null },
  ].filter((s): s is { label: string; value: string } => s.value !== null);

  if (scoreStats.length > 0) {
    cards.push(makeCard(section, 'stat-grid', 'Offer Score', { stats: scoreStats }));
  }

  // Rationale
  const reasoning = asString(recommendation?.summary);
  if (reasoning) {
    cards.push(makeCard(section, 'prose-card', 'Recommendation Rationale', { text: reasoning }));
  }

  // Pricing Analysis
  const pricingAnalysis = asRecord(data.pricingAnalysis);
  if (pricingAnalysis) {
    const hasContent = asString(pricingAnalysis.currentPricing) || asString(pricingAnalysis.marketBenchmark) || asString(pricingAnalysis.pricingPosition) || asString(pricingAnalysis.coldTrafficViability);
    if (hasContent) {
      cards.push(makeCard(section, 'pricing-card', 'Pricing Analysis', {
        currentPricing: asString(pricingAnalysis.currentPricing),
        marketBenchmark: asString(pricingAnalysis.marketBenchmark),
        pricingPosition: asString(pricingAnalysis.pricingPosition),
        coldTrafficViability: asString(pricingAnalysis.coldTrafficViability),
      }));
    }
  }

  // Strengths, Weaknesses, Actions, Messaging
  const strengths = asStringArray(recommendation?.topStrengths);
  if (strengths.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Strengths', {
      items: strengths,
      accent: 'var(--accent-green)',
    }));
  }

  const weaknesses = asStringArray(recommendation?.priorityFixes);
  if (weaknesses.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Weaknesses', {
      items: weaknesses,
      accent: 'var(--accent-red)',
    }));
  }

  const actionItems = asStringArray(recommendation?.recommendedActionPlan);
  if (actionItems.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Recommended Actions', {
      items: actionItems,
      accent: 'var(--accent-blue)',
    }));
  }

  const messagingRecs = asStringArray(data.messagingRecommendations);
  if (messagingRecs.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Messaging Recommendations', {
      items: messagingRecs,
      accent: 'var(--accent-cyan)',
    }));
  }

  // Market Fit
  const marketFit = asString(data.marketFitAssessment);
  if (marketFit) {
    cards.push(makeCard(section, 'prose-card', 'Market Fit Assessment', { text: marketFit }));
  }

  // Red Flags
  const redFlags = asRecordArray(data.redFlags);
  for (const flag of redFlags) {
    const issue = asString(flag.issue);
    if (issue) {
      cards.push(makeCard(section, 'flag-card', issue, {
        issue,
        severity: asString(flag.severity),
        priority: asNumber(flag.priority),
        evidence: asString(flag.evidence),
        recommendedAction: asString(flag.recommendedAction),
      }));
    }
  }

  return cards;
}

// -- Keyword Intel -------------------------------------------------------------

function parseKeywordIntel(data: Record<string, unknown>): CardState[] {
  // Keyword intel wraps the existing JourneyKeywordIntelDetail component
  // A single card passes raw data through
  if (Object.keys(data).length === 0) return [];

  return [makeCard('keywordIntel', 'keyword-grid', 'Keyword Intelligence', { rawData: data })];
}

// -- Cross Analysis (Strategic Synthesis) --------------------------------------

function parseCrossAnalysis(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'crossAnalysis';

  // Positioning Strategy
  const positioningStrategy = asRecord(data.positioningStrategy);
  if (positioningStrategy) {
    const hasContent = asString(positioningStrategy.recommendedAngle) || asString(positioningStrategy.leadRecommendation) || asString(positioningStrategy.keyDifferentiator);
    if (hasContent) {
      cards.push(makeCard(section, 'strategy-card', 'Positioning Strategy', {
        recommendedAngle: asString(positioningStrategy.recommendedAngle),
        leadRecommendation: asString(positioningStrategy.leadRecommendation),
        keyDifferentiator: asString(positioningStrategy.keyDifferentiator),
      }));
    }
  }

  // Planning Context
  const planningContext = asRecord(data.planningContext);
  if (planningContext) {
    const contextStats = [
      { label: 'Budget', value: asString(planningContext.monthlyBudget) },
      { label: 'Target CPL', value: asString(planningContext.targetCpl) },
      { label: 'Target CAC', value: asString(planningContext.targetCac) },
    ].filter((s): s is { label: string; value: string } => s.value !== null);

    if (contextStats.length > 0) {
      cards.push(makeCard(section, 'stat-grid', 'Planning Context', { stats: contextStats }));
    }

    const downstream = asStringArray(planningContext.downstreamSequence);
    if (downstream.length > 0) {
      cards.push(makeCard(section, 'bullet-list', 'Downstream Sequence', {
        items: downstream,
        accent: 'var(--accent-blue)',
      }));
    }
  }

  // Charts
  const charts = asRecordArray(data.charts);
  for (const chart of charts) {
    const title = asString(chart.title);
    if (title) {
      cards.push(makeCard(section, 'chart-card', title, {
        title,
        description: asString(chart.description),
        imageUrl: asString(chart.imageUrl) ?? asString(chart.url),
      }));
    }
  }

  // Strategic Narrative
  const narrative = asString(data.strategicNarrative);
  if (narrative) {
    cards.push(makeCard(section, 'prose-card', 'Strategic Narrative', { text: narrative }));
  }

  // Key Insights
  const keyInsights = asRecordArray(data.keyInsights);
  for (const insight of keyInsights) {
    const headline = asString(insight.insight);
    if (headline) {
      cards.push(makeCard(section, 'insight-card', headline, {
        insight: headline,
        source: asString(insight.source),
        implication: asString(insight.implication),
      }));
    }
  }

  // Platform Recommendations
  const platformRecs = asRecordArray(data.platformRecommendations);
  for (const platform of platformRecs) {
    const name = asString(platform.platform);
    if (name) {
      cards.push(makeCard(section, 'platform-card', name, {
        platform: name,
        role: asString(platform.role),
        budgetAllocation: asString(platform.budgetAllocation),
        rationale: asString(platform.rationale),
      }));
    }
  }

  // Messaging Angles
  const angles = asRecordArray(data.messagingAngles);
  for (const angle of angles) {
    const title = asString(angle.angle);
    if (title) {
      cards.push(makeCard(section, 'angle-card', title, {
        angle: title,
        exampleHook: asString(angle.exampleHook),
        evidence: asString(angle.evidence),
      }));
    }
  }

  // Critical Success Factors
  const successFactors = asStringArray(data.criticalSuccessFactors);
  if (successFactors.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Critical Success Factors', {
      items: successFactors,
      accent: 'var(--accent-green)',
    }));
  }

  // Next Steps
  const nextSteps = asStringArray(data.nextSteps);
  if (nextSteps.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Next Steps', {
      items: nextSteps,
      accent: 'var(--accent-blue)',
    }));
  }

  return cards;
}

export function parseResearchToCards(
  section: SectionKey,
  data: Record<string, unknown>,
): CardState[] {
  switch (section) {
    case 'industryMarket':
      return parseIndustryMarket(data);
    case 'competitors':
      return parseCompetitorIntel(data);
    case 'icpValidation':
      return parseICPValidation(data);
    case 'offerAnalysis':
      return parseOfferAnalysis(data);
    case 'keywordIntel':
      return parseKeywordIntel(data);
    case 'crossAnalysis':
      return parseCrossAnalysis(data);
    default:
      return [];
  }
}
