# UX Overhaul Orchestration Playbook

> Design doc: `~/.gstack/projects/ammar944-AI-GOS/ammar-redesign-v2-command-center-design-20260413-104951.md`
> Created: 2026-04-13

## How This Works

1. Copy a prompt into Cursor Composer 2
2. Cursor does the work
3. You review + commit
4. Come back to Claude Code and say: "check the commit for step N"
5. Claude Code reviews, flags issues
6. Move to next prompt

**Rule: One prompt at a time. Commit after each. Don't skip ahead.**

---

## Phase 0: Branch Cleanup

### Step 0.1 — CLAUDE CODE (git ops)

> Do this in Claude Code, not Cursor. Say:
>
> "Back up old main as archive/old-main, then force-push this branch as the new main. Verify the build passes first."

### Step 0.2 — CURSOR PROMPT

```
Fix two dead routes in the codebase.

**Task 1: Remove /settings from sidebar**

In `src/components/shell/app-sidebar.tsx`, find the NAV_ITEMS array (line 19) and remove the Settings entry:

```ts
{ icon: Settings, label: 'Settings', href: '/settings' },
```

Remove it entirely. Also remove the `Settings` import from lucide-react if it becomes unused.

**Task 2: Fix onboarding redirect**

In `src/app/onboarding/page.tsx`, change line 37 from:
```ts
redirect("/generate");
```
to:
```ts
redirect("/journey");
```

The `/generate` route doesn't exist. `/journey` is the correct entry point.

That's it. Two changes, two files.
```

**After Cursor finishes:** Review the diff. Commit: `fix: remove dead /settings route + fix onboarding redirect to /journey`

---

## Phase 1: Unified Workspace Progression

### Step 1.1 — CURSOR PROMPT (PhaseTransitionCard component)

```
Create a new file: `src/components/workspace/phase-transition-card.tsx`

This is a reusable guided "next step" prompt card shown between research phases. It tells the user what comes next and gives them a single action button.

Props interface:

```tsx
interface PhaseTransitionCardProps {
  tag: string;           // e.g. "Research Complete" or "Media Plan Ready"
  title: string;         // e.g. "All research modules ready"
  description: string;   // e.g. "Generate a comprehensive media plan..."
  actionLabel: string;   // e.g. "Generate Media Plan"
  onAction: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  disabledReason?: string; // tooltip when disabled, e.g. "Scripts require a linked profile"
}
```

Design requirements:
- Use the exact same visual style as `src/components/workspace/media-plan-cta.tsx` — same card shape, accent bar top/bottom, gradient button, spacing, typography.
- Read DESIGN.md for color variables.
- Use `cn()` from `@/lib/utils` for class merging.
- Use `motion` from `framer-motion` for entrance animation (same `scaleIn` + `springs` pattern from media-plan-cta.tsx).
- When `isLoading` is true, button shows spinner + "{actionLabel}..." text and is disabled.
- When `disabled` is true and `disabledReason` is provided, show the reason as small text below the button.
- Named export `PhaseTransitionCard`. No default export.

Reference files:
- @src/components/workspace/media-plan-cta.tsx (copy this visual style exactly)
- @DESIGN.md
- @src/lib/motion.ts (for scaleIn, springs)
```

**After Cursor finishes:** Review. Commit: `feat(workspace): add PhaseTransitionCard component for guided progression`

### Step 1.2 — CURSOR PROMPT (Strip research tools from chat)

```
In `src/app/api/journey/stream/route.ts`, remove the following 6 tool registrations from the tools object passed to `streamText()`:

Remove these tools:
- researchIndustry
- researchCompetitors
- researchICP
- researchOffer
- synthesizeResearch
- researchKeywords

Keep these tools:
- editCard
- updateField
- askUser
- scrapeClientSite
- competitorFastHits

The 6 removed tools duplicate the workspace UI dispatch (users click buttons to trigger research, not chat). Keeping them causes the AI to try dispatching research from chat when it should only be editing.

Also update the chat system prompt import or inline prompt (check `src/lib/ai/prompts/journey-chat-system.ts`) to add this line at the top of the system message:

"You are a research editing assistant. Your job is to modify research cards and session fields when the user requests changes. You do NOT dispatch or trigger research — that happens via the workspace UI buttons. Focus on editCard and updateField operations."

Do NOT change anything else in the stream route — leave the transport, model config, message handling, and all other logic untouched.
```

