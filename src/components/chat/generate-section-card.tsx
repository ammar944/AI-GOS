'use client';

import { motion } from 'framer-motion';
import { Check, X, RefreshCw } from 'lucide-react';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { GradientBorder } from '@/components/ui/gradient-border';
import { SECTION_LABELS } from '@/lib/ai/chat-tools/utils';
import { springs } from '@/lib/motion';

const STYLE_LABELS: Record<string, string> = {
  enhance: 'Enhance',
  simplify: 'Simplify',
  rewrite: 'Rewrite',
  expand: 'Expand',
};

interface GenerateSectionCardProps {
  section: string;
  instruction: string;
  style: string;
  oldContent: unknown;
  newContent: unknown;
  diffPreview: string;
  onApprove?: () => void;
  onReject?: () => void;
  isApproved?: boolean;
  isRejected?: boolean;
}

function DiffLine({ line }: { line: string }) {
  const isRemoval = line.startsWith('-');
  const isAddition = line.startsWith('+');

  const lineStyle = isRemoval
    ? { color: '#ef4444', textDecoration: 'line-through' as const, opacity: 0.85 }
    : isAddition
      ? { color: '#22c55e' }
      : { color: 'var(--text-tertiary)' };

  return (
    <div className="font-mono" style={{ ...lineStyle, fontSize: '11px', lineHeight: '1.6' }}>
      {line}
    </div>
  );
}

export function GenerateSectionCard({
  section,
  instruction,
  style,
  // oldContent/newContent reserved for future rich diff view
  oldContent: _oldContent, // eslint-disable-line @typescript-eslint/no-unused-vars
  newContent: _newContent, // eslint-disable-line @typescript-eslint/no-unused-vars
  diffPreview,
  onApprove,
  onReject,
  isApproved = false,
  isRejected = false,
}: GenerateSectionCardProps) {
  const sectionLabel = SECTION_LABELS[section] || section;
  const styleLabel = STYLE_LABELS[style] || style;
  const showActions = !isApproved && !isRejected && (onApprove || onReject);
  const diffLines = diffPreview.split('\n');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springs.smooth, duration: 0.3 }}
      className="my-2"
    >
      <GradientBorder className="w-full" innerClassName="overflow-hidden">
        {/* Header */}
        <div
          className="px-4 py-3"
          style={{ background: 'rgba(245,158,11,0.04)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <span
                className="font-semibold uppercase tracking-wider"
                style={{ fontSize: '11px', letterSpacing: '0.05em', color: '#f59e0b' }}
              >
                Section Rewrite
              </span>
            </div>
            {/* Style badge */}
            <span
              className="rounded-full px-2 py-0.5 font-medium flex-shrink-0"
              style={{
                fontSize: '10px',
                background: 'rgba(245,158,11,0.12)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.25)',
              }}
            >
              {styleLabel}
            </span>
          </div>

          {/* Section name */}
          <p
            className="font-medium"
            style={{ fontSize: '13px', color: 'var(--text-primary)' }}
          >
            {sectionLabel}
          </p>

          {/* Instruction */}
          {instruction && (
            <p
              className="mt-1"
              style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
            >
              {instruction}
            </p>
          )}
        </div>

        {/* Diff view */}
        {diffPreview && (
          <div
            className="mx-4 my-3 rounded-lg p-3 overflow-auto"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              maxHeight: '200px',
            }}
          >
            {diffLines.map((line, i) => (
              <DiffLine key={i} line={line} />
            ))}
          </div>
        )}

        {/* Action area */}
        <div className="px-4 pb-4">
          {showActions && (
            <div className="flex gap-2">
              {onApprove && (
                <MagneticButton
                  onClick={onApprove}
                  className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 font-medium"
                  style={{
                    fontSize: '13px',
                    background: '#22c55e',
                    color: '#ffffff',
                  }}
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve (Y)
                </MagneticButton>
              )}
              {onReject && (
                <MagneticButton
                  onClick={onReject}
                  className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 font-medium"
                  style={{
                    fontSize: '13px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                  Reject (N)
                </MagneticButton>
              )}
            </div>
          )}

          {isApproved && (
            <div
              className="flex items-center justify-center gap-1.5 rounded-full py-1.5 px-4"
              style={{
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.25)',
              }}
            >
              <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
              <span
                className="font-medium"
                style={{ fontSize: '12px', color: '#22c55e' }}
              >
                Section rewritten
              </span>
            </div>
          )}

          {isRejected && (
            <p
              className="text-center"
              style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}
            >
              Rejected
            </p>
          )}
        </div>
      </GradientBorder>
    </motion.div>
  );
}
