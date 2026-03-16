# Artifact-First Research Workspace — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chat-first journey UI with an artifact-first research workspace where card-based research artifacts occupy center stage and chat is a scoped right-rail editing surface.

**Architecture:** New `WorkspaceProvider` context manages workspace state (section pipeline, card states, snapshots). The existing `useResearchRealtime` hook feeds research results into card arrays. The layout flips from chat-center to 60/40 artifact-canvas + right-rail. No backend changes.

**Tech Stack:** React 19, Next.js 15, Framer Motion, Tailwind CSS v4, shadcn/ui, Vaul (bottom sheet), existing Vercel AI SDK `useChat`

**Spec:** `docs/superpowers/specs/2026-03-13-artifact-workspace-design.md`

---

## File Map

### New Files

| Path | Purpose |
|------|---------|
| `src/lib/workspace/types.ts` | WorkspaceState, CardState, CardSnapshot, SectionKey, SectionPhase type definitions |
| `src/lib/workspace/pipeline.ts` | SECTION_PIPELINE ordered array, section ordering helpers, next-section logic |
| `src/lib/workspace/card-taxonomy.ts` | `parseResearchToCards(section, data)` — maps raw research JSON to CardState[] per section |
| `src/lib/workspace/use-workspace.ts` | `useWorkspace()` hook — reads/writes WorkspaceState from context |
| `src/lib/workspace/storage.ts` | localStorage persistence for WorkspaceState (keyed by sessionId) |
| `src/lib/workspace/__tests__/pipeline.test.ts` | Tests for section ordering and next-section logic |
| `src/lib/workspace/__tests__/card-taxonomy.test.ts` | Tests for research-to-card parsing (all 6 sections) |
| `src/lib/workspace/__tests__/storage.test.ts` | Tests for workspace localStorage persistence |
| `src/components/workspace/workspace-provider.tsx` | React context provider for WorkspaceState |
| `src/components/workspace/workspace-page.tsx` | Main workspace layout — 60/40 split, renders StatusStrip + ArtifactCanvas + RightRail |
| `src/components/workspace/status-strip.tsx` | Top bar — section indicator dot, progress bar, worker status badge |
| `src/components/workspace/artifact-canvas.tsx` | Center panel — SectionHeader + CardGrid + ArtifactFooter |
| `src/components/workspace/card-grid.tsx` | Responsive grid for ArtifactCard[] |
| `src/components/workspace/artifact-card.tsx` | Card wrapper — glass surface, toolbar (edit/approve/history), edit mode, snapshot dropdown |
| `src/components/workspace/artifact-footer.tsx` | Canvas bottom — Edit (secondary) + Looks Good (primary CTA) buttons |
| `src/components/workspace/section-header.tsx` | Section label + accent color indicator |
| `src/components/workspace/right-rail.tsx` | Right panel — rail header, chat thread placeholder, Looks Good button, chat input |
| `src/components/workspace/bottom-sheet.tsx` | Mobile chat — collapsed/partial/expanded states |
| `src/components/workspace/cards/stat-grid.tsx` | N stats in responsive grid |
| `src/components/workspace/cards/bullet-list.tsx` | Title + accent-colored bullet items |
| `src/components/workspace/cards/check-list.tsx` | Title + checkmark items |
| `src/components/workspace/cards/prose-card.tsx` | Title + paragraph, glass surface |
| `src/components/workspace/cards/trend-card.tsx` | Direction badge + trend name + evidence |
| `src/components/workspace/cards/verdict-card.tsx` | Status badge + reasoning |
| `src/components/workspace/cards/competitor-card.tsx` | Full competitor profile |
| `src/components/workspace/cards/gap-card.tsx` | Gap + scores + evidence |
| `src/components/workspace/cards/flag-card.tsx` | Issue + severity/priority |
| `src/components/workspace/cards/insight-card.tsx` | Source badge + insight + implication |
| `src/components/workspace/cards/platform-card.tsx` | Platform + role + budget |
| `src/components/workspace/cards/angle-card.tsx` | Angle + hook + evidence |
| `src/components/workspace/cards/chart-card.tsx` | Title + description + image |
| `src/components/workspace/cards/pricing-card.tsx` | Pricing stats + viability |
| `src/components/workspace/cards/strategy-card.tsx` | Angle + lead rec + differentiator |

### Modified Files

| Path | Change |
|------|--------|
| `src/lib/journey/section-meta.ts` | Swap `keywordIntel` moduleNumber to `05`, `crossAnalysis` to `06` |
| `src/lib/storage/local-storage.ts` | Add `WORKSPACE_STATE` to `STORAGE_KEYS` |
| `src/app/journey/page.tsx` | Add workspace phase conditional — when `phase === 'workspace'`, render `WorkspacePage` instead of chat layout |

---

## Chunk 1: Sprint 1 — Foundation (State + Layout Shell)

### Task 1.1: Workspace Types

**Files:**
- Create: `src/lib/workspace/types.ts`

- [ ] **Step 1: Create type definitions**

```typescript
// src/lib/workspace/types.ts

export type SectionKey =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'keywordIntel'
  | 'crossAnalysis';

export type SectionPhase =
  | 'queued'
  | 'researching'
  | 'streaming'
  | 'review'
  | 'approved'
  | 'error';

export interface CardSnapshot {
  content: Record<string, unknown>;
  editedBy: 'user' | 'ai';
  timestamp: number;
}

export interface CardState {
  id: string;
  sectionKey: SectionKey;
  cardType: string;
  label: string;
  content: Record<string, unknown>;
  status: 'draft' | 'edited' | 'approved';
  versions: CardSnapshot[];
}

export interface WorkspaceState {
  sessionId: string;
  phase: 'onboarding' | 'workspace';
  currentSection: SectionKey;
  sectionStates: Record<SectionKey, SectionPhase>;
  sectionErrors: Partial<Record<SectionKey, string>>;
  cards: Record<string, CardState>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/workspace/types.ts
git commit -m "feat(workspace): add workspace state type definitions"
```

---

### Task 1.2: Section Pipeline + Tests

**Files:**
- Create: `src/lib/workspace/pipeline.ts`
- Create: `src/lib/workspace/__tests__/pipeline.test.ts`
- Modify: `src/lib/journey/section-meta.ts`

- [ ] **Step 1: Write failing tests for pipeline ordering**

