'use client';

import { cn } from '@/lib/utils';
import type {
  JourneyWorkerStatusItem,
  JourneyWorkerStatusTone,
} from '@/lib/journey/research-worker-status';

interface JourneyWorkerStatusBannerProps {
  items: JourneyWorkerStatusItem[];
  className?: string;
}

const TONE_STYLES: Record<
  JourneyWorkerStatusTone,
  {
    badge: string;
    border: string;
    surface: string;
  }
> = {
  info: {
    badge: 'text-sky-200/90',
    border: 'border-sky-400/20',
    surface: 'bg-sky-400/[0.07]',
  },
  warning: {
    badge: 'text-amber-200/90',
    border: 'border-amber-400/25',
    surface: 'bg-amber-400/[0.08]',
  },
  error: {
    badge: 'text-red-200/90',
    border: 'border-red-400/25',
    surface: 'bg-red-400/[0.08]',
  },
};

export function JourneyWorkerStatusBanner({
  items,
  className,
}: JourneyWorkerStatusBannerProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="journey-worker-status-banner"
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
            Research Operations
          </p>
          <p className="mt-1 text-sm text-white/78">
            Journey is tracking worker pickup, background execution, and dispatch failures here.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const tone = TONE_STYLES[item.tone];
          return (
            <div
              key={`${item.section}-${item.kind}`}
              className={cn(
                'rounded-xl border px-3 py-3',
                tone.border,
                tone.surface,
              )}
            >
              <p className={cn('text-[11px] font-mono uppercase tracking-[0.16em]', tone.badge)}>
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/72">
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
