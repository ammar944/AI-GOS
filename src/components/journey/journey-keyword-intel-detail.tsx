'use client';

import type { ReactNode } from 'react';
import { KeyRound, ShieldBan, Sparkles, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    topOpportunities: Array.isArray(data.topOpportunities)
      ? data.topOpportunities.map(parseKeywordOpportunity).filter(Boolean) as JourneyKeywordOpportunity[]
      : [],
    recommendedStartingSet: Array.isArray(data.recommendedStartingSet)
      ? data.recommendedStartingSet.map(parseStartingKeyword).filter(Boolean) as JourneyKeywordStartingKeyword[]
      : [],
    competitorGaps: Array.isArray(data.competitorGaps)
      ? data.competitorGaps.map(parseCompetitorGap).filter(Boolean) as JourneyKeywordCompetitorGap[]
      : [],
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

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' ? value.toLocaleString('en-US') : 'N/A';
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof KeyRound;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        <Icon className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {title}
      </h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DifficultyPill({ difficulty }: { difficulty?: string }): React.JSX.Element {
  const normalized = difficulty?.toLowerCase() ?? '';
  const tone =
    normalized === 'low'
      ? 'border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.12)] text-[rgb(170,255,203)]'
      : normalized === 'medium'
        ? 'border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.12)] text-[rgb(255,222,158)]'
        : normalized === 'high'
          ? 'border-[rgba(248,113,113,0.24)] bg-[rgba(248,113,113,0.12)] text-[rgb(255,198,198)]'
          : 'border-[var(--border-default)] bg-[var(--bg-hover)] text-text-secondary';

  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
        tone,
      )}
    >
      {difficulty ?? 'Unknown'}
    </span>
  );
}

