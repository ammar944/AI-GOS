import type { ReactNode } from 'react';
import { NarrativeBlock } from './narrative-block';

export interface SubsectionBlockProps {
  label: string;
  title?: string;
  prose: string;
  children?: ReactNode;
}

export function SubsectionBlock({
  label,
  title,
  prose,
  children,
}: SubsectionBlockProps): React.ReactElement {
  return (
    <section data-testid="subsection" className="flex flex-col gap-5">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div data-testid="subsection-prose">
        <NarrativeBlock title={title} prose={prose} />
      </div>
      {children}
    </section>
  );
}
