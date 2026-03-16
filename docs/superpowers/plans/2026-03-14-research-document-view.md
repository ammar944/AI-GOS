# Research Document View + Section Navigation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add section tab navigation to the workspace and a read-only research document viewer at `/research/[sessionId]`, accessible from the dashboard.

**Architecture:** Extract shared `CardContentSwitch` and `SectionTabs` components. Workspace gets `navigateToSection` + tab pills replacing `StatusStrip`. New `/research/[sessionId]` route fetches from Supabase and renders cards read-only. Dashboard gets a "Research" tab listing completed sessions.

**Tech Stack:** Next.js 15 (App Router), React, Framer Motion, Supabase (service role client), Clerk auth, existing workspace card components

**Spec:** `docs/superpowers/specs/2026-03-14-research-document-view-design.md`

---

## Chunk 1: Shared Infrastructure + Workspace Navigation

### Task 1: Extract CardContentSwitch into card-renderer.tsx

**Files:**
- Create: `src/components/research/card-renderer.tsx`
- Modify: `src/components/workspace/artifact-canvas.tsx`

- [ ] **Step 1: Create card-renderer.tsx with CardContentSwitch**

Extract the `CardContent` switch statement from `artifact-canvas.tsx` into a standalone component. This is the card type → component mapping used by both workspace and document views.