function OpportunityTable({
  opportunities,
}: {
  opportunities: JourneyKeywordOpportunity[];
}): React.JSX.Element {
  if (opportunities.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No keyword opportunities were returned.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
      <div className="grid grid-cols-[minmax(0,1.8fr)_120px_120px_110px] gap-3 border-b border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        <span>Keyword</span>
        <span className="text-right">Volume</span>
        <span className="text-right">CPC</span>
        <span className="text-right">Difficulty</span>
      </div>
      <div className="divide-y divide-white/10">
        {opportunities.map((opportunity) => (
          <div
            key={opportunity.keyword}
            className="grid grid-cols-[minmax(0,1.8fr)_120px_120px_110px] gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-text-primary">
                {opportunity.keyword}
              </div>
              <div className="mt-1 text-xs text-text-secondary">
                Priority {formatNumber(opportunity.priorityScore)} · {opportunity.confidence ?? 'Unknown'} confidence
              </div>
            </div>
            <div className="text-right font-mono text-xs text-text-secondary">
              {formatNumber(opportunity.searchVolume)}
            </div>
            <div className="text-right font-mono text-xs text-text-secondary">
              {opportunity.estimatedCpc ?? 'N/A'}
            </div>
            <div className="flex justify-end">
              <DifficultyPill difficulty={opportunity.difficulty} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function JourneyKeywordIntelDetail({
  data,
  className,
}: JourneyKeywordIntelDetailProps): React.JSX.Element {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-3 md:grid-cols-4">
        <StatTile
          icon={KeyRound}
          label="Keyword opportunities"
          value={formatNumber(data.totalKeywordsFound)}
        />
        <StatTile
          icon={Target}
          label="Competitor gaps"
          value={formatNumber(data.competitorGapCount)}
        />
        <StatTile
          icon={TrendingUp}
          label="Campaign plans"
          value={formatNumber(data.campaignGroups.length)}
        />
        <StatTile
          icon={Sparkles}
          label="Quick wins"
          value={formatNumber(data.quickWins.length)}
        />
      </div>

      <SectionCard title="Top opportunities">
        <OpportunityTable opportunities={data.topOpportunities} />
      </SectionCard>

      <SectionCard title="Campaign groups">
        {data.campaignGroups.length > 0 ? (
          <div className="space-y-4">
            {data.campaignGroups.map((group) => (
              <div
                key={group.campaign}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {group.campaign}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {group.intent}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-text-secondary">
                    {typeof group.recommendedMonthlyBudget === 'number'
                      ? `$${group.recommendedMonthlyBudget.toLocaleString()}/mo`
                      : 'Budget TBD'}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {group.adGroups.map((adGroup) => (
                    <div
                      key={adGroup.name}
                      className="rounded-xl border border-[var(--border-default)] bg-black/20 p-3"
                    >
                      <div className="text-sm font-medium text-text-primary">
                        {adGroup.name}
                      </div>
                      {adGroup.recommendedMatchTypes.length > 0 && (
                        <div className="mt-1 text-xs text-text-secondary">
                          Match types: {adGroup.recommendedMatchTypes.join(', ')}
                        </div>
                      )}
                      <div className="mt-2 space-y-2">
                        {adGroup.keywords.map((keyword) => (
                          <div
                            key={`${adGroup.name}-${keyword.keyword}`}
                            className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-surface)] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm text-text-primary">
                                {keyword.keyword}
                              </div>
                              <div className="text-xs text-text-secondary">
                                {keyword.estimatedCpc ?? 'N/A'} · {formatNumber(keyword.searchVolume)}/mo
                              </div>
                            </div>
                            <DifficultyPill difficulty={keyword.difficulty} />
                          </div>
                        ))}
                      </div>
                      {adGroup.negativeKeywords.length > 0 && (
                        <div className="mt-3 text-xs text-text-secondary">
                          Negatives: {adGroup.negativeKeywords.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            No campaign groups were returned.
          </p>
        )}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="Recommended starting set">
          {data.recommendedStartingSet.length > 0 ? (
            <div className="space-y-3">
              {data.recommendedStartingSet.map((keyword) => (
                <div
                  key={`${keyword.keyword}-${keyword.adGroup}`}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        {keyword.keyword}
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">
                        {keyword.campaign} · {keyword.adGroup}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-text-secondary">
                      {typeof keyword.recommendedMonthlyBudget === 'number'
                        ? `$${keyword.recommendedMonthlyBudget.toLocaleString()}/mo`
                        : 'Budget TBD'}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">{keyword.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No recommended starting set was returned.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Competitor gaps">
          {data.competitorGaps.length > 0 ? (
            <div className="space-y-3">
              {data.competitorGaps.map((gap) => (
                <div
                  key={`${gap.keyword}-${gap.competitorName}`}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
                >
                  <div className="text-sm font-medium text-text-primary">
                    {gap.keyword}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {gap.competitorName}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {gap.competitorName} ranks, you don't
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    {formatNumber(gap.searchVolume)}/mo · {gap.estimatedCpc ?? 'N/A'} · Priority {formatNumber(gap.priorityScore)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No competitor gaps were returned.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="Negative keywords">
          {data.negativeKeywords.length > 0 ? (
            <div className="space-y-3">
              {data.negativeKeywords.map((keyword) => (
                <div
                  key={keyword.keyword}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <ShieldBan className="h-4 w-4 text-[var(--accent-cyan)]" />
                    {keyword.keyword}
                  </div>
                  <div className="mt-2 text-sm text-text-secondary">
                    {keyword.reason}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No negative keywords were returned.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Confidence notes">
          {data.confidenceNotes.length > 0 ? (
            <ul className="space-y-3">
              {data.confidenceNotes.map((note) => (
                <li
                  key={note}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-text-secondary"
                >
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">
              No confidence notes were returned.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Quick wins">
        {data.quickWins.length > 0 ? (
          <ul className="space-y-3">
            {data.quickWins.map((quickWin) => (
              <li
                key={quickWin}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-text-secondary"
              >
                {quickWin}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">
            No quick wins were returned.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
