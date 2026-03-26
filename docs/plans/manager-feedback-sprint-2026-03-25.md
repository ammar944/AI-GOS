# Manager Feedback Sprint — 2026-03-25 (REVISED after app walkthrough)

> Revised 2026-03-26 after actually browsing the live app. Previous version was based on
> code reading alone and had wrong assumptions about the UX flow.

---

## Actual App Flow (Verified via browser)

```
/journey → "Seed your strategy" → URL + LinkedIn input → "Begin Analysis"
                                    OR "Upload niche document instead"
    ↓
Sequential research dispatch → 7 sections run one by one
    ↓
/research/{id} → Section tabs: Market | ICP | Offer | Competitors | Keywords | Synthesis | Media Plan
    ↓
/profiles → Saved business profiles from previous journeys
/research → List of all completed sessions with section counts
```

## Section Quality Assessment (from screenshots)

| Section | Current State | Needs Work? |
|---------|--------------|-------------|
| Market Overview | Stat cards + text grid | Minor polish |
| ICP Validation | Similar grid | Minor polish |
| Offer Analysis | Score grid + "Needs Work" badge + prose | Intelligence feature goes here |
| **Competitor Intel** | Flat bullet lists, no competitor nav | **YES — tabs + clickable links** |
| Keywords | **Already has sortable table** (keyword, vol, CPC, difficulty) | Minor — already decent |
| **Strategic Synthesis** | **Wall of text** + budget figures | **YES — worst section, needs intelligence** |
| Media Plan | Strategy card + stat grid + prose | Moderate polish |

---

## Priority Map (Revised)

| Tier | Items | Why This Order |
|------|-------|----------------|
| **T0: Foundation** | Design system via `/design-consultation` | Everything built after inherits the aesthetic |
| **T1: High Impact** | Intelligence feature (synthesis + offer), Competitor tabs | Biggest visual + functional gaps |
| **T2: Quick Wins** | Inline edits, clickable links, model selector | Infrastructure exists, fast to ship |
| **T3: Data Quality** | Pricing verification | Firecrawl audit |
| **T4: Profiles** | Save AI insights + profile selector on journey page | Returning client experience |
| **T5: Visual Polish** | Research section UI/UX pass | After design system exists |
| **T6: Major Feature** | Ad scripting | After everything else |
| **Admin** | Clerk system account + email whitelist | Whenever |

---

## Phase 0: Design Foundation (Day 1)

**Goal**: Run `/design-consultation` to establish agency-grade visual language BEFORE building anything.

**Output**: DESIGN.md with concrete CSS variable values (not prose descriptions), section accent colors, typography scale, card treatment specs.

**Scope guard**: Card tokens + section colors + typography only. Do NOT redesign sidebar, navigation, or layout structure. Do NOT use Stitch.

**Frontend workflow** (MANDATORY for all UI phases):
Refero MCP → 21st Magic MCP → shadcn MCP → Frontend Design plugin → Frontend sub-agents

---

## Phase 1: Intelligence Feature (Day 2-3)

**Goal**: Make Synthesis and Offer sections feel like strategic advice, not text walls.

### 1a. Offer Statement & Guarantee Generator
- **Backend**: Update `research-worker/src/runners/offer.ts` prompt to generate 3-5 concrete offer statements
- **Schema**: Add `generatedOfferStatements[]` to `src/lib/journey/schemas/offer-analysis.ts`:
  ```
  type: 'headline' | 'guarantee' | 'usp' | 'value-prop' | 'risk-reversal'
  statement, rationale, targetEmotion, confidence
  ```
- **Frontend**: New component in the Offer Analysis section — NOT a "card" but a list of copyable statements with a copy button per item. Button shows checkmark for 1.5s after copy.
- **Worker schema**: Update inline Zod schema in `offer.ts` runner (no shared contracts dir)

### 1b. ICE Scoring for Priority Fixes
- **Backend**: Update offer runner to score each `priorityFix` with Impact/Confidence/Ease (1-10)
- **Schema**: Extend `priorityFixes[]` with `impact`, `confidence`, `ease`, `iceScore`
- **Frontend**: Render as a **sortable table** (NOT a card) — same visual pattern as the keywords table. Columns: Fix, Impact, Confidence, Ease, ICE Score. Default sort: ICE score descending.
- **Empty state**: If 0 priority fixes, show "No critical improvements identified" row.

### 1c. Synthesis Intelligence Surfacing
- **Backend**: Update `research-worker/src/runners/synthesize.ts` prompt for richer structured output
- **Frontend**: Replace the wall-of-text narrative with structured blocks:
  - **Top insights** as callout blocks (not "hero cards") — icon by source section, priority color, implication text
  - **Positioning strategy** as a visual comparison (recommended vs alternatives)
  - **Messaging angles** as compact list items with emotion tag + hook text
  - Keep `strategicNarrative` as collapsible prose at the bottom, not the main content

**Files**:
- `research-worker/src/runners/offer.ts`, `research-worker/src/runners/synthesize.ts`
- `src/lib/journey/schemas/offer-analysis.ts`, `src/lib/journey/schemas/strategic-synthesis.ts`
- `src/lib/workspace/card-taxonomy.ts`
- New components in `src/components/workspace/cards/` or `src/components/research/`
- `src/components/research/card-renderer.tsx` — add new renderers

---

## Phase 2: Competitor Tabs + Clickable Links (Day 4)

