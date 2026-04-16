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
  // Prefer the Phase 6.2+ intelligence path when present. Cards are written to
  // research_results.${section}Intelligence.${cardName} and each item is wrapped
  // as { value: {...}, evidenceIds, confidence }. Unwrap to .value so the
  // taxonomy renderer still gets the flat shape it expects.
  const intelligenceBlock = asRecord(data.industryMarketIntelligence);
  const intelligenceOpportunity = intelligenceBlock ? asRecord(intelligenceBlock.opportunity) : null;
  const intelligenceItems = intelligenceOpportunity
    ? asRecordArray(intelligenceOpportunity.opportunities)
    : [];

  const opportunities: Record<string, unknown>[] =
    intelligenceItems.length > 0
      ? (intelligenceItems
          .map((item) => {
            const value = asRecord(item.value);
            if (!value) return null;
            const out: Record<string, unknown> = { ...value };
            if (Array.isArray(item.evidenceIds)) out._evidenceIds = item.evidenceIds;
            if (typeof item.confidence === 'number') out._confidence = item.confidence;
            return out;
          })
          .filter(Boolean) as Record<string, unknown>[])
      : asRecordArray(data.marketOpportunities);

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
      cards.push(
        makeCard(
          section,
          'stat-grid',
          'Category Snapshot',
          { stats, layout: 'definition' },
          'At-a-glance market characteristics and buying dynamics',
        ),
      );
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

  // Market Dynamics (consolidated: demand drivers + buying triggers + barriers)
  const dynamics = asRecord(data.marketDynamics);
  const drivers = asStringArray(dynamics?.demandDrivers);
  const triggers = asStringArray(dynamics?.buyingTriggers);
  const barriers = asStringArray(dynamics?.barriersToPurchase);
  const dynamicsItems: Array<{ group: string; items: string[] }> = [];
  if (drivers.length > 0) dynamicsItems.push({ group: 'Demand Drivers', items: drivers });
  if (triggers.length > 0) dynamicsItems.push({ group: 'Buying Triggers', items: triggers });
  if (barriers.length > 0) dynamicsItems.push({ group: 'Barriers to Purchase', items: barriers });
  if (dynamicsItems.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Market Dynamics', {
      groups: dynamicsItems,
      accent: 'var(--section-market)',
    }, 'Demand drivers, buying triggers, and barriers to purchase in one view'));
  }

  // Trend Signals (consolidated into one card)
  const trends = Array.isArray(data.trendSignals) ? data.trendSignals : [];
  const trendItems = trends
    .map((trend) => {
      const t = asRecord(trend);
      if (!t || !asString(t.trend)) return null;
      return {
        trend: asString(t.trend)!,
        direction: asString(t.direction) ?? 'stable',
        evidence: asString(t.evidence) ?? '',
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
  if (trendItems.length > 0) {
    cards.push(makeCard(section, 'trend-card', 'Trend Signals', {
      trends: trendItems,
    }, 'Emerging market shifts with direction and supporting evidence'));
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

  // Competitor Sources — show user-provided vs AI-discovered at the top
  const competitorSources = asRecordArray(data.competitorSources);
  if (competitorSources.length > 0) {
    const userProvided = competitorSources
      .filter((s) => asString(s.source) === 'user-provided')
      .map((s) => asString(s.name) ?? '')
      .filter(Boolean);
    const aiDiscovered = competitorSources
      .filter((s) => asString(s.source) === 'ai-discovered')
      .map((s) => asString(s.name) ?? '')
      .filter(Boolean);
    cards.push(makeCard(section, 'competitor-sources-card', 'Competitor Sources', {
      userProvided,
      aiDiscovered,
    }, 'Which competitors you selected vs which were discovered by AI research'));
  }

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

      // Phase 6.3.1 — require first-party review evidence OR a resolved platform
      // link before rendering the review card. An inferred gapIntelligence block
      // alone is not enough: the reviews analyzer needs real review text to be trusted.
      const hasReviewsCorpus =
        hasTrustpilotData ||
        hasTrustpilotLink ||
        hasG2Data ||
        hasG2Link ||
        hasCapterraData ||
        hasCapterraLink ||
        negativeReviews.length > 0;

      if (hasReviewsCorpus) {
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
          // Phase 6.3.1 — only surface gapIntelligence when we have real review content
          // (not just resolved links). Link-only corpus lacks the text the analyzer
          // needs; the intelligence is likely stale/hallucinated in that case.
          gapIntelligence:
            (hasTrustpilotData || hasG2Data || hasCapterraData || negativeReviews.length > 0)
              ? (gapIntelligence ?? null)
              : null,
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

  // White-Space Gaps (consolidated into one card)
  // Phase 6.2.2 — skip legacy render when the intelligence pipeline has
  // written the new gap card to offerAnalysisIntelligence (parseOfferAnalysis
  // renders that one). This prevents duplicate cards across two sections.
  const intelligenceGapsPresent =
    asRecord(data.offerAnalysisIntelligence) !== null &&
    asRecord((data.offerAnalysisIntelligence as Record<string, unknown>).whiteSpaceGap) !== null &&
    Array.isArray(
      (asRecord((data.offerAnalysisIntelligence as Record<string, unknown>).whiteSpaceGap) as Record<string, unknown>).gaps,
    ) &&
    ((asRecord((data.offerAnalysisIntelligence as Record<string, unknown>).whiteSpaceGap) as Record<string, unknown>).gaps as unknown[]).length > 0;

  if (!intelligenceGapsPresent) {
    const gaps = asRecordArray(data.whiteSpaceGaps);
    const gapItems = gaps
      .map((gap) => {
        const gapName = asString(gap.gap);
        if (!gapName) return null;
        return {
          gap: gapName,
          type: asString(gap.type),
          evidence: asString(gap.evidence),
          exploitability: asNumber(gap.exploitability),
          impact: asNumber(gap.impact),
          recommendedAction: asString(gap.recommendedAction),
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
    if (gapItems.length > 0) {
      cards.push(makeCard(section, 'gap-card', 'White-Space Gaps', {
        gaps: gapItems,
      }, 'Underserved market positions no competitor currently owns'));
    }
  }

  // Cross-Competitor Review Analysis
  const crossAnalysis = asRecord(data.reviewCrossAnalysis);
  console.log(`[cross-analysis] card-taxonomy: reviewCrossAnalysis present=${Boolean(crossAnalysis)}`);
  if (crossAnalysis) {
    const rawWeaknesses = asRecordArray(crossAnalysis.commonWeaknesses);
    console.log(`[cross-analysis] card-taxonomy: raw commonWeaknesses count=${rawWeaknesses.length}`);
    const commonWeaknesses = rawWeaknesses
      .map((w) => {
        const affectedCompetitors = asStringArray(w.affectedCompetitors);
        const frequency = asNumber(w.frequency) ?? affectedCompetitors.length;
        return {
          theme: asString(w.theme) ?? '',
          affectedCompetitors,
          frequency,
          exampleQuote: asString(w.exampleQuote) ?? '',
          leverageAngle: asString(w.leverageAngle) ?? '',
        };
      })
      // Accept if affectedCompetitors array has 2+ names, OR if frequency field says 2+ (model may
      // sometimes populate frequency but not fully populate affectedCompetitors array)
      .filter((w) => w.theme && (w.affectedCompetitors.length >= 2 || w.frequency >= 2));

    console.log(`[cross-analysis] card-taxonomy: after filter commonWeaknesses count=${commonWeaknesses.length}`);
    for (const w of commonWeaknesses) {
      console.log(`[cross-analysis] card-taxonomy: theme="${w.theme}" affectedCompetitors=${JSON.stringify(w.affectedCompetitors)} frequency=${w.frequency}`);
    }

    if (commonWeaknesses.length > 0) {
      cards.push(makeCard(section, 'review-cross-analysis-card', 'Common Competitor Weaknesses', {
        commonWeaknesses,
      }, 'Complaint themes shared across multiple competitors — your positioning opportunities'));
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

  const validatedPersona = asString(data.validatedPersona);
  if (validatedPersona) {
    cards.push(
      makeCard(section, 'prose-card', 'Validated Persona', { text: validatedPersona }, 'Primary ICP description from research'),
    );
  }

  const demographics = asString(data.demographics);
  if (demographics) {
    cards.push(
      makeCard(section, 'prose-card', 'Demographics', { text: demographics }, 'Firmographic and geographic profile'),
    );
  }

  const audienceSize = asString(data.audienceSize);
  const confidenceNum = asNumber(data.confidenceScore);
  if (audienceSize || confidenceNum !== null) {
    cards.push(
      makeCard(
        section,
        'icp-metrics',
        'ICP signals',
        {
          audienceSize: audienceSize ?? undefined,
          confidenceScore: confidenceNum ?? undefined,
        },
        'Audience size estimate and model confidence',
      ),
    );
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

  return cards;
}

// -- Offer Analysis ------------------------------------------------------------

function parseOfferAnalysis(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'offerAnalysis';

  // Phase 6.2.2 — white-space-gap card surfaces in the offer section when the
  // intelligence path has produced it. Falls through to the legacy whiteSpaceGaps
  // render (still handled by parseCompetitorIntel) when absent.
  const whiteSpaceGapBlock = asRecord(data.offerAnalysisIntelligence)
    ? (data.offerAnalysisIntelligence as Record<string, unknown>).whiteSpaceGap
    : null;
  const whiteSpaceGapNode = asRecord(whiteSpaceGapBlock);
  const whiteSpaceGapItems = whiteSpaceGapNode
    ? asRecordArray(whiteSpaceGapNode.gaps)
    : [];

  if (whiteSpaceGapItems.length > 0) {
    const unwrappedGaps = whiteSpaceGapItems
      .map((item) => {
        const value = asRecord(item.value);
        if (!value) return null;
        return {
          gap: asString(value.move) ?? asString(value.gap),
          type: asString(value.type) ?? asString(value.archetype),
          targetCompetitor: asString(value.targetCompetitor),
          competitorWeakness: asString(value.competitorWeakness),
          valueEquationAxis: asString(value.valueEquationAxis),
          risk: asString(value.risk),
          reward: asString(value.reward),
          playbook: asString(value.playbook) ?? asString(value.recommendedAction),
          evidence: asString(value.evidence),
          exploitability: asNumber(value.exploitability),
          impact: asNumber(value.impact),
          recommendedAction: asString(value.recommendedAction) ?? asString(value.playbook),
          _evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : undefined,
          _confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);

    if (unwrappedGaps.length > 0) {
      cards.push(
        makeCard(
          section,
          'gap-card',
          'White-Space Gaps',
          { gaps: unwrappedGaps },
          'Competitive positioning moves no competitor currently owns',
        ),
      );
    }
  }

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

  // Red Flags (consolidated into one card)
  const redFlags = asRecordArray(data.redFlags);
  const flagItems = redFlags
    .map((flag) => {
      const issue = asString(flag.issue);
      if (!issue) return null;
      return {
        issue,
        severity: asString(flag.severity),
        priority: asNumber(flag.priority),
        evidence: asString(flag.evidence),
        recommendedAction: asString(flag.recommendedAction),
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
  if (flagItems.length > 0) {
    cards.push(makeCard(section, 'flag-card', 'Red Flags', {
      flags: flagItems,
    }, 'High-priority issues that could undermine campaign performance'));
  }

  // Phase 6.2.3 — offer-statements card produces a richer, grounded version.
  // Prefer it when present; fall back to the legacy generatedOfferStatements.
  const offerStatementBlock = asRecord(data.offerAnalysisIntelligence)
    ? (data.offerAnalysisIntelligence as Record<string, unknown>)['offer-statement']
    : null;
  const offerStatementNode = asRecord(offerStatementBlock);
  const intelligenceStatements = offerStatementNode
    ? asRecordArray(offerStatementNode.statements)
    : [];

  const unwrappedStatements =
    intelligenceStatements.length > 0
      ? intelligenceStatements
          .map((item) => {
            const value = asRecord(item.value);
            if (!value) return null;
            return {
              type: asString(value.type),
              statement: asString(value.statement),
              valueEquationAxis: asString(value.valueEquationAxis),
              awarenessLevel: asString(value.awarenessLevel),
              rationale: asString(value.rationale),
              evidence: asString(value.evidence),
              targetEmotion: asString(value.targetEmotion),
              _evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : undefined,
              _confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null)
      : [];

  // Generated Offer Statements (intelligence feature)
  const offerStatements =
    unwrappedStatements.length > 0
      ? unwrappedStatements
      : asRecordArray(data.generatedOfferStatements).map((s) => ({
          type: asString(s.type) || 'headline',
          statement: asString(s.statement),
          rationale: asString(s.rationale),
          targetEmotion: asString(s.targetEmotion),
        })).filter((s) => s.statement);

  if (offerStatements.length > 0) {
    cards.push(makeCard(section, 'offer-statement-list', 'Generated Offer Statements', {
      statements: offerStatements,
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

  // Keyword Intelligence — full raw payload for detail view plus top keywords for structured fallback
  const campaignGroups = asRecordArray(data.campaignGroups);
  const kwOpportunities = asRecordArray(data.topOpportunities);

  // Collect keywords from campaign groups and top opportunities
  const allKeywords: Array<{ keyword: string; volume: number; difficulty: string; cpc: string; priority: number }> = [];

  for (const group of campaignGroups) {
    const kws = asRecordArray(group.keywords);
    for (const kw of kws) {
      const keyword = asString(kw.keyword);
      if (keyword) {
        allKeywords.push({
          keyword,
          volume: asNumber(kw.searchVolume) ?? 0,
          difficulty: asString(kw.difficulty) ?? 'unknown',
          cpc: asString(kw.cpc) ?? '',
          priority: asNumber(kw.priorityScore) ?? 0,
        });
      }
    }
  }

  for (const opp of kwOpportunities) {
    const keyword = asString(opp.keyword);
    if (keyword && !allKeywords.some((k) => k.keyword.toLowerCase() === keyword.toLowerCase())) {
      allKeywords.push({
        keyword,
        volume: asNumber(opp.searchVolume) ?? 0,
        difficulty: asString(opp.difficulty) ?? 'unknown',
        cpc: asString(opp.cpc) ?? '',
        priority: asNumber(opp.priorityScore) ?? 0,
      });
    }
  }

  // Sort by priority descending, take top 15
  allKeywords.sort((a, b) => b.priority - a.priority);
  const topKeywords = allKeywords.slice(0, 15);

  if (topKeywords.length > 0) {
    cards.push(makeCard('keywordIntel', 'keyword-grid', 'Keyword Intelligence', {
      rawData: data,
      keywords: topKeywords,
    }, 'Full keyword intelligence with campaign groups, ad groups, and priority rankings'));
  }

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

  // Key Insights (consolidated into one card)
  const keyInsights = asRecordArray(data.keyInsights);
  const insightItems = keyInsights
    .map((insight) => {
      const headline = asString(insight.insight);
      if (!headline) return null;
      return {
        insight: headline,
        source: asString(insight.source),
        implication: asString(insight.implication),
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);
  if (insightItems.length > 0) {
    cards.push(makeCard(section, 'insight-card', 'Key Insights', {
      insights: insightItems,
    }, 'Cross-section findings with source attribution and strategic implications'));
  }

  // Messaging Angles (consolidated into one card)
  const angles = asRecordArray(data.messagingAngles);
  const angleItems = angles
    .map((angle) => {
      const title = asString(angle.angle);
      if (!title) return null;
      return {
        angle: title,
        exampleHook: asString(angle.exampleHook),
        evidence: asString(angle.evidence),
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
  if (angleItems.length > 0) {
    cards.push(makeCard(section, 'angle-card', 'Messaging Angles', {
      angles: angleItems,
    }, 'Ad messaging angles with sample hooks and supporting evidence'));
  }

  // Critical Success Factors
  const successFactors = asStringArray(data.criticalSuccessFactors);
  if (successFactors.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Critical Success Factors', {
      items: successFactors,
      accent: 'var(--accent-green)',
    }, 'Must-have conditions for campaign success based on cross-section analysis'));
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
      // Schema field names (cacModelSchema in src/lib/media-plan/schemas.ts):
      //   targetCAC, targetCPL, leadToSqlRate, sqlToCustomerRate,
      //   expectedMonthlyLeads, expectedMonthlySQLs, expectedMonthlyCustomers,
      //   estimatedLTV, ltvToCacRatio (STRING, e.g. "5.2:1 — Healthy"),
      //   insufficientData (string[])
      // Card prop names (CacModelCardProps in cac-model-card.tsx) are remapped
      // here to: expectedCPL, expectedLeadsPerMonth, expectedSQLsPerMonth,
      // expectedCustomersPerMonth, ltv, ltvCacRatio. Keep this mapping in sync
      // with both files when the schema or card props change.
      cards.push(makeCard(section, 'cac-model', 'CAC Model', {
        targetCAC: asNumber(cacModel.targetCAC),
        expectedCPL: asNumber(cacModel.targetCPL),
        leadToSqlRate: asNumber(cacModel.leadToSqlRate),
        sqlToCustomerRate: asNumber(cacModel.sqlToCustomerRate),
        expectedLeadsPerMonth: asNumber(cacModel.expectedMonthlyLeads),
        expectedSQLsPerMonth: asNumber(cacModel.expectedMonthlySQLs),
        expectedCustomersPerMonth: asNumber(cacModel.expectedMonthlyCustomers),
        ltv: asNumber(cacModel.estimatedLTV),
        ltvCacRatio: asString(cacModel.ltvToCacRatio),
        insufficientData: asStringArray(cacModel.insufficientData),
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
