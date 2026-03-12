import {
  PIPELINE_SECTION_CONFIG,
  PIPELINE_SECTION_DEPENDENCIES,
  PIPELINE_SECTION_ORDER,
  type PipelineRunId,
  type PipelineSectionId,
  type PipelineState,
} from '@/lib/research/pipeline-types';

export function createInitialPipelineState(runId: PipelineRunId): PipelineState {
  return {
    runId,
    currentSectionId: null,
    status: 'idle',
    approvedSectionIds: [],
    sections: PIPELINE_SECTION_ORDER.map((sectionId) => {
      const config = PIPELINE_SECTION_CONFIG[sectionId];

      return {
        id: sectionId,
        toolName: config.toolName,
        boundaryKey: config.boundaryKey,
        displayName: config.displayName,
        status: 'pending',
        data: null,
        jobId: null,
        error: null,
      };
    }),
  };
}

export function getNextSectionId(
  approvedSectionIds: readonly PipelineSectionId[],
): PipelineSectionId | null {
  for (const sectionId of PIPELINE_SECTION_ORDER) {
    if (!approvedSectionIds.includes(sectionId)) {
      return sectionId;
    }
  }

  return null;
}

export function markSectionRunning(
  state: PipelineState,
  sectionId: PipelineSectionId,
  jobId: string,
): PipelineState {
  return {
    ...state,
    currentSectionId: sectionId,
    status: 'running',
    sections: state.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            status: 'running',
            jobId,
            error: null,
          }
        : section,
    ),
  };
}

export function markSectionComplete(
  state: PipelineState,
  sectionId: PipelineSectionId,
  data: Record<string, unknown>,
): PipelineState {
  return {
    ...state,
    currentSectionId: sectionId,
    status: 'gated',
    sections: state.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            status: 'complete',
            data,
            error: null,
          }
        : section,
    ),
  };
}

export function markSectionApproved(
  state: PipelineState,
  sectionId: PipelineSectionId,
): PipelineState {
  const approvedSectionIds = state.approvedSectionIds.includes(sectionId)
    ? state.approvedSectionIds
    : [...state.approvedSectionIds, sectionId];
  const isComplete = approvedSectionIds.length === PIPELINE_SECTION_ORDER.length;

  return {
    ...state,
    status: isComplete ? 'complete' : 'gated',
    approvedSectionIds,
    sections: state.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            status: 'approved',
            error: null,
          }
        : section,
    ),
  };
}

export function invalidateDownstream(
  state: PipelineState,
  editedSectionId: PipelineSectionId,
): PipelineState {
  const staleSectionIds = getPipelineAffectedSectionIds(editedSectionId).filter(
    (sectionId) => sectionId !== editedSectionId,
  );

  if (staleSectionIds.length === 0) {
    return state;
  }

  const approvedSectionIds = state.approvedSectionIds.filter(
    (sectionId) => !staleSectionIds.includes(sectionId),
  );

  return {
    ...state,
    currentSectionId: editedSectionId,
    status:
      approvedSectionIds.length === PIPELINE_SECTION_ORDER.length ? 'complete' : 'gated',
    approvedSectionIds,
    sections: state.sections.map((section) =>
      staleSectionIds.includes(section.id)
        ? {
            ...section,
            status: 'stale',
          }
        : section,
    ),
  };
}

function getPipelineAffectedSectionIds(
  sectionId: PipelineSectionId,
): PipelineSectionId[] {
  const affected = new Set<PipelineSectionId>([sectionId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const candidate of PIPELINE_SECTION_ORDER) {
      if (affected.has(candidate)) {
        continue;
      }

      if (PIPELINE_SECTION_DEPENDENCIES[candidate].some((dependency) => affected.has(dependency))) {
        affected.add(candidate);
        changed = true;
      }
    }
  }

  return PIPELINE_SECTION_ORDER.filter((candidate) => affected.has(candidate));
}
