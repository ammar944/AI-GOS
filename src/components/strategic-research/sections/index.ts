export { IndustryMarketContent } from "./industry-market-content";
export { ICPAnalysisContent } from "./icp-analysis-content";
export { OfferAnalysisContent } from "./offer-analysis-content";
export { CompetitorAnalysisContent } from "./competitor-analysis-content";
export { CrossAnalysisContent } from "./cross-analysis-content";
export { KeywordIntelligenceContent } from "./keyword-intelligence-content";

// Re-export shared primitives for use in other components
export {
  // Core primitives (redesigned)
  SubSection,
  ListItem,
  BoolCheck,
  ScoreDisplay,
  EmptyExplanation,
  // New primitives
  DataCard,
  InsightCard,
  StatusBanner,
  HighlightBlock,
  NumberedStep,
  WarningItem,
  PriorityBadge,
  CardGrid,
  OverallScoreDisplay,
  // Status color maps
  VALIDATION_STATUS_COLORS,
  RISK_COLORS,
  OFFER_RECOMMENDATION_COLORS,
  type EditableContentProps,
} from "./shared-primitives";

// Re-export shared helpers
export {
  safeRender,
  safeArray,
  hasItems,
  formatPricingTier,
  parsePricingTierStrings,
  cleanReviewText,
  excerpt,
  buildCompetitorPlatformSearchLinks,
} from "./shared-helpers";
