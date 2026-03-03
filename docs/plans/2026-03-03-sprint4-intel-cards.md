# Sprint 4 — Progressive Intelligence Cards

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Research sections surface as individual infographic cards inline in the chat, revealed one subsection at a time with staggered timing, while subsequent research runs in parallel — creating a live intelligence briefing that materializes during the onboarding conversation.

**Architecture:** `buildSubsectionCards()` maps completed research JSON into ordered card configs per section. `useSubsectionReveal()` hook schedules each card's appearance with 1500ms stagger. Cards render in the chat thread at the position of the tool result that produced them. No message injection, no right panel dependency.

**Tech Stack:** Framer Motion (entry animations + bar fills), React hooks (setTimeout scheduling), existing Vercel AI SDK tool parts, CSS variables from design system, Lucide icons

---

## Prerequisites

Read before starting:
- `src/components/journey/chat-message.tsx` — understand how tool parts are rendered (RESEARCH_TOOL_SECTIONS map)
- `src/lib/ai/tools/research/research-industry.ts` — understand the `.find()` bug and sub-agent pattern
- `src/lib/ai/tools/mcp/` — understand available MCP wrappers (need spyFu for Task 12)
- `docs/plans/2026-03-03-progressive-intel-cards-design.md` — the design doc this plan implements

Run dev server before testing: `npm run dev` (use tmux: `tmux new-session -d -s dev "npm run dev"`)

---

## Task 0: P0 Bug Fix — findLast in 4 Research Tools

**The bug:** `.find()` grabs the first text block from the sub-agent (the preamble). `.findLast()` grabs the last (the JSON output). Without this fix, 4/5 research sections return `{ summary: "I'll research..." }` and all cards render empty.

**Files:**
- Modify: `src/lib/ai/tools/research/research-industry.ts:108`
- Modify: `src/lib/ai/tools/research/research-competitors.ts` (same line, same pattern)
- Modify: `src/lib/ai/tools/research/research-icp.ts` (same line, same pattern)
- Modify: `src/lib/ai/tools/research/research-offer.ts` (same line, same pattern)

**Step 1: Make the fix in all 4 files**

In each file, find the line:
```ts
const textBlock = finalMsg.content.find((b) => b.type === 'text');
```

Change it to:
```ts
const textBlock = finalMsg.content.findLast((b) => b.type === 'text');
```

That's the entire change. One word, four files.

**Step 2: Verify the fix compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: No TypeScript errors. `findLast` is available in ES2023+ which Next.js supports.

**Step 3: Commit**

```bash
git add src/lib/ai/tools/research/research-industry.ts \
        src/lib/ai/tools/research/research-competitors.ts \
        src/lib/ai/tools/research/research-icp.ts \
        src/lib/ai/tools/research/research-offer.ts
git commit -m "fix(research): findLast to capture JSON not preamble in sub-agents"
```

---

## Task 1: Create intel-card-header.tsx (shared header for all cards)

**Files:**
- Create: `src/components/journey/intel-cards/intel-card-header.tsx`

**Step 1: Write the component**

```tsx
// src/components/journey/intel-cards/intel-card-header.tsx
import { Globe, Users, Target, Package, Layers, Key } from 'lucide-react';

const SECTION_META: Record<string, { icon: typeof Globe; color: string }> = {
  industryMarket: { icon: Globe,    color: 'var(--accent-blue)' },
  competitors:    { icon: Users,    color: 'var(--accent-purple, #a855f7)' },
  icpValidation:  { icon: Target,   color: 'var(--accent-cyan, #06b6d4)' },
  offerAnalysis:  { icon: Package,  color: 'var(--accent-green, #22c55e)' },
  crossAnalysis:  { icon: Layers,   color: '#f59e0b' },
  keywordIntel:   { icon: Key,      color: '#f97316' },
};

export function IntelCardHeader({ sectionKey, label }: { sectionKey: string; label: string }) {
  const meta = SECTION_META[sectionKey] ?? { icon: Globe, color: 'var(--accent-blue)' };
  const Icon = meta.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <Icon style={{ width: 11, height: 11, color: meta.color }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: meta.color }}>
        {label}
      </span>
    </div>
  );
}

export { SECTION_META };
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep intel-card-header
```
Expected: No output (no errors).

**Step 3: Commit**

```bash
git add src/components/journey/intel-cards/intel-card-header.tsx
git commit -m "feat(intel-cards): shared card header component"
```

---

## Task 2: Create StatCard

**Files:**
- Create: `src/components/journey/intel-cards/stat-card.tsx`

**Step 1: Write the component**

```tsx
// src/components/journey/intel-cards/stat-card.tsx
'use client';

import { motion } from 'framer-motion';
import { IntelCardHeader, SECTION_META } from './intel-card-header';

export interface StatCardProps {
  sectionKey: string;
  label: string;
  value: number;
  max?: number;
}

export function StatCard({ sectionKey, label, value, max = 10 }: StatCardProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const meta = SECTION_META[sectionKey] ?? { color: 'var(--accent-blue)' };
  const color = pct >= 70 ? 'var(--accent-green, #22c55e)' : pct >= 50 ? '#f59e0b' : 'var(--status-error, #ef4444)';

  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label={label} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', lineHeight: 1 }}>
          {value}
        </span>
        <span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>/{max}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border-default)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', borderRadius: 2, background: color }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/journey/intel-cards/stat-card.tsx
git commit -m "feat(intel-cards): StatCard with animated fill bar"
```

