export interface SectionMeta {
  label: string;
  moduleNumber: string;
  description: string;
}

export const SECTION_META: Record<string, SectionMeta> = {
  industryMarket: { label: 'Market Overview', moduleNumber: '01', description: 'Industry landscape, market sizing, and growth dynamics' },
  icpValidation: { label: 'ICP Validation', moduleNumber: '02', description: 'Ideal customer profile validation and buyer journey mapping' },
  offerAnalysis: { label: 'Offer Analysis', moduleNumber: '03', description: 'Value proposition, pricing strategy, and market fit assessment' },
  competitors: { label: 'Competitor Intel', moduleNumber: '04', description: 'Competitive positioning, pricing, and ad activity analysis' },
  keywordIntel: { label: 'Keywords', moduleNumber: '05', description: 'Search volume, competition, and keyword strategy opportunities' },
  crossAnalysis: { label: 'Strategic Synthesis', moduleNumber: '06', description: 'Cross-section insights, strategic patterns, and recommendations' },
  mediaPlan: { label: 'Media Plan', moduleNumber: '07', description: 'Channel mix, budget allocation, and campaign architecture' },
};

export const DEFAULT_SECTION_META: SectionMeta = { label: 'Research', moduleNumber: '00', description: '' };
