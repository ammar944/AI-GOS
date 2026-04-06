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
  description?: string,
): CardState {
  return {
    id: nextCardId(section, cardType),
    sectionKey: section,
    cardType,
    label,
    ...(description ? { description } : {}),
    content,
    status: 'draft',
    versions: [],
  };
}

function parseIndustryMarket(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'industryMarket';

  // Intelligence: Market Opportunities
  const opportunities = asRecordArray(data.marketOpportunities);
  if (opportunities.length > 0) {
    cards.push(makeCard(section, 'opportunity-card', 'Opportunities to Exploit', {
      opportunities: opportunities.map((o) => ({
        opportunity: asString(o.opportunity) ?? '',
        size: asString(o.size) ?? 'medium',
        timing: asString(o.timing) ?? 'now',
        difficulty: asString(o.difficulty) ?? 'medium',
        evidence: asString(o.evidence) ?? '',
      })).filter((o) => o.opportunity),
    }, 'Actionable market gaps ranked by size, timing, and difficulty'));
  }

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
      cards.push(makeCard(section, 'stat-grid', 'Category Snapshot', { stats }, 'At-a-glance market characteristics and buying dynamics'));
    }
  }

  // Pain Points
  const painPoints = asRecord(data.painPoints);
  const painItems = asStringArray(painPoints?.primary);
  if (painItems.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Pain Points', {
      items: painItems,
      accent: 'var(--section-market)',
    }, 'Core frustrations your target market experiences today'));
  }

  // Demand Drivers
  const dynamics = asRecord(data.marketDynamics);
  const drivers = asStringArray(dynamics?.demandDrivers);
  if (drivers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Demand Drivers', {
      items: drivers,
      accent: 'var(--section-market)',
    }, 'Forces accelerating demand in this market right now'));
  }

  // Buying Triggers
  const triggers = asStringArray(dynamics?.buyingTriggers);
  if (triggers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Buying Triggers', {
      items: triggers,
      accent: 'var(--section-market)',
    }, 'Events or situations that make prospects ready to purchase'));
  }

  // Barriers
  const barriers = asStringArray(dynamics?.barriersToPurchase);
  if (barriers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Barriers to Purchase', {
      items: barriers,
      accent: 'var(--section-market)',
    }, 'Friction points that slow or prevent buyers from committing'));
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
      }, 'Emerging market shift with direction and supporting evidence'));
    }
  }

  // Messaging Opportunities
  const messaging = asRecord(data.messagingOpportunities);
  const recs = asStringArray(messaging?.summaryRecommendations);
  if (recs.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Messaging Opportunities', {
      items: recs,
      accent: 'var(--accent-green)',
    }, 'Positioning angles and narrative hooks ready to test in ads'));
  }

  return cards;
}

// -- Competitors ---------------------------------------------------------------

