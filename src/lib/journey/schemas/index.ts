import type { z } from 'zod';
import { competitorIntelDataSchema } from './competitor-intel';
import { icpValidationDataSchema } from './icp-validation';
import { industryResearchDataSchema } from './industry-research';
import { keywordIntelDataSchema } from './keyword-intel';
import { mediaPlanDataSchema } from './media-plan';
import { offerAnalysisDataSchema } from './offer-analysis';
import { strategicSynthesisDataSchema } from './strategic-synthesis';

export const JOURNEY_SECTION_DATA_SCHEMAS = {
  industryResearch: industryResearchDataSchema,
  competitorIntel: competitorIntelDataSchema,
  icpValidation: icpValidationDataSchema,
  offerAnalysis: offerAnalysisDataSchema,
  strategicSynthesis: strategicSynthesisDataSchema,
  keywordIntel: keywordIntelDataSchema,
  mediaPlan: mediaPlanDataSchema,
} as const;

export type JourneySectionDataSchemaMap = typeof JOURNEY_SECTION_DATA_SCHEMAS;

export type JourneySectionDataMap = {
  [K in keyof JourneySectionDataSchemaMap]: z.infer<JourneySectionDataSchemaMap[K]>;
};

export type IndustryResearchData = JourneySectionDataMap['industryResearch'];
export type CompetitorIntelData = JourneySectionDataMap['competitorIntel'];
export type IcpValidationData = JourneySectionDataMap['icpValidation'];
export type OfferAnalysisData = JourneySectionDataMap['offerAnalysis'];
export type StrategicSynthesisData = JourneySectionDataMap['strategicSynthesis'];
export type KeywordIntelData = JourneySectionDataMap['keywordIntel'];
export type MediaPlanData = JourneySectionDataMap['mediaPlan'];
