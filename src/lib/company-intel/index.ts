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
