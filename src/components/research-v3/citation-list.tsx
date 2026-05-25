'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown } from 'lucide-react';

interface Citation {
  number: number;
  url: string;
  title?: string;
}

interface CitationListProps {
  citations: Citation[];
}

export function CitationList({ citations }: CitationListProps) {
  const [expanded, setExpanded] = useState(false);

  if (citations.length === 0) return null;

  return (
    <div
      className="mt-3 pt-3"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left"
        style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}
      >
        <ExternalLink style={{ width: 10, height: 10 }} />
        {citations.length} source{citations.length !== 1 ? 's' : ''}
        <ChevronDown
          style={{
            width: 10,
            height: 10,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-2 space-y-1 overflow-hidden"
          >
            {citations.map((cite) => (
              <li key={cite.number} className="flex items-start gap-1.5">
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center rounded"
                  style={{
                    width: 16,
                    height: 16,
                    fontSize: 9,
                    fontWeight: 600,
                    background: 'var(--bg-hover)',
                    color: 'var(--text-tertiary)',
                    marginTop: 1,
                  }}
                >
                  {cite.number}
                </span>
                <a
                  href={cite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs truncate hover:underline"
                  style={{ color: 'var(--accent-blue)', lineHeight: '18px' }}
                >
                  {cite.title || cite.url}
                </a>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
