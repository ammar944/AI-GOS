import { cn } from '@/lib/utils';

export interface DocumentHeaderProps {
  companyName: string;
  companyUrl: string;
  lede: string;
  generatedAt: Date;
  sectionsComplete: number;
  sectionsTotal: number;
  sourcesCount: number;
  modelLabel: string;
  className?: string;
}

export function DocumentHeader({
  companyName,
  companyUrl,
  lede,
  generatedAt,
  sectionsComplete,
  sectionsTotal,
  sourcesCount,
  modelLabel,
  className,
}: DocumentHeaderProps): React.ReactElement {
  const generated = generatedAt.toISOString().slice(0, 10);
  const sectionsLabel =
    sectionsComplete === sectionsTotal
      ? `${sectionsTotal} sections`
      : `${sectionsComplete}/${sectionsTotal} sections`;
  return (
    <header className={cn('mb-[72px]', className)}>
      <div className="mb-5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Pre-Pitch Positioning Audit
      </div>
      <h1 className="mb-[18px] font-serif text-[56px] font-normal leading-[1.05] tracking-[-0.015em] text-foreground">
        {companyName}
      </h1>
      <p className="mb-9 max-w-[60ch] font-serif text-[22px] italic leading-[1.5] text-muted-foreground">
        {lede}
      </p>
      <div className="flex flex-wrap gap-[18px] border-t border-border pt-[18px] font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
        <span>{companyUrl}</span>
        <span className="text-muted-foreground/70">·</span>
        <span>generated {generated}</span>
        <span className="text-muted-foreground/70">·</span>
        <span>{sectionsLabel} · {sourcesCount} sources</span>
        <span className="text-muted-foreground/70">·</span>
        <span>{modelLabel}</span>
      </div>
    </header>
  );
}
