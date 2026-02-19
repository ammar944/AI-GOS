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

export {
  documentExtractionSchema,
  EXTRACTION_FIELD_KEYS,
  TOTAL_EXTRACTION_FIELDS,
  type DocumentExtractionOutput,
} from './document-extraction-schema';

export {
  DOCUMENT_TYPE_CONFIG,
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  type DocumentType,
  type DocumentTypeConfig,
  type ParsedDocument,
} from './document-types';