**After Cursor finishes:** Review. Commit: `refactor(chat): strip research dispatch tools, scope to editing only`

### Step 1.3 — CURSOR PROMPT (Update chat system prompt)

```
Open `src/lib/ai/prompts/journey-chat-system.ts` and find the main system prompt string (JOURNEY_CHAT_SYSTEM_PROMPT or similar exported constant).

At the very beginning of the prompt, before any existing content, prepend this paragraph:

"You are a research editing assistant embedded in the AIGOS workspace. Your role is to help users refine and edit their research results AFTER they have been generated. You can modify card content (editCard), update session fields (updateField), and answer questions about the research (askUser). You do NOT trigger, dispatch, or run research sections — the user does that via workspace buttons. When a user asks to 'run research' or 'generate a section', tell them to use the workspace section buttons instead."

Do not remove or modify the rest of the existing prompt. Just prepend this paragraph with a double newline separating it from the existing content.
```

**After Cursor finishes:** Review. Commit: `fix(chat): prepend editing-only role to journey chat system prompt`

### Step 1.4 — CURSOR PROMPT (Fix onboarding redirect, dead settings)

> Skip if you already did Step 0.2 above. This was the same task.

### Step 1.5 — CLAUDE CODE (Wire media plan + scripts into workspace)

> This is the big cross-file task. Come back to Claude Code and say:
>
> "Read the design doc at ~/.gstack/projects/ammar944-AI-GOS/ammar-redesign-v2-command-center-design-20260413-104951.md
>
> Execute Phase 1 tasks 2-5: Wire the PhaseTransitionCard into the workspace for Media Plan and Scripts progression. The PhaseTransitionCard component already exists from the previous commit. The media-plan-cta.tsx also already exists.
>
> Specifically:
> 1. After crossAnalysis data lands (non-null in research_results), show PhaseTransitionCard prompting to generate media plan. Reuse the existing MediaPlanCta or PhaseTransitionCard.
> 2. After mediaPlan completes, show PhaseTransitionCard prompting to generate scripts. Guard: if session.profile_id is null, show 'Scripts require a linked profile' instead.
> 3. Add a 'Scripts' tab to the workspace section tabs that renders ScriptPackViewer when scripts exist.
> 4. Extract new code into src/components/workspace/scripts-phase.tsx to keep journey page under 3200 lines.
>
> Do NOT touch the research dispatch logic, the chat route, or any runner code. Only modify the workspace UI layer."

---

## Phase 3: Profile AI Insights Pipeline

### Step 3.1 — CLAUDE CODE (Debug the data flow)

> Say to Claude Code:
>
> "The profile AI insights are broken — intelligence fields from research sections don't compile into the profile summary.
>
> Debug this data flow:
> 1. Check if saveProfileInsights() in src/lib/profiles/business-profiles.ts is being called after research completes
> 2. Check if intelligence fields exist in research_results[section] data after a runner completes
> 3. Check if journey_sessions.profile_id FK is set correctly
> 4. Trace from dispatch completion → profile save → business_profiles.ai_insights JSONB
>
> Find where the chain breaks and fix it. Don't add new features — just wire what's already built."

---

## Phase 4: Chat Editing Fix

### Step 4.1 — CLAUDE CODE (Fix editCard → workspace state sync)

> Steps 1.2 and 1.3 already stripped the research tools and updated the system prompt. Now fix the actual editing:
>
> "The chat sidebar's editCard and updateField tools need to work reliably.
>
> Current problem: when the AI calls editCard to modify a research card, the workspace doesn't update in real time. The cards render from research_results data that comes via Supabase realtime, but editCard may be writing to a different state.
>
> Debug and fix:
> 1. Trace what editCard does when called — does it write to Supabase journey_sessions.research_results? Or just local state?
> 2. If it writes to Supabase, the realtime subscription should pick it up. If not, add the Supabase write.
> 3. Same for updateField — verify it persists to Supabase session metadata.
> 4. Test: after editCard runs, the workspace card should re-render with the new content without a page refresh."

