export type ResearchStreamingEntry = {
  text: string;
  status: 'running' | 'complete' | 'error';
  startedAt?: number;
};

export interface BufferedResearchStreamPatch {
  chunkBuffers: Record<string, string[]>;
  statusPatches: Record<
    string,
    {
      status?: 'running' | 'complete' | 'error';
      startedAt?: number;
    }
  >;
}

export function flushBufferedResearchChunks(
  current: Record<string, ResearchStreamingEntry>,
  patch: BufferedResearchStreamPatch,
): Record<string, ResearchStreamingEntry> {
  const next = { ...current };
  const sectionIds = new Set([
    ...Object.keys(patch.chunkBuffers),
    ...Object.keys(patch.statusPatches),
  ]);

  for (const sectionId of sectionIds) {
    const chunks = patch.chunkBuffers[sectionId] ?? [];
    const statusPatch = patch.statusPatches[sectionId];
    const prev = next[sectionId];
    const isFreshRun =
      statusPatch?.status === 'running' &&
      statusPatch.startedAt != null &&
      statusPatch.startedAt !== prev?.startedAt;
    const baseText = isFreshRun ? '' : prev?.text ?? '';

    next[sectionId] = {
      text: `${baseText}${chunks.join('')}`,
      status: statusPatch?.status ?? prev?.status ?? 'running',
      startedAt: statusPatch?.startedAt ?? prev?.startedAt,
    };
  }

  return next;
}
