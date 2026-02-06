'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import { springs } from '@/lib/motion';

interface ResearchResultCardProps {
  research: string;
  cost?: number;
}

export function ResearchResultCard({ research, cost }: ResearchResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Show first ~150 chars when collapsed
  const preview = research.length > 150
    ? research.substring(0, 150) + '...'
    : research;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg overflow-hidden my-2"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left cursor-pointer"
        style={{ background: 'transparent', border: 'none' }}
      >
        <Globe className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-blue)' }} />
        <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
          Web Research Result
        </span>
        {cost != null && cost > 0 && (
          <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--text-quaternary)' }}>
            <Coins className="w-3 h-3" />
            ${cost.toFixed(4)}
          </span>
        )}
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        )}
      </button>

      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.smooth}
          >
            <div
              className="px-3 pb-3 text-xs whitespace-pre-wrap"
              style={{
                color: 'var(--text-secondary)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
              }}
            >
              {research}
            </div>
          </motion.div>
        ) : (
          <div
            className="px-3 pb-2 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {preview}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
