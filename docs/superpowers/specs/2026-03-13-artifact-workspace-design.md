# Artifact-First Research Workspace — Design Spec

**Date:** 2026-03-13
**Branch:** `redesign/v2-command-center`
**Scope:** Frontend-only. No backend changes.

---

## 1. Goal

Replace the current chat-first journey UI with an artifact-first research workspace. After onboarding, the artifact becomes the primary surface. Users review, edit, approve, and advance section-by-section through a card-based canvas.

## 2. Product Principles

1. Artifact over chat.
2. Direct manipulation plus AI editing.
3. One focused artifact at a time.
4. Scoped sub-agent chat per artifact.
5. Fast approval path to the next section.
6. Visible AI work, but restrained UI chrome.
7. Card-based canvas, not plain report and not message feed.

## 3. Core User Flow

1. User completes onboarding (existing phases: welcome → prefilling → review).
2. User clicks "Start research."
3. Workspace opens with first artifact in the center.
4. Artifact streams in card-by-card as research completes.
5. User can:
   - Edit cards directly (inline edit)
   - Ask the right-rail sub-agent to revise the artifact
   - Approve individual cards
   - Click "Looks good" to approve the whole artifact
6. Whole-artifact approval triggers morph transition to the next section.
7. The next artifact replaces center stage; right rail re-scopes automatically.

## 4. Decisions Locked

| Decision | Choice |
|----------|--------|
| Layout split | 60/40 (artifact center / right rail) |
| Right rail | Always visible on desktop |
| Left rail | None |
| Card taxonomy | Fixed per section, mapped from current renderers |
| Edit model | Inline edit (click card → edit in-place) |
| AI edits | Via right-rail chat, applied directly to cards |
| Mobile | Sheet pull-up for chat |
| Undo | Card snapshots (last 5 versions per card) |
| Transition | Morph (status strip first, staggered card swap) |
| Pipeline order | Market → Competitors → ICP → Offer → Keywords → Synthesis |
| Media plan | Deferred |
| Backend | No changes — same routes, worker, Supabase schema |

## 5. Architecture

### State Model

```typescript
interface WorkspaceState {
  sessionId: string; // matches journey_sessions.id — prevents stale localStorage
  phase: 'onboarding' | 'workspace';
  currentSection: SectionKey;
  sectionStates: Record<SectionKey, SectionPhase>;
  cards: Record<string, CardState>;
}

type SectionKey =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'keywordIntel'
  | 'crossAnalysis';

type SectionPhase = 'queued' | 'researching' | 'streaming' | 'review' | 'approved' | 'error';

interface CardState {
  id: string;
  sectionKey: SectionKey;
  cardType: string;
  content: Record<string, unknown>;
  status: 'draft' | 'edited' | 'approved';
  versions: CardSnapshot[];
}

interface CardSnapshot {
  content: Record<string, unknown>;
  editedBy: 'user' | 'ai';
  timestamp: number;
}
```

**Session identity:** On workspace init, `sessionId` is set from the current `journey_sessions.id`. On page load, stored state is validated against the active session — mismatches trigger fresh state initialization.

### Data Flow

1. Onboarding completes → user clicks "Start research" → phase switches to `workspace`
2. First section (`industryMarket`) enters `researching` state
3. Existing Supabase polling (`useResearchRealtime`) detects research result
4. Result parsed into cards using fixed card taxonomy → section enters `review`
5. User reviews cards in center canvas, optionally edits inline or asks right-rail chat
6. User clicks "Looks good" → section enters `approved` → next section starts
7. Morph transition plays, workspace advances to next section
8. If worker errors → section enters `error` state, user can retry

### No Backend Changes

- Same `/api/journey/stream` route for lead agent
- Same research worker dispatch + Supabase `research_results` write pattern
- Same `journey_sessions` schema
- Right-rail chat reuses existing route or is deferred
- Workspace state lives in React context, persisted to `localStorage` (keyed by `sessionId`, same `STORAGE_KEYS` pattern)

