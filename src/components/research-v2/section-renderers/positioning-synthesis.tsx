import { ExternalLink } from 'lucide-react';

import type { PositioningSynthesisArtifact } from '@/lib/lab-engine/artifacts/schemas/positioning-synthesis';
import {
  isRecord,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { cn } from '@/lib/utils';
import {
  DataTable,
  SubsectionBlock,
  type DataTableColumn,
} from '../primitives';

export interface PositioningSynthesisRendererProps {
  artifact: PositioningSynthesisArtifact | PositioningTypedArtifact;
  className?: string;
}

const SYNTHESIS_BODY_KEYS = [
  'situationThesis',
  'positioningOptions',
  'recommendedMove',
  'messagingDirections',
] as const satisfies ReadonlyArray<keyof PositioningSynthesisArtifact['body']>;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function SourceLink({ url }: { url?: string }): React.ReactElement | null {
  if (url === undefined || url.length === 0) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.06em] text-primary no-underline hover:underline"
    >
      {hostnameOf(url)}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function SourceSectionPill({ value }: { value: string }): React.ReactElement {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-secondary-foreground">
      {value}
    </span>
  );
}

function getSynthesisBody(
  artifact: PositioningSynthesisArtifact | PositioningTypedArtifact,
): PositioningSynthesisArtifact['body'] {
  const record = artifact as unknown as Record<string, unknown>;

  if (isRecord(record.body)) {
    return record.body as PositioningSynthesisArtifact['body'];
  }

  return Object.fromEntries(
    SYNTHESIS_BODY_KEYS.map((key) => [key, record[key]]),
  ) as PositioningSynthesisArtifact['body'];
}

export function PositioningSynthesisRenderer({
  artifact,
  className,
}: PositioningSynthesisRendererProps): React.ReactElement {
  const body = getSynthesisBody(artifact);

  const optionColumns: ReadonlyArray<
    DataTableColumn<(typeof body.positioningOptions.options)[number]>
  > = [
    { key: 'optionName', header: 'Option', className: 'font-medium text-foreground' },
    { key: 'angle', header: 'Positioning angle' },
    {
      key: 'rationale',
      header: 'Why it holds',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span>{row.rationale}</span>
          <div className="flex items-center gap-2">
            <SourceSectionPill value={row.sourceSection} />
            <SourceLink url={row.sourceUrl} />
          </div>
        </div>
      ),
    },
  ];

  const directionColumns: ReadonlyArray<
    DataTableColumn<(typeof body.messagingDirections.directions)[number]>
  > = [
    { key: 'direction', header: 'Direction', className: 'font-medium text-foreground' },
    { key: 'copyPoint', header: 'Copy point' },
    {
      key: 'sourceSection',
      header: 'Source',
      render: (row) => (
        <div className="flex items-center gap-2">
          <SourceSectionPill value={row.sourceSection} />
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  return (
    <div
      data-testid="typed-artifact-renderer-positioningSynthesis"
      className={cn('space-y-10', className)}
    >
      <div data-testid="positioning-synthesis-renderer" className="space-y-10">
        <SubsectionBlock label="Situation thesis" prose={body.situationThesis.prose} />

        <SubsectionBlock
          label="Positioning options"
          prose={body.positioningOptions.prose}
        >
          <DataTable columns={optionColumns} rows={body.positioningOptions.options} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Recommended move"
          prose="The single positioning wedge to lead with, and how to put it into market."
        >
          <article className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-semibold leading-snug text-foreground">
              {body.recommendedMove.optionAngle}
            </p>
            <p className="text-[13px] leading-[1.5] text-muted-foreground">
              {body.recommendedMove.rationale}
            </p>
            <div className="space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Next steps
              </span>
              <p className="text-[13px] leading-[1.5] text-muted-foreground">
                {body.recommendedMove.nextSteps}
              </p>
            </div>
          </article>
        </SubsectionBlock>

        <SubsectionBlock
          label="Messaging directions"
          prose={body.messagingDirections.prose}
        >
          <DataTable
            columns={directionColumns}
            rows={body.messagingDirections.directions}
          />
        </SubsectionBlock>
      </div>
    </div>
  );
}
