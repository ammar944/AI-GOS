'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs, easings } from '@/lib/motion';
import { FieldCard } from '@/components/journey/field-card';
import type { JourneyFieldGroupMeta } from '@/lib/journey/field-catalog';
import {
  JOURNEY_FIELD_LABELS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_PRICING_GROUP_KEYS,
  JOURNEY_MULTILINE_FIELDS,
  getManualBlockerMeta,
} from '@/lib/journey/field-catalog';

export interface FieldGroupProps {
  group: JourneyFieldGroupMeta;
  groupIndex: number;
  state: 'active' | 'completed' | 'upcoming';
  fieldValues: Record<string, string>;
  scrapedKeys: Set<string>;
  onFieldChange: (key: string, value: string) => void;
  onContinue: () => void;
  onReopen: () => void;
  onFieldBlur?: (key: string) => void;
}

// Field entrance variant — staggered, compact y offset
const fieldVariants = {
  initial: { opacity: 0, y: 4 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: easings.out },
  },
};

// Stagger container for field cards
const fieldContainerVariants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.03 },
  },
};

export function FieldGroup({
  group,
  groupIndex,
  state,
  fieldValues,
  scrapedKeys,
  onFieldChange,
  onContinue,
  onReopen,
  onFieldBlur,
}: FieldGroupProps) {
  const filledCount = useMemo(() => {
    return group.fieldKeys.filter((key) => fieldValues[key]?.trim()).length;
  }, [group.fieldKeys, fieldValues]);

  const totalCount = group.fieldKeys.length;

  const summaryPreview = useMemo(() => {
    if (state !== 'completed') return '';
    const previews: string[] = [];
    for (const key of group.fieldKeys) {
      const val = fieldValues[key]?.trim();
      if (val) {
        const truncated = val.length > 40 ? val.slice(0, 40) + '...' : val;
        previews.push(truncated);
        if (previews.length >= 3) break;
      }
    }
    return previews.join(' · ');
  }, [state, group.fieldKeys, fieldValues]);

  return (
    // Outer wrapper holds its position in the list without layout animation.
    // AnimatePresence switches between state renders with mode="wait" so only
    // one child is visible at a time, preventing layout-fight glitches.
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {state === 'completed' && (
          <motion.div
            key="completed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer group/completed border border-emerald-500/10 bg-emerald-500/[0.03] transition-all duration-200 hover:border-emerald-500/20 hover:bg-emerald-500/[0.05]"
            onClick={onReopen}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/15 border border-emerald-500/20">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-heading font-medium text-[var(--text-primary)]">
                  {group.label}
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300">
                  {filledCount}/{totalCount}
                </span>
              </div>
              {summaryPreview && (
                <p className="text-[11px] mt-0.5 truncate text-[var(--text-quaternary)]">
                  {summaryPreview}
                </p>
              )}
            </div>

            <span className="text-[10px] text-[var(--text-quaternary)] opacity-0 group-hover/completed:opacity-100 transition-opacity shrink-0">
              Edit
            </span>
          </motion.div>
        )}

        {state === 'upcoming' && (
          <motion.div
            key="upcoming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[var(--border-glass)] opacity-40"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-dashed border-[var(--border-default)]">
              <span className="text-[10px] font-mono text-[var(--text-quaternary)]">
                {groupIndex + 1}
              </span>
            </div>

            <span className="text-[13px] font-heading text-[var(--text-tertiary)]">
              {group.label}
            </span>

            <span className="text-[10px] font-mono ml-auto text-[var(--text-quaternary)]">
              {totalCount} fields
            </span>
          </motion.div>
        )}

        {state === 'active' && (
          // ── Active state ──
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: easings.out }}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgb(14, 16, 22)',
              border: '1px solid rgba(54, 94, 255, 0.3)',
              boxShadow: '0 0 24px rgba(54, 94, 255, 0.12), 0 4px 12px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Group header — tighter padding */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              {/* Timeline dot — active blue */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(54, 94, 255, 0.12)',
                  border: '1px solid rgba(54, 94, 255, 0.25)',
                  boxShadow: '0 0 12px rgba(54, 94, 255, 0.15)',
                }}
              >
                <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--accent-blue)' }}>
                  {groupIndex + 1}
                </span>
              </div>

              <div className="flex-1">
                <h3
                  className="text-[15px] font-semibold tracking-[-0.01em]"
                  style={{ color: 'rgba(255, 255, 255, 0.95)', fontFamily: 'var(--font-heading)' }}
                >
                  {group.label}
                </h3>
                <p className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                  {filledCount} of {totalCount} filled
                </p>
              </div>
            </div>

            {/* Field cards — staggered entrance, tighter spacing */}
            <motion.div
              className="px-4 pb-1 space-y-1.5"
              variants={fieldContainerVariants}
              initial="initial"
              animate="animate"
            >
              {group.fieldKeys.map((key, i) => {
                const fieldLabel = JOURNEY_FIELD_LABELS[key] || key;
                const isRequired = JOURNEY_REQUIRED_FIELD_KEYS.has(key) || JOURNEY_PRICING_GROUP_KEYS.has(key);
                const isScraped = scrapedKeys.has(key);
                const isMultiline = JOURNEY_MULTILINE_FIELDS.has(key);
                const blockerMeta = getManualBlockerMeta(key);

                return (
                  <motion.div key={key} variants={fieldVariants}>
                    <FieldCard
                      fieldKey={key}
                      label={fieldLabel}
                      value={fieldValues[key] ?? ''}
                      placeholder={blockerMeta?.placeholder ?? ''}
                      helper={blockerMeta?.helper}
                      isRequired={isRequired}
                      isScraped={isScraped}
                      isMultiline={isMultiline}
                      onChange={(val) => onFieldChange(key, val)}
                      onBlur={() => onFieldBlur?.(key)}
                      autoFocus={i === 0}
                    />
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Spacer at bottom of active group */}
            <div className="h-3" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
