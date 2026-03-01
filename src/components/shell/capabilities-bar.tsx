'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fastStagger, staggerItem } from '@/lib/motion';

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
    <motion.span
      variants={staggerItem}
      className={cn('inline-block')}
      title={capability.active ? undefined : 'Coming soon'}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        padding: '3px 8px',
        borderRadius: 5,
        background: capability.active
          ? 'var(--bg-chip-hover)'
          : 'var(--bg-hover)',
        border: capability.active
          ? '1px solid var(--border-chip-selected)'
          : '1px solid var(--border-subtle)',
        color: capability.active
          ? 'var(--accent-blue)'
          : 'var(--text-tertiary)',
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      }}
    >
      {capability.label}
    </motion.span>
  );
}

export function CapabilitiesBar() {
  return (
    <motion.div
      className="flex flex-wrap gap-1.5"
      variants={fastStagger}
      initial="initial"
      animate="animate"
    >
      {CAPABILITIES.map((cap) => (
        <CapabilityTag key={cap.label} capability={cap} />
      ))}
    </motion.div>
  );
}