---

## Task 3: Create VerdictCard

**Files:**
- Create: `src/components/journey/intel-cards/verdict-card.tsx`

**Step 1: Write the component**

```tsx
// src/components/journey/intel-cards/verdict-card.tsx
'use client';

import { IntelCardHeader } from './intel-card-header';

function getVerdictColor(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('VALIDATED') || s.includes('PROCEED') && !s.includes('REFINEMENT')) return 'var(--accent-green, #22c55e)';
  if (s.includes('GROWING') || s.includes('STRONG')) return 'var(--accent-blue)';
  if (s.includes('CAUTION') || s.includes('REFINEMENT') || s.includes('MATURE')) return '#f59e0b';
  if (s.includes('NEEDS WORK') || s.includes('INVALID') || s.includes('DECLINING')) return 'var(--status-error, #ef4444)';
  return 'var(--accent-blue)';
}

export interface VerdictCardProps {
  sectionKey: string;
  label: string;
  status: string;
  summary?: string;
}

export function VerdictCard({ sectionKey, label, status, summary }: VerdictCardProps) {
  const color = getVerdictColor(status);
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label={label} />
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 12px',
        borderRadius: 6,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        marginBottom: summary ? 10 : 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', color, textTransform: 'uppercase' }}>
          {status}
        </span>
      </div>
      {summary && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {summary}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/journey/intel-cards/verdict-card.tsx
git commit -m "feat(intel-cards): VerdictCard with colored status badge"
```

---

## Task 4: Create ListCard

**Files:**
- Create: `src/components/journey/intel-cards/list-card.tsx`

**Step 1: Write the component**

```tsx
// src/components/journey/intel-cards/list-card.tsx
'use client';

import { motion } from 'framer-motion';
import { IntelCardHeader, SECTION_META } from './intel-card-header';

export interface ListCardProps {
  sectionKey: string;
  title: string;
  items: string[];
}

export function ListCard({ sectionKey, title, items }: ListCardProps) {
  const meta = SECTION_META[sectionKey] ?? { color: 'var(--accent-blue)' };
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label={title} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, flexShrink: 0, marginTop: 6 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/journey/intel-cards/list-card.tsx
git commit -m "feat(intel-cards): ListCard with staggered item animations"
```

---

## Task 5: Create CompetitorCard

**Files:**
- Create: `src/components/journey/intel-cards/competitor-card.tsx`

**Step 1: Write the component**

```tsx
// src/components/journey/intel-cards/competitor-card.tsx
'use client';

import { IntelCardHeader } from './intel-card-header';

export interface CompetitorCardProps {
  sectionKey: string;
  name: string;
  positioning?: string;
  weakness?: string;
  yourGap?: string;
}

export function CompetitorCard({ sectionKey, name, positioning, weakness, yourGap }: CompetitorCardProps) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label="Competitor" />
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
        {name}
      </p>
      {positioning && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.4, fontStyle: 'italic' }}>
          &ldquo;{positioning}&rdquo;
        </p>
      )}
      {weakness && (
        <div style={{ display: 'flex', gap: 8, marginBottom: yourGap ? 5 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-error, #ef4444)', flexShrink: 0, paddingTop: 1, letterSpacing: '0.02em' }}>
            WEAKNESS
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{weakness}</span>
        </div>
      )}
      {yourGap && (
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green, #22c55e)', flexShrink: 0, paddingTop: 1, letterSpacing: '0.02em' }}>
            YOUR GAP
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{yourGap}</span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/journey/intel-cards/competitor-card.tsx
git commit -m "feat(intel-cards): CompetitorCard with weakness/gap highlighting"
```

---

## Task 6: Create BudgetBarCard and QuoteCard

**Files:**
- Create: `src/components/journey/intel-cards/budget-bar-card.tsx`
- Create: `src/components/journey/intel-cards/quote-card.tsx`

**Step 1: Write BudgetBarCard**

