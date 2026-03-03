import type { BudgetAllocation } from './budget-bar-card';

// Merged props type — all fields from every card type, allowing direct access in consumers
// without narrowing. Fields are typed non-optional where tests require direct index access.
export type AnyCardProps = {
  sectionKey: string;
  // StatCard
  label?: string;
  value?: number;
  max?: number;
  // VerdictCard
  status?: string;
  summary?: string;
  // ListCard
  title?: string;
  items?: string[];
  // CompetitorCard
  name?: string;
  positioning?: string;
  weakness?: string;
  yourGap?: string;
  // BudgetBarCard
  totalBudget?: string;
  allocations: BudgetAllocation[];
  // QuoteCard
  quote?: string;
};

export type SubsectionCard = {
  id: string;
  type: 'stat' | 'verdict' | 'list' | 'competitor' | 'budgetBar' | 'quote';
  props: AnyCardProps;
};

// Internal partial type used inside builders — cast to SubsectionCard at return
type PartialCard = {
  id: string;
  type: SubsectionCard['type'];
  props: Partial<AnyCardProps> & { sectionKey: string };
};

// Compact nullable internal cards into SubsectionCard[]
function compact(cards: (PartialCard | null)[]): SubsectionCard[] {
  return cards
    .filter((c): c is PartialCard => c !== null)
    .map((c) => ({
      ...c,
      props: { allocations: [], ...c.props },
    } as SubsectionCard));
}

const get = <T,>(obj: unknown, key: string): T | undefined =>
  (obj as Record<string, T> | undefined)?.[key];

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const str = (v: unknown): string => {
  if (typeof v === 'string') return v;
  return (
    get<string>(v, 'insight') ??
    get<string>(v, 'point') ??
    get<string>(v, 'name') ??
    get<string>(v, 'angle') ??
    get<string>(v, 'factor') ??
    ''
  );
};

export function buildSubsectionCards(
  sectionKey: string,
  data: Record<string, unknown>
): SubsectionCard[] {
  try {
    if (sectionKey === 'industryMarket') return buildIndustry(sectionKey, data);
    if (sectionKey === 'competitors')    return buildCompetitors(sectionKey, data);
    if (sectionKey === 'icpValidation')  return buildICP(sectionKey, data);
    if (sectionKey === 'offerAnalysis')  return buildOffer(sectionKey, data);
    if (sectionKey === 'crossAnalysis')  return buildSynthesis(sectionKey, data);
    if (sectionKey === 'keywordIntel')   return buildKeywords(sectionKey, data);
  } catch {
    // research data shapes vary — never crash the UI
  }
  return [];
}

