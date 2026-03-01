import { cn } from '@/lib/utils';
import { JourneyProgressIndicator } from './journey-progress';
import type { JourneyProgress } from '@/lib/journey/journey-progress-state';

interface JourneyHeaderProps {
  className?: string;
  completionPercentage?: number;
  journeyProgress?: JourneyProgress | null;
}

export function JourneyHeader({
  className,
  completionPercentage = 0,
  journeyProgress,
}: JourneyHeaderProps) {
  const clamped = Math.min(100, Math.max(0, completionPercentage));

  return (
    <div className={cn(className)}>
      <header
        className="flex items-center justify-between px-6"
        style={{
          height: '56px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {/* Logo */}
        <div
          className="font-heading font-bold flex-shrink-0"
          style={{
            fontSize: '15px',
            background: 'var(--logo-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          AI-GOS
        </div>

        {/* Journey progress indicator (compact mode) */}
        {journeyProgress && (
          <JourneyProgressIndicator
            progress={journeyProgress}
            mode="compact"
            className="flex-1 mx-4"
          />
        )}
      </header>

      {/* Thin progress bar — secondary indicator */}
      <div
        style={{
          height: '2px',
          width: '100%',
          backgroundColor: 'var(--bg-overlay-light)',
        }}
      >
        <div
          role="progressbar"
          aria-valuenow={clamped}
          style={{
            height: '100%',
            width: `${clamped}%`,
            backgroundColor: 'var(--accent-blue)',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
}
