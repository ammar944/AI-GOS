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
  ok: 'text-emerald-400',
  run: 'text-blue-400',
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
      className={cn('rounded-3xl p-6 overflow-hidden', className)}
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Terminal header dots */}
      <div className="flex items-center gap-1.5 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="ml-2 text-[10px] font-mono text-white/20 uppercase tracking-widest">
          live feed
        </span>
      </div>

      {/* Lines */}
      <div
        ref={containerRef}
        className="space-y-1 overflow-y-auto custom-scrollbar"
        style={{ maxHeight: '160px' }}
      >
        {visibleLines.map((entry, i) => (
          <div key={i} className="flex gap-2 font-mono text-[11px] leading-relaxed">
            <span className={cn('flex-shrink-0', LEVEL_COLORS[entry.level] || 'text-white/20')}>
              [{LEVEL_LABELS[entry.level] || entry.level.toUpperCase()}]
            </span>
            <span className="text-white/40">{entry.message}</span>
          </div>
        ))}
        {/* Blinking cursor */}
        <div className="font-mono text-[11px] text-white/40">
          <span className={showCursor ? 'opacity-100' : 'opacity-0'}>_</span>
        </div>
      </div>
    </div>
  );
}
