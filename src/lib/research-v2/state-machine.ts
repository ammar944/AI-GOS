// Pure TypeScript state machine for the /research-v3 flow.
// No side effects, no DB calls, no fetch. All IO lives in page.tsx useEffect.
//
// Flow (LOCK 2026-06-24): user fills onboarding → submit → research.
// No corpus-before-onboarding gate. Onboarding is user-filled from blank.

import type { OnboardingV2Data } from './onboarding-v2-types';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

// ---------------------------------------------------------------------------
// State union
// ---------------------------------------------------------------------------

export type ResearchV2State =
  | { kind: 'welcome' }
  | {
      kind: 'onboarding';
      runId: string;
      // Optional seed from the operator's OWN prior run (profile-cached
      // onboarding). Never a corpus prefill — that gate is gone.
      initialData?: Partial<OnboardingV2Data>;
    }
  | {
      kind: 'sections';
      runId: string;
      currentSection: PositioningSectionId | null;
    }
  | {
      kind: 'error';
      from: 'onboarding' | 'section';
      runId: string;
      sectionId?: PositioningSectionId;
      message: string;
    };

// ---------------------------------------------------------------------------
// Action union
// ---------------------------------------------------------------------------

export type ResearchV2Action =
  // Welcome → Onboarding: user submitted URL + docs, a runId was minted
  | { type: 'ONBOARDING_START'; runId: string }
  // Resume into onboarding with a seed from the operator's prior run
  | {
      type: 'RESUME_ONBOARDING';
      runId: string;
      initialData?: Partial<OnboardingV2Data>;
    }
  // Onboarding → Sections: user submitted the onboarding form
  | { type: 'ONBOARDING_COMPLETE' }
  // Sections: track active section
  | { type: 'SECTION_START'; sectionId: PositioningSectionId }
  | { type: 'SECTION_COMPLETE'; sectionId: PositioningSectionId }
  // Error transitions from onboarding or a section
  | {
      type: 'ERROR';
      from: 'onboarding' | 'section';
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
    case 'ONBOARDING_START':
      return { kind: 'onboarding', runId: action.runId };

    case 'RESUME_ONBOARDING':
      return {
        kind: 'onboarding',
        runId: action.runId,
        initialData: action.initialData,
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
      const runId = state.kind === 'welcome' ? '' : state.runId;
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