import { GTM_STAGE_KEYS, type GtmStageKey } from '../schemas/gtm/gtm-run';

export type LocalGtmStageExecutionType = 'fixture' | 'agent-command';

export interface LocalGtmStageConfig {
  stage: GtmStageKey;
  command: string;
  skill: string;
  executionType: LocalGtmStageExecutionType;
  outputFile: string;
}

export const GTM_LOCAL_STAGE_REGISTRY = {
  'discover-url': {
    stage: 'discover-url',
    command: '/ingest-url',
    skill: 'ingest-url',
    executionType: 'fixture',
    outputFile: '01-discover-url.json',
  },
  'enrich-brief': {
    stage: 'enrich-brief',
    command: '/ingest-docs',
    skill: 'ingest-docs',
    executionType: 'fixture',
    outputFile: '02-enrich-brief.json',
  },
  'review-brief': {
    stage: 'review-brief',
    command: '/present-workspace',
    skill: 'present-workspace',
    executionType: 'fixture',
    outputFile: '03-review-brief.json',
  },
  'lock-brief': {
    stage: 'lock-brief',
    command: '/gtm-local-run lock-brief',
    skill: 'gtm-local-run',
    executionType: 'fixture',
    outputFile: '04-lock-brief.json',
  },
  'research-market-category': {
    stage: 'research-market-category',
    command: '/research-market',
    skill: 'research-market',
    executionType: 'agent-command',
    outputFile: '05-research-market-category.json',
  },
  'research-buyer-icp': {
    stage: 'research-buyer-icp',
    command: '/research-icp',
    skill: 'research-icp',
    executionType: 'agent-command',
    outputFile: '06-research-buyer-icp.json',
  },
  'research-competitors': {
    stage: 'research-competitors',
    command: '/research-competitor',
    skill: 'research-competitor',
    executionType: 'agent-command',
    outputFile: '07-research-competitors.json',
  },
  'research-voc': {
    stage: 'research-voc',
    command: '/research-voc',
    skill: 'research-voc',
    executionType: 'agent-command',
    outputFile: '08-research-voc.json',
  },
  'research-demand-intent': {
    stage: 'research-demand-intent',
    command: '/research-keywords',
    skill: 'research-keywords',
    executionType: 'agent-command',
    outputFile: '09-research-demand-intent.json',
  },
  'research-offer-funnel': {
    stage: 'research-offer-funnel',
    command: '/research-offer',
    skill: 'research-offer',
    executionType: 'agent-command',
    outputFile: '10-research-offer-funnel.json',
  },
  'synthesize-strategy': {
    stage: 'synthesize-strategy',
    command: '/synthesize-positioning',
    skill: 'synthesize-positioning',
    executionType: 'agent-command',
    outputFile: '11-synthesize-strategy.json',
  },
  'generate-media-plan': {
    stage: 'generate-media-plan',
    command: '/synthesize-media-plan',
    skill: 'synthesize-media-plan',
    executionType: 'agent-command',
    outputFile: '12-generate-media-plan.json',
  },
  'generate-scripts': {
    stage: 'generate-scripts',
    command: '/synthesize-scripts',
    skill: 'synthesize-scripts',
    executionType: 'agent-command',
    outputFile: '13-generate-scripts.json',
  },
} as const satisfies Record<GtmStageKey, LocalGtmStageConfig>;

export function getLocalGtmStageConfig(stage: GtmStageKey): LocalGtmStageConfig {
  return GTM_LOCAL_STAGE_REGISTRY[stage];
}

export function getLocalGtmStageConfigs(): LocalGtmStageConfig[] {
  return GTM_STAGE_KEYS.map((stage) => getLocalGtmStageConfig(stage));
}
