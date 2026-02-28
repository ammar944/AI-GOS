'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { UIMessage } from 'ai';

interface ResearchSectionsProps {
  messages: UIMessage[];
}

type ResearchStatus = 'done' | 'running' | 'pending' | 'error';

interface ResearchItem {
  key: string;
  label: string;
}

const RESEARCH_ITEMS: ResearchItem[] = [
  { key: 'industryMarket', label: 'Industry & Market' },
  { key: 'competitorAnalysis', label: 'Competitor Analysis' },
  { key: 'icpValidation', label: 'ICP Validation' },
  { key: 'offerAnalysis', label: 'Offer Analysis' },
  { key: 'crossAnalysisSynthesis', label: 'Cross-Analysis Synthesis' },
];

function deriveResearchStatus(
  key: string,
  messages: UIMessage[]
): ResearchStatus {
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (
        typeof p.type !== 'string' ||
        !p.type.startsWith('tool-runResearch')
      ) {
        continue;
      }

      // Check if the input section matches this key
      const input = p.input as Record<string, unknown> | undefined;
      if (!input || input.section !== key) continue;

      const state = p.state as string | undefined;
      if (state === 'output-error') return 'error';
      if (state === 'output-available') return 'done';
      if (state === 'input-streaming' || state === 'input-available') {
        return 'running';
      }
    }
  }
  return 'pending';
}

interface StatusDotProps {
  status: ResearchStatus;
}

function StatusDot({ status }: StatusDotProps) {
  if (status === 'done') {
    return (
      <div
        className="flex-shrink-0 rounded-full"
        style={{ width: 7, height: 7, background: 'var(--accent-green)' }}
      />
    );
  }

  if (status === 'error') {
    return (
      <div
        className="flex-shrink-0 rounded-full"
        style={{ width: 7, height: 7, background: 'var(--status-error, #ef4444)' }}
      />
    );
  }

  if (status === 'running') {
    return (
      <div className="relative flex-shrink-0" style={{ width: 7, height: 7 }}>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--accent-blue)', opacity: 0.3 }}
          animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--accent-blue)' }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 rounded-full"
      style={{
        width: 7,
        height: 7,
        background: 'var(--text-quaternary)',
        opacity: 0.4,
      }}
    />
  );
}

interface ResearchRowProps {
  item: ResearchItem;
  status: ResearchStatus;
}

function ResearchRow({ item, status }: ResearchRowProps) {
  const [hovered, setHovered] = useState(false);

  const labelColor =
    status === 'done'
      ? 'var(--text-secondary)'
      : status === 'error'
        ? 'var(--status-error, #ef4444)'
        : status === 'running'
          ? 'var(--accent-blue)'
          : 'var(--text-quaternary)';

  const labelWeight = status === 'running' ? 500 : 400;

  return (
    <div
      className={cn(
        'flex items-center justify-between transition-colors duration-150 cursor-default rounded-lg'
      )}
      style={{
        padding: '8px 10px',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={status} />
        <span
          className="truncate"
          style={{ fontSize: 12, color: labelColor, fontWeight: labelWeight }}
        >
          {item.label}
        </span>
      </div>

      {/* Right side action/state text */}
      <div className="flex-shrink-0 ml-2">
        {status === 'done' && hovered && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              fontSize: 11,
              color: 'var(--accent-blue)',
              fontWeight: 500,
            }}
          >
            View →
          </motion.span>
        )}
        {status === 'running' && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--accent-blue)',
              opacity: 0.7,
            }}
          >
            Running...
          </span>
        )}
        {status === 'error' && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--status-error, #ef4444)',
              opacity: 0.7,
            }}
          >
            Failed
          </span>
        )}
      </div>
    </div>
  );
}

export function ResearchSections({ messages }: ResearchSectionsProps) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      {RESEARCH_ITEMS.map((item) => {
        const status = deriveResearchStatus(item.key, messages);
        return <ResearchRow key={item.key} item={item} status={status} />;
      })}
    </div>
  );
}
