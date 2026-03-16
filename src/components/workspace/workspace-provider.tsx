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
    sectionStates[SECTION_PIPELINE[0]] = 'researching';
  }
  // If an initial section is specified (e.g. mediaPlan from deep-link),
  // set it to researching
  if (initialSection) {
    sectionStates[initialSection] = 'researching';
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
  stateRef.current = state;
  useEffect(() => {
    saveWorkspaceState(state);
  }, [state]);

  const enterWorkspace = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phase: 'workspace',
      currentSection: SECTION_PIPELINE[0],
      sectionStates: {
        ...prev.sectionStates,
        [SECTION_PIPELINE[0]]: 'researching',
      },
    }));
  }, []);

  const setSectionPhase = useCallback((section: SectionKey, phase: SectionPhase, error?: string) => {
    setState((prev) => ({
      ...prev,
      sectionStates: { ...prev.sectionStates, [section]: phase },
      sectionErrors: error
        ? { ...prev.sectionErrors, [section]: error }
        : prev.sectionErrors,
    }));
  }, []);

  const setCards = useCallback((section: SectionKey, cards: CardState[]) => {
    setState((prev) => {
      const next = { ...prev.cards };
      for (const card of cards) {
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

      // If next section already has cards (pre-fetched while user was reviewing),
      // skip straight to 'review' instead of 'researching'
      let nextPhase: SectionPhase = 'researching';
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
    const currentStates = stateRef.current.sectionStates;
    if (currentStates[section] === 'queued') return; // guard: can't navigate to queued sections
    setState((prev) => ({
      ...prev,
      currentSection: section,
    }));
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
