'use client';

import {
  BarChart3,
  Users,
  Swords,
  MessageSquare,
  TrendingUp,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';

import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { pickPositioningTypedArtifact } from '@/types/positioning-artifact';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { TypedArtifactRenderer } from '@/components/research-v2/typed-artifact-renderer';
import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';

import { ResearchCardShell } from './research-card-shell';

// ---------------------------------------------------------------------------
// Per-section accent colors (from spec + design system)
// ---------------------------------------------------------------------------

export const SECTION_ACCENT: Record<PositioningSectionId, string> = {
  positioningMarketCategory: '#3b7aff',
  positioningBuyerICP: '#10b981',
  positioningCompetitorLandscape: '#f59e0b',
  positioningVoiceOfCustomer: '#a78bfa',
  positioningDemandIntent: '#f97316',
  positioningOfferDiagnostic: '#10b981',
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

// ---------------------------------------------------------------------------
// SectionCard props
// ---------------------------------------------------------------------------

interface SectionCardProps {
  zoneId: PositioningSectionId;
  body: { markdown?: string; title?: string; data?: unknown } | undefined;
  workerState: AuditStateResponse['workerStates'][number] | undefined;
}

export function SectionCard({ zoneId, body, workerState }: SectionCardProps) {
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
      ? (workerState?.latestActivity ?? 'Drafting…')
      : undefined;

  return (
    <div id={`section-${zoneId}`} className="scroll-mt-16">
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
