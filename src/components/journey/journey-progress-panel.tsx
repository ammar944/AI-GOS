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
  computePercent = 72,
  className,
}: JourneyProgressPanelProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/30">
          Journey Progress
        </h3>
      </div>

      {/* Timeline */}
      <div className="flex-1 px-5 overflow-y-auto custom-scrollbar">
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-[7px] top-2 bottom-2 w-px"
            style={{ background: 'rgba(255, 255, 255, 0.10)' }}
          />

          {/* Items */}
          <div className="space-y-5">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 relative">
                {/* Dot */}
                <div className="flex-shrink-0 relative z-10 mt-0.5">
                  {item.status === 'complete' && (
                    <div className="w-[15px] h-[15px] rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                  )}
                  {item.status === 'active' && (
                    <div className="w-[15px] h-[15px] rounded-full bg-blue-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    </div>
                  )}
                  {item.status === 'queued' && (
                    <div className="w-[15px] h-[15px] rounded-full bg-white/5 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                    </div>
                  )}
                </div>

                {/* Label + detail */}
                <div className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      item.status === 'complete' && 'text-white/70',
                      item.status === 'active' && 'text-blue-400',
                      item.status === 'queued' && 'text-white/40',
                    )}
                  >
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="text-[10px] text-white/25">{item.detail}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compute Status */}
      <div className="px-5 py-4 mt-auto">
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/50">Compute Node</span>
            <span className={cn(
              'text-[10px] font-mono',
              computeStatus === 'stable' ? 'text-emerald-400' : 'text-amber-400',
            )}>
              {computeStatus.charAt(0).toUpperCase() + computeStatus.slice(1)}
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${computePercent}%`,
                background: 'linear-gradient(90deg, #10B981, #3b82f6)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
