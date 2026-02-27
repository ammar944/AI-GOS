'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs, durations, fadeUp, staggerContainer, staggerItem } from '@/lib/motion';
import { useBlueprintGeneration } from '@/hooks/use-blueprint-generation';
import { BLUEPRINT_STAGES } from '@/hooks/use-generate-page-state';
import type { OnboardingFormData } from '@/lib/onboarding/types';

interface BlueprintPanelProps {
  onboardingData: OnboardingFormData;
  className?: string;
}

const SECTION_KEYS = [
  'industryMarketOverview',
  'icpAnalysisValidation',
  'offerAnalysisViability',
  'competitorAnalysis',
  'keywordIntelligence',
  'crossAnalysisSynthesis',
] as const;

/**
 * Right-panel blueprint generation progress for the journey review phase.
 * Starts generation automatically on mount using the existing SSE hook.
 */
export function BlueprintPanel({ onboardingData, className }: BlueprintPanelProps) {
  const hasStarted = useRef(false);

  const {
    blueprintProgress,
    error,
    isGenerating,
    elapsedTime,
    streamingCost,
    strategicBlueprint,
    generate,
  } = useBlueprintGeneration();

  // Kick off generation once on mount
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    generate(onboardingData);
  }, [generate, onboardingData]);

  const completedSections = blueprintProgress?.completedSections ?? [];
  const currentSection = blueprintProgress?.currentSection;
  const progressMessage = blueprintProgress?.progressMessage ?? 'Preparing...';
  const isDone = !!strategicBlueprint;
  const hasError = !!error;

  const elapsed = Math.round(elapsedTime / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div
      className={cn('flex flex-col h-full', className)}
      style={{ background: 'var(--bg-elevated)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 shrink-0"
        style={{
          height: '56px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-heading font-semibold text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            Strategic Blueprint
          </span>
          {isGenerating && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(54, 94, 255, 0.15)',
                color: 'var(--accent-blue)',
              }}
            >
              Generating
            </span>
          )}
          {isDone && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
              }}
            >
              Complete
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {timeStr}
        </span>
      </div>

      {/* Progress body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Status message */}
        <motion.p
          key={progressMessage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.fast }}
          className="text-sm mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          {progressMessage}
        </motion.p>

        {/* Section progress list */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {SECTION_KEYS.map((key, i) => {
            const label = BLUEPRINT_STAGES[i] ?? key;
            const isCompleted = completedSections.includes(key);
            const isCurrent = currentSection === key && !isCompleted;

            return (
              <motion.div
                key={key}
                variants={staggerItem}
                transition={springs.gentle}
                className="flex items-center gap-3"
              >
                <SectionIcon
                  status={isCompleted ? 'done' : isCurrent ? 'active' : 'pending'}
                />
                <span
                  className={cn('text-sm transition-colors duration-200')}
                  style={{
                    color: isCompleted
                      ? 'var(--text-primary)'
                      : isCurrent
                        ? 'var(--accent-blue)'
                        : 'var(--text-tertiary)',
                    fontWeight: isCurrent ? 500 : 400,
                  }}
                >
                  {label}
                </span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Error state */}
        <AnimatePresence>
          {hasError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-6 flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <span className="text-xs" style={{ color: '#ef4444' }}>
                {error.message}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Done state */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.2, ...springs.gentle }}
              className="mt-8 px-4 py-4 rounded-xl text-center"
              style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}
            >
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2" style={{ color: '#22c55e' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Blueprint ready
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {streamingCost > 0
                  ? `${timeStr} · $${streamingCost.toFixed(3)}`
                  : timeStr}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SectionIcon({ status }: { status: 'done' | 'active' | 'pending' }) {
  if (status === 'done') {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springs.snappy}
      >
        <CheckCircle2 className="h-4 w-4" style={{ color: '#22c55e' }} />
      </motion.div>
    );
  }
  if (status === 'active') {
    return <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-blue)' }} />;
  }
  return <Circle className="h-4 w-4" style={{ color: 'var(--text-quaternary, rgba(255,255,255,0.2))' }} />;
}
