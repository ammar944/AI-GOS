'use client';

import { AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  JourneyRunView,
  JourneySectionView,
} from '@/lib/journey/run-view';

interface JourneyRunArtifactVisibilityPanelProps {
  view: JourneyRunView | null;
}

type VisibilityTone = 'success' | 'warning' | 'danger';

interface MetadataEntry {
  label: string;
  value: string;
}

interface VisibilitySummary {
  section: JourneySectionView;
  cardCount: number;
  label: string;
  tone: VisibilityTone;
  metadata: MetadataEntry[];
}

function sortSections(sections: JourneySectionView[]): JourneySectionView[] {
  return [...sections].sort((left, right) => left.order - right.order);
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function formatDuration(durationMs: number | undefined): string {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return 'not recorded';
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }

  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function getCardVersionCount(section: JourneySectionView): number {
  return section.cards.reduce((total, card) => total + card.versions.length, 0);
}

function getCitationCount(section: JourneySectionView): number {
  return section.result?.provenance?.citationCount ?? section.result?.citations?.length ?? 0;
}

function getValidationIssueCount(section: JourneySectionView): number {
  return section.result?.validation?.issues.length ?? 0;
}

function getVisibilityLabel(section: JourneySectionView): string {
  if (section.cards.length > 0) {
    return pluralize(section.cards.length, 'visible card');
  }

  if (section.result?.status === 'error') {
    return 'Persisted error has no visible cards';
  }

  return 'Persisted output has no visible cards';
}

function getVisibilityTone(section: JourneySectionView): VisibilityTone {
  if (section.cards.length > 0) {
    return 'success';
  }

  if (section.result?.status === 'error') {
    return 'danger';
  }

  return 'warning';
}

function getToneClassName(tone: VisibilityTone): string {
  if (tone === 'success') {
    return 'border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)] text-[var(--accent-green)]';
  }

  if (tone === 'danger') {
    return 'border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] text-[var(--accent-red)]';
  }

  return 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] text-[var(--accent-amber)]';
}

function getToneIcon(tone: VisibilityTone): React.ReactNode {
  if (tone === 'success') {
    return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  return <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />;
}

function getMetadata(section: JourneySectionView): MetadataEntry[] {
  const citationCount = getCitationCount(section);
  const versionCount = getCardVersionCount(section);
  const validationIssueCount = getValidationIssueCount(section);

  return [
    {
      label: 'source',
      value: section.result?.section ?? 'run view cards',
    },
    {
      label: 'artifact',
      value: section.result?.status ?? 'not persisted',
    },
    {
      label: 'citations',
      value: pluralize(citationCount, 'citation'),
    },
    {
      label: 'versions',
      value: pluralize(versionCount, 'saved version'),
    },
    {
      label: 'duration',
      value: formatDuration(section.result?.durationMs),
    },
    {
      label: 'diagnostics',
      value: pluralize(validationIssueCount, 'validation issue'),
    },
  ];
}

function getVisibilitySummaries(
  view: JourneyRunView,
): VisibilitySummary[] {
  return sortSections(view.sections)
    .filter((section) => Boolean(section.result) || section.cards.length > 0)
    .map((section) => ({
      section,
      cardCount: section.cards.length,
      label: getVisibilityLabel(section),
      tone: getVisibilityTone(section),
      metadata: getMetadata(section),
    }));
}

export function JourneyRunArtifactVisibilityPanel({
  view,
}: JourneyRunArtifactVisibilityPanelProps): React.ReactElement | null {
  if (!view || view.sections.length === 0) {
    return null;
  }

  const summaries = getVisibilitySummaries(view);
  if (summaries.length === 0) {
    return null;
  }

  const hiddenArtifactCount = summaries.filter(
    (summary) => Boolean(summary.section.result) && summary.cardCount === 0,
  ).length;

  return (
    <section
      data-testid="journey-run-artifact-visibility-panel"
      className="border-b border-[var(--border-subtle)] bg-[rgba(7,9,14,0.62)] px-4 py-3"
      aria-label="Journey artifact visibility"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Artifact visibility
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Persisted outputs grouped by Journey section
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          <FileText className="h-3 w-3" aria-hidden="true" />
          {hiddenArtifactCount === 0
            ? 'cards visible'
            : pluralize(hiddenArtifactCount, 'output hidden')}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {summaries.map((summary) => (
          <article
            key={summary.section.id}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-[var(--text-tertiary)]">
                  {String(summary.section.order + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {summary.section.label}
                </h3>
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
                  getToneClassName(summary.tone),
                )}
              >
                {getToneIcon(summary.tone)}
                {summary.label}
              </span>
            </div>

            {summary.cardCount === 0 && (
              <p className="mt-2 border-l-2 border-[rgba(245,158,11,0.34)] pl-2 text-xs leading-5 text-[var(--text-secondary)]">
                A persisted result exists, but the current Journey card parser did not produce a user-facing card for this section.
              </p>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                Metadata
              </summary>
              <dl className="mt-2 grid gap-1 rounded-md border border-[var(--border-subtle)] bg-[rgba(7,9,14,0.55)] p-2 text-[11px]">
                {summary.metadata.map((entry) => (
                  <div key={entry.label} className="grid grid-cols-[84px_1fr] gap-2">
                    <dt className="font-mono text-[var(--text-tertiary)]">
                      {entry.label}
                    </dt>
                    <dd className="min-w-0 truncate text-[var(--text-secondary)]">
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
