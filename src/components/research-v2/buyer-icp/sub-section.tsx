import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

export interface BuyerICPSubSectionProps {
  title: string;
  prose: string;
  gridLabel: string;
  children: ReactNode;
}

export function BuyerICPSubSection({
  title,
  prose,
  gridLabel,
  children,
}: BuyerICPSubSectionProps): React.ReactElement {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">
          {title}
        </h3>
        <div className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
          <ReactMarkdown>{prose}</ReactMarkdown>
        </div>
      </div>
      <div
        role="list"
        aria-label={gridLabel}
        className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        {children}
      </div>
    </section>
  );
}
