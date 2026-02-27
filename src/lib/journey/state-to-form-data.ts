import type { OnboardingState } from './session-state';
import type { OnboardingFormData } from '@/lib/onboarding/types';

/**
 * Convert the flat OnboardingState (collected via conversational onboarding)
 * into the structured OnboardingFormData expected by the blueprint generation API.
 *
 * This is a best-effort mapping — the conversational format captures free-text
 * responses that don't map 1:1 to the wizard's typed fields.
 */
export function stateToFormData(state: OnboardingState): OnboardingFormData {
  return {
    businessBasics: {
      businessName: state.companyName ?? '',
      websiteUrl: state.websiteUrl ?? '',
    },
    icp: {
      primaryIcpDescription: state.icpDescription ?? '',
      industryVertical: state.industry ?? '',
      jobTitles: state.buyerPersonaTitle ?? '',
      companySize: [],
      geography: state.geographicFocus ?? '',
      easiestToClose: '',
      buyingTriggers: '',
      bestClientSources: [],
    },
    productOffer: {
      productDescription: state.productDescription ?? '',
      coreDeliverables: '',
      offerPrice: parseFloat(state.offerPricing ?? '0') || 0,
      pricingModel: [],
      valueProp: '',
      currentFunnelType: [],
    },
    marketCompetition: {
      topCompetitors: state.competitors ?? '',
      uniqueEdge: '',
      marketBottlenecks: state.biggestMarketingChallenge ?? '',
    },
    customerJourney: {
      situationBeforeBuying: '',
      desiredTransformation: state.goals ?? '',
      commonObjections: '',
      salesCycleLength: mapSalesCycle(state.salesCycleLength),
    },
    brandPositioning: {
      brandPositioning: state.businessModel ?? '',
    },
    assetsProof: {},
    budgetTargets: {
      monthlyAdBudget: parseFloat(state.monthlyBudget ?? '0') || 0,
      campaignDuration: 'ongoing',
      targetCac: parseFloat(state.targetCpa ?? '0') || undefined,
    },
    compliance: {},
  };
}

function mapSalesCycle(
  value: string | null,
): 'less_than_7_days' | '7_to_14_days' | '14_to_30_days' | 'more_than_30_days' {
  if (!value) return '14_to_30_days';
  const lower = value.toLowerCase();
  if (lower.includes('7 day') || lower.includes('week')) return 'less_than_7_days';
  if (lower.includes('14') || lower.includes('two week')) return '7_to_14_days';
  if (lower.includes('30') || lower.includes('month')) return '14_to_30_days';
  return 'more_than_30_days';
}
