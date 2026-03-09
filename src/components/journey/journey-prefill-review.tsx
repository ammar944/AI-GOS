'use client';

import { useMemo } from 'react';
import { Check, MessageSquare } from 'lucide-react';
import type {
  JourneyPrefillProposal,
  JourneyPrefillReviewDecision,
} from '@/lib/journey/prefill';

interface JourneyPrefillReviewProps {
  proposals: JourneyPrefillProposal[];
  onApplyReview: (decisions: JourneyPrefillReviewDecision[]) => void;
  onSkipForNow: () => void;
}

export function JourneyPrefillReview({
  proposals,
  onApplyReview,
  onSkipForNow,
}: JourneyPrefillReviewProps) {
  const acceptAllDecisions = useMemo(
    () =>
      proposals.map((p) => ({
        fieldName: p.fieldName,
        action: 'accept' as const,
        value: p.value,
      })),
    [proposals],
  );

  const fieldLabels = proposals.map((p) => p.label);

  return (
    <div
      className="mb-6 rounded-3xl p-5"
      style={{
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="inline-flex items-center rounded-full px-2.5 py-1"
        style={{
          background: 'var(--bg-overlay-light)',
          color: 'var(--text-tertiary)',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        AI prefill
      </div>

      <div
        className="mt-3"
        style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}
      >
        Found {proposals.length} details from your site
      </div>

      <p
        className="mt-2"
        style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}
      >
        {fieldLabels.slice(0, 5).join(', ')}
        {fieldLabels.length > 5 ? `, +${fieldLabels.length - 5} more` : ''}
      </p>

      <p
        className="mt-1"
        style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)' }}
      >
        You can accept these now or skip and confirm each one as we go.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onApplyReview(acceptAllDecisions)}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium"
          style={{
            background: 'var(--accent-blue)',
            color: 'var(--text-white)',
          }}
        >
          <Check className="h-4 w-4" />
          Use these details and start
        </button>
        <button
          type="button"
          onClick={onSkipForNow}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <MessageSquare className="h-4 w-4" />
          Skip — I'll answer in chat
        </button>
      </div>
    </div>
  );
}
