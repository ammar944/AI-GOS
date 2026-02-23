'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Wrench } from 'lucide-react';
import { springs } from '@/lib/motion';

interface ValidationAutoFixDisplay {
  validator: string;
  field: string;
  oldValue: string | number;
  newValue: string | number;
  rule: string;
  reason: string;
}

interface ValidationCascadeCardProps {
  autoFixes: ValidationAutoFixDisplay[];
  warnings: string[];
  validatorsRun: string[];
  onApplyFixes?: () => void;
}

export function ValidationCascadeCard({
  autoFixes,
  warnings,
  validatorsRun,
}: ValidationCascadeCardProps) {
  const hasAutoFixes = autoFixes.length > 0;
  const hasWarnings = warnings.length > 0;

  if (!hasAutoFixes && !hasWarnings) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg my-1 text-xs"
        style={{
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.15)',
          color: '#22c55e',
        }}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        All sections consistent. No fixes needed.
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springs.smooth, duration: 0.3 }}
      className="rounded-lg overflow-hidden my-2"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(0, 0, 0, 0.15)',
        }}
      >
        <Wrench className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Validation Cascade
        </span>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          {validatorsRun.length} validator{validatorsRun.length !== 1 ? 's' : ''} run
        </span>
      </div>

      <div className="p-3 space-y-2">
        {/* Auto-fixes */}
        {hasAutoFixes && (
          <div className="space-y-1.5">
            {autoFixes.map((fix, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[11px]"
              >
                <CheckCircle2
                  className="w-3 h-3 mt-0.5 flex-shrink-0"
                  style={{ color: '#22c55e' }}
                />
                <div className="min-w-0">
                  <span
                    className="inline-block px-1 py-0.5 rounded text-[10px] font-mono mr-1"
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#22c55e',
                    }}
                  >
                    {fix.rule}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {fix.field}:{' '}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {String(fix.oldValue)} → {String(fix.newValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div className="space-y-1.5">
            {warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[11px]"
              >
                <AlertTriangle
                  className="w-3 h-3 mt-0.5 flex-shrink-0"
                  style={{ color: '#f59e0b' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {warning}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
