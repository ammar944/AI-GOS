# Sprint 4: Seamless Research Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the research experience from a silent "spinner → complete" into a seamless, progressive reveal — animated scanning messages during research, "View full analysis" button on completion, and a right-panel Research Canvas with tabbed sections that fills in as data arrives.

**Architecture:** Research tools already run mid-conversation (lead agent system prompt has threshold triggers). Sprint 4 only touches the UI layer: (1) richer inline cards with simulated streaming key-lines during loading, (2) a "View full analysis" button that opens the right panel to a tabbed Research Canvas, (3) per-section rich views in that canvas, and (4) a custom hook to extract structured research data from messages. No changes to the AI pipeline.

**Tech Stack:** React, Framer Motion, Tailwind/CSS vars, Vercel AI SDK UIMessage types, Lucide icons, Supabase (for persistence task only)

---

## Pre-task: Understand the codebase

Read these files before starting (fast context pass — do not modify):

- `src/components/journey/research-inline-card.tsx` — current loading/complete/error card
- `src/components/shell/research-sections.tsx` — BUG HERE (wrong tool name check)
- `src/components/shell/context-panel.tsx` — right panel, shows ResearchSections (status dots)
- `src/app/journey/page.tsx` — main page, wires up `useChat`, passes `messages` to ContextPanel
- `src/lib/ai/prompts/lead-agent-system.ts` — system prompt, already has threshold triggers
- `src/lib/journey/session-state.ts` — OnboardingState types and helpers

---

## Task 0: Fix the research-sections bug

**Files:**
- Modify: `src/components/shell/research-sections.tsx:37`

The `deriveResearchStatus` function checks `p.type.startsWith('tool-runResearch')` — but Sprint 3 replaced `runResearch` with 5 separate tools: `researchIndustry`, `researchCompetitors`, `researchICP`, `researchOffer`, `synthesizeResearch`. Status dots never show running/done.

**Step 1: Read the file**

Open `src/components/shell/research-sections.tsx`. Find line 37: `!p.type.startsWith('tool-runResearch')`.

**Step 2: Replace the broken check**

Old code (lines 35–40):
```typescript
if (
  typeof p.type !== 'string' ||
  !p.type.startsWith('tool-runResearch')
) {
  continue;
}

// Check if the input section matches this key
const input = p.input as Record<string, unknown> | undefined;
if (!input || input.section !== key) continue;
```

New code — map section key to tool name, check the tool part type directly:
```typescript
const TOOL_NAME_BY_SECTION: Record<string, string> = {
  industryMarket: 'tool-researchIndustry',
  competitors:    'tool-researchCompetitors',
  icpValidation:  'tool-researchICP',
  offerAnalysis:  'tool-researchOffer',
  crossAnalysis:  'tool-synthesizeResearch',
};

// ...inside deriveResearchStatus, replace the old startsWith check:
const expectedToolType = TOOL_NAME_BY_SECTION[key];
if (typeof p.type !== 'string' || p.type !== expectedToolType) {
  continue;
}
// No need to check input.section — each tool maps to exactly one section
```

Add the `TOOL_NAME_BY_SECTION` constant at the top of the file (outside the function, before `RESEARCH_ITEMS`).

Remove the `input.section !== key` check since each tool name already maps 1:1 to a section.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors (or only pre-existing errors unrelated to this file).

**Step 4: Commit**

```bash
git add src/components/shell/research-sections.tsx
git commit -m "fix: research status dots now track correct tool names (Sprint 3 migration)"
```

---

## Task 1: Build the `useResearchData` hook

**Files:**
- Create: `src/hooks/use-research-data.ts`

This hook extracts structured research output from the `messages` array. Every component that needs research data uses this — it's the single source of truth.

**Step 1: Create the file**

