// Pure client-safe utility — no server imports.
// Extracted from business-profiles.ts to avoid pulling Supabase/Clerk
// into client components.

import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';

function formatStructuredList(value: unknown[]): string | null {
  const items = value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    const url = typeof record.url === 'string' ? record.url.trim() : '';

    if (!label || !url) {
      return [];
    }

    return [`${label}: ${url}`];
  });

  return items.length === 0 ? null : items.join('\n');
}

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
    } else if (typeof value === 'boolean') {
      result[key] = value ? 'Yes' : 'No';
    } else if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((v) => typeof v === 'string')
    ) {
      result[key] = value.join(', ');
    } else if (Array.isArray(value) && value.length > 0) {
      const structuredValue = formatStructuredList(value);
      if (structuredValue !== null) {
        result[key] = structuredValue;
      }
    }
  }
  return result;
}
