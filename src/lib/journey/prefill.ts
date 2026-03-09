import type { DeepPartial } from 'ai';
import type { CompanyResearchOutput, ResearchedField } from '@/lib/company-intel/schemas';
import type { JourneyFieldName, OnboardingState } from '@/lib/journey/session-state';
import { setProposedField } from '@/lib/journey/session-state';

/** Accept both `Partial` and the deeper `PartialObject` returned by `experimental_useObject`. */
type LooseResearchResult = DeepPartial<CompanyResearchOutput> | Partial<CompanyResearchOutput>;

export interface JourneyPrefillProposal {
  fieldName: JourneyFieldName;
  label: string;
  value: string;
  confidence: number;
  sourceUrl: string | null;
  reasoning: string;
}

export type JourneyPrefillReviewAction = 'accept' | 'edit' | 'reject';

export interface JourneyPrefillReviewDecision {
  fieldName: JourneyFieldName;
  action: JourneyPrefillReviewAction;
  value?: string;
}

const FIELD_LABELS: Partial<Record<JourneyFieldName, string>> = {
  companyName: 'Company Name',
  businessModel: 'Business Model',
  industryVertical: 'Industry Vertical',
  primaryIcpDescription: 'Ideal Customer Profile',
  jobTitles: 'Target Job Titles',
  companySize: 'Company Size',
  geography: 'Geography',
  productDescription: 'Product Description',
  coreDeliverables: 'Core Deliverables',
  valueProp: 'Value Proposition',
  pricingTiers: 'Pricing',
  topCompetitors: 'Top Competitors',
  uniqueEdge: 'Unique Edge',
  marketBottlenecks: 'Market Bottlenecks',
  desiredTransformation: 'Desired Transformation',
  commonObjections: 'Common Objections',
  brandPositioning: 'Brand Positioning',
};

const RESEARCH_TO_JOURNEY_MAP: Array<{
  journeyField: JourneyFieldName;
  researchField: keyof CompanyResearchOutput;
}> = [
  { journeyField: 'companyName', researchField: 'companyName' },
  { journeyField: 'businessModel', researchField: 'industry' },
  { journeyField: 'industryVertical', researchField: 'industry' },
  { journeyField: 'primaryIcpDescription', researchField: 'targetCustomers' },
  { journeyField: 'jobTitles', researchField: 'targetJobTitles' },
  { journeyField: 'companySize', researchField: 'companySize' },
  { journeyField: 'geography', researchField: 'headquartersLocation' },
  { journeyField: 'productDescription', researchField: 'productDescription' },
  { journeyField: 'coreDeliverables', researchField: 'coreFeatures' },
  { journeyField: 'valueProp', researchField: 'valueProposition' },
  { journeyField: 'pricingTiers', researchField: 'pricing' },
  { journeyField: 'topCompetitors', researchField: 'competitors' },
  { journeyField: 'uniqueEdge', researchField: 'uniqueDifferentiator' },
  { journeyField: 'marketBottlenecks', researchField: 'marketProblem' },
  { journeyField: 'desiredTransformation', researchField: 'customerTransformation' },
  { journeyField: 'commonObjections', researchField: 'commonObjections' },
  { journeyField: 'brandPositioning', researchField: 'brandPositioning' },
];

function asResearchedField(value: unknown): ResearchedField | null {
  if (!value || typeof value !== 'object' || !('value' in value)) return null;
  return value as ResearchedField;
}

export function buildJourneyPrefillProposals(
  result: LooseResearchResult | null | undefined,
): JourneyPrefillProposal[] {
  if (!result) return [];

  const proposals: JourneyPrefillProposal[] = [];

  for (const mapping of RESEARCH_TO_JOURNEY_MAP) {
    const field = asResearchedField(result[mapping.researchField]);
    if (!field?.value || !field.sourceUrl) continue;
    proposals.push({
      fieldName: mapping.journeyField,
      label: FIELD_LABELS[mapping.journeyField] ?? mapping.journeyField,
      value: field.value,
      confidence: field.confidence,
      sourceUrl: field.sourceUrl,
      reasoning: field.reasoning,
    });
  }

  return proposals;
}

export function buildJourneyPrefillProposalsFromState(
  state: Partial<OnboardingState> | null | undefined,
): JourneyPrefillProposal[] {
  if (!state?.proposals) return [];

  const proposals: JourneyPrefillProposal[] = [];
  for (const [fieldName, proposal] of Object.entries(state.proposals)) {
    if (!proposal?.value || typeof proposal.value !== 'string' || !proposal.sourceUrl) continue;

    const normalizedField = fieldName as JourneyFieldName;
    proposals.push({
      fieldName: normalizedField,
      label: FIELD_LABELS[normalizedField] ?? normalizedField,
      value: proposal.value,
      confidence: proposal.confidence ?? 0,
      sourceUrl: proposal.sourceUrl ?? null,
      reasoning: proposal.reasoning ?? 'Prefill proposal restored from saved journey state.',
    });
  }

  return proposals;
}

export function applyJourneyPrefillProposals(
  state: OnboardingState,
  result: LooseResearchResult | null | undefined,
): OnboardingState {
  let next = state;
  const proposals = buildJourneyPrefillProposals(result);
  for (const proposal of proposals) {
    next = setProposedField(next, proposal.fieldName, proposal.value, {
      source: proposal.sourceUrl?.includes('linkedin.com') ? 'linkedin' : 'prefill',
      confidence: proposal.confidence,
      sourceUrl: proposal.sourceUrl,
      reasoning: proposal.reasoning,
    });
  }
  return next;
}
