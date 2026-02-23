// Schema Exports
// All enhanced Zod schemas for Strategic Blueprint generation

// Section 1: Industry & Market Overview
export {
  industryMarketSchema,
  type IndustryMarketOverview,
} from './industry-market';

// Section 2: ICP Analysis & Validation
export {
  icpAnalysisSchema,
  type ICPAnalysisValidation,
} from './icp-analysis';

// Section 3: Offer Analysis & Viability
export {
  offerAnalysisSchema,
  type OfferAnalysisViability,
} from './offer-analysis';

// Section 4: Competitor Analysis
export {
  competitorAnalysisSchema,
  summaryCompetitorBatchSchema,
  type CompetitorAnalysis,
  type SummaryCompetitor,
  type SummaryCompetitorBatch,
} from './competitor-analysis';

// Section 5: Cross-Analysis Synthesis
export {
  crossAnalysisSchema,
  strategicAnalysisSchema,
  messagingFrameworkSchema,
  type CrossAnalysisSynthesis,
  type StrategicAnalysis,
  type MessagingFramework,
} from './cross-analysis';

// Hook Extraction (lightweight re-synthesis optimization)
export {
  hookExtractionResultSchema,
  type HookExtractionResult,
} from './ad-hook-extraction';
