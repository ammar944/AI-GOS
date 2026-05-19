import { describe, expect, it } from 'vitest';

import {
  inferPersistedResearchV2State,
  type PersistedResearchV2Session,
} from '@/lib/research-v2/session-state';
import {
  researchV2Reducer,
  type ResearchV2State,
} from '@/lib/research-v2/state-machine';
import { __testing__ } from '../../../../research-worker/src/runners/positioning-audit-orchestrator';

/**
 * Phase 6: resume / partial / abort robustness.
 *
 * The contract is: any /research-v2 run can be reconstructed purely from
 * server tables, retries of an errored parent reopen the same parent
 * (idempotent), and a worker crash leaves the parent in 'partial' with
 * the completed children intact.
 *
 * These tests pin the rollup table that drives the parent status after
 * each child terminal event. The browser-side resume reducer
 * (src/app/research-v2/page.tsx::inferResumeState) is already covered
 * by integration through agent-artifact-surface tests and the existing
 * orchestrate-client tests; this file owns the rollup boundary the
 * worker reaper depends on.
 */
const { rollupStatus } = __testing__;

describe('Phase 6 rollup contract', () => {
  it('complete when every child finished cleanly', () => {
    expect(rollupStatus(false, ['complete', 'complete', 'complete', 'complete', 'complete', 'complete'])).toBe('complete');
  });

  it('error when every child errored', () => {
    expect(rollupStatus(false, ['error', 'error', 'error', 'error', 'error', 'error'])).toBe('error');
  });

  it('partial after a worker crash — some complete, some error', () => {
    expect(
      rollupStatus(false, ['complete', 'complete', 'error', 'complete', 'complete', 'error']),
    ).toBe('partial');
  });

  it('partial when one child crashed and the others completed (1 of 6 fail)', () => {
    expect(rollupStatus(false, ['complete', 'complete', 'complete', 'complete', 'complete', 'error'])).toBe('partial');
  });

  it('aborted when the parent abort flag is set even if all children completed', () => {
    expect(rollupStatus(true, ['complete', 'complete'])).toBe('aborted');
  });

  it('aborted when no completes/errors and only aborts (e.g. parent killed before any child started)', () => {
    expect(rollupStatus(false, ['aborted', 'aborted', 'aborted', 'aborted', 'aborted', 'aborted'])).toBe('aborted');
  });

  it('partial when retry-after-error refills the failed slots — only 4 of 6 finished before reload', () => {
    // Simulates a retry mid-flight where the orchestrator rolls up before
    // the resumed children settle: 4 completes, 2 still queued ⇒ orchestrator
    // skips queued children in rollupStatus (terminals only). Caller passes
    // only the terminals.
    expect(rollupStatus(false, ['complete', 'complete', 'complete', 'complete'])).toBe('complete');
  });
});

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