```tsx
// src/components/journey/intel-cards/budget-bar-card.tsx
'use client';

import { motion } from 'framer-motion';
import { IntelCardHeader } from './intel-card-header';

const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn:  'var(--accent-blue)',
  Google:    '#ef4444',
  Meta:      '#3b5998',
  Facebook:  '#3b5998',
  Instagram: '#e1306c',
  Twitter:   '#1da1f2',
  TikTok:    '#000000',
};

export interface BudgetAllocation {
  platform: string;
  percentage: number;
  amount: string;
}

export interface BudgetBarCardProps {
  sectionKey: string;
  totalBudget?: string;
  allocations: BudgetAllocation[];
}

export function BudgetBarCard({ sectionKey, totalBudget, allocations }: BudgetBarCardProps) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label={totalBudget ? `Budget · ${totalBudget}` : 'Budget Allocation'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allocations.map((alloc, i) => {
          const color = PLATFORM_COLORS[alloc.platform] ?? 'var(--accent-purple, #a855f7)';
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{alloc.platform}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {alloc.percentage}%&nbsp;&nbsp;{alloc.amount}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--border-default)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${alloc.percentage}%` }}
                  transition={{ duration: 0.9, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', borderRadius: 3, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Write QuoteCard**

```tsx
// src/components/journey/intel-cards/quote-card.tsx
'use client';

import { IntelCardHeader } from './intel-card-header';

export interface QuoteCardProps {
  sectionKey: string;
  quote: string;
}

export function QuoteCard({ sectionKey, quote }: QuoteCardProps) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label="Positioning" />
      <blockquote style={{
        margin: 0,
        padding: '10px 14px',
        borderLeft: '3px solid var(--accent-blue)',
        background: 'color-mix(in srgb, var(--accent-blue) 6%, transparent)',
        borderRadius: '0 8px 8px 0',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
          &ldquo;{quote}&rdquo;
        </p>
      </blockquote>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/journey/intel-cards/budget-bar-card.tsx \
        src/components/journey/intel-cards/quote-card.tsx
git commit -m "feat(intel-cards): BudgetBarCard and QuoteCard"
```

---

## Task 7: Create buildSubsectionCards + intel-cards barrel

**Files:**
- Create: `src/components/journey/intel-cards/build-subsection-cards.ts`
- Create: `src/components/journey/intel-cards/index.ts`
- Test: `src/components/journey/intel-cards/__tests__/build-subsection-cards.test.ts`

**Step 1: Write the failing test first**

```ts
// src/components/journey/intel-cards/__tests__/build-subsection-cards.test.ts
import { describe, it, expect } from 'vitest';
import { buildSubsectionCards } from '../build-subsection-cards';

describe('buildSubsectionCards', () => {
  it('returns empty array for unknown section', () => {
    expect(buildSubsectionCards('unknown', {})).toHaveLength(0);
  });

  it('returns empty array when required data is missing (preamble fallback)', () => {
    const cards = buildSubsectionCards('industryMarket', { summary: "I'll research this market..." });
    expect(cards).toHaveLength(0);
  });

  it('returns verdict + list cards for valid industry data', () => {
    const data = {
      categorySnapshot: {
        category: 'Supply Chain Tech',
        marketMaturity: 'Growing',
        averageSalesCycle: '3-6 months',
      },
      painPoints: {
        primary: ['Pain 1', 'Pain 2', 'Pain 3'],
        triggers: ['Trigger 1'],
      },
      messagingOpportunities: { angles: ['Angle 1'] },
    };
    const cards = buildSubsectionCards('industryMarket', data);
    expect(cards[0].type).toBe('verdict');
    expect(cards[1].type).toBe('list');
    expect(cards[1].props.title).toBe('Top Pain Points');
    expect(cards[1].props.items).toHaveLength(3);
  });

  it('builds one competitor card per competitor', () => {
    const data = {
      competitors: [
        { name: 'Cogsy', positioning: 'Smart inventory', weaknesses: ['Accuracy issues'], threatAssessment: { counterPositioning: 'Lead 94%' } },
        { name: 'Inventory Planner', positioning: 'Shopify native', weaknesses: ['No ML'] },
      ],
      whiteSpaceGaps: [{ gap: 'ML prediction' }],
    };
    const cards = buildSubsectionCards('competitors', data);
    expect(cards[0].type).toBe('verdict');
    expect(cards[1].type).toBe('competitor');
    expect(cards[1].props.name).toBe('Cogsy');
    expect(cards[2].type).toBe('competitor');
    expect(cards[2].props.name).toBe('Inventory Planner');
  });

  it('builds stat card for ICP fit score', () => {
    const data = {
      finalVerdict: { status: 'Validated', summary: 'Good fit for mid-market DTC' },
      painSolutionFit: { fitScore: 8.5, primaryPain: 'Stockouts' },
    };
    const cards = buildSubsectionCards('icpValidation', data);
    expect(cards[0].type).toBe('verdict');
    expect(cards[0].props.status).toBe('Validated');
    expect(cards[1].type).toBe('stat');
    expect(cards[1].props.value).toBe(8.5);
  });

  it('builds budget bar card for synthesis with valid platform allocations', () => {
    const data = {
      positioningStrategy: { recommendedAngle: 'Lead with 94% accuracy' },
      platformRecommendations: [
        { platform: 'LinkedIn', budgetAllocation: '55% ($8,250)' },
        { platform: 'Google', budgetAllocation: '25% ($3,750)' },
      ],
      messagingAngles: [{ exampleHook: 'Still in spreadsheets?' }],
      nextSteps: ['Step 1', 'Step 2'],
    };
    const cards = buildSubsectionCards('crossAnalysis', data);
    expect(cards[0].type).toBe('quote');
    expect(cards[1].type).toBe('budgetBar');
    expect(cards[1].props.allocations).toHaveLength(2);
    expect(cards[1].props.allocations[0].percentage).toBe(55);
    expect(cards[1].props.allocations[0].amount).toBe('$8,250');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/components/journey/intel-cards/__tests__/build-subsection-cards.test.ts
```
Expected: FAIL — "Cannot find module '../build-subsection-cards'"

**Step 3: Write buildSubsectionCards**

```ts
// src/components/journey/intel-cards/build-subsection-cards.ts
import type { StatCardProps } from './stat-card';
import type { VerdictCardProps } from './verdict-card';
import type { ListCardProps } from './list-card';
import type { CompetitorCardProps } from './competitor-card';
import type { BudgetBarCardProps, BudgetAllocation } from './budget-bar-card';
import type { QuoteCardProps } from './quote-card';

type CardConfig =
  | { type: 'stat';        props: StatCardProps }
  | { type: 'verdict';     props: VerdictCardProps }
  | { type: 'list';        props: ListCardProps }
  | { type: 'competitor';  props: CompetitorCardProps }
  | { type: 'budgetBar';   props: BudgetBarCardProps }
  | { type: 'quote';       props: QuoteCardProps };

export interface SubsectionCard extends CardConfig {
  id: string;
}

const get = <T,>(obj: unknown, key: string): T | undefined =>
  (obj as Record<string, T> | undefined)?.[key];

const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];

const str = (v: unknown): string => {
  if (typeof v === 'string') return v;
  return (
    get<string>(v, 'insight') ??
    get<string>(v, 'point') ??
    get<string>(v, 'name') ??
    get<string>(v, 'angle') ??
    get<string>(v, 'factor') ??
    ''
  );
};

export function buildSubsectionCards(
  sectionKey: string,
  data: Record<string, unknown>
): SubsectionCard[] {
  try {
    if (sectionKey === 'industryMarket') return buildIndustry(sectionKey, data);
    if (sectionKey === 'competitors')    return buildCompetitors(sectionKey, data);
    if (sectionKey === 'icpValidation')  return buildICP(sectionKey, data);
    if (sectionKey === 'offerAnalysis')  return buildOffer(sectionKey, data);
    if (sectionKey === 'crossAnalysis')  return buildSynthesis(sectionKey, data);
    if (sectionKey === 'keywordIntel')   return buildKeywords(sectionKey, data);
  } catch {
    // research data shapes vary — never crash the UI
  }
  return [];
}

function buildIndustry(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const snap = get<Record<string, unknown>>(data, 'categorySnapshot');
  if (!snap) return [];

  const painPoints = get<Record<string, unknown>>(data, 'painPoints');
  const primary = arr(get(painPoints, 'primary')).map(str).filter(Boolean);
  const triggers = arr(get(painPoints, 'triggers')).map(str).filter(Boolean);
  const messaging = get<Record<string, unknown>>(data, 'messagingOpportunities');
  const angles = arr(get(messaging, 'angles')).map(str).filter(Boolean);

  return [
    {
      id: `${sectionKey}-verdict`,
      type: 'verdict',
      props: {
        sectionKey,
        label: 'Market',
        status: (get<string>(snap, 'marketMaturity') ?? 'Unknown').toUpperCase(),
        summary: [get<string>(snap, 'category'), get<string>(snap, 'averageSalesCycle') ? `${get<string>(snap, 'averageSalesCycle')} sales cycle` : ''].filter(Boolean).join(' · '),
      },
    },
    primary.length > 0 ? { id: `${sectionKey}-pains`, type: 'list' as const, props: { sectionKey, title: 'Top Pain Points', items: primary.slice(0, 3) } } : null,
    triggers.length > 0 ? { id: `${sectionKey}-triggers`, type: 'list' as const, props: { sectionKey, title: 'Buying Triggers', items: triggers.slice(0, 3) } } : null,
    angles.length > 0 ? { id: `${sectionKey}-angles`, type: 'list' as const, props: { sectionKey, title: 'Messaging Angles', items: angles.slice(0, 3) } } : null,
  ].filter((c): c is SubsectionCard => c !== null);
}

function buildCompetitors(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const competitors = arr(data.competitors);
  if (!competitors.length) return [];

  const gaps = arr(data.whiteSpaceGaps);
  const competitorCards: SubsectionCard[] = competitors.slice(0, 3).map((comp, i) => {
    const c = comp as Record<string, unknown>;
    const threat = get<Record<string, unknown>>(c, 'threatAssessment');
    const weaknesses = arr(get(c, 'weaknesses')).map(str).filter(Boolean);
    return {
      id: `${sectionKey}-comp-${i}`,
      type: 'competitor' as const,
      props: {
        sectionKey,
        name: get<string>(c, 'name') ?? `Competitor ${i + 1}`,
        positioning: get<string>(c, 'positioning'),
        weakness: weaknesses[0],
        yourGap: get<string>(threat, 'counterPositioning'),
      },
    };
  });

  return [
    {
      id: `${sectionKey}-summary`,
      type: 'verdict',
      props: {
        sectionKey,
        label: 'Competitors',
        status: `${competitors.length} competitor${competitors.length !== 1 ? 's' : ''} analyzed`,
        summary: gaps.length > 0 ? `${gaps.length} white-space gap${gaps.length !== 1 ? 's' : ''} found` : undefined,
      },
    },
    ...competitorCards,
  ];
}

function buildICP(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const verdict = get<Record<string, unknown>>(data, 'finalVerdict');
  if (!verdict) return [];

  const fit = get<Record<string, unknown>>(data, 'painSolutionFit');
  const fitScore = get<number>(fit, 'fitScore');

  return [
    {
      id: `${sectionKey}-verdict`,
      type: 'verdict',
      props: {
        sectionKey,
        label: 'ICP Validation',
        status: get<string>(verdict, 'status') ?? 'Analyzed',
        summary: get<string>(verdict, 'summary'),
      },
    },
    fitScore !== undefined ? {
      id: `${sectionKey}-score`,
      type: 'stat' as const,
      props: { sectionKey, label: 'Fit Score', value: fitScore, max: 10 },
    } : null,
  ].filter((c): c is SubsectionCard => c !== null);
}

function buildOffer(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const strength = get<Record<string, unknown>>(data, 'offerStrength');
  const overallScore = get<number>(strength, 'overallScore') ?? get<number>(data, 'overallScore');
  const recommendation = get<string>(data, 'recommendationStatus') ?? get<string>(data, 'recommendation') ?? '';
  if (!recommendation && overallScore === undefined) return [];

  const breakdown = strength
    ? Object.entries(strength)
        .filter(([k, v]) => k !== 'overallScore' && typeof v === 'number')
        .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()}: ${v}/10`)
    : [];

  return [
    recommendation ? {
      id: `${sectionKey}-verdict`,
      type: 'verdict' as const,
      props: { sectionKey, label: 'Offer Analysis', status: recommendation },
    } : null,
    overallScore !== undefined ? {
      id: `${sectionKey}-score`,
      type: 'stat' as const,
      props: { sectionKey, label: 'Offer Score', value: overallScore, max: 10 },
    } : null,
    breakdown.length > 0 ? {
      id: `${sectionKey}-breakdown`,
      type: 'list' as const,
      props: { sectionKey, title: 'Strength Breakdown', items: breakdown },
    } : null,
  ].filter((c): c is SubsectionCard => c !== null);
}

