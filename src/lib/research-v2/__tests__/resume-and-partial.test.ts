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
 * Resume / partial robustness for the no-corpus-before-onboarding flow
 * (LOCK 2026-06-24). The contract: any /research-v3 run is reconstructed
 * purely from server tables. Positioning work or saved onboarding data →
 * sections. Otherwise the user is still in the user-filled onboarding phase.
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

describe('resume reducer contract (no corpus-before-onboarding)', () => {
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

  it('resumes to sections when onboarding data has been persisted', () => {
    const state = inferSession({
      researchResults: null,
      onboardingData: { companyName: 'Clay' },
      jobStatus: null,
    });
    expect(state).toMatchObject({ kind: 'sections', runId: RUN_ID });
  });

  it('resumes to onboarding (blank, no seed) when nothing is persisted', () => {
    const state = inferSession({
      researchResults: null,
      onboardingData: null,
      jobStatus: null,
    });
    expect(state).toMatchObject({ kind: 'onboarding', runId: RUN_ID });
    if (state?.kind !== 'onboarding') throw new Error('expected onboarding');
    expect(state.initialData).toBeUndefined();
  });

  it('seeds onboarding from the operator own profile-cached onboarding (never a corpus prefill)', () => {
    const state = inferSession({
      researchResults: null,
      onboardingData: null,
      jobStatus: null,
      cachedOnboardingData: {
        companyName: 'Human-edited Clay',
        pricingTiers: 'Enterprise pricing reviewed by the operator.',
      },
    });
    expect(state?.kind).toBe('onboarding');
    if (state?.kind !== 'onboarding') throw new Error('expected onboarding');
    expect(state.initialData).toMatchObject({
      companyName: 'Human-edited Clay',
      pricingTiers: 'Enterprise pricing reviewed by the operator.',
    });
  });

  it('ONBOARDING_START lands in onboarding with a runId and no seed', () => {
    const state = researchV2Reducer(
      { kind: 'welcome' },
      { type: 'ONBOARDING_START', runId: RUN_ID },
    );
    expect(state).toEqual({ kind: 'onboarding', runId: RUN_ID });
  });

  it('RESUME_ONBOARDING carries the operator own prior onboarding as initialData', () => {
    const state = researchV2Reducer(
      { kind: 'welcome' },
      {
        type: 'RESUME_ONBOARDING',
        runId: RUN_ID,
        initialData: { companyName: 'Clay' },
      },
    );
    expect(state).toEqual({
      kind: 'onboarding',
      runId: RUN_ID,
      initialData: { companyName: 'Clay' },
    });
  });

  it('ONBOARDING_COMPLETE transitions onboarding → sections', () => {
    const state = researchV2Reducer(
      { kind: 'onboarding', runId: RUN_ID },
      { type: 'ONBOARDING_COMPLETE' },
    );
    expect(state).toEqual({
      kind: 'sections',
      runId: RUN_ID,
      currentSection: null,
    });
  });

  it('ONBOARDING_COMPLETE is ignored outside the onboarding phase', () => {
    const welcome = researchV2Reducer(
      { kind: 'welcome' },
      { type: 'ONBOARDING_COMPLETE' },
    );
    expect(welcome).toEqual({ kind: 'welcome' });
  });

  it('reload during a partial parent run reconstructs to "sections" — completed children remain visible', () => {
    const state = inferSession({
      researchResults: {
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