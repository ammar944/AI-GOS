'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ResearchInlineCardProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  data?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  sourceCount?: number;
  onViewFull?: () => void;
  className?: string;
}

interface SectionMeta {
  label: string;
  moduleNumber: string;
}

const SECTION_META: Record<string, SectionMeta> = {
  industryMarket: { label: 'Market Overview', moduleNumber: '01' },
  competitors:    { label: 'Competitor Intel', moduleNumber: '02' },
  icpValidation:  { label: 'ICP Validation', moduleNumber: '03' },
  offerAnalysis:  { label: 'Offer Analysis', moduleNumber: '04' },
  crossAnalysis:  { label: 'Strategic Synthesis', moduleNumber: '05' },
};
const DEFAULT_META: SectionMeta = { label: 'Research', moduleNumber: '00' };

// Scanning phrases for loading state
const SCANNING_PHRASES: Record<string, string[]> = {
  industryMarket: [
    'Scanning market landscape...',
    'Pulling industry benchmarks...',
    'Analyzing pain points from G2 & Reddit...',
    'Mapping buying behaviors...',
    'Identifying demand drivers...',
  ],
  competitors: [
    'Scraping G2 reviews and pricing pages for direct competitors...',
    'Analyzing ad creative strategies...',
    'Running keyword intelligence...',
    'Scanning white-space gaps...',
  ],
  icpValidation: [
    'Validating audience targeting feasibility...',
    'Checking audience size estimates...',
    'Analyzing trigger events...',
  ],
  offerAnalysis: [
    'Benchmarking pricing models...',
    'Scanning offer clarity signals...',
    'Checking red flags...',
  ],
  crossAnalysis: [
    'Synthesizing research findings...',
    'Identifying positioning gaps...',
    'Drafting strategic recommendations...',
  ],
};
const DEFAULT_PHRASES = ['Analyzing...', 'Researching...', 'Processing...'];

function extractTopMetrics(section: string, data?: Record<string, unknown>): { key: string; value: string }[] {
  if (!data) return [];
  try {
    if (section === 'industryMarket') {
      const snap = data.categorySnapshot as Record<string, unknown> | undefined;
      return [
        snap?.marketSize ? { key: 'Market Size', value: String(snap.marketSize) } : null,
        snap?.marketMaturity ? { key: 'Maturity', value: String(snap.marketMaturity) } : null,
        snap?.category ? { key: 'Category', value: String(snap.category) } : null,
      ].filter(Boolean) as { key: string; value: string }[];
    }
    if (section === 'competitors') {
      const comps = Array.isArray(data.competitors) ? data.competitors : [];
      return [
        { key: 'Competitors', value: `${comps.length} identified` },
      ];
    }
    if (section === 'icpValidation') {
      const verdict = data.finalVerdict as Record<string, unknown> | undefined;
      return verdict?.status ? [{ key: 'Verdict', value: String(verdict.status) }] : [];
    }
    if (section === 'offerAnalysis') {
      const score = (data.offerStrength as Record<string, unknown>)?.overallScore ?? data.overallScore;
      return score !== undefined ? [{ key: 'Score', value: String(score) }] : [];
    }
  } catch { /* data shapes vary */ }
  return [];
}

function extractDescription(section: string, data?: Record<string, unknown>): string | null {
  if (!data) return null;
  try {
    if (section === 'industryMarket') {
      const snap = data.categorySnapshot as Record<string, unknown> | undefined;
      if (snap?.category) {
        const size = snap.marketSize ? ` (${snap.marketSize})` : '';
        return `Market overview complete for the ${snap.category} vertical${size}.`;
      }
    }
    if (section === 'competitors') {
      const comps = Array.isArray(data.competitors) ? data.competitors : [];
      return comps.length > 0
        ? `${comps.length} competitor${comps.length !== 1 ? 's' : ''} analyzed across ad creatives, pricing, and positioning.`
        : null;
    }
  } catch { /* safe */ }
  return null;
}

