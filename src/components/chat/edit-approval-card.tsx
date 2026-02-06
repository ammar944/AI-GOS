'use client';

import { motion } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { GradientBorder } from '@/components/ui/gradient-border';
import { SECTION_LABELS } from '@/lib/ai/chat-tools/utils';
import { springs } from '@/lib/motion';

interface EditApprovalCardProps {
  section: string;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
  isApproving?: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function EditApprovalCard({
  section,
  fieldPath,
  explanation,
  diffPreview,
  isApproving,
  onApprove,
  onReject,
}: EditApprovalCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springs.smooth, duration: 0.3 }}
      className="my-2"
    >
      <GradientBorder className="w-full" innerClassName="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: '#f59e0b' }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-sm font-medium" style={{ color: '#f59e0b' }}>
            Proposed Edit
          </span>
        </div>

        <div
          className="rounded-lg p-3 space-y-2"
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}
        >
          <div
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="font-medium">
              {SECTION_LABELS[section] || section}
            </span>
            {' / '}
            <span className="font-mono">{fieldPath}</span>
          </div>
          <p
            className="text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {explanation}
          </p>
          <pre
            className="text-xs p-2 rounded overflow-auto max-h-20 font-mono whitespace-pre-wrap"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary)',
            }}
          >
            {diffPreview}
          </pre>
        </div>

        <div className="flex gap-2">
          <MagneticButton
            onClick={onApprove}
            disabled={isApproving}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
            style={{ background: '#22c55e', color: '#ffffff' }}
          >
            {isApproving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Approve
          </MagneticButton>
          <MagneticButton
            onClick={onReject}
            disabled={isApproving}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <X className="w-4 h-4" />
            Reject
          </MagneticButton>
        </div>
      </GradientBorder>
    </motion.div>
  );
}
