import { JOURNEY_FIELD_LABELS } from './field-catalog';

/**
 * Build the research context string passed to the Railway worker runners.
 *
 * Emits one labeled line per non-empty field using the human-readable label
 * from `JOURNEY_FIELD_LABELS` (falls back to the raw key if no label is
 * registered). Empty, whitespace-only, and undefined values are skipped so
 * optional fields don't produce `"undefined"` in the worker context.
 *
 * This is the single source of truth for the context string format — both
 * `handleStartFromReview` and `handleStartFromUnifiedReview` in
 * `src/app/journey/page.tsx` call this helper so the two submit paths
 * produce identical context shapes.
 */
export function buildJourneyResearchContext(
  fields: Record<string, string | undefined>,
  orderedKeys?: readonly string[],
): string {
  const keys = orderedKeys ?? Object.keys(fields);
  const lines: string[] = ["Here's what I found about the company:"];
  for (const key of keys) {
    const raw = fields[key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    const label = JOURNEY_FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${value}`);
  }
  lines.push('', 'Please use this context and begin the research journey.');
  return lines.join('\n');
}