```typescript
// src/hooks/use-research-data.ts
// Extracts structured research output from the messages array.
// Research tool results live as UIMessage parts with type 'tool-researchXxx'
// and state 'output-available'. This hook makes them accessible.

import { useMemo } from 'react';
import type { UIMessage } from 'ai';

export type ResearchSectionKey =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'crossAnalysis';

export type ResearchStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ResearchSection {
  key: ResearchSectionKey;
  status: ResearchStatus;
  data?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

// Maps section key → the tool part type emitted by Vercel AI SDK
const TOOL_TYPE_BY_SECTION: Record<ResearchSectionKey, string> = {
  industryMarket: 'tool-researchIndustry',
  competitors:    'tool-researchCompetitors',
  icpValidation:  'tool-researchICP',
  offerAnalysis:  'tool-researchOffer',
  crossAnalysis:  'tool-synthesizeResearch',
};

const SECTION_KEYS: ResearchSectionKey[] = [
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
  'crossAnalysis',
];

function deriveSection(key: ResearchSectionKey, messages: UIMessage[]): ResearchSection {
  const expectedType = TOOL_TYPE_BY_SECTION[key];

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (p.type !== expectedType) continue;

      const state = p.state as string | undefined;
      const output = p.output as Record<string, unknown> | undefined;

      if (state === 'output-available') {
        // Tool completed — extract data from output
        const toolOutput = output ?? {};
        const data = (toolOutput.data ?? toolOutput) as Record<string, unknown>;
        return {
          key,
          status: 'complete',
          data,
          durationMs: toolOutput.durationMs as number | undefined,
        };
      }
      if (state === 'output-error') {
        const toolOutput = output ?? {};
        return {
          key,
          status: 'error',
          error: (toolOutput.error as string) ?? 'Research failed',
        };
      }
      if (state === 'input-streaming' || state === 'input-available') {
        return { key, status: 'running' };
      }
    }
  }

  return { key, status: 'pending' };
}

export interface UseResearchDataReturn {
  sections: Record<ResearchSectionKey, ResearchSection>;
  completedSections: ResearchSectionKey[];
  runningSections: ResearchSectionKey[];
  allComplete: boolean;
  anyRunning: boolean;
}

export function useResearchData(messages: UIMessage[]): UseResearchDataReturn {
  return useMemo(() => {
    const sections = {} as Record<ResearchSectionKey, ResearchSection>;
    for (const key of SECTION_KEYS) {
      sections[key] = deriveSection(key, messages);
    }
    const completedSections = SECTION_KEYS.filter((k) => sections[k].status === 'complete');
    const runningSections = SECTION_KEYS.filter((k) => sections[k].status === 'running');
    return {
      sections,
      completedSections,
      runningSections,
      allComplete: completedSections.length === SECTION_KEYS.length,
      anyRunning: runningSections.length > 0,
    };
  }, [messages]);
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/hooks/use-research-data.ts
git commit -m "feat: useResearchData hook — extracts research output from messages"
```

---

## Task 2: Upgrade ResearchInlineCard with animated scanning + "View full analysis"

**Files:**
- Modify: `src/components/journey/research-inline-card.tsx`

Two upgrades:
1. **Loading state**: Replace "Researching... (15-30 seconds)" with animated scanning key-lines per section (typewriter effect cycling through realistic phrases).
2. **Complete state**: Add a "View full analysis →" button at the bottom of the card.

**Step 1: Add per-section scanning phrases**

Add this constant near the top of the file (after imports):

```typescript
// Per-section scanning phrases shown during loading — give realistic "working" feel
const SCANNING_PHRASES: Record<string, string[]> = {
  industryMarket: [
    'Scanning market landscape...',
    'Pulling industry benchmarks...',
    'Analyzing pain points from G2 & Reddit...',
    'Mapping buying behaviors...',
    'Identifying demand drivers...',
    'Checking seasonal patterns...',
  ],
  competitors: [
    'Identifying top competitors...',
    'Analyzing ad creative strategies...',
    'Running keyword intelligence...',
    'Benchmarking landing pages...',
    'Mapping funnel structures...',
    'Scanning white-space gaps...',
  ],
  icpValidation: [
    'Validating audience targeting feasibility...',
    'Checking audience size estimates...',
    'Analyzing trigger events...',
    'Assessing ICP-product fit...',
    'Scoring risk signals...',
  ],
  offerAnalysis: [
    'Benchmarking pricing models...',
    'Scanning offer clarity signals...',
    'Checking red flags...',
    'Comparing market positioning...',
    'Scoring offer strength...',
  ],
  crossAnalysis: [
    'Synthesizing research findings...',
    'Identifying positioning gaps...',
    'Mapping platform opportunities...',
    'Drafting strategic recommendations...',
    'Building ad hook frameworks...',
  ],
};
const DEFAULT_PHRASES = ['Analyzing...', 'Researching...', 'Processing...'];
```

**Step 2: Build the animated phrase component**

Replace the existing `LoadingCard` component with this version:

```typescript
function useAnimatedPhrase(phrases: string[]) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % phrases.length);
        setVisible(true);
      }, 300);
    }, 2800);
    return () => clearInterval(interval);
  }, [phrases]);

  return { phrase: phrases[idx], visible };
}

function LoadingCard({ meta, section }: { meta: SectionMeta; section: string }) {
  const Icon = meta.icon;
  const iconBg = meta.color.startsWith('var(')
    ? `color-mix(in srgb, ${meta.color} 12%, transparent)`
    : `${meta.color}1f`;
  const phrases = SCANNING_PHRASES[section] ?? DEFAULT_PHRASES;
  const { phrase, visible } = useAnimatedPhrase(phrases);

  return (
    <div style={CARD_STYLE} role="status" aria-label={`Researching ${meta.label}`}>
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0 flex items-center justify-center rounded-md" style={{ width: 24, height: 24, background: iconBg }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Icon style={{ width: 13, height: 13, color: meta.color }} />
          </motion.div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium leading-tight truncate" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {meta.label}
          </p>
          <motion.p
            key={phrase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="truncate mt-0.5"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)', minHeight: '16px' }}
          >
            {phrase}
          </motion.p>
        </div>
        <motion.span
          className="flex-shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: meta.color }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}
```

Note: `useEffect` is already imported via React. Add `useEffect` to the imports if not present.

