'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaleIn, springs } from '@/lib/motion';

interface ResearchPhase {
  name: string;
  status: 'done' | 'active' | 'pending';
  count?: string;
}

interface ResearchProgressCardProps {
  phases: ResearchPhase[];
  className?: string;
}

function PhaseDot({ status }: { status: ResearchPhase['status'] }) {
  if (status === 'done') {
    return (
      <span
        className="flex-shrink-0 rounded-full"
        style={{ width: 7, height: 7, background: 'var(--accent-green)' }}
      />
    );
  }

  if (status === 'active') {
    return (
      <motion.span
        className="flex-shrink-0 rounded-full"
        style={{ width: 7, height: 7, background: 'var(--accent-blue)' }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }

  // pending
  return (
    <span
      className="flex-shrink-0 rounded-full"
      style={{ width: 7, height: 7, background: 'var(--text-tertiary)', opacity: 0.35 }}
    />
  );
}

export function ResearchProgressCard({ phases, className }: ResearchProgressCardProps) {
  // Auto-advance phases on a timer so Phase 3 gets its moment
  const [advancedPhases, setAdvancedPhases] = useState(phases);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAdvancedPhases(phases);

    // If Phase 2 is active, auto-advance to Phase 3 after 4 seconds
    const phase2 = phases[1];
    const phase3 = phases[2];
    if (phase2?.status === 'active' && phase3?.status === 'pending') {
      timerRef.current = setTimeout(() => {
        setAdvancedPhases((prev) =>
          prev.map((p, i) =>
            i === 1 ? { ...p, status: 'done' as const, count: 'done' } :
            i === 2 ? { ...p, status: 'active' as const } :
            p
          )
        );
      }, 4000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phases]);

  const doneCount = advancedPhases.filter((p) => p.status === 'done').length;
  const total = advancedPhases.length;

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={springs.smooth}
      className={cn('rounded-xl overflow-hidden my-2', className)}
      style={{ border: '1px solid var(--border-default)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: 'rgba(54,94,255,0.04)' }}
      >
        <Search
          className="flex-shrink-0"
          style={{ width: 13, height: 13, color: 'var(--accent-blue)' }}
        />
        <span
          className="font-semibold uppercase tracking-wider"
          style={{ fontSize: '11px', letterSpacing: '0.06em', color: 'var(--accent-blue)' }}
        >
          Researching
        </span>

        {/* Pulsing blue live dot */}
        <motion.span
          className="rounded-full flex-shrink-0"
          style={{ width: 6, height: 6, background: 'var(--accent-blue)' }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        />

        {total > 0 && (
          <span
            className="ml-auto font-mono"
            style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}
          >
            {doneCount}/{total}
          </span>
        )}
      </div>

      {/* Phase list */}
      {advancedPhases.length > 0 && (
        <div
          className="px-4 py-3 space-y-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {advancedPhases.map((phase, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.2 }}
              className="flex items-center gap-2.5"
            >
              <PhaseDot status={phase.status} />

              <span
                className={cn(
                  'flex-1 min-w-0 truncate leading-tight',
                  phase.status === 'active' && 'font-semibold',
                  phase.status === 'pending' && 'opacity-40'
                )}
                style={{
                  fontSize: '12px',
                  color:
                    phase.status === 'done'
                      ? 'var(--text-secondary)'
                      : phase.status === 'active'
                        ? 'var(--text-primary)'
                        : 'var(--text-tertiary)',
                }}
              >
                {phase.name}
              </span>

              {phase.count && phase.status !== 'pending' && (
                <span
                  className="flex-shrink-0 font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
                >
                  {phase.count}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
