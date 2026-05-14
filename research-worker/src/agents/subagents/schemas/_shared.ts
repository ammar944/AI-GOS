import { z } from 'zod';

export const SourceSchema = z
  .object({
    title: z.string().describe('Human-readable source title.'),
    url: z.string().describe('Canonical public URL for the source.'),
    whyItMatters: z
      .string()
      .optional()
      .describe('Why this source supports the Section judgment.'),
  })
  .describe('Public source used to support a positioning Section Artifact.');

export type Source = z.infer<typeof SourceSchema>;