function parseCompetitorIntel(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'competitors';

  // Intelligence: Positioning Moves
  const moves = asRecordArray(data.positioningMoves);
  if (moves.length > 0) {
    cards.push(makeCard(section, 'positioning-move-card', 'Positioning Moves to Make', {
      moves: moves.map((m) => ({
        move: asString(m.move) ?? '',
        targetCompetitor: asString(m.targetCompetitor) ?? '',
        risk: asString(m.risk) ?? 'medium',
        reward: asString(m.reward) ?? 'medium',
        playbook: asString(m.playbook) ?? '',
      })).filter((m) => m.move),
    }, 'Tactical repositioning plays to exploit competitor weaknesses'));
  }

  const competitors = asRecordArray(data.competitors);
  const seenCompetitorNames = new Set<string>();
  for (const competitor of competitors) {
    const name = asString(competitor.name) ?? 'Unknown Competitor';
    // Skip duplicate competitor entries (case-insensitive)
    const nameKey = name.toLowerCase().trim();
    if (seenCompetitorNames.has(nameKey)) continue;
    seenCompetitorNames.add(nameKey);
    const adActivity = asRecord(competitor.adActivity);
    const threat = asRecord(competitor.threatAssessment);
    const libraryLinks = asRecord(competitor.libraryLinks);

    cards.push(makeCard(section, 'competitor-card', name, {
      name,
      website: asString(competitor.website),
      positioning: asString(competitor.positioning),
      price: asString(competitor.price) ?? undefined,
      pricingConfidence: asString(competitor.pricingConfidence) ?? undefined,
      pricingSourceUrl: asString(competitor.pricingSourceUrl) ?? undefined,
      pricingTiers: Array.isArray(competitor.pricingTiers)
        ? (competitor.pricingTiers as Array<Record<string, unknown>>)
            .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
            .map((t) => ({
              name: asString(t.name) ?? '',
              price: asString(t.price) ?? '',
              description: asString(t.description) ?? undefined,
            }))
            .filter((t) => t.name && t.price)
        : [],
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
        ? (() => {
            const deduped = new Set<string>();
            return (competitor.adCreatives as Array<Record<string, unknown>>)
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
              .filter((ad) => {
                const key = ad.id || `${ad.platform}|${(ad.headline ?? '').slice(0, 80)}|${(ad.body ?? '').slice(0, 80)}|${ad.imageUrl ?? ''}`;
                if (deduped.has(key)) return false;
                deduped.add(key);
                return true;
              });
          })()
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
    }, 'Pricing, ad activity, strengths, and counter-positioning for this competitor'));

    // Review card — emit if competitor has review data OR a verified profile link
    const reviews = asRecord(competitor.reviews);
    if (reviews) {
      const trustpilot = asRecord(reviews.trustpilot);
      const g2 = asRecord(reviews.g2);
      const capterra = asRecord(reviews.capterra);

      const hasTrustpilotData = trustpilot && (asNumber(trustpilot.rating) != null || asNumber(trustpilot.reviewCount) != null);
      const hasTrustpilotLink = trustpilot && asString(trustpilot.url) != null;
      const hasG2Data = g2 && (asNumber(g2.rating) != null || asNumber(g2.reviewCount) != null);
      const hasG2Link = g2 && asString(g2.url) != null;
      const hasCapterraData = capterra && (asNumber(capterra.rating) != null || asNumber(capterra.reviewCount) != null);
      const hasCapterraLink = capterra && asString(capterra.url) != null;

      const rawNegativeReviews = Array.isArray(reviews.negativeReviews) ? reviews.negativeReviews : [];
      const negativeReviews = rawNegativeReviews
        .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
        .map(r => ({
          text: asString(r.text) ?? '',
          rating: asNumber(r.rating) ?? 1,
          date: asString(r.date) ?? undefined,
          source: (asString(r.source) ?? 'g2') as 'g2' | 'capterra' | 'trustpilot',
        }))
        .filter(r => r.text.length > 0);

      const gapIntelligence = asRecord(reviews.gapIntelligence);

      if (hasTrustpilotData || hasTrustpilotLink || hasG2Data || hasG2Link || hasCapterraData || hasCapterraLink || negativeReviews.length > 0 || gapIntelligence) {
        cards.push(makeCard(section, 'review-card', `${name} Reviews`, {
          competitorName: name,
          trustpilot: (hasTrustpilotData || hasTrustpilotLink) ? {
            rating: asNumber(trustpilot!.rating),
            reviewCount: asNumber(trustpilot!.reviewCount),
            themes: asStringArray(trustpilot!.recentThemes),
            url: asString(trustpilot!.url),
          } : null,
          g2: (hasG2Data || hasG2Link) ? {
            rating: asNumber(g2!.rating),
            reviewCount: asNumber(g2!.reviewCount),
            themes: asStringArray(g2!.categories),
            url: asString(g2!.url),
          } : null,
          capterra: (hasCapterraData || hasCapterraLink) ? {
            rating: asNumber(capterra!.rating),
            reviewCount: asNumber(capterra!.reviewCount),
            themes: asStringArray(capterra!.categories),
            url: asString(capterra!.url),
          } : null,
          negativeReviews,
          gapIntelligence: gapIntelligence ?? null,
          testimonials: asRecordArray(reviews.testimonials).map((t) => ({
            quote: asString(t.quote) ?? '',
            author: asString(t.author),
            role: asString(t.role),
            company: asString(t.company),
            sourceUrl: asString(t.sourceUrl) ?? '',
          })).filter((t) => t.quote),
          testimonialPages: asStringArray(reviews.testimonialPages),
        }, 'Ratings, review themes, and customer complaints across review platforms'));
      }
    }
  }

  // Market Patterns
  const marketPatterns = asStringArray(data.marketPatterns);
  if (marketPatterns.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Market Patterns', {
      items: marketPatterns,
      accent: 'var(--accent-cyan)',
    }, 'Recurring behaviors and trends observed across the competitive landscape'));
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
      }, 'Underserved market position no competitor currently owns'));
    }
  }

  return cards;
}

// -- ICP Validation ------------------------------------------------------------

