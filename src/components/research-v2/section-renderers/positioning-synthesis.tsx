import type { PositioningSynthesisArtifact } from '@/lib/lab-engine/artifacts/schemas/positioning-synthesis';
import {
  isRecord,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { cn } from '@/lib/utils';
import {
  Callout,
  DataTable,
  Eyebrow,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { SubsectionBlock } from '../primitives';

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
            <MonoBadge>{row.sourceSection}</MonoBadge>
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
          <MonoBadge>{row.sourceSection}</MonoBadge>
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
          <div className="flex flex-col gap-4">
            <Callout label="Recommended angle" tone="accent">
              {body.recommendedMove.optionAngle}
            </Callout>
            <p className="max-w-[68ch] text-[15px] leading-[1.6] text-foreground">
              {body.recommendedMove.rationale}
            </p>
            <div>
              <Eyebrow className="mb-1 block">Next steps</Eyebrow>
              <p className="text-[15px] leading-[1.6] text-foreground">
                {body.recommendedMove.nextSteps}
              </p>
            </div>
          </div>
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
