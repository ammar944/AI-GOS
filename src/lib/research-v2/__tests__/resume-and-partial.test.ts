import { describe, expect, it } from 'vitest';

import {
  inferPersistedResearchV2State,
  type PersistedResearchV2Session,
} from '@/lib/research-v2/session-state';
import {
  researchV2Reducer,
  type ResearchV2State,
} from '@/lib/research-v2/state-machine';

/**
 * Phase 6: resume / partial / abort robustness.
 *
 * The contract is: any /research-v2 run can be reconstructed purely from
 * server tables, retries reopen the same parent through idempotent seeding,
 * and a reload during partial progress keeps completed children visible.
 */

const RUN_ID = 'run-session-state';

function inferSession(
  input: Omit<PersistedResearchV2Session, 'runId'>,
): ResearchV2State | null {
  return inferPersistedResearchV2State({
    runId: RUN_ID,
    ...input,
  });
}

describe('Phase 6 resume reducer contract', () => {
  it('resumes to sections when at least one positioning result exists', () => {
    const state = inferSession({
      researchResults: {
        positioningMarketCategory: { status: 'complete' },
      },
      onboardingData: null,
      jobStatus: null,
    });
    expect(state?.kind).toBe('sections');
  });

  it('resumes to sections when a positioning job is queued/running (no result yet)', () => {
    const state = inferSession({
      researchResults: null,
      onboardingData: null,
      jobStatus: { positioningBuyerICP: { status: 'running' } },
    });
    expect(state?.kind).toBe('sections');
  });

  it('resumes to onboarding with corpus prefill when corpus is complete but no positioning work has started', () => {
    const state = inferSession({
      researchResults: {
        deepResearchProgram: {
          status: 'complete',
          data: {
            onboardingFields: {
              companyName: {
                value: 'Clay',
                confidence: 0.91,
                sourceUrl: 'https://www.clay.com',
                reasoning: 'Homepage identity.',
              },
            },
          },
        },
      },
      onboardingData: null,
      jobStatus: null,
    });
    expect(state).toMatchObject({
      kind: 'onboarding',
      runId: RUN_ID,
      prefill: { companyName: 'Clay' },
      prefillMetadata: {
        companyName: {
          value: 'Clay',
          confidence: 0.91,
          sourceUrl: 'https://www.clay.com',
          reasoning: 'Homepage identity.',
        },
      },
    });
  });

  it('resumes to onboarding with empty prefill only when a persisted corpus is complete without onboarding fields', () => {
    const state = inferSession({
      researchResults: {
        deepResearchProgram: {
          status: 'complete',
          data: {},
        },
      },
      onboardingData: null,
      jobStatus: null,
    });
    expect(state).toMatchObject({
      kind: 'onboarding',
      runId: RUN_ID,
      prefill: {},
      prefillMetadata: {},
    });
  });

  it('resumes to corpus when corpus is mid-stream', () => {
    const state = inferSession({
      researchResults: {
        deepResearchProgram: { status: 'running' },
      },
      onboardingData: null,
      jobStatus: null,
    });
    expect(state?.kind).toBe('corpus');
  });

  it('resumes to corpus when no persisted corpus exists yet', () => {
    const state = inferSession({
      researchResults: null,
      onboardingData: null,
      jobStatus: null,
    });
    expect(state).toMatchObject({
      kind: 'corpus',
      runId: RUN_ID,
      phase: 'streaming',
    });
  });

  it('ignores duplicate and stale corpus completion actions after the first transition', () => {
    const first = researchV2Reducer(
      { kind: 'corpus', runId: RUN_ID, phase: 'streaming' },
      {
        type: 'CORPUS_COMPLETE',
        runId: RUN_ID,
        prefill: { companyName: 'Clay' },
        prefillMetadata: {},
      },
    );

    const duplicate = researchV2Reducer(first, {
      type: 'CORPUS_COMPLETE',
      runId: RUN_ID,
      prefill: { companyName: 'Should not replace state' },
      prefillMetadata: {},
    });

    const stale = researchV2Reducer(
      { kind: 'corpus', runId: 'new-run', phase: 'streaming' },
      {
        type: 'CORPUS_COMPLETE',
        runId: RUN_ID,
        prefill: { companyName: 'Old run' },
        prefillMetadata: {},
      },
    );

    expect(duplicate).toBe(first);
    expect(stale).toEqual({ kind: 'corpus', runId: 'new-run', phase: 'streaming' });
  });

  it('reload during a partial parent run reconstructs to "sections" — completed children remain visible', () => {
    // Simulates the reload-during-run path: three positioning sections have
    // committed via commit_artifact_section, three are still queued. The
    // resume reducer sees the three complete ones in research_results and
    // lands on 'sections', so the worker chips show their statuses.
    const state = inferSession({
      researchResults: {
        deepResearchProgram: { status: 'complete' },
        positioningMarketCategory: { status: 'complete' },
        positioningBuyerICP: { status: 'complete' },
        positioningCompetitorLandscape: { status: 'complete' },
      },
      onboardingData: null,
      jobStatus: {
        positioningVoiceOfCustomer: { status: 'running' },
      },
    });
    expect(state?.kind).toBe('sections');
  });
});