function parseICPValidation(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'icpValidation';

  // Intelligence: Audience Refinements
  const refinements = asRecordArray(data.audienceRefinements);
  if (refinements.length > 0) {
    cards.push(makeCard(section, 'refinement-card', 'Audience Refinements to Test', {
      refinements: refinements.map((r) => ({
        refinement: asString(r.refinement) ?? '',
        segment: asString(r.segment) ?? '',
        expectedLift: asString(r.expectedLift) ?? 'moderate',
        testMethod: asString(r.testMethod) ?? '',
        risk: asString(r.risk) ?? '',
      })).filter((r) => r.refinement),
    }, 'Targeting adjustments to improve ad performance and reduce wasted spend'));
  }

  // Persona stats
  const stats = [
    { label: 'Validated Persona', value: asString(data.validatedPersona) },
    { label: 'Audience Size', value: asString(data.audienceSize) },
    { label: 'Confidence', value: asNumber(data.confidenceScore) !== null ? `${asNumber(data.confidenceScore)}/100` : null },
    { label: 'Demographics', value: asString(data.demographics) },
  ].filter((s): s is { label: string; value: string } => s.value !== null);

  if (stats.length > 0) {
    cards.push(makeCard(section, 'stat-grid', 'ICP Overview', { stats }, 'Validated ideal customer profile with audience size and confidence score'));
  }

  // Final Verdict
  const finalVerdict = asRecord(data.finalVerdict);
  if (finalVerdict && asString(finalVerdict.status)) {
    cards.push(makeCard(section, 'verdict-card', 'Final Verdict', {
      status: asString(finalVerdict.status)!,
      reasoning: asString(finalVerdict.reasoning),
    }, 'Overall assessment of ad readiness for this audience segment'));
  }

  // Decision Process
  const decisionProcess = asString(data.decisionProcess);
  if (decisionProcess) {
    cards.push(makeCard(section, 'prose-card', 'Decision Process', { text: decisionProcess }, 'How buyers evaluate, compare, and decide to purchase in this market'));
  }

  // Channels, Triggers, Objections
  const channels = asStringArray(data.channels);
  if (channels.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Best Channels', {
      items: channels,
      accent: 'var(--accent-cyan)',
    }, 'Recommended paid advertising platforms ranked by expected ROI'));
  }

  const triggers = asStringArray(data.triggers);
  if (triggers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Buying Triggers', {
      items: triggers,
      accent: 'var(--accent-blue)',
    }, 'Events or situations that make this ICP ready to purchase'));
  }

  const objections = asStringArray(data.objections);
  if (objections.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Core Objections', {
      items: objections,
      accent: 'var(--accent-red)',
    }, 'Common reasons prospects hesitate or say no'));
  }

  // Recommendations
  const recommendations = asStringArray(finalVerdict?.recommendations);
  if (recommendations.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Recommendations', {
      items: recommendations,
      accent: 'var(--accent-green)',
    }, 'Suggested next steps to improve ICP targeting and campaign fit'));
  }

  // Multi-product ICP segments (when business has distinct product lines targeting different audiences)
  const segments = asRecordArray(data.segments);
  if (segments.length > 0) {
    for (const segment of segments) {
      const productLine = asString(segment.productLine);
      if (!productLine) continue;

      cards.push(makeCard(section, 'segment-card', productLine, {
        name: productLine,
        description: asString(segment.validatedPersona),
        estimatedReach: asString(segment.audienceSize),
      }, 'Distinct audience segment with its own persona and targeting profile'));

      const segChannels = asStringArray(segment.channels);
      if (segChannels.length > 0) {
        cards.push(makeCard(section, 'bullet-list', `${productLine} — Channels`, {
          items: segChannels,
          accent: 'var(--accent-cyan)',
        }, 'Best advertising platforms for this product line segment'));
      }

      const segTriggers = asStringArray(segment.triggers);
      if (segTriggers.length > 0) {
        cards.push(makeCard(section, 'bullet-list', `${productLine} — Buying Triggers`, {
          items: segTriggers,
          accent: 'var(--accent-blue)',
        }, 'Purchase-ready signals specific to this product line'));
      }

      const segObjections = asStringArray(segment.objections);
      if (segObjections.length > 0) {
        cards.push(makeCard(section, 'bullet-list', `${productLine} — Objections`, {
          items: segObjections,
          accent: 'var(--accent-red)',
        }, 'Common hesitations and blockers for this product line audience'));
      }
    }
  }

  return cards;
}

// -- Offer Analysis ------------------------------------------------------------

