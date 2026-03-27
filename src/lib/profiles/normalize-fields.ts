// Pure client-safe utility — no server imports.
// Extracted from business-profiles.ts to avoid pulling Supabase/Clerk
// into client components.

import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';

/**
 * Normalize all_fields (Record<string, unknown>) into Record<string, string>
 * for use as extractedFields in UnifiedFieldReview.
 *
 * Rules:
 * - String values: kept as-is
 * - Arrays of strings: joined with ", "
 * - Objects/nulls/undefined: skipped
 * - Only keys present in JOURNEY_FIELD_LABELS are included (filters out
 *   session metadata like activeJourneyRunId)
 */
export function normalizeProfileFields(
  allFields: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(allFields)) {
    if (!(key in JOURNEY_FIELD_LABELS)) continue;
    if (typeof value === 'string' && value.trim()) {
      result[key] = value;
    } else if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((v) => typeof v === 'string')
    ) {
      result[key] = value.join(', ');
    }
  }
  return result;
}
