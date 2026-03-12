export interface SectionMeta {
  label: string;
  moduleNumber: string;
}

export const SECTION_META: Record<string, SectionMeta> = {
  industryMarket: { label: 'Market Overview', moduleNumber: '01' },
  competitors: { label: 'Competitor Intel', moduleNumber: '02' },
  icpValidation: { label: 'ICP Validation', moduleNumber: '03' },
  offerAnalysis: { label: 'Offer Analysis', moduleNumber: '04' },
  crossAnalysis: { label: 'Strategic Synthesis', moduleNumber: '05' },
  keywordIntel: { label: 'Keywords', moduleNumber: '06' },
  mediaPlan: { label: 'Media Plan', moduleNumber: '07' },
};

export const DEFAULT_SECTION_META: SectionMeta = { label: 'Research', moduleNumber: '00' };