function parseOfferAnalysis(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'offerAnalysis';

  // Score + Status + Dimension breakdown
  const offerStrength = asRecord(data.offerStrength);
  const recommendation = asRecord(data.recommendation);

  const dimensionLabels: [string, string][] = [
    ['painRelevance', 'Pain Relevance'],
    ['urgency', 'Urgency'],
    ['differentiation', 'Differentiation'],
    ['tangibility', 'Tangibility'],
    ['proof', 'Proof'],
    ['pricingLogic', 'Pricing Logic'],
  ];

  const scoreStats = [
    { label: 'Overall Score', value: asNumber(offerStrength?.overallScore) !== null ? `${asNumber(offerStrength?.overallScore)}/10` : null },
    { label: 'Recommendation', value: asString(recommendation?.status)?.replaceAll('_', ' ') ?? null },
    ...dimensionLabels.map(([key, label]) => ({
      label,
      value: asNumber(offerStrength?.[key]) !== null ? `${asNumber(offerStrength?.[key])}/10` : null,
    })),
  ].filter((s): s is { label: string; value: string } => s.value !== null);

  if (scoreStats.length > 0) {
    cards.push(makeCard(section, 'stat-grid', 'Offer Score', { stats: scoreStats }, 'Strength rating across six dimensions: pain, urgency, differentiation, and more'));
  }

  // Rationale
  const reasoning = asString(recommendation?.summary);
  if (reasoning) {
    cards.push(makeCard(section, 'prose-card', 'Recommendation Rationale', { text: reasoning }, 'Explanation of the overall offer assessment and go/no-go recommendation'));
  }

  // Pricing Analysis
  const pricingAnalysis = asRecord(data.pricingAnalysis);
  if (pricingAnalysis) {
    const hasContent = asString(pricingAnalysis.currentPricing) || asString(pricingAnalysis.marketBenchmark) || asString(pricingAnalysis.pricingPosition) || asString(pricingAnalysis.coldTrafficViability);
    if (hasContent) {
      cards.push(makeCard(section, 'pricing-card', 'Pricing Analysis', {
        currentPricing: asString(pricingAnalysis.currentPricing),
        pricingSource: asString(pricingAnalysis.pricingSource) || null,
        marketBenchmark: asString(pricingAnalysis.marketBenchmark),
        pricingPosition: asString(pricingAnalysis.pricingPosition),
        coldTrafficViability: asString(pricingAnalysis.coldTrafficViability),
      }, 'How your pricing compares to market benchmarks and cold traffic thresholds'));
    }

    // Pricing Intelligence (elasticity assessment)
    const elasticity = asRecord(pricingAnalysis?.elasticityAssessment);
    if (elasticity) {
      cards.push(makeCard(section, 'pricing-intelligence', 'Pricing Intelligence', {
        elasticityAssessment: {
          verdict: asString(elasticity.verdict) ?? 'insufficient-data',
          signals: Array.isArray(elasticity.signals) ? elasticity.signals : [],
          reasoning: asString(elasticity.reasoning) ?? '',
        },
      }, 'Price sensitivity assessment based on market signals and competitor data'));
    }
  }

  // Strengths, Weaknesses, Actions, Messaging
  const strengths = asStringArray(recommendation?.topStrengths);
  if (strengths.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Strengths', {
      items: strengths,
      accent: 'var(--accent-green)',
    }, 'Offer elements that differentiate you and build purchase confidence'));
  }

  const weaknesses = asStringArray(recommendation?.priorityFixes);
  if (weaknesses.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Weaknesses', {
      items: weaknesses,
      accent: 'var(--accent-red)',
    }, 'Critical gaps in your offer that need to be addressed before scaling spend'));
  }

  const actionItems = asStringArray(recommendation?.recommendedActionPlan);
  if (actionItems.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Recommended Actions', {
      items: actionItems,
      accent: 'var(--accent-blue)',
    }, 'Prioritized steps to strengthen offer-market fit and improve conversion'));
  }

  const messagingRecs = asStringArray(data.messagingRecommendations);
  if (messagingRecs.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Messaging Recommendations', {
      items: messagingRecs,
      accent: 'var(--accent-cyan)',
    }, 'Language and framing suggestions to communicate your offer more effectively'));
  }

  // Market Fit
  const marketFit = asString(data.marketFitAssessment);
  if (marketFit) {
    cards.push(makeCard(section, 'prose-card', 'Market Fit Assessment', { text: marketFit }, 'Evaluation of how well your offer matches current market demand and timing'));
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
      }, 'High-priority issue that could undermine campaign performance'));
    }
  }

  // Generated Offer Statements (intelligence feature)
  const offerStatements = asRecordArray(data.generatedOfferStatements);
  if (offerStatements.length > 0) {
    cards.push(makeCard(section, 'offer-statement-list', 'Generated Offer Statements', {
      statements: offerStatements.map((s) => ({
        type: asString(s.type) || 'headline',
        statement: asString(s.statement),
        rationale: asString(s.rationale),
        targetEmotion: asString(s.targetEmotion),
      })).filter((s) => s.statement),
    }, 'AI-generated headlines and hooks ready to test in ad copy'));
  }

  // ICE-scored fixes (intelligence feature)
  const rec = data.recommendation as Record<string, unknown> | undefined;
  const iceFixes = rec ? asRecordArray(rec.iceScoredFixes) : [];
  if (iceFixes.length > 0) {
    cards.push(makeCard(section, 'ice-table', 'Prioritized Improvements (ICE)', {
      fixes: iceFixes.map((f) => ({
        issue: asString(f.issue),
        fix: asString(f.fix),
        impact: asNumber(f.impact),
        confidence: asNumber(f.confidence),
        ease: asNumber(f.ease),
        iceScore: asNumber(f.iceScore),
      })).filter((f) => f.issue || f.fix),
    }, 'Offer fixes ranked by Impact, Confidence, and Ease of implementation'));
  }

  return cards;
}