### 2a. Competitor Tabs
- Tab bar at top of competitor section with one tab per competitor name
- "Overview" tab shows side-by-side comparison (strengths/weaknesses/pricing)
- Individual tabs show full competitor detail (existing content, better laid out)
- Hide Overview tab if <2 competitors. Horizontal scroll if 5+ tabs.
- Modify `artifact-canvas.tsx`: when `currentSection === 'competitors'`, render tabs instead of flat card grid

### 2b. Clickable Links
- `competitor-card.tsx`: wrap `website` field in `<a>` with ExternalLink icon
- "See Pricing Page" text already exists — verify it's actually a link. If not, make it one.
- Add `pricingSourceUrl` to competitor schema (from Firecrawl response)
- If `pricingConfidence === 'unknown'`, show amber warning badge next to price

**Files**:
- `src/components/workspace/competitor-tabs.tsx` (new)
- `src/components/workspace/artifact-canvas.tsx`
- `src/components/workspace/cards/competitor-card.tsx`

---

## Phase 3: Quick Wins (Day 5)

### 3a. Re-enable Inline Edits
- Restore pencil button to `artifact-card.tsx` (infrastructure from git `df61d625`)
- `ArtifactCard` manages `useState(false)` for `isEditing`
- Passes real `CardEditingContext` instead of `STATIC_EDITING_CONTEXT`
- Cards with editing: prose-card, bullet-list, check-list (stat-grid stays read-only)
- **Auto-save on tab navigation** — when user switches sections while editing, auto-save via `updateCard()`. Brief "Saved" flash on card.
- Coexists with `editBlueprint` chat tool

### 3b. Model Selector
- Dropdown: Opus (Best) / Sonnet (Balanced). **No Haiku** (adaptive thinking not supported).
- Place in session controls area (top of workspace, near Share button)
- Store in localStorage via `STORAGE_KEYS.selectedModel`
- Pass `model` in POST body to dispatch route → worker reads `context.model`
- If Sonnet: disable adaptive thinking (`thinking: undefined`)
- Model applies to future dispatches only, not already-running sections

---

## Phase 4: Pricing Verification (Day 6)

- Run test journey, inspect `research_results` in Supabase for competitors + offer sections
- Verify Firecrawl tool is actually invoked (check worker logs)
- If Firecrawl not called for competitors: add `firecrawlExtract` to competitor runner
- Runner prompt hardening: "NEVER guess pricing. If Firecrawl cannot reach pricing page, set pricingConfidence to 'unknown' and pricingSourceUrl to null"
- Add `pricingSourceUrl` field to competitor schema (sourced from Firecrawl response URL)

---

## Phase 5: Business Profiles Enhancement (Day 7-8)

### 5a. Save AI Insights to Profile
- Supabase migration: add nullable JSONB columns `ai_insights`, `offer_score`, `positioning_strategy`, `last_research_at` to `business_profiles`
- After research completes: extract insights from `research_results`, upsert into profile
- Migration safety: nullable columns, deploy migration before code

### 5b. Profile Selector on Journey Page
- On the `/journey` page, **above** the URL form: if saved profiles exist, show them as selectable cards
- "AgentSupply — Restaurant Technology — Mar 25" with a "Run New Research" button
- Selecting a profile pre-populates context and skips URL entry
- "Start fresh" keeps current URL form behavior
- The `/profiles` page already exists in sidebar — profile selector on journey page is a convenience shortcut

---

## Phase 6: Research Section UI/UX Polish (Day 9-10)

Apply design system from Phase 0 to all sections. Use frontend design workflow.

- **Market Overview**: Minor — apply new tokens
- **ICP Validation**: Minor — apply new tokens
- **Offer Analysis**: Score grid gets new treatment, prose section gets better typography
- **Competitor Intel**: Already rebuilt in Phase 2 with tabs
- **Keywords**: Already decent with table — apply new tokens to table styling
- **Synthesis**: Already rebuilt in Phase 1c with structured blocks
- **Media Plan**: Apply new card tokens, verify charts render

---

## Phase 7: Ad Scripting (Week 3+)

Only after all above. Consumes research output to generate video scripts, ad copy, creative briefs.

---

## Admin (Separate backlog)
- Clerk system account + email whitelist

---

## Corrections from Previous Plan

| Previous (WRONG) | Actual (VERIFIED) |
|---|---|
| Chat-based onboarding with askUser questions | URL form + "Begin Analysis" button |
| "Lead agent" is the primary UX | Lead agent code exists under the hood but UX is form-based |
| Keywords need a table card | Keywords ALREADY has a sortable table |
| Profile selector as pre-chat overlay | Profile selector on journey page above URL form |
| 6+ new card types needed | Use tables for ranked data, callouts for insights, tabs for competitors — NOT more cards |

---

## Execution Order (REVISED)

```
Phase 0 (Day 1): Design Foundation — /design-consultation → DESIGN.md
Phase 1 (Day 2-3): Intelligence Feature — offer statements + ICE table + synthesis restructure
Phase 2 (Day 4): Competitor Tabs + Clickable Links
Phase 3 (Day 5): Quick Wins — inline edits + model selector
Phase 4 (Day 6): Pricing Verification
Phase 5 (Day 7-8): Business Profiles — save insights + journey page selector
Phase 6 (Day 9-10): UI/UX Polish — apply design system to all sections
Phase 7 (Week 3+): Ad Scripting
Admin (whenever): Clerk + whitelist
```

Design doc: `~/.gstack/projects/ammar944-AI-GOS/ammar-redesign-v2-command-center-design-20260325-212121.md` (needs revision to match this plan)
