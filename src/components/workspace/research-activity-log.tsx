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

interface SourcePreview {
  url: string;
  host: string;
  title?: string;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function eventVerb(entry: ActivityEntry): string {
  if (entry.phase === 'tool') return entry.meta?.url ? 'open source' : 'research step';
  if (entry.phase === 'analysis') return 'think';
  if (entry.phase === 'output') return 'write';
  if (entry.phase === 'error') return 'error';
  return 'runner';
}

export function ResearchActivityLog({ sectionLabel, phase, activity }: ResearchActivityLogProps) {
  const updates = activity?.updates ? collapseResearchJobUpdates(activity.updates) : [];
  const entries: ActivityEntry[] = updates.map((update, index) => ({
    id: update.id,
    message: update.message,
    phase: update.phase,
    isLive: index === updates.length - 1 && activity?.status === 'running',
    meta: update.meta,
  }));

  const hasRealUpdates = entries.length > 0;
  const isWriting = phase === 'streaming' || entries.some((entry) => {
    const message = entry.message.toLowerCase();
    return entry.phase === 'analysis' && (message.includes('synthesiz') || message.includes('writing') || message.includes('draft'));
  });

  const sources = useMemo<SourcePreview[]>(() => {
    const seen = new Set<string>();
    const previews: SourcePreview[] = [];
    for (const entry of entries) {
      const url = entry.meta?.url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      previews.push({
        url,
        host: hostFromUrl(url),
        title: entry.meta?.pageTitle,
      });
    }
    return previews.slice(-6).reverse();
  }, [entries]);

  const dataPoints = useMemo(() => {
    return entries.flatMap((entry) => entry.meta?.dataPoints ?? []).slice(-8).reverse();
  }, [entries]);

  const visibleEntries = entries.slice(-12).reverse();
  const currentStep = isWriting ? 'Writing section' : sources.length > 0 ? 'Reading sources' : hasRealUpdates ? 'Finding sources' : 'Starting worker';

  const timeline = [
    {
      label: 'Plan queries',
      detail: 'Choose search paths and source targets.',
      complete: hasRealUpdates,
      active: !hasRealUpdates,
    },
    {
      label: 'Find sources',
      detail: 'Find competitors, reviews, ads, pricing, and category pages.',
      complete: sources.length > 0,
      active: hasRealUpdates && sources.length === 0 && !isWriting,
    },
    {
      label: 'Open sources',
      detail: 'Read pages and keep only usable GTM evidence.',
      complete: dataPoints.length > 0 || sources.length >= 2,
      active: sources.length > 0 && dataPoints.length === 0 && !isWriting,
    },
    {
      label: 'Extract signals',
      detail: 'Normalize claims, objections, offers, and demand signals.',
      complete: dataPoints.length > 0,
      active: dataPoints.length > 0 && !isWriting,
    },
    {
      label: 'Write section',
      detail: 'Draft the report block from the verified corpus.',
      complete: false,
      active: isWriting,
    },
  ];

  return (
    <div className="flex min-h-[520px] flex-1 flex-col px-1 pb-7">
      <section className="overflow-hidden rounded-[12px] border border-white/[0.065] bg-[#0f0f0e] shadow-[0_20px_70px_rgba(0,0,0,0.32)]">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <motion.span
              className={cn('h-2 w-2 rounded-full', isWriting ? 'bg-amber-300' : 'bg-[#50f8e4]')}
              animate={{ opacity: [1, 0.32, 1] }}
              transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                {currentStep}
              </p>
              <h2 className="truncate text-[15px] font-medium tracking-[-0.01em] text-white/88">
                Building source-backed {sectionLabel}
              </h2>
            </div>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/34 sm:flex">
            <span>{sources.length} sources</span>
            <span className="h-1 w-1 rounded-full bg-white/18" />
            <span>{dataPoints.length} signals</span>
          </div>
        </header>

        <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-white/[0.06] p-4 lg:border-b-0 lg:border-r lg:border-white/[0.06]">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/38">Research plan</p>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/34">
                live evidence
              </span>
            </div>
            <div className="space-y-2.5">
              {timeline.map((step, index) => (
                <div key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px]',
                        step.active
                          ? 'border-[#50f8e4]/45 bg-[#50f8e4]/10 text-[#9ffdf2]'
                          : step.complete
                            ? 'border-white/10 bg-white/[0.06] text-white/62'
                            : 'border-white/[0.08] bg-white/[0.015] text-white/24',
                      )}
                    >
                      {step.complete ? '✓' : index + 1}
                    </span>
                    {index < timeline.length - 1 && <span className="mt-2 h-7 w-px bg-white/[0.065]" />}
                  </div>
                  <div className="min-w-0 pb-2">
                    <p className="text-[13px] font-medium text-white/78">{step.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-white/40">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid min-h-[350px] grid-rows-[auto_1fr]">
            <div className="border-b border-white/[0.06] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/38">Evidence board</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/28">sources + signals</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-[8px] border border-white/[0.055] bg-white/[0.018] p-3">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/28">Opened sources</p>
                  {sources.length > 0 ? (
                    <div className="space-y-2">
                      {sources.slice(0, 4).map((source) => (
                        <div key={source.url} className="min-w-0">
                          <p className="truncate text-xs font-medium text-white/70">{source.host}</p>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-white/30">{source.title ?? source.url}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <SkeletonRows label="Waiting for URLs" />
                  )}
                </div>
                <div className="rounded-[8px] border border-white/[0.055] bg-white/[0.018] p-3">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/28">Extracted signals</p>
                  {dataPoints.length > 0 ? (
                    <div className="space-y-2">
                      {dataPoints.slice(0, 4).map((point, index) => (
                        <div key={`${point.label}-${index}`} className="min-w-0">
                          <p className="truncate text-xs font-medium text-white/70">{point.label}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-white/36">{point.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <SkeletonRows label="Waiting for signals" />
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/38">Activity</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/26">latest first</span>
              </div>
              {visibleEntries.length > 0 ? (
                <div className="max-h-[260px] overflow-y-auto rounded-[8px] border border-white/[0.055] bg-black/10 custom-scrollbar">
                  {visibleEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-white/[0.045] px-3 py-2.5 last:border-b-0',
                        entry.isLive && 'bg-[#50f8e4]/[0.035]',
                      )}
                    >
                      <span className={cn(
                        'font-mono text-[10px] uppercase tracking-[0.1em]',
                        entry.phase === 'error' ? 'text-red-300' : entry.isLive ? 'text-[#9ffdf2]' : 'text-white/30',
                      )}>
                        {eventVerb(entry)}
                      </span>
                      <span className="min-w-0 truncate text-xs leading-5 text-white/58">
                        {entry.meta?.url ? hostFromUrl(entry.meta.url) : entry.message}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[150px] items-center justify-center rounded-[8px] border border-dashed border-white/[0.08] bg-white/[0.012] px-6 text-center">
                  <p className="max-w-sm text-xs leading-5 text-white/34">
                    Waiting for the research worker to start emitting tool events. The report will appear as source-backed blocks once this section finishes.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SkeletonRows({ label }: { label: string }) {
  return (
    <div className="space-y-2" aria-label={label}>
      {[0, 1, 2].map((index) => (
        <div key={index} className="space-y-1.5">
          <div className="h-2.5 w-2/3 rounded-full bg-white/[0.055]" />
          <div className="h-2 w-full rounded-full bg-white/[0.035]" />
        </div>
      ))}
    </div>
  );
}
