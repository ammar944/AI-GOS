'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import Image from 'next/image';
import { analyzeCompetitorAds, checkForeplayStatus, type AdsCompetitorResult, type AnalyzeOptions } from './actions';
import type { EnrichedAdCreative } from '@/lib/foreplay/types';

type FormatFilter = 'all' | 'video' | 'image';
type PlatformFilter = 'all' | 'linkedin' | 'meta' | 'google';
type SourceFilter = 'all' | 'enriched' | 'foreplay-sourced';

// Platform color schemes
const platformColors = {
  linkedin: {
    bg: 'bg-[#0A66C2]/10',
    border: 'border-[#0A66C2]/30',
    text: 'text-[#0A66C2]',
    accent: '#0A66C2',
  },
  meta: {
    bg: 'bg-gradient-to-br from-[#0668E1]/10 via-[#833AB4]/10 to-[#F77737]/10',
    border: 'border-[#833AB4]/30',
    text: 'text-[#833AB4]',
    accent: '#833AB4',
  },
  google: {
    bg: 'bg-gradient-to-br from-[#4285F4]/10 via-[#34A853]/10 to-[#FBBC05]/10',
    border: 'border-[#4285F4]/30',
    text: 'text-[#4285F4]',
    accent: '#4285F4',
  },
};

