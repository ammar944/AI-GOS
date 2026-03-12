'use client';

import { ResearchSubsectionReveal } from '@/components/journey/research-subsection-reveal';

export interface KeyedResearchSubsectionRevealProps {
  sectionKey: string;
  data: Record<string, unknown> | null | undefined;
  status: 'pending' | 'running' | 'complete' | 'error';
  delayMs?: number;
}

export function KeyedResearchSubsectionReveal({
  sectionKey,
  data,
  status,
  delayMs,
}: KeyedResearchSubsectionRevealProps) {
  return (
    <ResearchSubsectionReveal
      key={sectionKey}
      sectionKey={sectionKey}
      data={data}
      status={status}
      delayMs={delayMs}
    />
  );
}
