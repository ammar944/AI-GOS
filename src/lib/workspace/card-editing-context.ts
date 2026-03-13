'use client';

import { createContext, useContext } from 'react';

export interface CardEditingState {
  isEditing: boolean;
  draftContent: Record<string, unknown>;
  updateDraft: (patch: Record<string, unknown>) => void;
}

export const CardEditingContext = createContext<CardEditingState>({
  isEditing: false,
  draftContent: {},
  updateDraft: () => {},
});

export function useCardEditing() {
  return useContext(CardEditingContext);
}
