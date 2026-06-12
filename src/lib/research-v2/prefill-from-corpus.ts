import type {
  OnboardingFieldPrefillMetadata,
  OnboardingPrefillMetadata,
  OnboardingV2Data,
} from './onboarding-v2-types';
import { isHedgeAnswer, isNonAnswer } from './non-answer';

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

/**
 * Snap a corpus-extracted ACV amount ("$12,000/yr", "$49/mo", "15k") to the
 * onboarding radio band. Monthly amounts are annualized; unparseable input
 * returns undefined so the field stays user-choosable.
 */
function acvBandFromCorpus(
  raw: string | undefined,
): OnboardingV2Data['acv'] | undefined {
  if (raw === undefined) return undefined;

  const match = /\$?\s*([\d][\d,]*(?:\.\d+)?)\s*([kKmM])?\b/.exec(raw);
  if (!match || match[1] === undefined) return undefined;

  let amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  if (match[2]?.toLowerCase() === 'k') amount *= 1_000;
  if (match[2]?.toLowerCase() === 'm') amount *= 1_000_000;
  if (/\/\s*mo\b|per\s+month|monthly/i.test(raw)) amount *= 12;

  if (amount < 1_000) return 'lt_1k';
  if (amount < 10_000) return '1k_10k';
  if (amount < 50_000) return '10k_50k';
  return 'gt_50k';
}

function salesMotionFromBusinessModel(
  value: string | undefined,
): OnboardingV2Data['salesMotion'] | undefined {
  if (!value) return undefined;

  const normalized = value.toLowerCase();
  if (
    normalized.includes('product-led') ||
    normalized.includes('product led') ||
    normalized.includes('plg') ||
    normalized.includes('self-serve') ||
    normalized.includes('self serve')
  ) {
    return 'product_led';
  }
  if (
    normalized.includes('sales-led') ||
    normalized.includes('sales led') ||
    normalized.includes('slg') ||
    normalized.includes('demo') ||
    normalized.includes('enterprise')
  ) {
    return 'sales_led';
  }
  if (normalized.includes('hybrid')) {
    return 'hybrid';
  }

  return undefined;
}

// The companySize form field asks for the TARGET CUSTOMER's employee-count or
// revenue band ("50–500 employees", "$5M–$50M ARR"). The corpus model has
// answered it with the company's OWN usage/scale claim ("500,000+ brands use
// Airtable") — a marketing number, not a firmographic band. Drop usage-claim
// values unless they carry an employee/revenue band marker.
const COMPANY_SIZE_USAGE_CLAIM_PATTERN =
  /\b(use|uses|users|brands|customers|companies|teams)\b/i;
const COMPANY_SIZE_BAND_MARKER_PATTERN =
  /employees?|headcount|revenue|\barr\b|\$/i;

function companySizeFromCorpus(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (
    COMPANY_SIZE_USAGE_CLAIM_PATTERN.test(raw) &&
    !COMPANY_SIZE_BAND_MARKER_PATTERN.test(raw)
  ) {
    return undefined;
  }
  return raw;
}

export function prefillFromCorpusWithMetadata(
  onboardingFields: Record<string, CorpusOnboardingField>,
): PrefillFromCorpusResult {
  function str(key: string): string | undefined {
    const val = onboardingFields[key]?.value;
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    // Drop corpus non-answers ("idk"/"none"/…) and hedge prose ("not
    // explicitly limited in public sources") so the brief-review form shows
    // blank instead of prefilling junk the run path already discards to null.
    if (trimmed.length === 0 || isNonAnswer(trimmed) || isHedgeAnswer(trimmed)) {
      return undefined;
    }
    return trimmed;
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

  setField('salesMotion', 'businessModel', salesMotionFromBusinessModel(str('businessModel')));

  // pricingModel, conversionPath — radios, corpus doesn't emit these; skip

  // acv IS a radio, but the corpus now emits a dollar figure (W4) — snap it
  // to the nearest band; unparseable amounts skip so the user chooses.
  setField('acv', 'acv', acvBandFromCorpus(str('acv')));

  // Section 2: ICP + Pain
  setField('idealCustomer', 'primaryIcpDescription', str('primaryIcpDescription'));
  setField('industry', 'industryVertical', str('industryVertical'));
  setField('jobTitles', 'jobTitles', str('jobTitles'));
  setField('companySize', 'companySize', companySizeFromCorpus(str('companySize')));
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

  // targetPlan, avgLtv, targetCac — no corpus keys; skip

  setField('monthlyAdBudget', 'monthlyAdBudget', str('monthlyAdBudget'));

  // Section 5: Competition & Positioning
  setField('topCompetitors', 'topCompetitors', str('topCompetitors'));
  setField('whyCustomersChooseYou', 'uniqueEdge', str('uniqueEdge'));

  // lossReasons, competitorAdvantages — no corpus keys; skip

  // Section 6: Goals & Strategy
  setField('commonObjections', 'commonObjections', str('commonObjections'));
  setField('brandPositioning', 'brandPositioning', str('brandPositioning'));

  // valueProp → keyPromises (closest semantic match)
  setField('keyPromises', 'valueProp', str('valueProp'));

  // primaryGoal90Days, monthlyPipelineTarget — no corpus keys; skip

  // Section 7: Current Marketing & Performance — no corpus keys; skip all

  return { data: result, metadata };
}
