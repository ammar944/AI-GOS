import {
  GTM_BRIEF_FIELD_GROUPS,
  type GtmBrief,
  type GtmBriefFieldKey,
} from '@/lib/gtm/schemas/gtm-brief';
import { researchEvidenceSchema } from '@/lib/gtm/schemas/evidence';
import type { GtmOnboardingAnswerKey } from '@/lib/gtm/onboarding/questionnaire';

export const GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD = {
  companyName: 'companyName',
  productDescription: 'productDescription',
  targetCustomer: 'targetCustomer',
  salesMotion: 'salesMotion',
  pricingModel: 'pricingModel',
  conversionPath: 'conversionPath',
  avgAcv: 'avgAcv',
  primaryIcpDescription: 'primaryIcpDescription',
  industryVertical: 'industryVertical',
  jobTitles: 'jobTitles',
  companySize: 'companySize',
  geography: 'geography',
  buyingTriggers: 'buyingTriggers',
  currentAlternative: 'currentAlternative',
  awarenessLevel: 'awarenessLevel',
  coreDeliverables: 'coreDeliverables',
  firstValueMoment: 'firstValueMoment',
  activationEvent: 'activationEvent',
  retentionDrivers: 'retentionDrivers',
  pricingTiers: 'pricingTiers',
  targetPlan: 'targetPlan',
  avgCustomerLtv: 'avgCustomerLtv',
  targetCac: 'targetCac',
  monthlyAdBudget: 'monthlyAdBudget',
  topCompetitors: 'topCompetitors',
  uniqueEdge: 'uniqueEdge',
  lossReasons: 'lossReasons',
  competitorStrengths: 'competitorStrengths',
  goals: 'goals',
  pipelineTarget: 'pipelineTarget',
  commonObjections: 'commonObjections',
  keyPromises: 'keyPromises',
  brandPositioning: 'brandPositioning',
  channels: 'channels',
  channelBudgetSplit: 'channelBudgetSplit',
  whatIsWorking: 'whatIsWorking',
  whatIsNotWorking: 'whatIsNotWorking',
  currentCac: 'currentCac',
  monthlyRevenue: 'monthlyRevenue',
  salesCycleLength: 'salesCycleLength',
  visitorToSignupPct: 'visitorToSignupPct',
  signupToActivationPct: 'signupToActivationPct',
  activationToPaidPct: 'activationToPaidPct',
  demoToCloseRate: 'demoToCloseRate',
  last3to6MoGrowthTrend: 'last3to6MoGrowthTrend',
} as const satisfies Record<GtmOnboardingAnswerKey, GtmBriefFieldKey>;

export type GtmOnboardingAnswerValue = string | readonly string[];
export type GtmOnboardingAnswers = Partial<Record<GtmOnboardingAnswerKey, GtmOnboardingAnswerValue>>;

export interface ApplyGtmOnboardingAnswersOptions {
  updatedAt?: string;
}

export function getGtmBriefFieldKeyForAnswer(answerKey: GtmOnboardingAnswerKey): GtmBriefFieldKey {
  return GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD[answerKey];
}

export function applyGtmOnboardingAnswersToBrief(
  brief: GtmBrief,
  answers: GtmOnboardingAnswers,
  options: ApplyGtmOnboardingAnswersOptions = {},
): GtmBrief {
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const fields: GtmBrief['fields'] = { ...brief.fields };
  const entries = Object.entries(answers) as Array<[GtmOnboardingAnswerKey, GtmOnboardingAnswerValue | undefined]>;

  for (const [answerKey, rawValue] of entries) {
    if (rawValue === undefined) continue;

    const value = formatGtmOnboardingAnswerValue(rawValue);
    if (value.length === 0) continue;

    const fieldKey = getGtmBriefFieldKeyForAnswer(answerKey);
    fields[fieldKey] = {
      ...fields[fieldKey],
      value,
      status: 'confirmed',
      confidence: 'high',
      sources: [
        ...fields[fieldKey].sources,
        researchEvidenceSchema.parse({
          id: `ev_user_${fieldKey}_${stableKey(value)}`,
          source_type: 'user_input',
          label: 'GTM onboarding answer',
          quote: value,
          confidence: 'high',
          claim_path: getClaimPathForBriefField(fieldKey),
        }),
      ],
      updatedBy: 'user',
      updatedAt,
    };
  }

  return {
    ...brief,
    fields,
    updatedAt,
  };
}

function formatGtmOnboardingAnswerValue(value: GtmOnboardingAnswerValue): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  return value.map((item) => item.trim()).filter(Boolean).join(', ');
}

function getClaimPathForBriefField(fieldKey: GtmBriefFieldKey): string[] {
  for (const [group, fields] of Object.entries(GTM_BRIEF_FIELD_GROUPS)) {
    if ((fields as readonly string[]).includes(fieldKey)) {
      return [group, fieldKey];
    }
  }

  return [fieldKey];
}

function stableKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'value';
}
