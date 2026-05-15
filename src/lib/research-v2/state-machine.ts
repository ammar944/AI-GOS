// Pure TypeScript state machine for the /research-v2 flow.
// No side effects, no DB calls, no fetch. All IO lives in page.tsx useEffect.

import type {
  OnboardingPrefillMetadata,
  OnboardingV2Data,
} from './onboarding-v2-types';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

// ---------------------------------------------------------------------------
// State union (Premise 8 from design doc)
// ---------------------------------------------------------------------------

export type ResearchV2State =
  | { kind: 'welcome' }
  | {
      kind: 'corpus';
      runId: string;
      phase: 'starting' | 'streaming' | 'finalizing';
    }
  | {
      kind: 'onboarding';
      runId: string;
      prefill: Partial<OnboardingV2Data>;
      prefillMetadata: OnboardingPrefillMetadata;
    }
  | {
      kind: 'sections';
      runId: string;
      currentSection: PositioningSectionId | null;
    }
  | {
      kind: 'error';
      from: 'corpus' | 'onboarding' | 'section';
      runId: string;
      sectionId?: PositioningSectionId;
      message: string;
    };

// ---------------------------------------------------------------------------
// Action union
// ---------------------------------------------------------------------------

export type ResearchV2Action =
  // Welcome → Corpus: user submits URL, corpus dispatch started
  | { type: 'CORPUS_START'; runId: string }
  // Corpus phase transitions
  | { type: 'CORPUS_STREAMING' }
  | { type: 'CORPUS_FINALIZING' }
  // Corpus → Onboarding: worker completed, prefill available
  | {
      type: 'CORPUS_COMPLETE';
      prefill: Partial<OnboardingV2Data>;
      prefillMetadata?: OnboardingPrefillMetadata;
    }
  // Onboarding → Sections: user submitted onboarding form
  | { type: 'ONBOARDING_COMPLETE' }
  // Sections: track active section
  | { type: 'SECTION_START'; sectionId: PositioningSectionId }
  | { type: 'SECTION_COMPLETE'; sectionId: PositioningSectionId }
  // Error transitions from any stage
  | {
      type: 'ERROR';
      from: 'corpus' | 'onboarding' | 'section';
      message: string;
      sectionId?: PositioningSectionId;
    }
  // Recovery: return to welcome (marks run abandoned before calling)
  | { type: 'RESET_TO_WELCOME' }
  // Resume: hydrate state from persisted session
  | { type: 'RESUME'; state: ResearchV2State };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function researchV2Reducer(
  state: ResearchV2State,
  action: ResearchV2Action,
): ResearchV2State {
  switch (action.type) {
    case 'CORPUS_START':
      return { kind: 'corpus', runId: action.runId, phase: 'starting' };

    case 'CORPUS_STREAMING':
      if (state.kind !== 'corpus') return state;
      return { ...state, phase: 'streaming' };

    case 'CORPUS_FINALIZING':
      if (state.kind !== 'corpus') return state;
      return { ...state, phase: 'finalizing' };

    case 'CORPUS_COMPLETE':
      if (state.kind !== 'corpus') return state;
      return {
        kind: 'onboarding',
        runId: state.runId,
        prefill: action.prefill,
        prefillMetadata: action.prefillMetadata ?? {},
      };

    case 'ONBOARDING_COMPLETE':
      if (state.kind !== 'onboarding') return state;
      return {
        kind: 'sections',
        runId: state.runId,
        currentSection: null,
      };

    case 'SECTION_START':
      if (state.kind !== 'sections') return state;
      return { ...state, currentSection: action.sectionId };

    case 'SECTION_COMPLETE':
      if (state.kind !== 'sections') return state;
      return { ...state, currentSection: null };

    case 'ERROR': {
      const runId =
        state.kind === 'welcome' ? '' : state.runId;
      return {
        kind: 'error',
        from: action.from,
        runId,
        sectionId: action.sectionId,
        message: action.message,
      };
    }

    case 'RESET_TO_WELCOME':
      return { kind: 'welcome' };

    case 'RESUME':
      return action.state;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const INITIAL_STATE: ResearchV2State = { kind: 'welcome' };
