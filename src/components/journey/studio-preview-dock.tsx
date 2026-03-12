import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface JourneyStudioPreviewDockProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}

export function JourneyStudioPreviewDock({
  title,
  eyebrow = 'Proof Dock',
  children,
  className,
}: JourneyStudioPreviewDockProps): React.JSX.Element {
  return (
    <aside
      data-testid="journey-studio-dock"
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/[0.07]',
        'bg-[linear-gradient(180deg,rgba(17,16,13,0.96),rgba(9,9,8,0.94))]',
        'shadow-[0_24px_60px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      <div className="border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/38">
              {eyebrow}
            </p>
            {title ? (
              <h2 className="font-heading text-base text-white/88">{title}</h2>
            ) : null}
          </div>

          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-accent/80 shadow-[0_0_18px_rgba(60,131,246,0.5)]" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
        <div className="h-full min-h-0 overflow-hidden rounded-[24px] border border-white/[0.05] bg-white/[0.025]">
          {children}
        </div>
      </div>
    </aside>
  );
}
