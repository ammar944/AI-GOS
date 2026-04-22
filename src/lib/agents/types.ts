// src/lib/agents/types.ts
// Terminal schemas — enforce research / synthesis / media-plan separation

import { z } from 'zod';

// ════════════════════════════════════════════════════════════════════════════════
// LAYER 1: RESEARCH BUNDLE — PURE FACTS ONLY
// The agent loop produces ONLY this. No scores, no recommendations, no media plans.
// ════════════════════════════════════════════════════════════════════════════════

const Citation = z.object({
  source: z.string().describe('Tool or URL that produced this fact'),
  dateRetrieved: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
});

// 01 — Market & Category Intelligence
export const MarketIntelligenceSchema = z.object({
  categoryDefinition: z.string().describe('What category the product actually competes in'),
  adjacentCategories: z.array(z.string()).describe('Neighboring category spaces'),
  categoryMaturity: z.enum(['nascent', 'growth', 'mature', 'decline']).describe('Lifecycle stage'),
  marketSizeEstimate: z.string().optional().describe('TAM / SAM / SOM if available from tools'),
  structuralForces: z.array(z.string()).describe('Forces shaping the category (regulation, technology, economics)'),
  regulationShifts: z.array(z.string()).optional().describe('Pending or recent regulatory changes'),
  citations: z.array(Citation),
});

// 02 — Buyer & ICP Validation
export const BuyerValidationSchema = z.object({
  primaryICP: z.object({
    firmographics: z.string().describe('Company size, industry, geo, revenue band'),
    titles: z.array(z.string()).describe('Validated job titles that buy this'),
    awarenessDistribution: z.string().describe('How the market breaks down: unaware / problem-aware / solution-aware / product-aware'),
  }),
  buyingTriggers: z.array(z.string()).describe('Events that cause this persona to start looking'),
  communityClusters: z.array(z.string()).optional().describe('Where they congregate (Slacks, Subreddits, LinkedIn groups)'),
  accountCountEstimate: z.string().optional().describe('How many accounts match this profile (from Apollo/Clearbit)'),
  citations: z.array(Citation),
});

// 03 — Competitor Landscape & Positioning
export const CompetitorLandscapeSchema = z.object({
  competitors: z.array(z.object({
    name: z.string(),
    domain: z.string().optional(),
    positioning: z.string().describe('How they describe themselves (from their site / ads)'),
    pricingLevel: z.enum(['budget', 'mid-market', 'enterprise', 'unknown']).optional(),
    primaryWeaknesses: z.array(z.string()).optional(),
    adSpendSignal: z.string().optional().describe('Evidence of ad spend (SpyFu/Ad Library, not an estimate)'),
  })),
  positioningMap: z.array(z.object({
    dimension: z.string(),
    positions: z.record(z.string(), z.string()), // competitor name -> position on this dimension
  })).optional(),
  reviewThemes: z.array(z.string()).optional().describe('Recurring themes in G2/Capterra/TrustPilot reviews'),
  citations: z.array(Citation),
});

// 04 — Voice of Customer & Objection Evidence
export const VoiceOfCustomerSchema = z.object({
  painQuotes: z.array(z.object({
    text: z.string(),
    source: z.string().describe('Forum, review site, Reddit thread, etc.'),
    personaHint: z.string().optional(),
  })),
  objections: z.array(z.object({
    objection: z.string().describe('Exact phrasing buyers use to resist'),
    context: z.string().optional(),
  })),
  switchingStories: z.array(z.string()).optional().describe('Evidence of customers switching to/from competitors'),
  successLanguage: z.array(z.string()).optional().describe('How buyers describe the desired outcome'),
  citations: z.array(Citation),
});

// 05 — Demand & Intent Signals
export const DemandSignalsSchema = z.object({
  keywords: z.array(z.object({
    term: z.string(),
    intent: z.enum(['informational', 'navigational', 'commercial', 'transactional']).optional(),
    volumeSignal: z.string().optional().describe('High / med / low or exact number if available'),
  })),
  peopleAlsoAsk: z.array(z.string()).optional().describe('PAA questions from SERP scraping'),
  contentGaps: z.array(z.string()).optional().describe('Topics competitors rank for that the client does not'),
  jobPostingSignals: z.array(z.string()).optional().describe('Role postings that indicate expansion / pain'),
  citationSERP: z.array(Citation),
});