function buildSynthesis(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const positioningStrategy = get<Record<string, unknown>>(data, 'positioningStrategy');
  const positioningAngle = get<string>(positioningStrategy, 'recommendedAngle') ?? '';
  const platforms = arr(data.platformRecommendations);
  const messagingAngles = arr(data.messagingAngles);
  const hooks = messagingAngles
    .map((m) => get<string>(m as Record<string, unknown>, 'exampleHook') ?? get<string>(m as Record<string, unknown>, 'angle') ?? '')
    .filter(Boolean);
  const nextSteps = arr(data.nextSteps).map(str).filter(Boolean);

  const allocations: BudgetAllocation[] = platforms
    .map((p) => {
      const platform = p as Record<string, unknown>;
      const budgetStr = get<string>(platform, 'budgetAllocation') ?? '';
      const pctMatch = budgetStr.match(/(\d+)%/);
      const amountMatch = budgetStr.match(/(\$[\d,]+)/);
      return {
        platform: get<string>(platform, 'platform') ?? '',
        percentage: pctMatch ? parseInt(pctMatch[1]) : 0,
        amount: amountMatch ? amountMatch[1] : '',
      };
    })
    .filter((a) => a.platform && a.percentage > 0);

  return [
    positioningAngle ? { id: `${sectionKey}-quote`, type: 'quote' as const, props: { sectionKey, quote: positioningAngle } } : null,
    allocations.length > 0 ? { id: `${sectionKey}-budget`, type: 'budgetBar' as const, props: { sectionKey, allocations } } : null,
    hooks.length > 0 ? { id: `${sectionKey}-hooks`, type: 'list' as const, props: { sectionKey, title: 'Ad Hooks', items: hooks.slice(0, 3) } } : null,
    nextSteps.length > 0 ? { id: `${sectionKey}-next`, type: 'list' as const, props: { sectionKey, title: 'Next Steps', items: nextSteps.slice(0, 5) } } : null,
  ].filter((c): c is SubsectionCard => c !== null);
}