**Step 3: Add "View full analysis" button to CompleteCard**

Update `CompleteCard` props and add the button at the bottom:

```typescript
// Change signature to accept onViewFull callback:
function CompleteCard({
  meta,
  findings,
  durationMs,
  sourceCount,
  onViewFull,
}: {
  meta: SectionMeta;
  findings: string[];
  durationMs?: number;
  sourceCount?: number;
  onViewFull?: () => void;
}) {
  // ...existing code...

  // Add at the bottom, inside the outer div, AFTER the AnimatePresence block:
  {onViewFull && (
    <div style={{ padding: '0 12px 10px', marginTop: findings.length > 0 ? 0 : 4 }}>
      <button
        onClick={onViewFull}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          background: 'transparent',
          color: 'var(--accent-blue)',
          fontSize: '11px',
          fontWeight: 500,
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--accent-blue) 8%, transparent)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        View full analysis →
      </button>
    </div>
  )}
```

**Step 4: Update ResearchInlineCard props interface and render**

```typescript
export interface ResearchInlineCardProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  data?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  sourceCount?: number;
  onViewFull?: () => void;  // NEW
  className?: string;
}

// In the render:
export function ResearchInlineCard({ section, status, data, error, durationMs, sourceCount, onViewFull, className }: ResearchInlineCardProps) {
  const meta = SECTION_META[section] ?? DEFAULT_META;
  const findings = extractTopFindings(section, data);
  return (
    <motion.div ...>
      {status === 'loading'  && <LoadingCard  meta={meta} section={section} />}
      {status === 'complete' && <CompleteCard meta={meta} findings={findings} durationMs={durationMs} sourceCount={sourceCount} onViewFull={onViewFull} />}
      {status === 'error'    && <ErrorCard    meta={meta} error={error} />}
    </motion.div>
  );
}
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add src/components/journey/research-inline-card.tsx
git commit -m "feat: animated scanning phrases + view full analysis button in research cards"
```

---

## Task 3: Build ResearchCanvas (tabbed right panel content)

**Files:**
- Create: `src/components/shell/research-canvas.tsx`

This is the rich tabbed view that replaces the status dots in the right panel when research arrives. Each tab = one research section. Tabs appear progressively as sections complete.

**Step 1: Create the component**

