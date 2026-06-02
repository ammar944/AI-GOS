'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  BodyProse,
  DataTable,
  Eyebrow,
  formatSourceIndex,
  MonoBadge,
  SectionTitle,
  SourceLink,
  VerdictCallout,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import {
  isRecord,
  type BuyerICPArtifact,
  type CompetitorLandscapeArtifact,
  type DemandIntentArtifact,
  type MarketCategoryArtifact,
  type OfferPerformanceArtifact,
  type PaidMediaPlanArtifact,
  type PositioningSynthesisArtifact,
  type PositioningTypedArtifact,
  type VoiceOfCustomerArtifact,
} from '@/types/positioning-artifact';
import {
  BuyerICPRenderer,
  CompetitorLandscapeRenderer,
  DemandIntentRenderer,
  MarketCategoryRenderer,
  OfferDiagnosticRenderer,
  PaidMediaPlanRenderer,
  PositioningSynthesisRenderer,
  VoiceOfCustomerRenderer,
} from './section-renderers';
import { SubsectionBlock } from './primitives';

export interface TypedArtifactRendererProps {
  artifact: PositioningTypedArtifact;
  zoneId: string;
  showSectionTitle?: boolean;
}

interface ArtifactSubSection {
  key: string;
  title: string;
  prose: string | null;
  fields: ArtifactField[];
}

interface ArtifactField {
  key: string;
  label: string;
  value: unknown;
}

const ARTIFACT_META_KEYS = new Set([
  'sectionTitle',
  'verdict',
  'statusSummary',
  'confidence',
  'sources',
]);

const PRIMARY_FIELD_KEYS = [
  'name',
  'title',
  'keyword',
  'question',
  'topic',
  'competitor',
  'metric',
  'criterion',
  'stageName',
  'channelName',
  'surface',
  'claimedMotion',
  'priorSolution',
  'signalType',
  'forceType',
  'bucketType',
] as const;

function humanizeKey(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hasRenderableValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasRenderableValue);
  if (isRecord(value)) return Object.values(value).some(hasRenderableValue);
  return false;
}

function getSubSections(artifact: PositioningTypedArtifact): ArtifactSubSection[] {
  return Object.entries(artifact)
    .filter(([key, value]) => !ARTIFACT_META_KEYS.has(key) && hasRenderableValue(value))
    .map(([key, value]) => {
      if (!isRecord(value)) {
        return {
          key,
          title: humanizeKey(key),
          prose: null,
          fields: [{ key, label: humanizeKey(key), value }],
        };
      }

      const prose = typeof value.prose === 'string' && value.prose.trim()
        ? value.prose
        : null;
      const fields = Object.entries(value)
        .filter(([fieldKey, fieldValue]) => fieldKey !== 'prose' && hasRenderableValue(fieldValue))
        .map(([fieldKey, fieldValue]) => ({
          key: fieldKey,
          label: humanizeKey(fieldKey),
          value: fieldValue,
        }));

      return {
        key,
        title: humanizeKey(key),
        prose,
        fields,
      };
    });
}

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function renderStringValue(value: string): ReactNode {
  if (!isUrl(value)) return value;
  return <SourceLink url={value} />;
}

function renderPrimitiveValue(value: unknown): ReactNode {
  if (typeof value === 'string') return renderStringValue(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

function getPrimaryField(
  value: Record<string, unknown>,
): { key: string; value: string } | null {
  for (const key of PRIMARY_FIELD_KEYS) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return { key, value: candidate };
    }
  }
  return null;
}

function recordToTableColumns(
  sample: Record<string, unknown>,
): DataTableColumn<Record<string, unknown>>[] {
  return Object.keys(sample)
    .filter((key) => hasRenderableValue(sample[key]))
    .map((key) => ({
      key,
      header: humanizeKey(key),
      render: (row) => renderValue(row[key], 2),
    }));
}

