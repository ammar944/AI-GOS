import { z } from 'zod';

const sourceGapSeveritySchema = z.enum(['info', 'warn', 'blocker']);

const sourceGapSchema = z.object({
  field: z.string().min(1),
  reason: z.string().min(1),
  remediation: z.string().min(1),
  severity: sourceGapSeveritySchema,
  confidence: z.number().int().min(0).max(10),
});

export const ingestIdentitySourceSchema = z.object({
  source_url: z.string().min(1),
  retrieved_at: z.string().datetime(),
  describes: z.string().min(1),
});

export const ingestIdentityOutputSchema = z.object({
  run_id: z.string().min(1),
  company_name: z.string().min(1),
  domain: z.string().min(1),
  category: z.string().min(1),
  core_keywords: z.array(z.string().min(1)),
  negative_keywords: z.array(z.string().min(1)),
  sources: z.array(ingestIdentitySourceSchema),
  source_gaps: z.array(sourceGapSchema),
  generated_at: z.string().datetime(),
});

export type IngestIdentitySource = z.infer<typeof ingestIdentitySourceSchema>;
export type IngestIdentityOutput = z.infer<typeof ingestIdentityOutputSchema>;
