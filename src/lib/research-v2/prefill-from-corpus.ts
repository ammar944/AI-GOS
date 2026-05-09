import type { OnboardingV2Data } from './onboarding-v2-types';

/**
 * Maps the flat corpus-emitted onboardingFields dictionary to OnboardingV2Data.
 *
 * Corpus keys (from deep-research-program.ts system prompt):
 *   companyName, businessModel, industryVertical, primaryIcpDescription,
 *   jobTitles, companySize, geography, headquartersLocation,
 *   productDescription, coreDeliverables, pricingTiers, valueProp,
 *   guarantees, topCompetitors, uniqueEdge, marketProblem,
 *   situationBeforeBuying, desiredTransformation, commonObjections,
 *   brandPositioning, testimonialQuote, caseStudiesUrl,
 *   testimonialsUrl, pricingUrl, demoUrl
 *
 * Fields with no corpus equivalent are left undefined so the user fills them.
 */
export function prefillFromCorpus(
  onboardingFields: Record<string, { value?: unknown }>,
): Partial<OnboardingV2Data> {
  function str(key: string): string | undefined {
    const val = onboardingFields[key]?.value;
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    return undefined;
  }

  const result: Partial<OnboardingV2Data> = {};

  // Section 1: Product & Revenue Model
  const companyName = str('companyName');
  if (companyName !== undefined) result.companyName = companyName;

  const productDescription = str('productDescription');
  if (productDescription !== undefined) result.productDescription = productDescription;

  // builtFor — no direct corpus key; skip

  // salesMotion — no direct corpus key; skip (businessModel is too generic)

  // pricingModel, conversionPath, acv — radios, corpus doesn't emit these; skip

  // Section 2: ICP + Pain
  const primaryIcpDescription = str('primaryIcpDescription');
  if (primaryIcpDescription !== undefined) result.idealCustomer = primaryIcpDescription;

  const industryVertical = str('industryVertical');
  if (industryVertical !== undefined) result.industry = industryVertical;

  const jobTitles = str('jobTitles');
  if (jobTitles !== undefined) result.jobTitles = jobTitles;

  const companySize = str('companySize');
  if (companySize !== undefined) result.companySize = companySize;

  const geography = str('geography');
  if (geography !== undefined) result.geographicFocus = geography;

  // triggers — no direct corpus key (situationBeforeBuying is closest)
  const situationBeforeBuying = str('situationBeforeBuying');
  if (situationBeforeBuying !== undefined) result.triggers = situationBeforeBuying;

  // currentAlternative — no direct corpus key; skip

  // awarenessLevel — radio, corpus doesn't emit; skip

  // Section 3: Offer & Product Experience
  const coreDeliverables = str('coreDeliverables');
  if (coreDeliverables !== undefined) result.coreFeatures = coreDeliverables;

  // firstValueMoment, activationEvent, retentionDrivers — no corpus keys; skip

  // Section 4: Pricing & Economics
  const pricingTiers = str('pricingTiers');
  if (pricingTiers !== undefined) result.pricingTiers = pricingTiers;

  // targetPlan, ltv, targetCac, monthlyAdBudget — no corpus keys; skip

  // Section 5: Competition & Positioning
  const topCompetitors = str('topCompetitors');
  if (topCompetitors !== undefined) result.topCompetitors = topCompetitors;

  const uniqueEdge = str('uniqueEdge');
  if (uniqueEdge !== undefined) result.whyCustomersChooseYou = uniqueEdge;

  // lossReasons, competitorAdvantages — no corpus keys; skip

  // Section 6: Goals & Strategy
  const commonObjections = str('commonObjections');
  if (commonObjections !== undefined) result.commonObjections = commonObjections;

  const brandPositioning = str('brandPositioning');
  if (brandPositioning !== undefined) result.brandPositioning = brandPositioning;

  // valueProp → keyPromises (closest semantic match)
  const valueProp = str('valueProp');
  if (valueProp !== undefined) result.keyPromises = valueProp;

  // primaryGoal90Days, monthlyPipelineTarget, goalTargetCac — no corpus keys; skip

  // Section 7: Current Marketing & Performance — no corpus keys; skip all

  return result;
}
