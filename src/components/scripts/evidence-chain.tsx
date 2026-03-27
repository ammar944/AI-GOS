'use client';

import type { GroundedIn } from '@/lib/scripts/schemas';

const SECTION_LABELS: Record<string, string> = {
  industryMarket: 'Market Overview',
  icpValidation: 'ICP Validation',
  offerAnalysis: 'Offer Analysis',
  competitors: 'Competitor Intel',
  keywordIntel: 'Keyword Intel',
  crossAnalysis: 'Strategic Synthesis',
  mediaPlan: 'Media Plan',
};

interface EvidenceChainProps {
  groundedIn: GroundedIn[];
}

export function EvidenceChain({ groundedIn }: EvidenceChainProps) {
  if (!groundedIn || groundedIn.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.06em] font-[family-name:var(--font-mono)] font-medium text-[var(--text-3)]">
        Grounded in research
      </p>
      <div className="space-y-2">
        {groundedIn.map((item, i) => (
          <div
            key={i}
            className="border-l-2 border-[var(--accent)] pl-3 py-0.5"
          >
            <p className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.04em] text-[var(--text-3)] mb-0.5">
              {SECTION_LABELS[item.section] ?? item.section}
              {item.label ? ` — ${item.label}` : ''}
            </p>
            <p className="text-xs text-[var(--text-2)] leading-relaxed">{item.claim}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
