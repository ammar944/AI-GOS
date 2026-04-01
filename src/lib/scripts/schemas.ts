import { z } from 'zod';

const VALID_SECTIONS = [
  'industryMarket',
  'icpValidation',
  'offerAnalysis',
  'competitors',
  'keywordIntel',
  'crossAnalysis',
  'mediaPlan',
] as const;

export const groundedInSchema = z.object({
  section: z.enum(VALID_SECTIONS),
  claim: z.string(),
  label: z.string(),
});

export const adScriptSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['video', 'static', 'email']),
  platform: z.enum(['meta', 'google', 'linkedin']),
  awarenessLevel: z.enum(['unaware', 'problem', 'solution', 'product', 'mostAware']),
  angle: z.enum([
    'painPoint',
    'outcome',
    'socialProof',
    'curiosity',
    'urgency',
    'identity',
    'contrarian',
  ]),
  hookType: z.string(),
  duration: z.string().optional(),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  cta: z.string(),
  body: z.string(),
  hookVariants: z.array(z.string()).optional(),
  designDirection: z.string().optional(),
  groundedIn: z.array(groundedInSchema),
  confidenceScore: z.number().min(0).max(10),
  humanizedPass: z.boolean(),
  patternsFixed: z.number().optional(),
  flaggedClaims: z.array(z.string()).optional(),
});

export const adScriptPackSchema = z.object({
  scripts: z.array(adScriptSchema),
  generatedAt: z.string(),
  researchSessionId: z.string(),
  styleReferencesUsed: z.array(z.string()),
  summary: z.object({
    totalScripts: z.number(),
    byType: z.record(z.string(), z.number()),
    byPlatform: z.record(z.string(), z.number()),
    byAwareness: z.record(z.string(), z.number()),
  }),
});

export type AdScript = z.infer<typeof adScriptSchema>;
export type AdScriptPack = z.infer<typeof adScriptPackSchema>;
export type GroundedIn = z.infer<typeof groundedInSchema>;

export interface GenerationContext {
  researchSessionId: string;
  researchSessionRunId: string;
  researchSessionDate: string;
  researchSectionCount: number;
  styleReferencesUsed: Array<{ name: string; source: string }>;
  proofPointsUsed: Array<{ headline: string; type: string }>;
  userNote?: string | null;
  styleReferencesSnapshot?: Array<{ name: string; content: string; source: string }>;
}

export interface PackListItem {
  id: string;
  created_at: string;
  status: 'generating' | 'partial' | 'complete' | 'error';
  generation_context: GenerationContext | null;
  style_references_snapshot: unknown;
  diversity_score: number | null;
  diversity_flags: unknown;
  script_count: number;
}
