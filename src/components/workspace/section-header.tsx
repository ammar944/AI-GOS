'use client';

import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import type { SectionKey } from '@/lib/workspace/types';

interface SectionHeaderProps {
  section: SectionKey;
}

export function SectionHeader({ section }: SectionHeaderProps) {
  const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;

  return (
    <div className="mb-6">
      <span className="text-xs font-mono text-[var(--accent-blue)] uppercase tracking-widest">
        {meta.moduleNumber} &middot; {meta.label}
      </span>
    </div>
  );
}
