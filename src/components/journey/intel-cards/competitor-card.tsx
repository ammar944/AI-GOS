'use client';

import { IntelCardHeader } from './intel-card-header';

export interface CompetitorCardProps {
  sectionKey: string;
  name: string;
  positioning?: string;
  weakness?: string;
  yourGap?: string;
}

export function CompetitorCard({ sectionKey, name, positioning, weakness, yourGap }: CompetitorCardProps) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label="Competitor" />
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
        {name}
      </p>
      {positioning && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.4, fontStyle: 'italic' }}>
          &ldquo;{positioning}&rdquo;
        </p>
      )}
      {weakness && (
        <div style={{ display: 'flex', gap: 8, marginBottom: yourGap ? 5 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-error, #ef4444)', flexShrink: 0, paddingTop: 1, letterSpacing: '0.02em' }}>
            WEAKNESS
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{weakness}</span>
        </div>
      )}
      {yourGap && (
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green, #22c55e)', flexShrink: 0, paddingTop: 1, letterSpacing: '0.02em' }}>
            YOUR GAP
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{yourGap}</span>
        </div>
      )}
    </div>
  );
}