## 6. Section Pipeline (6 sections)

Update `section-meta.ts` module numbers to match new pipeline order:

| # | Key | Label | Accent | moduleNumber (updated) |
|---|-----|-------|--------|----------------------|
| 1 | `industryMarket` | Market Overview | `--section-market` | `01` |
| 2 | `competitors` | Competitor Intel | `--section-competitor` | `02` |
| 3 | `icpValidation` | ICP Validation | `--section-icp` | `03` |
| 4 | `offerAnalysis` | Offer Analysis | `--section-offer` | `04` |
| 5 | `keywordIntel` | Keywords | `--section-keyword` | `05` |
| 6 | `crossAnalysis` | Strategic Synthesis | `--section-synthesis` | `06` |

## 7. Layout

### Desktop (>= 768px, Tailwind `md` breakpoint)

```
┌──────────────────────────────────────────────────────────┐
│  StatusStrip                                              │
│  [● Market Overview]  ████████░░░░░░░  2 of 6  [idle]   │
├─────────────────────────────────┬────────────────────────┤
│                                 │                        │
│   ArtifactCanvas (60%)          │   RightRail (40%)      │
│                                 │                        │
│   SectionHeader                 │   RailHeader           │
│   CardGrid                      │   ChatThread           │
│     ArtifactCard[]              │   LooksGoodButton      │
│   ArtifactFooter                │   ChatInput            │
│     [Edit] [Looks good →]       │                        │
│                                 │                        │
└─────────────────────────────────┴────────────────────────┘
```

### Mobile (< 768px)

```
┌─────────────────────┐
│  StatusStrip         │
├─────────────────────┤
│  ArtifactCanvas     │
│  (full width)       │
│  [Looks good →]     │
├─────────────────────┤
│  BottomSheet (chat) │
│  [Ask about...]     │
└─────────────────────┘
```

768px is desktop (matches Tailwind `md`).

## 8. Component Tree

```
WorkspacePage
├── WorkspaceProvider (React context for WorkspaceState)
├── StatusStrip
│   ├── SectionIndicator (dot + label)
│   ├── ProgressBar (completed / 6)
│   └── WorkerStatus (idle/active)
├── ArtifactCanvas
│   ├── SectionHeader (label + accent)
│   ├── CardGrid
│   │   └── ArtifactCard[]
│   │       ├── CardContent (type-specific renderer)
│   │       ├── CardToolbar (edit, approve, history)
│   │       └── InlineEditor (on edit click)
│   └── ArtifactFooter
│       ├── EditButton (secondary)
│       └── LooksGoodButton (primary CTA)
└── RightRail (desktop) / BottomSheet (mobile)
    ├── RailHeader (section label)
    ├── ChatThread (existing useChat, scoped)
    ├── LooksGoodButton (duplicate CTA)
    └── ChatInput ("looks good" keyword → approval)
```

## 9. Fixed Card Taxonomy

### Market Overview (`industryMarket`)

| Card | Type | Data Source |
|------|------|-------------|
| Category Snapshot | StatGrid (6 stats) | `data.categorySnapshot.{category, marketSize, marketMaturity, awarenessLevel, buyingBehavior, averageSalesCycle}` |
| Pain Points | BulletList | `data.painPoints.primary` |
| Demand Drivers | BulletList | `data.marketDynamics.demandDrivers` |
| Buying Triggers | BulletList | `data.marketDynamics.buyingTriggers` |
| Barriers to Purchase | BulletList | `data.marketDynamics.barriersToPurchase` |
| Trend Signals | TrendCard[] | `data.trendSignals[]` — `{trend, direction, evidence}` |
| Messaging Opportunities | CheckList | `data.messagingOpportunities.summaryRecommendations` |

### Competitor Intel (`competitors`)

