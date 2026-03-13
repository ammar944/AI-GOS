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

export function parseResearchToCards(
  section: SectionKey,
  data: Record<string, unknown>,
): CardState[] {
  switch (section) {
    case 'industryMarket':
      return parseIndustryMarket(data);
    // Remaining sections added in Sprint 3
    default:
      return [];
  }
}