```tsx
// src/components/research/card-renderer.tsx
'use client';

import { motion } from 'framer-motion';
import { CardEditingContext, useCardEditing } from '@/lib/workspace/card-editing-context';
import { ArtifactCard } from '@/components/workspace/artifact-card';
import { StatGrid } from '@/components/workspace/cards/stat-grid';
import { BulletList } from '@/components/workspace/cards/bullet-list';
import { CheckList } from '@/components/workspace/cards/check-list';
import { ProseCard } from '@/components/workspace/cards/prose-card';
import { TrendCard } from '@/components/workspace/cards/trend-card';
import { CompetitorCard } from '@/components/workspace/cards/competitor-card';
import { GapCard } from '@/components/workspace/cards/gap-card';
import { VerdictCard } from '@/components/workspace/cards/verdict-card';
import { PricingCard } from '@/components/workspace/cards/pricing-card';
import { FlagCard } from '@/components/workspace/cards/flag-card';
import { StrategyCard } from '@/components/workspace/cards/strategy-card';
import { InsightCard } from '@/components/workspace/cards/insight-card';
import { PlatformCard } from '@/components/workspace/cards/platform-card';
import { AngleCard } from '@/components/workspace/cards/angle-card';
import { ChartCard } from '@/components/workspace/cards/chart-card';
import {
  JourneyKeywordIntelDetail,
  getJourneyKeywordIntelDetailData,
} from '@/components/journey/journey-keyword-intel-detail';
import type { CardState } from '@/lib/workspace/types';

/**
 * Pure switch statement mapping card.cardType → component.
 * Consumes CardEditingContext for editable cards (stat-grid, bullet-list, check-list, prose-card).
 * Stateless — all editing state comes from context.
 */
export function CardContentSwitch({ card }: { card: CardState }) {
  const { isEditing, draftContent, updateDraft } = useCardEditing();
  const content = isEditing ? draftContent : card.content;

  switch (card.cardType) {
    case 'stat-grid':
      return (
        <StatGrid
          stats={content.stats as { label: string; value: string; badge?: string; badgeColor?: string }[]}
          isEditing={isEditing}
          onStatsChange={(stats) => updateDraft({ stats })}
        />
      );
    case 'bullet-list':
      return (
        <BulletList
          title={card.label}
          items={content.items as string[]}
          accent={content.accent as string | undefined}
          isEditing={isEditing}
          onItemsChange={(items) => updateDraft({ items })}
        />
      );
    case 'check-list':
      return (
        <CheckList
          title={card.label}
          items={content.items as string[]}
          accent={content.accent as string | undefined}
          isEditing={isEditing}
          onItemsChange={(items) => updateDraft({ items })}
        />
      );
    case 'prose-card':
      return (
        <ProseCard
          title={card.label}
          text={content.text as string}
          isEditing={isEditing}
          onTextChange={(text) => updateDraft({ text })}
        />
      );
    case 'trend-card':
      return <TrendCard trend={card.content.trend as string} direction={card.content.direction as string} evidence={card.content.evidence as string} />;
    case 'competitor-card': {
      const c = card.content;
      return (
        <CompetitorCard
          name={c.name as string}
          website={c.website as string | undefined}
          positioning={c.positioning as string | undefined}
          price={c.price as string | undefined}
          pricingConfidence={c.pricingConfidence as string | undefined}
          strengths={(c.strengths ?? []) as string[]}
          weaknesses={(c.weaknesses ?? []) as string[]}
          opportunities={(c.opportunities ?? []) as string[]}
          ourAdvantage={c.ourAdvantage as string | undefined}
          adActivity={c.adActivity as { activeAdCount: number; platforms: string[]; themes: string[]; evidence: string; sourceConfidence: 'high' | 'medium' | 'low' } | undefined}
          adCreatives={c.adCreatives as Array<{ platform: 'linkedin' | 'meta' | 'google'; id: string; advertiser: string; headline?: string; body?: string; imageUrl?: string; videoUrl?: string; format: 'video' | 'image' | 'carousel' | 'text' | 'message' | 'unknown'; isActive: boolean; detailsUrl?: string; firstSeen?: string; lastSeen?: string }> | undefined}
          libraryLinks={c.libraryLinks as { metaLibraryUrl?: string; linkedInLibraryUrl?: string; googleAdvertiserUrl?: string } | undefined}
          topAdHooks={(c.topAdHooks ?? []) as string[]}
          counterPositioning={c.counterPositioning as string | undefined}
        />
      );
    }
    case 'gap-card':
      return (
        <GapCard
          gap={card.content.gap as string}
          type={card.content.type as string | undefined}
          evidence={card.content.evidence as string | undefined}
          exploitability={card.content.exploitability as number | undefined}
          impact={card.content.impact as number | undefined}
          recommendedAction={card.content.recommendedAction as string | undefined}
        />
      );
    case 'verdict-card':
      return <VerdictCard status={card.content.status as string} reasoning={card.content.reasoning as string | undefined} />;
    case 'pricing-card':
      return (
        <PricingCard
          currentPricing={card.content.currentPricing as string | undefined}
          marketBenchmark={card.content.marketBenchmark as string | undefined}
          pricingPosition={card.content.pricingPosition as string | undefined}
          coldTrafficViability={card.content.coldTrafficViability as string | undefined}
        />
      );
    case 'flag-card':
      return (
        <FlagCard
          issue={card.content.issue as string}
          severity={card.content.severity as string | undefined}
          priority={card.content.priority as number | undefined}
          evidence={card.content.evidence as string | undefined}
          recommendedAction={card.content.recommendedAction as string | undefined}
        />
      );
    case 'strategy-card':
      return (
        <StrategyCard
          recommendedAngle={card.content.recommendedAngle as string | undefined}
          leadRecommendation={card.content.leadRecommendation as string | undefined}
          keyDifferentiator={card.content.keyDifferentiator as string | undefined}
        />
      );
    case 'insight-card':
      return (
        <InsightCard
          insight={card.content.insight as string}
          source={card.content.source as string | undefined}
          implication={card.content.implication as string | undefined}
        />
      );
    case 'platform-card':
      return (
        <PlatformCard
          platform={card.content.platform as string}
          role={card.content.role as string | undefined}
          budgetAllocation={card.content.budgetAllocation as string | undefined}
          rationale={card.content.rationale as string | undefined}
        />
      );
    case 'angle-card':
      return (
        <AngleCard
          angle={card.content.angle as string}
          exampleHook={card.content.exampleHook as string | undefined}
          evidence={card.content.evidence as string | undefined}
        />
      );
    case 'chart-card':
      return (
        <ChartCard
          title={card.content.title as string}
          description={card.content.description as string | undefined}
          imageUrl={card.content.imageUrl as string | undefined}
        />
      );
    case 'keyword-grid': {
      const rawData = card.content.rawData as Record<string, unknown>;
      const normalized = getJourneyKeywordIntelDetailData(rawData);
      if (!normalized) return <p className="text-sm text-[var(--text-secondary)]">Keyword intelligence could not be rendered.</p>;
      return <JourneyKeywordIntelDetail data={normalized} />;
    }
    default:
      return <p className="text-xs text-[var(--text-tertiary)]">Unknown card type: {card.cardType}</p>;
  }
}

// Read-only context value — no editing, just provides card.content to useCardEditing consumers
const READ_ONLY_CONTEXT = {
  isEditing: false,
  draftContent: {},
  updateDraft: () => {},
};

interface CardRendererProps {
  card: CardState;
  mode: 'workspace' | 'document';
  index?: number;
}

/**
 * Renders a card in workspace (editable via ArtifactCard) or document (read-only) mode.
 */
export function CardRenderer({ card, mode, index = 0 }: CardRendererProps) {
  if (mode === 'workspace') {
    return (
      <ArtifactCard card={card} index={index}>
        <CardContentSwitch card={card} />
      </ArtifactCard>
    );
  }

  // Document mode: read-only container with static CardEditingContext
  const readOnlyContext = {
    ...READ_ONLY_CONTEXT,
    draftContent: card.content,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5"
    >
      <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-wider mb-3 block">
        {card.label}
      </span>
      <CardEditingContext value={readOnlyContext}>
        <CardContentSwitch card={card} />
      </CardEditingContext>
    </motion.div>
  );
}
```

