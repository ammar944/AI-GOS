'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { STORAGE_KEYS } from '@/lib/storage/local-storage';

interface ShellState {
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
}

interface ShellContextValue extends ShellState {
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

const isBrowser = typeof window !== 'undefined';

function readState(): ShellState | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHELL_STATE);
    return raw ? (JSON.parse(raw) as ShellState) : null;
  } catch {
    return null;
  }
}

function writeState(state: ShellState): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.SHELL_STATE, JSON.stringify(state));
  } catch { /* quota / private mode */ }
}

interface ShellProviderProps {
  children: ReactNode;
  defaultSidebarCollapsed?: boolean;
  defaultRightPanelCollapsed?: boolean;
}

export function ShellProvider({
  children,
  defaultSidebarCollapsed = false,
  defaultRightPanelCollapsed = false,
}: ShellProviderProps) {
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useState(defaultSidebarCollapsed);
  const [rightPanelCollapsed, setRightPanelCollapsedRaw] = useState(defaultRightPanelCollapsed);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = readState();
    if (saved) {
      setSidebarCollapsedRaw(saved.sidebarCollapsed);
      setRightPanelCollapsedRaw(saved.rightPanelCollapsed);
    }
  }, []);

  // Persist helper
  const persist = useCallback((sidebar: boolean, right: boolean) => {
    writeState({ sidebarCollapsed: sidebar, rightPanelCollapsed: right });
  }, []);

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsedRaw(v);
    setRightPanelCollapsedRaw(prev => { persist(v, prev); return prev; });
  }, [persist]);

  const setRightPanelCollapsed = useCallback((v: boolean) => {
    setRightPanelCollapsedRaw(v);
    setSidebarCollapsedRaw(prev => { persist(prev, v); return prev; });
  }, [persist]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedRaw(prev => {
      const next = !prev;
      setRightPanelCollapsedRaw(rp => { persist(next, rp); return rp; });
      return next;
    });
  }, [persist]);

  const toggleRightPanel = useCallback(() => {
    setRightPanelCollapsedRaw(prev => {
      const next = !prev;
      setSidebarCollapsedRaw(sb => { persist(sb, next); return sb; });
      return next;
    });
  }, [persist]);

  const value = useMemo<ShellContextValue>(() => ({
    sidebarCollapsed,
    rightPanelCollapsed,
    toggleSidebar,
    toggleRightPanel,
    setSidebarCollapsed,
    setRightPanelCollapsed,
  }), [sidebarCollapsed, rightPanelCollapsed, toggleSidebar, toggleRightPanel, setSidebarCollapsed, setRightPanelCollapsed]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}

export function useOptionalShell(): ShellContextValue | null {
  return useContext(ShellContext);
}