function buildKeywords(sectionKey: string, data: Record<string, unknown>): SubsectionCard[] {
  const total = data.totalKeywordsFound as number | undefined;
  const gaps = data.competitorGapCount as number | undefined;
  const opportunities = arr(data.topOpportunities);
  const competitorGaps = arr(data.competitorGaps);

  const oppItems = opportunities.slice(0, 3).map((o) => {
    const opp = o as Record<string, unknown>;
    const kw = get<string>(opp, 'keyword') ?? '';
    const vol = get<number>(opp, 'searchVolume');
    return vol ? `"${kw}"  ·  Vol ${vol.toLocaleString()}` : `"${kw}"`;
  }).filter(Boolean);

  const gapItems = competitorGaps.slice(0, 3).map((g) => {
    const gap = g as Record<string, unknown>;
    const kw = get<string>(gap, 'keyword') ?? '';
    const comp = get<string>(gap, 'competitorName') ?? '';
    return `"${kw}" — ${comp} ranks, you don't`;
  }).filter(Boolean);

  return [
    {
      id: `${sectionKey}-summary`,
      type: 'verdict',
      props: {
        sectionKey,
        label: 'Keyword Intel',
        status: total ? `${total} keywords` : 'Keywords analyzed',
        summary: gaps ? `${gaps} competitor gap${gaps !== 1 ? 's' : ''} found` : undefined,
      },
    },
    oppItems.length > 0 ? { id: `${sectionKey}-opps`, type: 'list' as const, props: { sectionKey, title: 'Top Opportunities', items: oppItems } } : null,
    gapItems.length > 0 ? { id: `${sectionKey}-gaps`, type: 'list' as const, props: { sectionKey, title: 'Competitor Gaps', items: gapItems } } : null,
  ].filter((c): c is SubsectionCard => c !== null);
}
```

**Step 4: Write the barrel index**

```ts
// src/components/journey/intel-cards/index.ts
export { StatCard } from './stat-card';
export { VerdictCard } from './verdict-card';
export { ListCard } from './list-card';
export { CompetitorCard } from './competitor-card';
export { BudgetBarCard } from './budget-bar-card';
export { QuoteCard } from './quote-card';
export { buildSubsectionCards } from './build-subsection-cards';
export type { SubsectionCard } from './build-subsection-cards';
export type { StatCardProps } from './stat-card';
export type { VerdictCardProps } from './verdict-card';
export type { ListCardProps } from './list-card';
export type { CompetitorCardProps } from './competitor-card';
export type { BudgetBarCardProps, BudgetAllocation } from './budget-bar-card';
export type { QuoteCardProps } from './quote-card';
```

**Step 5: Run the tests**

```bash
npm run test:run -- src/components/journey/intel-cards/__tests__/build-subsection-cards.test.ts
```
Expected: All 5 tests PASS.

**Step 6: Commit**

```bash
git add src/components/journey/intel-cards/
git commit -m "feat(intel-cards): buildSubsectionCards mapper + barrel export"
```

---

## Task 8: Create useSubsectionReveal hook

**Files:**
- Create: `src/hooks/use-subsection-reveal.ts`

**Step 1: Write the hook**

```ts
// src/hooks/use-subsection-reveal.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import { buildSubsectionCards } from '@/components/journey/intel-cards/build-subsection-cards';
import type { SubsectionCard } from '@/components/journey/intel-cards/build-subsection-cards';

