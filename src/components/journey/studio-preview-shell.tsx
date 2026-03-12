import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface JourneyStudioPreviewShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  statusLabel?: string;
  statusDetail?: string;
  children: ReactNode;
  dock?: ReactNode;
  className?: string;
}

export function JourneyStudioPreviewShell({
  eyebrow = 'Journey Studio',
  title,
  description,
  statusLabel,
  statusDetail,
  children,
  dock,
  className,
}: JourneyStudioPreviewShellProps): React.JSX.Element {
  return (
    <section
      data-testid="journey-studio-shell"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-5 px-6 pb-6 pt-5 lg:px-8 lg:pb-8 lg:pt-6',
        className,
      )}
    >
      <header
        data-testid="journey-studio-masthead"
        className={cn(
          'relative overflow-hidden rounded-[28px] border border-white/[0.08]',
          'bg-[radial-gradient(circle_at_top_left,rgba(60,131,246,0.18),transparent_34%),linear-gradient(180deg,rgba(22,21,18,0.96),rgba(11,10,8,0.92))]',
          'px-5 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl',
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/16 before:to-transparent',
        )}
      >
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-white/42">
                {eyebrow}
              </span>
              <span className="h-px w-12 bg-gradient-to-r from-brand-accent/50 to-transparent" />
            </div>

            <div className="space-y-2">
              <h1 className="font-heading text-2xl leading-tight text-white/94 sm:text-[2rem]">
                {title}
              </h1>
              {description ? (
                <p className="max-w-2xl text-sm leading-6 text-white/56 sm:text-[15px]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {(statusLabel || statusDetail) ? (
            <div className="min-w-[13rem] rounded-[22px] border border-white/8 bg-black/20 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {statusLabel ? (
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-brand-success/80">
                  {statusLabel}
                </p>
              ) : null}
              {statusDetail ? (
                <p className="mt-1 text-sm text-white/72">{statusDetail}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div
        className={cn(
          'grid min-h-0 flex-1 gap-5',
          dock
            ? 'xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.78fr)]'
            : 'grid-cols-1',
        )}
      >
        <div
          className={cn(
            'min-h-0 overflow-hidden rounded-[30px] border border-white/[0.07]',
            'bg-[linear-gradient(180deg,rgba(18,17,14,0.94),rgba(10,10,8,0.92))]',
            'shadow-[0_24px_60px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)]',
          )}
        >
          {children}
        </div>

        {dock ? (
          <div className="min-h-0 overflow-hidden">
            {dock}
          </div>
        ) : null}
      </div>
    </section>
  );
}
