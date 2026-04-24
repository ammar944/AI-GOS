import { describe, expect, it } from 'vitest';
import { GTM_STAGE_KEYS } from '../../schemas/gtm/gtm-run';
import { GTM_LOCAL_STAGE_REGISTRY } from '../local-stage-registry';

describe('GTM_LOCAL_STAGE_REGISTRY', () => {
  it('covers every GTM stage in canonical order', () => {
    expect(Object.keys(GTM_LOCAL_STAGE_REGISTRY)).toEqual([...GTM_STAGE_KEYS]);
  });

  it('routes local stages to the intended command-first skill surface', () => {
    expect(GTM_LOCAL_STAGE_REGISTRY['research-market-category'].command).toBe('/research-market');
    expect(GTM_LOCAL_STAGE_REGISTRY['research-buyer-icp'].command).toBe('/research-icp');
    expect(GTM_LOCAL_STAGE_REGISTRY['research-competitors'].command).toBe('/research-competitor');
    expect(GTM_LOCAL_STAGE_REGISTRY['research-voc'].command).toBe('/research-voc');
    expect(GTM_LOCAL_STAGE_REGISTRY['research-demand-intent'].command).toBe('/research-keywords');
    expect(GTM_LOCAL_STAGE_REGISTRY['research-offer-funnel'].command).toBe('/research-offer');
    expect(GTM_LOCAL_STAGE_REGISTRY['synthesize-strategy'].command).toBe('/synthesize-positioning');
    expect(GTM_LOCAL_STAGE_REGISTRY['generate-media-plan'].command).toBe('/synthesize-media-plan');
    expect(GTM_LOCAL_STAGE_REGISTRY['generate-scripts'].command).toBe('/synthesize-scripts');
  });
});
