'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessionHistory, type SessionSummary } from '@/lib/storage/local-storage';
import { cn } from '@/lib/utils';

interface SessionListProps {
  collapsed: boolean;
  currentSessionId?: string;
}

// ─── Status Dot ────────────────────────────────────────────────────────────────

interface StatusDotProps {
  status: SessionSummary['status'];
}

function StatusDot({ status }: StatusDotProps) {
  const colorMap: Record<SessionSummary['status'], string> = {
    active: 'var(--accent-green)',
    draft: 'var(--accent-amber)',
    complete: 'var(--text-quaternary)',
  };

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        flexShrink: 0,
        background: colorMap[status],
      }}
    />
  );
}

// ─── Session Row ───────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: SessionSummary;
  isActive: boolean;
}

function SessionRow({ session, isActive }: SessionRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      // TODO: Navigate to session route once multi-session is implemented
      onClick={() => { /* TODO: Navigate to session route once multi-session is implemented */ }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // TODO: Navigate to session route
        }
      }}
      className={cn('interactive-row flex items-center cursor-pointer select-none')}
      style={{
        gap: 8,
        padding: '7px 10px',
        borderRadius: 7,
        transition: 'background var(--transition-normal)',
        background: isActive ? 'var(--bg-hover)' : 'transparent',
        overflow: 'hidden',
      }}
    >
      <StatusDot status={session.status} />
      <span
        className="truncate"
        style={{
          fontSize: 12.5,
          color: isActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flex: '1 1 0',
          transition: 'color var(--transition-normal)',
        }}
      >
        {session.companyName ?? 'New Session'}
      </span>
    </div>
  );
}

// ─── Session List ──────────────────────────────────────────────────────────────

export function SessionList({ collapsed, currentSessionId }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>(() => {
    if (typeof window === 'undefined') return [];
    return getSessionHistory();
  });

  // Refresh session list when the tab regains focus
  const refresh = useCallback(() => setSessions(getSessionHistory()), []);
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.div
          key="session-list"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          {/* Section label */}
          <div
            style={{
              padding: '8px 16px 4px',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.01em',
              color: 'var(--text-quaternary)',
            }}
          >
            Recent
          </div>

          {/* Scrollable session rows */}
          <div
            className="session-list-scroll"
            style={{
              overflowY: 'auto',
              maxHeight: 200,
              padding: '2px 8px',
            }}
          >
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
