'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, FileText, DollarSign, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrapeLoadingCardProps {
  websiteUrl?: string;
  mode?: 'prefill' | 'competitor';
  className?: string;
}

/** Extract display domain from a URL string */
function extractDomain(url?: string): string {
  if (!url) return 'website';
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    // Fallback: strip protocol and path
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'website';
  }
}

const CARD_COPY = {
  prefill: {
    heading: 'Analyzing',
    subheading: 'Scraping site to pre-fill your profile',
    steps: [
      { icon: Globe, label: 'Reading homepage', delay: 0 },
      { icon: DollarSign, label: 'Checking pricing page', delay: 8000 },
      { icon: FileText, label: 'Extracting business data', delay: 16000 },
      { icon: Database, label: 'Structuring insights', delay: 22000 },
    ],
  },
  competitor: {
    heading: 'Profiling',
    subheading: 'Pulling live competitor positioning and offer signals',
    steps: [
      { icon: Globe, label: 'Reading homepage', delay: 0 },
      { icon: DollarSign, label: 'Checking offer and pricing pages', delay: 6000 },
      { icon: FileText, label: 'Extracting positioning and proof', delay: 12000 },
      { icon: Database, label: 'Structuring competitive intel', delay: 18000 },
    ],
  },
} as const;

export function ScrapeLoadingCard({
  websiteUrl,
  mode = 'prefill',
  className,
}: ScrapeLoadingCardProps) {
  const domain = extractDomain(websiteUrl);
  const copy = CARD_COPY[mode];
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timers = copy.steps.slice(1).map((step, i) =>
      setTimeout(() => setActiveStep(i + 1), step.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [copy.steps]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('my-1', className)}
      style={{
        padding: '14px 16px',
        borderRadius: '12px',
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header: Analyzing domain */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-md"
          style={{
            width: 28,
            height: 28,
            background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
          }}
        >
          <Globe style={{ width: 14, height: 14, color: 'var(--accent-blue)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-medium leading-tight truncate"
            style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}
          >
            {copy.heading}{' '}
            <span style={{ color: 'var(--accent-blue)' }}>{domain}</span>
          </p>
          <p
            className="truncate mt-0.5"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
          >
            {copy.subheading}
          </p>
        </div>

        {/* Scanning bar animation */}
        <div
          className="flex-shrink-0 overflow-hidden rounded-full"
          style={{
            width: 48,
            height: 3,
            background: 'var(--border-subtle)',
          }}
        >
          <motion.div
            style={{
              width: '40%',
              height: '100%',
              borderRadius: '999px',
              background: 'var(--accent-blue)',
            }}
            animate={{ x: ['-100%', '220%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>

        {/* Step indicators */}
      <div className="flex flex-col gap-1.5">
        <AnimatePresence mode="popLayout">
          {copy.steps.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = i === activeStep;
            const isDone = i < activeStep;
            const isPending = i > activeStep;

            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
                transition={{ duration: 0.2, delay: isPending ? 0 : 0.05 }}
                className="flex items-center gap-2"
                style={{ minHeight: 22 }}
              >
                {/* Step icon */}
                <div className="flex-shrink-0" style={{ width: 14 }}>
                  {isDone ? (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--accent-green, #22c55e)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <StepIcon style={{ width: 13, height: 13, color: 'var(--accent-blue)' }} />
                    </motion.div>
                  ) : (
                    <StepIcon style={{ width: 13, height: 13, color: 'var(--text-tertiary)' }} />
                  )}
                </div>

                {/* Step label */}
                <span
                  style={{
                    fontSize: '11.5px',
                    color: isDone
                      ? 'var(--text-tertiary)'
                      : isActive
                        ? 'var(--text-secondary)'
                        : 'var(--text-tertiary)',
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}
                >
                  {step.label}
                  {isActive && (
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ marginLeft: 2 }}
                    >
                      ...
                    </motion.span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
