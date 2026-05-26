'use client';

import { type ReactElement } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Users,
  Swords,
  MessageSquare,
  TrendingUp,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';

import type {
  AllPositioningSectionId,
  PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { pickPositioningTypedArtifact } from '@/types/positioning-artifact';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { TypedArtifactRenderer } from '@/components/research-v2/typed-artifact-renderer';
import type { AuditStateResponse, SectionEvent } from '@/app/api/research-v2/audit-state/route';
import { getSectionSubSections } from '@/lib/lab-engine/sections/sub-sections';

import { ResearchCardShell } from './research-card-shell';

// ---------------------------------------------------------------------------
// Per-section accent colors (from spec + design system)
// ---------------------------------------------------------------------------

export const SECTION_ACCENT: Record<AllPositioningSectionId, string> = {
  positioningMarketCategory: '#3b7aff',
  positioningBuyerICP: '#10b981',
  positioningCompetitorLandscape: '#f59e0b',
  positioningVoiceOfCustomer: '#a78bfa',
  positioningDemandIntent: '#f97316',
  positioningOfferDiagnostic: '#10b981',
  positioningPaidMediaPlan: '#3b7aff',
};

const SECTION_ICON: Record<PositioningSectionId, LucideIcon> = {
  positioningMarketCategory: BarChart3,
  positioningBuyerICP: Users,
  positioningCompetitorLandscape: Swords,
  positioningVoiceOfCustomer: MessageSquare,
  positioningDemandIntent: TrendingUp,
  positioningOfferDiagnostic: Stethoscope,
};

// ---------------------------------------------------------------------------
// WorkerStatus → card status mapping
// ---------------------------------------------------------------------------

type CardStatus = 'streaming' | 'complete' | 'error';

function toCardStatus(
  workerStatus: AuditStateResponse['workerStates'][number]['status'] | undefined,
): CardStatus {
  if (!workerStatus) return 'streaming';
  switch (workerStatus) {
    case 'complete':
      return 'complete';
    case 'error':
    case 'aborted':
      return 'error';
    case 'running':
    case 'queued':
    default:
      return 'streaming';
  }
}

function getStreamingText(
  workerState: AuditStateResponse['workerStates'][number] | undefined,
): string {
  if (!workerState || workerState.status === 'queued') return 'Queued';
  return workerState.latestActivity ?? workerState.phaseLabel ?? 'Drafting…';
}

// ---------------------------------------------------------------------------
// SectionCard props
// ---------------------------------------------------------------------------

interface SectionCardProps {
  zoneId: PositioningSectionId;
  body: { markdown?: string; title?: string; data?: unknown } | undefined;
  events?: readonly SectionEvent[];
  workerState: AuditStateResponse['workerStates'][number] | undefined;
}

export function SectionCard({
  zoneId,
  body,
  events = [],
  workerState,
}: SectionCardProps): ReactElement {
  const status = toCardStatus(workerState?.status);
  const accentColor = SECTION_ACCENT[zoneId];
  const Icon = SECTION_ICON[zoneId];

  // Label: prefer live title from artifact, fall back to zone label
  const artifact = body ? pickPositioningTypedArtifact(body, zoneId) : null;
  const label = artifact?.sectionTitle ?? body?.title ?? zoneId;

  // Build citations from artifact sources
  const citations =
    artifact?.sources.map((src, i) => ({
      number: i + 1,
      url: src.url,
      title: src.title,
    })) ?? [];

  // Streaming text: latestActivity while running
  const streamingText =
    status === 'streaming'
      ? getStreamingText(workerState)
      : undefined;

  return (
    <div id={`section-${zoneId}`} className="scroll-mt-16">
      <SubSectionChecklist
        committedAll={artifact !== null}
        events={events}
        zoneId={zoneId}
      />

      <ResearchCardShell
        icon={Icon}
        label={label}
        accentColor={accentColor}
        status={status}
        streamingText={streamingText}
        citations={status === 'complete' ? citations : undefined}
        error={
          status === 'error'
            ? (workerState?.latestActivity ?? 'Section failed. Try rerunning.')
            : undefined
        }
      >
        {artifact ? (
          <TypedArtifactRenderer
            artifact={artifact}
            zoneId={zoneId}
            showSectionTitle={false}
          />
        ) : null}
      </ResearchCardShell>

      {/* Shimmer shown while streaming with no streamingText */}
      {status === 'streaming' && !streamingText && (
        <div className="px-4 py-2">
          <Shimmer className="text-sm text-muted-foreground">
            Drafting…
          </Shimmer>
        </div>
      )}
    </div>
  );
}

interface SubSectionChecklistProps {
  zoneId: PositioningSectionId;
  events: readonly SectionEvent[];
  committedAll: boolean;
}

function getCommittedSubSectionKeys(
  events: readonly SectionEvent[],
): ReadonlySet<string> {
  return new Set(
    events
      .filter((event) => event.event_type === 'sub-section-committed')
      .map((event) =>
        typeof event.payload?.subSectionKey === 'string' &&
        event.payload.status === 'committed'
          ? event.payload.subSectionKey
          : null,
      )
      .filter((key): key is string => key !== null),
  );
}

function SubSectionChecklist({
  committedAll,
  events,
  zoneId,
}: SubSectionChecklistProps): ReactElement {
  const committedKeys = getCommittedSubSectionKeys(events);

  return (
    <div className="mb-3 grid gap-2 rounded-[8px] border border-[color:var(--border)] px-4 py-3">
      {getSectionSubSections(zoneId).map((subSection) => {
        const committed = committedAll || committedKeys.has(subSection.key);
        return (
          <div
            key={subSection.key}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2 text-[color:var(--text-2)]">
              {committed ? (
                <CheckCircle2
                  className="size-3.5 shrink-0 text-[color:var(--green,var(--accent-green))]"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="size-3.5 shrink-0 text-[color:var(--text-4)]"
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{subSection.label}</span>
            </span>
            <span
              data-testid={`sub-section-status-${zoneId}-${subSection.key}`}
              className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-3)]"
            >
              {committed ? 'Committed' : 'Queued'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
