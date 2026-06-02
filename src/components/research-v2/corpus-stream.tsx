'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ActivityRail } from '@/components/research-v2/activity-rail';
import { SectionTitle } from '@/components/research-v2/ui-kit';
import {
  useResearchJobActivity,
  collapseResearchJobUpdates,
} from '@/lib/journey/research-job-activity';
import { mapCorpusUpdatesToSteps } from '@/lib/research-v2/corpus-activity';

interface CorpusStreamProps {
  userId: string;
  runId: string;
  onComplete: () => void;
}

export function CorpusStream({ userId, runId, onComplete }: CorpusStreamProps) {
  const activity = useResearchJobActivity({
    userId,
    activeRunId: runId,
  });

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const allUpdates = Object.values(activity).flatMap((job) =>
    collapseResearchJobUpdates(job.updates),
  );

  const corpusJob = Object.values(activity).find(
    (job) => job.tool === 'runDeepResearchProgram',
  );
  const isComplete = corpusJob?.status === 'complete';
  const isError = corpusJob?.status === 'error';

  const { steps, currentLabel } = useMemo(
    () => mapCorpusUpdatesToSteps(allUpdates),
    [allUpdates],
  );

  useEffect(() => {
    if (isComplete) {
      onCompleteRef.current();
    }
  }, [isComplete]);

  const live = !isComplete && !isError;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-2">
          <SectionTitle>Researching company…</SectionTitle>
          <p className="max-w-[68ch] text-[15px] leading-[1.6] text-muted-foreground">
            Building the source-backed corpus for your positioning audit. Takes
            30–90 seconds.
          </p>
        </div>

        <ActivityRail steps={steps} currentLabel={currentLabel} live={live} />

        {isError && !isComplete ? (
          <div className="border-l-2 border-red-500 pl-4">
            <p className="text-[14px] leading-[1.55] text-foreground">
              {corpusJob?.error ?? 'Research failed unexpectedly.'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
