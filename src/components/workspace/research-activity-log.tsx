'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ResearchJobActivity, ResearchUpdateMeta } from '@/lib/journey/research-job-activity';
import { collapseResearchJobUpdates } from '@/lib/journey/research-job-activity';

interface ResearchActivityLogProps {
  section: string;
  sectionLabel: string;
  phase: 'researching' | 'streaming';
  activity?: ResearchJobActivity;
}

interface ActivityEntry {
  id: string;
  message: string;
  phase: string;
  isLive: boolean;
  meta?: ResearchUpdateMeta;
}

// ---------------------------------------------------------------------------
// Main component — orchestrates text-only vs hyper-agent layout
// ---------------------------------------------------------------------------

export function ResearchActivityLog({ sectionLabel, phase, activity }: ResearchActivityLogProps) {
  const realUpdates = activity?.updates
    ? collapseResearchJobUpdates(activity.updates)
    : [];
  const hasRealUpdates = realUpdates.length > 0;

  const entries: ActivityEntry[] = hasRealUpdates
    ? realUpdates.map((u, i) => ({
        id: u.id,
        message: u.message,
        phase: u.phase,
        isLive: i === realUpdates.length - 1 && activity?.status === 'running',
        meta: u.meta,
      }))
    : [];

  return <HyperAgentLayout entries={entries} sectionLabel={sectionLabel} phase={phase} hasRealUpdates={hasRealUpdates} />;
}

// ---------------------------------------------------------------------------
// HyperAgentLayout — split-screen with browser + data assembly
// ---------------------------------------------------------------------------

function HyperAgentLayout({
  entries,
  sectionLabel,
  phase,
  hasRealUpdates,
}: {
  entries: ActivityEntry[];
  sectionLabel: string;
  phase: 'researching' | 'streaming';
  hasRealUpdates: boolean;
}) {
  // Entries with URLs (for browser panel)
  const metaEntries = entries.filter((e) => e.meta?.url);


  // Count all unique source URLs
  const pagesVisited = useMemo(() => {
    const urls = new Set<string>();
    for (const e of metaEntries) {
      if (e.meta?.url) urls.add(e.meta.url);
    }
    return urls.size;
  }, [metaEntries]);

  // Aggregate data points
  const allDataPoints = useMemo(() => {
    const points: Array<{ label: string; value: string }> = [];
    for (const e of entries) {
      if (e.meta?.dataPoints) {
        points.push(...e.meta.dataPoints);
      }
    }
    return points;
  }, [entries]);


  const latestMessage = entries.length > 0 ? entries[entries.length - 1].message : null;

  // Detect synthesis phase — the model is writing the final JSON artifact
  const isSynthesizing = useMemo(() => {
    // Look for analysis-phase entries with "synthesizing" in the message
    return entries.some(
      (e) => e.phase === 'analysis' && e.message.toLowerCase().includes('synthesiz'),
    );
  }, [entries]);


  // Extract source titles from "source: Title (domain)" messages
  const recentSources = useMemo(() => {
    const sources: string[] = [];
    for (const e of entries) {
      if (e.phase !== 'tool' || !e.message.startsWith('source: ')) continue;
      sources.push(e.message.slice(8));
    }
    return sources.slice(-6); // Keep last 6
  }, [entries]);

  const stageRows = [
    {
      label: 'Search',
      description: 'Finding source pages, competitor proof, ads, reviews, and category signals.',
      active: phase === 'researching' && !isSynthesizing,
      complete: hasRealUpdates && pagesVisited > 0,
    },
    {
      label: 'Read',
      description: 'Extracting evidence from visited URLs instead of asking for a rigid schema.',
      active: phase === 'researching' && pagesVisited > 0 && !isSynthesizing,
      complete: allDataPoints.length > 0 || recentSources.length > 1,
    },
    {
      label: 'Synthesize',
      description: 'Turning the corpus into the next GTM section with source-backed claims.',
      active: isSynthesizing || phase === 'streaming',
      complete: phase === 'streaming' && !isSynthesizing,
    },
  ];

  const visibleEntries = entries.slice(-10);

  return (
    <div className="flex min-h-[420px] flex-1 flex-col gap-3 px-1 pb-6">
      <div className="rounded-[10px] border border-white/[0.07] bg-[#0b0b0a] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <motion.span
              className={cn('h-2 w-2 rounded-full', isSynthesizing ? 'bg-amber-400' : 'bg-emerald-400')}
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                {isSynthesizing ? 'Writing GTM section' : hasRealUpdates ? 'Agent run live' : 'Agent run starting'}
              </p>
              <p className="truncate text-sm font-medium text-white/86">{sectionLabel}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-white/35 sm:flex">
            <span>{pagesVisited} sources</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{allDataPoints.length} signals</span>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-white/[0.06] p-4 lg:border-b-0 lg:border-r lg:border-white/[0.06]">
            <div className="space-y-3">
              {stageRows.map((stage, index) => (
                <div key={stage.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'mt-1 h-5 w-5 rounded-full border text-[10px] flex items-center justify-center font-mono',
                        stage.active
                          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                          : stage.complete
                            ? 'border-white/10 bg-white/[0.06] text-white/65'
                            : 'border-white/[0.08] bg-white/[0.02] text-white/24',
                      )}
                    >
                      {stage.complete ? '✓' : index + 1}
                    </span>
                    {index < stageRows.length - 1 && <span className="mt-2 h-8 w-px bg-white/[0.07]" />}
                  </div>
                  <div className="min-w-0 pb-3">
                    <p className="text-sm font-medium text-white/82">{stage.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/42">{stage.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {latestMessage && (
              <div className="mt-3 rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">Latest</p>
                <p className="mt-1 truncate text-xs text-white/58">{latestMessage}</p>
              </div>
            )}
          </div>

          <div className="flex min-h-[320px] flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/38">Run trace</p>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/35">
                no schema preview
              </span>
            </div>

            {visibleEntries.length > 0 ? (
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                {visibleEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'rounded-md border px-3 py-2',
                      entry.isLive
                        ? 'border-emerald-400/20 bg-emerald-400/[0.045]'
                        : 'border-white/[0.055] bg-white/[0.02]',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        entry.phase === 'error' ? 'bg-red-400' : entry.phase === 'tool' ? 'bg-purple-300' : entry.phase === 'analysis' ? 'bg-amber-300' : 'bg-white/35',
                      )} />
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">{entry.phase}</span>
                      {entry.meta?.url && (
                        <span className="ml-auto truncate font-mono text-[9px] text-white/24">
                          {(() => { try { return new URL(entry.meta!.url!).hostname.replace(/^www\./, ''); } catch { return entry.meta!.url; } })()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-5 text-white/62">{entry.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-white/[0.08] bg-white/[0.015] px-6 text-center">
                <p className="max-w-sm text-xs leading-5 text-white/36">
                  Waiting for the worker to emit live search/read/write events. The GTM report will populate from completed section output, not a prefilled review schema.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
