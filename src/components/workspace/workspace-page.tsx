'use client';

import { useCallback } from 'react';
import { StatusStrip } from './status-strip';
import { ArtifactCanvas } from './artifact-canvas';
import { RightRail } from './right-rail';
import { BottomSheet } from './bottom-sheet';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import { parseResearchToCards } from '@/lib/workspace/card-taxonomy';
import type { SectionKey } from '@/lib/workspace/types';
import { SECTION_PIPELINE } from '@/lib/workspace/pipeline';

interface WorkspacePageProps {
  userId?: string | null;
  activeRunId?: string | null;
}

function WorkspaceResearchBridge({ userId, activeRunId }: WorkspacePageProps) {
  const { setSectionPhase, setCards } = useWorkspace();

  const onSectionComplete = useCallback(
    (section: string, result: ResearchSectionResult) => {
      if (!SECTION_PIPELINE.includes(section as SectionKey)) return;
      const key = section as SectionKey;

      if (result.status === 'error') {
        setSectionPhase(key, 'error', result.error ?? 'Unknown error');
        return;
      }

      if (result.status !== 'complete' && result.status !== 'partial') return;

      const data = (result.data ?? {}) as Record<string, unknown>;
      const cards = parseResearchToCards(key, data);
      setCards(key, cards);
      setSectionPhase(key, 'review');
    },
    [setSectionPhase, setCards],
  );

  useResearchRealtime({
    userId,
    activeRunId,
    onSectionComplete,
  });

  return null;
}

export function WorkspacePage({ userId, activeRunId }: WorkspacePageProps) {
  return (
    <div className="flex h-screen flex-col bg-[var(--bg-base)]">
      <WorkspaceResearchBridge userId={userId} activeRunId={activeRunId} />
      <StatusStrip />
      <div className="flex flex-1 overflow-hidden">
        <ArtifactCanvas />
        {/* Right rail hidden on mobile, shown on md+ */}
        <div className="hidden md:flex">
          <RightRail />
        </div>
      </div>
      {/* Mobile bottom sheet — hidden on md+ */}
      <div className="md:hidden">
        <BottomSheet />
      </div>
    </div>
  );
}
