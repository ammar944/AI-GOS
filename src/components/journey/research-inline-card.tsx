'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Users, Target, Package, Layers, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
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

interface SectionMeta { label: string; icon: typeof Globe; color: string }

const SECTION_META: Record<string, SectionMeta> = {
  industryMarket: { label: 'Industry & Market Research', icon: Globe, color: 'var(--accent-blue)' },
  competitors:    { label: 'Competitor Analysis',        icon: Users,   color: 'var(--accent-purple, #a855f7)' },
  icpValidation:  { label: 'ICP Validation',             icon: Target,  color: 'var(--accent-cyan, #06b6d4)' },
  offerAnalysis:  { label: 'Offer Analysis',             icon: Package, color: 'var(--accent-green, #22c55e)' },
  crossAnalysis:  { label: 'Strategic Synthesis',        icon: Layers,  color: '#f59e0b' },
};
const DEFAULT_META: SectionMeta = { label: 'Research', icon: Globe, color: 'var(--accent-blue)' };

// Per-section scanning phrases shown during loading — give realistic "working" feel
const SCANNING_PHRASES: Record<string, string[]> = {
  industryMarket: [
    'Scanning market landscape...',
    'Pulling industry benchmarks...',
    'Analyzing pain points from G2 & Reddit...',
    'Mapping buying behaviors...',
    'Identifying demand drivers...',
    'Checking seasonal patterns...',
  ],
  competitors: [
    'Identifying top competitors...',
    'Analyzing ad creative strategies...',
    'Running keyword intelligence...',
    'Benchmarking landing pages...',
    'Mapping funnel structures...',
    'Scanning white-space gaps...',
  ],
  icpValidation: [
    'Validating audience targeting feasibility...',
    'Checking audience size estimates...',
    'Analyzing trigger events...',
    'Assessing ICP-product fit...',
    'Scoring risk signals...',
  ],
  offerAnalysis: [
    'Benchmarking pricing models...',
    'Scanning offer clarity signals...',
    'Checking red flags...',
    'Comparing market positioning...',
    'Scoring offer strength...',
  ],
  crossAnalysis: [
    'Synthesizing research findings...',
    'Identifying positioning gaps...',
    'Mapping platform opportunities...',
    'Drafting strategic recommendations...',
    'Building ad hook frameworks...',
  ],
};
const DEFAULT_PHRASES = ['Analyzing...', 'Researching...', 'Processing...'];

const DOT_COLORS = ['var(--accent-blue)', 'var(--section-keyword)', 'var(--status-success)', 'var(--section-offer)', 'var(--section-competitor)'];

const CARD_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '10px',
  background: 'var(--bg-hover)',
  border: '1px solid var(--border-subtle)',
};

function extractTopFindings(section: string, data?: Record<string, unknown>): string[] {
  if (!data) return [];
  try {
    const get = <T,>(obj: unknown, key: string) => (obj as Record<string, T> | undefined)?.[key];
    const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
    const str = (v: unknown): string => (typeof v === 'string' ? v : (get<string>(v, 'point') ?? get<string>(v, 'insight') ?? get<string>(v, 'name') ?? ''));

    if (section === 'industryMarket') {
      const snap = get<Record<string, unknown>>(data, 'categorySnapshot');
      const pts = arr(get(data, 'painPoints') ? get<Record<string, unknown>>(data, 'painPoints')?.primary : undefined);
      return [
        snap?.category ? `Category: ${snap.category}` : '',
        data.marketMaturity ? `Market maturity: ${data.marketMaturity}` : '',
        ...pts.slice(0, 2).map(str),
      ].filter(Boolean).slice(0, 5);
    }
    if (section === 'competitors') {
      const comps = arr(data.competitors);
      const gaps = arr(data.whiteSpaceGaps);
      return [
        comps.length ? `${comps.length} competitor${comps.length !== 1 ? 's' : ''} identified` : '',
        ...comps.slice(0, 2).map((c) => { const n = get<string>(c, 'name'); const p = get<string>(c, 'positioning'); return n ? (p ? `${n}: ${p}` : n) : ''; }),
        gaps.length ? `${gaps.length} white-space gap${gaps.length !== 1 ? 's' : ''} found` : '',
      ].filter(Boolean).slice(0, 5);
    }
    if (section === 'icpValidation') {
      const verdict = get<Record<string, unknown>>(data, 'finalVerdict');
      const fit = get<Record<string, unknown>>(data, 'painSolutionFit');
      const hr = data.highRiskCount as number | undefined;
      return [
        verdict?.status ? `Verdict: ${verdict.status}` : '',
        fit?.primaryPain ? `Primary pain: ${fit.primaryPain}` : '',
        (data.fitAssessment as string | undefined) ?? '',
        typeof hr === 'number' ? (hr > 0 ? `${hr} high-risk signal${hr !== 1 ? 's' : ''}` : 'No high-risk signals') : '',
      ].filter(Boolean).slice(0, 5);
    }
    if (section === 'offerAnalysis') {
      const strength = get<Record<string, unknown>>(data, 'offerStrength');
      const score = strength?.overallScore ?? data.overallScore;
      const rfArr = arr(data.redFlags);
      const count = typeof data.redFlagCount === 'number' ? data.redFlagCount : rfArr.length;
      return [
        score !== undefined ? `Offer score: ${score}` : '',
        (data.recommendationStatus as string | undefined) ?? (data.recommendation as string | undefined) ?? '',
        count > 0 ? `${count} red flag${count !== 1 ? 's' : ''}` : 'No red flags',
      ].filter(Boolean).slice(0, 5);
    }
    if (section === 'crossAnalysis') {
      const insights = arr(data.keyInsights).slice(0, 3).map(str).filter(Boolean);
      const platforms = arr(data.recommendedPlatforms).slice(0, 3).map(str).filter(Boolean);
      return [...insights, platforms.length ? `Platforms: ${platforms.join(', ')}` : ''].filter(Boolean).slice(0, 5);
    }
  } catch { /* research data shapes vary — never crash */ }
  return [];
}

