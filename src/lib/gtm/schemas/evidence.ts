import { z } from 'zod';

export const EVIDENCE_SOURCE_TYPES = [
  'url',
  'document',
  'transcript',
  'manual_note',
  'web_research',
  'ad_library',
  'tool_result',
] as const;

export const evidenceSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(EVIDENCE_SOURCE_TYPES),
  label: z.string().min(1),
  url: z.string().url().optional(),
  excerpt: z.string().optional(),
  capturedAt: z.string().datetime(),
});

export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
