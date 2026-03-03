'use client';

import { IntelCardHeader } from './intel-card-header';

export interface QuoteCardProps {
  sectionKey: string;
  quote: string;
}

export function QuoteCard({ sectionKey, quote }: QuoteCardProps) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label="Positioning" />
      <blockquote style={{
        margin: 0,
        padding: '10px 14px',
        borderLeft: '3px solid var(--accent-blue)',
        background: 'color-mix(in srgb, var(--accent-blue) 6%, transparent)',
        borderRadius: '0 8px 8px 0',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
          &ldquo;{quote}&rdquo;
        </p>
      </blockquote>
    </div>
  );
}