- [ ] **Step 2: Update artifact-canvas.tsx to use CardContentSwitch**

Replace the inline `CardContent` function with an import from `card-renderer.tsx`. Keep using `CardContentSwitch` directly (not `CardRenderer`) since `ArtifactCanvas` already wraps in `ArtifactCard`.

In `src/components/workspace/artifact-canvas.tsx`:
- Remove the entire `function CardContent({ card }: { card: CardState })` block (lines 33-180)
- Remove all card component imports (StatGrid, BulletList, etc. — lines 11-31)
- Remove `useCardEditing` import (line 30)
- Add: `import { CardContentSwitch } from '@/components/research/card-renderer';`
- Replace all `<CardContent card={card} />` usages with `<CardContentSwitch card={card} />`

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build, no errors. The extraction is a pure refactor — zero behavior change.

- [ ] **Step 4: Commit**

```bash
git add src/components/research/card-renderer.tsx src/components/workspace/artifact-canvas.tsx
git commit -m "refactor: extract CardContentSwitch into shared card-renderer"
```

---

### Task 2: Add navigateToSection to WorkspaceProvider

**Files:**
- Modify: `src/components/workspace/workspace-provider.tsx`

- [ ] **Step 1: Add navigateToSection to WorkspaceActions interface**

In `src/components/workspace/workspace-provider.tsx`, add to the `WorkspaceActions` interface (after line 16):

```typescript
navigateToSection: (section: SectionKey) => void;
```

- [ ] **Step 2: Implement navigateToSection callback**

Add after the `restoreCardVersion` callback (after line 166):

```typescript
const navigateToSection = useCallback((section: SectionKey) => {
  const currentStates = stateRef.current.sectionStates;
  if (currentStates[section] === 'queued') return; // guard: can't navigate to queued sections
  setState((prev) => ({
    ...prev,
    currentSection: section,
  }));
}, []);
```

- [ ] **Step 3: Add navigateToSection to the actions object**

Add `navigateToSection` to the `actions` object (line 168-177):

```typescript
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
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/workspace-provider.tsx
git commit -m "feat: add navigateToSection to WorkspaceProvider"
```

---

### Task 3: Create SectionTabs component

**Files:**
- Create: `src/components/workspace/section-tabs.tsx`

- [ ] **Step 1: Create SectionTabs**

