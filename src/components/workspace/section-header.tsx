'use client';

import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import type { SectionKey } from '@/lib/workspace/types';

interface SectionHeaderProps {
  section: SectionKey;
  mode?: 'workspace' | 'document' | 'report';
  phaseLabel?: string;
  sourceCount?: number;
}

export function SectionHeader({ section, mode = 'workspace', phaseLabel, sourceCount }: SectionHeaderProps) {
  const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;

  if (mode === 'report') {
    return (
      <div className="mb-2 border-b border-white/[0.06] pb-5">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/34">
          <span>Module {meta.moduleNumber}</span>
          {phaseLabel && <span>· {phaseLabel}</span>}
          {typeof sourceCount === 'number' && <span>· {sourceCount} sources</span>}
        </div>
        <h2 className="mt-2 text-[26px] font-medium leading-tight tracking-[-0.035em] text-white/90">
          {meta.label}
        </h2>
        {meta.description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/46">
            {meta.description}
          </p>
        )}
      </div>
    );
  }

  if (mode === 'document') {
    return (
      <div className="mb-8">
        <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.12em]">
          Module {meta.moduleNumber}
        </span>
        <h2
          className="text-[28px] italic font-normal leading-[1.1] tracking-tight text-[var(--text-primary)] mt-1"
          style={{ fontFamily: 'var(--font-instrument-sans)' }}
        >
          {meta.label}
        </h2>
        {meta.description && (
          <p className="text-sm text-[var(--text-tertiary)] mt-1.5 leading-relaxed">
            {meta.description}
          </p>
        )}
        <div className="h-px bg-[var(--border-subtle)] mt-5" />
      </div>
    );
  }

  return (
    <div className="mb-6">
      <span className="text-[11px] font-mono text-[var(--text-secondary)] uppercase tracking-[0.12em]">
        {meta.moduleNumber} &middot; {meta.label}
      </span>
      {meta.description && (
        <p className="mt-1 text-[12px] text-[var(--text-tertiary)] leading-relaxed">
          {meta.description}
        </p>
      )}
    </div>
  );
}
