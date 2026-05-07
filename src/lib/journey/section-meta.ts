export interface SectionMeta {
  label: string;
  moduleNumber: string;
  description: string;
}

export const SECTION_META: Record<string, SectionMeta> = {
  industryMarket: { label: 'Market & Category Intelligence', moduleNumber: '01', description: 'Category landscape, market dynamics, and growth context' },
  icpValidation: { label: 'Buyer & ICP Validation', moduleNumber: '02', description: 'Ideal customer validation, buying triggers, and fit signals' },
  competitors: { label: 'Competitor Landscape & Positioning', moduleNumber: '03', description: 'Competitive positioning, differentiation, and market gaps' },
  crossAnalysis: { label: 'Voice of Customer & Objection Evidence', moduleNumber: '04', description: 'Customer language, objections, reviews, and proof points' },
  keywordIntel: { label: 'Demand & Intent Signals', moduleNumber: '05', description: 'Search demand, intent patterns, channel signals, and timing' },
  offerAnalysis: { label: 'Offer & Performance Diagnostic', moduleNumber: '06', description: 'Offer strength, conversion risk, performance gaps, and next moves' },
  mediaPlan: { label: 'Media Plan', moduleNumber: '07', description: 'Channel mix, budget allocation, and campaign architecture' },
  scripts: { label: 'Scripts', moduleNumber: '08', description: 'Ad scripts across awareness levels grounded in research data' },
};

export const DEFAULT_SECTION_META: SectionMeta = { label: 'Research', moduleNumber: '00', description: '' };
