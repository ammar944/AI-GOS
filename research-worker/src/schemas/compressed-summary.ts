import { z } from 'zod';

export const CompressedSummarySchema = z.object({
  keyFindings: z.array(z.string()).min(1).max(7).describe(
    'Top findings, most important first. Max 7.',
  ),
  dataPoints: z.record(z.string(), z.union([z.string(), z.number(), z.record(z.string(), z.unknown())]))
    .transform((rec) => {
      // Coerce all values to strings so downstream consumers get a flat map
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec)) {
        out[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      return out;
    })
    .describe(
      'Key metric → value pairs (e.g., { "marketSize": "$50B", "avgCAC": "$1,200" })',
    ),
  confidence: z.enum(['high', 'medium', 'low']).describe(
    'Overall confidence in findings based on source quality and coverage',
  ),
  sources: z.array(z.string()).max(10).describe(
    'Source URLs or references used',
  ),
  gaps: z.array(z.string()).describe(
    'What we could not find or verify — helps the model know what to ask about',
  ),
});

export type CompressedSummary = z.infer<typeof CompressedSummarySchema>;