function useAnimatedPhrase(phrases: string[]) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % phrases.length);
        setVisible(true);
      }, 300);
    }, 2800);
    return () => clearInterval(interval);
  }, [phrases]);

  return { phrase: phrases[idx], visible };
}

function LoadingCard({ meta, section }: { meta: SectionMeta; section: string }) {
  const Icon = meta.icon;
  const iconBg = meta.color.startsWith('var(')
    ? `color-mix(in srgb, ${meta.color} 12%, transparent)`
    : `${meta.color}1f`;
  const phrases = SCANNING_PHRASES[section] ?? DEFAULT_PHRASES;
  const { phrase, visible } = useAnimatedPhrase(phrases);

  return (
    <div style={CARD_STYLE} role="status" aria-label={`Researching ${meta.label}`}>
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0 flex items-center justify-center rounded-md" style={{ width: 24, height: 24, background: iconBg }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Icon style={{ width: 13, height: 13, color: meta.color }} />
          </motion.div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium leading-tight truncate" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {meta.label}
          </p>
          <motion.p
            key={phrase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="truncate mt-0.5"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)', minHeight: '16px' }}
          >
            {phrase}
          </motion.p>
        </div>
        <motion.span
          className="flex-shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: meta.color }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}

function CompleteCard({
  meta,
  findings,
  durationMs,
  sourceCount,
  onViewFull,
}: {
  meta: SectionMeta;
  findings: string[];
  durationMs?: number;
  sourceCount?: number;
  onViewFull?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = meta.icon;
  const durationLabel = durationMs !== undefined ? (durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`) : null;

  return (
    <div style={{ ...CARD_STYLE, padding: 0 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        disabled={findings.length === 0}
        aria-expanded={expanded}
        className={cn(
          'w-full flex items-center gap-2.5 text-left outline-none rounded-[10px] focus-ring',
          'focus-visible:ring-2 focus-visible:ring-offset-1',
          findings.length > 0 ? 'cursor-pointer' : 'cursor-default',
        )}
        style={{ padding: '10px 12px', background: 'transparent', border: 'none', '--tw-ring-color': 'var(--accent-blue)', '--tw-ring-offset-color': 'var(--bg-base)' } as React.CSSProperties}
      >
        <CheckCircle2 className="flex-shrink-0" style={{ width: 14, height: 14, color: 'var(--status-success, #22c55e)' }} />
        <p className="flex-1 min-w-0 font-medium leading-tight truncate" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {meta.label}
        </p>
        <Icon className="flex-shrink-0" style={{ width: 12, height: 12, color: meta.color, opacity: 0.7 }} />
        {durationLabel && <span style={{ fontSize: '11px', color: 'var(--text-quaternary)', flexShrink: 0 }}>{durationLabel}</span>}
        {findings.length > 0 && (
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }} className="flex-shrink-0">
            <ChevronDown style={{ width: 12, height: 12, color: 'var(--text-quaternary)' }} />
          </motion.div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && findings.length > 0 && (
          <motion.div
            key="findings"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--border-subtle)' }}>
              <ul className="space-y-1.5">
                {findings.map((finding, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 rounded-full mt-1" style={{ width: 5, height: 5, background: DOT_COLORS[i % DOT_COLORS.length] }} />
                    <span className="leading-snug" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{finding}</span>
                  </li>
                ))}
              </ul>
              {sourceCount !== undefined && (
                <p className="mt-2" style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}>
                  {sourceCount} source{sourceCount !== 1 ? 's' : ''} referenced
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {onViewFull && (
        <div style={{ padding: '0 12px 10px', marginTop: findings.length > 0 ? 0 : 4 }}>
          <button
            onClick={onViewFull}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--accent-blue)',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--accent-blue) 8%, transparent)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            View full analysis →
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorCard({ meta, error }: { meta: SectionMeta; error?: string }) {
  return (
    <div style={CARD_STYLE}>
      <div className="flex items-center gap-2.5">
        <XCircle className="flex-shrink-0" style={{ width: 14, height: 14, color: 'var(--status-error, #ef4444)' }} />
        <p className="flex-1 min-w-0 font-medium leading-tight truncate" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {meta.label} &mdash; Failed
        </p>
      </div>
      {error && (
        <p className="mt-1.5 leading-snug" style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingLeft: '22px' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function ResearchInlineCard({ section, status, data, error, durationMs, sourceCount, onViewFull, className }: ResearchInlineCardProps) {
  const meta = SECTION_META[section] ?? DEFAULT_META;
  const findings = extractTopFindings(section, data);
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.18 }}
      className={cn('w-full', className)}
    >
      {status === 'loading'  && <LoadingCard  meta={meta} section={section} />}
      {status === 'complete' && <CompleteCard meta={meta} findings={findings} durationMs={durationMs} sourceCount={sourceCount} onViewFull={onViewFull} />}
      {status === 'error'    && <ErrorCard    meta={meta} error={error} />}
    </motion.div>
  );
}