```typescript
// src/lib/workspace/__tests__/pipeline.test.ts
import { describe, it, expect } from 'vitest';
import {
  SECTION_PIPELINE,
  getNextSection,
  getSectionIndex,
  isFinalSection,
} from '../pipeline';

describe('SECTION_PIPELINE', () => {
  it('has 6 sections in correct order', () => {
    expect(SECTION_PIPELINE).toEqual([
      'industryMarket',
      'competitors',
      'icpValidation',
      'offerAnalysis',
      'keywordIntel',
      'crossAnalysis',
    ]);
  });
});

describe('getNextSection', () => {
  it('returns competitors after industryMarket', () => {
    expect(getNextSection('industryMarket')).toBe('competitors');
  });

  it('returns null after crossAnalysis (last section)', () => {
    expect(getNextSection('crossAnalysis')).toBeNull();
  });

  it('returns crossAnalysis after keywordIntel', () => {
    expect(getNextSection('keywordIntel')).toBe('crossAnalysis');
  });
});

describe('getSectionIndex', () => {
  it('returns 0 for industryMarket', () => {
    expect(getSectionIndex('industryMarket')).toBe(0);
  });

  it('returns 5 for crossAnalysis', () => {
    expect(getSectionIndex('crossAnalysis')).toBe(5);
  });
});

describe('isFinalSection', () => {
  it('returns true for crossAnalysis', () => {
    expect(isFinalSection('crossAnalysis')).toBe(true);
  });

  it('returns false for industryMarket', () => {
    expect(isFinalSection('industryMarket')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/workspace/__tests__/pipeline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pipeline module**

```typescript
// src/lib/workspace/pipeline.ts
import type { SectionKey } from './types';

export const SECTION_PIPELINE: SectionKey[] = [
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
  'keywordIntel',
  'crossAnalysis',
];

export function getNextSection(current: SectionKey): SectionKey | null {
  const index = SECTION_PIPELINE.indexOf(current);
  if (index === -1 || index === SECTION_PIPELINE.length - 1) return null;
  return SECTION_PIPELINE[index + 1];
}

export function getSectionIndex(section: SectionKey): number {
  return SECTION_PIPELINE.indexOf(section);
}

export function isFinalSection(section: SectionKey): boolean {
  return section === SECTION_PIPELINE[SECTION_PIPELINE.length - 1];
}

export function createInitialSectionStates(): Record<SectionKey, import('./types').SectionPhase> {
  const states = {} as Record<SectionKey, import('./types').SectionPhase>;
  for (const key of SECTION_PIPELINE) {
    states[key] = 'queued';
  }
  return states;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/workspace/__tests__/pipeline.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Update section-meta.ts module numbers**

In `src/lib/journey/section-meta.ts`, swap:
- `keywordIntel` moduleNumber: `'05'` (was `'06'`)
- `crossAnalysis` moduleNumber: `'06'` (was `'05'`)
- Leave `mediaPlan: '07'` entry unchanged (deferred, not deleted)

- [ ] **Step 6: Commit**

```bash
git add src/lib/workspace/pipeline.ts src/lib/workspace/__tests__/pipeline.test.ts src/lib/workspace/types.ts src/lib/journey/section-meta.ts
git commit -m "feat(workspace): add section pipeline with ordering + update section-meta module numbers"
```

---

### Task 1.3: Workspace Storage + Tests

**Files:**
- Create: `src/lib/workspace/storage.ts`
- Create: `src/lib/workspace/__tests__/storage.test.ts`
- Modify: `src/lib/storage/local-storage.ts`

- [ ] **Step 1: Add WORKSPACE_STATE to STORAGE_KEYS**

In `src/lib/storage/local-storage.ts`, add to the `STORAGE_KEYS` object:

```typescript
WORKSPACE_STATE: "aigog_workspace_state",
```

- [ ] **Step 2: Write failing tests for workspace storage**

```typescript
// src/lib/workspace/__tests__/storage.test.ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/workspace/__tests__/storage.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement storage module**

```typescript
// src/lib/workspace/storage.ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/workspace/__tests__/storage.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/workspace/storage.ts src/lib/workspace/__tests__/storage.test.ts src/lib/storage/local-storage.ts
git commit -m "feat(workspace): add workspace localStorage persistence keyed by sessionId"
```

---

### Task 1.4: WorkspaceProvider

**Files:**
- Create: `src/components/workspace/workspace-provider.tsx`
- Create: `src/lib/workspace/use-workspace.ts`

- [ ] **Step 1: Create useWorkspace hook and context**

```typescript
// src/lib/workspace/use-workspace.ts
import { useContext } from 'react';
import { WorkspaceContext } from '@/components/workspace/workspace-provider';

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}
```

- [ ] **Step 2: Create WorkspaceProvider**

```typescript
// src/components/workspace/workspace-provider.tsx
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
  approveSection: () => SectionKey | null; // returns next section or null if final
  restoreCardVersion: (cardId: string, versionIndex: number) => void;
}

export const WorkspaceContext = createContext<WorkspaceActions | null>(null);

interface WorkspaceProviderProps {
  sessionId: string;
  children: React.ReactNode;
}

function createFreshState(sessionId: string): WorkspaceState {
  return {
    sessionId,
    phase: 'onboarding',
    currentSection: SECTION_PIPELINE[0],
    sectionStates: createInitialSectionStates(),
    sectionErrors: {},
    cards: {},
  };
}

