'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TerminalLogEntry {
  level: 'ok' | 'run' | 'inf' | 'warn' | 'err';
  message: string;
  timestamp: number;
}

interface TerminalStreamProps {
  logs?: TerminalLogEntry[];
  className?: string;
  maxLines?: number;
}

const LEVEL_COLORS: Record<string, string> = {
  ok: 'text-brand-success',
  run: 'text-brand-accent',
  inf: 'text-white/20',
  warn: 'text-amber-400',
  err: 'text-red-400',
};

const LEVEL_LABELS: Record<string, string> = {
  ok: 'OK',
  run: 'RUN',
  inf: 'INF',
  warn: 'WARN',
  err: 'ERR',
};

export function TerminalStream({
  logs = [],
  className,
  maxLines = 8,
}: TerminalStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCursor, setShowCursor] = useState(true);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const visibleLines = logs.slice(-maxLines);

  return (
    <div
      className={cn('glass-surface rounded-module p-6 font-mono text-[11px] text-white/40 bg-black/40', className)}
    >
      {/* Lines */}
      <div
        ref={containerRef}
        className="space-y-1 overflow-y-auto custom-scrollbar"
        style={{ maxHeight: '160px' }}
      >
        {visibleLines.map((entry, i) => (
          <p key={i}>
            <span className={cn(LEVEL_COLORS[entry.level] || 'text-white/20')}>
              [{LEVEL_LABELS[entry.level] || entry.level.toUpperCase()}]
            </span>{' '}
            {entry.message}
          </p>
        ))}
        {/* Blinking cursor */}
        <p>
          <span className={cn('text-brand-accent', showCursor ? 'opacity-100' : 'opacity-0')}>
            _
          </span>
        </p>
      </div>
    </div>
  );
}
