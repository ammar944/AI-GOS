'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ─── Types ─── */

export interface JourneyKeywordOpportunity {
  keyword: string;
  searchVolume?: number;
  difficulty?: string;
  estimatedCpc?: string;
  priorityScore?: number;
  confidence?: string;
}

export interface JourneyKeywordCampaignAdGroup {
  name: string;
  recommendedMatchTypes: string[];
  keywords: JourneyKeywordOpportunity[];
  negativeKeywords: string[];
}

export interface JourneyKeywordCampaignGroup {
  campaign: string;
  intent: string;
  recommendedMonthlyBudget?: number;
  adGroups: JourneyKeywordCampaignAdGroup[];
}

export interface JourneyKeywordStartingKeyword {
  keyword: string;
  campaign: string;
  adGroup: string;
  recommendedMonthlyBudget?: number;
  reason: string;
  priorityScore?: number;
}

export interface JourneyKeywordCompetitorGap {
  keyword: string;
  competitorName: string;
  searchVolume?: number;
  estimatedCpc?: string;
  priorityScore?: number;
}

export interface JourneyKeywordNegativeKeyword {
  keyword: string;
  reason: string;
}

export interface JourneyKeywordIntelDetailData {
  totalKeywordsFound: number;
  competitorGapCount: number;
  campaignGroups: JourneyKeywordCampaignGroup[];
  topOpportunities: JourneyKeywordOpportunity[];
  recommendedStartingSet: JourneyKeywordStartingKeyword[];
  competitorGaps: JourneyKeywordCompetitorGap[];
  negativeKeywords: JourneyKeywordNegativeKeyword[];
  confidenceNotes: string[];
  quickWins: string[];
}

export interface JourneyKeywordIntelDetailProps {
  data: JourneyKeywordIntelDetailData;
  className?: string;
}

/* ─── Parse helpers (unchanged) ─── */

function dedup<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseKeywordOpportunity(value: unknown): JourneyKeywordOpportunity | null {
  if (!isRecord(value) || !isString(value.keyword)) {
    return null;
  }

  return {
    keyword: value.keyword,
    searchVolume: parseNumber(value.searchVolume),
    difficulty: isString(value.difficulty) ? value.difficulty : undefined,
    estimatedCpc: isString(value.estimatedCpc) ? value.estimatedCpc : undefined,
    priorityScore: parseNumber(value.priorityScore),
    confidence: isString(value.confidence) ? value.confidence : undefined,
  };
}

function parseCampaignAdGroup(value: unknown): JourneyKeywordCampaignAdGroup | null {
  if (!isRecord(value) || !isString(value.name)) {
    return null;
  }

  return {
    name: value.name,
    recommendedMatchTypes: Array.isArray(value.recommendedMatchTypes)
      ? value.recommendedMatchTypes.filter(isString)
      : [],
    keywords: Array.isArray(value.keywords)
      ? value.keywords.map(parseKeywordOpportunity).filter(Boolean) as JourneyKeywordOpportunity[]
      : [],
    negativeKeywords: Array.isArray(value.negativeKeywords)
      ? value.negativeKeywords.filter(isString)
      : [],
  };
}

function parseCampaignGroup(value: unknown): JourneyKeywordCampaignGroup | null {
  if (!isRecord(value) || !isString(value.campaign) || !isString(value.intent)) {
    return null;
  }

  return {
    campaign: value.campaign,
    intent: value.intent,
    recommendedMonthlyBudget: parseNumber(value.recommendedMonthlyBudget),
    adGroups: Array.isArray(value.adGroups)
      ? value.adGroups.map(parseCampaignAdGroup).filter(Boolean) as JourneyKeywordCampaignAdGroup[]
      : [],
  };
}