| Card | Type | Data Source |
|------|------|-------------|
| CompetitorProfile[] | CompetitorCard | `data.competitors[]` — `{name, website, positioning, price, pricingConfidence, strengths[], weaknesses[], opportunities[], ourAdvantage, adActivity.{activeAdCount, sourceConfidence, platforms[], themes[], evidence}, adCreatives[].{platform, id, advertiser, headline, body, imageUrl, videoUrl, format, isActive, detailsUrl, firstSeen, lastSeen}, libraryLinks.{metaLibraryUrl, linkedInLibraryUrl, googleAdvertiserUrl}, threatAssessment.{topAdHooks[], counterPositioning}}` |
| Market Patterns | BulletList | `data.marketPatterns` |
| White-Space Gaps | GapCard[] | `data.whiteSpaceGaps[]` — `{gap, type, evidence, exploitability, impact, recommendedAction}` |

### ICP Validation (`icpValidation`)

| Card | Type | Data Source |
|------|------|-------------|
| Persona Stats | StatGrid (4 stats) | `data.{validatedPersona, audienceSize, confidenceScore, demographics}` |
| Final Verdict | VerdictCard | `data.finalVerdict` — `{status, reasoning}` |
| Decision Process | ProseCard | `data.decisionProcess` |
| Best Channels | BulletList | `data.channels` |
| Buying Triggers | BulletList | `data.triggers` |
| Objections | BulletList | `data.objections` |
| Recommendations | CheckList | `data.finalVerdict.recommendations` |

### Offer Analysis (`offerAnalysis`)

| Card | Type | Data Source |
|------|------|-------------|
| Score & Status | StatGrid (2 stats) | `data.offerStrength.overallScore`, `data.recommendation.status` |
| Rationale | ProseCard | `data.recommendation.summary` |
| Pricing Analysis | PricingCard | `data.pricingAnalysis` — `{currentPricing, marketBenchmark, pricingPosition, coldTrafficViability}` |
| Strengths | BulletList | `data.recommendation.topStrengths` |
| Weaknesses | BulletList | `data.recommendation.priorityFixes` |
| Actions | CheckList | `data.recommendation.recommendedActionPlan` |
| Messaging Recs | BulletList | `data.messagingRecommendations` |
| Market Fit | ProseCard | `data.marketFitAssessment` |
| Red Flags | FlagCard[] | `data.redFlags[]` — `{issue, severity, priority, evidence, recommendedAction}` |

### Keywords (`keywordIntel`)

| Card | Type | Data Source |
|------|------|-------------|
| Keyword Intel Grid | KeywordGrid | Existing `JourneyKeywordIntelDetail` component (reuse as-is, wrap in ArtifactCard) |

### Strategic Synthesis (`crossAnalysis`)

| Card | Type | Data Source |
|------|------|-------------|
| Positioning Strategy | StrategyCard | `data.positioningStrategy` — `{recommendedAngle, leadRecommendation, keyDifferentiator}` |
| Planning Context | StatGrid + BulletList | `data.planningContext` — `{monthlyBudget, targetCpl, targetCac, downstreamSequence[]}` |
| Charts | ChartCard[] | `data.charts[]` — `{title, imageUrl/url, description}` |
| Strategic Narrative | ProseCard | `data.strategicNarrative` |
| Key Insights | InsightCard[] | `data.keyInsights[]` — `{insight, implication, source}` |
| Platform Recs | PlatformCard[] | `data.platformRecommendations[]` — `{platform, role, budgetAllocation, rationale}` |
| Messaging Angles | AngleCard[] | `data.messagingAngles[]` — `{angle, exampleHook, evidence}` |
| Success Factors | CheckList | `data.criticalSuccessFactors` |
| Next Steps | CheckList | `data.nextSteps` |

## 10. Card Visual Language

Reference: `output/research-runners-audit.html` — the artifact cards should follow this clean, structured style adapted to our dark theme.

### Design Principles