export function useSubsectionReveal(
  sectionKey: string,
  data: Record<string, unknown> | null | undefined,
  status: 'pending' | 'running' | 'complete' | 'error',
  delayMs = 1500
): SubsectionCard[] {
  const [revealed, setRevealed] = useState<SubsectionCard[]>([]);
  const scheduledRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Only run once per section completion
    if (status !== 'complete' || !data || scheduledRef.current) return;
    scheduledRef.current = true;

    const cards = buildSubsectionCards(sectionKey, data);
    cards.forEach((card, index) => {
      const timer = setTimeout(() => {
        setRevealed((prev) => [...prev, card]);
      }, index * delayMs);
      timersRef.current.push(timer);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [status, sectionKey, data, delayMs]);

  // Reset if section goes back to non-complete (edge case)
  useEffect(() => {
    if (status === 'pending' || status === 'running') {
      setRevealed([]);
      scheduledRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
  }, [status]);

  return revealed;
}
```

**Step 2: Verify types**

```bash
npx tsc --noEmit 2>&1 | grep use-subsection-reveal
```
Expected: No output.

**Step 3: Commit**

```bash
git add src/hooks/use-subsection-reveal.ts
git commit -m "feat(hooks): useSubsectionReveal schedules card reveals with stagger"
```

---

## Task 9: Create ResearchSubsectionReveal component

**Files:**
- Create: `src/components/journey/research-subsection-reveal.tsx`

**Step 1: Write the component**

```tsx
// src/components/journey/research-subsection-reveal.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSubsectionReveal } from '@/hooks/use-subsection-reveal';
import {
  StatCard, VerdictCard, ListCard, CompetitorCard, BudgetBarCard, QuoteCard,
} from './intel-cards';
import type { SubsectionCard } from './intel-cards';

function renderCard(card: SubsectionCard) {
  switch (card.type) {
    case 'stat':        return <StatCard        {...(card.props as Parameters<typeof StatCard>[0])} />;
    case 'verdict':     return <VerdictCard     {...(card.props as Parameters<typeof VerdictCard>[0])} />;
    case 'list':        return <ListCard        {...(card.props as Parameters<typeof ListCard>[0])} />;
    case 'competitor':  return <CompetitorCard  {...(card.props as Parameters<typeof CompetitorCard>[0])} />;
    case 'budgetBar':   return <BudgetBarCard   {...(card.props as Parameters<typeof BudgetBarCard>[0])} />;
    case 'quote':       return <QuoteCard       {...(card.props as Parameters<typeof QuoteCard>[0])} />;
  }
}

interface ResearchSubsectionRevealProps {
  sectionKey: string;
  data: Record<string, unknown> | null | undefined;
  status: 'pending' | 'running' | 'complete' | 'error';
  delayMs?: number;
}

export function ResearchSubsectionReveal({
  sectionKey,
  data,
  status,
  delayMs = 1500,
}: ResearchSubsectionRevealProps) {
  const cards = useSubsectionReveal(sectionKey, data, status, delayMs);

  if (cards.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <AnimatePresence>
        {cards.map((card) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderCard(card)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

**Step 2: Verify types**

```bash
npx tsc --noEmit 2>&1 | grep research-subsection-reveal
```
Expected: No output.

**Step 3: Commit**

```bash
git add src/components/journey/research-subsection-reveal.tsx
git commit -m "feat: ResearchSubsectionReveal wires hook to animated card stack"
```

---

## Task 10: Wire cards into chat-message.tsx

**Files:**
- Modify: `src/components/journey/chat-message.tsx`

**Step 1: Read the current file first**

```bash
# Read the file to understand current tool-part rendering
# Look for RESEARCH_TOOL_SECTIONS and how ResearchInlineCard is currently called
```

Open `src/components/journey/chat-message.tsx`. Find:
1. The `RESEARCH_TOOL_SECTIONS` map (maps tool type → section key)
2. Where `ResearchInlineCard` is rendered for research tool parts

**Step 2: Add keywordIntel to RESEARCH_TOOL_SECTIONS**

Find the `RESEARCH_TOOL_SECTIONS` object and add the keywords tool:

```ts
const RESEARCH_TOOL_SECTIONS: Record<string, string> = {
  'tool-researchIndustry':    'industryMarket',
  'tool-researchCompetitors': 'competitors',
  'tool-researchICP':         'icpValidation',
  'tool-researchOffer':       'offerAnalysis',
  'tool-synthesizeResearch':  'crossAnalysis',
  'tool-researchKeywords':    'keywordIntel',   // ← add this line
};
```

**Step 3: Import ResearchSubsectionReveal**

At the top of the file, add:

```ts
import { ResearchSubsectionReveal } from './research-subsection-reveal';
```

**Step 4: Replace complete-state rendering**

Find the section that renders research tool parts (look for where `ResearchInlineCard` is rendered with `status="complete"`). The current code looks roughly like:

```tsx
// CURRENT — replace this complete-state block:
{status === 'complete' && (
  <ResearchInlineCard
    section={sectionKey}
    status="complete"
    data={output?.data}
    durationMs={output?.durationMs}
    onViewFull={...}
  />
)}
```

Replace the complete state with:

```tsx
// NEW — show loading card while running, subsection cards when complete
{isComplete && (
  <div>
    {/* Compact completion line */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', marginBottom: 4 }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent-green, #22c55e) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1.5 4L3 5.5L6.5 2" stroke="var(--accent-green, #22c55e)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        {SECTION_LABELS[sectionKey] ?? sectionKey}
        {output?.durationMs ? ` · ${(output.durationMs / 1000).toFixed(1)}s` : ''}
      </span>
    </div>
    {/* Subsection cards reveal */}
    <ResearchSubsectionReveal
      sectionKey={sectionKey}
      data={output?.data as Record<string, unknown> | null}
      status="complete"
    />
  </div>
)}
```

Add the `SECTION_LABELS` constant near `RESEARCH_TOOL_SECTIONS`:

```ts
const SECTION_LABELS: Record<string, string> = {
  industryMarket: 'Industry & Market Research',
  competitors:    'Competitor Analysis',
  icpValidation:  'ICP Validation',
  offerAnalysis:  'Offer Analysis',
  crossAnalysis:  'Strategic Synthesis',
  keywordIntel:   'Keyword Intelligence',
};
```

Keep loading/error states using `ResearchInlineCard` as-is — only the `complete` state changes.

**Step 5: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: Clean build, no TypeScript errors.

**Step 6: Commit**

```bash
git add src/components/journey/chat-message.tsx
git commit -m "feat(chat): wire subsection reveal cards into research tool rendering"
```

---

## Task 11: Create research-keywords.ts tool

**Files:**
- Create: `src/lib/ai/tools/research/research-keywords.ts`

**Step 1: First, check the SpyFu MCP wrapper**

Read `src/lib/ai/tools/mcp/` to understand the spyFu betaZodTool interface. The wrapper is already built (Sprint 3 T3.2). Note the tool name and input schema.

**Step 2: Write the keywords tool**

```ts
// src/lib/ai/tools/research/research-keywords.ts
import { tool } from 'ai';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { spyFu } from '@/lib/ai/tools/mcp/spyfu';

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {}
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) { return JSON.parse(trimmed.slice(first, last + 1)); }
  throw new Error('No parseable JSON found');
}

const KEYWORDS_SYSTEM_PROMPT = `You are a paid search keyword intelligence specialist.

TASK: Find the highest-value keyword opportunities for this business to target with paid search.

RESEARCH FOCUS:
1. Head terms with buying intent ("inventory forecasting software", "stockout prevention")
2. Competitor alternative terms ("[competitor name] alternative", "[competitor] vs [product]")
3. Pain-point terms ("prevent stockouts", "reduce inventory costs")
4. Long-tail terms with lower competition and clear intent

TOOL USAGE:
Use the spyFu tool to:
1. Look up organic/paid keywords for the main category
2. Find what competitor keywords they rank for that you don't
3. Identify high-volume, lower-difficulty opportunities

OUTPUT FORMAT:
Respond with JSON only. No preamble. No markdown fences. Start with {.

{
  "totalKeywordsFound": number,
  "competitorGapCount": number,
  "topOpportunities": [
    {
      "keyword": "string",
      "searchVolume": number,
      "difficulty": "low | medium | high",
      "estimatedCpc": "string e.g. $4.20"
    }
  ],
  "competitorGaps": [
    {
      "keyword": "string",
      "competitorName": "string",
      "volume": number
    }
  ],
  "quickWins": ["string — 3 immediately actionable recommendations"]
}`;

export const researchKeywords = tool({
  description:
    'Research keyword intelligence for paid search campaigns. ' +
    'Runs a Claude Opus sub-agent with SpyFu to identify high-value search terms, ' +
    'competitor keyword gaps, and quick-win opportunities. ' +
    'Call this after synthesizeResearch completes.',
  inputSchema: z.object({
    context: z.string().describe(
      'Business context including product description, competitors identified, and platform recommendations from synthesis'
    ),
  }),
  execute: async ({ context }) => {
    const client = new Anthropic();
    const startTime = Date.now();

    try {
      const stream = client.beta.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        tools: [spyFu],
        system: KEYWORDS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Find keyword opportunities for:\n\n${context}` }],
      });

      const finalMsg = await stream.finalMessage();
      const textBlock = finalMsg.content.findLast((b) => b.type === 'text');
      const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';

      let data: unknown;
      try { data = extractJson(resultText); } catch {
        console.error('[researchKeywords] JSON extraction failed:', resultText.slice(0, 200));
        data = { summary: resultText };
      }

      return {
        status: 'complete' as const,
        section: 'keywordIntel' as const,
        data,
        sources: [],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        section: 'keywordIntel' as const,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
```

**Step 3: Commit**

```bash
git add src/lib/ai/tools/research/research-keywords.ts
git commit -m "feat(research): researchKeywords tool using SpyFu sub-agent"
```

---

## Task 12: Wire keywords tool into the pipeline

**Files:**
- Modify: `src/lib/ai/tools/research/index.ts`
- Modify: `src/app/api/journey/stream/route.ts`
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`

**Step 1: Export from index**

Open `src/lib/ai/tools/research/index.ts`. Add:

```ts
export { researchKeywords } from './research-keywords';
```

**Step 2: Register tool in the streaming route**

Open `src/app/api/journey/stream/route.ts`. Find where the 5 research tools are registered and add `researchKeywords`:

```ts
import {
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,   // ← add
} from '@/lib/ai/tools/research';

// In the streamText tools object:
tools: {
  askUser,
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,   // ← add
},
```

**Step 3: Add trigger to lead agent system prompt**

Open `src/lib/ai/prompts/lead-agent-system.ts`. Find the section that defines research tool triggers. After the `synthesizeResearch` trigger, add:

```
## researchKeywords trigger
Call researchKeywords immediately after synthesizeResearch completes.
Pass as context: the business description, the competitor names identified, and the platform recommendations from synthesis.
This is the final research step — run it in parallel with presenting the synthesis to the user.
```

**Step 4: Build and verify**

```bash
npm run build 2>&1 | tail -20
```
Expected: Clean build.

**Step 5: Commit**

```bash
git add src/lib/ai/tools/research/index.ts \
        src/app/api/journey/stream/route.ts \
        src/lib/ai/prompts/lead-agent-system.ts
git commit -m "feat: wire researchKeywords into journey pipeline"
```

---

## Task 13: Full build + manual smoke test

**Step 1: Run all tests**

```bash
npm run test:run
```
Expected: All tests pass. The pre-existing TS errors in openrouter/chat-blueprint tests are OK — ignore them.

**Step 2: Production build**

```bash
npm run build
```
Expected: Exit 0, no TypeScript errors.

**Step 3: Manual smoke test**

Start dev server (in tmux):
```bash
tmux new-session -d -s dev "npm run dev"
```

Open `http://localhost:3000/journey`. Clear localStorage. Go through the onboarding:
1. Type a business description and submit
2. After Q1 radio answer → watch for industry cards appearing in chat
3. After Q2 free text → watch for competitor + offer cards
4. After Q3 radio → watch for ICP cards
5. After Q8 radio → watch for synthesis cards (takes ~2 min)
6. After synthesis → watch for keyword cards

**What to verify:**
- [ ] Loading cards still show animated scanning phrases while research runs
- [ ] When complete, compact "✓ Section name · Xs" line appears
- [ ] Subsection cards appear below it, one every 1.5 seconds
- [ ] VerdictCard shows colored badge (GROWING / VALIDATED / PROCEED)
- [ ] StatCard shows large number with animated fill bar
- [ ] BudgetBarCard bars animate in sequentially
- [ ] No blank cards (P0 fix worked)
- [ ] Console shows no errors

**Step 4: Final commit (if any cleanup needed)**

```bash
git add -p  # review and stage only relevant changes
git commit -m "chore: sprint4 intel cards smoke test cleanup"
```

---

## Files Created/Modified Summary

| File | Action |
|------|--------|
| `src/lib/ai/tools/research/research-industry.ts` | Modified — findLast fix |
| `src/lib/ai/tools/research/research-competitors.ts` | Modified — findLast fix |
| `src/lib/ai/tools/research/research-icp.ts` | Modified — findLast fix |
| `src/lib/ai/tools/research/research-offer.ts` | Modified — findLast fix |
| `src/components/journey/intel-cards/intel-card-header.tsx` | Created |
| `src/components/journey/intel-cards/stat-card.tsx` | Created |
| `src/components/journey/intel-cards/verdict-card.tsx` | Created |
| `src/components/journey/intel-cards/list-card.tsx` | Created |
| `src/components/journey/intel-cards/competitor-card.tsx` | Created |
| `src/components/journey/intel-cards/budget-bar-card.tsx` | Created |
| `src/components/journey/intel-cards/quote-card.tsx` | Created |
| `src/components/journey/intel-cards/build-subsection-cards.ts` | Created |
| `src/components/journey/intel-cards/index.ts` | Created |
| `src/components/journey/intel-cards/__tests__/build-subsection-cards.test.ts` | Created |
| `src/hooks/use-subsection-reveal.ts` | Created |
| `src/components/journey/research-subsection-reveal.tsx` | Created |
| `src/components/journey/chat-message.tsx` | Modified — wire subsection reveal |
| `src/lib/ai/tools/research/research-keywords.ts` | Created |
| `src/lib/ai/tools/research/index.ts` | Modified — export keywords |
| `src/app/api/journey/stream/route.ts` | Modified — register keywords tool |
| `src/lib/ai/prompts/lead-agent-system.ts` | Modified — keywords trigger |
