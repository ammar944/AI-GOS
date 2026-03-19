'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Users, Package, TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldCard } from '@/components/journey/field-card';
import {
  JOURNEY_FIELD_GROUPS,
  JOURNEY_FIELD_LABELS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_PRICING_GROUP_KEYS,
  JOURNEY_MULTILINE_FIELDS,
  getManualBlockerMeta,
} from '@/lib/journey/field-catalog';

const GROUP_ICONS = [
  <Building2 key="biz" className="h-3.5 w-3.5" />,
  <Users key="cust" className="h-3.5 w-3.5" />,
  <Package key="offer" className="h-3.5 w-3.5" />,
  <TrendingUp key="comp" className="h-3.5 w-3.5" />,
  <Target key="goals" className="h-3.5 w-3.5" />,
];

export interface UnifiedFieldReviewProps {
  extractedFields: Record<string, string>;
  onStart: (onboardingData: Record<string, string>) => void;
}

export function UnifiedFieldReview({
  extractedFields,
  onStart,
}: UnifiedFieldReviewProps) {
  const [userEdits, setUserEdits] = useState<Record<string, string>>({});
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  // Merged field values: extracted → user edits (user edits win)
  const fieldValues = useMemo(() => {
    const merged: Record<string, string> = {};
    for (const [key, val] of Object.entries(extractedFields)) {
      if (val) merged[key] = val;
    }
    for (const [key, val] of Object.entries(userEdits)) {
      merged[key] = val;
    }
    return merged;
  }, [extractedFields, userEdits]);

  // Track which keys came from scraping
  const scrapedKeys = useMemo(() => {
    return new Set(
      Object.entries(extractedFields)
        .filter(([, val]) => val?.trim())
        .map(([key]) => key),
    );
  }, [extractedFields]);

  // Gate logic — all required fields must be filled
  const gateStatus = useMemo(() => {
    const missing: string[] = [];
    for (const key of JOURNEY_REQUIRED_FIELD_KEYS) {
      if (!fieldValues[key]?.trim()) {
        missing.push(key);
      }
    }
    const hasPricing = Array.from(JOURNEY_PRICING_GROUP_KEYS).some(
      (key) => fieldValues[key]?.trim(),
    );
    if (!hasPricing) {
      missing.push('pricingContext');
    }
    return { ready: missing.length === 0, missing };
  }, [fieldValues]);

  // Progress per group
  const groupProgress = useMemo(() => {
    return JOURNEY_FIELD_GROUPS.map((group) => {
      let filled = 0;
      for (const key of group.fieldKeys) {
        if (fieldValues[key]?.trim()) filled++;
      }
      return { filled, total: group.fieldKeys.length };
    });
  }, [fieldValues]);

  // Overall progress
  const progress = useMemo(() => {
    let filled = 0;
    let total = 0;
    for (const gp of groupProgress) {
      filled += gp.filled;
      total += gp.total;
    }
    return { filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }, [groupProgress]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setUserEdits((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleStart = useCallback(async () => {
    if (!gateStatus.ready || isStarting) return;
    setIsStarting(true);
    try {
      await onStart(fieldValues);
    } catch {
      setIsStarting(false);
    }
  }, [gateStatus.ready, isStarting, fieldValues, onStart]);

  const activeGroup = JOURNEY_FIELD_GROUPS[activeGroupIndex];

  return (
    <section className="flex-1 flex flex-col min-h-0">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-12 pb-32">
        <div className="max-w-3xl mx-auto pt-8 sm:pt-12">
          {/* Header */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.21, 0.45, 0.27, 0.9] }}
          >
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-foreground">
              Review your data
            </h2>
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">
              We found {scrapedKeys.size} fields from your site. Review and fill any missing required fields.
            </p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-medium text-[var(--text-secondary)]">
                Step {activeGroupIndex + 1} of {JOURNEY_FIELD_GROUPS.length}
              </span>
              <span className="text-[var(--text-quaternary)]">&middot;</span>
              <span className="text-[var(--text-tertiary)] font-mono tabular-nums">
                {progress.percent}% complete
              </span>
            </div>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--gradient-primary)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress.percent}%` }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </motion.div>

          {/* Horizontal step indicators */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {/* Desktop: full step indicators with connecting lines */}
            <div className="hidden sm:flex items-center justify-between relative" role="tablist" aria-label="Onboarding sections">
              {JOURNEY_FIELD_GROUPS.map((group, index) => {
                const isActive = index === activeGroupIndex;
                const gp = groupProgress[index];
                const isComplete = gp.filled === gp.total;

                return (
                  <div key={group.id} className="flex flex-col items-center gap-2 flex-1 relative z-10">
                    {/* Connector line (between circles) */}
                    {index > 0 && (
                      <div
                        className="absolute top-4 right-1/2 w-full h-0.5 -z-10"
                        style={{
                          background: groupProgress[index - 1].filled === groupProgress[index - 1].total
                            ? 'var(--accent-blue)'
                            : 'var(--border-hover)',
                        }}
                      />
                    )}

                    {/* Step circle */}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`${group.label} — ${gp.filled} of ${gp.total} filled`}
                      onClick={() => setActiveGroupIndex(index)}
                      className={cn(
                        'relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 cursor-pointer',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]',
                        'hover:scale-110',
                      )}
                      style={{
                        borderColor: isActive
                          ? 'var(--text-secondary)'
                          : isComplete
                            ? 'var(--accent-blue)'
                            : 'var(--border-hover)',
                        background: isActive
                          ? 'var(--text-secondary)'
                          : isComplete
                            ? 'var(--accent-blue)'
                            : 'var(--bg-hover)',
                        color: isActive
                          ? 'var(--bg-hover)'
                          : isComplete
                            ? '#fff'
                            : 'var(--text-tertiary)',
                      }}
                    >
                      {isComplete && !isActive ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        GROUP_ICONS[index]
                      )}

                      {/* Active pulse */}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ border: '2px solid var(--text-secondary)' }}
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </button>

                    {/* Label */}
                    <span
                      className={cn(
                        'text-[11px] font-medium text-center leading-tight transition-colors duration-200',
                      )}
                      style={{
                        color: isActive
                          ? 'var(--text-primary)'
                          : isComplete
                            ? 'var(--accent-blue)'
                            : 'var(--text-tertiary)',
                      }}
                    >
                      {group.label}
                    </span>

                    {/* Fill count */}
                    <span className="text-[9px] font-mono tabular-nums" style={{ color: 'var(--text-quaternary)' }}>
                      {gp.filled}/{gp.total}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile: scrollable pill buttons */}
            <div className="flex sm:hidden gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
              {JOURNEY_FIELD_GROUPS.map((group, index) => {
                const isActive = index === activeGroupIndex;
                const gp = groupProgress[index];
                const isComplete = gp.filled === gp.total;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveGroupIndex(index)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer',
                      isActive
                        ? 'bg-foreground text-background'
                        : isComplete
                          ? 'bg-[rgb(54,94,255)]/15 text-[rgb(54,94,255)] border border-[rgb(54,94,255)]/20'
                          : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-default)]',
                    )}
                  >
                    {isComplete && !isActive && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {group.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Active group fields */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeGroup.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--accent-blue-subtle)',
                boxShadow: 'var(--shadow-glow-blue), var(--shadow-elevated)',
              }}
            >
              {/* Group header */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'var(--accent-blue-glow)',
                    border: '1px solid var(--accent-blue-subtle)',
                  }}
                >
                  <span style={{ color: 'var(--accent-blue)' }}>
                    {GROUP_ICONS[activeGroupIndex]}
                  </span>
                </div>
                <div className="flex-1">
                  <h3
                    className="text-[15px] font-semibold tracking-[-0.01em]"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                  >
                    {activeGroup.label}
                  </h3>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {groupProgress[activeGroupIndex].filled} of {groupProgress[activeGroupIndex].total} filled
                  </p>
                </div>
              </div>

              {/* Field cards */}
              <div className="px-5 pb-4 space-y-1.5">
                {activeGroup.fieldKeys.map((key, i) => {
                  const fieldLabel = JOURNEY_FIELD_LABELS[key] || key;
                  const isRequired = JOURNEY_REQUIRED_FIELD_KEYS.has(key) || JOURNEY_PRICING_GROUP_KEYS.has(key);
                  const isScraped = scrapedKeys.has(key);
                  const isMultiline = JOURNEY_MULTILINE_FIELDS.has(key);
                  const blockerMeta = getManualBlockerMeta(key);

                  return (
                    <FieldCard
                      key={key}
                      fieldKey={key}
                      label={fieldLabel}
                      value={fieldValues[key] ?? ''}
                      placeholder={blockerMeta?.placeholder ?? ''}
                      helper={blockerMeta?.helper}
                      isRequired={isRequired}
                      isScraped={isScraped}
                      isMultiline={isMultiline}
                      onChange={(val) => handleFieldChange(key, val)}
                      autoFocus={i === 0}
                    />
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 border-t border-[var(--border-default)] px-6 sm:px-12 py-4 bg-[var(--bg-base)]/95 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Status */}
          <div className="flex-1 min-w-0">
            {gateStatus.ready ? (
              <p className="text-[13px] flex items-center gap-2 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Profile complete
              </p>
            ) : (
              <p className="text-[13px] flex items-center gap-2 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                {gateStatus.missing.length} required field{gateStatus.missing.length !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>

          {/* Navigation + Start buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {activeGroupIndex > 0 && (
              <button
                onClick={() => setActiveGroupIndex((prev) => prev - 1)}
                className="cursor-pointer h-10 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] font-medium text-[13px] px-5 transition-all hover:border-white/20 hover:text-[var(--text-secondary)]"
              >
                Back
              </button>
            )}

            {activeGroupIndex < JOURNEY_FIELD_GROUPS.length - 1 ? (
              <button
                onClick={() => setActiveGroupIndex((prev) => prev + 1)}
                className="cursor-pointer h-10 rounded-full bg-foreground text-background font-semibold text-[13px] px-6 transition-all hover:bg-foreground/90"
              >
                Next Section
              </button>
            ) : (
              <button
                disabled={!gateStatus.ready || isStarting}
                onClick={handleStart}
                className={cn(
                  'cursor-pointer h-10 rounded-full font-semibold text-[13px] px-6 transition-all',
                  gateStatus.ready && !isStarting
                    ? 'bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg'
                    : 'bg-[var(--bg-hover)] text-[var(--text-quaternary)] cursor-not-allowed',
                )}
              >
                {isStarting ? 'Starting...' : 'Start Research'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
