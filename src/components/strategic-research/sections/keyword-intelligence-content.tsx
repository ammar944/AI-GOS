"use client";

import * as React from "react";
import {
  Target,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Search,
  Globe,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EditableText, EditableList } from "../editable";
import { STATUS_BADGE_COLORS } from "../ui-tokens";
import { safeRender, safeArray } from "./shared-helpers";
import {
  SubSection,
  ListItem,
  type EditableContentProps,
} from "./shared-primitives";
import type {
  KeywordIntelligence,
  KeywordOpportunity,
  DomainKeywordStats,
  SEOAuditData,
  SEOPageCheck,
  PageSpeedMetrics,
} from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Keyword Intelligence Helpers
// =============================================================================

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: STATUS_BADGE_COLORS.success,
  medium: STATUS_BADGE_COLORS.warning,
  hard: STATUS_BADGE_COLORS.caution,
  veryHard: STATUS_BADGE_COLORS.danger,
};

function getDifficultyLabel(difficulty: number): { label: string; color: string } {
  if (difficulty <= 30) return { label: "Easy", color: DIFFICULTY_COLORS.easy };
  if (difficulty <= 50) return { label: "Medium", color: DIFFICULTY_COLORS.medium };
  if (difficulty <= 70) return { label: "Hard", color: DIFFICULTY_COLORS.hard };
  return { label: "Very Hard", color: DIFFICULTY_COLORS.veryHard };
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return "N/A";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

// =============================================================================
// Sub-components
// =============================================================================

function DomainStatCard({ stats, label }: { stats: DomainKeywordStats; label?: string }) {
  return (
    <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/[0.08]">
          <Globe className="size-3 text-primary/80" />
        </div>
        <p className="font-medium text-sm text-white/85 truncate font-[family-name:var(--font-heading)]">
          {label || stats.domain}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/30 mb-0.5">Organic KWs</p>
          <p className="font-medium text-white/85 font-[family-name:var(--font-mono)] tabular-nums">
            {formatNumber(stats.organicKeywords)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/30 mb-0.5">Paid KWs</p>
          <p className="font-medium text-white/85 font-[family-name:var(--font-mono)] tabular-nums">
            {formatNumber(stats.paidKeywords)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/30 mb-0.5">Organic Clicks/mo</p>
          <p className="font-medium text-white/85 font-[family-name:var(--font-mono)] tabular-nums">
            {formatNumber(stats.monthlyOrganicClicks)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/30 mb-0.5">Paid Clicks/mo</p>
          <p className="font-medium text-white/85 font-[family-name:var(--font-mono)] tabular-nums">
            {formatNumber(stats.monthlyPaidClicks)}
          </p>
        </div>
        {stats.organicClicksValue > 0 && (
          <div title="Estimated cost to buy this organic traffic via Google Ads (clicks × CPC). Not actual revenue.">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/30 mb-0.5">Est. Traffic Value</p>
            <p className="font-medium text-emerald-400/80 font-[family-name:var(--font-mono)] tabular-nums">
              ${formatNumber(stats.organicClicksValue)}
            </p>
          </div>
        )}
        {stats.paidClicksValue > 0 && (
          <div title="Estimated monthly ad spend based on paid keyword bids and click volume.">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/30 mb-0.5">Ad Spend/mo</p>
            <p className="font-medium text-primary/80 font-[family-name:var(--font-mono)] tabular-nums">
              ${formatNumber(stats.paidClicksValue)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function KeywordTable({ keywords, maxRows = 15 }: { keywords: KeywordOpportunity[]; maxRows?: number }) {
  const [sortBy, setSortBy] = React.useState<'searchVolume' | 'cpc' | 'difficulty'>('searchVolume');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  const sorted = React.useMemo(() => {
    const copy = [...keywords];
    copy.sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      return sortDir === 'desc' ? valB - valA : valA - valB;
    });
    return copy.slice(0, maxRows);
  }, [keywords, sortBy, sortDir, maxRows]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  if (keywords.length === 0) {
    return <p className="text-sm text-white/30 italic">No keywords found</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.06em] text-white/30">Keyword</th>
            <th
              className={cn(
                "text-right py-2 px-2 text-[10px] font-medium uppercase tracking-[0.06em] cursor-pointer select-none transition-colors",
                sortBy === 'searchVolume' ? "text-primary/80" : "text-white/30 hover:text-white/50"
              )}
              onClick={() => toggleSort('searchVolume')}
            >
              Volume {sortBy === 'searchVolume' && (sortDir === 'desc' ? '↓' : '↑')}
            </th>
            <th
              className={cn(
                "text-right py-2 px-2 text-[10px] font-medium uppercase tracking-[0.06em] cursor-pointer select-none transition-colors",
                sortBy === 'cpc' ? "text-primary/80" : "text-white/30 hover:text-white/50"
              )}
              onClick={() => toggleSort('cpc')}
            >
              CPC {sortBy === 'cpc' && (sortDir === 'desc' ? '↓' : '↑')}
            </th>
            <th
              className={cn(
                "text-right py-2 px-2 text-[10px] font-medium uppercase tracking-[0.06em] cursor-pointer select-none transition-colors",
                sortBy === 'difficulty' ? "text-primary/80" : "text-white/30 hover:text-white/50"
              )}
              onClick={() => toggleSort('difficulty')}
            >
              Difficulty {sortBy === 'difficulty' && (sortDir === 'desc' ? '↓' : '↑')}
            </th>
            <th className="text-right py-2 pl-2 text-[10px] font-medium uppercase tracking-[0.06em] text-white/30">Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((kw, i) => {
            const diff = getDifficultyLabel(kw.difficulty);
            return (
              <tr
                key={`${kw.keyword}-${i}`}
                className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors"
              >
                <td className="py-2 pr-4 font-medium text-white/85">
                  {kw.keyword}
                  {kw.competitors && kw.competitors.length > 0 && (
                    <span className="text-xs ml-2 text-white/30">
                      ({kw.competitors.length} competitors)
                    </span>
                  )}
                </td>
                <td className="text-right py-2 px-2 text-white/60 font-[family-name:var(--font-mono)] tabular-nums text-xs">
                  {formatNumber(kw.searchVolume)}
                </td>
                <td className="text-right py-2 px-2 text-white/60 font-[family-name:var(--font-mono)] tabular-nums text-xs">
                  ${kw.cpc.toFixed(2)}
                </td>
                <td className="text-right py-2 px-2">
                  <Badge variant="outline" className={cn("text-xs", diff.color)}>{diff.label}</Badge>
                </td>
                <td className="text-right py-2 pl-2">
                  <Badge variant="outline" className="text-xs capitalize border-white/[0.08] text-white/40">
                    {kw.source.replace(/_/g, ' ')}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {keywords.length > maxRows && (
        <p className="text-xs mt-2.5 text-white/30">
          Showing {maxRows} of {keywords.length} keywords
        </p>
      )}
    </div>
  );
}

// =============================================================================
// SEO Audit Sub-components
// =============================================================================

function SEOScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const colorClass =
    score >= 80
      ? "text-emerald-400/90 bg-emerald-500/[0.1] border-emerald-500/[0.15]"
      : score >= 50
        ? "text-amber-400/80 bg-amber-500/[0.1] border-amber-500/[0.15]"
        : "text-red-400/80 bg-red-500/[0.1] border-red-500/[0.15]";
  const sizeClass =
    size === "sm"
      ? "text-xs px-2 py-0.5"
      : size === "lg"
        ? "text-2xl px-4 py-2 font-bold"
        : "text-base px-3 py-1 font-semibold";
  return (
    <span
      className={cn(
        "rounded-md inline-flex items-center border font-[family-name:var(--font-mono)] tabular-nums",
        colorClass,
        sizeClass
      )}
    >
      {score}/100
    </span>
  );
}

function PassFailIcon({ pass }: { pass: boolean }) {
  return pass ? (
    <div className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/[0.1]">
      <CheckCircle2 className="size-3 text-emerald-400/80" />
    </div>
  ) : (
    <div className="inline-flex size-5 items-center justify-center rounded-full bg-red-500/[0.1]">
      <XCircle className="size-3 text-red-400/60" />
    </div>
  );
}

function CoreWebVitalCard({ label, value, unit, thresholds }: {
  label: string;
  value: number;
  unit: string;
  thresholds: { good: number; poor: number };
}) {
  const isGood = value <= thresholds.good;
  const isPoor = value > thresholds.poor;
  const colorClass = isGood
    ? "text-emerald-400/80 bg-emerald-500/[0.06] border-emerald-500/[0.12]"
    : isPoor
      ? "text-red-400/80 bg-red-500/[0.06] border-red-500/[0.12]"
      : "text-amber-400/80 bg-amber-500/[0.06] border-amber-500/[0.12]";

  return (
    <div className={cn("p-2.5 rounded-lg border text-center", colorClass)}>
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/30 mb-1">{label}</p>
      <p className={cn("text-base font-bold font-[family-name:var(--font-mono)] tabular-nums leading-none", colorClass.split(' ')[0])}>
        {value}{unit}
      </p>
    </div>
  );
}

function TechnicalSEOAuditSection({ audit }: { audit: SEOAuditData['technical'] }) {
  return (
    <SubSection title="Technical SEO Audit">
      {/* Overview row */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SEOScoreBadge score={audit.overallScore} />
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <div className="flex size-4 items-center justify-center rounded-full bg-red-500/[0.1]">
              <XCircle className="size-2.5 text-red-400/70" />
            </div>
            <span className="text-white/50">{audit.issueCount.critical} critical</span>
          </span>
          <span className="flex items-center gap-1.5">
            <div className="flex size-4 items-center justify-center rounded-full bg-amber-500/[0.1]">
              <AlertTriangle className="size-2.5 text-amber-400/70" />
            </div>
            <span className="text-white/50">{audit.issueCount.warning} warnings</span>
          </span>
          <span className="flex items-center gap-1.5">
            <div className="flex size-4 items-center justify-center rounded-full bg-emerald-500/[0.1]">
              <CheckCircle2 className="size-2.5 text-emerald-400/70" />
            </div>
            <span className="text-white/50">{audit.issueCount.pass} passed</span>
          </span>
        </div>
      </div>

      {/* Site-level checks */}
      <div className="flex gap-2 mb-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
            audit.sitemapFound
              ? "bg-emerald-500/[0.08] text-emerald-400/80 border-emerald-500/[0.15]"
              : "bg-red-500/[0.08] text-red-400/70 border-red-500/[0.12]"
          )}
        >
          {audit.sitemapFound ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <XCircle className="size-3" />
          )}
          Sitemap
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
            audit.robotsTxtFound
              ? "bg-emerald-500/[0.08] text-emerald-400/80 border-emerald-500/[0.15]"
              : "bg-red-500/[0.08] text-red-400/70 border-red-500/[0.12]"
          )}
        >
          {audit.robotsTxtFound ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <XCircle className="size-3" />
          )}
          Robots.txt
        </span>
      </div>

      {/* Page-by-page table */}
      {audit.pages.length > 0 && (
        <div className="overflow-x-auto rounded-lg bg-[var(--bg-surface)] border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-[var(--bg-surface)]">
                <th className="text-left py-2.5 px-3 font-medium text-[10px] uppercase tracking-[0.06em] text-white/30">Page</th>
                <th className="text-center py-2.5 px-2 font-medium text-[10px] uppercase tracking-[0.06em] text-white/30">Title</th>
                <th className="text-center py-2.5 px-2 font-medium text-[10px] uppercase tracking-[0.06em] text-white/30">Meta Desc</th>
                <th className="text-center py-2.5 px-2 font-medium text-[10px] uppercase tracking-[0.06em] text-white/30">H1</th>
                <th className="text-center py-2.5 px-2 font-medium text-[10px] uppercase tracking-[0.06em] text-white/30">Canonical</th>
                <th className="text-center py-2.5 px-2 font-medium text-[10px] uppercase tracking-[0.06em] text-white/30">Images</th>
                <th className="text-center py-2.5 px-2 font-medium text-[10px] uppercase tracking-[0.06em] text-white/30">Schema</th>
                <th className="text-center py-2.5 px-3 font-medium text-[10px] uppercase tracking-[0.06em] text-white/30">HTTPS</th>
              </tr>
            </thead>
            <tbody>
              {audit.pages.map((page, i) => {
                let shortUrl: string;
                try {
                  shortUrl = new URL(page.url).pathname || '/';
                } catch {
                  shortUrl = page.url;
                }

                const imgColor =
                  page.images.coveragePercent >= 80
                    ? "text-emerald-400/80"
                    : page.images.coveragePercent >= 50
                      ? "text-amber-400/80"
                      : "text-red-400/70";

                return (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
                    <td
                      className="py-2.5 px-3 font-medium text-white/70 truncate max-w-[120px]"
                      title={page.url}
                    >
                      {shortUrl}
                    </td>
                    <td className="text-center py-2.5 px-2"><PassFailIcon pass={page.title.pass} /></td>
                    <td className="text-center py-2.5 px-2"><PassFailIcon pass={page.metaDescription.pass} /></td>
                    <td className="text-center py-2.5 px-2"><PassFailIcon pass={page.h1.pass} /></td>
                    <td className="text-center py-2.5 px-2"><PassFailIcon pass={page.canonical.pass} /></td>
                    <td className="text-center py-2.5 px-2">
                      <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", imgColor)}>
                        {page.images.coveragePercent}%
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      {page.schemaTypes.length > 0 ? (
                        <div className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/[0.1]">
                          <CheckCircle2 className="size-3 text-emerald-400/80" />
                        </div>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                    <td className="text-center py-2.5 px-3"><PassFailIcon pass={page.isHttps} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SubSection>
  );
}

function PerformanceAuditSection({ performance }: { performance: SEOAuditData['performance'] }) {
  const hasData = performance.mobile || performance.desktop;

  if (!hasData) {
    return (
      <SubSection title="Performance (PageSpeed Insights)">
        <div className="p-4 rounded-lg bg-[var(--bg-surface)] border border-border flex items-center gap-2.5 text-sm">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/[0.1]">
            <AlertTriangle className="size-3 text-amber-400/70" />
          </div>
          <span className="text-white/50">
            PageSpeed data unavailable — the site may be unreachable, behind authentication, or the API timed out. The overall SEO score reflects technical checks only.
          </span>
        </div>
      </SubSection>
    );
  }

  const renderMetrics = (metrics: PageSpeedMetrics, label: string) => (
    <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-border flex-1">
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-sm text-white/85 font-[family-name:var(--font-heading)]">{label}</p>
        <SEOScoreBadge score={metrics.performanceScore} size="sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CoreWebVitalCard label="LCP" value={metrics.lcp} unit="s" thresholds={{ good: 2.5, poor: 4 }} />
        <CoreWebVitalCard label="CLS" value={metrics.cls} unit="" thresholds={{ good: 0.1, poor: 0.25 }} />
        <CoreWebVitalCard label="FCP" value={metrics.fcp} unit="s" thresholds={{ good: 1.8, poor: 3 }} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <CoreWebVitalCard label="TTI" value={metrics.tti} unit="s" thresholds={{ good: 3.8, poor: 7.3 }} />
        <CoreWebVitalCard label="Speed Index" value={metrics.speedIndex} unit="s" thresholds={{ good: 3.4, poor: 5.8 }} />
        <CoreWebVitalCard label="TBT" value={metrics.fid} unit="ms" thresholds={{ good: 200, poor: 600 }} />
      </div>
    </div>
  );

  return (
    <SubSection title="Performance (PageSpeed Insights)">
      <div className="flex flex-col md:flex-row gap-3">
        {performance.mobile && renderMetrics(performance.mobile, 'Mobile')}
        {performance.desktop && renderMetrics(performance.desktop, 'Desktop')}
      </div>
    </SubSection>
  );
}

// =============================================================================
// Section 6: Keyword Intelligence Content
// =============================================================================

interface KeywordIntelligenceContentProps extends EditableContentProps {
  data: KeywordIntelligence;
}

export function KeywordIntelligenceContent({ data, isEditing, onFieldChange }: KeywordIntelligenceContentProps) {
  const [activeTab, setActiveTab] = React.useState<'organic' | 'paid' | 'shared'>('organic');

  const tabKeywords = activeTab === 'organic' ? data?.organicGaps
    : activeTab === 'paid' ? data?.paidGaps
    : data?.sharedKeywords;

  return (
    <div className="space-y-5">
      {/* SEO Audit: Technical */}
      {data?.seoAudit?.technical && (
        <TechnicalSEOAuditSection audit={data.seoAudit.technical} />
      )}

      {/* SEO Audit: Performance */}
      {data?.seoAudit?.performance && (
        <PerformanceAuditSection performance={data.seoAudit.performance} />
      )}

      {/* SEO Audit: Overall Score */}
      {data?.seoAudit && (() => {
        const hasPerf = data.seoAudit!.performance.mobile || data.seoAudit!.performance.desktop;
        return (
          <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-border flex items-center justify-between text-sm">
            <span className="text-white/50">
              Overall SEO Score
              {hasPerf ? ' (60% Technical + 40% Performance)' : ' (Technical only — PageSpeed unavailable)'}
            </span>
            <SEOScoreBadge score={data.seoAudit!.overallScore} />
          </div>
        );
      })()}

      {/* Domain Overview */}
      {(data?.clientDomain || (data?.competitorDomains && data.competitorDomains.length > 0)) && (
        <SubSection title="Domain Overview">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data?.clientDomain && (
              <div className="relative">
                <div className="absolute -top-2 left-3 z-10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-primary text-white">
                  Your Site
                </div>
                <div className="rounded-lg ring-1 ring-primary/[0.25] ring-offset-0">
                  <DomainStatCard stats={data.clientDomain} />
                </div>
              </div>
            )}
            {(data?.competitorDomains || []).map((stats, i) => (
              <DomainStatCard key={i} stats={stats} />
            ))}
          </div>
        </SubSection>
      )}

      {/* Keyword Gaps with Tabs */}
      <SubSection title="Keyword Gap Analysis">
        <div className="flex gap-1.5 mb-4 p-1 rounded-lg bg-[var(--bg-surface)] border border-border/60 w-fit">
          {([
            { key: 'organic' as const, label: 'Organic Gaps', count: data?.organicGaps?.length ?? 0 },
            { key: 'paid' as const, label: 'Paid Gaps', count: data?.paidGaps?.length ?? 0 },
            { key: 'shared' as const, label: 'Shared', count: data?.sharedKeywords?.length ?? 0 },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                activeTab === tab.key
                  ? "bg-white/[0.06] text-white/90 shadow-sm"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              {tab.label}
              <span className={cn(
                "ml-1.5 text-xs font-[family-name:var(--font-mono)] tabular-nums",
                activeTab === tab.key ? "text-white/50" : "text-white/25"
              )}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>
        <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-border">
          <KeywordTable keywords={tabKeywords || []} />
        </div>
      </SubSection>

      {/* Quick Wins */}
      {data?.quickWins && data.quickWins.length > 0 && (
        <SubSection title="Quick Win Opportunities">
          <p className="text-sm text-white/40 mb-3">
            Low difficulty + decent volume — target these first for fast organic wins.
          </p>
          <div className="grid md:grid-cols-2 gap-2">
            {data.quickWins.slice(0, 8).map((kw, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/[0.12] flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm text-white/85">{kw.keyword}</p>
                  <p className="text-xs mt-0.5 text-white/40 font-[family-name:var(--font-mono)] tabular-nums">
                    {formatNumber(kw.searchVolume)} vol · ${kw.cpc.toFixed(2)} CPC
                  </p>
                </div>
                <Badge variant="outline" className={cn("text-xs", getDifficultyLabel(kw.difficulty).color)}>
                  {kw.difficulty}
                </Badge>
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* Long-Term Plays */}
      {data?.longTermPlays && data.longTermPlays.length > 0 && (
        <SubSection title="Long-Term Plays">
          <p className="text-sm text-white/40 mb-3">
            High-volume keywords with moderate-to-high difficulty — build authority over 3–6 months with pillar content.
          </p>
          <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-border">
            <KeywordTable keywords={data.longTermPlays} maxRows={10} />
          </div>
        </SubSection>
      )}

      {/* High-Intent Keywords */}
      {data?.highIntentKeywords && data.highIntentKeywords.length > 0 && (
        <SubSection title="High-Intent Keywords">
          <p className="text-sm text-white/40 mb-3">
            High CPC signals strong commercial intent — valuable for paid campaigns and conversion-focused content.
          </p>
          <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-border">
            <KeywordTable keywords={data.highIntentKeywords} maxRows={10} />
          </div>
        </SubSection>
      )}

      {/* Client Strengths */}
      {data?.clientStrengths && data.clientStrengths.length > 0 && (
        <SubSection title="Your Keyword Strengths">
          <p className="text-sm text-white/40 mb-3">
            Keywords you rank for that competitors don't — defend these positions and build on them.
          </p>
          <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-border">
            <KeywordTable keywords={data.clientStrengths} maxRows={10} />
          </div>
        </SubSection>
      )}

      {/* Related Expansions */}
      {data?.relatedExpansions && data.relatedExpansions.length > 0 && (
        <SubSection title="Related Keyword Expansions">
          <p className="text-sm text-white/40 mb-3">
            Thematic keyword opportunities beyond direct competitor gaps — expand your content footprint.
          </p>
          <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-border">
            <KeywordTable keywords={data.relatedExpansions} maxRows={10} />
          </div>
        </SubSection>
      )}

      {/* Content Topic Clusters */}
      {data?.contentTopicClusters && data.contentTopicClusters.length > 0 && (
        <SubSection title="Content Topic Clusters">
          <div className="grid md:grid-cols-2 gap-3">
            {data.contentTopicClusters.map((cluster, i) => (
              <div
                key={i}
                className="p-3.5 rounded-lg bg-primary/[0.03] border border-primary/[0.10]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-medium text-sm text-white/85 font-[family-name:var(--font-heading)]">
                    {isEditing && onFieldChange ? (
                      <EditableText
                        value={cluster.theme}
                        onSave={(v) => onFieldChange(`contentTopicClusters.${i}.theme`, v)}
                      />
                    ) : (
                      cluster.theme
                    )}
                  </h4>
                  {isEditing && onFieldChange ? (
                    <EditableText
                      value={cluster.recommendedFormat}
                      onSave={(v) => onFieldChange(`contentTopicClusters.${i}.recommendedFormat`, v)}
                      className="text-xs"
                    />
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs capitalize shrink-0 border-primary/[0.2] text-primary/60 bg-primary/[0.06]"
                    >
                      {cluster.recommendedFormat}
                    </Badge>
                  )}
                </div>
                <p className="text-xs mb-2.5 text-white/30 font-[family-name:var(--font-mono)] tabular-nums">
                  {formatNumber(cluster.searchVolumeTotal)} total volume
                </p>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={cluster.keywords}
                    onSave={(v) => onFieldChange(`contentTopicClusters.${i}.keywords`, v)}
                    className="text-xs"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.keywords.slice(0, 6).map((kw, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--bg-elevated)] border border-border text-white/55"
                      >
                        {kw}
                      </span>
                    ))}
                    {cluster.keywords.length > 6 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-white/[0.03] border border-white/[0.05] text-white/30">
                        +{cluster.keywords.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* Strategic Recommendations */}
      {data?.strategicRecommendations && (
        <SubSection title="Strategic Recommendations">
          <div className="grid md:grid-cols-2 gap-4">
            {data.strategicRecommendations.organicStrategy?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2.5 flex items-center gap-2 text-sm text-emerald-400/80">
                  <div className="flex size-5 items-center justify-center rounded-md bg-emerald-500/[0.1]">
                    <Search className="size-3 text-emerald-400/80" />
                  </div>
                  Organic Strategy
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={data.strategicRecommendations.organicStrategy}
                    onSave={(v) => onFieldChange("strategicRecommendations.organicStrategy", v)}
                    renderPrefix={() => <Search className="h-3 w-3 text-emerald-400/70" />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.strategicRecommendations.organicStrategy.map((item, i) => (
                      <ListItem key={i}>{item}</ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {data.strategicRecommendations.paidSearchStrategy?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2.5 flex items-center gap-2 text-sm text-primary/80">
                  <div className="flex size-5 items-center justify-center rounded-md bg-primary/[0.1]">
                    <DollarSign className="size-3 text-primary/80" />
                  </div>
                  Paid Search Strategy
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={data.strategicRecommendations.paidSearchStrategy}
                    onSave={(v) => onFieldChange("strategicRecommendations.paidSearchStrategy", v)}
                    renderPrefix={() => <DollarSign className="h-3 w-3 text-primary/70" />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.strategicRecommendations.paidSearchStrategy.map((item, i) => (
                      <ListItem key={i}>{item}</ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {data.strategicRecommendations.competitivePositioning?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2.5 flex items-center gap-2 text-sm text-white/70">
                  <div className="flex size-5 items-center justify-center rounded-md bg-primary/[0.08]">
                    <Target className="size-3 text-primary/70" />
                  </div>
                  Competitive Positioning
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={data.strategicRecommendations.competitivePositioning}
                    onSave={(v) => onFieldChange("strategicRecommendations.competitivePositioning", v)}
                    renderPrefix={() => <Target className="h-3 w-3 text-primary/70" />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.strategicRecommendations.competitivePositioning.map((item, i) => (
                      <ListItem key={i}>{item}</ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {data.strategicRecommendations.quickWinActions?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2.5 flex items-center gap-2 text-sm text-amber-400/80">
                  <div className="flex size-5 items-center justify-center rounded-md bg-amber-500/[0.1]">
                    <Zap className="size-3 text-amber-400/80" />
                  </div>
                  Quick Win Actions
                </h4>
                {isEditing && onFieldChange ? (
                  <EditableList
                    items={data.strategicRecommendations.quickWinActions}
                    onSave={(v) => onFieldChange("strategicRecommendations.quickWinActions", v)}
                    renderPrefix={() => <Zap className="h-3 w-3 text-amber-400/70" />}
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.strategicRecommendations.quickWinActions.map((item, i) => (
                      <ListItem key={i}>{item}</ListItem>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </SubSection>
      )}

      {/* Metadata */}
      {data?.metadata && (
        <div className="p-3 rounded-lg bg-[var(--bg-surface)] border border-border/60 text-xs text-white/25">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Client: {data.metadata.clientDomain}</span>
            <span>Competitors analyzed: {data.metadata.competitorDomainsAnalyzed.length}</span>
            <span>Keywords analyzed: {formatNumber(data.metadata.totalKeywordsAnalyzed)}</span>
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              SpyFu cost: ${data.metadata.spyfuCost.toFixed(4)}
            </span>
            {data.metadata.collectedAt && (
              <span>Collected: {new Date(data.metadata.collectedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
