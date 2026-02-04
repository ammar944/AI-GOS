// Shared Types for AI Research Functions

import type {
  IndustryMarketOverview,
  ICPAnalysisValidation,
  OfferAnalysisViability,
  CompetitorAnalysis,
  CrossAnalysisSynthesis,
} from './schemas';

// =============================================================================
// Research Result Types
// =============================================================================

/** Source/citation from Perplexity */
export interface ResearchSource {
  url: string;
  title?: string;
}

/** Token usage from generation (Vercel AI SDK format) */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Base result type for all research functions */
export interface ResearchResult<T> {
  data: T;
  sources: ResearchSource[];
  usage: TokenUsage;
  cost: number;
  model: string;
}

// =============================================================================
// Section-Specific Result Types
// =============================================================================

export type IndustryMarketResult = ResearchResult<IndustryMarketOverview>;
export type ICPAnalysisResult = ResearchResult<ICPAnalysisValidation>;
export type OfferAnalysisResult = ResearchResult<OfferAnalysisViability>;
export type CompetitorAnalysisResult = ResearchResult<CompetitorAnalysis>;
export type CrossAnalysisResult = ResearchResult<CrossAnalysisSynthesis>;

// =============================================================================
// Pipeline Types
// =============================================================================

/** All section results for synthesis */
export interface AllSectionResults {
  industryMarket: IndustryMarketOverview;
  icpAnalysis: ICPAnalysisValidation;
  offerAnalysis: OfferAnalysisViability;
  competitorAnalysis: CompetitorAnalysis;
}

/** Progress callback for streaming updates */
export interface GenerationProgress {
  phase: 1 | 2 | 3;
  section: string;
  status: 'starting' | 'complete' | 'error';
  message: string;
  elapsedMs: number;
  cost: number;
  /** Competitor data available after Phase 1 for early enrichment */
  competitorData?: CompetitorAnalysis;
}

export type ProgressCallback = (progress: GenerationProgress) => void;
