import type { ReactNode } from 'react';

import { Response } from '@/components/ai-elements/response';
import { cn } from '@/lib/utils';

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  className,
  as: Tag = 'h1',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2';
}): React.ReactElement {
  return (
    <Tag
      className={cn(
        'font-sans text-[24px] font-semibold leading-[1.25] tracking-[-0.02em] text-foreground sm:text-[26px]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// AI-authored prose (e.g. statusSummary) is markdown — render it through the
// AI Elements Response wrapper so emphasis/lists format instead of showing
// raw `**` markers. Styling comes from Response's shared prose class.
export function BodyProse({ children }: { children: string }): React.ReactElement {
  return <Response>{children}</Response>;
}
