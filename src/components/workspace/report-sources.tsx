'use client';

import type { ReportSource } from '@/lib/workspace/extract-card-sources';

interface ReportSourcesProps {
  sources: ReportSource[];
}

export function ReportSources({ sources }: ReportSourcesProps) {
  if (sources.length === 0) {
    return (
      <section className="mt-8 rounded-[10px] border border-white/[0.06] bg-white/[0.018] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/42">Sources</h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/26">pending evidence</span>
        </div>
        <p className="mt-3 max-w-xl text-xs leading-5 text-white/36">
          Source links will appear here once the research worker emits visited URLs or the report blocks include citations.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-[10px] border border-white/[0.06] bg-white/[0.018] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/44">Sources used</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/32">
          {sources.length} linked
        </span>
      </div>
      <div className="mt-3 divide-y divide-white/[0.055]">
        {sources.map((source, index) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-2.5 text-xs transition-colors hover:bg-white/[0.025]"
          >
            <span className="font-mono text-white/28">{String(index + 1).padStart(2, '0')}</span>
            <span className="min-w-0">
              <span className="block truncate text-white/70">{source.label}</span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-white/30">
                {source.detail ?? source.url}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
