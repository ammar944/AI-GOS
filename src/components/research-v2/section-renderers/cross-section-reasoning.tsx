import type { CrossSectionReasoningArtifact } from '@/lib/lab-engine/artifacts/schemas/cross-section-reasoning';
import { cn } from '@/lib/utils';
import {
  DataTable,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import {
  isRecord,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { SubsectionBlock } from '../primitives';
import { StrategicField } from './strategic-insight-panel';

export interface CrossSectionReasoningRendererProps {
  artifact: CrossSectionReasoningArtifact | PositioningTypedArtifact;
  className?: string;
}

const CROSS_SECTION_BODY_KEYS = [
  'crossSectionThreads',
  'clientBlindSpot',
  'namedTension',
  'secondOrderRisk',
  'contrarianInversion',
] as const satisfies ReadonlyArray<keyof CrossSectionReasoningArtifact['body']>;

type SourceSectionRef =
  CrossSectionReasoningArtifact['body']['crossSectionThreads'][number]['sourceSections'][number];

function getCrossSectionReasoningBody(
  artifact: CrossSectionReasoningArtifact | PositioningTypedArtifact,
): CrossSectionReasoningArtifact['body'] {
  const record = artifact as unknown as Record<string, unknown>;

  if (isRecord(record.body)) {
    return record.body as CrossSectionReasoningArtifact['body'];
  }

  return Object.fromEntries(
    CROSS_SECTION_BODY_KEYS.map((key) => [key, record[key]]),
  ) as CrossSectionReasoningArtifact['body'];
}

function SourceSectionRefs({
  refs,
}: {
  refs: readonly SourceSectionRef[];
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {refs.map((ref) => (
        <span
          key={`${ref.sectionId}-${ref.sourceUrl}`}
          className="inline-flex items-center gap-1.5"
        >
          <MonoBadge>{ref.sectionId}</MonoBadge>
          <SourceLink url={ref.sourceUrl} />
        </span>
      ))}
    </div>
  );
}

export function CrossSectionReasoningRenderer({
  artifact,
  className,
}: CrossSectionReasoningRendererProps): React.ReactElement {
  const body = getCrossSectionReasoningBody(artifact);

  const threadColumns: ReadonlyArray<
    DataTableColumn<(typeof body.crossSectionThreads)[number]>
  > = [
    { key: 'claim', header: 'Cross-section thread', className: 'font-medium text-foreground' },
    { key: 'whyNonObvious', header: 'Why non-obvious' },
    {
      key: 'sourceSections',
      header: 'Grounding',
      render: (row) => <SourceSectionRefs refs={row.sourceSections} />,
    },
  ];

  return (
    <div
      data-testid="typed-artifact-renderer-positioningCrossSectionReasoning"
      className={cn('space-y-10', className)}
    >
      <SubsectionBlock
        label="Cross-section threads"
        prose="Claims that only hold after reading multiple committed sections together."
      >
        <DataTable columns={threadColumns} rows={body.crossSectionThreads} />
      </SubsectionBlock>

      <SubsectionBlock
        label="Client blind spot"
        prose={body.clientBlindSpot.claim}
      >
        <div className="space-y-4">
          <StrategicField
            label="why it matters"
            value={body.clientBlindSpot.whyItMatters}
          />
          <SourceSectionRefs refs={body.clientBlindSpot.sourceSections} />
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Named tension" prose={body.namedTension.tension}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <StrategicField label="side" value={body.namedTension.side} />
            <StrategicField
              label="cost accepted"
              value={body.namedTension.costAccepted}
            />
          </div>
          <SourceSectionRefs refs={body.namedTension.sourceSections} />
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Second-order risk" prose={body.secondOrderRisk.claim}>
        <div className="space-y-4">
          <StrategicField
            label="why it matters"
            value={body.secondOrderRisk.whyItMatters}
          />
          <SourceSectionRefs refs={body.secondOrderRisk.sourceSections} />
        </div>
      </SubsectionBlock>

      <SubsectionBlock
        label="Contrarian inversion"
        prose={body.contrarianInversion.claim}
      >
        <div className="space-y-4">
          <StrategicField
            label="why it matters"
            value={body.contrarianInversion.whyItMatters}
          />
          <SourceSectionRefs refs={body.contrarianInversion.sourceSections} />
        </div>
      </SubsectionBlock>
    </div>
  );
}
