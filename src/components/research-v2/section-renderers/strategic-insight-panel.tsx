import type { ReactNode } from 'react';

import { Eyebrow, MonoBadge } from '@/components/research-v2/ui-kit';

interface KeyTension {
  tension: string;
  side: string;
  costOfPosition: string;
}

interface StrategicInsight {
  strategicVerdict: string;
  nonObviousRead: string;
  secondOrderImplication: string;
  keyTension: KeyTension;
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
      <p className="text-[13px] leading-[1.55] text-muted-foreground">{value}</p>
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
      className="flex flex-col gap-4 border-l border-border pl-4"
      data-testid="strategic-insight-panel"
    >
      <div className="flex items-center gap-2">
        <MonoBadge>Strategic insight</MonoBadge>
        <Eyebrow>depth gate</Eyebrow>
      </div>
      {insight ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StrategicField label="verdict" value={insight.strategicVerdict} />
          <StrategicField label="non-obvious read" value={insight.nonObviousRead} />
          <StrategicField
            label="second-order implication"
            value={insight.secondOrderImplication}
          />
          <StrategicField
            label="named tension"
            value={`${insight.keyTension.tension} Side: ${insight.keyTension.side} Cost: ${insight.keyTension.costOfPosition}`}
          />
        </div>
      ) : null}
      {children ? <div className="grid gap-4 md:grid-cols-2">{children}</div> : null}
    </section>
  );
}