function parseStartingKeyword(value: unknown): JourneyKeywordStartingKeyword | null {
  if (
    !isRecord(value) ||
    !isString(value.keyword) ||
    !isString(value.campaign) ||
    !isString(value.adGroup) ||
    !isString(value.reason)
  ) {
    return null;
  }

  return {
    keyword: value.keyword,
    campaign: value.campaign,
    adGroup: value.adGroup,
    recommendedMonthlyBudget: parseNumber(value.recommendedMonthlyBudget),
    reason: value.reason,
    priorityScore: parseNumber(value.priorityScore),
  };
}

function parseCompetitorGap(value: unknown): JourneyKeywordCompetitorGap | null {
  if (!isRecord(value) || !isString(value.keyword) || !isString(value.competitorName)) {
    return null;
  }

  return {
    keyword: value.keyword,
    competitorName: value.competitorName,
    searchVolume: parseNumber(value.searchVolume),
    estimatedCpc: isString(value.estimatedCpc) ? value.estimatedCpc : undefined,
    priorityScore: parseNumber(value.priorityScore),
  };
}

function parseNegativeKeyword(value: unknown): JourneyKeywordNegativeKeyword | null {
  if (!isRecord(value) || !isString(value.keyword) || !isString(value.reason)) {
    return null;
  }

  return {
    keyword: value.keyword,
    reason: value.reason,
  };
}

export function getJourneyKeywordIntelDetailData(
  data: Record<string, unknown> | null | undefined,
): JourneyKeywordIntelDetailData | null {
  if (!data) {
    return null;
  }

  return {
    totalKeywordsFound: parseNumber(data.totalKeywordsFound) ?? 0,
    competitorGapCount: parseNumber(data.competitorGapCount) ?? 0,
    campaignGroups: Array.isArray(data.campaignGroups)
      ? data.campaignGroups.map(parseCampaignGroup).filter(Boolean) as JourneyKeywordCampaignGroup[]
      : [],
    topOpportunities: dedup(
      Array.isArray(data.topOpportunities)
        ? data.topOpportunities.map(parseKeywordOpportunity).filter(Boolean) as JourneyKeywordOpportunity[]
        : [],
      (k) => k.keyword.toLowerCase(),
    ),
    recommendedStartingSet: dedup(
      Array.isArray(data.recommendedStartingSet)
        ? data.recommendedStartingSet.map(parseStartingKeyword).filter(Boolean) as JourneyKeywordStartingKeyword[]
        : [],
      (k) => k.keyword.toLowerCase(),
    ),
    competitorGaps: dedup(
      Array.isArray(data.competitorGaps)
        ? data.competitorGaps.map(parseCompetitorGap).filter(Boolean) as JourneyKeywordCompetitorGap[]
        : [],
      (k) => k.keyword.toLowerCase(),
    ),
    negativeKeywords: Array.isArray(data.negativeKeywords)
      ? data.negativeKeywords.map(parseNegativeKeyword).filter(Boolean) as JourneyKeywordNegativeKeyword[]
      : [],
    confidenceNotes: Array.isArray(data.confidenceNotes)
      ? data.confidenceNotes.filter(isString)
      : [],
    quickWins: Array.isArray(data.quickWins)
      ? data.quickWins.filter(isString)
      : [],
  };
}

/* ─── Shared formatting ─── */

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' ? value.toLocaleString('en-US') : 'N/A';
}

/* ─── Reusable sub-components ─── */

function SectionHeading({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <h4 className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
      {children}
    </h4>
  );
}

function DifficultyPill({ difficulty }: { difficulty?: string }): React.JSX.Element {
  const normalized = difficulty?.toLowerCase() ?? '';
  const tone =
    normalized === 'low'
      ? 'bg-[rgba(34,197,94,0.10)] text-[var(--accent-green)]'
      : normalized === 'medium'
        ? 'bg-[rgba(245,158,11,0.10)] text-[var(--accent-amber)]'
        : normalized === 'high'
          ? 'bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]'
          : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]';

  return (
    <span
      className={cn(
        'inline-flex text-[10px] font-mono font-medium rounded-full px-2 py-0.5',
        tone,
      )}
    >
      {difficulty ?? 'Unknown'}
    </span>
  );
}

