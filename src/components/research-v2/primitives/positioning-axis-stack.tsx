import { cn } from '@/lib/utils';

import {
  DataTable,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';

export interface PositioningAxisPosition {
  label: string;
  position: string;
  isUs?: boolean;
}

export interface PositioningAxisItem {
  axisName: string;
  positions: ReadonlyArray<PositioningAxisPosition>;
  evidenceUrl?: string;
}

export interface PositioningAxisStackProps {
  axes: ReadonlyArray<PositioningAxisItem>;
  className?: string;
}

export function PositioningAxisStack({
  axes,
  className,
}: PositioningAxisStackProps): React.ReactElement {
  const positionColumns: ReadonlyArray<DataTableColumn<PositioningAxisPosition>> = [
    {
      key: 'label',
      header: 'Player',
      render: row => (
        <span
          className={cn(
            'font-medium uppercase tracking-[0.04em]',
            row.isUs ? 'text-primary' : 'text-foreground',
          )}
        >
          {row.isUs ? `you · ${row.label}` : row.label}
        </span>
      ),
    },
    {
      key: 'position',
      header: 'Position',
      render: row => (
        <span className="text-[15px] leading-[1.5] text-foreground">{row.position}</span>
      ),
    },
  ];

  return (
    <div className={cn('flex flex-col gap-7', className)}>
      {axes.map((axis, axisIndex) => (
        <div key={`${axis.axisName}-${axisIndex}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[15px] font-semibold leading-[1.4] tracking-[-0.005em] text-foreground">
              {axis.axisName}
            </h4>
            {axis.evidenceUrl ? <SourceLink url={axis.evidenceUrl} /> : null}
          </div>
          <DataTable
            columns={positionColumns}
            rows={axis.positions}
            rowKey={(row, idx) => `${row.label}-${idx}`}
            density="compact"
          />
        </div>
      ))}
    </div>
  );
}
