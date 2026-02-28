'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JourneyProgress, MacroStageProgress } from '@/lib/journey/journey-progress-state';

interface ProgressTrackerProps {
  journeyProgress: JourneyProgress;
}

interface StageDotProps {
  status: MacroStageProgress['status'];
}

function StageDot({ status }: StageDotProps) {
  if (status === 'completed') {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 18,
          height: 18,
          background: 'var(--accent-green)',
        }}
      >
        <Check
          style={{ width: 10, height: 10, color: '#fff', strokeWidth: 2.5 }}
        />
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="flex-shrink-0 relative flex items-center justify-center" style={{ width: 18, height: 18 }}>
        {/* Pulsing outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--accent-blue)', opacity: 0.25 }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.25, 0, 0.25] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Solid ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid var(--accent-blue)' }}
        />
        {/* Inner dot */}
        <div
          className="rounded-full"
          style={{ width: 6, height: 6, background: 'var(--accent-blue)' }}
        />
      </div>
    );
  }

  // pending
  return (
    <div
      className="flex-shrink-0 rounded-full"
      style={{
        width: 18,
        height: 18,
        border: '2px solid var(--text-quaternary)',
      }}
    />
  );
}

interface ConnectorLineProps {
  afterCompleted: boolean;
}

function ConnectorLine({ afterCompleted }: ConnectorLineProps) {
  return (
    <div
      className="flex-shrink-0 self-center"
      style={{
        width: 2,
        height: 16,
        marginLeft: 8,
        background: afterCompleted
          ? 'rgba(34, 197, 94, 0.4)'
          : 'var(--border-default)',
        borderRadius: 1,
      }}
    />
  );
}

export function ProgressTracker({ journeyProgress }: ProgressTrackerProps) {
  const { stages } = journeyProgress;

  return (
    <div className="flex flex-col">
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        const prevStageCompleted = index > 0 && stages[index - 1].status === 'completed';

        const labelColor =
          stage.status === 'completed'
            ? 'var(--accent-green)'
            : stage.status === 'active'
              ? 'var(--text-primary)'
              : 'var(--text-quaternary)';

        const metaText =
          stage.status === 'completed'
            ? 'Done'
            : `${stage.completedCount}/${stage.totalCount}`;

        const metaColor =
          stage.status === 'completed'
            ? 'var(--accent-green)'
            : 'var(--text-quaternary)';

        return (
          <div key={stage.stage} className="flex flex-col">
            {/* Connector line before (except first) */}
            {index > 0 && (
              <ConnectorLine afterCompleted={prevStageCompleted} />
            )}

            {/* Stage row */}
            <div className="flex items-center gap-2.5">
              <StageDot status={stage.status} />

              <div className="flex items-center justify-between flex-1 min-w-0">
                <span
                  className={cn('truncate')}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: labelColor,
                  }}
                >
                  {stage.label}
                </span>
                <span
                  className="font-mono flex-shrink-0 ml-2"
                  style={{
                    fontSize: 10,
                    color: metaColor,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {metaText}
                </span>
              </div>
            </div>

            {/* Trailing connector (only if not last) */}
            {!isLast && (
              <ConnectorLine afterCompleted={stage.status === 'completed'} />
            )}
          </div>
        );
      })}
    </div>
  );
}
