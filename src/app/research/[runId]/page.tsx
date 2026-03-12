import type { ReactElement } from 'react';
import { PipelineView } from '@/components/research/pipeline-view';

interface ResearchPipelinePageProps {
  params: Promise<{
    runId: string;
  }>;
}

export default async function ResearchPipelinePage({
  params,
}: ResearchPipelinePageProps): Promise<ReactElement> {
  const { runId } = await params;

  return <PipelineView runId={runId} />;
}
