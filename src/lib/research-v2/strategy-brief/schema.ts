import { z } from 'zod';

export const STRATEGY_BRIEF_SECTION_ID = 'strategyBrief' as const;
export const STRATEGY_BRIEF_TITLE = 'Offer & Angle Brief';

export const strategyBriefAngleSchema = z.object({
  name: z.string().min(1),
  vignette: z
    .string()
    .min(1)
    .describe('First-person ICP moment this angle dramatizes'),
  coreEmotion: z.string().min(1),
  adFrame: z.string().min(1).describe('How the ad opens; what it leads with'),
  rank: z.number().describe('1 = lead angle. Integer rank, no duplicates.'),
  sourceEvidence: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'Committed section ids and/or evidence sourceUrls this angle traces to',
    ),
});

export const strategyBriefBodySchema = z.object({
  positioning: z.object({
    oneLiner: z.string().min(1),
    valueProp: z.string().min(1),
    mechanism: z
      .string()
      .min(1)
      .describe('Non-technical mechanism, client language'),
  }),
  angles: z.array(strategyBriefAngleSchema).min(1),
  lexicon: z.object({
    approved: z.array(z.string().min(1)),
    banned: z.array(
      z.object({
        term: z.string().min(1),
        reason: z.string().min(1),
      }),
    ),
  }),
  funnelStance: z.string().min(1),
  gaps: z
    .array(z.string())
    .describe('Honest gaps: what the brief could not establish and why'),
  changelog: z
    .array(
      z.object({
        revision: z.number(),
        summary: z.string().min(1),
        rationale: z.string().min(1),
        at: z.string().min(1),
      }),
    )
    .min(1),
});

export const strategyBriefArtifactSchema = z.object({
  sectionTitle: z.string().min(1),
  verdict: z.string().min(1),
  statusSummary: z.string().min(1),
  confidence: z
    .number()
    .describe(
      '0..1; enforce range in code, not schema (Anthropic structured-output limit)',
    ),
  sources: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().min(1),
      }),
    )
    .min(1),
  body: strategyBriefBodySchema,
});

export type StrategyBriefBody = z.infer<typeof strategyBriefBodySchema>;
export type StrategyBriefArtifact = z.infer<
  typeof strategyBriefArtifactSchema
>;
