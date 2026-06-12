import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
// Direct file import (not the primitives barrel) to keep ui-kit free of a
// barrel cycle — primitives components import from the ui-kit barrel.
import { scrubReaderText } from '@/components/research-v2/primitives/reader-text';

import { Eyebrow } from './type';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  numeric?: boolean;
  render?: (row: T, rowIndex: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  /** Fixed CSS width for the column (e.g. '120px', '20%'). Opts the table into table-fixed + colgroup. */
  width?: string;
  /** Min CSS width for the column. Opts the table into table-fixed + colgroup. */
  minWidth?: string;
  /** Max CSS width for the column. Opts the table into table-fixed + colgroup. */
  maxWidth?: string;
  /** When true, the column absorbs slack (width:auto in colgroup). Opts the table into table-fixed + colgroup. */
  grow?: boolean;
  /**
   * Text wrapping behavior for the cell. Opts the table into table-fixed +
   * colgroup. 'truncate' | 'nowrap' | 'clamp' are all content-preserving:
   * they wrap up to `clampLines` lines (line-clamp) and carry the full raw
   * value in the cell's title attribute — research content is never silently
   * clipped to an unreadable sliver.
   */
  wrap?: 'wrap' | 'truncate' | 'nowrap' | 'clamp';
  /** Number of lines for clipped wrap modes (1-4). Defaults to 3. Opts the table into table-fixed + colgroup. */
  clampLines?: number;
}

const CLAMP_CLASS: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
};

function columnOptsIntoSizing<T>(col: DataTableColumn<T>): boolean {
  return (
    col.width !== undefined ||
    col.minWidth !== undefined ||
    col.maxWidth !== undefined ||
    col.grow !== undefined ||
    col.wrap !== undefined ||
    col.clampLines !== undefined
  );
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
  const sized = columns.some(columnOptsIntoSizing);

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      {caption ? <Eyebrow className="mb-2 block">{caption}</Eyebrow> : null}
      <table
        className={cn(
          'w-full border-collapse text-[14px]',
          sized && 'table-fixed',
        )}
      >
        {sized ? (
          <colgroup>
            {columns.map((col) => {
              const style: React.CSSProperties = {};
              if (col.grow) {
                style.width = 'auto';
              } else if (col.width !== undefined) {
                style.width = col.width;
              }
              if (col.minWidth !== undefined) style.minWidth = col.minWidth;
              if (col.maxWidth !== undefined) style.maxWidth = col.maxWidth;
              return <col key={col.key} style={style} />;
            })}
          </colgroup>
        ) : null}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'border-b border-border px-3 pb-2 align-top font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-foreground/70',
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
                key={`${keyFn(row, rowIndex)}-${rowIndex}`}
                data-testid={rowTestId?.(row, rowIndex)}
                className="border-b border-border/60 transition-colors hover:bg-muted/40"
              >
                {columns.map((col) => {
                  const rawValue = (row as Record<string, unknown>)[col.key];
                  // Default-rendered string cells pass through scrubReaderText
                  // so trust markers ('[unverified]') and pipeline tokens never
                  // print raw in tables. Render callbacks own their own output.
                  const rendered = col.render
                    ? col.render(row, rowIndex)
                    : typeof rawValue === 'string'
                      ? scrubReaderText(rawValue)
                      : (rawValue as ReactNode);
                  // 'truncate' / 'nowrap' / 'clamp' all render as a bounded
                  // line-clamp instead of a blind single-line truncate, so
                  // long research content stays readable; the title attribute
                  // below still carries the full text for clipped cells.
                  const clipped =
                    col.wrap === 'nowrap' ||
                    col.wrap === 'truncate' ||
                    col.wrap === 'clamp';
                  const wrapClass = clipped
                    ? cn(CLAMP_CLASS[col.clampLines ?? 3], 'break-words')
                    : col.wrap === 'wrap'
                      ? 'break-words'
                      : undefined;
                  const titleAttr =
                    clipped && rawValue != null ? String(rawValue) : undefined;
                  return (
                    <td
                      key={col.key}
                      title={titleAttr}
                      className={cn(
                        cellPad,
                        'px-3 align-top text-foreground/90',
                        col.numeric && 'text-right font-mono tabular-nums',
                        !col.numeric && 'text-left',
                        col.className,
                      )}
                    >
                      {/* Wrap/clamp classes live on an inner div, never the td:
                          line-clamp's display:-webkit-box destroys table-cell
                          display, and CSS table fixup then merges adjacent
                          non-cell children into one anonymous cell (stacked
                          text, empty trailing columns). */}
                      {wrapClass ? (
                        <div className={wrapClass}>{rendered}</div>
                      ) : (
                        rendered
                      )}
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
