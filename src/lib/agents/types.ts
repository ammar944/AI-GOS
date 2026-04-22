// src/lib/agents/types.ts
// Shared types — break circular deps between agent-loop.ts ↔ tools/index.ts

import { z } from 'zod';

export const ResearchReportSchema = z.object({
  competitors: z.object({
    list: z.array(z.object({
      name: z.string(),
      domain: z.string(),
      positioning: z.string(),
      weaknesses: z.array(z.string()),
      adSpendEstimate: z.string().optional(),
    })),
    positioningMoves: z.string().optional(),
  }).optional(),

  icp: z.object({
    validatedPersona: z.string(),
    triggers: z.array(z.string()),
    finalVerdict: z.string(),
    audienceRefinements: z.array(z.string()),
  }).optional(),

  offer: z.object({
    overallScore: z.number().min(1).max(10),
    status: z.enum(['strong', 'acceptable', 'weak']),
    pricingPosition: z.string(),
    redFlags: z.array(z.string()),
    recommendation: z.string(),
  }).optional(),

  keywords: z.object({
    categoryKeywords: z.array(z.string()),
    competitorKeywords: z.array(z.string()),
    adAngles: z.array(z.string()),
  }).optional(),

  mediaPlan: z.object({
    platformStrategy: z.string().optional(),
    creativeStrategy: z.string().optional(),
    campaignPhases: z.array(z.string()).optional(),
    budgetAllocation: z.record(z.number()).optional(),
    kpis: z.record(z.string()).optional(),
  }).optional(),
});

export type ResearchReport = z.infer<typeof ResearchReportSchema>;
