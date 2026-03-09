'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactPanelProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  data?: Record<string, unknown>;
  approved: boolean;
  onApprove: () => void;
  onClose: () => void;
}

const SECTION_META: Record<string, { label: string; moduleNumber: string }> = {
  industryMarket: { label: 'Market Overview', moduleNumber: '01' },
  competitors: { label: 'Competitor Intel', moduleNumber: '02' },
  icpValidation: { label: 'ICP Validation', moduleNumber: '03' },
  offerAnalysis: { label: 'Offer Analysis', moduleNumber: '04' },
  crossAnalysis: { label: 'Strategic Synthesis', moduleNumber: '05' },
};

// -- Scanning phrases for loading state ----------------------------------------
const SCANNING_PHRASES = [
  'Scanning market landscape...',
  'Pulling industry benchmarks...',
  'Analyzing pain points from G2 & Reddit...',
  'Mapping buying behaviors...',
  'Identifying demand drivers...',
];

function useAnimatedPhrase(phrases: string[]) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % phrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phrases.length]);
  return phrases[idx];
}

// -- Loading State -------------------------------------------------------------
function ArtifactLoading() {
  const phrase = useAnimatedPhrase(SCANNING_PHRASES);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
      {/* Status pills */}
      <div className="flex gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--section-market)]/10 text-[var(--section-market-text)] text-xs font-mono">
          <Loader2 className="w-3 h-3 animate-spin" />
          Researching
        </span>
      </div>

      <p className="text-sm text-text-secondary animate-pulse">{phrase}</p>

      {/* Progress bar */}
      <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-[var(--section-market)]"
          initial={{ width: '5%' }}
          animate={{ width: '65%' }}
          transition={{ duration: 30, ease: 'linear' }}
        />
      </div>
    </div>
  );
}