- **Card container:** `glass-surface` background, `border-radius: var(--radius-control)` (~16px), `border: 1px solid` using `--border-default`. Generous padding (24–32px).
- **Section sub-headers inside cards:** Uppercase, `text-xs`, `font-mono`, letter-spaced (`tracking-widest`), `--text-tertiary` color, thin bottom border. Match existing `h3` pattern from `artifact-panel.tsx`.
- **Stat blocks:** Label above in `--text-tertiary` (12px, uppercase, mono), value below in `--text-primary` (16–20px, semibold). Grid layout with `gap-3`.
- **Tags/badges:** Small pills — `text-[11px]`, `font-semibold`, `px-2 py-0.5`, `rounded-md`. Use section accent colors as background (10% opacity) with matching text color. Examples: model type, severity, direction, status.
- **Bullet lists:** Accent-colored dots (6px circles), `--text-secondary` text, `text-sm`, `leading-relaxed`.
- **Tables (when used inside cards):** Minimal — `text-sm`, subtle row separators (`border-b border-white/5`), `--text-tertiary` headers.
- **Typography hierarchy:** Card title = `text-base font-semibold`, descriptions = `text-sm text-text-secondary leading-relaxed`, metadata = `text-xs font-mono text-text-tertiary`.
- **Code/file refs:** `font-mono`, `text-xs`, `bg-white/[0.04]`, `rounded`, `px-1.5 py-0.5`.
- **Spacing:** `space-y-4` within cards, `space-y-3` between sub-sections, generous breathing room.

### Base Card Types (shared primitives)

| Type | Description |
|------|-------------|
| `StatGrid` | N stats in a responsive grid. Each stat: label + value + optional badge. |
| `BulletList` | Title + bullet items with accent-colored dots. |
| `CheckList` | Title + items with checkmark icons. |
| `ProseCard` | Title + paragraph text. Glass surface background. |
| `TrendCard` | Direction badge (rising/declining/stable) + trend name + evidence. |
| `VerdictCard` | Status badge + reasoning prose. |
| `CompetitorCard` | Name/website/positioning + stat blocks + S/W/O lists + ourAdvantage + ad activity + adCreatives (reuse `CompetitorAdEvidence` component) + libraryLinks + threatAssessment. |
| `GapCard` | Gap name + type badge + evidence + exploitability/impact scores + recommended action. |
| `FlagCard` | Issue + severity/priority stats + evidence + recommended action. |
| `InsightCard` | Source badge + insight headline + implication. |
| `PlatformCard` | Platform name + role badge + budgetAllocation + rationale. |
| `AngleCard` | Angle title + exampleHook + evidence. |
| `ChartCard` | Title + description + image. |
| `PricingCard` | currentPricing/marketBenchmark/pricingPosition stats + coldTrafficViability prose. |
| `StrategyCard` | recommendedAngle headline + leadRecommendation + keyDifferentiator block. |
| `KeywordGrid` | Reuse existing `JourneyKeywordIntelDetail`. |

## 11. Inline Editing

- Click any card → text fields become `contentEditable`, stat values become `<input>`
- Save on blur or Enter. Cancel with Escape (restores pre-edit content).
- On save: push current content to `versions[]` (max 5), update `content`, set `status: 'edited'`
- Visual: card border changes to `--border-focus` (blue) while editing

### Editing Granularity

- **All leaf string and number values are editable.** If a field renders as visible text or a number, the user can edit it.
- **BulletList / CheckList items:** Each item is individually editable. User can edit text of any bullet. Adding/removing items is out of scope for v1.
- **Nested fields** (e.g. `threatAssessment.counterPositioning`): The card component flattens nested fields into editable slots. On save, the edited values are written back to the correct nested path.
- **Computed/derived values** (e.g. direction badges, type labels): NOT editable. These are display-only derived from the content.

## 12. Card Snapshots (Undo)

- Each card stores up to 5 `CardSnapshot` entries
- Clock icon in card toolbar → dropdown with timestamps + `editedBy` tag
- Click snapshot → restore that version, push current as new snapshot
- Snapshots include both user and AI edits

