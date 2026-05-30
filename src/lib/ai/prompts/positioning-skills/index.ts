// Positioning-skills barrel — types + skill exports for the
// Pre-Pitch Positioning Audit (6 sections).
//
// PositioningSectionId is the canonical ID type used by:
//   - src/app/api/research-v2/dispatch/route.ts (validation)
//   - src/lib/research-v2/state-machine.ts (state machine)
//   - research-worker positioning runners

export { MARKET_CATEGORY_INTELLIGENCE_SKILL } from './01-market-category-intelligence';
export { BUYER_ICP_VALIDATION_SKILL } from './02-buyer-icp-validation';
export { COMPETITOR_LANDSCAPE_SKILL } from './03-competitor-landscape';
export { VOICE_OF_CUSTOMER_SKILL } from './04-voice-of-customer';
export { DEMAND_INTENT_SKILL } from './05-demand-intent';
export { OFFER_DIAGNOSTIC_SKILL } from './06-offer-diagnostic';

export const POSITIONING_SECTION_IDS = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
] as const;

export type PositioningSectionId = (typeof POSITIONING_SECTION_IDS)[number];

export const PAID_MEDIA_PLAN_SECTION_ID = 'positioningPaidMediaPlan' as const;

export type PaidMediaPlanSectionId = typeof PAID_MEDIA_PLAN_SECTION_ID;

// Cross-section synthesis capstone. Reads the six committed positioning
// artifacts and emits one recommended wedge + 2-3 divergent angles. It is NOT a
// member of POSITIONING_SECTION_IDS (the 6-section parent-rollup key) so it
// never counts toward parent completion — it dispatches after the 6 commit.
export const POSITIONING_SYNTHESIS_SECTION_ID = 'positioningSynthesis' as const;

export type PositioningSynthesisSectionId =
  typeof POSITIONING_SYNTHESIS_SECTION_ID;

export const ALL_POSITIONING_SECTION_IDS = [
  ...POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
] as const;

export type AllPositioningSectionId = (typeof ALL_POSITIONING_SECTION_IDS)[number];

export function isPositioningSectionId(value: unknown): value is PositioningSectionId {
  return (
    typeof value === 'string' &&
    (POSITIONING_SECTION_IDS as readonly string[]).includes(value)
  );
}

export function isAllPositioningSectionId(
  value: unknown,
): value is AllPositioningSectionId {
  return (
    typeof value === 'string' &&
    (ALL_POSITIONING_SECTION_IDS as readonly string[]).includes(value)
  );
}

export const POSITIONING_SECTION_LABELS: Record<PositioningSectionId, string> = {
  positioningMarketCategory: 'Market & Category Intelligence',
  positioningBuyerICP: 'Buyer & ICP Validation',
  positioningCompetitorLandscape: 'Competitor Landscape & Positioning',
  positioningVoiceOfCustomer: 'Voice of Customer & Objection Evidence',
  positioningDemandIntent: 'Demand & Intent Signals',
  positioningOfferDiagnostic: 'Offer & Performance Diagnostic',
};

export const ALL_POSITIONING_SECTION_LABELS: Record<AllPositioningSectionId, string> = {
  ...POSITIONING_SECTION_LABELS,
  [POSITIONING_SYNTHESIS_SECTION_ID]: 'Positioning Synthesis',
  [PAID_MEDIA_PLAN_SECTION_ID]: 'Paid Media Plan',
};
