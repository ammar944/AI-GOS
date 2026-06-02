import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Eyebrow } from './type';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  numeric?: boolean;
  render?: (row: T, rowIndex: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: ReadonlyArray<T>;
  emptyLabel?: string;
  caption?: string;
  className?: string;
  density?: 'comfortable' | 'compact';
  rowKey?: (row: T, rowIndex: number) => string;
  rowTestId?: (row: T, rowIndex: number) => string | undefined;
}

function defaultRowKey<T>(_row: T, rowIndex: number): string {
  return String(rowIndex);
}

export function DataTable<T>({
  columns,
  rows,
  emptyLabel = 'No data',
  caption,
  className,
  density = 'comfortable',
  rowKey,
  rowTestId,
}: DataTableProps<T>): React.ReactElement {
  const keyFn = rowKey ?? defaultRowKey;
  const cellPad = density === 'compact' ? 'py-1.5' : 'py-2.5';

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      {caption ? <Eyebrow className="mb-2 block">{caption}</Eyebrow> : null}
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'border-b border-border pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80',
                  col.numeric ? 'text-right' : 'text-left',
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={keyFn(row, rowIndex)}
                data-testid={rowTestId?.(row, rowIndex)}
                className="border-b border-transparent transition-colors hover:bg-muted/40"
              >
                {columns.map((col) => {
                  const rendered = col.render
                    ? col.render(row, rowIndex)
                    : ((row as Record<string, unknown>)[col.key] as ReactNode);
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        cellPad,
                        'pr-4 text-foreground/90',
                        col.numeric && 'text-right font-mono tabular-nums',
                        !col.numeric && 'text-left',
                        col.className,
                      )}
                    >
                      {rendered}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