```typescript
// src/components/shell/research-canvas.tsx
// Tabbed research canvas for the right panel.
// Tabs appear progressively as research sections complete.
// Each tab shows the full structured output for that section.

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Users, Target, Package, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResearchSectionKey, ResearchSection } from '@/hooks/use-research-data';

// ── Section meta ────────────────────────────────────────────────────────────

interface SectionTab {
  key: ResearchSectionKey;
  label: string;
  shortLabel: string;
  icon: typeof Globe;
  color: string;
}

const TABS: SectionTab[] = [
  { key: 'industryMarket', label: 'Industry & Market', shortLabel: 'Industry', icon: Globe,    color: 'var(--accent-blue)' },
  { key: 'competitors',    label: 'Competitor Analysis', shortLabel: 'Competitors', icon: Users, color: 'var(--accent-purple, #a855f7)' },
  { key: 'icpValidation',  label: 'ICP Validation',     shortLabel: 'ICP',       icon: Target,  color: 'var(--accent-cyan, #06b6d4)' },
  { key: 'offerAnalysis',  label: 'Offer Analysis',     shortLabel: 'Offer',     icon: Package, color: 'var(--accent-green, #22c55e)' },
  { key: 'crossAnalysis',  label: 'Synthesis',          shortLabel: 'Synthesis', icon: Layers,  color: '#f59e0b' },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface ResearchCanvasProps {
  sections: Record<ResearchSectionKey, ResearchSection>;
  activeSection?: ResearchSectionKey | null;
  onTabChange?: (key: ResearchSectionKey) => void;
}

// ── Tab bar ────────────────────────────────────────────────────────────────

function TabBar({
  tabs,
  activeKey,
  sections,
  onSelect,
}: {
  tabs: SectionTab[];
  activeKey: ResearchSectionKey | null;
  sections: Record<ResearchSectionKey, ResearchSection>;
  onSelect: (key: ResearchSectionKey) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: '8px 12px 0',
        borderBottom: '1px solid var(--border-default)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map((tab) => {
        const section = sections[tab.key];
        const isAvailable = section.status === 'complete' || section.status === 'error';
        const isRunning = section.status === 'running';
        const isActive = activeKey === tab.key;
        const Icon = tab.icon;

        if (!isAvailable && !isRunning) return null; // Tab only appears when visible

        return (
          <motion.button
            key={tab.key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => isAvailable && onSelect(tab.key)}
            disabled={!isAvailable}
            style={{
              flexShrink: 0,
              padding: '6px 10px',
              borderRadius: '6px 6px 0 0',
              border: '1px solid transparent',
              borderBottom: 'none',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              borderColor: isActive ? 'var(--border-default)' : 'transparent',
              cursor: isAvailable ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              position: 'relative',
              marginBottom: isActive ? -1 : 0,
            }}
          >
            {isRunning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Icon style={{ width: 11, height: 11, color: tab.color }} />
              </motion.div>
            ) : (
              <Icon
                style={{
                  width: 11,
                  height: 11,
                  color: isActive ? tab.color : 'var(--text-quaternary)',
                }}
              />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-quaternary)',
                letterSpacing: '0.01em',
              }}
            >
              {tab.shortLabel}
            </span>
            {isRunning && (
              <motion.span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: tab.color,
                  flexShrink: 0,
                }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Section content views ──────────────────────────────────────────────────
// These render the raw structured data in a readable way.
// Each is a separate component so they can be upgraded independently.

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
      {children}
    </p>
  );
}

function DataRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function BulletList({ items, color = 'var(--accent-blue)' }: { items: string[]; color?: string }) {
  if (!items?.length) return null;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? 'var(--accent-blue)' : pct >= 50 ? '#f59e0b' : 'var(--status-error)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border-default)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, flexShrink: 0 }}>{score}/{max}</span>
    </div>
  );
}

function get<T>(obj: unknown, key: string): T | undefined {
  return (obj as Record<string, T> | undefined)?.[key];
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  return get<string>(v, 'point') ?? get<string>(v, 'insight') ?? get<string>(v, 'name') ?? '';
}

// Industry tab content
function IndustryContent({ data }: { data: Record<string, unknown> }) {
  const snap = get<Record<string, unknown>>(data, 'categorySnapshot');
  const painPoints = get<Record<string, unknown>>(data, 'painPoints');
  const trends = arr(get(data, 'marketTrends')).map(str).filter(Boolean);
  const messaging = get<Record<string, unknown>>(data, 'messagingOpportunities');
  const angles = arr(get(messaging, 'angles')).map(str).filter(Boolean);
  const primaryPains = arr(get(painPoints, 'primary')).map(str).filter(Boolean);
  const triggers = arr(get(painPoints, 'triggers')).map(str).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {snap && (
        <div>
          <SectionLabel>Market Snapshot</SectionLabel>
          <DataRow label="Category" value={get<string>(snap, 'category')} />
          <DataRow label="Maturity" value={get<string>(snap, 'marketMaturity')} />
          <DataRow label="Awareness level" value={get<string>(snap, 'awarenessLevel')} />
          <DataRow label="Sales cycle" value={get<string>(snap, 'averageSalesCycle')} />
          <DataRow label="Buying behavior" value={get<string>(snap, 'buyingBehavior')} />
        </div>
      )}
      {primaryPains.length > 0 && (
        <div>
          <SectionLabel>Primary Pain Points</SectionLabel>
          <BulletList items={primaryPains} color="var(--status-error)" />
        </div>
      )}
      {triggers.length > 0 && (
        <div>
          <SectionLabel>Purchase Triggers</SectionLabel>
          <BulletList items={triggers} color="#f59e0b" />
        </div>
      )}
      {trends.length > 0 && (
        <div>
          <SectionLabel>Market Trends</SectionLabel>
          <BulletList items={trends} color="var(--accent-blue)" />
        </div>
      )}
      {angles.length > 0 && (
        <div>
          <SectionLabel>Messaging Angles</SectionLabel>
          <BulletList items={angles} color="var(--accent-purple, #a855f7)" />
        </div>
      )}
    </div>
  );
}

// Competitors tab content
function CompetitorsContent({ data }: { data: Record<string, unknown> }) {
  const competitors = arr(data.competitors);
  const gaps = arr(data.whiteSpaceGaps);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {competitors.map((comp, i) => {
        const c = comp as Record<string, unknown>;
        const name = get<string>(c, 'name') ?? `Competitor ${i + 1}`;
        const positioning = get<string>(c, 'positioning') ?? '';
        const offer = get<string>(c, 'offer') ?? '';
        const price = get<string>(c, 'price') ?? '';
        const strengths = arr(get(c, 'strengths')).map(str).filter(Boolean);
        const weaknesses = arr(get(c, 'weaknesses')).map(str).filter(Boolean);
        const platforms = arr(get(c, 'adPlatforms')).map(str).filter(Boolean);
        const threat = get<Record<string, unknown>>(c, 'threatAssessment');
        const hooks = arr(get(threat, 'topAdHooks')).map(str).filter(Boolean);
        const counter = get<string>(threat, 'counterPositioning') ?? '';

        return (
          <div key={i} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-hover)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{name}</p>
            {positioning && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, lineHeight: 1.4 }}>{positioning}</p>}
            <DataRow label="Offer" value={offer} />
            <DataRow label="Price" value={price} />
            {platforms.length > 0 && <DataRow label="Ad platforms" value={platforms.join(', ')} />}
            {strengths.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <SectionLabel>Strengths</SectionLabel>
                <BulletList items={strengths} color="var(--accent-green, #22c55e)" />
              </div>
            )}
            {weaknesses.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <SectionLabel>Weaknesses</SectionLabel>
                <BulletList items={weaknesses} color="#f59e0b" />
              </div>
            )}
            {hooks.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <SectionLabel>Top Ad Hooks</SectionLabel>
                <BulletList items={hooks} color="var(--accent-purple, #a855f7)" />
              </div>
            )}
            {counter && (
              <div style={{ marginTop: 10 }}>
                <SectionLabel>Counter-positioning</SectionLabel>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{counter}</p>
              </div>
            )}
          </div>
        );
      })}
      {gaps.length > 0 && (
        <div>
          <SectionLabel>White-Space Gaps ({gaps.length})</SectionLabel>
          {gaps.map((gap, i) => {
            const g = gap as Record<string, unknown>;
            return (
              <div key={i} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', marginBottom: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{get<string>(g, 'gap')}</p>
                {get<string>(g, 'evidence') && (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{get<string>(g, 'evidence')}</p>
                )}
                {get<string>(g, 'recommendedAction') && (
                  <p style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 4 }}>→ {get<string>(g, 'recommendedAction')}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ICP tab content
function ICPContent({ data }: { data: Record<string, unknown> }) {
  const verdict = get<Record<string, unknown>>(data, 'finalVerdict');
  const verdictStatus = get<string>(verdict, 'status') ?? '';
  const verdictColor = verdictStatus === 'Validated' ? 'var(--accent-green, #22c55e)' : verdictStatus === 'Invalid' ? 'var(--status-error)' : '#f59e0b';

  const fit = get<Record<string, unknown>>(data, 'painSolutionFit');
  const checklist = get<Record<string, unknown>>(data, 'coherenceChecklist');
  const risk = get<Record<string, unknown>>(data, 'riskAssessment');
  const flags = arr(get(risk, 'flags')).map(str).filter(Boolean);
  const targeting = get<Record<string, unknown>>(data, 'targetingFeasibility');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {verdictStatus && (
        <div style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${verdictColor}`, background: `color-mix(in srgb, ${verdictColor} 10%, transparent)` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: verdictColor }}>{verdictStatus}</p>
          {get<string>(verdict, 'summary') && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{get<string>(verdict, 'summary')}</p>
          )}
        </div>
      )}
      {fit && (
        <div>
          <SectionLabel>Pain-Solution Fit</SectionLabel>
          <DataRow label="Primary pain" value={get<string>(fit, 'primaryPain')} />
          <DataRow label="Solution addresses" value={get<string>(fit, 'solutionAddresses')} />
          <DataRow label="Fit score" value={get<number>(fit, 'fitScore')} />
        </div>
      )}
      {checklist && (
        <div>
          <SectionLabel>Coherence Checklist</SectionLabel>
          {Object.entries(checklist).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: v ? 'var(--accent-green, #22c55e)' : 'var(--status-error)' }}>
                {v ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      )}
      {targeting && (
        <div>
          <SectionLabel>Targeting Feasibility</SectionLabel>
          <DataRow label="Platform reach" value={get<string>(targeting, 'platformReach')} />
          <DataRow label="Audience size" value={get<string>(targeting, 'estimatedSize')} />
        </div>
      )}
      {flags.length > 0 && (
        <div>
          <SectionLabel>Risk Flags</SectionLabel>
          <BulletList items={flags} color="var(--status-error)" />
        </div>
      )}
    </div>
  );
}

