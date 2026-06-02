import type { ReactNode } from 'react';

import { Eyebrow } from '@/components/research-v2/ui-kit';

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
      <Eyebrow>{label}</Eyebrow>
      <div data-testid="subsection-prose">
        <NarrativeBlock title={title} prose={prose} />
      </div>
      {children}
    </section>
  );
}
