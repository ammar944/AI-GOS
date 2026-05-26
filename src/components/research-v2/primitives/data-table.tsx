import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
  rowKey,
  rowTestId,
}: DataTableProps<T>): React.ReactElement {
  const keyFn = rowKey ?? defaultRowKey;
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      {caption ? (
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {caption}
        </div>
      ) : null}
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'border-b border-border px-3 py-2 align-bottom text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground',
                  col.numeric && 'text-right',
                  col.headerClassName,
                )}
                scope="col"
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
                className="px-3 py-6 text-center text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={keyFn(row, rowIndex)}
                data-testid={rowTestId?.(row, rowIndex)}
                className="border-b border-border/60 transition-colors hover:bg-muted/50"
              >
                {columns.map(col => {
                  const rendered = col.render
                    ? col.render(row, rowIndex)
                    : ((row as Record<string, unknown>)[col.key] as ReactNode);
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-2.5 align-top text-[13px] leading-[1.5] text-muted-foreground',
                        col.numeric &&
                          'text-right tabular-nums text-foreground',
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