// -- Keyword Intel -------------------------------------------------------------

function parseKeywordIntel(data: Record<string, unknown>): CardState[] {
  if (Object.keys(data).length === 0) return [];
  const cards: CardState[] = [];

  // Intelligence: Keyword Gaps (derived from existing competitorGaps + topOpportunities)
  const competitorGaps = asRecordArray(data.competitorGaps);
  const topOpportunities = asRecordArray(data.topOpportunities);

  if (competitorGaps.length > 0 || topOpportunities.length > 0) {
    const gaps: Array<{gapCluster: string; estimatedVolume: number; competition: string; suggestedKeywords: string[]; priority: string}> = [];

    // Group competitor gaps by competitor name
    const byCompetitor = new Map<string, typeof competitorGaps>();
    for (const g of competitorGaps) {
      const name = asString(g.competitorName) ?? 'Unknown';
      if (!byCompetitor.has(name)) byCompetitor.set(name, []);
      byCompetitor.get(name)!.push(g);
    }
    for (const [competitor, items] of byCompetitor) {
      gaps.push({
        gapCluster: `${competitor} competitor terms`,
        estimatedVolume: items.reduce((sum, g) => sum + (typeof g.searchVolume === 'number' ? g.searchVolume : 0), 0),
        competition: 'medium',
        suggestedKeywords: items.slice(0, 5).map((g) => asString(g.keyword) ?? '').filter(Boolean),
        priority: 'high',
      });
    }

    // Top opportunities as a cluster
    if (topOpportunities.length > 0) {
      const highPriority = topOpportunities.filter((o) => (typeof o.priorityScore === 'number' ? o.priorityScore : 0) >= 60);
      if (highPriority.length > 0) {
        gaps.push({
          gapCluster: 'High-intent opportunities',
          estimatedVolume: highPriority.reduce((sum, o) => sum + (typeof o.searchVolume === 'number' ? o.searchVolume : 0), 0),
          competition: asString(highPriority[0]?.difficulty) ?? 'medium',
          suggestedKeywords: highPriority.slice(0, 5).map((o) => asString(o.keyword) ?? '').filter(Boolean),
          priority: 'high',
        });
      }
    }

    if (gaps.length > 0) {
      cards.push(makeCard('keywordIntel', 'keyword-gap-card', 'Keyword Gaps to Fill', { gaps: gaps.slice(0, 3) }, 'Search term clusters your competitors rank for but you currently miss'));
    }
  }

  // Existing passthrough
  cards.push(makeCard('keywordIntel', 'keyword-grid', 'Keyword Intelligence', { rawData: data }, 'Search volume, competition level, and priority score for each keyword'));
  return cards;
}

// -- Cross Analysis (Strategic Synthesis) --------------------------------------