function buildIndustry(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const snap = get<Record<string, unknown>>(data, 'categorySnapshot');
  if (!snap) return [];

  const painPoints = get<Record<string, unknown>>(data, 'painPoints');
  const primary = arr(get(painPoints, 'primary')).map(str).filter(Boolean);
  const triggers = arr(get(painPoints, 'triggers')).map(str).filter(Boolean);
  const messaging = get<Record<string, unknown>>(data, 'messagingOpportunities');
  const angles = arr(get(messaging, 'angles')).map(str).filter(Boolean);

  return compact([
    {
      id: `${sectionKey}-verdict`,
      type: 'verdict',
      props: {
        sectionKey,
        label: 'Market',
        status: (get<string>(snap, 'marketMaturity') ?? 'Unknown').toUpperCase(),
        summary: [
          get<string>(snap, 'category'),
          get<string>(snap, 'averageSalesCycle')
            ? `${get<string>(snap, 'averageSalesCycle')} sales cycle`
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
      },
    },
    primary.length > 0
      ? { id: `${sectionKey}-pains`, type: 'list', props: { sectionKey, title: 'Top Pain Points', items: primary.slice(0, 3) } }
      : null,
    triggers.length > 0
      ? { id: `${sectionKey}-triggers`, type: 'list', props: { sectionKey, title: 'Buying Triggers', items: triggers.slice(0, 3) } }
      : null,
    angles.length > 0
      ? { id: `${sectionKey}-angles`, type: 'list', props: { sectionKey, title: 'Messaging Angles', items: angles.slice(0, 3) } }
      : null,
  ]);
}

function buildCompetitors(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const competitors = arr(data.competitors);
  if (!competitors.length) return [];

  const gaps = arr(data.whiteSpaceGaps);

  const competitorCards: PartialCard[] = competitors.slice(0, 3).map((comp, i) => {
    const c = comp as Record<string, unknown>;
    const threat = get<Record<string, unknown>>(c, 'threatAssessment');
    const weaknesses = arr(get(c, 'weaknesses')).map(str).filter(Boolean);
    return {
      id: `${sectionKey}-comp-${i}`,
      type: 'competitor' as const,
      props: {
        sectionKey,
        name: get<string>(c, 'name') ?? `Competitor ${i + 1}`,
        positioning: get<string>(c, 'positioning'),
        weakness: weaknesses[0],
        yourGap: get<string>(threat, 'counterPositioning'),
      },
    };
  });

  return compact([
    {
      id: `${sectionKey}-summary`,
      type: 'verdict',
      props: {
        sectionKey,
        label: 'Competitors',
        status: `${competitors.length} competitor${competitors.length !== 1 ? 's' : ''} analyzed`,
        summary:
          gaps.length > 0
            ? `${gaps.length} white-space gap${gaps.length !== 1 ? 's' : ''} found`
            : undefined,
      },
    },
    ...competitorCards,
  ]);
}

function buildICP(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const verdict = get<Record<string, unknown>>(data, 'finalVerdict');
  if (!verdict) return [];

  const fit = get<Record<string, unknown>>(data, 'painSolutionFit');
  const fitScore = get<number>(fit, 'fitScore');

  return compact([
    {
      id: `${sectionKey}-verdict`,
      type: 'verdict',
      props: {
        sectionKey,
        label: 'ICP Validation',
        status: get<string>(verdict, 'status') ?? 'Analyzed',
        summary: get<string>(verdict, 'summary'),
      },
    },
    fitScore !== undefined
      ? {
          id: `${sectionKey}-score`,
          type: 'stat' as const,
          props: { sectionKey, label: 'Fit Score', value: fitScore, max: 10 },
        }
      : null,
  ]);
}

function buildOffer(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const strength = get<Record<string, unknown>>(data, 'offerStrength');
  const overallScore =
    get<number>(strength, 'overallScore') ?? get<number>(data, 'overallScore');
  const recommendation =
    get<string>(data, 'recommendationStatus') ?? get<string>(data, 'recommendation') ?? '';
  if (!recommendation && overallScore === undefined) return [];

  const breakdown = strength
    ? Object.entries(strength)
        .filter(([k, v]) => k !== 'overallScore' && typeof v === 'number')
        .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()}: ${v}/10`)
    : [];

  return compact([
    recommendation
      ? {
          id: `${sectionKey}-verdict`,
          type: 'verdict' as const,
          props: { sectionKey, label: 'Offer Analysis', status: recommendation },
        }
      : null,
    overallScore !== undefined
      ? {
          id: `${sectionKey}-score`,
          type: 'stat' as const,
          props: { sectionKey, label: 'Offer Score', value: overallScore, max: 10 },
        }
      : null,
    breakdown.length > 0
      ? {
          id: `${sectionKey}-breakdown`,
          type: 'list' as const,
          props: { sectionKey, title: 'Strength Breakdown', items: breakdown },
        }
      : null,
  ]);
}

function buildSynthesis(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const positioningStrategy = get<Record<string, unknown>>(data, 'positioningStrategy');
  const positioningAngle = get<string>(positioningStrategy, 'recommendedAngle') ?? '';
  const platforms = arr(data.platformRecommendations);
  const messagingAngles = arr(data.messagingAngles);
  const hooks = messagingAngles
    .map(
      (m) =>
        get<string>(m as Record<string, unknown>, 'exampleHook') ??
        get<string>(m as Record<string, unknown>, 'angle') ??
        ''
    )
    .filter(Boolean);
  const nextSteps = arr(data.nextSteps).map(str).filter(Boolean);

  const allocations: BudgetAllocation[] = platforms
    .map((p) => {
      const platform = p as Record<string, unknown>;
      const budgetStr = get<string>(platform, 'budgetAllocation') ?? '';
      const pctMatch = budgetStr.match(/(\d+)%/);
      const amountMatch = budgetStr.match(/(\$[\d,]+)/);
      return {
        platform: get<string>(platform, 'platform') ?? '',
        percentage: pctMatch ? parseInt(pctMatch[1]) : 0,
        amount: amountMatch ? amountMatch[1] : '',
      };
    })
    .filter((a) => a.platform && a.percentage > 0);

  return compact([
    positioningAngle
      ? { id: `${sectionKey}-quote`, type: 'quote' as const, props: { sectionKey, quote: positioningAngle } }
      : null,
    allocations.length > 0
      ? { id: `${sectionKey}-budget`, type: 'budgetBar' as const, props: { sectionKey, allocations } }
      : null,
    hooks.length > 0
      ? { id: `${sectionKey}-hooks`, type: 'list' as const, props: { sectionKey, title: 'Ad Hooks', items: hooks.slice(0, 3) } }
      : null,
    nextSteps.length > 0
      ? { id: `${sectionKey}-next`, type: 'list' as const, props: { sectionKey, title: 'Next Steps', items: nextSteps.slice(0, 5) } }
      : null,
  ]);
}

function buildKeywords(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const total = data.totalKeywordsFound as number | undefined;
  const gaps = data.competitorGapCount as number | undefined;
  const opportunities = arr(data.topOpportunities);
  const competitorGaps = arr(data.competitorGaps);

  const oppItems = opportunities
    .slice(0, 3)
    .map((o) => {
      const opp = o as Record<string, unknown>;
      const kw = get<string>(opp, 'keyword') ?? '';
      const vol = get<number>(opp, 'searchVolume');
      return vol ? `"${kw}"  ·  Vol ${vol.toLocaleString()}` : `"${kw}"`;
    })
    .filter(Boolean);

  const gapItems = competitorGaps
    .slice(0, 3)
    .map((g) => {
      const gap = g as Record<string, unknown>;
      const kw = get<string>(gap, 'keyword') ?? '';
      const comp = get<string>(gap, 'competitorName') ?? '';
      return `"${kw}" — ${comp} ranks, you don't`;
    })
    .filter(Boolean);

  return compact([
    {
      id: `${sectionKey}-summary`,
      type: 'verdict',
      props: {
        sectionKey,
        label: 'Keyword Intel',
        status: total ? `${total} keywords` : 'Keywords analyzed',
        summary: gaps ? `${gaps} competitor gap${gaps !== 1 ? 's' : ''} found` : undefined,
      },
    },
    oppItems.length > 0
      ? { id: `${sectionKey}-opps`, type: 'list' as const, props: { sectionKey, title: 'Top Opportunities', items: oppItems } }
      : null,
    gapItems.length > 0
      ? { id: `${sectionKey}-gaps`, type: 'list' as const, props: { sectionKey, title: 'Competitor Gaps', items: gapItems } }
      : null,
  ]);
}