// 06 — Offer & Performance Diagnostic
export const OfferDiagnosticSchema = z.object({
  offerDescription: z.string().describe('What the client actually sells (from onboarding / scrape)'),
  funnelMetrics: z.object({
    hasData: z.boolean(),
    cac: z.string().optional(),
    ltv: z.string().optional(),
    conversionRate: z.string().optional(),
    churnRate: z.string().optional(),
    note: z.string().optional().describe('What data was available vs missing'),
  }),
  channelPerformance: z.array(z.object({
    channel: z.string(),
    spendHistory: z.string().optional(),
    outcome: z.string().optional(),
  })).optional(),
  contradictions: z.array(z.string()).optional().describe('Internal contradictions in the client’s data or messaging'),
  citations: z.array(Citation),
});

// The terminal schema — this is what submitResearchReport validates against
export const ResearchBundleSchema = z.object({
  marketIntelligence: MarketIntelligenceSchema.optional(),
  buyerValidation: BuyerValidationSchema.optional(),
  competitorLandscape: CompetitorLandscapeSchema.optional(),
  voiceOfCustomer: VoiceOfCustomerSchema.optional(),
  demandSignals: DemandSignalsSchema.optional(),
  offerDiagnostic: OfferDiagnosticSchema.optional(),
});

export type ResearchBundle = z.infer<typeof ResearchBundleSchema>;

// ════════════════════════════════════════════════════════════════════════════════
// LAYER 2: SYNTHESIS OUTPUT — separate step, NOT produced by the agent loop
// Consumes ResearchBundle + onboarding inputs + agency playbook SOPs
// ════════════════════════════════════════════════════════════════════════════════

export const SynthesisOutputSchema = z.object({
  channelMix: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()),
    excluded: z.array(z.string()).optional(),
    rationale: z.string(),
  }),
  budgetSplit: z.object({
    allocation: z.record(z.string(), z.number()), // channel -> percentage
    rationale: z.string(),
  }),
  positioningAngle: z.object({
    angle: z.string(),
    whyItWins: z.string(),
    risk: z.string(),
  }),
  creativeBrief: z.object({
    coreMessage: z.string(),
    tone: z.string(),
    proofPoints: z.array(z.string()),
  }),
  riskFlags: z.array(z.object({
    severity: z.enum(['high', 'medium', 'low']),
    description: z.string(),
    mitigation: z.string(),
  })),
  phasePlan: z.array(z.object({
    phase: z.number(),
    name: z.string(),
    channels: z.array(z.string()),
    goals: z.array(z.string()),
    durationWeeks: z.number(),
  })),
});

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

// ════════════════════════════════════════════════════════════════════════════════
// LAYER 3: MEDIA PLAN — rendered from synthesis
// Structured render for deck output / campaign execution
// ════════════════════════════════════════════════════════════════════════════════

export const MediaPlanSchema = z.object({
  campaigns: z.array(z.object({
    name: z.string(),
    objective: z.string(),
    channels: z.array(z.string()),
    budget: z.string(),
    targetAudience: z.string(),
    creativeTheme: z.string(),
    durationDays: z.number(),
  })),
  audiences: z.array(z.object({
    segmentName: z.string(),
    description: z.string(),
    platforms: z.array(z.string()),
    estimatedReach: z.string().optional(),
  })),
  creatives: z.array(z.object({
    format: z.string(),
    count: z.number(),
    variants: z.number(),
    notes: z.string(),
  })),
  timeline: z.array(z.object({
    week: z.number(),
    deliverables: z.array(z.string()),
    milestones: z.array(z.string()),
  })),
  budgetSummary: z.record(z.string(), z.string()),
});

export type MediaPlan = z.infer<typeof MediaPlanSchema>;

// ════════════════════════════════════════════════════════════════════════════════
// Layer 1+2+3 combined — for the rare case a downstream script wants everything
// ════════════════════════════════════════════════════════════════════════════════

export const FullReportSchema = z.object({
  research: ResearchBundleSchema,
  synthesis: SynthesisOutputSchema.optional(),
  mediaPlan: MediaPlanSchema.optional(),
});

export type FullReport = z.infer<typeof FullReportSchema>;

// Backward-compat alias — DEPRECATED, remove after callers migrate
export const ResearchReportSchema = ResearchBundleSchema;
export type ResearchReport = ResearchBundle;
