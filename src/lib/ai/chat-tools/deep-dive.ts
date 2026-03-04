import { z } from 'zod';
import { tool } from 'ai';
import { SECTION_LABELS } from './utils';

const SECTION_KEYS = [
  'industryMarketOverview',
  'icpAnalysisValidation',
  'offerAnalysisViability',
  'competitorAnalysis',
  'crossAnalysisSynthesis',
] as const;

export function createDeepDiveTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Load the complete raw data for a specific blueprint section. ' +
      'ONLY use this when queryBlueprint does not provide enough detail. ' +
      'This returns the full uncompressed section (~5K-15K tokens) — use sparingly. ' +
      'Prefer queryBlueprint for most tasks.',
    inputSchema: z.object({
      section: z
        .enum(SECTION_KEYS)
        .describe('The blueprint section to load in full'),
      field: z
        .string()
        .optional()
        .describe(
          'Optional: dot-notation path to a specific field within the section. ' +
          'Use this to narrow the response (e.g., "competitors[0]", "messagingFramework.adHooks")'
        ),
    }),
    execute: async ({ section, field }) => {
      const sectionData = blueprint[section];
      const label = SECTION_LABELS[section] || section;

      if (!sectionData || typeof sectionData !== 'object') {
        return {
          section,
          label,
          status: 'empty' as const,
          data: null,
          error: `Section "${section}" has no data in this blueprint.`,
        };
      }

      if (field) {
        const parts = field.split('.').flatMap(part => {
          const match = part.match(/^(.+)\[(\d+)\]$/);
          if (match) return [match[1], parseInt(match[2], 10)];
          return [part];
        });

        let current: unknown = sectionData;
        for (const part of parts) {
          if (current === null || current === undefined) break;
          if (typeof part === 'number') {
            if (!Array.isArray(current)) {
              current = undefined;
              break;
            }
            current = current[part];
          } else {
            if (typeof current !== 'object') {
              current = undefined;
              break;
            }
            current = (current as Record<string, unknown>)[part];
          }
        }

        if (current === undefined) {
          return {
            section,
            label,
            field,
            status: 'field-not-found' as const,
            data: null,
            error: `Field "${field}" not found in section "${section}".`,
          };
        }

        return {
          section,
          label,
          field,
          status: 'loaded' as const,
          data: current,
          tokenEstimate: Math.ceil(JSON.stringify(current).length / 4),
        };
      }

      const rawJson = JSON.stringify(sectionData, null, 2);
      return {
        section,
        label,
        status: 'loaded' as const,
        data: sectionData,
        tokenEstimate: Math.ceil(rawJson.length / 4),
        warning: rawJson.length > 20000
          ? 'Large section loaded. Consider using queryBlueprint for most queries.'
          : undefined,
      };
    },
  });
}
