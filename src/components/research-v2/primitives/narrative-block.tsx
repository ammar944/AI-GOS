import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface NarrativeBlockProps {
  title?: string;
  prose: string;
  children?: ReactNode;
  className?: string;
}

function paragraphsFromProse(prose: string): string[] {
  return prose
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

export function NarrativeBlock({
  title,
  prose,
  children,
  className,
}: NarrativeBlockProps): React.ReactElement {
  const paragraphs = paragraphsFromProse(prose);
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {title ? (
        <h4 className="text-[15px] font-semibold leading-[1.4] tracking-[-0.005em] text-foreground">
          {title}
        </h4>
      ) : null}
      <div className="flex max-w-[66ch] flex-col gap-3 text-[14px] leading-[1.65] text-muted-foreground">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {children}
    </div>
  );
}
