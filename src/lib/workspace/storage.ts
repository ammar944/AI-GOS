import { STORAGE_KEYS } from '@/lib/storage/local-storage';
import type { WorkspaceState } from './types';

export function loadWorkspaceState(sessionId: string): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKSPACE_STATE);
    if (!raw) return null;
    const state = JSON.parse(raw) as WorkspaceState;
    if (state.sessionId !== sessionId) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveWorkspaceState(state: WorkspaceState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_STATE, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function clearWorkspaceState(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.WORKSPACE_STATE);
  } catch {
    // ignore
  }
}
