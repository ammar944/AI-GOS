'use client';

// W3 executive brief card: the report's spine, rendered once at the top of the
// Audit Reader. Industrial register per DESIGN.md — typography does the work,
// no decoration, color only for state. Renders nothing until the detached
// brief route has written research_artifacts.thesis.

interface BriefMove {
  rank: number;
  move: string;
  provingSections: string[];
}

interface BriefConflict {
  factKey: string;
  readings: Array<{ sectionId: string; value: string }>;
  resolution: string;
  winningSectionId: string;
}

export interface ExecutiveBriefCardProps {
  brief: Record<string, unknown> | null | undefined;
  sectionLabelOf?: (sectionId: string) => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asMoves(value: unknown): BriefMove[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is BriefMove =>
      isRecord(item) &&
      typeof item.move === 'string' &&
      typeof item.rank === 'number',
  );
}

function asConflicts(value: unknown): BriefConflict[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is BriefConflict =>
      isRecord(item) &&
      typeof item.factKey === 'string' &&
      typeof item.resolution === 'string',
  );
}

export function ExecutiveBriefCard({
  brief,
  sectionLabelOf,
}: ExecutiveBriefCardProps) {
  if (!isRecord(brief)) return null;

  if (brief.status === 'generating') {
    return (
      <div className="mb-8 rounded-lg border border-border bg-muted/20 px-5 py-3">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Composing executive brief…
        </span>
      </div>
    );
  }

  if (brief.status !== 'complete' || typeof brief.executiveThesis !== 'string') {
    return null;
  }

  const labelOf = sectionLabelOf ?? ((sectionId: string) => sectionId);
  const paragraphs = brief.executiveThesis
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const moves = asMoves(brief.rankedMoves);
  const conflicts = asConflicts(brief.factConflicts);

  return (
    <section
      aria-label="Executive brief"
      className="mb-10 rounded-lg border border-border bg-card p-6"
    >
      <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        Executive Brief
      </div>

      <div className="space-y-3">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className={
              index === 0
                ? 'text-[14px] leading-relaxed text-foreground'
                : 'text-[14px] leading-relaxed text-muted-foreground'
            }
          >
            {paragraph}
          </p>
        ))}
      </div>

      {moves.length > 0 ? (
        <div className="mt-6 border-t border-border pt-5">
          <div className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            The Three Moves
          </div>
          <ol className="space-y-3">
            {moves.map((move) => (
              <li key={move.rank} className="flex gap-3">
                <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                  {move.rank}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] leading-relaxed text-foreground">
                    {move.move}
                  </p>
                  {move.provingSections.length > 0 ? (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
                      proven by{' '}
                      {move.provingSections
                        .map((sectionId) => labelOf(sectionId))
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="mt-6 border-t border-border pt-5">
          <div className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Reconciled Facts
          </div>
          <ul className="space-y-3">
            {conflicts.map((conflict) => (
              <li key={conflict.factKey} className="text-[13px] leading-relaxed">
                <span className="font-medium text-foreground">
                  {conflict.factKey}
                </span>
                {Array.isArray(conflict.readings) &&
                conflict.readings.length > 0 ? (
                  <span className="text-muted-foreground/70">
                    {' '}
                    (
                    {conflict.readings
                      .map(
                        (reading) =>
                          `${labelOf(reading.sectionId)}: ${reading.value}`,
                      )
                      .join(' vs ')}
                    )
                  </span>
                ) : null}
                <span className="text-muted-foreground"> — {conflict.resolution}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