```tsx
// src/components/workspace/section-tabs.tsx
'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import type { SectionKey, SectionPhase } from '@/lib/workspace/types';

interface SectionTabsProps {
  sections: SectionKey[];
  currentSection: SectionKey;
  sectionStates?: Record<SectionKey, SectionPhase>;
  onNavigate: (section: SectionKey) => void;
  mode: 'workspace' | 'document';
}

export function SectionTabs({ sections, currentSection, sectionStates, onNavigate, mode }: SectionTabsProps) {
  const approvedCount = useMemo(() => {
    if (!sectionStates) return sections.length; // document mode: all complete
    return sections.filter((key) => sectionStates[key] === 'approved').length;
  }, [sections, sectionStates]);

  return (
    <div className="flex h-11 items-center gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 overflow-x-auto">
      {sections.map((section) => {
        const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;
        const phase = sectionStates?.[section];
        const isActive = section === currentSection;
        const isQueued = mode === 'workspace' && phase === 'queued';
        const isApproved = phase === 'approved';
        const isResearching = phase === 'researching' || phase === 'streaming';
        const isReview = phase === 'review';
        const isError = phase === 'error';

        return (
          <button
            key={section}
            type="button"
            onClick={() => !isQueued && onNavigate(section)}
            disabled={isQueued}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200 border shrink-0',
              // Document mode: simple active/inactive
              mode === 'document' && isActive && 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
              mode === 'document' && !isActive && 'border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)] cursor-pointer',
              // Workspace mode states
              mode === 'workspace' && isActive && isApproved && 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
              mode === 'workspace' && isActive && isReview && 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] shadow-[0_0_12px_rgba(96,165,250,0.1)]',
              mode === 'workspace' && isActive && isResearching && 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] shadow-[0_0_12px_rgba(96,165,250,0.1)]',
              mode === 'workspace' && isActive && isError && 'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
              mode === 'workspace' && !isActive && isApproved && 'border-[var(--accent-green)]/20 bg-[var(--accent-green)]/8 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/12 cursor-pointer',
              mode === 'workspace' && !isActive && (isReview || isResearching) && 'border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/8 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/12 cursor-pointer',
              mode === 'workspace' && !isActive && isError && 'border-[var(--accent-red)]/20 bg-[var(--accent-red)]/8 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/12 cursor-pointer',
              mode === 'workspace' && isQueued && 'border-[var(--border-subtle)] bg-transparent text-[var(--text-quaternary)] cursor-not-allowed',
            )}
          >
            {/* Status indicator */}
            {mode === 'workspace' && isApproved && (
              <span className="text-[10px]">✓</span>
            )}
            {mode === 'workspace' && (isResearching || (isReview && isActive)) && (
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            )}
            {mode === 'workspace' && isError && (
              <span className="text-[10px]">!</span>
            )}
            {mode === 'workspace' && isQueued && (
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
            )}

            <span className={cn(isActive && 'font-semibold')}>{meta.label}</span>
          </button>
        );
      })}

      {/* Progress counter */}
      {mode === 'workspace' && (
        <span className="ml-auto text-xs font-mono text-[var(--text-tertiary)] shrink-0">
          {approvedCount} / {sections.length}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/section-tabs.tsx
git commit -m "feat: add SectionTabs shared navigation component"
```

---

### Task 4: Wire SectionTabs into workspace + update ArtifactCanvas + ArtifactFooter

**Files:**
- Modify: `src/components/workspace/workspace-page.tsx`
- Modify: `src/components/workspace/artifact-canvas.tsx`
- Modify: `src/components/workspace/artifact-footer.tsx`
- Delete: `src/components/workspace/status-strip.tsx`

- [ ] **Step 1: Update workspace-page.tsx — replace StatusStrip with SectionTabs**

In `src/components/workspace/workspace-page.tsx`:
- Remove: `import { StatusStrip } from './status-strip';`
- Add: `import { SectionTabs } from './section-tabs';`
- Add: `import { SECTION_PIPELINE } from '@/lib/workspace/pipeline';`
- Replace `<StatusStrip />` (line 81) with:

```tsx
<SectionTabs
  sections={SECTION_PIPELINE}
  currentSection={state.currentSection}
  sectionStates={state.sectionStates}
  onNavigate={navigateToSection}
  mode="workspace"
/>
```

This requires destructuring from `useWorkspace()`. Add this inside the `WorkspacePage` component — but since `WorkspacePage` doesn't currently use the workspace context directly, we need a small bridge. The cleanest approach: add a new `WorkspaceNavBridge` component inside `workspace-page.tsx`:

```tsx
function WorkspaceNavBar() {
  const { state, navigateToSection } = useWorkspace();
  return (
    <SectionTabs
      sections={SECTION_PIPELINE}
      currentSection={state.currentSection}
      sectionStates={state.sectionStates}
      onNavigate={navigateToSection}
      mode="workspace"
    />
  );
}
```

Then replace `<StatusStrip />` with `<WorkspaceNavBar />`.

- [ ] **Step 2: Update artifact-footer.tsx — add variant prop**

Replace the entire file with:

```tsx
'use client';

import { cn } from '@/lib/utils';

interface ArtifactFooterProps {
  variant?: 'approve' | 'complete';
  onApprove?: () => void;
  disabled?: boolean;
}

export function ArtifactFooter({ variant = 'approve', onApprove, disabled }: ArtifactFooterProps) {
  if (variant === 'complete') {
    return (
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-6 py-4 bg-[var(--accent-green)]/[0.03]">
        <div>
          <p className="text-sm font-medium text-[var(--accent-green)]">Research Complete</p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">All sections reviewed and approved</p>
        </div>
        <button
          type="button"
          disabled
          className={cn(
            'rounded-[var(--radius-md)] px-5 py-2.5',
            'text-sm font-semibold text-white',
            'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple,#8b5cf6)]',
            'opacity-50 cursor-not-allowed',
          )}
        >
          Generate Media Plan &rarr;
        </button>
      </div>
    );
  }

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

- [ ] **Step 3: Update artifact-canvas.tsx — add approved rendering path + completion footer**

In `src/components/workspace/artifact-canvas.tsx`, the key changes:

1. The canvas must render cards when `phase === 'approved'` (user navigated back to an approved section)
2. When `allApproved`, show current section's cards + completion footer (not empty placeholder)
3. Show "Looks good →" footer only when `phase === 'review'` and NOT `allApproved`

Replace the `ArtifactCanvas` function body with updated rendering logic. The changes are:

a. Change `isReviewable` to also include `approved`:
```tsx
const isReviewable = phase === 'review';
const isApproved = phase === 'approved';
const showCards = isReviewable || isApproved || allApproved;
```

b. Replace the `allApproved` empty state block (lines 230-241) with card rendering:
```tsx
{/* Cards for any viewable section (review, approved, or allApproved) */}
{showCards && sectionCards.length > 0 && (
  <CardGrid>
    {sectionCards.map((card, i) => (
      <motion.div ...>
        <ArtifactCard card={card} index={i}>
          <CardContentSwitch card={card} />
        </ArtifactCard>
      </motion.div>
    ))}
  </CardGrid>
)}
```

c. Footer logic:
```tsx
{/* Show "Looks good" only for sections in review phase (not approved, not allApproved) */}
{!allApproved && isReviewable && <ArtifactFooter variant="approve" onApprove={approveSection} />}

{/* Show completion footer when all sections approved */}
{allApproved && <ArtifactFooter variant="complete" />}
```

d. Add empty-state fallback for approved sections with no cards (edge case: localStorage stale):
```tsx
{showCards && sectionCards.length === 0 && (
  <div className="flex flex-1 items-center justify-center min-h-[400px]">
    <p className="text-sm text-[var(--text-tertiary)] font-mono">
      No cards for this section yet
    </p>
  </div>
)}
```

e. Remove the separate `!allApproved && isReviewable` card rendering block — merge into the unified `showCards` block above.

- [ ] **Step 4: Delete status-strip.tsx**

```bash
rm src/components/workspace/status-strip.tsx
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Clean build. No references to `StatusStrip` should remain.

Run: `grep -r "StatusStrip\|status-strip" src/ --include="*.tsx" --include="*.ts"`
Expected: No matches.

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/workspace-page.tsx src/components/workspace/artifact-canvas.tsx src/components/workspace/artifact-footer.tsx
git rm src/components/workspace/status-strip.tsx
git commit -m "feat: replace StatusStrip with SectionTabs, add section navigation and completion footer"
```

---

## Chunk 2: Research Document View + Dashboard Integration

### Task 5: Create server action for fetching journey sessions

**Files:**
- Create: `src/lib/actions/journey-sessions.ts`

- [ ] **Step 1: Create journey-sessions.ts**

Follow the pattern in `src/lib/actions/blueprints.ts` — `'use server'`, `auth()` from Clerk, `createAdminClient()`.

```typescript
// src/lib/actions/journey-sessions.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import type { SectionKey } from '@/lib/workspace/types';

export interface JourneySessionRecord {
  id: string;
  title: string;
  created_at: string;
  completedSections: SectionKey[];
}

