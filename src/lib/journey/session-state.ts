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

// ── Supabase Persistence ───────────────────────────────────────────────────
// Per DISCOVERY.md D11 (REVISED): Fetch-then-merge JSONB metadata column.
// Per DISCOVERY.md D22: Silent fail with console.error on write failure.

export async function persistToSupabase(
  userId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabase = createAdminClient();

    // Fetch current metadata (D13: fetch-then-merge pattern)
    const { data: existing } = await supabase
      .from('journey_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .single();

    const currentMetadata =
      (existing?.metadata as Record<string, unknown>) || {};

    // Shallow merge — new fields overwrite existing, preserving untouched fields
    const merged = {
      ...currentMetadata,
      ...fields,
      lastUpdated: new Date().toISOString(),
    };

    // Upsert (D12: one session per user, UNIQUE on user_id)
    await supabase.from('journey_sessions').upsert(
      {
        user_id: userId,
        metadata: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch (error) {
    // Silent fail — localStorage is the fallback (DISCOVERY.md D22)
    console.error('[journey] Supabase persistence failed:', error);
  }
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
