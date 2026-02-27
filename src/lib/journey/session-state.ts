import type { UIMessage } from 'ai';

// ── OnboardingState Interface ──────────────────────────────────────────────

export interface OnboardingState {
  // Required fields (8)
  businessModel: string | null;
  industry: string | null;
  icpDescription: string | null;
  productDescription: string | null;
  competitors: string | null;
  offerPricing: string | null;
  marketingChannels: string[] | null; // multi-select -> array
  goals: string | null;

  // Optional fields (14)
  companyName: string | null;
  websiteUrl: string | null;
  teamSize: string | null;
  monthlyBudget: string | null;
  currentCac: string | null;
  targetCpa: string | null;
  topPerformingChannel: string | null;
  biggestMarketingChallenge: string | null;
  buyerPersonaTitle: string | null;
  salesCycleLength: string | null;
  avgDealSize: string | null;
  primaryKpi: string | null;
  geographicFocus: string | null;
  seasonalityPattern: string | null;

  // Meta
  phase: 'onboarding' | 'confirming' | 'complete';
  requiredFieldsCompleted: number; // 0-8
  completionPercent: number; // 0-100
  lastUpdated: string; // ISO 8601
}

export const REQUIRED_FIELDS: (keyof OnboardingState)[] = [
  'businessModel',
  'industry',
  'icpDescription',
  'productDescription',
  'competitors',
  'offerPricing',
  'marketingChannels',
  'goals',
];

export const OPTIONAL_FIELDS: (keyof OnboardingState)[] = [
  'companyName',
  'websiteUrl',
  'teamSize',
  'monthlyBudget',
  'currentCac',
  'targetCpa',
  'topPerformingChannel',
  'biggestMarketingChallenge',
  'buyerPersonaTitle',
  'salesCycleLength',
  'avgDealSize',
  'primaryKpi',
  'geographicFocus',
  'seasonalityPattern',
];

// ── Completion Calculation ─────────────────────────────────────────────────

export function calculateCompletion(state: Partial<OnboardingState>): {
  requiredFieldsCompleted: number;
  completionPercent: number;
} {
  const completed = REQUIRED_FIELDS.filter((field) => {
    const val = state[field];
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (Array.isArray(val)) return val.length > 0;
    return true;
  }).length;

  return {
    requiredFieldsCompleted: completed,
    completionPercent: Math.round((completed / REQUIRED_FIELDS.length) * 100),
  };
}

// ── Resume Helpers ───────────────────────────────────────────────────────

/** Returns true if at least one required field has a non-empty value. */
export function hasAnsweredFields(state: OnboardingState): boolean {
  return REQUIRED_FIELDS.some((field) => {
    const val = state[field];
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (Array.isArray(val)) return val.length > 0;
    return true;
  });
}

/** Extracts a flat record of only the fields that have non-empty values. */
export function getAnsweredFields(
  state: OnboardingState,
): Record<string, unknown> {
  const answered: Record<string, unknown> = {};
  for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
    const val = state[field];
    if (val === null || val === undefined) continue;
    if (typeof val === 'string' && val.trim() === '') continue;
    if (Array.isArray(val) && val.length === 0) continue;
    answered[field] = val;
  }
  return answered;
}

// ── Extract askUser Results from Messages ──────────────────────────────────
// Per DISCOVERY.md D9 (REVISED): Interactive tool results are NOT in
// onFinish.steps. Extract from incoming body.messages — scan for
// tool-askUser parts with state: 'output-available'.

export function extractAskUserResults(
  messages: UIMessage[],
): Record<string, unknown> {
  const results: Record<string, unknown> = {};

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (
        typeof part === 'object' &&
        'type' in part &&
        (part as Record<string, unknown>).type === 'tool-askUser' &&
        (part as Record<string, unknown>).state === 'output-available'
      ) {
        const input = (part as Record<string, unknown>).input as
          | Record<string, unknown>
          | undefined;
        const output = (part as Record<string, unknown>).output as
          | Record<string, unknown>
          | undefined;
        if (input?.fieldName && output) {
          results[input.fieldName as string] = output;
        }
      }
    }
  }

  return results;
}

// ── Empty State Factory ────────────────────────────────────────────────────

export function createEmptyState(): OnboardingState {
  return {
    // Required fields
    businessModel: null,
    industry: null,
    icpDescription: null,
    productDescription: null,
    competitors: null,
    offerPricing: null,
    marketingChannels: null,
    goals: null,

    // Optional fields
    companyName: null,
    websiteUrl: null,
    teamSize: null,
    monthlyBudget: null,
    currentCac: null,
    targetCpa: null,
    topPerformingChannel: null,
    biggestMarketingChallenge: null,
    buyerPersonaTitle: null,
    salesCycleLength: null,
    avgDealSize: null,
    primaryKpi: null,
    geographicFocus: null,
    seasonalityPattern: null,

    // Meta
    phase: 'onboarding',
    requiredFieldsCompleted: 0,
    completionPercent: 0,
    lastUpdated: new Date().toISOString(),
  };
}
