'use client';

import { cn } from '@/lib/utils';

export interface ProgressItem {
  id: string;
  label: string;
  status: 'complete' | 'active' | 'queued';
  detail?: string;
}

interface JourneyProgressPanelProps {
  items?: ProgressItem[];
  computeStatus?: string;
  computePercent?: number;
  className?: string;
}

export function JourneyProgressPanel({
  items = [],
  computeStatus = 'stable',
  computePercent = 85,
  className,
}: JourneyProgressPanelProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <h3 className="text-xs font-mono text-white/30 uppercase tracking-widest mb-10">
        Journey Progress
      </h3>

      {/* Timeline */}
      <div className="relative flex-1">
        {/* Vertical Timeline Line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/10" />

        <div className="space-y-12 relative">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex gap-4',
                item.status === 'queued' && 'opacity-30',
              )}
            >
              {/* Dot */}
              <div
                className={cn(
                  'relative z-10 w-3.5 h-3.5 rounded-full border-4 border-[#050505]',
                  item.status === 'complete' && 'bg-brand-success',
                  item.status === 'active' && 'bg-brand-accent animate-pulse',
                  item.status === 'queued' && 'bg-white/20',
                )}
              />

              {/* Label + detail */}
              <div className="flex flex-col gap-1 -mt-1">
                <span
                  className={cn(
                    'text-xs font-medium',
                    item.status === 'active' && 'text-brand-accent',
                  )}
                >
                  {item.label}
                </span>
                {item.detail && (
                  <span
                    className={cn(
                      'text-[10px]',
                      item.status === 'complete' && 'text-white/30',
                      item.status === 'active' && 'text-brand-accent/60',
                      item.status === 'queued' && 'text-white/30',
                    )}
                  >
                    {item.detail}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Status Footer */}
      <div className="mt-auto glass-surface rounded-xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-white/40">Compute Node</span>
          <span
            className={cn(
              'text-[10px]',
              computeStatus === 'stable' ? 'text-brand-success' : 'text-amber-400',
            )}
          >
            {computeStatus.charAt(0).toUpperCase() + computeStatus.slice(1)}
          </span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className="bg-brand-success h-full"
            style={{ width: `${computePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
