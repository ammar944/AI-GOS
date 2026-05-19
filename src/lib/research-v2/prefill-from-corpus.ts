import type {
  OnboardingFieldPrefillMetadata,
  OnboardingPrefillMetadata,
  OnboardingV2Data,
} from './onboarding-v2-types';

export interface CorpusOnboardingField {
  value?: unknown;
  confidence?: unknown;
  sourceUrl?: unknown;
  reasoning?: unknown;
}

export interface PrefillFromCorpusResult {
  data: Partial<OnboardingV2Data>;
  metadata: OnboardingPrefillMetadata;
}

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
  onboardingFields: Record<string, CorpusOnboardingField>,
): Partial<OnboardingV2Data> {
  return prefillFromCorpusWithMetadata(onboardingFields).data;
}

function fieldMetadata(
  field: CorpusOnboardingField | undefined,
  value: string,
): OnboardingFieldPrefillMetadata {
  const confidence =
    typeof field?.confidence === 'number' && Number.isFinite(field.confidence)
      ? field.confidence
      : null;
  const sourceUrl =
    typeof field?.sourceUrl === 'string' && field.sourceUrl.trim().length > 0
      ? field.sourceUrl.trim()
      : null;
  const reasoning =
    typeof field?.reasoning === 'string' && field.reasoning.trim().length > 0
      ? field.reasoning.trim()
      : null;
  return { value, confidence, sourceUrl, reasoning };
}

export function prefillFromCorpusWithMetadata(
  onboardingFields: Record<string, CorpusOnboardingField>,
): PrefillFromCorpusResult {
  function str(key: string): string | undefined {
    const val = onboardingFields[key]?.value;
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    return undefined;
  }

  const result: Partial<OnboardingV2Data> = {};
  const metadata: OnboardingPrefillMetadata = {};

  function setField<K extends keyof OnboardingV2Data>(
    key: K,
    corpusKey: string,
    value: string | undefined,
  ): void {
    if (value === undefined) return;
    result[key] = value as OnboardingV2Data[K];
    metadata[key] = fieldMetadata(onboardingFields[corpusKey], value);
  }

  // Section 1: Product & Revenue Model
  setField('companyName', 'companyName', str('companyName'));
  setField('productDescription', 'productDescription', str('productDescription'));

  // builtFor — no direct corpus key; skip

  // salesMotion — no direct corpus key; skip (businessModel is too generic)

  // pricingModel, conversionPath, acv — radios, corpus doesn't emit these; skip

  // Section 2: ICP + Pain
  setField('idealCustomer', 'primaryIcpDescription', str('primaryIcpDescription'));
  setField('industry', 'industryVertical', str('industryVertical'));
  setField('jobTitles', 'jobTitles', str('jobTitles'));
  setField('companySize', 'companySize', str('companySize'));
  setField('geographicFocus', 'geography', str('geography'));

  // triggers — no direct corpus key (situationBeforeBuying is closest)
  setField('triggers', 'situationBeforeBuying', str('situationBeforeBuying'));

  // currentAlternative — no direct corpus key; skip

  // awarenessLevel — radio, corpus doesn't emit; skip

  // Section 3: Offer & Product Experience
  setField('coreFeatures', 'coreDeliverables', str('coreDeliverables'));

  // firstValueMoment, activationEvent, retentionDrivers — no corpus keys; skip

  // Section 4: Pricing & Economics
  setField('pricingTiers', 'pricingTiers', str('pricingTiers'));

  // targetPlan, ltv, targetCac, monthlyAdBudget — no corpus keys; skip

  // Section 5: Competition & Positioning
  setField('topCompetitors', 'topCompetitors', str('topCompetitors'));
  setField('whyCustomersChooseYou', 'uniqueEdge', str('uniqueEdge'));

  // lossReasons, competitorAdvantages — no corpus keys; skip

  // Section 6: Goals & Strategy
  setField('commonObjections', 'commonObjections', str('commonObjections'));
  setField('brandPositioning', 'brandPositioning', str('brandPositioning'));

  // valueProp → keyPromises (closest semantic match)
  setField('keyPromises', 'valueProp', str('valueProp'));

  // primaryGoal90Days, monthlyPipelineTarget, goalTargetCac — no corpus keys; skip

  // Section 7: Current Marketing & Performance — no corpus keys; skip all

  return { data: result, metadata };
}
