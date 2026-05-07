'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceState, SectionKey, SectionPhase, CardState } from '@/lib/workspace/types';
import { SECTION_PIPELINE, createInitialSectionStates, getNextSection } from '@/lib/workspace/pipeline';
import { loadWorkspaceState, saveWorkspaceState } from '@/lib/workspace/storage';

export interface WorkspaceActions {
  state: WorkspaceState;
  enterWorkspace: () => void;
  setSectionPhase: (section: SectionKey, phase: SectionPhase, error?: string) => void;
  setCards: (section: SectionKey, cards: CardState[]) => void;
  updateCard: (cardId: string, content: Record<string, unknown>, editedBy: 'user' | 'ai') => void;
  approveCard: (cardId: string) => void;
  approveSection: () => SectionKey | null;
  restoreCardVersion: (cardId: string, versionIndex: number) => void;
  navigateToSection: (section: SectionKey) => void;
}

export const WorkspaceContext = createContext<WorkspaceActions | null>(null);

interface WorkspaceProviderProps {
  sessionId: string;
  startInWorkspace?: boolean;
  initialSection?: SectionKey;
  children: React.ReactNode;
}

function createFreshState(sessionId: string, startInWorkspace = false, initialSection?: SectionKey): WorkspaceState {
  const sectionStates = createInitialSectionStates();
  if (startInWorkspace) {
    // In the one-pass Journey flow, the link-triggered deepResearchProgram is
    // the only automatic research run. Workspace sections should reveal
    // synthesized artifacts from that shared corpus; they are not independent
    // per-section research jobs.
    sectionStates[SECTION_PIPELINE[0]] = 'researching';
  }
  // If an initial section is specified (e.g. mediaPlan from deep-link),
  // open it as the current review target rather than dispatching research.
  if (initialSection) {
    sectionStates[initialSection] = 'review';
  }
  return {
    sessionId,
    phase: startInWorkspace ? 'workspace' : 'onboarding',
    currentSection: initialSection ?? SECTION_PIPELINE[0],
    sectionStates,
    sectionErrors: {},
    cards: {},
  };
}

function clearSectionError(
  sectionErrors: WorkspaceState['sectionErrors'],
  section: SectionKey,
): WorkspaceState['sectionErrors'] {
  const nextErrors: WorkspaceState['sectionErrors'] = {};
  for (const [key, value] of Object.entries(sectionErrors)) {
    if (key !== section && value) {
      nextErrors[key as SectionKey] = value;
    }
  }
  return nextErrors;
}

export function WorkspaceProvider({ sessionId, startInWorkspace = false, initialSection, children }: WorkspaceProviderProps) {
  const [state, setState] = useState<WorkspaceState>(() => {
    const loaded = loadWorkspaceState(sessionId);
    if (loaded) {
      // If deep-linking to a specific section, navigate to it
      if (initialSection) {
        return { ...loaded, currentSection: initialSection };
      }
      return loaded;
    }
    return createFreshState(sessionId, startInWorkspace, initialSection);
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
    saveWorkspaceState(state);
  }, [state]);

  const enterWorkspace = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phase: 'workspace',
      currentSection: SECTION_PIPELINE[0],
      sectionStates: {
        ...prev.sectionStates,
        [SECTION_PIPELINE[0]]:
          prev.sectionStates[SECTION_PIPELINE[0]] === 'approved'
            ? 'approved'
            : 'review',
      },
    }));
  }, []);

  const setSectionPhase = useCallback((section: SectionKey, phase: SectionPhase, error?: string) => {
    setState((prev) => ({
      ...prev,
      sectionStates: { ...prev.sectionStates, [section]: phase },
      sectionErrors: error
        ? { ...prev.sectionErrors, [section]: error }
        : clearSectionError(prev.sectionErrors, section),
    }));
  }, []);

  const setCards = useCallback((section: SectionKey, cards: CardState[]) => {
    setState((prev) => {
      const next = { ...prev.cards };
      for (const card of cards) {
        // Preserve user/AI edits — don't let polling overwrite them
        const existing = next[card.id];
        if (existing?.status === 'edited') continue;
        next[card.id] = card;
      }
      return { ...prev, cards: next };
    });
  }, []);

  const updateCard = useCallback((cardId: string, content: Record<string, unknown>, editedBy: 'user' | 'ai') => {
    setState((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      const snapshot = { content: card.content, editedBy, timestamp: Date.now() };
      const versions = [snapshot, ...card.versions].slice(0, 5);
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...card, content, status: 'edited', versions },
        },
      };
    });
  }, []);

  const approveCard = useCallback((cardId: string) => {
    setState((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      return {
        ...prev,
        cards: { ...prev.cards, [cardId]: { ...card, status: 'approved' } },
      };
    });
  }, []);

  const approveSection = useCallback((): SectionKey | null => {
    const current = stateRef.current.currentSection;
    const next = getNextSection(current);

    setState((prev) => {
      const updatedCards = { ...prev.cards };
      for (const [id, card] of Object.entries(updatedCards)) {
        if (card.sectionKey === current) {
          updatedCards[id] = { ...card, status: 'approved' };
        }
      }

      // Normal section progression is synthesis/review over the one shared deep
      // research corpus. Do not mark the next section as `researching` unless a
      // user explicitly requests a rerun elsewhere; reveal existing cards when
      // available, otherwise keep the next section queued until hydration arrives.
      let nextPhase: SectionPhase = 'queued';
      if (next) {
        const hasCards = Object.values(updatedCards).some(
          (card) => card.sectionKey === next,
        );
        if (hasCards) {
          nextPhase = 'review';
        }
      }

      return {
        ...prev,
        sectionStates: {
          ...prev.sectionStates,
          [current]: 'approved',
          ...(next ? { [next]: nextPhase } : {}),
        },
        currentSection: next ?? current,
        cards: updatedCards,
      };
    });

    return next;
  }, []);

  const restoreCardVersion = useCallback((cardId: string, versionIndex: number) => {
    setState((prev) => {
      const card = prev.cards[cardId];
      if (!card || !card.versions[versionIndex]) return prev;
      const restoredContent = card.versions[versionIndex].content;
      const snapshot = { content: card.content, editedBy: 'user' as const, timestamp: Date.now() };
      const versions = [snapshot, ...card.versions].slice(0, 5);
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...card, content: restoredContent, status: 'edited', versions },
        },
      };
    });
  }, []);

  const navigateToSection = useCallback((section: SectionKey) => {
    setState((prev) => {
      // Guard inside updater so it reads state AFTER prior setSectionPhase calls
      if (prev.sectionStates[section] === 'queued') return prev;
      return { ...prev, currentSection: section };
    });
  }, []);

  const actions: WorkspaceActions = {
    state,
    enterWorkspace,
    setSectionPhase,
    setCards,
    updateCard,
    approveCard,
    approveSection,
    restoreCardVersion,
    navigateToSection,
  };

  return (
    <WorkspaceContext.Provider value={actions}>
      {children}
    </WorkspaceContext.Provider>
  );
}
