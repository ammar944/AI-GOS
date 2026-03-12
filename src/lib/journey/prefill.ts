import type { DeepPartial } from 'ai';
import type { CompanyResearchOutput, ResearchedField } from '@/lib/company-intel/schemas';
import type { OnboardingState } from '@/lib/journey/session-state';
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';

// All 32 onboarding field names from the lead agent's FIELD_LABELS
type JourneyFieldName =
  | keyof OnboardingState
  | 'companyName' | 'websiteUrl' | 'businessModel' | 'primaryIcpDescription'
  | 'industryVertical' | 'jobTitles' | 'companySize' | 'geography'
  | 'headquartersLocation' | 'easiestToClose' | 'buyingTriggers' | 'bestClientSources'
  | 'productDescription' | 'coreDeliverables' | 'pricingTiers' | 'valueProp'
  | 'currentFunnelType' | 'guarantees' | 'topCompetitors' | 'uniqueEdge'
  | 'competitorFrustrations' | 'marketBottlenecks' | 'marketProblem'
  | 'situationBeforeBuying' | 'desiredTransformation' | 'commonObjections'
  | 'salesCycleLength' | 'salesProcessOverview' | 'brandPositioning'
  | 'monthlyAdBudget' | 'campaignDuration' | 'targetCpl' | 'targetCac' | 'goals'
  | 'testimonialQuote';

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

// Schema field names now match journey field names 1:1 — no mapping needed
const RESEARCH_TO_JOURNEY_MAP: Array<{
  journeyField: JourneyFieldName;
  researchField: keyof CompanyResearchOutput;
}> = [
  { journeyField: 'companyName', researchField: 'companyName' },
  { journeyField: 'businessModel', researchField: 'businessModel' },
  { journeyField: 'industryVertical', researchField: 'industryVertical' },
  { journeyField: 'primaryIcpDescription', researchField: 'primaryIcpDescription' },
  { journeyField: 'jobTitles', researchField: 'jobTitles' },
  { journeyField: 'companySize', researchField: 'companySize' },
  { journeyField: 'geography', researchField: 'geography' },
  { journeyField: 'headquartersLocation', researchField: 'headquartersLocation' },
  { journeyField: 'productDescription', researchField: 'productDescription' },
  { journeyField: 'coreDeliverables', researchField: 'coreDeliverables' },
  { journeyField: 'valueProp', researchField: 'valueProp' },
  { journeyField: 'pricingTiers', researchField: 'pricingTiers' },
  { journeyField: 'guarantees', researchField: 'guarantees' },
  { journeyField: 'topCompetitors', researchField: 'topCompetitors' },
  { journeyField: 'uniqueEdge', researchField: 'uniqueEdge' },
  { journeyField: 'marketProblem', researchField: 'marketProblem' },
  { journeyField: 'situationBeforeBuying', researchField: 'situationBeforeBuying' },
  { journeyField: 'desiredTransformation', researchField: 'desiredTransformation' },
  { journeyField: 'commonObjections', researchField: 'commonObjections' },
  { journeyField: 'brandPositioning', researchField: 'brandPositioning' },
  { journeyField: 'testimonialQuote', researchField: 'testimonialQuote' },
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
      label: JOURNEY_FIELD_LABELS[mapping.journeyField] ?? mapping.journeyField,
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
  if (!state) return [];

  // Extract non-null string fields from state as proposals
  const proposals: JourneyPrefillProposal[] = [];
  for (const mapping of RESEARCH_TO_JOURNEY_MAP) {
    const key = mapping.journeyField as keyof OnboardingState;
    const value = state[key];
    if (!value || typeof value !== 'string') continue;

    proposals.push({
      fieldName: mapping.journeyField,
      label: JOURNEY_FIELD_LABELS[mapping.journeyField] ?? mapping.journeyField,
      value,
      confidence: 70,
      sourceUrl: null,
      reasoning: 'Restored from saved journey state.',
    });
  }

  return proposals;
}

export function applyJourneyPrefillProposals(
  state: OnboardingState,
  result: LooseResearchResult | null | undefined,
): OnboardingState {
  const proposals = buildJourneyPrefillProposals(result);
  // Shallow-merge proposed values into state
  const updates: Partial<OnboardingState> = {};
  for (const proposal of proposals) {
    const key = proposal.fieldName as keyof OnboardingState;
    if (key in state) {
      (updates as Record<string, unknown>)[key] = proposal.value;
    }
  }
  return { ...state, ...updates };
}