## 13. Approval Model

**Card-level approve:**
- Checkmark icon on card toolbar
- Marks card as `approved` (green border accent)
- Does NOT advance the pipeline

**Artifact-level approve ("Looks good"):**
- Primary CTA in canvas footer AND right rail
- Typing "looks good" in right-rail chat input → same effect
- Marks all cards as approved
- Advances to next section with morph transition
- Section state: `review` → `approved`

### "Looks good" keyword detection

- Case-insensitive exact match on the trimmed input: `"looks good"`
- Does NOT match substrings like "this looks good to me" — only the exact phrase
- Intercepted BEFORE sending to the AI — the message is not sent to the chat thread
- A system message appears in the thread: "Section approved" with a checkmark
- The approval action fires immediately (same as clicking the button)

## 14. Morph Transition

On "Looks good":
1. Status strip progress bar advances (spring `snappy`, 300ms)
2. Section label crossfades to next section name
3. Current cards stagger out (50ms per card, fade + translateY -8px, 200ms)
4. Brief pause (100ms)
5. New section header fades in
6. If next section is `researching` → show loading state (reuse existing `ArtifactLoading`)
7. When research completes → cards stagger in (50ms per card, fade + translateY 8px, 200ms)
8. Right rail clears thread, updates section context

Use existing Framer Motion presets: `springs.snappy`, `fadeUp` variant. Use 0.05s stagger delay inline at the card transition call site (do NOT modify the shared `fastStagger` preset).

## 15. Mobile Adaptation

- Below `md` breakpoint (< 768px): right rail becomes a bottom sheet
- Sheet has 3 states: collapsed (just input bar visible), partial (40vh), expanded (85vh)
- "Looks good" button stays in canvas footer (always visible)
- Sheet pull handle + swipe gestures
- Cards stack single-column in canvas

## 16. Reuse Strategy

**Keep as-is:**
- `JourneyKeywordIntelDetail` — keyword grid component
- All CSS tokens, fonts, motion presets
- `useResearchRealtime` hook — Supabase polling
- All backend routes and worker
- `journey-state.ts` — field parsing (still needed for onboarding phase)
- Onboarding phases (`welcome`, `prefilling`, `review`) — unchanged

**Update:**
- `section-meta.ts` — swap `keywordIntel` and `crossAnalysis` module numbers (05 ↔ 06)

**Refactor:**
- `artifact-panel.tsx` — extract section renderers into standalone card components
- `journey/page.tsx` — replace chat-center layout with workspace layout

**New components:**
- `WorkspaceProvider` — workspace state context
- `StatusStrip` — progress bar + section indicator
- `ArtifactCanvas` — center panel with card grid
- `ArtifactCard` — wrapper with toolbar, edit mode, snapshot history
- `CardGrid` — responsive grid layout for cards
- `RightRail` — scoped chat panel
- `BottomSheet` — mobile chat adaptation
- Base card type components (StatGrid, BulletList, ProseCard, etc.)

**Delete after migration:**
- Chat-center layout code in `journey/page.tsx`
- `artifact-trigger-card.tsx` (no longer needed — artifact is always visible)
- `research-inline-card.tsx` (no longer needed — no chat feed)

## 17. Sprint Breakdown

Each sprint is scoped to be completable in a single Claude Code session.

### Sprint 1 — Foundation: State + Layout Shell

**Goal:** Workspace page renders with 60/40 split, status strip, and placeholder content. No cards yet.

- `WorkspaceProvider` with `WorkspaceState` context + localStorage persistence (keyed by sessionId)
- `StatusStrip` component (section indicator, progress bar, worker status badge)
- `ArtifactCanvas` shell (section header + empty card grid area + footer with "Looks good" button)
- `RightRail` shell (header + placeholder chat area + input)
- New workspace route/page or conditional render in `journey/page.tsx` when `phase === 'workspace'`
- Update `section-meta.ts` module numbers (swap keywords ↔ synthesis)
- Wire "Start research" button from onboarding → workspace phase transition

