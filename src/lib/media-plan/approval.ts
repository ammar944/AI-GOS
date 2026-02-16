// Approval utilities for Media Plan
// Handles merging user edits into approved media plan with metadata

import type { MediaPlanOutput } from "./types";
import { setFieldAtPath } from "@/lib/strategic-blueprint/approval";

// =============================================================================
// Types
// =============================================================================

export interface ApprovedMediaPlanMetadata {
  approvedAt: string;
  hasUserEdits: boolean;
  editedSections: string[];
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Creates an approved media plan by merging pending edits into the original.
 * Returns a new MediaPlanOutput with edits merged and approval metadata.
 */
export function createApprovedMediaPlan(
  original: MediaPlanOutput,
  pendingEdits: Record<string, Record<string, unknown>>
): MediaPlanOutput {
  // Deep clone the original
  const approved = JSON.parse(JSON.stringify(original)) as MediaPlanOutput;

  const editedSections: string[] = [];

  for (const [sectionKey, sectionEdits] of Object.entries(pendingEdits)) {
    if (!sectionEdits || Object.keys(sectionEdits).length === 0) {
      continue;
    }

    editedSections.push(sectionKey);

    let sectionData = approved[sectionKey as keyof Omit<MediaPlanOutput, "metadata">] as unknown;

    for (const [fieldPath, newValue] of Object.entries(sectionEdits)) {
      sectionData = setFieldAtPath(sectionData, fieldPath, newValue);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (approved as any)[sectionKey] = sectionData;
  }

  const hasUserEdits = editedSections.length > 0;

  const approvedWithMeta = approved as MediaPlanOutput & {
    approvalMetadata: ApprovedMediaPlanMetadata;
  };

  approvedWithMeta.approvalMetadata = {
    approvedAt: new Date().toISOString(),
    hasUserEdits,
    editedSections,
  };

  return approvedWithMeta;
}