export default function AdsCompetitorTestPage() {
  const [domain, setDomain] = useState('');
  const [enableForeplayEnrichment, setEnableForeplayEnrichment] = useState(true);
  const [includeForeplayAsSource, setIncludeForeplayAsSource] = useState(false);
  const [result, setResult] = useState<AdsCompetitorResult | null>(null);
  const [foreplayStatus, setForeplayStatus] = useState<{
    enabled: boolean;
    configured: boolean;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDebug, setShowDebug] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Filter ads based on selected filters
  const filteredAds = result?.data?.ads.filter(ad => {
    const matchesFormat = formatFilter === 'all' || ad.format === formatFilter;
    const matchesPlatform = platformFilter === 'all' || ad.platform === platformFilter;
    const matchesSource = sourceFilter === 'all'
      || (sourceFilter === 'enriched' && !!ad.foreplay)
      || (sourceFilter === 'foreplay-sourced' && ad.source === 'foreplay');
    return matchesFormat && matchesPlatform && matchesSource;
  }) ?? [];

  // Check Foreplay status on mount
  useEffect(() => {
    checkForeplayStatus().then(setForeplayStatus);
  }, []);

  const handleAnalyze = () => {
    if (!domain.trim()) return;
    startTransition(async () => {
      const options: AnalyzeOptions = {
        enableForeplayEnrichment,
        includeForeplayAsSource,
      };
      const analysisResult = await analyzeCompetitorAds(domain, options);
      setResult(analysisResult);
    });
  };

  // Platform counts
  const platformCounts = {
    linkedin: result?.data?.ads.filter(a => a.platform === 'linkedin').length ?? 0,
    meta: result?.data?.ads.filter(a => a.platform === 'meta').length ?? 0,
    google: result?.data?.ads.filter(a => a.platform === 'google').length ?? 0,
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] relative overflow-hidden">
      {/* Mesh gradient background */}
      <div className="sl-shader-background" />
      <div className="sl-bg-pattern" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 lg:px-8">

        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-1 rounded-full bg-gradient-to-b from-[var(--accent-blue)] to-[var(--accent-cyan)]" />
            <span className="text-[var(--accent-blue)] text-sm font-medium tracking-widest uppercase">
              Competitive Intelligence
            </span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-semibold text-[var(--text-heading)] tracking-tight mb-3">
            Ad Library Explorer
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl">
            Discover what your competitors are running across LinkedIn, Meta, and Google.
            Enriched with Foreplay intelligence for deeper creative insights.
          </p>
        </header>

        {/* Search Section */}
        <section className="mb-12">
          <div className="glass rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter competitor domain (e.g. huel.com, hubspot, salesforce)"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="w-full h-14 pl-12 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-line)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 transition-all text-lg"
                />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isPending || !domain.trim()}
                className="h-14 px-8 rounded-xl font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)',
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isPending ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Analyze Ads
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </div>

            {/* Options row */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Foreplay enrichment toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={enableForeplayEnrichment}
                      onChange={(e) => setEnableForeplayEnrichment(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 rounded-full bg-[var(--bg-hover)] peer-checked:bg-[var(--accent-blue)] transition-colors" />
                    <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                  </div>
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    Enrich with Foreplay (transcripts, hooks)
                  </span>
                </label>

                {/* Foreplay as source toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={includeForeplayAsSource}
                      onChange={(e) => setIncludeForeplayAsSource(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 rounded-full bg-[var(--bg-hover)] peer-checked:bg-[var(--accent-cyan)] transition-colors" />
                    <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                  </div>
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    Include Foreplay ads (unique historical ads)
                  </span>
                </label>
              </div>

              {/* Foreplay status indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  foreplayStatus?.configured && foreplayStatus?.enabled
                    ? 'bg-[var(--success)] animate-pulse'
                    : 'bg-[var(--text-tertiary)]'
                }`} />
                <span className="text-xs text-[var(--text-tertiary)]">
                  {foreplayStatus?.configured && foreplayStatus?.enabled
                    ? 'Foreplay connected'
                    : foreplayStatus?.message ?? 'Checking...'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        {result && (
          <div className="space-y-8 animate-in fade-in duration-500">

            {/* Stats Bar */}
            {result.success && result.data && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  label="Total Ads"
                  value={result.data.ads.length}
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="7" height="9" rx="1" />
                      <rect x="14" y="3" width="7" height="5" rx="1" />
                      <rect x="14" y="12" width="7" height="9" rx="1" />
                      <rect x="3" y="16" width="7" height="5" rx="1" />
                    </svg>
                  }
                />
                <StatCard
                  label="Enriched"
                  value={result.data.metadata.foreplay?.enriched_count ?? 0}
                  suffix={`/ ${result.data.ads.filter(a => a.source !== 'foreplay').length}`}
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="m2 17 10 5 10-5" />
                      <path d="m2 12 10 5 10-5" />
                    </svg>
                  }
                />
                <StatCard
                  label="Foreplay Sourced"
                  value={result.data.metadata.foreplay_source?.unique_ads ?? 0}
                  suffix={result.data.metadata.foreplay_source ? ` unique` : ''}
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m8 12 3 3 5-6" />
                    </svg>
                  }
                  highlight={!!result.data.metadata.foreplay_source?.unique_ads}
                />
                <StatCard
                  label="Duration"
                  value={(result.duration_ms / 1000).toFixed(1)}
                  suffix="s"
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  }
                />
                <StatCard
                  label="Est. Cost"
                  value={result.data.costs?.total.toFixed(3) ?? '0.00'}
                  prefix="$"
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  }
                />
              </div>
            )}

            {/* Error state */}
            {result.error && (
              <div className="glass rounded-2xl p-6 border border-[var(--error)]/30 bg-[var(--error)]/5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--error)]/20 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[var(--error)] font-medium mb-1">Analysis Failed</h3>
                    <p className="text-[var(--text-secondary)]">{result.error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Platform breakdown + Filters */}
            {result.success && result.data && result.data.ads.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Platform pills */}
                  <div className="flex flex-wrap gap-3">
                    <PlatformPill
                      platform="linkedin"
                      count={platformCounts.linkedin}
                      active={platformFilter === 'linkedin'}
                      onClick={() => setPlatformFilter(platformFilter === 'linkedin' ? 'all' : 'linkedin')}
                    />
                    <PlatformPill
                      platform="meta"
                      count={platformCounts.meta}
                      active={platformFilter === 'meta'}
                      onClick={() => setPlatformFilter(platformFilter === 'meta' ? 'all' : 'meta')}
                    />
                    <PlatformPill
                      platform="google"
                      count={platformCounts.google}
                      active={platformFilter === 'google'}
                      onClick={() => setPlatformFilter(platformFilter === 'google' ? 'all' : 'google')}
                    />
                  </div>

                  {/* Format filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-tertiary)] mr-2">Format:</span>
                    {(['all', 'video', 'image'] as FormatFilter[]).map((format) => (
                      <button
                        key={format}
                        onClick={() => setFormatFilter(format)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          formatFilter === format
                            ? 'bg-[var(--accent-blue)] text-white'
                            : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {format === 'all' ? 'All' : format === 'video' ? '▶ Video' : '◻ Image'}
                      </button>
                    ))}
                  </div>

                  {/* Source filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-tertiary)] mr-2">Source:</span>
                    {([
                      { key: 'all', label: 'All' },
                      { key: 'enriched', label: 'Enriched' },
                      { key: 'foreplay-sourced', label: 'Foreplay' },
                    ] as { key: SourceFilter; label: string }[]).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setSourceFilter(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          sourceFilter === key
                            ? key === 'foreplay-sourced'
                              ? 'bg-[var(--accent-cyan)] text-white'
                              : 'bg-[var(--accent-blue)] text-white'
                            : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Ads Grid */}
            {result.success && result.data && (
              <>
                {filteredAds.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredAds.map((ad, index) => (
                      <AdCard key={ad.id || index} ad={ad} index={index} />
                    ))}
                  </div>
                ) : result.data.ads.length > 0 ? (
                  <div className="glass rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                        <path d="M3 3h18v18H3z" />
                        <path d="m9 15 3-3 3 3" />
                        <circle cx="9" cy="9" r="1" />
                      </svg>
                    </div>
                    <p className="text-[var(--text-secondary)]">No ads match the selected filters</p>
                    <button
                      onClick={() => { setFormatFilter('all'); setPlatformFilter('all'); setSourceFilter('all'); }}
                      className="mt-4 text-[var(--accent-blue)] text-sm hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-12 text-center">
                    <p className="text-[var(--text-secondary)]">No ads found for this domain</p>
                  </div>
                )}
              </>
            )}

            {/* Debug section - collapsible */}
            {result.debug && (
              <div className="glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <span className="text-sm font-medium text-[var(--text-tertiary)]">Debug Information</span>
                  <svg
                    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-[var(--text-tertiary)] transition-transform ${showDebug ? 'rotate-180' : ''}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {showDebug && (
                  <div className="px-6 pb-6 space-y-4 border-t border-[var(--border-subtle)]">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                      <div>
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Search Query</p>
                        <p className="font-mono text-sm text-[var(--text-primary)]">{result.debug.searchQuery}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Domain</p>
                        <p className="font-mono text-sm text-[var(--text-primary)]">{result.debug.searchDomain}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Foreplay Configured</p>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          result.debug.foreplayConfigured
                            ? 'bg-[var(--success)]/20 text-[var(--success)]'
                            : 'bg-[var(--error)]/20 text-[var(--error)]'
                        }`}>
                          {result.debug.foreplayConfigured ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Foreplay Enabled</p>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          result.debug.foreplayEnabled
                            ? 'bg-[var(--success)]/20 text-[var(--success)]'
                            : 'bg-[var(--error)]/20 text-[var(--error)]'
                        }`}>
                          {result.debug.foreplayEnabled ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                    {result.data?.metadata.foreplay?.error && (
                      <div className="p-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/20">
                        <p className="text-sm text-[var(--error)]">
                          Foreplay Error: {result.data.metadata.foreplay.error}
                        </p>
                      </div>
                    )}
                    {result.data?.metadata.foreplay && (
                      <div className="p-4 rounded-lg bg-[var(--bg-elevated)]">
                        <p className="text-xs text-[var(--text-tertiary)] mb-2">Foreplay Enrichment</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-[var(--text-tertiary)]">Enriched:</span>{' '}
                            <span className="text-[var(--text-primary)]">{result.data.metadata.foreplay.enriched_count ?? 0} ads</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)]">Credits:</span>{' '}
                            <span className="text-[var(--text-primary)]">{result.data.metadata.foreplay.credits_used ?? 0}</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)]">Duration:</span>{' '}
                            <span className="text-[var(--text-primary)]">{result.data.metadata.foreplay.duration_ms ?? 0}ms</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {result.data?.metadata.foreplay_source && (
                      <div className="p-4 rounded-lg bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/20">
                        <p className="text-xs text-[var(--accent-cyan)] mb-2">Foreplay as Source</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-[var(--text-tertiary)]">Total fetched:</span>{' '}
                            <span className="text-[var(--text-primary)]">{result.data.metadata.foreplay_source.total_ads} ads</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)]">Unique ads:</span>{' '}
                            <span className="text-[var(--accent-cyan)]">{result.data.metadata.foreplay_source.unique_ads} ads</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)]">Duration:</span>{' '}
                            <span className="text-[var(--text-primary)]">{result.data.metadata.foreplay_source.duration_ms ?? 0}ms</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  value,
  prefix,
  suffix,
  icon,
  highlight
}: {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`glass rounded-xl p-5 group transition-colors ${
      highlight
        ? 'border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/5'
        : 'hover:border-[var(--accent-blue)]/30'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
        <div className={`transition-colors ${
          highlight
            ? 'text-[var(--accent-cyan)]'
            : 'text-[var(--text-tertiary)] group-hover:text-[var(--accent-blue)]'
        }`}>
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-semibold ${
        highlight ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-heading)]'
      }`}>
        {prefix}<span className="tabular-nums">{value}</span><span className="text-lg text-[var(--text-tertiary)]">{suffix}</span>
      </div>
    </div>
  );
}