export async function getCompletedJourneySessions(): Promise<{
  data?: JourneySessionRecord[];
  error?: string;
}> {
  const { userId } = await auth();
  if (!userId) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id, created_at, collected_fields, research_results')
    .eq('user_id', userId)
    .not('research_results', 'is', null)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  if (!data) return { data: [] };

  const records: JourneySessionRecord[] = data.map((row) => {
    const fields = row.collected_fields as Record<string, unknown> | null;
    const results = row.research_results as Record<string, { status?: string }> | null;

    const title =
      (fields?.companyName as string) ??
      (fields?.url as string) ??
      'Untitled Research';

    const completedSections = SECTION_PIPELINE.filter(
      (key) => results?.[key]?.status === 'complete',
    );

    return {
      id: row.id,
      title,
      created_at: row.created_at,
      completedSections,
    };
  });

  return { data: records };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/journey-sessions.ts
git commit -m "feat: add getCompletedJourneySessions server action"
```

---

### Task 6: Create ResearchDocument client component

**Files:**
- Create: `src/components/research/research-document.tsx`

- [ ] **Step 1: Create research-document.tsx**

```tsx
// src/components/research/research-document.tsx
'use client';

import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SectionTabs } from '@/components/workspace/section-tabs';
import { SectionHeader } from '@/components/workspace/section-header';
import { CardRenderer } from '@/components/research/card-renderer';
import { CardGrid } from '@/components/workspace/card-grid';
import type { CardState, SectionKey } from '@/lib/workspace/types';

interface ResearchDocumentProps {
  cardsBySection: Record<string, CardState[]>;
  availableSections: SectionKey[];
  title: string;
}