---

## Phase 2: Card Taxonomy Audit

### Step 2.0 — YOU (Architect work)

This step is on you, not Cursor or Claude Code.

1. Run `npm run dev` and `cd research-worker && npm run dev`
2. Go to localhost:3000/journey
3. Run a full research pipeline for 2-3 test companies
4. For EACH section (Industry, ICP, Competitors, Offer, Keywords, Synthesis), screenshot every card
5. Write a cut list:

```
## Card Cut List

### ICP Validation
- KEEP: [card names]
- REMOVE: [card names that are random/noisy]
- CONSOLIDATE: [cards that overlap]

### Offer Analysis
- KEEP: ...
- REMOVE: ...

[repeat for all 6 sections]
```

Save this as `.claude/orchestration-ux-overhaul/CARD-CUT-LIST.md`

### Step 2.1 — CURSOR PROMPT (after you write the cut list)

```
Read `.claude/orchestration-ux-overhaul/CARD-CUT-LIST.md` for the specific cards to keep, remove, and consolidate.

Apply this cut list to `src/lib/workspace/card-taxonomy.ts` in the `parseResearchToCards()` function.

For each REMOVE entry: delete the card mapping so that card type is no longer generated for that section.

For each CONSOLIDATE entry: merge the data from both cards into a single card with a combined label.

For KEEP entries: leave them as-is but verify labels match the cut list.

Do not change any other file. Only modify card-taxonomy.ts.

@src/lib/workspace/card-taxonomy.ts
@.claude/orchestration-ux-overhaul/CARD-CUT-LIST.md
```

**After Cursor finishes:** Review. Commit: `refactor(workspace): apply card taxonomy audit — cut noise, consolidate duplicates`

---

## Phase 5: Verification

### Step 5.1 — CLAUDE CODE

> "Run npm run build and npm run test:run. Report any failures."

### Step 5.2 — Manual QA (YOU)

1. Fresh browser, clear localStorage
2. Go to localhost:3000/journey
3. Enter a test URL, go through the full flow
4. Verify:
   - [ ] No dead routes (no 404s anywhere in sidebar or navigation)
   - [ ] Research cards are clean (Phase 2 audit applied)
   - [ ] After last research section, "Generate Media Plan" prompt appears
   - [ ] Media plan generates and shows in workspace
   - [ ] After media plan, "Generate Scripts" prompt appears (or "Link profile" guard)
   - [ ] Scripts generate and show in workspace
   - [ ] Profile overview shows AI insights
   - [ ] Chat can handle "change this competitor" type edits

---

## Prompt Execution Order (Summary)

| # | Tool | What | Commit message |
|---|------|------|----------------|
| 0.1 | Claude Code | Git: backup main, force-push branch | (git ops) |
| 0.2 | Cursor | Remove /settings, fix /generate redirect | `fix: remove dead routes` |
| 1.1 | Cursor | Create PhaseTransitionCard component | `feat(workspace): add PhaseTransitionCard` |
| 1.2 | Cursor | Strip 6 research tools from chat route | `refactor(chat): strip research dispatch tools` |
| 1.3 | Cursor | Prepend editing role to chat system prompt | `fix(chat): scope system prompt to editing` |
| 1.5 | Claude Code | Wire media plan + scripts into workspace | `feat(workspace): unified progression` |
| 3.1 | Claude Code | Debug + fix profile AI insights pipeline | `fix(profiles): wire AI insights save` |
| 4.1 | Claude Code | Fix editCard → workspace realtime sync | `fix(chat): editCard updates workspace` |
| 2.0 | YOU | Run pipeline, screenshot cards, write cut list | (no commit) |
| 2.1 | Cursor | Apply card cut list to card-taxonomy.ts | `refactor(workspace): card taxonomy audit` |
| 5.1 | Claude Code | Build + test verification | (no commit) |
| 5.2 | YOU | Manual full-flow QA | (no commit) |
