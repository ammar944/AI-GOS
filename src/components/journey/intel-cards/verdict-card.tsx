'use client';

import { IntelCardHeader } from './intel-card-header';

function getVerdictColor(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('VALIDATED') || (s.includes('PROCEED') && !s.includes('REFINEMENT'))) return 'var(--accent-green, #22c55e)';
  if (s.includes('GROWING') || s.includes('STRONG')) return 'var(--accent-blue)';
  if (s.includes('CAUTION') || s.includes('REFINEMENT') || s.includes('MATURE')) return '#f59e0b';
  if (s.includes('NEEDS WORK') || s.includes('INVALID') || s.includes('DECLINING')) return 'var(--status-error, #ef4444)';
  return 'var(--accent-blue)';
}

export interface VerdictCardProps {
  sectionKey: string;
  label: string;
  status: string;
  summary?: string;
}

export function VerdictCard({ sectionKey, label, status, summary }: VerdictCardProps) {
  const color = getVerdictColor(status);
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label={label} />
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 12px',
        borderRadius: 6,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        marginBottom: summary ? 10 : 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', color, textTransform: 'uppercase' }}>
          {status}
        </span>
      </div>
      {summary && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {summary}
        </p>
      )}
    </div>
  );
}
