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

export function isPositioningSectionId(value: unknown): value is PositioningSectionId {
  return (
    typeof value === 'string' &&
    (POSITIONING_SECTION_IDS as readonly string[]).includes(value)
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
