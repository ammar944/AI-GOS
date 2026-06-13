'use client';

import { GapNote } from '@/components/research-v2/primitives';
import { GenericTypedArtifactRenderer } from '@/components/research-v2/typed-artifact-renderer';
import {
  strategyBriefArtifactSchema,
  type StrategyBriefArtifact,
} from '@/lib/research-v2/strategy-brief/schema';
import type { PositioningTypedArtifact } from '@/types/positioning-artifact';

export interface StrategyBriefCardProps {
  artifact: Record<string, unknown>;
}

function toRenderableStrategyBrief(
  artifact: StrategyBriefArtifact,
): PositioningTypedArtifact {
  return {
    sectionTitle: artifact.sectionTitle,
    verdict: artifact.verdict,
    statusSummary: artifact.statusSummary,
    confidence: artifact.confidence,
    sources: artifact.sources,
    ...artifact.body,
  };
}

export function parseStrategyBriefForRender(
  artifact: Record<string, unknown>,
): PositioningTypedArtifact | null {
  const parsed = strategyBriefArtifactSchema.safeParse(artifact);
  return parsed.success ? toRenderableStrategyBrief(parsed.data) : null;
}

export function StrategyBriefCard({
  artifact,
}: StrategyBriefCardProps): React.ReactElement {
  const renderable = parseStrategyBriefForRender(artifact);

  if (renderable === null) {
    return (
      <section aria-label="Offer & Angle Brief" className="mb-10">
        <GapNote subject="the offer and angle brief" />
      </section>
    );
  }

  return (
    <section
      aria-label="Offer & Angle Brief"
      className="mb-10 border-l-2 border-primary pl-5"
    >
      <div className="mb-5 font-sans text-[12px] font-medium text-muted-foreground">
        Offer &amp; Angle Brief
      </div>
      <GenericTypedArtifactRenderer
        artifact={renderable}
        zoneId="strategyBrief"
        showSectionTitle={false}
      />
    </section>
  );
}
