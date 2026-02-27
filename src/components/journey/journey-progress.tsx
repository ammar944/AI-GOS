'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { useState, useCallback } from 'react';
import type {
  JourneyProgress,
  MacroStageProgress,
  SubStage,
  StageStatus,
} from '@/lib/journey/journey-progress-state';

// ── Props ─────────────────────────────────────────────────────────────────────

interface JourneyProgressProps {
  progress: JourneyProgress;
  mode?: 'compact' | 'expanded';
  className?: string;
}

interface CompactStageProps {
  stage: MacroStageProgress;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

interface ExpandedStageProps {
  stage: MacroStageProgress;
  index: number;
  isLast: boolean;
}

// ── Status dot/icon ───────────────────────────────────────────────────────────

function StatusIndicator({ status, size = 'md' }: { status: StageStatus; size?: 'sm' | 'md' }) {
  const dimensions = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  if (status === 'completed') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className={cn(dimensions, 'rounded-full flex items-center justify-center')}
        style={{ background: 'var(--accent-green, rgb(34, 197, 94))' }}
      >
        <Check className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} strokeWidth={3} style={{ color: 'white' }} />
      </motion.div>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      <div
        className={cn(dotSize, 'rounded-full')}
        style={{
          background: status === 'active'
            ? 'var(--accent-blue, rgb(54, 94, 255))'
            : 'var(--text-quaternary, rgb(71, 76, 89))',
        }}
      />
      {status === 'active' && (
        <motion.div
          animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className={cn(dotSize, 'absolute rounded-full')}
          style={{ background: 'var(--accent-blue, rgb(54, 94, 255))' }}
        />
      )}
    </div>
  );
}

// ── Connection line between dots ──────────────────────────────────────────────

function ConnectionLine({ isComplete }: { isComplete: boolean }) {
  return (
    <div
      className="relative h-0.5 overflow-hidden rounded-full"
      style={{
        width: 24,
        background: 'rgba(255, 255, 255, 0.06)',
      }}
    >
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: isComplete ? 1 : 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="h-full origin-left"
        style={{
          background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.6), rgba(34, 197, 94, 0.3))',
        }}
      />
    </div>
  );
}

// ── Compact stage (header) ────────────────────────────────────────────────────

function CompactStage({ stage, index, isLast, isExpanded, onToggle }: CompactStageProps) {
  const progressText = stage.status === 'completed'
    ? 'Done'
    : stage.status === 'active'
      ? `${stage.completedCount}/${stage.totalCount}`
      : '';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-200',
          'hover:bg-white/[0.04] cursor-pointer select-none',
          stage.status === 'pending' && 'opacity-50',
        )}
        style={{ border: 'none', background: 'transparent' }}
      >
        <StatusIndicator status={stage.status} size="sm" />

        <span
          className="text-xs font-medium whitespace-nowrap"
          style={{
            color: stage.status === 'completed'
              ? 'var(--accent-green, rgb(34, 197, 94))'
              : stage.status === 'active'
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {stage.label}
        </span>

        {progressText && (
          <span
            className="text-[10px] tabular-nums"
            style={{
              color: stage.status === 'completed'
                ? 'var(--accent-green, rgb(34, 197, 94))'
                : 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {progressText}
          </span>
        )}

        {stage.status !== 'pending' && (
          <ChevronDown
            className={cn(
              'w-3 h-3 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
            style={{ color: 'var(--text-tertiary)' }}
          />
        )}
      </button>

      {!isLast && <ConnectionLine isComplete={stage.status === 'completed'} />}
    </div>
  );
}

// ── Substage dropdown (compact mode) ──────────────────────────────────────────

function SubstageDropdown({ substages }: { substages: SubStage[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div
        className="mt-1 py-2 px-3 rounded-lg"
        style={{
          background: 'var(--bg-elevated, rgba(255, 255, 255, 0.03))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
        }}
      >
        <div className="flex flex-col gap-1.5">
          {substages.map((sub) => (
            <div key={sub.key} className="flex items-center gap-2">
              <StatusIndicator status={sub.status} size="sm" />
              <span
                className="text-[11px]"
                style={{
                  color: sub.status === 'completed'
                    ? 'var(--accent-green, rgb(34, 197, 94))'
                    : sub.status === 'active'
                      ? 'var(--accent-blue, rgb(54, 94, 255))'
                      : 'var(--text-tertiary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {sub.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Expanded stage (sidebar/overlay) ──────────────────────────────────────────

function ExpandedStage({ stage, index, isLast }: ExpandedStageProps) {
  return (
    <div className="flex gap-3">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <StatusIndicator status={stage.status} />
        {!isLast && (
          <div
            className="flex-1 w-px mt-2 mb-1"
            style={{
              background: stage.status === 'completed'
                ? 'rgba(34, 197, 94, 0.3)'
                : 'rgba(255, 255, 255, 0.08)',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-sm font-medium"
            style={{
              color: stage.status === 'completed'
                ? 'var(--accent-green, rgb(34, 197, 94))'
                : stage.status === 'active'
                  ? 'var(--text-primary)'
                  : 'var(--text-tertiary)',
            }}
          >
            {stage.label}
          </span>
          <span
            className="text-[10px] tabular-nums"
            style={{
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stage.completedCount}/{stage.totalCount}
          </span>
        </div>

        {/* Substages */}
        <div className="flex flex-col gap-1 ml-0.5">
          {stage.substages.map((sub) => (
            <div key={sub.key} className="flex items-center gap-2">
              <StatusIndicator status={sub.status} size="sm" />
              <span
                className="text-xs"
                style={{
                  color: sub.status === 'completed'
                    ? 'var(--accent-green, rgb(34, 197, 94))'
                    : sub.status === 'active'
                      ? 'var(--accent-blue, rgb(54, 94, 255))'
                      : 'var(--text-quaternary, rgb(71, 76, 89))',
                }}
              >
                {sub.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function JourneyProgressIndicator({
  progress,
  mode = 'compact',
  className,
}: JourneyProgressProps) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const handleToggle = useCallback((index: number) => {
    setExpandedStage((prev) => (prev === index ? null : index));
  }, []);

  if (mode === 'expanded') {
    return (
      <div className={cn('flex flex-col', className)}>
        {progress.stages.map((stage, i) => (
          <ExpandedStage
            key={stage.stage}
            stage={stage}
            index={i}
            isLast={i === progress.stages.length - 1}
          />
        ))}
      </div>
    );
  }

  // Compact mode (header)
  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center justify-center gap-1">
        {progress.stages.map((stage, i) => (
          <CompactStage
            key={stage.stage}
            stage={stage}
            index={i}
            isLast={i === progress.stages.length - 1}
            isExpanded={expandedStage === i}
            onToggle={() => handleToggle(i)}
          />
        ))}
      </div>

      {/* Dropdown panel for expanded substages */}
      <AnimatePresence>
        {expandedStage !== null && progress.stages[expandedStage].status !== 'pending' && (
          <SubstageDropdown substages={progress.stages[expandedStage].substages} />
        )}
      </AnimatePresence>
    </div>
  );
}
