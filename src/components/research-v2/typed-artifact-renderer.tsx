'use client';

import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  formatConfidenceToTen,
  getConfidenceToneClass,
} from '@/lib/research-v2/confidence-display';
import { cn } from '@/lib/utils';
import {
  isRecord,
  type BuyerICPArtifact,
  type CompetitorLandscapeArtifact,
  type DemandIntentArtifact,
  type MarketCategoryArtifact,
  type OfferPerformanceArtifact,
  type PaidMediaPlanArtifact,
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
  VoiceOfCustomerRenderer,
} from './section-renderers';

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
  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 break-all font-medium text-primary hover:underline"
    >
      {value}
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
    </a>
  );
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

function FieldList({
  entries,
  depth,
}: {
  entries: Array<[string, unknown]>;
  depth: number;
}): React.ReactElement {
  return (
    <dl className="space-y-2">
      {entries.map(([key, value]) => {
        const rendered = renderValue(value, depth + 1);
        if (!rendered) return null;
        return (
          <div key={key} className="grid gap-1">
            <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {humanizeKey(key)}
            </dt>
            <dd className="text-[12px] leading-[1.5] text-muted-foreground">
              {rendered}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function DataCard({
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
      <article
        role="listitem"
        className="rounded-md border border-border bg-muted p-3 text-[13px] leading-[1.5] text-muted-foreground"
      >
        {renderValue(item, depth + 1)}
      </article>
    );
  }

  const primary = getPrimaryField(item);
  const entries = Object.entries(item).filter(
    ([key, value]) => key !== primary?.key && hasRenderableValue(value),
  );

  return (
    <article
      role="listitem"
      className="rounded-md border border-border bg-muted p-4"
    >
      <div className="space-y-3">
        <h4 className="text-sm font-semibold leading-snug text-foreground">
          {primary?.value ?? fallbackTitle}
        </h4>
        {entries.length > 0 ? (
          <FieldList entries={entries} depth={depth + 1} />
        ) : null}
      </div>
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
      <ul className="flex flex-wrap gap-1.5">
        {renderable.map((item, index) => (
          <li
            key={`${String(item)}-${index}`}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground"
          >
            {renderPrimitiveValue(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {renderable.map((item, index) => (
        <DataCard
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
  return (
    <div className="rounded-md border border-border bg-muted p-3">
      <FieldList entries={entries} depth={depth + 1} />
    </div>
  );
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

  if (Array.isArray(field.value)) {
    const rendered = renderArrayValue(field.value, 0);
    if (!rendered) return null;
    return (
      <div
        className="space-y-2"
        data-testid={`typed-card-group-${zoneId}-${subSectionKey}-${field.key}`}
      >
        <h4 className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {field.label}
        </h4>
        {rendered}
      </div>
    );
  }

  const card = <DataCard item={field.value} fallbackTitle={field.label} />;
  if (!card) return null;
  return (
    <div
      className="space-y-2"
      data-testid={`typed-card-group-${zoneId}-${subSectionKey}-${field.key}`}
    >
      <h4 className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {field.label}
      </h4>
      <div role="list">{card}</div>
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
        <ul role="list" className="space-y-3 text-sm">
          {artifact.sources.map((source, index) => (
            <li
              key={`source-${index}-${source.url}`}
              className="rounded-md border border-border bg-muted p-3"
            >
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit max-w-full items-center gap-1 break-words font-medium text-primary hover:underline"
              >
                {source.title}
                <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
              </a>
              <span className="mt-1 block break-all text-xs text-muted-foreground">
                {source.url}
              </span>
              {source.whyItMatters ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {source.whyItMatters}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function GenericTypedArtifactRenderer({
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
      className="space-y-6"
    >
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {showSectionTitle ? (
            <h2 className="text-xl font-semibold leading-tight text-foreground">
              {artifact.sectionTitle}
            </h2>
          ) : null}
          <Badge
            variant="outline"
            className={cn('shrink-0 border', getConfidenceToneClass(artifact.confidence))}
          >
            Confidence {formatConfidenceToTen(artifact.confidence)}/10
          </Badge>
        </div>
        <p className="text-base leading-relaxed text-foreground">
          {artifact.verdict}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {artifact.statusSummary}
        </p>
      </header>

      {subSections.map((subSection) => (
        <section key={subSection.key} className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">
              {subSection.title}
            </h3>
            {subSection.prose ? (
              <div className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
                <ReactMarkdown>{subSection.prose}</ReactMarkdown>
              </div>
            ) : null}
          </div>
          {subSection.fields.length > 0 ? (
            <div className="space-y-4">
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
        </section>
      ))}

      <Separator />
      <ArtifactSources artifact={artifact} />
    </div>
  );
}

export function TypedArtifactRenderer({
  artifact,
  zoneId,
  showSectionTitle = true,
}: TypedArtifactRendererProps): React.ReactElement {
  // Schema-aware dispatch: route to typed renderer when zoneId matches.
  // Falls through to the generic reflection-based renderer below otherwise.
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
  }

  return (
    <GenericTypedArtifactRenderer
      artifact={artifact}
      zoneId={zoneId}
      showSectionTitle={showSectionTitle}
    />
  );
}