function parseCrossAnalysis(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'crossAnalysis';

  // Intelligence: Readiness Scorecard
  const scorecard = asRecord(data.readinessScorecard);
  if (scorecard) {
    const dims = asRecordArray(scorecard.dimensions);
    if (dims.length > 0) {
      cards.push(makeCard(section, 'readiness-scorecard', 'Media Launch Readiness', {
        overallScore: asNumber(scorecard.overallScore) ?? 0,
        verdict: asString(scorecard.verdict) ?? 'needs-work',
        verdictLabel: asString(scorecard.verdictLabel) ?? 'Needs assessment',
        dimensions: dims.map((d) => ({
          name: asString(d.name) ?? '',
          score: asNumber(d.score) ?? 0,
          summary: asString(d.summary) ?? '',
        })).filter((d) => d.name),
      }, 'Overall paid media readiness score across market, offer, audience, and creative dimensions'));
    }
  }

  // Intelligence: Top Actions
  const topActions = asRecord(data.topActions);
  if (topActions) {
    const actions = asRecordArray(topActions.actions);
    if (actions.length > 0) {
      cards.push(makeCard(section, 'priority-actions', 'Top Actions', {
        actions: actions.map((a) => ({
          action: asString(a.action) ?? '',
          source: asString(a.source) ?? '',
          priority: asString(a.priority) ?? 'medium',
        })).filter((a) => a.action),
      }, 'Highest-leverage actions to take before launching your first campaign'));
    }
  }

  // Positioning Strategy
  const positioningStrategy = asRecord(data.positioningStrategy);
  if (positioningStrategy) {
    const hasContent = asString(positioningStrategy.recommendedAngle) || asString(positioningStrategy.leadRecommendation) || asString(positioningStrategy.keyDifferentiator);
    if (hasContent) {
      cards.push(makeCard(section, 'strategy-card', 'Positioning Strategy', {
        recommendedAngle: asString(positioningStrategy.recommendedAngle),
        leadRecommendation: asString(positioningStrategy.leadRecommendation),
        keyDifferentiator: asString(positioningStrategy.keyDifferentiator),
      }, 'Recommended market positioning angle and key differentiator for ad messaging'));
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
      cards.push(makeCard(section, 'stat-grid', 'Planning Context', { stats: contextStats }, 'Budget targets and cost benchmarks that guide the media plan'));
    }

    const downstream = asStringArray(planningContext.downstreamSequence);
    if (downstream.length > 0) {
      cards.push(makeCard(section, 'bullet-list', 'Downstream Sequence', {
        items: downstream,
        accent: 'var(--accent-blue)',
      }, 'Post-click conversion steps from lead capture to closed deal'));
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
      }, 'Visual data chart supporting the strategic analysis'));
    }
  }

  // Strategic Narrative
  const narrative = asString(data.strategicNarrative);
  if (narrative) {
    cards.push(makeCard(section, 'prose-card', 'Strategic Narrative', { text: narrative }, 'Cohesive story connecting market, audience, and offer into a media strategy'));
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
      }, 'Cross-section finding with source attribution and strategic implication'));
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
      }, 'Recommended advertising channel with role, budget share, and expected CPL'));
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
      }, 'Ad messaging angle with a sample hook and supporting evidence'));
    }
  }

  // Critical Success Factors
  const successFactors = asStringArray(data.criticalSuccessFactors);
  if (successFactors.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Critical Success Factors', {
      items: successFactors,
      accent: 'var(--accent-green)',
    }, 'Must-have conditions for campaign success based on cross-section analysis'));
  }

  // Next Steps
  const nextSteps = asStringArray(data.nextSteps);
  if (nextSteps.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Next Steps', {
      items: nextSteps,
      accent: 'var(--accent-blue)',
    }, 'Prioritized action items to execute before and after campaign launch'));
  }

  return cards;
}

// -- Media Plan ----------------------------------------------------------------

