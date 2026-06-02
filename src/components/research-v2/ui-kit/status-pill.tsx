import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusPillTone =
  | 'neutral'
  | 'complete'
  | 'flagged'
  | 'error'
  | 'active';

const STATUS_PILL_TONE_CLASS: Record<StatusPillTone, string> = {
  neutral: 'font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground',
  complete: 'font-mono text-[11px] uppercase tracking-[0.04em] text-emerald-600 bg-emerald-600/10 border-emerald-600/20',
  flagged: 'font-mono text-[11px] uppercase tracking-[0.04em] text-amber-600 bg-amber-600/10 border-amber-600/20',
  error: 'font-mono text-[11px] uppercase tracking-[0.04em] text-red-600 bg-red-600/10 border-red-600/20',
  active: 'font-mono text-[11px] uppercase tracking-[0.04em] text-primary bg-primary/10 border-primary/20',
};

/** Maps semantic tone tokens to Tailwind classes for tests and consumers. */
export function toneToClass(tone: StatusPillTone | undefined): string {
  return STATUS_PILL_TONE_CLASS[tone ?? 'neutral'];
}

export function StatusPill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: StatusPillTone;
  className?: string;
}): React.ReactElement {
  return (
    <Badge
      variant={tone === 'neutral' ? 'secondary' : 'outline'}
      className={cn('rounded-md border px-2 py-0.5', toneToClass(tone), className)}
    >
      {children}
    </Badge>
  );
}

/** Semantic mono badge alias used by section renderers. */
export const MonoBadge = StatusPill;
