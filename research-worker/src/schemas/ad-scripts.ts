import { z } from 'zod';
import { flexibleEnum } from '../contracts';

export const adScriptGenerateSchema = z.object({
  title: z.string(),
  type: flexibleEnum(['video', 'static', 'email'] as const, 'video'),
  platform: flexibleEnum(['meta', 'google', 'linkedin'] as const, 'meta'),
  angle: flexibleEnum(
    ['painPoint', 'outcome', 'socialProof', 'curiosity', 'urgency', 'identity', 'contrarian'] as const,
    'painPoint',
  ),
  hookType: z.string(),
  duration: z.string().optional(),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  cta: z.string(),
  body: z.string(),
  hookVariants: z.array(z.string()).optional(),
  designDirection: z.string().optional(),
  groundedIn: z.array(z.object({
    section: z.string(),
    claim: z.string(),
    label: z.string(),
  })),
  confidenceScore: z.number(),
  humanizedPass: z.boolean(),
  patternsFixed: z.number().optional(),
  flaggedClaims: z.array(z.string()).optional(),
});

export const awarenessLevelOutputSchema = z.object({
  scripts: z.array(adScriptGenerateSchema),
});

export type AdScriptGenerate = z.infer<typeof adScriptGenerateSchema>;
