import { z } from 'zod';
import { evidenceSourceSchema } from '@/lib/gtm/schemas/evidence';

export const GTM_BRIEF_FIELD_STATUSES = ['missing', 'suggested', 'needs_review', 'confirmed'] as const;
export const GTM_BRIEF_FIELD_CONFIDENCES = ['missing', 'low', 'medium', 'high'] as const;
export const GTM_BRIEF_UPDATED_BY = ['ai', 'user', 'system'] as const;

export const gtmBriefFieldSchema = z.object({
  value: z.string(),
  status: z.enum(GTM_BRIEF_FIELD_STATUSES),
  confidence: z.enum(GTM_BRIEF_FIELD_CONFIDENCES),
  sources: z.array(evidenceSourceSchema),
  updatedBy: z.enum(GTM_BRIEF_UPDATED_BY),
  updatedAt: z.string().datetime(),
});

export type GtmBriefField = z.infer<typeof gtmBriefFieldSchema>;

export const GTM_BRIEF_FIELD_GROUPS = {
  companyIdentity: ['companyName', 'companyUrl', 'category', 'market', 'industryVertical', 'geography', 'hqLocation'],
  productAndOffer: [
    'productDescription',
    'targetCustomer',
    'coreDeliverables',
    'useCases',
    'corePromise',
    'firstValueMoment',
    'activationEvent',
    'retentionDrivers',
    'cta',
    'packaging',
    'pricingModel',
    'pricingTiers',
    'targetPlan',
  ],
  icp: [
    'primaryIcpDescription',
    'icpSegment',
    'jobTitles',
    'icpRoles',
    'companySize',
    'buyingCommittee',
    'buyingTriggers',
    'icpPains',
    'icpTriggers',
    'currentAlternative',
    'awarenessLevel',
    'icpObjections',
  ],
  gtmMotion: ['salesMotion', 'gtmMotion'],
  funnel: ['conversionPath', 'landingPages', 'salesHandoff', 'lifecycleConstraints'],
  economics: [
    'avgAcv',
    'acv',
    'avgCustomerLtv',
    'ltv',
    'targetCac',
    'cacTarget',
    'monthlyAdBudget',
    'monthlyBudget',
    'currentCac',
    'monthlyRevenue',
    'salesCycleLength',
    'salesCycle',
    'marginAssumptions',
  ],
  competitive: [
    'topCompetitors',
    'knownCompetitors',
    'alternatives',
    'uniqueEdge',
    'categoryFrames',
    'differentiation',
    'lossReasons',
    'competitorStrengths',
  ],
  proof: ['testimonials', 'caseStudies', 'logos', 'metrics', 'claims', 'styleReferences'],
  brandAndConstraints: ['brandPositioning', 'tone', 'forbiddenClaims', 'compliance', 'brandGeography', 'timeline'],
  goal: ['goals', 'pipelineTarget', 'campaignObjective', 'expectedOutput', 'targetMarket', 'launchUrgency'],
  messaging: ['commonObjections', 'keyPromises'],
  currentPerformance: [
    'channels',
    'channelBudgetSplit',
    'whatIsWorking',
    'whatIsNotWorking',
    'visitorToSignupPct',
    'signupToActivationPct',
    'activationToPaidPct',
    'demoToCloseRate',
    'last3to6MoGrowthTrend',
  ],
} as const;

export type GtmBriefFieldGroup = keyof typeof GTM_BRIEF_FIELD_GROUPS;

type FlattenGroups<T> = T extends Readonly<Record<string, readonly (infer K)[]>> ? K : never;
export type GtmBriefFieldKey = FlattenGroups<typeof GTM_BRIEF_FIELD_GROUPS>;

export const GTM_BRIEF_FIELD_KEYS = Object.values(GTM_BRIEF_FIELD_GROUPS).flat() as readonly GtmBriefFieldKey[];

const fieldsShape = GTM_BRIEF_FIELD_KEYS.reduce<Record<string, typeof gtmBriefFieldSchema>>((acc, key) => {
  acc[key] = gtmBriefFieldSchema;
  return acc;
}, {});

export const gtmBriefFieldsSchema = z.object(fieldsShape);

export const gtmBriefSchema = z.object({
  briefId: z.string().min(1),
  clientId: z.string().min(1).nullable(),
  fields: gtmBriefFieldsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GtmBrief = z.infer<typeof gtmBriefSchema>;

export interface BuildEmptyBriefOptions {
  briefId?: string;
  clientId?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export function buildEmptyGtmBriefField(now = new Date().toISOString()): GtmBriefField {
  return {
    value: '',
    status: 'missing',
    confidence: 'missing',
    sources: [],
    updatedBy: 'system',
    updatedAt: now,
  };
}

export function buildEmptyGtmBrief(options: BuildEmptyBriefOptions = {}): GtmBrief {
  const now = options.updatedAt ?? new Date().toISOString();
  const fields = Object.fromEntries(
    GTM_BRIEF_FIELD_KEYS.map((key) => [key, buildEmptyGtmBriefField(now)]),
  ) as GtmBrief['fields'];
  return {
    briefId: options.briefId ?? 'brief_draft',
    clientId: options.clientId ?? null,
    fields,
    createdAt: options.createdAt ?? now,
    updatedAt: now,
  };
}