function parseMediaPlan(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'mediaPlan';

  // Block 6: Strategy Snapshot (hero card at top)
  const snapshot = asRecord(data.strategySnapshot);
  if (snapshot) {
    const budgetOverview = asRecord(snapshot.budgetOverview);
    const expectedOutcomes = asRecord(snapshot.expectedOutcomes);
    cards.push(makeCard(section, 'strategy-snapshot', asString(snapshot.headline) ?? 'Strategy Snapshot', {
      headline: asString(snapshot.headline),
      topPriorities: asRecordArray(snapshot.topPriorities),
      budgetOverview: budgetOverview ? {
        total: asNumber(budgetOverview.total),
        topPlatform: asString(budgetOverview.topPlatform),
        timeToFirstResults: asString(budgetOverview.timeToFirstResults),
      } : undefined,
      expectedOutcomes: expectedOutcomes ? {
        leadsPerMonth: asNumber(expectedOutcomes.leadsPerMonth),
        estimatedCAC: asNumber(expectedOutcomes.estimatedCAC),
        expectedROAS: asNumber(expectedOutcomes.expectedROAS),
      } : undefined,
    }, 'High-level strategy overview with budget, priorities, and expected outcomes'));
  }

  // Block 1: Channel Mix — one card per platform + budget summary
  const channelMix = asRecord(data.channelMixBudget);
  if (channelMix) {
    const platforms = asRecordArray(channelMix.platforms);
    for (const platform of platforms) {
      const name = asString(platform.name);
      if (name) {
        const expectedCPL = asRecord(platform.expectedCPL);
        cards.push(makeCard(section, 'platform-card', name, {
          name,
          role: asString(platform.role),
          monthlySpend: asNumber(platform.monthlySpend),
          percentage: asNumber(platform.percentage),
          expectedCPL: expectedCPL ? { low: asNumber(expectedCPL.low), high: asNumber(expectedCPL.high) } : undefined,
          rationale: asString(platform.rationale),
        }, 'Advertising platform with spend allocation, role, and expected cost per lead'));
      }
    }

    const budgetSummary = asRecord(channelMix.budgetSummary);
    if (budgetSummary) {
      const funnelSplit = asRecord(budgetSummary.funnelSplit);
      cards.push(makeCard(section, 'budget-summary', 'Budget Summary', {
        totalMonthly: asNumber(budgetSummary.totalMonthly),
        funnelSplit: funnelSplit ? {
          awareness: asNumber(funnelSplit.awareness),
          consideration: asNumber(funnelSplit.consideration),
          conversion: asNumber(funnelSplit.conversion),
        } : undefined,
        rampUpWeeks: asNumber(budgetSummary.rampUpWeeks),
      }, 'Total monthly spend with funnel allocation and ramp-up timeline'));
    }
  }

  // Block 2: Audience & Campaign
  const audience = asRecord(data.audienceCampaign);
  if (audience) {
    const segments = asRecordArray(audience.segments);
    for (const segment of segments) {
      const name = asString(segment.name);
      if (name) {
        cards.push(makeCard(section, 'segment-card', name, {
          name,
          description: asString(segment.description),
          estimatedReach: asString(segment.estimatedReach),
          funnelPosition: asString(segment.funnelPosition),
          priority: asNumber(segment.priority),
        }, 'Target audience segment with reach estimate and funnel position'));
      }
    }

    const campaigns = asRecordArray(audience.campaigns);
    for (const campaign of campaigns) {
      const name = asString(campaign.name);
      if (name) {
        cards.push(makeCard(section, 'campaign-card', name, {
          platform: asString(campaign.platform),
          name,
          objective: asString(campaign.objective),
          adSets: asRecordArray(campaign.adSets),
          namingConvention: asString(campaign.namingConvention),
        }, 'Campaign structure with platform, objective, and ad set configuration'));
      }
    }
  }

  // Block 3: Creative System
  const creative = asRecord(data.creativeSystem);
  if (creative) {
    const angles = asRecordArray(creative.angles);
    for (const angle of angles) {
      const theme = asString(angle.theme);
      if (theme) {
        cards.push(makeCard(section, 'creative-angle', theme, {
          theme,
          hook: asString(angle.hook),
          messagingApproach: asString(angle.messagingApproach),
          targetSegment: asString(angle.targetSegment),
        }, 'Creative messaging angle with hook and target audience segment'));
      }
    }

    const formatSpecs = asRecordArray(creative.formatSpecs);
    if (formatSpecs.length > 0) {
      cards.push(makeCard(section, 'format-spec', 'Ad Format Specifications', { specs: formatSpecs }, 'Required ad dimensions, formats, and platform-specific creative specs'));
    }

    const testingPlan = asRecord(creative.testingPlan);
    if (testingPlan) {
      cards.push(makeCard(section, 'testing-plan', 'Creative Testing Plan', {
        firstTests: asStringArray(testingPlan.firstTests),
        methodology: asString(testingPlan.methodology),
        minBudgetPerTest: asNumber(testingPlan.minBudgetPerTest),
      }, 'A/B testing methodology with initial tests and minimum budget per variant'));
    }
  }

  // Block 4: Measurement & Guardrails
  const measurement = asRecord(data.measurementGuardrails);
  if (measurement) {
    const kpis = asRecordArray(measurement.kpis);
    if (kpis.length > 0) {
      cards.push(makeCard(section, 'kpi-grid', 'KPI Targets', { kpis }, 'Key performance indicators with targets and industry benchmarks'));
    }

    const cacModel = asRecord(measurement.cacModel);
    if (cacModel) {
      cards.push(makeCard(section, 'cac-model', 'CAC Model', {
        targetCAC: asNumber(cacModel.targetCAC),
        expectedCPL: asNumber(cacModel.expectedCPL),
        leadToSqlRate: asNumber(cacModel.leadToSqlRate),
        sqlToCustomerRate: asNumber(cacModel.sqlToCustomerRate),
        expectedLeadsPerMonth: asNumber(cacModel.expectedLeadsPerMonth),
        expectedSQLsPerMonth: asNumber(cacModel.expectedSQLsPerMonth),
        expectedCustomersPerMonth: asNumber(cacModel.expectedCustomersPerMonth),
        ltv: asNumber(cacModel.ltv),
        ltvCacRatio: asNumber(cacModel.ltvCacRatio),
      }, 'Customer acquisition cost model with conversion rates and LTV ratio'));
    }

    const risks = asRecordArray(measurement.risks);
    for (const risk of risks) {
      const riskName = asString(risk.risk);
      if (riskName) {
        cards.push(makeCard(section, 'risk-card', riskName, {
          risk: riskName,
          category: asString(risk.category),
          severity: asString(risk.severity),
          likelihood: asString(risk.likelihood),
          mitigation: asString(risk.mitigation),
          earlyWarning: asString(risk.earlyWarning),
        }, 'Campaign risk with severity, likelihood, and mitigation strategy'));
      }
    }
  }

  // Block 5: Rollout Roadmap
  const roadmap = asRecord(data.rolloutRoadmap);
  if (roadmap) {
    const phases = asRecordArray(roadmap.phases);
    for (const phase of phases) {
      const name = asString(phase.name);
      if (name) {
        cards.push(makeCard(section, 'phase-card', name, {
          name,
          duration: asString(phase.duration),
          objectives: asStringArray(phase.objectives),
          activities: asStringArray(phase.activities),
          successCriteria: asStringArray(phase.successCriteria),
          budgetAllocation: asNumber(phase.budgetAllocation),
          goNoGo: asString(phase.goNoGo),
        }, 'Rollout phase with timeline, objectives, and go/no-go criteria'));
      }
    }
  }

  // Client-side charts from block data
  if (channelMix) {
    const platforms = asRecordArray(channelMix.platforms);
    const platformChartData = platforms
      .map(p => ({ name: asString(p.name) ?? '', percentage: asNumber(p.percentage) ?? 0 }))
      .filter(p => p.name && p.percentage > 0);
    if (platformChartData.length > 0) {
      cards.push(makeCard(section, 'pie-chart', 'Platform Budget Allocation', { platforms: platformChartData }, 'Visual breakdown of monthly spend across advertising platforms'));
    }

    const budgetSummary = asRecord(channelMix.budgetSummary);
    const funnelSplit = budgetSummary ? asRecord(budgetSummary.funnelSplit) : null;
    if (funnelSplit) {
      cards.push(makeCard(section, 'funnel-split-chart', 'Budget by Funnel Stage', {
        funnelSplit: {
          awareness: asNumber(funnelSplit.awareness) ?? 0,
          consideration: asNumber(funnelSplit.consideration) ?? 0,
          conversion: asNumber(funnelSplit.conversion) ?? 0,
        },
      }, 'Budget split across awareness, consideration, and conversion stages'));
    }
  }

  if (measurement) {
    const cacModel = asRecord(measurement.cacModel);
    if (cacModel) {
      const leads = asNumber(cacModel.expectedLeadsPerMonth);
      const sqls = asNumber(cacModel.expectedSQLsPerMonth);
      const customers = asNumber(cacModel.expectedCustomersPerMonth);
      if (leads != null && sqls != null && customers != null) {
        cards.push(makeCard(section, 'cac-funnel-chart', 'CAC Conversion Funnel', {
          cacModel: { expectedLeadsPerMonth: leads, expectedSQLsPerMonth: sqls, expectedCustomersPerMonth: customers },
        }, 'Lead-to-customer conversion funnel with expected volume at each stage'));
      }
    }

    const kpis = asRecordArray(measurement.kpis);
    const kpiChartData = kpis
      .map(k => ({
        metric: asString(k.metric) ?? '',
        target: asNumber(k.target) ?? 0,
        industryBenchmark: asNumber(k.industryBenchmark) ?? 0,
      }))
      .filter(k => k.metric);
    if (kpiChartData.length > 0) {
      cards.push(makeCard(section, 'kpi-benchmark-chart', 'KPI Targets vs Benchmarks', { kpis: kpiChartData }, 'Your target KPIs compared against industry benchmark values'));
    }
  }

  if (roadmap) {
    const phases = asRecordArray(roadmap.phases);
    const phaseChartData = phases
      .map(p => ({ name: asString(p.name) ?? '', budgetAllocation: asNumber(p.budgetAllocation) ?? 0 }))
      .filter(p => p.name && p.budgetAllocation > 0);
    if (phaseChartData.length > 0) {
      cards.push(makeCard(section, 'phase-budget-chart', 'Phase Budget Timeline', { phases: phaseChartData }, 'Budget allocation across rollout phases over time'));
    }
  }

  // Validation warnings
  const warnings = asStringArray(data.validationWarnings);
  if (warnings.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Validation Notes', {
      items: warnings,
      accent: 'var(--accent-amber)',
    }, 'Automated checks that flagged potential issues in the media plan'));
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
    case 'mediaPlan':
      return parseMediaPlan(data);
    default:
      return [];
  }
}
