import { normalizeResearchSectionId } from '@/lib/journey/research-sections';
import type { PipelineSectionId, PipelineState, SectionStatus } from '@/lib/research/pipeline-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveEditedSectionStatus(status: SectionStatus): SectionStatus {
  switch (status) {
    case 'approved':
    case 'complete':
      return status;
    default:
      return 'complete';
  }
}

export function deepMergeRecords(
  base: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, updateValue] of Object.entries(updates)) {
    const existingValue = merged[key];

    if (isRecord(existingValue) && isRecord(updateValue)) {
      merged[key] = deepMergeRecords(existingValue, updateValue);
      continue;
    }

    merged[key] = updateValue;
  }

  return merged;
}

export function mergeSectionResult(
  researchResults: Record<string, unknown> | null | undefined,
  sectionId: PipelineSectionId,
  runId: string,
  updates: Record<string, unknown>,
): {
  mergedData: Record<string, unknown>;
  mergedResult: Record<string, unknown>;
} {
  const existingResult = findExistingSectionResult(researchResults, sectionId);
  const existingData = isRecord(existingResult.data) ? existingResult.data : {};
  const mergedData = deepMergeRecords(existingData, updates);

  const mergedResult: Record<string, unknown> = {
    ...existingResult,
    status:
      typeof existingResult.status === 'string'
        ? existingResult.status
        : 'complete',
    section: sectionId,
    durationMs:
      typeof existingResult.durationMs === 'number'
        ? existingResult.durationMs
        : 0,
    runId:
      typeof existingResult.runId === 'string' ? existingResult.runId : runId,
    data: mergedData,
  };

  return {
    mergedData,
    mergedResult,
  };
}

function findExistingSectionResult(
  researchResults: Record<string, unknown> | null | undefined,
  sectionId: PipelineSectionId,
): Record<string, unknown> {
  if (!researchResults) {
    return {};
  }

  for (const [storedSectionId, value] of Object.entries(researchResults)) {
    if (normalizeResearchSectionId(storedSectionId) !== sectionId) {
      continue;
    }

    return isRecord(value) ? value : {};
  }

  return {};
}

export function applyEditedSectionData(
  state: PipelineState,
  sectionId: PipelineSectionId,
  mergedData: Record<string, unknown>,
): PipelineState {
  return {
    ...state,
    currentSectionId: sectionId,
    sections: state.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            data: mergedData,
            error: null,
            status: resolveEditedSectionStatus(section.status),
          }
        : section,
    ),
  };
}
