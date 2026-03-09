'use client';

import { cn } from '@/lib/utils';
import { Sparkles, FileText, Bell } from 'lucide-react';

interface JourneyHeaderProps {
  className?: string;
  completionPercentage?: number;
  onNewJourney?: () => void;
}

export function JourneyHeader({
  className,
  completionPercentage = 0,
  onNewJourney,
}: JourneyHeaderProps) {
  const clamped = Math.min(100, Math.max(0, completionPercentage));

  return (
    <header
      className={cn('relative flex-none h-14 flex items-center justify-between px-6', className)}
      style={{
        borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.06))',
        background: 'var(--bg-glass-panel, rgba(10,10,14,0.6))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Top progress bar — gradient blue→green */}
      <div
        className="absolute top-0 left-0 w-full h-[2px]"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <div
          className="h-full transition-all duration-1000 ease-in-out header-progress"
          style={{ width: `${clamped}%` }}
        />
      </div>

      {/* Left: Logo + label */}
      <div className="flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'var(--logo-gradient, linear-gradient(135deg, #3c83f6, #10B981))',
            boxShadow: '0 0 16px rgba(60, 131, 246, 0.15)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-sm font-semibold tracking-tight"
            style={{
              fontFamily: 'var(--font-heading)',
              background: 'var(--logo-gradient, linear-gradient(135deg, #3c83f6, #10B981))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AIGOS
          </span>
          <span
            className="text-[10px]"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-quaternary, #444)',
              padding: '1px 5px',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              borderRadius: '4px',
              lineHeight: 1.4,
            }}
          >
            v2.0
          </span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 ml-4">
          <span style={{ color: 'var(--text-quaternary, #555)', fontSize: 11 }}>/</span>
          <span
            className="text-[11px] font-medium"
            style={{
              color: 'var(--text-secondary, #cdd0d5)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Journey
          </span>
          {clamped > 0 && (
            <>
              <span style={{ color: 'var(--text-quaternary, #555)', fontSize: 11 }}>/</span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--brand-accent, #3c83f6)',
                  background: 'rgba(60, 131, 246, 0.08)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {clamped}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150"
          style={{
            color: 'var(--text-tertiary, #888)',
            background: 'transparent',
            border: '1px solid transparent',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-card, rgba(255,255,255,0.03))';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle, rgba(255,255,255,0.06))';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
          }}
        >
          <FileText className="w-3 h-3" />
          Docs
        </button>

        <button
          className="relative flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150"
          style={{
            color: 'var(--text-quaternary, #555)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            background: 'var(--bg-glass-card, rgba(255,255,255,0.03))',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(60, 131, 246, 0.2)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary, #cdd0d5)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle, rgba(255,255,255,0.06))';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-quaternary, #555)';
          }}
        >
          <Bell className="w-3.5 h-3.5" />
        </button>

        {onNewJourney && (
          <button
            onClick={onNewJourney}
            className="px-3.5 py-1.5 rounded-full text-[11px] font-medium text-white transition-all duration-150"
            style={{
              background: 'var(--brand-accent, #3c83f6)',
              fontFamily: 'var(--font-heading)',
              boxShadow: '0 0 16px rgba(60, 131, 246, 0.15)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(60, 131, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(60, 131, 246, 0.15)';
            }}
          >
            New Journey
          </button>
        )}
      </div>
    </header>
  );
}