function useAnimatedPhrase(phrases: string[]) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % phrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phrases]);
  return phrases[idx];
}

// ─── Loading Card (Active research in progress) ─────────────────────────────

function LoadingCard({ meta, section }: { meta: SectionMeta; section: string }) {
  const phrases = SCANNING_PHRASES[section] ?? DEFAULT_PHRASES;
  const phrase = useAnimatedPhrase(phrases);

  return (
    <div className="glass-surface p-6 rounded-[24px] border-brand-accent/30 bg-brand-accent/[0.01]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-brand-accent uppercase tracking-tighter">
          Module {meta.moduleNumber}
        </span>
        {/* Animated dots */}
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" />
          <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" style={{ animationDelay: '75ms' }} />
          <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" style={{ animationDelay: '150ms' }} />
        </div>
      </div>
      <h3 className="text-lg font-medium mb-2 text-brand-accent">{meta.label}</h3>
      <p className="text-sm text-white/70 leading-relaxed">{phrase}</p>
      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="bg-brand-accent h-full"
          initial={{ width: '5%' }}
          animate={{ width: '65%' }}
          transition={{ duration: 30, ease: 'linear' }}
        />
      </div>
    </div>
  );
}

// ─── Complete Card (Research done with metrics) ─────────────────────────────

function CompleteCard({
  meta,
  data,
  section,
  onViewFull,
}: {
  meta: SectionMeta;
  data?: Record<string, unknown>;
  section: string;
  onViewFull?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const metrics = extractTopMetrics(section, data);
  const description = extractDescription(section, data);

  return (
    <div className="glass-surface p-6 rounded-[24px] relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-white/40 uppercase tracking-tighter">
          Module {meta.moduleNumber}
        </span>
        {/* Green completed dot */}
        <div className="w-2 h-2 rounded-full bg-brand-success shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
      </div>
      <h3 className="text-lg font-medium mb-2">{meta.label}</h3>
      {description && (
        <p className="text-sm text-white/50 leading-relaxed mb-4">{description}</p>
      )}
      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="space-y-1 text-[11px] font-mono text-white/30">
          {metrics.map((m) => (
            <div key={m.key} className="flex justify-between">
              <span>{m.key}:</span>
              <span>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expandable full data */}
      {onViewFull && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[11px] text-brand-accent/70 hover:text-brand-accent transition-colors flex items-center gap-1"
        >
          {expanded ? 'Hide details' : 'View full analysis'}
          <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}

      <AnimatePresence>
        {expanded && onViewFull && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/5">
              <button
                onClick={onViewFull}
                className="w-full py-2 text-[11px] text-brand-accent border border-brand-accent/20 rounded-lg hover:bg-brand-accent/5 transition-colors"
              >
                Open full analysis →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Error Card ─────────────────────────────────────────────────────────────

function ErrorCard({ meta, error }: { meta: SectionMeta; error?: string }) {
  return (
    <div className="glass-surface p-6 rounded-[24px] border-red-500/20">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-red-400/60 uppercase tracking-tighter">
          Module {meta.moduleNumber}
        </span>
        <div className="w-2 h-2 rounded-full bg-red-500" />
      </div>
      <h3 className="text-lg font-medium mb-2 text-red-400">{meta.label} — Failed</h3>
      {error && (
        <p className="text-sm text-white/40 leading-relaxed">{error}</p>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function ResearchInlineCard({
  section,
  status,
  data,
  error,
  durationMs: _durationMs,
  sourceCount: _sourceCount,
  onViewFull,
  className,
}: ResearchInlineCardProps) {
  const meta = SECTION_META[section] ?? DEFAULT_META;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.25 }}
      className={cn('w-full', className)}
    >
      {status === 'loading'  && <LoadingCard meta={meta} section={section} />}
      {status === 'complete' && <CompleteCard meta={meta} data={data} section={section} onViewFull={onViewFull} />}
      {status === 'error'    && <ErrorCard meta={meta} error={error} />}
    </motion.div>
  );
}