// Offer tab content
function OfferContent({ data }: { data: Record<string, unknown> }) {
  const recommendation = get<string>(data, 'recommendationStatus') ?? get<string>(data, 'recommendation') ?? '';
  const recColor = recommendation?.includes('Proceed') ? 'var(--accent-green, #22c55e)' : recommendation?.includes('Rebuild') ? 'var(--status-error)' : '#f59e0b';
  const strength = get<Record<string, unknown>>(data, 'offerStrength');
  const overallScore = get<number>(strength, 'overallScore') ?? get<number>(data, 'overallScore');
  const redFlags = arr(data.redFlags).map(str).filter(Boolean);
  const recommendations = arr(data.recommendations).map(str).filter(Boolean);
  const clarity = get<Record<string, unknown>>(data, 'offerClarity');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {recommendation && (
        <div style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${recColor}`, background: `color-mix(in srgb, ${recColor} 10%, transparent)` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: recColor }}>{recommendation}</p>
        </div>
      )}
      {overallScore !== undefined && (
        <div>
          <SectionLabel>Overall Offer Score</SectionLabel>
          <ScoreBar score={overallScore} />
        </div>
      )}
      {strength && (
        <div>
          <SectionLabel>Strength Breakdown</SectionLabel>
          {Object.entries(strength).filter(([k]) => k !== 'overallScore').map(([k, v]) => (
            typeof v === 'number' ? (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k}</span>
                </div>
                <ScoreBar score={v} />
              </div>
            ) : null
          ))}
        </div>
      )}
      {clarity && (
        <div>
          <SectionLabel>Offer Clarity</SectionLabel>
          <DataRow label="Clarity score" value={get<number>(clarity, 'score')} />
          <DataRow label="Issues" value={get<string>(clarity, 'issues')} />
        </div>
      )}
      {redFlags.length > 0 && (
        <div>
          <SectionLabel>Red Flags</SectionLabel>
          <BulletList items={redFlags} color="var(--status-error)" />
        </div>
      )}
      {recommendations.length > 0 && (
        <div>
          <SectionLabel>Recommendations</SectionLabel>
          <BulletList items={recommendations} color="var(--accent-blue)" />
        </div>
      )}
    </div>
  );
}

// Synthesis tab content
function SynthesisContent({ data }: { data: Record<string, unknown> }) {
  const positioning = get<string>(data, 'positioningStatement') ?? '';
  const hooks = arr(data.adHooks).map(str).filter(Boolean);
  const platforms = arr(data.recommendedPlatforms).map(str).filter(Boolean);
  const insights = arr(data.keyInsights).map(str).filter(Boolean);
  const critical = arr(data.criticalSuccessFactors).map(str).filter(Boolean);
  const quickWins = arr(data.quickWins).map(str).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {positioning && (
        <div>
          <SectionLabel>Positioning Statement</SectionLabel>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', padding: '10px 12px', borderLeft: '3px solid var(--accent-blue)', background: 'var(--bg-hover)', borderRadius: '0 6px 6px 0' }}>
            "{positioning}"
          </p>
        </div>
      )}
      {insights.length > 0 && (
        <div>
          <SectionLabel>Key Insights</SectionLabel>
          <BulletList items={insights} color="var(--accent-blue)" />
        </div>
      )}
      {hooks.length > 0 && (
        <div>
          <SectionLabel>Ad Hooks</SectionLabel>
          {hooks.map((hook, i) => (
            <div key={i} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', marginBottom: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
              "{hook}"
            </div>
          ))}
        </div>
      )}
      {platforms.length > 0 && (
        <div>
          <SectionLabel>Recommended Platforms</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {platforms.map((p, i) => (
              <span key={i} style={{ padding: '4px 10px', borderRadius: 12, background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)', color: 'var(--accent-blue)', fontSize: 11, fontWeight: 500 }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
      {critical.length > 0 && (
        <div>
          <SectionLabel>Critical Success Factors</SectionLabel>
          <BulletList items={critical} color="#f59e0b" />
        </div>
      )}
      {quickWins.length > 0 && (
        <div>
          <SectionLabel>Quick Wins</SectionLabel>
          <BulletList items={quickWins} color="var(--accent-green, #22c55e)" />
        </div>
      )}
    </div>
  );
}

// ── Empty/running state ────────────────────────────────────────────────────

function SectionEmpty({ tab, status }: { tab: SectionTab; status: ResearchSection['status'] }) {
  const Icon = tab.icon;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 16px', textAlign: 'center' }}>
      {status === 'running' ? (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
          <Icon style={{ width: 24, height: 24, color: tab.color, opacity: 0.5 }} />
        </motion.div>
      ) : (
        <Icon style={{ width: 24, height: 24, color: 'var(--text-quaternary)' }} />
      )}
      <p style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>
        {status === 'running' ? 'Analyzing...' : 'Waiting for data'}
      </p>
    </div>
  );
}

// ── Main canvas ────────────────────────────────────────────────────────────

export function ResearchCanvas({ sections, activeSection, onTabChange }: ResearchCanvasProps) {
  const availableTabs = TABS.filter(
    (t) => sections[t.key].status === 'complete' || sections[t.key].status === 'error' || sections[t.key].status === 'running'
  );

  // Auto-select first available tab if none selected or selected tab not available
  const [internalActive, setInternalActive] = useState<ResearchSectionKey | null>(null);

  useEffect(() => {
    if (activeSection && sections[activeSection].status === 'complete') {
      setInternalActive(activeSection);
      return;
    }
    if (!internalActive || sections[internalActive].status === 'pending') {
      const first = availableTabs.find((t) => t.status !== 'pending');
      if (first) setInternalActive(first.key);
    }
  }, [activeSection, availableTabs, internalActive, sections]);

  const activeKey = (activeSection && sections[activeSection].status === 'complete') ? activeSection : internalActive;
  const activeTab = TABS.find((t) => t.key === activeKey);
  const activeSection_ = activeKey ? sections[activeKey] : null;

  const handleTabSelect = (key: ResearchSectionKey) => {
    setInternalActive(key);
    onTabChange?.(key);
  };

  if (availableTabs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>Research will appear here as it completes</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TabBar tabs={TABS} activeKey={activeKey} sections={sections} onSelect={handleTabSelect} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        <AnimatePresence mode="wait">
          {activeSection_ && activeTab && (
            <motion.div
              key={activeKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {activeSection_.status === 'complete' && activeSection_.data ? (
                <>
                  {activeKey === 'industryMarket' && <IndustryContent data={activeSection_.data} />}
                  {activeKey === 'competitors'    && <CompetitorsContent data={activeSection_.data} />}
                  {activeKey === 'icpValidation'  && <ICPContent data={activeSection_.data} />}
                  {activeKey === 'offerAnalysis'  && <OfferContent data={activeSection_.data} />}
                  {activeKey === 'crossAnalysis'  && <SynthesisContent data={activeSection_.data} />}
                </>
              ) : (
                <SectionEmpty tab={activeTab} status={activeSection_.status} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add src/components/shell/research-canvas.tsx
git commit -m "feat: ResearchCanvas — tabbed right panel for progressive research sections"
```

---

## Task 4: Wire ResearchCanvas into ContextPanel

**Files:**
- Modify: `src/components/shell/context-panel.tsx`

Replace the `ResearchSections` (status dots) component with `ResearchCanvas` when research is running. Keep the status dots as a fallback when no research has started.

**Step 1: Read the full context-panel.tsx**

Read the full file — we need lines 80–end.

**Step 2: Update imports and props**

In `context-panel.tsx`:
1. Import `useResearchData` from `@/hooks/use-research-data`
2. Import `ResearchCanvas` from `./research-canvas`
3. Add `activeSectionKey` state and `onSectionView` callback to pass down

Replace the research `PanelSection` contents. When `anyRunning || completedSections.length > 0`, show `ResearchCanvas`. When nothing has started, show `ResearchSections` (status dots) as before.

Find the section in context-panel.tsx that renders `<ResearchSections messages={messages} />`. Replace it with:

```typescript
// At the top of ContextPanel (or wherever messages is in scope):
const { sections, completedSections, anyRunning } = useResearchData(messages);
const [activeCanvasSection, setActiveCanvasSection] = useState<string | null>(null);

// In the render, replace the ResearchSections usage:
{(anyRunning || completedSections.length > 0) ? (
  <div style={{ margin: '0 -16px', height: 320 }}> {/* Negative margin to edge-to-edge in panel */}
    <ResearchCanvas
      sections={sections}
      activeSection={activeCanvasSection as ResearchSectionKey | null}
      onTabChange={(key) => setActiveCanvasSection(key)}
    />
  </div>
) : (
  <ResearchSections messages={messages} />
)}
```

Also expose a method to programmatically navigate to a tab. Add to `ContextPanel` props:
```typescript
interface ContextPanelProps {
  messages: UIMessage[];
  onboardingState: Partial<OnboardingState> | null;
  journeyProgress: JourneyProgress;
  // NEW:
  onResearchSectionRequest?: (section: string) => void;
}
```

And wire a ref or callback so the parent (`journey/page.tsx`) can trigger tab navigation.

Actually, simpler: just pass an `activeSectionKey` prop to ContextPanel that journey/page.tsx controls.

Add to `ContextPanelProps`:
```typescript
activeSectionKey?: string | null;
```

And inside ContextPanel, use this value for `activeCanvasSection` when provided.

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/components/shell/context-panel.tsx
git commit -m "feat: ResearchCanvas replaces status dots in right panel when research runs"
```

---

## Task 5: Wire "View full analysis" in chat → opens right panel to tab

**Files:**
- Modify: `src/app/journey/page.tsx`
- Modify: `src/components/journey/chat-message.tsx`

When user clicks "View full analysis →" on a completed `ResearchInlineCard` in chat, we need to:
1. Open the right panel (if collapsed)
2. Navigate the canvas to the relevant tab

**Step 1: Read journey/page.tsx lines 100–200**

Find where `ChatMessage` is rendered. Look for `<ChatMessage ... />` in the messages map.

**Step 2: Add state and callback in JourneyPageContent**

In `JourneyPageContent`, add:

```typescript
const [activePanelSection, setActivePanelSection] = useState<string | null>(null);

const handleViewResearchSection = useCallback((section: string) => {
  setRightPanelCollapsed(false); // open right panel
  setActivePanelSection(section);
}, [setRightPanelCollapsed]);
```

Pass `activePanelSection` to `<ContextPanel>` as prop `activeSectionKey`.

**Step 3: Thread onViewFull into ChatMessage**

Update `ChatMessage` props to accept `onViewResearchSection?: (section: string) => void`.

In `ChatMessage`, wherever `ResearchInlineCard` is rendered, pass:
```typescript
<ResearchInlineCard
  section={section}
  status={status}
  data={data}
  onViewFull={status === 'complete' ? () => onViewResearchSection?.(section) : undefined}
/>
```

**Step 4: Find how ChatMessage is rendered in page.tsx and pass the callback**

In page.tsx, find the render of `<ChatMessage .../>` and add:
```typescript
<ChatMessage
  // ...existing props...
  onViewResearchSection={handleViewResearchSection}
/>
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add src/app/journey/page.tsx src/components/journey/chat-message.tsx
git commit -m "feat: view full analysis opens right panel canvas to matching research tab"
```

---

## Task 6: Add Supabase persistence for research output

**Files:**
- Modify: `src/lib/journey/session-state.server.ts` (or create if it doesn't exist — check first)
- Modify: `src/app/api/journey/stream/route.ts`

Research output currently lives only in the in-memory messages array. On page refresh, structured data is reconstructed from message JSONB (which works, since full message history is stored). However, we want to also store the extracted structured research for faster access in Sprint 5.

**Step 1: Read the existing server state file**

```bash
# Check if it exists:
ls src/lib/journey/session-state.server.ts 2>/dev/null && echo "exists" || echo "missing"
```

Then read `src/lib/journey/session-state.server.ts`.

**Step 2: Add a helper to extract research from messages**

In `src/lib/journey/session-state.ts`, add:

```typescript
// Maps tool part types to section keys (mirrors use-research-data.ts but server-safe)
const TOOL_SECTION_MAP: Record<string, string> = {
  'tool-researchIndustry':    'industryMarket',
  'tool-researchCompetitors': 'competitors',
  'tool-researchICP':         'icpValidation',
  'tool-researchOffer':       'offerAnalysis',
  'tool-synthesizeResearch':  'crossAnalysis',
};

/** Extracts completed research outputs from messages, keyed by section name. */
export function extractResearchOutputs(
  messages: UIMessage[],
): Record<string, unknown> {
  const research: Record<string, unknown> = {};
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (typeof p.type !== 'string') continue;
      const sectionKey = TOOL_SECTION_MAP[p.type];
      if (!sectionKey) continue;
      if (p.state !== 'output-available') continue;
      const output = p.output as Record<string, unknown> | undefined;
      if (output?.data) research[sectionKey] = output.data;
    }
  }
  return research;
}
```

**Step 3: Persist research output in the route**

In `src/app/api/journey/stream/route.ts`, after extracting askUser results, also extract and persist research:

```typescript
import { extractResearchOutputs } from '@/lib/journey/session-state';

// After the existing askUser persist block:
const researchOutputs = extractResearchOutputs(body.messages);
if (Object.keys(researchOutputs).length > 0) {
  persistResearchToSupabase(userId, researchOutputs).catch(() => {});
}
```

**Step 4: Add `persistResearchToSupabase` to session-state.server.ts**

```typescript
export async function persistResearchToSupabase(
  userId: string,
  research: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase
      .from('journey_sessions')
      .upsert(
        { user_id: userId, research_output: research, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  } catch (err) {
    console.error('[journey] failed to persist research output', err);
  }
}
```

Note: `journey_sessions` table must have a `research_output jsonb` column. If the column doesn't exist, add it:

```sql
-- Run in Supabase dashboard or via migration:
ALTER TABLE journey_sessions ADD COLUMN IF NOT EXISTS research_output jsonb;
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Full build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build exits 0.

**Step 7: Commit**

```bash
git add src/lib/journey/session-state.ts src/lib/journey/session-state.server.ts src/app/api/journey/stream/route.ts
git commit -m "feat: persist research output to Supabase journey_sessions.research_output"
```

---

## Task 7: Final verification

**Step 1: Build**

```bash
npm run build 2>&1 | tail -30
```

Expected: exit 0, no errors.

**Step 2: Tests**

```bash
npm run test:run 2>&1 | tail -30
```

Expected: existing tests pass, no new failures.

**Step 3: Dev server visual check (Playwright)**

```bash
# Start dev in tmux if not running:
tmux new-session -d -s dev "cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run dev"
```

Check in browser:
- [ ] Journey page loads at `/journey`
- [ ] Right panel status dots update correctly when research runs (T4.0 fix)
- [ ] Loading card shows animated scanning phrases
- [ ] Complete card shows "View full analysis →" button
- [ ] Clicking "View full analysis" opens right panel + navigates to correct tab
- [ ] Right panel shows tabbed canvas (tabs appear progressively as sections complete)
- [ ] Each tab shows structured data from the research tool
- [ ] Synthesis tab only appears after all 4 other sections complete

**Step 4: Final commit (if any cleanup)**

```bash
git add -p  # review any remaining changes
git commit -m "chore: sprint 4 final cleanup"
```

---

## Zero-regression checklist

Before marking Sprint 4 done, confirm:
- [ ] `research-sections.tsx` still exported correctly (right panel imports it)
- [ ] `ResearchInlineCard` still works without `onViewFull` prop (it's optional)
- [ ] `ContextPanel` still works when no research has run (shows status dots as before)
- [ ] Lead agent system prompt unchanged — still has threshold triggers
- [ ] `askUser` tool and onboarding flow untouched
- [ ] `extractAskUserResults` still works (session state helpers unchanged)
- [ ] Pre-existing TypeScript errors in openrouter tests / chat blueprint tests not introduced by this work

---

## Files touched summary

| Task | Files Modified | Files Created |
|------|---------------|---------------|
| T0: Bug fix | `research-sections.tsx` | — |
| T1: Hook | — | `src/hooks/use-research-data.ts` |
| T2: Card upgrades | `research-inline-card.tsx` | — |
| T3: Canvas | — | `src/components/shell/research-canvas.tsx` |
| T4: Wire panel | `context-panel.tsx` | — |
| T5: Wire chat→panel | `journey/page.tsx`, `chat-message.tsx` | — |
| T6: Persistence | `session-state.ts`, `session-state.server.ts`, `stream/route.ts` | — |