export function ResearchDocument({ cardsBySection, availableSections, title }: ResearchDocumentProps) {
  const [currentSection, setCurrentSection] = useState<SectionKey>(
    availableSections[0] ?? 'industryMarket',
  );

  const sectionCards = useMemo(
    () => cardsBySection[currentSection] ?? [],
    [cardsBySection, currentSection],
  );

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Header with back button + section tabs */}
      <div className="flex items-center border-b border-[var(--border-subtle)] bg-[var(--bg-base)] sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-4 py-3 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 border-r border-[var(--border-subtle)]"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
        <div className="flex-1 overflow-hidden">
          <SectionTabs
            sections={availableSections}
            currentSection={currentSection}
            onNavigate={setCurrentSection}
            mode="document"
          />
        </div>
      </div>

      {/* Content area — centered, max-width */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SectionHeader section={currentSection} />

              {sectionCards.length > 0 ? (
                <CardGrid>
                  {sectionCards.map((card, i) => (
                    <CardRenderer key={card.id} card={card} mode="document" index={i} />
                  ))}
                </CardGrid>
              ) : (
                <div className="flex items-center justify-center min-h-[300px]">
                  <p className="text-sm text-[var(--text-tertiary)] font-mono">
                    Research not completed for this section
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/research/research-document.tsx
git commit -m "feat: add ResearchDocument read-only viewer component"
```

---

### Task 7: Create /research/[sessionId] route

**Files:**
- Create: `src/app/research/[sessionId]/page.tsx`
- Create: `src/app/research/[sessionId]/not-found.tsx`

- [ ] **Step 1: Create the server component page**

```tsx
// src/app/research/[sessionId]/page.tsx
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { parseResearchToCards, resetCardIdCounter } from '@/lib/workspace/card-taxonomy';
import { SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import { ResearchDocument } from '@/components/research/research-document';
import type { SectionKey, CardState } from '@/lib/workspace/types';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ResearchPage({ params }: PageProps) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id, research_results, created_at, collected_fields')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) notFound();

  const researchResults = data.research_results as Record<
    string,
    { status?: string; data?: Record<string, unknown> }
  > | null;

  if (!researchResults) redirect('/dashboard');

  // Parse research results into cards per section
  resetCardIdCounter();
  const cardsBySection: Record<string, CardState[]> = {};
  const availableSections: SectionKey[] = [];

  for (const section of SECTION_PIPELINE) {
    const sectionResult = researchResults[section];
    if (sectionResult?.status === 'complete' && sectionResult.data) {
      const cards = parseResearchToCards(section, sectionResult.data);
      cardsBySection[section] = cards;
      availableSections.push(section);
    }
  }

  if (availableSections.length === 0) redirect('/dashboard');

  const fields = data.collected_fields as Record<string, unknown> | null;
  const title =
    (fields?.companyName as string) ??
    (fields?.url as string) ??
    'Research';

  return <ResearchDocument cardsBySection={cardsBySection} availableSections={availableSections} title={title} />;
}
```

- [ ] **Step 2: Create not-found.tsx**

```tsx
// src/app/research/[sessionId]/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Research not found</h2>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          This research session doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-[var(--accent-blue)] hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/research/
git commit -m "feat: add /research/[sessionId] read-only document view"
```

---

### Task 8: Dashboard integration — ResearchCard + DocumentTabs + DashboardContent

**Files:**
- Create: `src/app/dashboard/_components/research-card.tsx`
- Modify: `src/app/dashboard/_components/document-tabs.tsx`
- Modify: `src/app/dashboard/_components/dashboard-content.tsx`

- [ ] **Step 1: Create research-card.tsx**

Follow `BlueprintCard` pattern (see `src/app/dashboard/_components/blueprint-card.tsx`):

```tsx
// src/app/dashboard/_components/research-card.tsx
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FlaskConical, ArrowRight } from 'lucide-react';
import { staggerItem, springs } from '@/lib/motion';
import type { JourneySessionRecord } from '@/lib/actions/journey-sessions';

interface ResearchCardProps {
  session: JourneySessionRecord;
  showTypeBadge?: boolean;
  formatDate: (dateString: string) => string;
}

export function ResearchCard({ session, showTypeBadge = false, formatDate }: ResearchCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      transition={springs.smooth}
      layout
    >
      <Link href={`/research/${session.id}`} className="block">
        <div className="group relative rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.10]">
          <div className="p-4">
            <div className="flex flex-col gap-3">
              {/* Header row */}
              <div className="flex items-start gap-3">
                <div className="inline-flex items-center justify-center size-8 rounded-full bg-emerald-500/[0.08] text-emerald-400/80 shrink-0">
                  <FlaskConical className="size-3.5" />
                </div>
                <div className="min-w-0 pt-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium text-white/90 truncate leading-tight">
                      {session.title}
                    </h3>
                    {showTypeBadge && (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-emerald-400/60 bg-emerald-500/[0.06] px-1.5 py-0.5 rounded">
                        Research
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 tabular-nums">
                    {formatDate(session.created_at)}
                  </p>
                </div>
              </div>

              {/* Metadata row */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--text-tertiary)] inline-flex items-center gap-1">
                  <span className="tabular-nums text-white/60">{session.completedSections.length}</span>
                  / 6 sections
                </span>
                <ArrowRight className="size-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
```

- [ ] **Step 2: Update document-tabs.tsx**

Make these changes in `src/app/dashboard/_components/document-tabs.tsx`:

a. Add imports:
```typescript
import { ResearchCard } from './research-card';
import type { JourneySessionRecord } from '@/lib/actions/journey-sessions';
```

b. Update `TabValue` type (line 23):
```typescript
type TabValue = "all" | "blueprints" | "media-plans" | "research";
```

c. Update `DashboardItem` type (line 26-28):
```typescript
type DashboardItem =
  | { type: "blueprint"; data: BlueprintRecord }
  | { type: "media-plan"; data: MediaPlanRecord }
  | { type: "research"; data: JourneySessionRecord };
```

d. Update `DocumentTabsProps` (line 37-44) — add `journeySessions`:
```typescript
interface DocumentTabsProps {
  blueprints: BlueprintRecord[];
  mediaPlans: MediaPlanRecord[];
  journeySessions: JourneySessionRecord[];
  onDeleteBlueprint: (id: string) => Promise<void>;
  onDeleteMediaPlan: (id: string) => Promise<void>;
  deletingBlueprintId: string | null;
  deletingMediaPlanId: string | null;
}
```

e. Update `tabs` array (line 46-50):
```typescript
const tabs: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blueprints", label: "Blueprints" },
  { value: "media-plans", label: "Media Plans" },
  { value: "research", label: "Research" },
];
```

f. Update `getResultLabel` (line 72-76):
```typescript
function getResultLabel(count: number, tab: TabValue): string {
  if (tab === "blueprints") return count === 1 ? "1 blueprint" : `${count} blueprints`;
  if (tab === "media-plans") return count === 1 ? "1 media plan" : `${count} media plans`;
  if (tab === "research") return count === 1 ? "1 research" : `${count} research sessions`;
  return count === 1 ? "1 document" : `${count} documents`;
}
```

g. Destructure `journeySessions` in the function params (line 78):
```typescript
export function DocumentTabs({
  blueprints,
  mediaPlans,
  journeySessions,
  onDeleteBlueprint,
  ...
```

h. Add `filteredSessions` after `filteredMediaPlans` (around line 160):
```typescript
const filteredSessions = useMemo(
  () => sortItems(filterBySearch(journeySessions)),
  [journeySessions, filterBySearch, sortItems]
);
```

i. Update `allItems` to include sessions (around line 164):
```typescript
const allItems = useMemo(() => {
  const items: DashboardItem[] = [
    ...filteredBlueprints.map((bp) => ({ type: "blueprint" as const, data: bp })),
    ...filteredMediaPlans.map((mp) => ({ type: "media-plan" as const, data: mp })),
    ...filteredSessions.map((s) => ({ type: "research" as const, data: s })),
  ];
  // ... existing sort logic
```

j. Update `tabCounts`:
```typescript
const tabCounts: Record<TabValue, number> = {
  all: blueprints.length + mediaPlans.length + journeySessions.length,
  blueprints: blueprints.length,
  "media-plans": mediaPlans.length,
  research: journeySessions.length,
};
```

k. Update `currentItems` (around line 234) — add research case:
```typescript
case "research":
  return filteredSessions.map((s) => ({ type: "research" as const, data: s }));
```

l. Add `ResearchCard` rendering in the items map (around line 357), after the media-plan branch:
```typescript
if (item.type === "research") {
  return (
    <ResearchCard
      key={`rs-${item.data.id}`}
      session={item.data}
      showTypeBadge={activeTab === "all"}
      formatDate={formatDate}
    />
  );
}
```

m. Update `allItems` memo dependency array — add `filteredSessions`:
```typescript
// Change the dependency array from:
}, [filteredBlueprints, filteredMediaPlans, sortValue]);
// To:
}, [filteredBlueprints, filteredMediaPlans, filteredSessions, sortValue]);
```

n. Update `src/app/dashboard/_components/empty-state.tsx` — add `"research"` variant:

Add `"research"` to the `EmptyStateVariant` union:
```typescript
type EmptyStateVariant = "all" | "blueprints" | "media-plans" | "search" | "research";
```

Add `research` entry to the `config` record:
```typescript
research: {
  icon: FlaskConical,
  title: "No research sessions",
  description: "Start a journey to generate AI-powered market research and competitor analysis.",
},
```

Add `FlaskConical` to the lucide-react import:
```typescript
import { Sparkles, BarChart3, FileCheck, SearchX, FlaskConical } from "lucide-react";
```

Add a CTA button case for `variant === "research"` (after the `media-plans` button block):
```tsx
{variant === "research" && (
  <Link href="/journey">
    <Button variant="default" size="default">
      <Sparkles className="size-4" />
      Start Research
    </Button>
  </Link>
)}
```

- [ ] **Step 3: Update dashboard-content.tsx**

In `src/app/dashboard/_components/dashboard-content.tsx`:

a. Add import:
```typescript
import { getCompletedJourneySessions, type JourneySessionRecord } from '@/lib/actions/journey-sessions';
```

b. Add state (after line 88):
```typescript
const [journeySessions, setJourneySessions] = useState<JourneySessionRecord[]>([]);
```

c. Update the `Promise.all` in `loadData` (line 102) to include journey sessions:
```typescript
const [onboardingResult, blueprintsResult, mediaPlansResult, sessionsResult] = await Promise.all([
  getOnboardingStatus(),
  getUserBlueprints(),
  getUserMediaPlans(),
  getCompletedJourneySessions(),
]);
```

d. Add after media plans handling (after line 122):
```typescript
if (sessionsResult.data) {
  setJourneySessions(sessionsResult.data);
}
```

e. Pass to `DocumentTabs` (line 184):
```tsx
<DocumentTabs
  blueprints={blueprints}
  mediaPlans={mediaPlans}
  journeySessions={journeySessions}
  onDeleteBlueprint={handleDeleteBlueprint}
  onDeleteMediaPlan={handleDeleteMediaPlan}
  deletingBlueprintId={deletingBlueprintId}
  deletingMediaPlanId={deletingMediaPlanId}
/>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/research-card.tsx src/app/dashboard/_components/document-tabs.tsx src/app/dashboard/_components/dashboard-content.tsx src/app/dashboard/_components/empty-state.tsx
git commit -m "feat: add Research tab to dashboard with journey session cards"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, zero errors.

- [ ] **Step 2: Verify no stale references**

Run: `grep -r "StatusStrip\|status-strip" src/ --include="*.tsx" --include="*.ts"`
Expected: No matches.

Run: `grep -r "from.*status-strip" src/ --include="*.tsx" --include="*.ts"`
Expected: No matches.

- [ ] **Step 3: Commit (if any fixes needed)**

Only if verification steps required changes.
