'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CitationList } from './citation-list';

export interface ResearchCardShellProps {
  icon: LucideIcon;
  label: string;
  accentColor: string;
  status: 'streaming' | 'complete' | 'error';
  streamingText?: string;
  citations?: Array<{ number: number; url: string; title?: string }>;
  error?: string;
  children?: React.ReactNode;
  className?: string;
  reviewStatus?: 'pending' | 'approved' | 'needs-revision';
  onApprove?: () => void;
  onRequestRevision?: (note: string) => void;
}

export function ResearchCardShell({
  icon: Icon,
  label,
  accentColor,
  status,
  streamingText,
  citations,
  error,
  children,
  className,
  reviewStatus = 'pending',
  onApprove,
  onRequestRevision,
}: ResearchCardShellProps) {
  const [expanded, setExpanded] = useState(true);
  const [showRevisionComposer, setShowRevisionComposer] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [revisionPending, setRevisionPending] = useState(false);

  // Clear revision pending when the section starts re-running
  useEffect(() => {
    if (status === 'streaming' && revisionPending) {
      setRevisionPending(false);
    }
  }, [status, revisionPending]);

  return (
    <div
      className={cn('research-card-accent rounded-2xl overflow-hidden my-4', className)}
      style={{
        '--card-accent-gradient': accentColor,
        background: 'var(--bg-hover)',
        borderTop: '1px solid var(--border-subtle)',
        borderRight: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      } as React.CSSProperties}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon
            style={{ width: 14, height: 14, color: accentColor, flexShrink: 0 }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: accentColor,
            }}
          >
            {label}
          </div>
        </div>

        {/* Status badge */}
        <span className="ml-auto flex items-center gap-2">
          {status === 'complete' && (
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: 18,
                height: 18,
                background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-green) 25%, transparent)',
              }}
            >
              <Check style={{ width: 12, height: 12, color: 'var(--accent-green)' }} />
            </span>
          )}
          {status === 'error' && (
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: 18,
                height: 18,
                background: 'color-mix(in srgb, var(--accent-red) 16%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
              }}
            >
              <AlertCircle style={{ width: 12, height: 12, color: 'var(--accent-red)' }} />
            </span>
          )}
          <ChevronDown
            style={{
              width: 12,
              height: 12,
              color: 'var(--text-tertiary)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
          />
        </span>
      </button>

      {/* Streaming bar */}
      {status === 'streaming' && (
        <div
          className="research-streaming-bar"
          style={{ '--bar-color': accentColor } as React.CSSProperties}
        />
      )}

      {/* Content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2">
              {status === 'error' && error && (
                <p style={{ fontSize: 12, color: 'var(--accent-red)' }}>{error}</p>
              )}

              {status === 'streaming' && streamingText && (
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {streamingText}
                  <span className="streaming-cursor" aria-hidden="true" />
                </div>
              )}

              {status === 'complete' && children}

              {status === 'complete' && (onApprove || onRequestRevision) && (
                <div className="mb-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRevisionComposer(false);
                        setRevisionNote('');
                        onApprove?.();
                      }}
                      disabled={!onApprove || reviewStatus === 'approved' || reviewStatus === 'needs-revision'}
                      className="rounded-full text-xs font-medium"
                      style={{
                        padding: '4px 10px',
                        background:
                          reviewStatus === 'approved'
                            ? 'color-mix(in srgb, var(--accent-green) 16%, transparent)'
                            : 'var(--bg-base)',
                        border: '1px solid var(--border-subtle)',
                        color:
                          reviewStatus === 'approved'
                            ? 'var(--accent-green)'
                            : 'var(--text-secondary)',
                        opacity: onApprove && reviewStatus !== 'needs-revision' ? 1 : 0.5,
                      }}
                    >
                      {reviewStatus === 'approved' ? (
                        <Check style={{ width: 12, height: 12 }} />
                      ) : reviewStatus === 'needs-revision' ? (
                        'Awaiting rerun'
                      ) : (
                        'Approve section'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRevisionComposer((prev) => !prev)}
                      disabled={!onRequestRevision}
                      className="rounded-full text-xs font-medium"
                      style={{
                        padding: '4px 10px',
                        background:
                          showRevisionComposer || reviewStatus === 'needs-revision'
                            ? 'color-mix(in srgb, var(--accent-red) 12%, transparent)'
                            : 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color:
                          showRevisionComposer || reviewStatus === 'needs-revision'
                            ? 'var(--accent-red)'
                            : 'var(--text-secondary)',
                        opacity: onRequestRevision ? 1 : 0.5,
                      }}
                    >
                      {showRevisionComposer ? 'Hide' : 'Revise'}
                    </button>
                  </div>

                  {showRevisionComposer && onRequestRevision && (
                    <div
                      className="rounded-2xl p-3"
                      style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <label
                        className="mb-2 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        What should change before downstream sections update?
                      </label>
                      <textarea
                        value={revisionNote}
                        onChange={(event) => setRevisionNote(event.target.value)}
                        rows={3}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={{
                          background: 'color-mix(in srgb, var(--bg-hover) 85%, transparent)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          resize: 'vertical',
                        }}
                        placeholder="Example: Narrow the ICP to US-based growth-stage SaaS teams and update the downstream recommendations."
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const note = revisionNote.trim();
                            if (!note) return;
                            onRequestRevision(note);
                            setShowRevisionComposer(false);
                            setRevisionNote('');
                            setRevisionPending(true);
                          }}
                          disabled={revisionNote.trim().length === 0}
                          className="rounded-full px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)',
                            color: 'var(--accent-red)',
                            opacity: revisionNote.trim().length > 0 ? 1 : 0.5,
                          }}
                        >
                          Submit revision
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRevisionComposer(false);
                            setRevisionNote('');
                          }}
                          className="rounded-full px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {revisionPending && !showRevisionComposer && (
                    <div
                      className="mt-2 flex items-center gap-2 text-xs font-medium"
                      style={{ color: 'var(--accent-red)' }}
                    >
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Revising…
                    </div>
                  )}
                </div>
              )}

              {/* Citations */}
              {status === 'complete' && citations && citations.length > 0 && (
                <CitationList citations={citations} />
              )}

              {status === 'complete' && (!citations || citations.length === 0) && (
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--text-quaternary)',
                    fontStyle: 'italic',
                  }}
                >
                  This section completed without visible citations. Treat it as provisional until verified.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
