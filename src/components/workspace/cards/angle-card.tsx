'use client';

export interface AngleRow {
  angle: string;
  exampleHook?: string;
  evidence?: string;
}

export interface AngleCardProps {
  angles?: AngleRow[];
  /** @deprecated single-item shape; use `angles` */
  angle?: string;
  exampleHook?: string;
  evidence?: string;
}

function normalizeAngles(props: AngleCardProps): AngleRow[] {
  if (props.angles && props.angles.length > 0) {
    return props.angles;
  }
  if (props.angle != null && props.angle !== '') {
    return [{ angle: props.angle, exampleHook: props.exampleHook, evidence: props.evidence }];
  }
  return [];
}

function AngleBlock({ row }: { row: AngleRow }) {
  return (
    <>
      <p className="text-sm font-medium text-[var(--text-primary)]">{row.angle}</p>
      {row.exampleHook ? (
        <p className="mt-1 text-[13px] italic leading-relaxed text-[var(--text-secondary)]">
          &ldquo;{row.exampleHook}&rdquo;
        </p>
      ) : null}
      {row.evidence ? (
        <p className="mt-1 font-mono text-[11px] text-[var(--text-tertiary)]">{row.evidence}</p>
      ) : null}
    </>
  );
}

export function AngleCard(props: AngleCardProps) {
  const rows = normalizeAngles(props);
  if (rows.length === 0) return null;

  if (rows.length === 1) {
    return (
      <div className="border-b border-[var(--border-subtle)] py-2.5 last:border-b-0">
        <AngleBlock row={rows[0]} />
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {rows.map((row, i) => (
        <div key={i} className="py-2.5 first:pt-0 last:pb-0">
          <AngleBlock row={row} />
        </div>
      ))}
    </div>
  );
}
