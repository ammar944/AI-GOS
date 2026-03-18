'use client';

import { cn } from '@/lib/utils';

export type StepperPhase = 'discovery' | 'validation' | 'strategy' | 'launch';
export type StepStatus = 'complete' | 'active' | 'pending';

interface JourneyStepperProps {
  /** The currently active phase */
  currentPhase?: StepperPhase;
  /** Phases that have been completed */
  completedPhases?: StepperPhase[];
  className?: string;
}

const PHASES: { id: StepperPhase; label: string }[] = [
  { id: 'discovery', label: 'Discovery' },
  { id: 'validation', label: 'Validation' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'launch', label: 'Launch' },
];

function getStatus(
  phase: StepperPhase,
  currentPhase: StepperPhase,
  completedPhases: StepperPhase[],
): StepStatus {
  if (completedPhases.includes(phase)) return 'complete';
  if (phase === currentPhase) return 'active';
  return 'pending';
}

export function JourneyStepper({
  currentPhase = 'discovery',
  completedPhases = [],
  className,
}: JourneyStepperProps) {
  return (
    <div className={cn('flex justify-center gap-12 py-8 flex-none', className)}>
      {PHASES.map((phase) => {
        const status = getStatus(phase.id, currentPhase, completedPhases);
        return (
          <div
            key={phase.id}
            className={cn(
              'flex flex-col items-center gap-2 cursor-default',
              status === 'pending' && 'opacity-30',
            )}
          >
            {/* Status dot */}
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                status === 'complete' && 'bg-brand-success ring-4 ring-brand-success/20',
                status === 'active' && 'bg-brand-accent animate-pulse',
                status === 'pending' && 'bg-white/50',
              )}
            />
            {/* Label */}
            <span
              className={cn(
                'text-[10px] uppercase tracking-widest font-semibold',
                status === 'complete' && 'text-brand-success',
                status === 'active' && 'text-brand-accent',
                status === 'pending' && 'text-[var(--text-secondary)]',
              )}
            >
              {phase.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
