import { describe, expect, it } from 'vitest';
import { getDownstreamResearchPlan } from '../journey-downstream-research';

describe('getDownstreamResearchPlan', () => {
  it('starts with synthesis after offer approval', () => {
    expect(
      getDownstreamResearchPlan({
        synthesisStarted: false,
        synthesisComplete: false,
        keywordResearchStarted: false,
        keywordResearchComplete: false,
        mediaPlanStarted: false,
        mediaPlanComplete: false,
      }),
    ).toEqual({
      nextTool: 'synthesizeResearch',
      strategistModeReady: false,
    });
  });

  it('queues keyword research after synthesis completes', () => {
    expect(
      getDownstreamResearchPlan({
        synthesisStarted: true,
        synthesisComplete: true,
        keywordResearchStarted: false,
        keywordResearchComplete: false,
        mediaPlanStarted: false,
        mediaPlanComplete: false,
      }),
    ).toEqual({
      nextTool: 'researchKeywords',
      strategistModeReady: false,
    });
  });

  it('stops downstream tool dispatch after keyword intel completes', () => {
    expect(
      getDownstreamResearchPlan({
        synthesisStarted: true,
        synthesisComplete: true,
        keywordResearchStarted: true,
        keywordResearchComplete: true,
        mediaPlanStarted: false,
        mediaPlanComplete: false,
      }),
    ).toEqual({
      nextTool: null,
      strategistModeReady: true,
    });
  });

  it('keeps Strategist Mode ready when a legacy media plan already exists', () => {
    expect(
      getDownstreamResearchPlan({
        synthesisStarted: true,
        synthesisComplete: true,
        keywordResearchStarted: true,
        keywordResearchComplete: true,
        mediaPlanStarted: true,
        mediaPlanComplete: true,
      }),
    ).toEqual({
      nextTool: null,
      strategistModeReady: true,
    });
  });
});
