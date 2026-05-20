import { cn } from '@/lib/utils';

export interface ChapterDividerProps {
  chapterNumber: number;
  eyebrow: string;
  title: string;
  className?: string;
}

export function ChapterDivider({
  chapterNumber,
  eyebrow,
  title,
  className,
}: ChapterDividerProps): React.ReactElement {
  const num = String(chapterNumber).padStart(2, '0');
  return (
    <div className={cn('mt-24', className)}>
      <div className="mb-7 flex items-baseline gap-4">
        <span className="flex-shrink-0 font-mono text-[11px] tracking-[0.12em] text-[color:var(--text-quaternary)]">
          {num}
        </span>
        <span className="h-px flex-1 bg-[color:var(--border-subtle)]" />
      </div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
        {eyebrow}
      </div>
      <h2 className="mb-7 font-serif text-[32px] font-normal leading-[1.2] tracking-[-0.005em] text-[color:var(--text-primary)]">
        {title}
      </h2>
    </div>
  );
}
