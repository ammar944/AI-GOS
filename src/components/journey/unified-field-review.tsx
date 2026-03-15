'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FieldGroup } from '@/components/journey/field-group';
import {
  JOURNEY_FIELD_GROUPS,
  JOURNEY_FIELD_LABELS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_PRICING_GROUP_KEYS,
} from '@/lib/journey/field-catalog';

export interface UnifiedFieldReviewProps {
  extractedFields: Record<string, string>;
  presetFields?: Record<string, string>;
  onStart: (onboardingData: Record<string, string>) => void;
}

export function UnifiedFieldReview({
  extractedFields,
  presetFields,
  onStart,
}: UnifiedFieldReviewProps) {
  // Merge preset → extracted → user edits (user edits win)
  const [userEdits, setUserEdits] = useState<Record<string, string>>({});
  const [activeGroupIndex, setActiveGroupIndex] = useState<number>(() => {
    // Find first group that has unfilled required fields
    for (let i = 0; i < JOURNEY_FIELD_GROUPS.length; i++) {
      const group = JOURNEY_FIELD_GROUPS[i];
      const hasUnfilled = group.fieldKeys.some((key) => {
        const val = extractedFields[key] || presetFields?.[key] || '';
        return (JOURNEY_REQUIRED_FIELD_KEYS.has(key) || JOURNEY_PRICING_GROUP_KEYS.has(key)) && !val.trim();
      });
      if (hasUnfilled) return i;
    }
    return 0;
  });
  const [isStarting, setIsStarting] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Merged field values: preset → extracted → user edits
  const fieldValues = useMemo(() => {
    const merged: Record<string, string> = {};
    // Layer 1: presets (lowest priority)
    if (presetFields) {
      for (const [key, val] of Object.entries(presetFields)) {
        if (val) merged[key] = val;
      }
    }
    // Layer 2: extracted (overwrites presets)
    for (const [key, val] of Object.entries(extractedFields)) {
      if (val) merged[key] = val;
    }
    // Layer 3: user edits (highest priority)
    for (const [key, val] of Object.entries(userEdits)) {
      merged[key] = val;
    }
    return merged;
  }, [extractedFields, presetFields, userEdits]);

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

    // Pricing group: at least one of pricingTiers or monthlyAdBudget
    const hasPricing = Array.from(JOURNEY_PRICING_GROUP_KEYS).some(
      (key) => fieldValues[key]?.trim(),
    );
    if (!hasPricing) {
      missing.push('pricingContext');
    }

    return { ready: missing.length === 0, missing };
  }, [fieldValues]);

  // Progress calculation
  const progress = useMemo(() => {
    let filled = 0;
    let total = 0;
    for (const group of JOURNEY_FIELD_GROUPS) {
      for (const key of group.fieldKeys) {
        total++;
        if (fieldValues[key]?.trim()) filled++;
      }
    }
    return { filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }, [fieldValues]);

  // Determine group state
  const getGroupState = useCallback(
    (index: number): 'active' | 'completed' | 'upcoming' => {
      if (index === activeGroupIndex) return 'active';
      if (index < activeGroupIndex) return 'completed';
      return 'upcoming';
    },
    [activeGroupIndex],
  );

  const handleFieldChange = useCallback((key: string, value: string) => {
    setUserEdits((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleContinue = useCallback(() => {
    if (activeGroupIndex < JOURNEY_FIELD_GROUPS.length - 1) {
      setActiveGroupIndex((prev) => prev + 1);
    }
  }, [activeGroupIndex]);

  const handleReopen = useCallback((index: number) => {
    setActiveGroupIndex(index);
  }, []);

  const handleFieldBlur = useCallback(
    (key: string) => {
      // Check if this is the last field in the active group
      const activeGroup = JOURNEY_FIELD_GROUPS[activeGroupIndex];
      if (!activeGroup) return;

      const lastKey = activeGroup.fieldKeys[activeGroup.fieldKeys.length - 1];
      if (key === lastKey) {
        // Auto-advance after 300ms delay
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = setTimeout(() => {
          if (activeGroupIndex < JOURNEY_FIELD_GROUPS.length - 1) {
            setActiveGroupIndex((prev) => prev + 1);
          }
        }, 300);
      }
    },
    [activeGroupIndex],
  );

  const handleStart = useCallback(async () => {
    if (!gateStatus.ready || isStarting) return;
    setIsStarting(true);
    try {
      await onStart(fieldValues);
    } catch {
      setIsStarting(false);
    }
  }, [gateStatus.ready, isStarting, fieldValues, onStart]);

  return (
    <section className="flex-1 flex flex-col min-h-0">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-12 pb-32">
        <div className="max-w-2xl mx-auto pt-8 sm:pt-12">
          {/* Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.21, 0.45, 0.27, 0.9] }}
          >
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-white">
              Review your data
            </h2>
            <p className="mt-2 text-sm text-white/40">
              We found {scrapedKeys.size} fields from your site. Review and fill any missing required fields.
            </p>
          </motion.div>

          {/* Progress indicator — compact */}
          <motion.div
            className="flex items-center gap-3 mb-6 px-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgb(30, 32, 38)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--gradient-primary)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress.percent}%` }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
              {progress.filled}/{progress.total}
            </span>
          </motion.div>

          {/* Field groups — progressive reveal */}
          <div className="space-y-2">
            {JOURNEY_FIELD_GROUPS.map((group, index) => (
              <FieldGroup
                key={group.id}
                group={group}
                groupIndex={index}
                state={getGroupState(index)}
                fieldValues={fieldValues}
                scrapedKeys={scrapedKeys}
                onFieldChange={handleFieldChange}
                onContinue={handleContinue}
                onReopen={() => handleReopen(index)}
                onFieldBlur={handleFieldBlur}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 border-t border-white/[0.06] px-6 sm:px-12 py-4 bg-[var(--bg-base)]/95 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
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

          {/* Step / Start buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {activeGroupIndex < JOURNEY_FIELD_GROUPS.length - 1 && !gateStatus.ready ? (
              <button
                onClick={handleContinue}
                className="cursor-pointer h-10 rounded-full bg-white text-black font-semibold text-[13px] px-6 transition-all hover:bg-white/90"
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
                    ? 'bg-white text-black hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(255,255,255,0.08)]'
                    : 'bg-white/10 text-white/30 cursor-not-allowed',
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
