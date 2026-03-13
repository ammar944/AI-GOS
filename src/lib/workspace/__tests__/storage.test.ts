import { describe, it, expect, beforeEach } from 'vitest';
import { loadWorkspaceState, saveWorkspaceState, clearWorkspaceState } from '../storage';
import type { WorkspaceState } from '../types';

function createMockState(sessionId = 'test-session'): WorkspaceState {
  return {
    sessionId,
    phase: 'workspace',
    currentSection: 'industryMarket',
    sectionStates: {
      industryMarket: 'review',
      competitors: 'queued',
      icpValidation: 'queued',
      offerAnalysis: 'queued',
      keywordIntel: 'queued',
      crossAnalysis: 'queued',
    },
    sectionErrors: {},
    cards: {},
  };
}

describe('workspace storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no state stored', () => {
    expect(loadWorkspaceState('any-session')).toBeNull();
  });

  it('persists and loads state', () => {
    const state = createMockState();
    saveWorkspaceState(state);
    expect(loadWorkspaceState('test-session')).toEqual(state);
  });

  it('returns null when sessionId mismatches', () => {
    saveWorkspaceState(createMockState('session-a'));
    expect(loadWorkspaceState('session-b')).toBeNull();
  });

  it('clears state', () => {
    saveWorkspaceState(createMockState());
    clearWorkspaceState();
    expect(loadWorkspaceState('test-session')).toBeNull();
  });
});
