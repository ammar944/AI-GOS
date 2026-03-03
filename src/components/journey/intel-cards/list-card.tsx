'use client';

import { motion } from 'framer-motion';
import { IntelCardHeader, SECTION_META } from './intel-card-header';

export interface ListCardProps {
  sectionKey: string;
  title: string;
  items: string[];
}

export function ListCard({ sectionKey, title, items }: ListCardProps) {
  const meta = SECTION_META[sectionKey] ?? { color: 'var(--accent-blue)' };
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label={title} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, flexShrink: 0, marginTop: 6 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
