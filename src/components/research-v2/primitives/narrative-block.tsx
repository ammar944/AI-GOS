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
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function NarrativeBlock({
  title,
  prose,
  children,
  className,
}: NarrativeBlockProps): React.ReactElement {
  const paragraphs = paragraphsFromProse(prose);
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {title ? (
        <h3 className="font-serif text-[24px] font-normal leading-[1.22] tracking-[0] text-[color:var(--text-primary)]">
          {title}
        </h3>
      ) : null}
      <div className="flex max-w-[70ch] flex-col gap-4 text-[15px] leading-[1.8] text-[color:var(--text-secondary)]">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {children}
    </div>
  );
}
