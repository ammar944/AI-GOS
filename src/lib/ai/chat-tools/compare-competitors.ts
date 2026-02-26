// Compare Competitors Tool
// Auto-execute tool (no needsApproval) — pure data extraction and restructuring.
// Builds a structured comparison table from the blueprint's competitor analysis section.

import { z } from 'zod';
import { tool } from 'ai';

/** Known default dimensions to surface when none are specified. */
const DEFAULT_DIMENSIONS = ['positioning', 'strengths', 'weaknesses', 'adHooks', 'pricingModel'];

/**
 * Stringify an unknown field value into a compact, readable string.
 * Arrays are joined with ', '; long strings are truncated at 120 chars.
 */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) {
    const joined = value
      .map(item => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)))
      .join(', ');
    return joined.length > 120 ? joined.slice(0, 117) + '...' : joined;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 120 ? str.slice(0, 117) + '...' : str;
  }
  const str = String(value);
  return str.length > 120 ? str.slice(0, 117) + '...' : str;
}

/**
 * Heuristic strength score for a competitor on a given dimension.
 * Higher = better (more strengths, fewer weaknesses, more content).
 */
function dimensionStrengthScore(competitor: Record<string, unknown>, dimension: string): number {
  const value = competitor[dimension];
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) {
    // For weaknesses, fewer items = stronger
    if (dimension.toLowerCase().includes('weakness')) {
      return value.length === 0 ? 10 : Math.max(0, 10 - value.length * 2);
    }
    return value.length;
  }
  if (typeof value === 'string') return value.length > 0 ? 1 : 0;
  return 0;
}

export function createCompareCompetitorsTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Generate a structured comparison table of competitors from the blueprint\'s competitor analysis. ' +
      'Use when the user asks to compare competitors, see a competitive overview, or understand ' +
      'competitive positioning differences.',
    inputSchema: z.object({
      dimensions: z
        .array(z.string())
        .optional()
        .describe(
          'Dimensions to compare across (e.g. ["positioning", "pricing", "strengths"]). ' +
          'Auto-detected from available data if not provided.'
        ),
      competitors: z
        .array(z.string())
        .optional()
        .describe('Filter to specific competitor names. Compares all if not provided.'),
    }),
    execute: async ({ dimensions: requestedDimensions, competitors: competitorFilter }) => {
      const competitorAnalysis = blueprint.competitorAnalysis as Record<string, unknown> | undefined;

      if (!competitorAnalysis) {
        return {
          competitors: [],
          dimensions: [],
          headers: [],
          rows: [],
          winnerPerColumn: {},
          error: 'No competitor data found in blueprint',
        };
      }

      // Extract the competitors array
      const rawCompetitors = competitorAnalysis.competitors as Record<string, unknown>[] | undefined;

      if (!Array.isArray(rawCompetitors) || rawCompetitors.length === 0) {
        return {
          competitors: [],
          dimensions: [],
          headers: [],
          rows: [],
          winnerPerColumn: {},
          error: 'No competitor data found in blueprint',
        };
      }

      // Apply name filter (case-insensitive)
      const filtered =
        competitorFilter && competitorFilter.length > 0
          ? rawCompetitors.filter(c => {
              const name = String(c.name ?? '').toLowerCase();
              return competitorFilter.some(f => name.includes(f.toLowerCase()));
            })
          : rawCompetitors;

      if (filtered.length === 0) {
        return {
          competitors: [],
          dimensions: [],
          headers: [],
          rows: [],
          winnerPerColumn: {},
          error: `No competitors matched the filter: ${competitorFilter?.join(', ')}`,
        };
      }

      // Determine dimensions to use
      let dimensions: string[];
      if (requestedDimensions && requestedDimensions.length > 0) {
        dimensions = requestedDimensions;
      } else {
        // Auto-detect from the first competitor's keys, excluding 'name'
        const firstKeys = Object.keys(filtered[0]).filter(k => k !== 'name');
        // Prefer default ordering if available, then append any additional keys
        const preferred = DEFAULT_DIMENSIONS.filter(d => firstKeys.includes(d));
        const extras = firstKeys.filter(k => !DEFAULT_DIMENSIONS.includes(k));
        dimensions = preferred.length > 0 ? [...preferred, ...extras] : firstKeys;
      }

      const competitorNames = filtered.map(c => String(c.name ?? 'Unknown'));

      // Build headers: ['Dimension', ...competitorNames]
      const headers = ['Dimension', ...competitorNames];

      // Build rows: one per dimension
      const rows: Record<string, string>[] = dimensions.map(dim => {
        const row: Record<string, string> = { Dimension: dim };
        for (const competitor of filtered) {
          const name = String(competitor.name ?? 'Unknown');
          row[name] = formatCellValue(competitor[dim]);
        }
        return row;
      });

      // Determine winner per dimension
      const winnerPerColumn: Record<string, string> = {};
      for (const dim of dimensions) {
        let bestName = '';
        let bestScore = -1;
        for (const competitor of filtered) {
          const score = dimensionStrengthScore(competitor, dim);
          if (score > bestScore) {
            bestScore = score;
            bestName = String(competitor.name ?? 'Unknown');
          }
        }
        if (bestName) {
          winnerPerColumn[dim] = bestName;
        }
      }

      return {
        competitors: competitorNames,
        dimensions,
        headers,
        rows,
        winnerPerColumn,
      };
    },
  });
}