// -- Document Renderer -- industryMarket data ----------------------------------
function IndustryMarketDocument({ data }: { data: Record<string, unknown> }) {
  const snapshot = data.categorySnapshot as Record<string, unknown> | undefined;
  const dynamics = data.marketDynamics as Record<string, unknown> | undefined;
  const painPoints = data.painPoints as Record<string, unknown> | undefined;
  const messaging = data.messagingOpportunities as Record<string, unknown> | undefined;
  const trends = data.trendSignals as Array<Record<string, unknown>> | undefined;

  return (
    <div className="space-y-8 pb-8">
      {/* Category Snapshot -- stat blocks */}
      {!!snapshot && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-4">
            Category Snapshot
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {!!snapshot.category && (
              <StatBlock label="Category" value={String(snapshot.category)} />
            )}
            {!!snapshot.marketSize && (
              <StatBlock label="Market Size" value={String(snapshot.marketSize)} />
            )}
            {!!snapshot.marketMaturity && (
              <StatBlock label="Maturity" value={String(snapshot.marketMaturity)} />
            )}
            {!!snapshot.awarenessLevel && (
              <StatBlock label="Awareness" value={String(snapshot.awarenessLevel)} />
            )}
            {!!snapshot.buyingBehavior && (
              <StatBlock label="Buying Behavior" value={String(snapshot.buyingBehavior).replace('_', ' ')} />
            )}
            {!!snapshot.averageSalesCycle && (
              <StatBlock label="Sales Cycle" value={String(snapshot.averageSalesCycle)} />
            )}
          </div>
        </section>
      )}

      {/* Pain Points */}
      {!!painPoints?.primary && Array.isArray(painPoints.primary) && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Pain Points
          </h3>
          <ul className="space-y-2">
            {(painPoints.primary as string[]).map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-[var(--section-market)] mt-1.5 shrink-0">&#x2022;</span>
                {point}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Market Dynamics -- Demand Drivers */}
      {!!dynamics?.demandDrivers && Array.isArray(dynamics.demandDrivers) && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Demand Drivers
          </h3>
          <ul className="space-y-2">
            {(dynamics.demandDrivers as string[]).map((driver, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-[var(--section-market)] mt-1.5 shrink-0">&#x2022;</span>
                {driver}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Buying Triggers */}
      {!!dynamics?.buyingTriggers && Array.isArray(dynamics.buyingTriggers) && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Buying Triggers
          </h3>
          <ul className="space-y-2">
            {(dynamics.buyingTriggers as string[]).map((trigger, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-[var(--section-market)] mt-1.5 shrink-0">&#x2022;</span>
                {trigger}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Barriers to Purchase */}
      {!!dynamics?.barriersToPurchase && Array.isArray(dynamics.barriersToPurchase) && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Barriers to Purchase
          </h3>
          <ul className="space-y-2">
            {(dynamics.barriersToPurchase as string[]).map((barrier, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-[var(--section-market)] mt-1.5 shrink-0">&#x2022;</span>
                {barrier}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Trend Signals */}
      {trends && trends.length > 0 && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Trend Signals
          </h3>
          <div className="space-y-3">
            {trends.map((trend, i) => (
              <div key={i} className="glass-surface rounded-[var(--radius-control)] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded',
                    trend.direction === 'rising' && 'bg-accent-green/10 text-accent-green',
                    trend.direction === 'declining' && 'bg-accent-red/10 text-accent-red',
                    trend.direction === 'stable' && 'bg-white/5 text-text-tertiary',
                  )}>
                    {String(trend.direction)}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{String(trend.trend)}</span>
                </div>
                <p className="text-xs text-text-tertiary">{String(trend.evidence)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Messaging Opportunities */}
      {!!messaging?.summaryRecommendations && Array.isArray(messaging.summaryRecommendations) && (
        <section>
          <h3 className="text-xs font-mono text-[var(--section-market-text)] uppercase tracking-widest mb-3">
            Messaging Opportunities
          </h3>
          <ul className="space-y-2">
            {(messaging.summaryRecommendations as string[]).map((rec, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-accent-green mt-1.5 shrink-0">&#x2713;</span>
                {rec}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-surface rounded-[var(--radius-control)] p-3">
      <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider block mb-1">
        {label}
      </span>
      <span className="text-sm font-medium text-text-primary capitalize">
        {value}
      </span>
    </div>
  );
}

// -- Main Export ---------------------------------------------------------------
export function ArtifactPanel({
  section,
  status,
  data,
  approved,
  onApprove,
  onClose,
}: ArtifactPanelProps) {
  const meta = SECTION_META[section] ?? { label: 'Research', moduleNumber: '00' };
  const isComplete = status === 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="h-full flex flex-col glass-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          {approved ? (
            <div className="w-2.5 h-2.5 rounded-full bg-accent-green shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          ) : isComplete ? (
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--section-market)]" style={{ boxShadow: '0 0 10px color-mix(in srgb, var(--section-market) 30%, transparent)' }} />
          ) : (
            <Loader2 className="w-4 h-4 text-[var(--section-market)] animate-spin" />
          )}
          <div>
            <span className="text-[10px] font-mono text-[var(--section-market-text)] uppercase tracking-widest">
              Module {meta.moduleNumber}
            </span>
            <h2 className="text-base font-heading font-semibold text-text-primary">
              {meta.label}
            </h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6">
        {status === 'loading' && <ArtifactLoading />}
        {status === 'complete' && data && section === 'industryMarket' && (
          <IndustryMarketDocument data={data} />
        )}
        {status === 'error' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-accent-red">Research failed. The agent will continue with available data.</p>
          </div>
        )}
      </div>

      {/* Footer -- Approval button */}
      <div className="px-6 py-4 border-t border-white/[0.04]">
        {approved ? (
          <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-accent-green">
            <Check className="w-4 h-4" />
            Section Approved
          </div>
        ) : (
          <button
            onClick={onApprove}
            disabled={!isComplete}
            className={cn(
              'w-full py-2.5 rounded-[var(--radius-control)] text-sm font-medium transition-all duration-200',
              isComplete
                ? 'sl-btn-primary cursor-pointer'
                : 'bg-white/[0.03] text-text-tertiary cursor-not-allowed',
            )}
          >
            {isComplete ? 'Looks Good' : 'Waiting for research...'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