**Acceptance:** Page loads with correct 60/40 layout, status strip shows section 1, "Looks good" button visible in both canvas and rail.

### Sprint 2 — Base Card Types + Market Overview

**Goal:** First section renders real research data as cards.

- Build all base card type components: `StatGrid`, `BulletList`, `CheckList`, `ProseCard`, `TrendCard`
- `ArtifactCard` wrapper with glass surface styling, card toolbar (edit/approve/history icons — wired in later sprints)
- `CardGrid` responsive layout
- Market Overview card taxonomy: extract from `IndustryMarketDocument` in `artifact-panel.tsx`
- Wire `useResearchRealtime` → parse `industryMarket` result → populate cards
- Section state: `queued` → `researching` (show `ArtifactLoading`) → `review` (show cards)

**Acceptance:** With a completed `industryMarket` research result in Supabase, the workspace renders all 7 Market Overview cards with real data.

### Sprint 3 — Remaining Section Card Types

**Goal:** All 6 sections render their fixed card taxonomy.

- Build remaining card types: `CompetitorCard`, `VerdictCard`, `GapCard`, `FlagCard`, `InsightCard`, `PlatformCard`, `AngleCard`, `ChartCard`, `PricingCard`, `StrategyCard`
- Competitor Intel taxonomy (extract from `CompetitorIntelDocument`)
- ICP Validation taxonomy (extract from `ICPValidationDocument`)
- Offer Analysis taxonomy (extract from `OfferAnalysisDocument`)
- Keywords taxonomy (wrap `JourneyKeywordIntelDetail` in `ArtifactCard`)
- Strategic Synthesis taxonomy (extract from `CrossAnalysisDocument`)
- Each section maps research result data → cards array

**Acceptance:** All 6 sections render correctly when their research data exists in Supabase.

### Sprint 4 — Approval Flow + Morph Transition

**Goal:** User can approve sections and advance through the pipeline.

- Card-level approve (checkmark toolbar icon → green border)
- "Looks good" button logic: marks all cards approved, advances `currentSection`
- Morph transition animation (status strip advance → stagger out → stagger in)
- Section state machine: `review` → `approved` → next section `researching`
- Error state handling: `error` phase renders retry option
- Auto-advance: if next section already has research data (pre-fetched), go straight to `review`

**Acceptance:** Clicking "Looks good" on section 1 plays morph transition and loads section 2. Full 6-section pipeline can be traversed.

### Sprint 5 — Inline Editing + Card Snapshots

**Goal:** Users can edit card content and undo changes.

- Inline edit mode: click card → `contentEditable` for text, `<input>` for stats
- Edit visual state (blue border, save on blur/Enter, cancel on Escape)
- Card snapshot system: push version on save (max 5)
- History dropdown: clock icon → version list → click to restore
- `editedBy` tag (user/ai) on snapshots

**Acceptance:** User can edit a stat value, see it update, open history, and restore the previous version.

### Sprint 6 — Right Rail Chat + "Looks Good" Keyword

**Goal:** Right rail has a functional scoped chat.

- Wire `useChat` in right rail, scoped to current section
- Right rail clears and re-scopes on section transition
- "Looks good" keyword detection (case-insensitive exact match, pre-send intercept)
- System message in thread on approval
- Chat input with placeholder "Ask about this section..."

**Acceptance:** User can chat about the current section, type "looks good" to approve, see system confirmation message.

### Sprint 7 — Mobile + Polish

**Goal:** Mobile adaptation and transition polish.

- Bottom sheet for mobile (< 768px): collapsed/partial/expanded states
- Cards stack single-column on mobile
- "Looks good" stays in canvas footer on mobile
- Polish morph transition timing
- Error states and edge cases (empty sections, partial data)
- Clean up deleted components (`artifact-trigger-card`, `research-inline-card`, chat-center layout)

**Acceptance:** Full flow works on mobile viewport. No dead code from old layout.
