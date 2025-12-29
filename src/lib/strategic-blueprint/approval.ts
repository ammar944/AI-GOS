// Approval utilities for Strategic Blueprint
// Handles merging user edits into approved blueprint with metadata

import type { StrategicBlueprintOutput } from "./output-types";

// =============================================================================
// Types
// =============================================================================

export interface ApprovedBlueprintMetadata {
  /** When the blueprint was approved */
  approvedAt: string;
  /** Whether user made any edits */
  hasUserEdits: boolean;
  /** List of section keys that were edited */
  editedSections: string[];
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Deep-merge a value at a dot-notation path into an object.
 * Handles both object and array paths (e.g., "competitors.0.name").
 *
 * @param obj - The object to merge into
 * @param path - Dot-notation path (e.g., "categorySnapshot.category")
 * @param value - The new value to set
 * @returns A new object with the value merged at the path
 */
export function setFieldAtPath(obj: unknown, path: string, value: unknown): unknown {
  const parts = path.split(".");
  if (parts.length === 0) return value;

  // Clone the object
  const result: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];

    // Check if next key is a number (array index)
    if (/^\d+$/.test(nextKey)) {
      // Current is an array
      const arr = Array.isArray(current[key]) ? [...(current[key] as unknown[])] : [];
      current[key] = arr;
      current = arr as unknown as Record<string, unknown>;
    } else {
      // Current is an object
      current[key] = { ...(current[key] as Record<string, unknown>) };
      current = current[key] as Record<string, unknown>;
    }
  }

  const lastKey = parts[parts.length - 1];
  current[lastKey] = value;

  return result;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Creates an approved blueprint by merging pending edits into the original.
 * Returns a new blueprint object with approval metadata.
 *
 * @param original - The original strategic blueprint
 * @param pendingEdits - Map of section keys to field edits: { sectionKey: { fieldPath: newValue } }
 * @returns A new StrategicBlueprintOutput with edits merged and approval metadata
 */
export function createApprovedBlueprint(
  original: StrategicBlueprintOutput,
  pendingEdits: Record<string, Record<string, unknown>>
): StrategicBlueprintOutput {
  // Deep clone the original blueprint
  const approved = JSON.parse(JSON.stringify(original)) as StrategicBlueprintOutput;

  // Track which sections were edited
  const editedSections: string[] = [];

  // Apply edits for each section
  for (const [sectionKey, sectionEdits] of Object.entries(pendingEdits)) {
    if (!sectionEdits || Object.keys(sectionEdits).length === 0) {
      continue;
    }

    // Record that this section was edited
    editedSections.push(sectionKey);

    // Get the original section data
    let sectionData = approved[sectionKey as keyof Omit<StrategicBlueprintOutput, "metadata">] as unknown;

    // Apply each field edit
    for (const [fieldPath, newValue] of Object.entries(sectionEdits)) {
      sectionData = setFieldAtPath(sectionData, fieldPath, newValue);
    }

    // Update the section in the approved blueprint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (approved as any)[sectionKey] = sectionData;
  }

  // Update metadata with approval info
  const hasUserEdits = editedSections.length > 0;
  approved.metadata = {
    ...approved.metadata,
    // Add approval-specific fields to metadata
    // Note: We extend the existing metadata structure
  };

  // Add approval metadata as additional fields (TypeScript allows extra properties at runtime)
  const approvedWithMeta = approved as StrategicBlueprintOutput & {
    approvalMetadata: ApprovedBlueprintMetadata;
  };

  approvedWithMeta.approvalMetadata = {
    approvedAt: new Date().toISOString(),
    hasUserEdits,
    editedSections,
  };

  return approvedWithMeta;
}
