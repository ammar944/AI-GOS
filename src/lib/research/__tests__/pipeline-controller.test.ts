import { describe, expect, it } from 'vitest';

import {
  createInitialPipelineState,
  getNextSectionId,
  invalidateDownstream,
  markSectionApproved,
  markSectionComplete,
  markSectionRunning,
} from '@/lib/research/pipeline-controller';
import { PIPELINE_SECTION_ORDER } from '@/lib/research/pipeline-types';

describe('createInitialPipelineState', () => {
  it('creates state with six pending sections', () => {
    const state = createInitialPipelineState('run-123');

    expect(state.runId).toBe('run-123');
    expect(state.status).toBe('idle');
    expect(state.currentSectionId).toBeNull();
    expect(state.approvedSectionIds).toEqual([]);
    expect(state.sections).toHaveLength(6);
    expect(state.sections[0]?.id).toBe('industryResearch');
    expect(state.sections[0]?.status).toBe('pending');
    expect(state.sections[5]?.id).toBe('keywordIntel');
    expect(state.sections[5]?.status).toBe('pending');
  });
});

describe('getNextSectionId', () => {
  it('returns the first section when nothing is approved', () => {
    expect(getNextSectionId([])).toBe('industryResearch');
  });

  it('returns the next section after the first approval', () => {
    expect(getNextSectionId(['industryResearch'])).toBe('competitorIntel');
  });

  it('returns null when all sections are approved', () => {
    expect(
      getNextSectionId([
        'industryResearch',
        'competitorIntel',
        'icpValidation',
        'offerAnalysis',
        'strategicSynthesis',
        'keywordIntel',
      ]),
    ).toBeNull();
  });
});

describe('markSectionRunning', () => {
  it('marks the target section as running and stores the active job', () => {
    const state = createInitialPipelineState('run-1');

    const nextState = markSectionRunning(state, 'industryResearch', 'job-abc');

    expect(nextState.status).toBe('running');
    expect(nextState.currentSectionId).toBe('industryResearch');
    expect(nextState.sections[0]).toMatchObject({
      id: 'industryResearch',
      status: 'running',
      jobId: 'job-abc',
      error: null,
    });
  });
});

describe('markSectionComplete', () => {
  it('marks the section complete, stores data, and gates the pipeline', () => {
    const runningState = markSectionRunning(
      createInitialPipelineState('run-1'),
      'industryResearch',
      'job-abc',
    );

    const nextState = markSectionComplete(runningState, 'industryResearch', {
      market: 'data',
    });

    expect(nextState.status).toBe('gated');
    expect(nextState.currentSectionId).toBe('industryResearch');
    expect(nextState.sections[0]).toMatchObject({
      id: 'industryResearch',
      status: 'complete',
      data: { market: 'data' },
      jobId: 'job-abc',
    });
  });
});

describe('markSectionApproved', () => {
  it('adds the section to approved ids and marks it approved', () => {
    const completeState = markSectionComplete(
      markSectionRunning(createInitialPipelineState('run-1'), 'industryResearch', 'job-abc'),
      'industryResearch',
      { market: 'data' },
    );

    const nextState = markSectionApproved(completeState, 'industryResearch');

    expect(nextState.status).toBe('gated');
    expect(nextState.approvedSectionIds).toEqual(['industryResearch']);
    expect(nextState.sections[0]?.status).toBe('approved');
  });

  it('does not duplicate approvals for the same section', () => {
    const approvedState = markSectionApproved(
      markSectionComplete(
        markSectionRunning(createInitialPipelineState('run-1'), 'industryResearch', 'job-abc'),
        'industryResearch',
        { market: 'data' },
      ),
      'industryResearch',
    );

    const nextState = markSectionApproved(approvedState, 'industryResearch');

    expect(nextState.approvedSectionIds).toEqual(['industryResearch']);
  });

  it('completes the pipeline when all sections are approved', () => {
    const finalState = PIPELINE_SECTION_ORDER.reduce((state, sectionId) => {
      const runningState = markSectionRunning(state, sectionId, `job-${sectionId}`);
      const completeState = markSectionComplete(runningState, sectionId, {
        sectionId,
      });

      return markSectionApproved(completeState, sectionId);
    }, createInitialPipelineState('run-1'));

    expect(finalState.status).toBe('complete');
    expect(finalState.approvedSectionIds).toEqual([...PIPELINE_SECTION_ORDER]);
  });
});

describe('invalidateDownstream', () => {
  it('marks only downstream dependents stale and removes them from approvals', () => {
    const approvedState = PIPELINE_SECTION_ORDER.reduce((state, sectionId) => {
      const runningState = markSectionRunning(state, sectionId, `job-${sectionId}`);
      const completeState = markSectionComplete(runningState, sectionId, {
        sectionId,
      });

      return markSectionApproved(completeState, sectionId);
    }, createInitialPipelineState('run-1'));

    const nextState = invalidateDownstream(approvedState, 'industryResearch');

    expect(nextState.status).toBe('gated');
    expect(nextState.sections.find((section) => section.id === 'industryResearch')?.status).toBe(
      'approved',
    );
    expect(
      nextState.sections.find((section) => section.id === 'competitorIntel')?.status,
    ).toBe('stale');
    expect(nextState.sections.find((section) => section.id === 'icpValidation')?.status).toBe(
      'stale',
    );
    expect(nextState.sections.find((section) => section.id === 'offerAnalysis')?.status).toBe(
      'stale',
    );
    expect(
      nextState.sections.find((section) => section.id === 'strategicSynthesis')?.status,
    ).toBe('stale');
    expect(nextState.sections.find((section) => section.id === 'keywordIntel')?.status).toBe(
      'stale',
    );
    expect(nextState.approvedSectionIds).toContain('industryResearch');
    expect(nextState.approvedSectionIds).not.toContain('competitorIntel');
    expect(nextState.approvedSectionIds).not.toContain('icpValidation');
    expect(nextState.approvedSectionIds).not.toContain('offerAnalysis');
    expect(nextState.approvedSectionIds).not.toContain('strategicSynthesis');
    expect(nextState.approvedSectionIds).not.toContain('keywordIntel');
  });

  it('keeps the pipeline complete when the edited section has no downstream dependents', () => {
    const approvedState = PIPELINE_SECTION_ORDER.reduce((state, sectionId) => {
      const runningState = markSectionRunning(state, sectionId, `job-${sectionId}`);
      const completeState = markSectionComplete(runningState, sectionId, {
        sectionId,
      });

      return markSectionApproved(completeState, sectionId);
    }, createInitialPipelineState('run-1'));

    const nextState = invalidateDownstream(approvedState, 'keywordIntel');

    expect(nextState.status).toBe('complete');
    expect(nextState.approvedSectionIds).toEqual([...PIPELINE_SECTION_ORDER]);
    expect(nextState.sections.find((section) => section.id === 'keywordIntel')?.status).toBe(
      'approved',
    );
  });
});
