import { describe, expect, it } from 'vitest';
import { GTM_STAGE_KEYS } from '@/lib/gtm/schemas/gtm-run';
import {
  firstStage,
  nextStage,
  previousStage,
  stageIndex,
  isTerminalStage,
} from '@/lib/gtm/workflow/stage-registry';
import { RESEARCH_SECTION_ORDER, isResearchSectionStage } from '@/lib/gtm/workflow/section-order';

describe('stage-registry', () => {
  it('first stage is discover-url', () => {
    expect(firstStage()).toBe('discover-url');
  });

  it('nextStage walks the registry in order', () => {
    expect(nextStage('discover-url')).toBe('enrich-brief');
    expect(nextStage('generate-media-plan')).toBe('generate-scripts');
  });

  it('nextStage on the final stage returns null', () => {
    expect(nextStage('generate-scripts')).toBeNull();
  });

  it('previousStage reverses nextStage', () => {
    expect(previousStage('enrich-brief')).toBe('discover-url');
    expect(previousStage('discover-url')).toBeNull();
  });

  it('stageIndex returns canonical 0-based position', () => {
    expect(stageIndex('discover-url')).toBe(0);
    expect(stageIndex('generate-scripts')).toBe(GTM_STAGE_KEYS.length - 1);
  });

  it('isTerminalStage returns true only for generate-scripts', () => {
    expect(isTerminalStage('generate-scripts')).toBe(true);
    expect(isTerminalStage('generate-media-plan')).toBe(false);
  });
});

describe('section-order', () => {
  it('lists the six research sections in the canonical order', () => {
    expect(RESEARCH_SECTION_ORDER).toEqual([
      'research-market-category',
      'research-buyer-icp',
      'research-competitors',
      'research-voc',
      'research-demand-intent',
      'research-offer-funnel',
    ]);
  });

  it('isResearchSectionStage matches the order list', () => {
    for (const stage of RESEARCH_SECTION_ORDER) {
      expect(isResearchSectionStage(stage)).toBe(true);
    }
    expect(isResearchSectionStage('discover-url')).toBe(false);
    expect(isResearchSectionStage('synthesize-strategy')).toBe(false);
  });
});