/** Column header for tables */
function ColHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--text-quaternary)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ─── Section 1: Hero Stats (inline row) ─── */

function HeroStats({ data }: { data: JourneyKeywordIntelDetailData }): React.JSX.Element {
  const stats = [
    { label: 'Keywords Found', value: formatNumber(data.totalKeywordsFound) },
    { label: 'Competitor Gaps', value: formatNumber(data.competitorGapCount) },
    { label: 'Campaign Plans', value: formatNumber(data.campaignGroups.length) },
    { label: 'Quick Wins', value: formatNumber(data.quickWins.length) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-y-3">
      {stats.map((stat, i) => (
        <div key={stat.label} className="flex items-center">
          <div className="px-4 first:pl-0">
            <div className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
              {stat.label}
            </div>
            <div className="mt-1 text-xl font-mono tabular-nums text-[var(--text-primary)]">
              {stat.value}
            </div>
          </div>
          {i < stats.length - 1 && (
            <div className="h-8 border-r border-[var(--border-subtle)]" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Section 2: Top Opportunities Table ─── */

function OpportunityTable({
  opportunities,
}: {
  opportunities: JourneyKeywordOpportunity[];
}): React.JSX.Element {
  if (opportunities.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        No keyword opportunities were returned.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px]">
        <thead>
          <tr>
            <th className="pb-2 text-left"><ColHeader>Keyword</ColHeader></th>
            <th className="pb-2 text-right"><ColHeader>Volume</ColHeader></th>
            <th className="pb-2 text-right"><ColHeader>CPC</ColHeader></th>
            <th className="pb-2 text-center"><ColHeader>Difficulty</ColHeader></th>
            <th className="pb-2 text-right"><ColHeader>Priority</ColHeader></th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opp) => (
            <tr
              key={opp.keyword}
              className="hover:bg-[var(--bg-hover)] transition-colors duration-150"
            >
              <td className="py-2 pr-3 text-sm text-[var(--text-primary)]">
                {opp.keyword}
              </td>
              <td className="py-2 px-3 text-right font-mono tabular-nums text-sm text-[var(--text-primary)]">
                {formatNumber(opp.searchVolume)}
              </td>
              <td className="py-2 px-3 text-right font-mono tabular-nums text-sm text-[var(--text-primary)]">
                {opp.estimatedCpc ?? 'N/A'}
              </td>
              <td className="py-2 px-3 text-center">
                <DifficultyPill difficulty={opp.difficulty} />
              </td>
              <td className="py-2 pl-3 text-right">
                <span className="font-mono tabular-nums text-sm text-[var(--text-primary)]">
                  {formatNumber(opp.priorityScore)}
                </span>
                {opp.confidence && (
                  <span className="block text-[10px] font-mono text-[var(--text-tertiary)]">
                    {opp.confidence}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Section 3: Campaign Groups (sub-tab switching) ─── */

function CampaignGroupsSection({
  groups,
}: {
  groups: JourneyKeywordCampaignGroup[];
}): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);

  if (groups.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        No campaign groups were returned.
      </p>
    );
  }

  const active = groups[activeIndex] ?? groups[0];

  // Collect all negative keywords across all ad groups in the active campaign
  const allNegatives = active.adGroups.flatMap((ag) => ag.negativeKeywords);
  const uniqueNegatives = [...new Set(allNegatives)];

  // Collect all keywords across all ad groups for flat table display
  const allKeywords = active.adGroups.flatMap((ag) =>
    ag.keywords.map((kw) => ({
      ...kw,
      adGroupName: ag.name,
      matchTypes: ag.recommendedMatchTypes,
    })),
  );

  return (
    <div>
      {/* Sub-tab pill group */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center rounded-[var(--radius-md)] bg-[var(--bg-hover)] p-0.5">
          {groups.map((group, i) => (
            <button
              key={group.campaign}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] transition-colors duration-150',
                i === activeIndex
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              )}
            >
              {group.campaign}
            </button>
          ))}
        </div>

        {/* Budget inline stat */}
        {typeof active.recommendedMonthlyBudget === 'number' && (
          <span className="text-sm font-mono tabular-nums text-[var(--text-secondary)]">
            ${active.recommendedMonthlyBudget.toLocaleString()}/mo
          </span>
        )}
      </div>

      {/* Campaign intent */}
      <p className="text-sm leading-relaxed text-[var(--text-secondary)] mb-4">
        {active.intent}
      </p>

      {/* Keywords table */}
      {allKeywords.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr>
                <th className="pb-2 text-left"><ColHeader>Keyword</ColHeader></th>
                <th className="pb-2 text-left"><ColHeader>Ad Group</ColHeader></th>
                <th className="pb-2 text-right"><ColHeader>Volume</ColHeader></th>
                <th className="pb-2 text-right"><ColHeader>CPC</ColHeader></th>
                <th className="pb-2 text-center"><ColHeader>Difficulty</ColHeader></th>
              </tr>
            </thead>
            <tbody>
              {allKeywords.map((kw) => (
                <tr
                  key={`${kw.adGroupName}-${kw.keyword}`}
                  className="hover:bg-[var(--bg-hover)] transition-colors duration-150"
                >
                  <td className="py-2 pr-3">
                    <span className="text-sm text-[var(--text-primary)]">{kw.keyword}</span>
                    {kw.matchTypes.length > 0 && (
                      <span className="ml-2 text-[10px] font-mono text-[var(--text-tertiary)]">
                        {kw.matchTypes.join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-sm text-[var(--text-secondary)]">
                    {kw.adGroupName}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-sm text-[var(--text-primary)]">
                    {formatNumber(kw.searchVolume)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-sm text-[var(--text-primary)]">
                    {kw.estimatedCpc ?? 'N/A'}
                  </td>
                  <td className="py-2 pl-3 text-center">
                    <DifficultyPill difficulty={kw.difficulty} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          No keywords in this campaign.
        </p>
      )}

      {/* Negative keywords as pill badges row */}
      {uniqueNegatives.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2">
            Negative keywords
          </div>
          <div className="flex flex-wrap gap-2">
            {uniqueNegatives.map((neg) => (
              <span
                key={neg}
                className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]"
              >
                {neg}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Section 4: Recommended Starting Set (callout blocks) ─── */

function StartingSetSection({
  keywords,
}: {
  keywords: JourneyKeywordStartingKeyword[];
}): React.JSX.Element {
  if (keywords.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        No recommended starting set was returned.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {keywords.map((kw) => (
        <div
          key={`${kw.keyword}-${kw.adGroup}`}
          className="border-l-2 border-[var(--accent-green)] pl-4 py-1"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-sm text-[var(--text-primary)]">
              {kw.keyword}
            </span>
            <span className="font-mono tabular-nums text-sm text-[var(--text-primary)] shrink-0">
              {typeof kw.recommendedMonthlyBudget === 'number'
                ? `$${kw.recommendedMonthlyBudget.toLocaleString()}/mo`
                : 'Budget TBD'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] mt-0.5">
            {kw.campaign} / {kw.adGroup}
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)] mt-1.5">
            {kw.reason}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Section 5: Competitor Gaps (table) ─── */

function CompetitorGapsTable({
  gaps,
}: {
  gaps: JourneyKeywordCompetitorGap[];
}): React.JSX.Element {
  if (gaps.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        No competitor gaps were returned.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px]">
        <thead>
          <tr>
            <th className="pb-2 text-left"><ColHeader>Keyword</ColHeader></th>
            <th className="pb-2 text-left"><ColHeader>Competitor</ColHeader></th>
            <th className="pb-2 text-right"><ColHeader>Volume</ColHeader></th>
            <th className="pb-2 text-right"><ColHeader>CPC</ColHeader></th>
            <th className="pb-2 text-right"><ColHeader>Priority</ColHeader></th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => (
            <tr
              key={`${gap.keyword}-${gap.competitorName}`}
              className="hover:bg-[var(--bg-hover)] transition-colors duration-150"
            >
              <td className="py-2 pr-3 text-sm text-[var(--text-primary)]">
                {gap.keyword}
              </td>
              <td className="py-2 px-3 text-sm text-[var(--text-secondary)]">
                {gap.competitorName}
              </td>
              <td className="py-2 px-3 text-right font-mono tabular-nums text-sm text-[var(--text-primary)]">
                {formatNumber(gap.searchVolume)}
              </td>
              <td className="py-2 px-3 text-right font-mono tabular-nums text-sm text-[var(--text-primary)]">
                {gap.estimatedCpc ?? 'N/A'}
              </td>
              <td className="py-2 pl-3 text-right font-mono tabular-nums text-sm text-[var(--text-primary)]">
                {formatNumber(gap.priorityScore)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Section 6: Negative Keywords (pill badges) ─── */

function NegativeKeywordsPills({
  keywords,
}: {
  keywords: JourneyKeywordNegativeKeyword[];
}): React.JSX.Element {
  if (keywords.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        No negative keywords were returned.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((kw) => (
        <span
          key={kw.keyword}
          title={kw.reason}
          className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)] cursor-default"
        >
          {kw.keyword}
        </span>
      ))}
    </div>
  );
}

/* ─── Section 7: Confidence Notes (collapsible) ─── */

function ConfidenceNotesSection({
  notes,
}: {
  notes: string[];
}): React.JSX.Element {
  if (notes.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        No confidence notes were returned.
      </p>
    );
  }

  return (
    <details>
      <summary className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] cursor-pointer select-none">
        Confidence notes ({notes.length})
      </summary>
      <div className="mt-3 space-y-2">
        {notes.map((note) => (
          <p
            key={note}
            className="text-sm leading-relaxed text-[var(--text-secondary)]"
          >
            {note}
          </p>
        ))}
      </div>
    </details>
  );
}

/* ─── Section 8: Quick Wins (callout blocks) ─── */

function QuickWinsSection({
  wins,
}: {
  wins: string[];
}): React.JSX.Element {
  if (wins.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        No quick wins were returned.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {wins.map((win) => (
        <div
          key={win}
          className="border-l border-[var(--border-default)] pl-4 py-1"
        >
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {win}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */

export function JourneyKeywordIntelDetail({
  data,
  className,
}: JourneyKeywordIntelDetailProps): React.JSX.Element {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Section 1: Hero Stats — inline row */}
      <HeroStats data={data} />

      {/* Section 2: Top Opportunities — clean table */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <SectionHeading>Top opportunities</SectionHeading>
        <div className="mt-4">
          <OpportunityTable opportunities={data.topOpportunities} />
        </div>
      </section>

      {/* Section 3: Campaign Groups — sub-tab switching */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <SectionHeading>Campaign groups</SectionHeading>
        <div className="mt-4">
          <CampaignGroupsSection groups={data.campaignGroups} />
        </div>
      </section>

      {/* Section 4 + 5: Starting Set + Competitor Gaps — side by side */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <SectionHeading>Recommended starting set</SectionHeading>
          <div className="mt-4">
            <StartingSetSection keywords={data.recommendedStartingSet} />
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <SectionHeading>Competitor gaps</SectionHeading>
          <div className="mt-4">
            <CompetitorGapsTable gaps={data.competitorGaps} />
          </div>
        </section>
      </div>

      {/* Section 6 + 7: Negative Keywords + Confidence Notes — side by side */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <SectionHeading>Negative keywords</SectionHeading>
          <div className="mt-4">
            <NegativeKeywordsPills keywords={data.negativeKeywords} />
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <ConfidenceNotesSection notes={data.confidenceNotes} />
        </section>
      </div>

      {/* Section 8: Quick Wins — callout blocks */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <SectionHeading>Quick wins</SectionHeading>
        <div className="mt-4">
          <QuickWinsSection wins={data.quickWins} />
        </div>
      </section>
    </div>
  );
}