// Platform pill component
function PlatformPill({
  platform,
  count,
  active,
  onClick
}: {
  platform: 'linkedin' | 'meta' | 'google';
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const icons = {
    linkedin: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    meta: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
      </svg>
    ),
    google: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  };

  const labels = {
    linkedin: 'LinkedIn',
    meta: 'Meta',
    google: 'Google',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
        active
          ? `${platformColors[platform].bg} ${platformColors[platform].border} ${platformColors[platform].text}`
          : 'bg-[var(--bg-elevated)] border-[var(--border-line)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
      }`}
    >
      <span className={active ? platformColors[platform].text : 'text-[var(--text-tertiary)]'}>
        {icons[platform]}
      </span>
      <span className="font-medium">{labels[platform]}</span>
      <span className={`px-2 py-0.5 rounded-md text-sm ${
        active
          ? 'bg-white/20'
          : 'bg-[var(--bg-hover)]'
      }`}>
        {count}
      </span>
    </button>
  );
}

// Smart image component that handles external ad images with proper fallbacks
function AdImage({
  src,
  alt,
  platform,
  onError,
}: {
  src: string;
  alt: string;
  platform: string;
  onError: () => void;
}) {
  const [fallbackLevel, setFallbackLevel] = useState(0);
  // 0 = Next.js Image, 1 = native img with no-referrer, 2 = proxy, 3 = failed

  // Check if URL should use proxy (some CDNs blocked by browsers)
  const shouldUseProxy = (url: string) => {
    const proxyDomains = [
      'googlesyndication.com',
      'storage.googleapis.com',
      'firebasestorage.googleapis.com',
    ];
    return proxyDomains.some(d => url.includes(d));
  };

  const getProxyUrl = (url: string) => {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  };

  // Handle Next.js Image error - fallback to native img
  const handleNextImageError = () => {
    console.warn(`[AdImage] Next.js Image failed (level 0), trying native img:`, src);
    setFallbackLevel(1);
  };

  // Handle native img error - try proxy
  const handleNativeError = () => {
    if (shouldUseProxy(src)) {
      console.warn(`[AdImage] Native img failed (level 1), trying proxy:`, src);
      setFallbackLevel(2);
    } else {
      console.error(`[AdImage] Native img failed, no proxy available:`, src);
      setFallbackLevel(3);
      onError();
    }
  };

  // Handle proxy error
  const handleProxyError = () => {
    console.error(`[AdImage] Proxy also failed:`, src);
    setFallbackLevel(3);
    onError();
  };

  // All fallbacks exhausted
  if (fallbackLevel >= 3) {
    return null;
  }

  // Level 2: Use proxy for Google images
  if (fallbackLevel === 2) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={getProxyUrl(src)}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        onError={handleProxyError}
      />
    );
  }

  // Level 1: Try native img with no-referrer
  if (fallbackLevel === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        referrerPolicy="no-referrer"
        onError={handleNativeError}
      />
    );
  }

  // Level 0: Use Next.js Image with unoptimized for external URLs
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover transition-transform duration-500 group-hover:scale-105"
      unoptimized
      onError={handleNextImageError}
    />
  );
}

// Ad card component
function AdCard({ ad, index }: { ad: EnrichedAdCreative; index: number }) {
  const hasEnrichment = !!ad.foreplay;
  const [showDetails, setShowDetails] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const colors = platformColors[ad.platform as keyof typeof platformColors] || platformColors.google;

  const hasVideo = ad.format === 'video' && ad.videoUrl;
  const hasImage = ad.imageUrl;
  const showMedia = !mediaError && (hasVideo || hasImage);

  return (
    <div
      className={`group rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-1 ${
        hasEnrichment
          ? 'bg-[var(--bg-card-blue)] border-[var(--accent-blue)]/20'
          : 'bg-[var(--bg-card)] border-[var(--border-line)]'
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Media */}
      <div className="relative aspect-video bg-[var(--bg-elevated)] overflow-hidden">
        {showMedia ? (
          hasVideo ? (
            <video
              src={ad.videoUrl}
              poster={ad.imageUrl}
              controls
              preload="metadata"
              className="h-full w-full object-contain bg-black"
              onError={() => setMediaError(true)}
            >
              <source src={ad.videoUrl} type="video/mp4" />
            </video>
          ) : hasImage ? (
            <AdImage
              src={ad.imageUrl!}
              alt={ad.headline || 'Ad creative'}
              platform={ad.platform}
              onError={() => setMediaError(true)}
            />
          ) : null
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-quaternary)" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Platform badge */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-medium backdrop-blur-md ${colors.bg} ${colors.text} border ${colors.border}`}>
          {ad.platform.charAt(0).toUpperCase() + ad.platform.slice(1)}
        </div>

        {/* Format badge */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {/* Source badge for Foreplay-sourced ads */}
          {ad.source === 'foreplay' && (
            <div className="px-2.5 py-1 rounded-lg text-xs font-medium backdrop-blur-md bg-[var(--accent-cyan)]/80 text-white">
              Foreplay
            </div>
          )}
          <div className="px-2.5 py-1 rounded-lg text-xs font-medium backdrop-blur-md bg-black/50 text-white">
            {ad.format === 'video' ? '▶ Video' : '◻ Image'}
          </div>
        </div>

        {/* Enriched indicator */}
        {hasEnrichment && (
          <div className="absolute bottom-3 right-3 w-8 h-8 rounded-lg bg-[var(--accent-blue)] flex items-center justify-center" title="Foreplay Enriched">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="m2 17 10 5 10-5" />
              <path d="m2 12 10 5 10-5" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Advertiser */}
        <p className="text-sm font-medium text-[var(--text-tertiary)]">{ad.advertiser}</p>

        {/* Headline */}
        {ad.headline && (
          <p className="font-medium text-[var(--text-heading)] line-clamp-2 leading-snug">{ad.headline}</p>
        )}

        {/* Body */}
        {ad.body && (
          <p className="text-sm text-[var(--text-secondary)] line-clamp-3">{ad.body}</p>
        )}

        {/* Foreplay section */}
        {hasEnrichment && (
          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-[var(--accent-blue)] text-sm font-medium hover:underline"
            >
              <span className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="m2 17 10 5 10-5" />
                  <path d="m2 12 10 5 10-5" />
                </svg>
                Foreplay Intelligence
              </span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {showDetails && (
              <div className="mt-4 space-y-3 text-sm animate-in slide-in-from-top-2 duration-200">
                {ad.foreplay?.hook && (
                  <div className="p-3 rounded-lg bg-[var(--bg-elevated)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Hook</p>
                    <p className="text-[var(--text-primary)] italic">&ldquo;{ad.foreplay.hook.text}&rdquo;</p>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] text-xs">
                        {ad.foreplay.hook.type}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-tertiary)] text-xs">
                        {ad.foreplay.hook.duration}s
                      </span>
                    </div>
                  </div>
                )}

                {ad.foreplay?.emotional_tone && ad.foreplay.emotional_tone.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] mb-2">Emotional Tone</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ad.foreplay.emotional_tone.map((tone, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] text-xs">
                          {tone}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {ad.foreplay?.transcript && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Transcript</p>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-4 bg-[var(--bg-elevated)] p-2 rounded">
                      {ad.foreplay.transcript}
                    </p>
                  </div>
                )}

                {ad.foreplay?.match_confidence && (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Match confidence: {(ad.foreplay.match_confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dates */}
        {(ad.firstSeen || ad.lastSeen) && (
          <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
            {ad.firstSeen && <span>First: {formatDate(ad.firstSeen)}</span>}
            {ad.lastSeen && <span>Last: {formatDate(ad.lastSeen)}</span>}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {ad.detailsUrl && (
            <a
              href={ad.detailsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-colors text-sm font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {ad.source === 'foreplay'
                ? (ad.detailsUrl?.includes('facebook.com/ads/library')
                    ? 'Meta Ad Library'
                    : ad.detailsUrl?.includes('ads.tiktok.com')
                      ? 'TikTok Ads'
                      : 'Landing Page')
                : 'View Ad'}
            </a>
          )}
          {ad.videoUrl && (
            <a
              href={ad.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-colors"
              title="Open video"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </a>
          )}
          {/* Open image button for image ads */}
          {ad.imageUrl && ad.format !== 'video' && (
            <a
              href={ad.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-colors"
              title="Open image"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </a>
          )}
          {/* Landing page button for Foreplay ads (when separate from ad library link) */}
          {ad.source === 'foreplay' && ad.foreplay?.landing_page_url && ad.detailsUrl !== ad.foreplay.landing_page_url && (
            <a
              href={ad.foreplay.landing_page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-colors"
              title="Open landing page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  } catch {
    return dateStr;
  }
}
