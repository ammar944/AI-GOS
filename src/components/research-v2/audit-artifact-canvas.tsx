'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import {
  POSITIONING_SECTION_IDS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

import {
  collectAllSources,
  projectAuditArtifact,
  type ArtifactSectionRow,
  type ResearchJobActivityMap,
} from '@/lib/research-v2/audit-artifact-view';
import type { AuditArtifact } from '@/lib/research-v2/audit-artifact-schema';

import { ArtifactZone } from './artifact-zone';
import { SourcesPanel } from './sources-panel';

interface AuditArtifactCanvasProps {
  runId: string;
  researchResults: Record<string, unknown> | null | undefined;
  artifactSections?: Record<string, unknown> | null | undefined;
  jobActivity: ResearchJobActivityMap | null | undefined;
  className?: string;
}

function ThesisCard({ thesis }: { thesis: AuditArtifact['thesis'] }) {
  if (!thesis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Positioning thesis</CardTitle>
          <CardDescription>
            The thesis card will surface once the deep-research corpus completes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Positioning thesis</CardTitle>
        {thesis.target_user ? (
          <CardDescription>{thesis.target_user}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {thesis.positioning_statement ? (
          <p className="leading-relaxed">{thesis.positioning_statement}</p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {thesis.jtbd ? (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Job to be done
              </div>
              <div>{thesis.jtbd}</div>
            </div>
          ) : null}
          {thesis.competitors && thesis.competitors.length > 0 ? (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Competitors
              </div>
              <div>{thesis.competitors.join(', ')}</div>
            </div>
          ) : null}
          {thesis.win_axes && thesis.win_axes.length > 0 ? (
            <div className="md:col-span-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Win axes
              </div>
              <div>{thesis.win_axes.join(' · ')}</div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AuditArtifactCanvas({
  runId,
  researchResults,
  artifactSections,
  jobActivity,
  className,
}: AuditArtifactCanvasProps) {
  const artifact = useMemo(
    () =>
      projectAuditArtifact({
        runId,
        researchResults,
        jobActivity,
        artifactSections: artifactSections as
          | Record<string, ArtifactSectionRow>
          | null
          | undefined,
      }),
    [runId, researchResults, artifactSections, jobActivity],
  );

  const allSources = useMemo(() => collectAllSources(artifact), [artifact]);
  const [retrying, setRetrying] = useState<Set<string>>(() => new Set());

  const handleRetry = useCallback(
    async ({
      zoneId,
      usePartialContext,
    }: {
      zoneId: string;
      usePartialContext: boolean;
    }) => {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.add(zoneId);
        return next;
      });
      try {
        const res = await fetch('/api/research-v2/rerun-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runId,
            zone: zoneId,
            executionMode: 'deep',
            usePartialContext,
          }),
        });
        if (!res.ok && res.status !== 409) {
          const detail = await res.text().catch(() => '');
          console.error(
            '[canvas] rerun-section failed',
            res.status,
            detail.slice(0, 200),
          );
        }
      } catch (err) {
        console.error('[canvas] rerun-section threw', err);
      } finally {
        setRetrying((prev) => {
          const next = new Set(prev);
          next.delete(zoneId);
          return next;
        });
      }
    },
    [runId],
  );

  const handleCancel = useCallback(
    async (zoneId: string) => {
      try {
        await fetch('/api/research-v2/abort-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, zone: zoneId }),
        });
      } catch (err) {
        console.error('[canvas] abort-section threw', err);
      }
    },
    [runId],
  );

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 p-4 lg:p-6">
          <main className="space-y-4">
            <ThesisCard thesis={artifact.thesis} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {POSITIONING_SECTION_IDS.map((zoneId: PositioningSectionId) => {
                const zone = artifact.zones[zoneId];
                if (!zone) return null;
                return (
                  <ArtifactZone
                    key={zoneId}
                    zone={zone}
                    activityUpdates={jobActivity?.[zoneId]?.updates}
                    onRetry={handleRetry}
                    onCancel={handleCancel}
                    isRetrying={retrying.has(zoneId)}
                  />
                );
              })}
            </div>
          </main>

          <aside className="lg:sticky lg:top-4 lg:self-start lg:h-[calc(100svh-2rem)]">
            <SourcesPanel sources={allSources} />
          </aside>
        </div>
      </ScrollArea>
    </div>
  );
}
