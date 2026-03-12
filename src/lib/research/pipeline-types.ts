import type {
  CanonicalResearchSectionId,
  ResearchToolName,
} from '@/lib/journey/research-sections';

export type PipelineRunId = string;
export type PipelineSectionId = Exclude<CanonicalResearchSectionId, 'mediaPlan'>;
export type PipelineToolName = Exclude<ResearchToolName, 'researchMediaPlan'>;

export const PIPELINE_SECTION_ORDER = [
  'industryResearch',
  'competitorIntel',
  'icpValidation',
  'offerAnalysis',
  'strategicSynthesis',
  'keywordIntel',
] as const satisfies ReadonlyArray<PipelineSectionId>;

export type PipelineStatus = 'idle' | 'running' | 'gated' | 'complete' | 'error';

export type SectionStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'complete'
  | 'approved'
  | 'editing'
  | 'stale'
  | 'error';

export interface SectionState {
  id: PipelineSectionId;
  toolName: PipelineToolName;
  boundaryKey: string;
  displayName: string;
  status: SectionStatus;
  data: Record<string, unknown> | null;
  jobId: string | null;
  error: string | null;
}

export interface PipelineState {
  runId: PipelineRunId;
  currentSectionId: PipelineSectionId | null;
  status: PipelineStatus;
  approvedSectionIds: PipelineSectionId[];
  sections: SectionState[];
}

export interface PipelineSectionConfig {
  toolName: PipelineToolName;
  boundaryKey: string;
  displayName: string;
}

export const PIPELINE_SECTION_CONFIG: Record<
  PipelineSectionId,
  PipelineSectionConfig
> = {
  industryResearch: {
    toolName: 'researchIndustry',
    boundaryKey: 'industryMarket',
    displayName: 'Market Overview',
  },
  competitorIntel: {
    toolName: 'researchCompetitors',
    boundaryKey: 'competitors',
    displayName: 'Competitor Intel',
  },
  icpValidation: {
    toolName: 'researchICP',
    boundaryKey: 'icpValidation',
    displayName: 'ICP Validation',
  },
  offerAnalysis: {
    toolName: 'researchOffer',
    boundaryKey: 'offerAnalysis',
    displayName: 'Offer Analysis',
  },
  strategicSynthesis: {
    toolName: 'synthesizeResearch',
    boundaryKey: 'crossAnalysis',
    displayName: 'Strategic Synthesis',
  },
  keywordIntel: {
    toolName: 'researchKeywords',
    boundaryKey: 'keywordIntel',
    displayName: 'Keyword Intelligence',
  },
};

export const PIPELINE_SECTION_DEPENDENCIES: Record<
  PipelineSectionId,
  ReadonlyArray<PipelineSectionId>
> = {
  industryResearch: [],
  competitorIntel: ['industryResearch'],
  icpValidation: ['industryResearch', 'competitorIntel'],
  offerAnalysis: ['industryResearch', 'competitorIntel', 'icpValidation'],
  strategicSynthesis: [
    'industryResearch',
    'competitorIntel',
    'icpValidation',
    'offerAnalysis',
  ],
  keywordIntel: [
    'industryResearch',
    'competitorIntel',
    'icpValidation',
    'offerAnalysis',
    'strategicSynthesis',
  ],
};
