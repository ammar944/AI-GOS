// Company Intelligence Module
// Auto-fill onboarding from website + LinkedIn research

export {
  researchCompanyForOnboarding,
  isValidUrl,
  isLinkedInCompanyUrl,
} from './research-service';

export type {
  PrefillOnboardingInput,
  PrefillOnboardingResponse,
  CompanyResearchResult,
  FieldExtraction,
  ConfidenceLevel,
  DataSource,
} from './types';

export { companyResearchSchema, type CompanyResearchOutput, type ResearchedField } from './schemas';

export {
  suggestedFieldSchema,
  icpSuggestionSchema,
  productOfferSuggestionSchema,
  marketCompetitionSuggestionSchema,
  customerJourneySuggestionSchema,
  brandPositioningSuggestionSchema,
  STEP_SUGGESTION_SCHEMAS,
  STEP_LABELS,
  STEP_MODEL_STRATEGY,
  type SuggestedField,
  type SuggestableStep,
  type ICPSuggestion,
  type ProductOfferSuggestion,
  type MarketCompetitionSuggestion,
  type CustomerJourneySuggestion,
  type BrandPositioningSuggestion,
} from './step-schemas';