export function WorkspaceProvider({ sessionId, children }: WorkspaceProviderProps) {
  const [state, setState] = useState<WorkspaceState>(() => {
    return loadWorkspaceState(sessionId) ?? createFreshState(sessionId);
  });

  // Persist on every state change
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
      // Mark all cards in current section as approved
      const updatedCards = { ...prev.cards };
      for (const [id, card] of Object.entries(updatedCards)) {
        if (card.sectionKey === current) {
          updatedCards[id] = { ...card, status: 'approved' };
        }
      }

      return {
        ...prev,
        sectionStates: {
          ...prev.sectionStates,
          [current]: 'approved',
          ...(next ? { [next]: 'researching' } : {}),
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

  const actions: WorkspaceActions = {
    state,
    enterWorkspace,
    setSectionPhase,
    setCards,
    updateCard,
    approveCard,
    approveSection,
    restoreCardVersion,
  };

  return (
    <WorkspaceContext.Provider value={actions}>
      {children}
    </WorkspaceContext.Provider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/workspace-provider.tsx src/lib/workspace/use-workspace.ts
git commit -m "feat(workspace): add WorkspaceProvider context with all state actions"
```

---

### Task 1.5: StatusStrip Component

**Files:**
- Create: `src/components/workspace/status-strip.tsx`

- [ ] **Step 1: Build StatusStrip**

```typescript
// src/components/workspace/status-strip.tsx
'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_PIPELINE, getSectionIndex } from '@/lib/workspace/pipeline';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { springs } from '@/lib/motion';

export function StatusStrip() {
  const { state } = useWorkspace();
  const currentIndex = getSectionIndex(state.currentSection);
  const approvedCount = SECTION_PIPELINE.filter(
    (key) => state.sectionStates[key] === 'approved',
  ).length;
  const meta = SECTION_META[state.currentSection] ?? DEFAULT_SECTION_META;
  const isActive = state.sectionStates[state.currentSection] === 'researching'
    || state.sectionStates[state.currentSection] === 'streaming';

  return (
    <div className="flex h-11 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4">
      {/* Section indicator */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            isActive && 'animate-pulse',
          )}
          style={{
            backgroundColor: isActive
              ? 'var(--accent-blue)'
              : state.sectionStates[state.currentSection] === 'review'
                ? 'var(--accent-green)'
                : 'var(--text-tertiary)',
          }}
        />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {meta.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 mx-4">
        <div className="h-1 rounded-full bg-[var(--bg-hover)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--brand-sky)]"
            initial={false}
            animate={{ width: `${((approvedCount + (state.sectionStates[state.currentSection] === 'review' ? 0.5 : 0)) / SECTION_PIPELINE.length) * 100}%` }}
            transition={springs.snappy}
          />
        </div>
      </div>

      {/* Section count */}
      <span className="text-xs font-mono text-[var(--text-tertiary)]">
        {currentIndex + 1} of {SECTION_PIPELINE.length}
      </span>

      {/* Worker status */}
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider',
          isActive
            ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
            : 'bg-white/5 text-[var(--text-tertiary)]',
        )}
      >
        {isActive ? 'Working' : 'Idle'}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workspace/status-strip.tsx
git commit -m "feat(workspace): add StatusStrip with progress bar and worker state"
```

---

### Task 1.6: Layout Shell (WorkspacePage + ArtifactCanvas + RightRail)

**Files:**
- Create: `src/components/workspace/section-header.tsx`
- Create: `src/components/workspace/artifact-footer.tsx`
- Create: `src/components/workspace/artifact-canvas.tsx`
- Create: `src/components/workspace/right-rail.tsx`
- Create: `src/components/workspace/workspace-page.tsx`

- [ ] **Step 1: Create SectionHeader**

```typescript
// src/components/workspace/section-header.tsx
'use client';

import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import type { SectionKey } from '@/lib/workspace/types';

interface SectionHeaderProps {
  section: SectionKey;
}

export function SectionHeader({ section }: SectionHeaderProps) {
  const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;

  return (
    <div className="mb-6">
      <span className="text-xs font-mono text-[var(--accent-blue)] uppercase tracking-widest">
        {meta.moduleNumber} · {meta.label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create ArtifactFooter**

```typescript
// src/components/workspace/artifact-footer.tsx
'use client';

import { cn } from '@/lib/utils';

interface ArtifactFooterProps {
  onApprove: () => void;
  disabled?: boolean;
}

export function ArtifactFooter({ onApprove, disabled }: ArtifactFooterProps) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] px-6 py-4">
      <button
        type="button"
        onClick={onApprove}
        disabled={disabled}
        className={cn(
          'rounded-[var(--radius-md)] bg-[var(--accent-blue)] px-5 py-2.5',
          'text-sm font-medium text-white',
          'transition-colors hover:bg-[var(--accent-blue)]/90',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        Looks good &rarr;
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create ArtifactCanvas shell**

```typescript
// src/components/workspace/artifact-canvas.tsx
'use client';

import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SectionHeader } from './section-header';
import { ArtifactFooter } from './artifact-footer';
// Note: ArtifactLoading is NOT exported from artifact-panel.tsx.
// Use an inline loading placeholder here. If a shared loading component is
// needed later, extract one in a follow-up sprint.

export function ArtifactCanvas() {
  const { state, approveSection } = useWorkspace();
  const phase = state.sectionStates[state.currentSection];
  const isReviewable = phase === 'review';
  const isLoading = phase === 'researching' || phase === 'streaming';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 pt-6 custom-scrollbar">
        <SectionHeader section={state.currentSection} />

        {isLoading && (
          <div className="flex flex-1 items-center justify-center min-h-[400px]">
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              Researching...
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-1 items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-sm text-[var(--accent-red)]">Research failed</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {state.sectionErrors[state.currentSection] ?? 'Unknown error'}
              </p>
            </div>
          </div>
        )}

        {isReviewable && (
          <div className="text-sm text-[var(--text-tertiary)]">
            {/* CardGrid will be rendered here in Sprint 2 */}
            <p>Cards will render here</p>
          </div>
        )}
      </div>

      {isReviewable && <ArtifactFooter onApprove={approveSection} />}
    </div>
  );
}
```

- [ ] **Step 4: Create RightRail shell**

```typescript
// src/components/workspace/right-rail.tsx
'use client';

import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';

export function RightRail() {
  const { state, approveSection } = useWorkspace();
  const meta = SECTION_META[state.currentSection] ?? DEFAULT_SECTION_META;
  const isReviewable = state.sectionStates[state.currentSection] === 'review';

  return (
    <div className="flex w-[40%] flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-chat)]">
      {/* Rail header */}
      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        <span className="text-xs font-mono text-[var(--text-tertiary)]">
          Chat &middot; {meta.label}
        </span>
      </div>

      {/* Chat thread placeholder */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        <p className="text-xs text-[var(--text-quaternary)]">
          Ask questions about this section...
        </p>
      </div>

      {/* Looks good + input */}
      <div className="border-t border-[var(--border-subtle)] p-4 space-y-3">
        {isReviewable && (
          <button
            type="button"
            onClick={approveSection}
            className={cn(
              'w-full rounded-[var(--radius-md)] bg-[var(--accent-blue)] px-4 py-2',
              'text-sm font-medium text-white',
              'transition-colors hover:bg-[var(--accent-blue)]/90',
            )}
          >
            Looks good &rarr;
          </button>
        )}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
          <span className="text-xs text-[var(--text-quaternary)]">
            Ask about this section...
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create WorkspacePage layout**

```typescript
// src/components/workspace/workspace-page.tsx
'use client';

import { StatusStrip } from './status-strip';
import { ArtifactCanvas } from './artifact-canvas';
import { RightRail } from './right-rail';

export function WorkspacePage() {
  return (
    <div className="flex h-screen flex-col bg-[var(--bg-base)]">
      <StatusStrip />
      <div className="flex flex-1 overflow-hidden">
        <ArtifactCanvas />
        {/* Right rail hidden on mobile, shown on md+ */}
        <div className="hidden md:flex">
          <RightRail />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/
git commit -m "feat(workspace): add layout shell — WorkspacePage, ArtifactCanvas, RightRail, StatusStrip"
```

---

### Task 1.7: Wire Workspace into Journey Page

**Files:**
- Modify: `src/app/journey/page.tsx`

- [ ] **Step 1: Add workspace phase conditional**

At the top of the journey page component (after existing imports), add:

```typescript
import { WorkspaceProvider } from '@/components/workspace/workspace-provider';
import { WorkspacePage } from '@/components/workspace/workspace-page';
```

Find where the `journeyPhase` state is declared. Add `'workspace'` to the phase union type if it's typed.

In the main render, add a condition BEFORE the existing phase switch:

```typescript
if (journeyPhase === 'workspace' || workspaceState?.phase === 'workspace') {
  return (
    <WorkspaceProvider sessionId={sessionId}>
      <WorkspacePage />
    </WorkspaceProvider>
  );
}
```

The exact insertion point depends on the current conditional rendering structure. The workspace view should fully replace the existing chat layout — no sidebar, no chat center.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (may have pre-existing warnings, no new errors)

- [ ] **Step 3: Manual check**

Run: `npm run dev`, navigate to `/journey`. Verify:
- Onboarding phases still work
- When forced to workspace phase (via React DevTools or temporary state), the 60/40 layout renders
- StatusStrip shows "01 · Market Overview" and progress bar
- RightRail shows placeholder chat

- [ ] **Step 4: Commit**

```bash
git add src/app/journey/page.tsx
git commit -m "feat(workspace): wire WorkspacePage into journey route with phase conditional"
```

---

## Chunk 2: Sprint 2 — Base Card Types + Market Overview

> **Card Visual Reference:** See `output/research-runners-audit.html` for the target visual quality. Adapt its clean, structured style (bordered cards, uppercase sub-headers, pill badges, generous spacing) to our dark theme using `glass-surface`, section accent colors, and existing token/font system. See spec Section 10 "Card Visual Language" for exact Tailwind class patterns.

### Task 2.1: StatGrid Card

**Files:**
- Create: `src/components/workspace/cards/stat-grid.tsx`

- [ ] **Step 1: Build StatGrid component**

```typescript
// src/components/workspace/cards/stat-grid.tsx
'use client';

import { cn } from '@/lib/utils';

export interface StatItem {
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
}

interface StatGridProps {
  stats: StatItem[];
  columns?: 2 | 3;
}

export function StatGrid({ stats, columns = 3 }: StatGridProps) {
  return (
    <div className={cn('grid gap-3', columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="glass-surface rounded-[var(--radius-md)] p-3"
        >
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">
            {stat.label}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
            {stat.value}
          </span>
          {stat.badge && (
            <span
              className="mt-1 block text-[10px] font-mono"
              style={{ color: stat.badgeColor ?? 'var(--accent-blue)' }}
            >
              {stat.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workspace/cards/stat-grid.tsx
git commit -m "feat(workspace): add StatGrid card component"
```

---

### Task 2.2: BulletList + CheckList + ProseCard

**Files:**
- Create: `src/components/workspace/cards/bullet-list.tsx`
- Create: `src/components/workspace/cards/check-list.tsx`
- Create: `src/components/workspace/cards/prose-card.tsx`

- [ ] **Step 1: Build BulletList**

```typescript
// src/components/workspace/cards/bullet-list.tsx
'use client';

interface BulletListProps {
  title: string;
  items: string[];
  accent?: string;
}

export function BulletList({ title, items, accent = 'var(--accent-blue)' }: BulletListProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            <span className="mt-1.5 shrink-0" style={{ color: accent }}>&bull;</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Build CheckList**

```typescript
// src/components/workspace/cards/check-list.tsx
'use client';

interface CheckListProps {
  title: string;
  items: string[];
  accent?: string;
}

export function CheckList({ title, items, accent = 'var(--accent-green)' }: CheckListProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            <span className="mt-1.5 shrink-0" style={{ color: accent }}>&#x2713;</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Build ProseCard**

```typescript
// src/components/workspace/cards/prose-card.tsx
'use client';

interface ProseCardProps {
  title: string;
  text: string;
}

export function ProseCard({ title, text }: ProseCardProps) {
  if (!text) return null;

  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-4">
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{text}</p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/cards/bullet-list.tsx src/components/workspace/cards/check-list.tsx src/components/workspace/cards/prose-card.tsx
git commit -m "feat(workspace): add BulletList, CheckList, ProseCard card components"
```

---

### Task 2.3: TrendCard

**Files:**
- Create: `src/components/workspace/cards/trend-card.tsx`

- [ ] **Step 1: Build TrendCard**

```typescript
// src/components/workspace/cards/trend-card.tsx
'use client';

import { cn } from '@/lib/utils';

interface TrendCardProps {
  trend: string;
  direction: string;
  evidence: string;
}

export function TrendCard({ trend, direction, evidence }: TrendCardProps) {
  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-3">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded',
            direction === 'rising' && 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
            direction === 'declining' && 'bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
            direction === 'stable' && 'bg-white/5 text-[var(--text-tertiary)]',
          )}
        >
          {direction}
        </span>
        <span className="text-sm font-medium text-[var(--text-primary)]">{trend}</span>
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">{evidence}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workspace/cards/trend-card.tsx
git commit -m "feat(workspace): add TrendCard component with direction badge"
```

---

### Task 2.4: ArtifactCard Wrapper + CardGrid

**Files:**
- Create: `src/components/workspace/artifact-card.tsx`
- Create: `src/components/workspace/card-grid.tsx`

- [ ] **Step 1: Build ArtifactCard wrapper**

```typescript
// src/components/workspace/artifact-card.tsx
'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CardState } from '@/lib/workspace/types';

interface ArtifactCardProps {
  card: CardState;
  children: React.ReactNode;
  index?: number;
}

export function ArtifactCard({ card, children, index = 0 }: ArtifactCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'rounded-[var(--radius-lg)] border p-5',
        'transition-colors duration-200',
        card.status === 'approved'
          ? 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/[0.02]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-card)]',
      )}
    >
      {/* Card toolbar (edit, approve, history icons) — intentionally deferred to Sprint 5.
          Per-card approval buttons are NOT rendered until Sprint 5. Only artifact-level
          "Looks good" approval is wired in Sprint 4. */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-wider">
          {card.label}
        </span>
      </div>

      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Build CardGrid**

```typescript
// src/components/workspace/card-grid.tsx
'use client';

interface CardGridProps {
  children: React.ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return (
    <div className="space-y-4 pb-8">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/artifact-card.tsx src/components/workspace/card-grid.tsx
git commit -m "feat(workspace): add ArtifactCard wrapper and CardGrid layout"
```

---

### Task 2.5: Card Taxonomy Parser + Tests

**Files:**
- Create: `src/lib/workspace/card-taxonomy.ts`
- Create: `src/lib/workspace/__tests__/card-taxonomy.test.ts`

- [ ] **Step 1: Write failing tests for industryMarket parsing**

```typescript
// src/lib/workspace/__tests__/card-taxonomy.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { parseResearchToCards, resetCardIdCounter } from '../card-taxonomy';

beforeEach(() => {
  resetCardIdCounter(); // Prevent non-deterministic IDs across parallel tests
});
import { parseResearchToCards } from '../card-taxonomy';

describe('parseResearchToCards — industryMarket', () => {
  const mockData = {
    categorySnapshot: {
      category: 'SaaS',
      marketSize: '$4.2B',
      marketMaturity: 'Growth',
      awarenessLevel: 'High',
      buyingBehavior: 'comparison_shopping',
      averageSalesCycle: '30 days',
    },
    painPoints: { primary: ['Pain 1', 'Pain 2'] },
    marketDynamics: {
      demandDrivers: ['Driver 1'],
      buyingTriggers: ['Trigger 1'],
      barriersToPurchase: ['Barrier 1'],
    },
    trendSignals: [
      { trend: 'AI adoption', direction: 'rising', evidence: 'Strong evidence' },
    ],
    messagingOpportunities: {
      summaryRecommendations: ['Rec 1', 'Rec 2'],
    },
  };

  it('creates correct number of cards', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    expect(cards.length).toBe(7);
  });

  it('creates StatGrid card for categorySnapshot', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    const statCard = cards.find((c) => c.cardType === 'stat-grid');
    expect(statCard).toBeDefined();
    expect(statCard!.label).toBe('Category Snapshot');
    expect(statCard!.content.stats).toHaveLength(6);
  });

  it('creates TrendCard for trendSignals', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    const trendCards = cards.filter((c) => c.cardType === 'trend-card');
    expect(trendCards).toHaveLength(1);
    expect(trendCards[0].content.trend).toBe('AI adoption');
  });

  it('assigns all cards to industryMarket section', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    expect(cards.every((c) => c.sectionKey === 'industryMarket')).toBe(true);
  });

  it('handles empty/missing data gracefully', () => {
    const cards = parseResearchToCards('industryMarket', {});
    expect(cards.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/workspace/__tests__/card-taxonomy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement card taxonomy parser (industryMarket)**

```typescript
// src/lib/workspace/card-taxonomy.ts
import type { CardState, SectionKey } from './types';

let cardIdCounter = 0;
function nextCardId(section: string, type: string): string {
  return `${section}-${type}-${++cardIdCounter}`;
}

// Reset counter (useful for tests)
export function resetCardIdCounter() {
  cardIdCounter = 0;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function makeCard(
  section: SectionKey,
  cardType: string,
  label: string,
  content: Record<string, unknown>,
): CardState {
  return {
    id: nextCardId(section, cardType),
    sectionKey: section,
    cardType,
    label,
    content,
    status: 'draft',
    versions: [],
  };
}

function parseIndustryMarket(data: Record<string, unknown>): CardState[] {
  const cards: CardState[] = [];
  const section: SectionKey = 'industryMarket';

  // Category Snapshot StatGrid
  const snapshot = asRecord(data.categorySnapshot);
  if (snapshot) {
    const stats = [
      { label: 'Category', value: asString(snapshot.category) },
      { label: 'Market Size', value: asString(snapshot.marketSize) },
      { label: 'Maturity', value: asString(snapshot.marketMaturity) },
      { label: 'Awareness', value: asString(snapshot.awarenessLevel) },
      { label: 'Buying Behavior', value: asString(snapshot.buyingBehavior)?.replaceAll('_', ' ') },
      { label: 'Sales Cycle', value: asString(snapshot.averageSalesCycle) },
    ].filter((s): s is { label: string; value: string } => s.value !== null);

    if (stats.length > 0) {
      cards.push(makeCard(section, 'stat-grid', 'Category Snapshot', { stats }));
    }
  }

  // Pain Points
  const painPoints = asRecord(data.painPoints);
  const painItems = asStringArray(painPoints?.primary);
  if (painItems.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Pain Points', {
      items: painItems,
      accent: 'var(--section-market)',
    }));
  }

  // Demand Drivers
  const dynamics = asRecord(data.marketDynamics);
  const drivers = asStringArray(dynamics?.demandDrivers);
  if (drivers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Demand Drivers', {
      items: drivers,
      accent: 'var(--section-market)',
    }));
  }

  // Buying Triggers
  const triggers = asStringArray(dynamics?.buyingTriggers);
  if (triggers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Buying Triggers', {
      items: triggers,
      accent: 'var(--section-market)',
    }));
  }

  // Barriers
  const barriers = asStringArray(dynamics?.barriersToPurchase);
  if (barriers.length > 0) {
    cards.push(makeCard(section, 'bullet-list', 'Barriers to Purchase', {
      items: barriers,
      accent: 'var(--section-market)',
    }));
  }

  // Trend Signals
  const trends = Array.isArray(data.trendSignals) ? data.trendSignals : [];
  for (const trend of trends) {
    const t = asRecord(trend);
    if (t && asString(t.trend)) {
      cards.push(makeCard(section, 'trend-card', 'Trend Signal', {
        trend: asString(t.trend)!,
        direction: asString(t.direction) ?? 'stable',
        evidence: asString(t.evidence) ?? '',
      }));
    }
  }

  // Messaging Opportunities
  const messaging = asRecord(data.messagingOpportunities);
  const recs = asStringArray(messaging?.summaryRecommendations);
  if (recs.length > 0) {
    cards.push(makeCard(section, 'check-list', 'Messaging Opportunities', {
      items: recs,
      accent: 'var(--accent-green)',
    }));
  }

  return cards;
}

export function parseResearchToCards(
  section: SectionKey,
  data: Record<string, unknown>,
): CardState[] {
  switch (section) {
    case 'industryMarket':
      return parseIndustryMarket(data);
    // Remaining sections added in Sprint 3
    default:
      return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/workspace/__tests__/card-taxonomy.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/workspace/card-taxonomy.ts src/lib/workspace/__tests__/card-taxonomy.test.ts
git commit -m "feat(workspace): add card taxonomy parser for industryMarket section"
```

---

### Task 2.6: Wire Research Data → Cards in ArtifactCanvas

**Files:**
- Modify: `src/components/workspace/artifact-canvas.tsx`

- [ ] **Step 1: Update ArtifactCanvas to render real cards**

Import card components and `useWorkspace`. When section phase is `review`, iterate over cards for the current section and render each based on `cardType`:

- `stat-grid` → `<StatGrid stats={card.content.stats} />`
- `bullet-list` → `<BulletList title={card.label} items={card.content.items} accent={card.content.accent} />`
- `check-list` → `<CheckList title={card.label} items={card.content.items} accent={card.content.accent} />`
- `prose-card` → `<ProseCard title={card.label} text={card.content.text} />`
- `trend-card` → `<TrendCard trend={card.content.trend} direction={card.content.direction} evidence={card.content.evidence} />`

Each wrapped in `<ArtifactCard card={card} index={i}>`.

- [ ] **Step 2: Wire useResearchRealtime → parseResearchToCards → setCards**

In `WorkspacePage` (or a parent component that has access to the workspace context), add the bridge:

When `useResearchRealtime` fires `onSectionComplete(section, result)`:
1. Call `parseResearchToCards(section, result.data)`
2. Call `setCards(section, cards)`
3. Call `setSectionPhase(section, 'review')`

This reuses the existing Supabase polling hook.

- [ ] **Step 3: Verify with real data**

Run the dev server. Start a journey session that has `industryMarket` research results in Supabase. Navigate to workspace phase. Verify:
- Cards render with real market data
- StatGrid shows category, market size, maturity, etc.
- BulletLists show pain points, drivers, triggers
- TrendCards show with direction badges

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/artifact-canvas.tsx src/components/workspace/workspace-page.tsx
git commit -m "feat(workspace): wire research data to card rendering for Market Overview"
```

---

## Chunk 3: Sprint 3a — Competitor + ICP Card Types

### Task 3.1: Competitor Intel Cards

**Files:**
- Create: `src/components/workspace/cards/competitor-card.tsx`
- Create: `src/components/workspace/cards/gap-card.tsx`
- Modify: `src/lib/workspace/card-taxonomy.ts`

- [ ] **Step 1: Build CompetitorCard**

Port the competitor rendering logic from `CompetitorIntelDocument` in `artifact-panel.tsx` (lines 431-580). The card should render: name, website, positioning, price/pricingConfidence stats, strengths/weaknesses/opportunities lists, ourAdvantage prose, ad activity section (activeAdCount, coverage, platforms, themes, evidence), adCreatives via existing `CompetitorAdEvidence` component (import from `@/components/journey/competitor-ad-evidence`), libraryLinks (metaLibraryUrl, linkedInLibraryUrl, googleAdvertiserUrl), threatAssessment (topAdHooks, counterPositioning).

Use existing card primitives: `StatGrid` for price stats, `BulletList` for S/W/O lists. Reuse `CompetitorAdEvidence` as-is — pass `adActivity`, `adCreatives[]`, and `libraryLinks` props directly from parsed competitor data.

- [ ] **Step 2: Build GapCard**

```typescript
// src/components/workspace/cards/gap-card.tsx
// Renders: gap name + type badge + evidence + exploitability/impact StatGrid + recommendedAction
```

Port from `artifact-panel.tsx` white-space gaps renderer (lines 546-590).

- [ ] **Step 3: Add competitors parser to card-taxonomy.ts**

Add `parseCompetitorIntel(data)` function. Creates:
- One `CompetitorCard` per `data.competitors[]` entry
- One `BulletList` for `data.marketPatterns`
- One `GapCard` per `data.whiteSpaceGaps[]` entry

Wire into the `switch` statement in `parseResearchToCards`.

- [ ] **Step 4: Write tests for competitors parsing**

Add to `card-taxonomy.test.ts`. Test with mock competitor data. The mock MUST include:
- `adCreatives[]` with all 12 fields: `{platform, id, advertiser, headline, body, imageUrl, videoUrl, format, isActive, detailsUrl, firstSeen, lastSeen}`
- `libraryLinks` with all 3 fields: `{metaLibraryUrl, linkedInLibraryUrl, googleAdvertiserUrl}`
- `threatAssessment.{topAdHooks[], counterPositioning}`

Verify assertions:
- Correct card count (N competitor cards + 1 market patterns bullet + N gap cards)
- Each CompetitorCard content includes `adCreatives` array with all 12 fields preserved
- Each CompetitorCard content includes `libraryLinks` with all 3 URL fields preserved
- `threatAssessment.topAdHooks` and `threatAssessment.counterPositioning` are extracted correctly

- [ ] **Step 5: Run tests**

Run: `npm run test:run -- src/lib/workspace/__tests__/card-taxonomy.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/cards/competitor-card.tsx src/components/workspace/cards/gap-card.tsx src/lib/workspace/card-taxonomy.ts src/lib/workspace/__tests__/card-taxonomy.test.ts
git commit -m "feat(workspace): add Competitor Intel card types and taxonomy parser"
```

---

### Task 3.2: ICP Validation Cards

**Files:**
- Create: `src/components/workspace/cards/verdict-card.tsx`
- Modify: `src/lib/workspace/card-taxonomy.ts`

- [ ] **Step 1: Build VerdictCard**

```typescript
// src/components/workspace/cards/verdict-card.tsx
// Status badge (colored by status) + reasoning prose
```

Port from `ICPValidationDocument` final verdict rendering (lines 616-632).

- [ ] **Step 2: Add icpValidation parser to card-taxonomy.ts**

Creates: StatGrid (persona, audience, confidence, demographics), VerdictCard, ProseCard (decision process), BulletLists (channels, triggers, objections), CheckList (recommendations).

- [ ] **Step 3: Write tests + verify**

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/cards/verdict-card.tsx src/lib/workspace/card-taxonomy.ts src/lib/workspace/__tests__/card-taxonomy.test.ts
git commit -m "feat(workspace): add ICP Validation card types and taxonomy parser"
```

---

- [ ] **Build check for Sprint 3a**

Run: `npm run build`
Expected: Passes

---

## Chunk 4: Sprint 3b — Offer + Keywords + Synthesis Card Types

### Task 3.3: Offer Analysis Cards

**Files:**
- Create: `src/components/workspace/cards/pricing-card.tsx`
- Create: `src/components/workspace/cards/flag-card.tsx`
- Modify: `src/lib/workspace/card-taxonomy.ts`

- [ ] **Step 1: Build PricingCard**

Renders: currentPricing, marketBenchmark, pricingPosition as StatGrid + coldTrafficViability prose. Port from `OfferAnalysisDocument` pricing section (lines 689-711).

- [ ] **Step 2: Build FlagCard**

Renders: issue headline + severity/priority StatGrid + evidence + recommendedAction. Port from `OfferAnalysisDocument` red flags (lines 733-769).

- [ ] **Step 3: Add offerAnalysis parser**

Creates: StatGrid (score, status), ProseCard (rationale), PricingCard, BulletLists (strengths, weaknesses, actions, messaging), ProseCard (market fit), FlagCards.

- [ ] **Step 4: Tests + commit**

```bash
git commit -m "feat(workspace): add Offer Analysis card types and taxonomy parser"
```

---

### Task 3.4: Keywords + Strategic Synthesis Cards

**Files:**
- Create: `src/components/workspace/cards/strategy-card.tsx`
- Create: `src/components/workspace/cards/insight-card.tsx`
- Create: `src/components/workspace/cards/platform-card.tsx`
- Create: `src/components/workspace/cards/angle-card.tsx`
- Create: `src/components/workspace/cards/chart-card.tsx`
- Modify: `src/lib/workspace/card-taxonomy.ts`

- [ ] **Step 1: Keywords parser — wrap JourneyKeywordIntelDetail**

The `keywordIntel` parser creates a single card with `cardType: 'keyword-grid'`. The canvas renderer detects this type and renders `<JourneyKeywordIntelDetail>` directly, passing the raw data.

- [ ] **Step 2: Build StrategyCard**

Renders: recommendedAngle as headline, leadRecommendation as prose, keyDifferentiator in a highlighted block. Port from `CrossAnalysisDocument` positioning (lines 806-823).

- [ ] **Step 3: Build InsightCard, PlatformCard, AngleCard, ChartCard**

Each is a small focused component ported from `CrossAnalysisDocument` (lines 892-985).

- `InsightCard`: source badge + insight headline + implication
- `PlatformCard`: platform name + role badge + budgetAllocation + rationale
- `AngleCard`: angle title + exampleHook + evidence
- `ChartCard`: title + description + `<img>` for imageUrl

- [ ] **Step 4: Add crossAnalysis parser**

Creates: StrategyCard, StatGrid (planning context), ChartCards, ProseCard (narrative), InsightCards, PlatformCards, AngleCards, CheckLists (success factors, next steps).

- [ ] **Step 5: Write tests for all remaining sections**

Add test cases for `competitors`, `icpValidation`, `offerAnalysis`, `keywordIntel`, `crossAnalysis` in `card-taxonomy.test.ts`.

- [ ] **Step 6: Run all tests**

Run: `npm run test:run -- src/lib/workspace/__tests__/card-taxonomy.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Update ArtifactCanvas card renderer**

Add the new card type cases to the renderer switch: `competitor-card`, `gap-card`, `verdict-card`, `pricing-card`, `flag-card`, `strategy-card`, `insight-card`, `platform-card`, `angle-card`, `chart-card`, `keyword-grid`.

- [ ] **Step 8: Build check**

Run: `npm run build`
Expected: Passes

- [ ] **Step 9: Commit**

```bash
git add src/components/workspace/cards/ src/lib/workspace/card-taxonomy.ts src/lib/workspace/__tests__/card-taxonomy.test.ts src/components/workspace/artifact-canvas.tsx
git commit -m "feat(workspace): add all remaining card types and section parsers"
```

---

## Chunk 5: Sprint 4 — Approval Flow + Morph Transition

### Task 4.1: Section Approval Logic

**Files:**
- Modify: `src/components/workspace/artifact-footer.tsx`
- Modify: `src/components/workspace/right-rail.tsx`
- Modify: `src/components/workspace/workspace-provider.tsx`

- [ ] **Step 1: Connect Looks Good to approveSection**

Both `ArtifactFooter` and `RightRail` already call `approveSection()`. Verify this:
1. Marks all current section cards as approved
2. Sets current section to `approved`
3. Sets next section to `researching`
4. Advances `currentSection` to the next one

If next section already has research data in Supabase (pre-fetched), immediately parse cards and set to `review`.

- [ ] **Step 2: Handle auto-advance for pre-fetched sections**

In the `onSectionComplete` callback (where `useResearchRealtime` fires), if the section result arrives for a section that's currently `researching`, parse cards and advance to `review`. This handles the case where research completes while the user is still reviewing a previous section.

- [ ] **Step 3: Handle final section approval**

When `crossAnalysis` is approved and there's no next section, show a completion state in ArtifactCanvas (e.g., "All sections reviewed" message).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(workspace): wire approval logic with auto-advance for pre-fetched sections"
```

---

### Task 4.2: Morph Transition Animation

**Files:**
- Modify: `src/components/workspace/artifact-canvas.tsx`
- Modify: `src/components/workspace/status-strip.tsx`

- [ ] **Step 1: Add AnimatePresence to ArtifactCanvas**

Wrap the card grid in `<AnimatePresence mode="wait">` keyed by `state.currentSection`. This triggers exit animations on section change.

Timing constants (from spec Section 14):
- Status strip progress bar: `springs.snappy`, ~300ms
- Card stagger-out: 0.05s per card, 200ms duration, `{ opacity: 0, y: -8 }`
- **100ms pause** between stagger-out completion and new section header fade-in
- Card stagger-in: 0.05s per card, 200ms duration, `{ opacity: 0, y: 8 }` → `{ opacity: 1, y: 0 }`

Use `onExitComplete` on `AnimatePresence` to insert the 100ms pause via `setTimeout` before entering the new section's cards.

- [ ] **Step 2: Add spring animation to StatusStrip progress bar**

Already using `motion.div` with `springs.snappy` (~300ms). Verify the progress bar smoothly animates when section count changes.

- [ ] **Step 3: Section label crossfade in StatusStrip**

Wrap section label in `<AnimatePresence mode="wait">` keyed by `state.currentSection`. Exit: `{ opacity: 0 }`. Enter: `{ opacity: 1 }`. Duration: 200ms.

- [ ] **Step 4: Manual testing**

Navigate through sections 1 → 2 → 3 verifying:
- Cards stagger out upward
- Brief pause
- New section label fades in
- New cards stagger in from below
- Progress bar animates

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(workspace): add morph transition with staggered card animations"
```

---

### Task 4.3: Error State + Retry

**Files:**
- Modify: `src/components/workspace/artifact-canvas.tsx`

- [ ] **Step 1: Render error state with retry**

When section phase is `error`, show:
- Error message from `state.sectionErrors[section]`
- "Retry" button that sets the section back to `researching`

The retry just resets the UI state — the research worker may already be retrying (dispatch has 3x retry built in). If the worker has given up, the user would need to restart from the onboarding.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(workspace): add error state display with retry in ArtifactCanvas"
```

---

## Chunk 6: Sprint 5 — Inline Editing + Card Snapshots

### Task 5.1: Inline Edit Mode on ArtifactCard

**Files:**
- Modify: `src/components/workspace/artifact-card.tsx`

- [ ] **Step 1: Add edit state to ArtifactCard**

Add `isEditing` local state. When `isEditing`, render an edit toolbar button (pencil icon). On click → set `isEditing: true`.

The card wrapper adds a blue border `border-[var(--border-focus)]` and shows Save/Cancel buttons.

Pass `isEditing` down to child card components so they can switch to editable mode.

- [ ] **Step 2: Create editable variants for card primitives**

For `StatGrid`: each value becomes an `<input>` with the same styling.
For `BulletList` / `CheckList`: each item text becomes `contentEditable`.
For `ProseCard`: the paragraph becomes `contentEditable`.

On save (blur/Enter): collect all edited values, call `updateCard(cardId, newContent, 'user')`.
On cancel (Escape): revert to original content.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(workspace): add inline edit mode to ArtifactCard and card primitives"
```

---

### Task 5.2: Card Snapshot History

**Files:**
- Modify: `src/components/workspace/artifact-card.tsx`

- [ ] **Step 1: Add history dropdown to card toolbar**

Clock icon in toolbar. On click → dropdown showing version list:
- Timestamp formatted as relative time ("2m ago", "5m ago")
- `editedBy` badge: "You" or "AI"
- Click → call `restoreCardVersion(cardId, index)`

Use existing Radix `DropdownMenu` from shadcn/ui.

- [ ] **Step 2: Add card-level approve button**

Checkmark icon in toolbar. On click → call `approveCard(cardId)`. Card gets green border.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(workspace): add card snapshot history dropdown and card-level approve"
```

---

## Chunk 7: Sprint 6 — Right Rail Chat

### Task 6.1: Scoped Chat with useChat

**Files:**
- Modify: `src/components/workspace/right-rail.tsx`

- [ ] **Step 1: Wire useChat in RightRail**

Use `useChat` from `@ai-sdk/react` with:
- `api: '/api/journey/stream'` (existing route)
- `id: state.currentSection` (scopes the chat per section)
- Transport: `new DefaultChatTransport({ api: '/api/journey/stream' })`

> **Note:** This is a placeholder hookup. The `id` prop creates separate conversation threads per section, but the AI backend does NOT yet receive section-specific context. Full section-context injection into the system prompt (so the AI can reason about the current section's research data) is follow-up work.

Render messages in the chat thread area. Render `ChatInput` as a real input with send handler.

- [ ] **Step 2: Clear thread on section change**

When `state.currentSection` changes, the `id` prop to `useChat` changes, which naturally scopes the conversation. The thread resets.

- [ ] **Step 3: "Looks good" keyword detection**

In the chat input's `onSubmit` handler, before sending to AI:

```typescript
if (input.trim().toLowerCase() === 'looks good') {
  // Don't send to AI — intercept before useChat's handleSubmit
  approveSection();
  // Append a local-only system message to the displayed thread
  setLocalMessages(prev => [
    ...prev,
    {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: 'Section approved ✓',
      createdAt: new Date(),
    },
  ]);
  setInput('');
  return;
}
```

The `localMessages` array is merged with `useChat`'s `messages` for display. This keeps the approval confirmation visible without sending anything to the AI. The `setInput('')` clears the input field.

> **Note:** This chat hookup is a placeholder. Full section-context injection into the system prompt (so the AI can reason about the current section's data) is follow-up work beyond this sprint.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(workspace): add scoped right-rail chat with looks-good detection"
```

---

## Chunk 8: Sprint 7 — Mobile + Polish

### Task 7.1: Bottom Sheet for Mobile

**Files:**
- Create: `src/components/workspace/bottom-sheet.tsx`
- Modify: `src/components/workspace/workspace-page.tsx`

- [ ] **Step 1: Install Vaul (if not already installed)**

Run: `npx shadcn@latest add drawer`

This adds Vaul-based Drawer component.

- [ ] **Step 2: Build BottomSheet**

Wrap the RightRail content in a `Drawer` component from shadcn/ui:
- `collapsed`: only the input bar and pull handle visible
- `partial`: 40vh snap point
- `expanded`: 85vh snap point

```typescript
// src/components/workspace/bottom-sheet.tsx
'use client';

import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
// ... render RightRail contents inside DrawerContent
```

- [ ] **Step 3: Update WorkspacePage responsive layout**

```typescript
// In workspace-page.tsx:
// Desktop: show RightRail inline
// Mobile: show BottomSheet
<div className="hidden md:flex">
  <RightRail />
</div>
<div className="md:hidden">
  <BottomSheet />
</div>
```

Cards stack single-column on mobile (already responsive via CardGrid).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(workspace): add mobile bottom sheet for right-rail chat"
```

---

### Task 7.2: Polish + Cleanup

**Files:**
- Modify: various

- [ ] **Step 1: Polish morph transition timing**

Test and tune: stagger delay, spring stiffness, fade duration. Use `springs.smooth` if `snappy` feels too fast.

- [ ] **Step 2: Handle edge cases**

- Empty sections (no data from research): show "No data available" placeholder
- Partial data (some fields missing): cards that have no data are omitted (already handled by null checks in taxonomy parser)
- Loading state: reuse existing loading spinner patterns

- [ ] **Step 3: Remove dead code**

Delete references to old chat-center layout in `journey/page.tsx` that are no longer reachable when in workspace phase. Keep the onboarding phases untouched.

Note: Do NOT delete `artifact-trigger-card.tsx` or `research-inline-card.tsx` yet — they may still be used during onboarding phases. Only delete when confirmed unused.

- [ ] **Step 4: Build + test verification**

Run: `npm run build`
Run: `npm run test:run`
Expected: Both pass

- [ ] **Step 5: Final commit**

```bash
git commit -m "feat(workspace): polish transitions, handle edge cases, clean up dead code"
```
