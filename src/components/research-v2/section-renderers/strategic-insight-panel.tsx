import type { ReactNode } from 'react';

import { Eyebrow, MonoBadge } from '@/components/research-v2/ui-kit';
import { scrubReaderText } from '@/components/research-v2/primitives';

interface KeyTension {
  tension: string;
  side: string;
  costOfPosition: string;
}

interface StrategicInsight {
  strategicVerdict: string;
  nonObviousRead?: string;
  secondOrderImplication?: string;
  keyTension?: KeyTension;
}

export interface StrategicInsightPanelProps {
  children?: ReactNode;
  insight?: StrategicInsight;
}

export interface StrategicFieldProps {
  label: string;
  value?: string;
}

export function StrategicField({
  label,
  value,
}: StrategicFieldProps): React.ReactElement | null {
  if (!value) return null;

  return (
    <div className="flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      <p className="text-[13px] leading-[1.55] text-muted-foreground">
        {scrubReaderText(value)}
      </p>
    </div>
  );
}

export function StrategicInsightPanel({
  children,
  insight,
}: StrategicInsightPanelProps): React.ReactElement | null {
  if (!insight && children === undefined) {
    return null;
  }

  return (
    <section
      className="flex flex-col gap-5 border-l-2 border-primary/50 pl-5"
      data-testid="strategic-insight-panel"
    >
      <div className="flex items-center gap-2">
        <MonoBadge>Strategic insight</MonoBadge>
      </div>
      {insight ? (
        <div className="grid gap-5">
          {insight.nonObviousRead ? (
            <div className="border-l border-border pl-4">
              <Eyebrow>non-obvious read</Eyebrow>
              <p className="mt-1 text-[15px] leading-[1.6] text-foreground">
                {scrubReaderText(insight.nonObviousRead)}
              </p>
            </div>
          ) : null}
          {insight.keyTension ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-border bg-card p-4">
                <Eyebrow>tension</Eyebrow>
                <p className="mt-2 text-[14px] leading-[1.55] text-muted-foreground">
                  {scrubReaderText(insight.keyTension.tension)}
                </p>
              </div>
              <div className="border border-primary/30 bg-primary/5 p-4">
                <Eyebrow className="text-primary/80">chosen side</Eyebrow>
                <p className="mt-2 text-[14px] leading-[1.55] text-foreground">
                  {scrubReaderText(insight.keyTension.side)}
                </p>
                <p className="mt-2 text-[12px] leading-[1.5] text-muted-foreground">
                  Cost: {scrubReaderText(insight.keyTension.costOfPosition)}
                </p>
              </div>
            </div>
          ) : null}
          <StrategicField
            label="second-order implication"
            value={insight.secondOrderImplication}
          />
          {insight.strategicVerdict ? (
            <p className="max-w-[18ch] font-sans text-[26px] font-semibold leading-[1.12] tracking-[0] text-foreground">
              {scrubReaderText(insight.strategicVerdict)}
            </p>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="grid gap-4 md:grid-cols-2">{children}</div> : null}
    </section>
  );
}
