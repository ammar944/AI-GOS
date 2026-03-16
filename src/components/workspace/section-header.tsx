'use client';

import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import type { SectionKey } from '@/lib/workspace/types';

interface SectionHeaderProps {
  section: SectionKey;
  mode?: 'workspace' | 'document';
}

export function SectionHeader({ section, mode = 'workspace' }: SectionHeaderProps) {
  const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;

  if (mode === 'document') {
    return (
      <div className="mb-8">
        <span className="bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-[10px] font-mono px-2 py-0.5 rounded-full inline-block">
          Module {meta.moduleNumber}
        </span>
        <h2 className="text-xl font-heading font-semibold text-[var(--text-primary)] mt-1.5">
          {meta.label}
        </h2>
        {meta.description && (
          <p className="text-sm text-[var(--text-tertiary)] mt-1 leading-relaxed">
            {meta.description}
          </p>
        )}
        <div className="h-px bg-gradient-to-r from-[var(--accent-blue)]/20 to-transparent mt-4" />
      </div>
    );
  }

  return (
    <div className="mb-6">
      <span className="text-xs font-mono text-[var(--accent-blue)] uppercase tracking-widest">
        {meta.moduleNumber} &middot; {meta.label}
      </span>
    </div>
  );
}
