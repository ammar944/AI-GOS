'use client';

import { cn } from '@/lib/utils';

interface Capability {
  label: string;
  active: boolean;
}

const CAPABILITIES: Capability[] = [
  { label: 'Research', active: true },
  { label: 'Ad Library', active: false },
  { label: 'Keyword Intel', active: false },
  { label: 'SEO Audit', active: false },
  { label: 'Pricing Scrape', active: false },
];

interface CapabilityTagProps {
  capability: Capability;
}

function CapabilityTag({ capability }: CapabilityTagProps) {
  return (
    <span
      className={cn('inline-block')}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        padding: '3px 8px',
        borderRadius: 5,
        background: capability.active
          ? 'rgba(54, 94, 255, 0.12)'
          : 'var(--bg-hover)',
        border: capability.active
          ? '1px solid rgba(54, 94, 255, 0.2)'
          : '1px solid var(--border-subtle)',
        color: capability.active
          ? 'var(--accent-blue)'
          : 'var(--text-tertiary)',
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      }}
    >
      {capability.label}
    </span>
  );
}

export function CapabilitiesBar() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CAPABILITIES.map((cap) => (
        <CapabilityTag key={cap.label} capability={cap} />
      ))}
    </div>
  );
}
