import { z } from 'zod';

export const meetingTypeSchema = z.enum([
  'discovery',
  'demo',
  'follow_up',
  'closing',
  'strategy',
  'kickoff',
  'review',
  'other',
]);

export const meetingTranscriptSubmitSchema = z.object({
  title: z.string().min(1).max(200),
  meetingType: meetingTypeSchema,
  transcript: z.string().min(50).max(400_000),
  runId: z.string().min(1),
});

/** NOTE: No .min()/.max() on numbers — Anthropic API rejects them. */
export const meetingInsightsSchema = z.object({
  businessHealthSummary: z.string().describe('General summary of how the business is doing based on the meeting'),
  callType: z.enum(['discovery', 'demo', 'follow_up', 'closing', 'other']),
  painPoints: z.array(z.object({
    pain: z.string(),
    severity: z.enum(['critical', 'moderate', 'minor']),
    quote: z.string().optional(),
  })),
  budgetSignals: z.object({
    mentionedSpend: z.string().optional(),
    willingnessToPay: z.string().optional(),
    priceSensitivity: z.enum(['low', 'medium', 'high']),
    quotes: z.array(z.string()),
  }),
  competitorMentions: z.array(z.object({
    name: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    context: z.string(),
    quote: z.string().optional(),
  })),
  buyingTriggers: z.array(z.object({
    trigger: z.string(),
    urgency: z.enum(['immediate', 'near_term', 'exploratory']),
    quote: z.string().optional(),
  })),
  objections: z.array(z.object({
    objection: z.string(),
    resolution: z.string().optional(),
    quote: z.string().optional(),
  })),
  icpSignals: z.object({
    companySize: z.string().optional(),
    role: z.string().optional(),
    industry: z.string().optional(),
    decisionProcess: z.string().optional(),
    decisionTimeline: z.string().optional(),
  }),
  currentMarketing: z.object({
    channels: z.array(z.string()),
    whatWorks: z.string().optional(),
    whatFails: z.string().optional(),
    monthlySpend: z.string().optional(),
    quotes: z.array(z.string()),
  }),
  goalsAndOutcomes: z.object({
    primaryGoal: z.string().optional(),
    successMetrics: z.string().optional(),
    desiredTransformation: z.string().optional(),
    quotes: z.array(z.string()),
  }),
  notableQuotes: z.array(z.object({
    quote: z.string(),
    context: z.string(),
    relevance: z.string(),
  })),
});