function FieldList({
  entries,
  depth,
}: {
  entries: Array<[string, unknown]>;
  depth: number;
}): React.ReactElement {
  return (
    <dl className="divide-y divide-border/60">
      {entries.map(([key, value]) => {
        const rendered = renderValue(value, depth + 1);
        if (!rendered) return null;
        return (
          <div key={key} className="grid gap-1 py-3 first:pt-0 last:pb-0">
            <dt>
              <Eyebrow>{humanizeKey(key)}</Eyebrow>
            </dt>
            <dd className="text-sm leading-relaxed text-foreground">{rendered}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function RecordBlock({
  item,
  fallbackTitle,
  depth = 0,
}: {
  item: unknown;
  fallbackTitle: string;
  depth?: number;
}): React.ReactElement | null {
  if (!hasRenderableValue(item)) return null;

  if (!isRecord(item)) {
    return (
      <div className="py-2 text-sm leading-relaxed text-foreground">
        {renderValue(item, depth + 1)}
      </div>
    );
  }

  const primary = getPrimaryField(item);
  const entries = Object.entries(item).filter(
    ([key, value]) => key !== primary?.key && hasRenderableValue(value),
  );

  return (
    <article role="listitem" className="divide-y divide-border/60 py-3">
      <h4 className="text-sm font-semibold leading-snug text-foreground">
        {primary?.value ?? fallbackTitle}
      </h4>
      {entries.length > 0 ? (
        <div className="pt-3">
          <FieldList entries={entries} depth={depth + 1} />
        </div>
      ) : null}
    </article>
  );
}

function renderArrayValue(
  value: unknown[],
  depth: number,
): React.ReactElement | null {
  const renderable = value.filter(hasRenderableValue);
  if (renderable.length === 0) return null;

  const allPrimitive = renderable.every(
    (item) =>
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean',
  );

  if (allPrimitive) {
    return (
      <div className="flex flex-wrap gap-2">
        {renderable.map((item, index) => (
          <MonoBadge key={`${String(item)}-${index}`}>
            {renderPrimitiveValue(item)}
          </MonoBadge>
        ))}
      </div>
    );
  }

  const allRecords = renderable.every(isRecord);
  if (allRecords && renderable.length > 0) {
    const rows = renderable as Record<string, unknown>[];
    const columns = recordToTableColumns(rows[0] ?? {});
    if (columns.length > 0) {
      return (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(_, index) => String(index)}
        />
      );
    }
  }

  return (
    <div role="list" className="divide-y divide-border/60">
      {renderable.map((item, index) => (
        <RecordBlock
          key={index}
          item={item}
          fallbackTitle={`Item ${index + 1}`}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function renderRecordValue(
  value: Record<string, unknown>,
  depth: number,
): React.ReactElement | null {
  const entries = Object.entries(value).filter(([, item]) => hasRenderableValue(item));
  if (entries.length === 0) return null;
  return <FieldList entries={entries} depth={depth + 1} />;
}

function renderValue(value: unknown, depth: number): ReactNode {
  if (!hasRenderableValue(value)) return null;
  if (depth > 4) return renderPrimitiveValue(String(value));
  if (Array.isArray(value)) return renderArrayValue(value, depth);
  if (isRecord(value)) return renderRecordValue(value, depth);
  return renderPrimitiveValue(value);
}

function FieldGroup({
  field,
  subSectionKey,
  zoneId,
}: {
  field: ArtifactField;
  subSectionKey: string;
  zoneId: string;
}): React.ReactElement | null {
  if (!hasRenderableValue(field.value)) return null;

  const rendered = renderValue(field.value, 0);
  if (!rendered) return null;

  return (
    <div
      className="space-y-2"
      data-testid={`typed-card-group-${zoneId}-${subSectionKey}-${field.key}`}
    >
      <Eyebrow>{field.label}</Eyebrow>
      {rendered}
    </div>
  );
}

function ArtifactSources({
  artifact,
}: {
  artifact: PositioningTypedArtifact;
}): React.ReactElement | null {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (artifact.sources.length === 0) return null;

  return (
    <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium text-foreground hover:text-primary">
        {sourcesOpen ? (
          <ChevronDown className="size-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4" aria-hidden="true" />
        )}
        Sources ({artifact.sources.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <ol role="list" className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {artifact.sources.map((source, index) => (
            <li
              key={`source-${index}-${source.url}`}
              className="flex gap-2.5 text-sm leading-relaxed"
            >
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground/70">
                {formatSourceIndex(index + 1)}
              </span>
              <span className="min-w-0">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  {source.title}
                </a>
                <span className="mt-0.5 block break-all text-xs text-muted-foreground">
                  {source.url}
                </span>
                {source.whyItMatters ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {source.whyItMatters}
                  </p>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function GenericTypedArtifactRenderer({
  artifact,
  zoneId,
  showSectionTitle,
}: TypedArtifactRendererProps & {
  showSectionTitle: boolean;
}): React.ReactElement {
  const subSections = getSubSections(artifact);

  return (
    <div
      data-testid={`typed-artifact-renderer-${zoneId}`}
      className="flex flex-col gap-8"
    >
      <header className="flex flex-col gap-3">
        {showSectionTitle ? (
          <SectionTitle as="h2">{artifact.sectionTitle}</SectionTitle>
        ) : null}
        <VerdictCallout verdict={artifact.verdict} />
        <BodyProse>{artifact.statusSummary}</BodyProse>
      </header>

      {subSections.map((subSection) => (
        <SubsectionBlock
          key={subSection.key}
          label={subSection.title}
          prose={subSection.prose ?? ''}
        >
          {subSection.fields.length > 0 ? (
            <div className="flex flex-col gap-4">
              {subSection.fields.map((field) => (
                <FieldGroup
                  key={field.key}
                  field={field}
                  subSectionKey={subSection.key}
                  zoneId={zoneId}
                />
              ))}
            </div>
          ) : null}
        </SubsectionBlock>
      ))}

      <ArtifactSources artifact={artifact} />
    </div>
  );
}

export function TypedArtifactRenderer({
  artifact,
  zoneId,
  showSectionTitle = true,
}: TypedArtifactRendererProps): React.ReactElement {
  switch (zoneId) {
    case 'positioningMarketCategory':
      return <MarketCategoryRenderer artifact={artifact as unknown as MarketCategoryArtifact} />;
    case 'positioningBuyerICP':
      return <BuyerICPRenderer artifact={artifact as unknown as BuyerICPArtifact} />;
    case 'positioningCompetitorLandscape':
      return <CompetitorLandscapeRenderer artifact={artifact as unknown as CompetitorLandscapeArtifact} />;
    case 'positioningVoiceOfCustomer':
      return <VoiceOfCustomerRenderer artifact={artifact as unknown as VoiceOfCustomerArtifact} />;
    case 'positioningDemandIntent':
      return <DemandIntentRenderer artifact={artifact as unknown as DemandIntentArtifact} />;
    case 'positioningOfferDiagnostic':
      return <OfferDiagnosticRenderer artifact={artifact as unknown as OfferPerformanceArtifact} />;
    case 'positioningPaidMediaPlan':
      return <PaidMediaPlanRenderer artifact={artifact as unknown as PaidMediaPlanArtifact} />;
    case 'positioningSynthesis':
      return <PositioningSynthesisRenderer artifact={artifact as unknown as PositioningSynthesisArtifact} />;
  }

  return (
    <GenericTypedArtifactRenderer
      artifact={artifact}
      zoneId={zoneId}
      showSectionTitle={showSectionTitle}
    />
  );
}
