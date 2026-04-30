# Sprint 2: Conversational Onboarding — Smart Questions with askUser Tool

## Reference Docs
1. `AI-GOS-v2-PRD.docx` — Section 4.2 (Conversational Discovery), askUser tool pattern
2. `AI-GOS-v2-Design-System.docx` — Section 5 (message styles, follow-up chips as option chips)
3. `AI-GOS-v2-Roadmap.docx` — Sprint 2 task breakdown
4. `CLAUDE.md` — Architecture conventions
5. `src/lib/company-intel/step-schemas.ts` — V1 onboarding field definitions (17 fields across 5 steps)

## Existing Components (Built in Sprint 1 / Pre-Sprint 2)
These already exist and should be **extended**, not rebuilt:
- `src/components/chat/thinking-block.tsx` — Base thinking display (already wired into journey page)
- `src/components/journey/typing-indicator.tsx` — 3-dot bounce with Framer Motion (already live)
- `src/components/journey/chat-message.tsx` — Renders tool parts, thinking blocks, approval flows
- `src/app/api/journey/stream/route.ts` — Streaming route with Opus 4.6, adaptive thinking, message sanitization
- `src/lib/ai/prompts/lead-agent-system.ts` — Lead Agent persona (extend, don't replace)

## Intentionally Deferred (Not in Sprint 2)
- **Voice input** (Groq Whisper) — separate integration, no dependency on onboarding flow
- **Background research during onboarding** — PRD Section 4.2.3 defers research to post-onboarding. Roadmap T2.3 contradicts this; follow the PRD
- **Research activity ticker** — no research = no ticker
- **URL scraping** — if user shares a URL, store it in session metadata for Sprint 3. Don't scrape now

---

## 1. The askUser Tool (Core Pattern)

### Backend Definition
Add to the `tools` parameter in `/api/journey/stream` route's `streamText()` call:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const askUser = tool({
  description: 'Ask the user a structured question with selectable options. Use for categorical/factual questions. Do NOT use for nuanced questions that need detailed free-text answers.',
  parameters: z.object({
    question: z.string().describe('The question to ask'),
    options: z.array(z.object({
      label: z.string().describe('Short display text (2-5 words)'),
      description: z.string().describe('One-line explanation of this option'),
    })).min(2).max(4),
    multiSelect: z.boolean().describe('Allow multiple selections (e.g., marketing channels)'),
    fieldName: z.string().describe('The onboarding field this question maps to (e.g., "businessModel", "industry", "icp")'),
  }),
});
```

**Critical: This tool does NOT use `needsApproval`.** It uses a custom frontend rendering pattern:
- Frontend detects `askUser` tool call in the message stream via `message.parts`
- Renders `<AskUserCard>` component inline
- User taps an option → frontend calls `addToolResult()` on the `useChat` hook
- Agent receives the structured result and continues

**This is different from the editBlueprint approval pattern**, which uses `addToolApprovalResponse()`. The askUser tool gets its result directly from user selection, not from an approve/reject gate.

### Frontend Component
**New file:** `src/components/journey/ask-user-card.tsx`

```typescript
interface AskUserCardProps {
  question: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
  fieldName: string;
  onSelect: (result: { selected: string[]; freeText?: string }) => void;
  disabled?: boolean; // true after user has answered
}
```

**Rendering rules:**
- Question text displayed above options as AI message text
- Options rendered as tappable chips (Design System Section 5.9 — pill shape, hover glow, slightly larger touch targets)
- Always render an implicit "Other" chip that expands a text input field when tapped
- Multi-select: chips toggle on/off, "Done" button submits selections
- Single-select: tap immediately submits
- After submission: chips become static (disabled), selected chips highlighted
- Tool result format: `{ selected: ["B2B SaaS"], freeText: null }` or `{ selected: ["Other"], freeText: "We're a hybrid marketplace..." }`

### Wiring in Journey Page
In `src/app/journey/page.tsx`, detect askUser tool parts in `renderMessageParts()` or `renderToolPart()`:

```typescript
if (toolName === 'askUser' && state === 'input-available') {
  return (
    <AskUserCard
      question={input.question}
      options={input.options}
      multiSelect={input.multiSelect}
      fieldName={input.fieldName}
      onSelect={(result) => addToolResult({ toolCallId, result: JSON.stringify(result) })}
    />
  );
}
```

---

## 2. Onboarding Question Flow

### Approach: Extend the Lead Agent Prompt (Not a Separate Agent)
There is no separate onboarding agent. The Lead Agent at `/api/journey/stream` handles everything. Extend the existing system prompt in `src/lib/ai/prompts/lead-agent-system.ts` with onboarding field tracking and askUser instructions.

**Do NOT create a separate `onboarding-agent.ts` file.** The route stays the same; you add the `askUser` tool to the `streamText()` call and update the system prompt.

### Fields to Collect (Mapped from V1 Schemas)

The agent must collect data for these fields. Required fields must be populated before onboarding can complete. Optional fields are collected opportunistically through natural follow-ups.

**Required (gate onboarding completion):**

| Field | Type | Question Style | askUser? |
|-------|------|----------------|----------|
| `businessModel` | enum | Q1: "B2B SaaS" · "B2C / DTC" · "Marketplace" · Other | Yes |
| `industry` | string | Q2: Dynamic options from Q1 context | Yes |
| `primaryIcpDescription` | string | Q3: Dynamic from industry ("CTOs at mid-market" · "Marketing directors" · "SMB owners" · Other) | Yes |
| `productDescription` | string | Extracted from natural conversation or follow-up | No — open text |
| `topCompetitors` | string[] | Q5: "I'll name a few" (opens text) · "Not sure" · "No direct competitors" | Yes |
| `offerPricing` | string | Q6: "Monthly sub" · "One-time" · "Usage-based" · Other. Follow-up for price range | Yes |
| `marketingChannels` | string[] | Q7: Multi-select: "Google Ads" · "Meta" · "LinkedIn" · "None yet" | Yes (multi) |
| `goals` | string | Q8: "More leads" · "Lower CAC" · "Scale what works" · "Launching new" | Yes |

**Optional (probe naturally within conversation):**

| Field | Source | How to Collect |
|-------|--------|----------------|
| `jobTitles` | Follow-up after ICP | "What titles are you usually selling to?" |
| `geography` | Follow-up after ICP | "Are you focused on a specific region?" |
| `easiestToClose` | Follow-up after ICP | "Which segment closes fastest for you?" |
| `buyingTriggers` | Follow-up after ICP/competitors | "What usually triggers them to start looking?" |
| `painPoints` | Q4: Open-ended | Free text — needs nuance, no options |
| `coreDeliverables` | Follow-up after product | "What are the core deliverables?" |
| `valueProp` | Follow-up after product/competitors | "How do you pitch the difference?" |
| `uniqueEdge` | Follow-up after competitors | "What's your edge over [competitor]?" |
| `marketBottlenecks` | Follow-up after pain points | Agent synthesizes from conversation |
| `situationBeforeBuying` | Follow-up after ICP | "What's their world like before they find you?" |
| `desiredTransformation` | Follow-up after pain/product | Agent synthesizes from conversation |
| `commonObjections` | Follow-up after offer | "What pushback do you hear most?" |
| `brandPositioning` | Agent synthesizes | Not asked directly — inferred from conversation |
| `customerVoice` | Agent synthesizes | Not asked directly — inferred from conversation |

### Question Flow (7-9 turns)

```
Turn 1: Welcome message (hardcoded, already exists)
Turn 2: User shares company name/URL
Turn 3: askUser → Business model (B2B SaaS / B2C / Marketplace / Other)
Turn 4: askUser → Industry (dynamic options from Q1 context)
Turn 5: askUser → ICP (dynamic from industry). Follow-up probes: job titles, geography, buying triggers
Turn 6: Open-ended → Pain points, competitive frustrations (no options — needs nuance)
Turn 7: askUser → Competitors (name them / not sure / no direct)
Turn 8: askUser → Offer & pricing (monthly / one-time / usage / other). Follow-up: price range
Turn 9: askUser → Channels (multi-select). Follow-up: budget range
Turn 10: askUser → Goals (more leads / lower CAC / scale / launching)
Turn 11: Agent summarizes all collected data → askUser: "Looks good, let's go" · "I want to change something"
```

### System Prompt Instructions (Add to lead-agent-system.ts)

Add a new section to the existing prompt:

```
## Onboarding Phase — Field Collection

You have access to the `askUser` tool. Use it for categorical/factual questions where you can offer smart, context-aware options. Do NOT use it for nuanced questions that need detailed free-text answers (pain points, value prop, competitive frustrations).

### Rules:
- ALWAYS use askUser when collecting: businessModel, industry, ICP, competitors, offerPricing, marketingChannels, goals
- NEVER use askUser for: painPoints, productDescription (detailed), valueProp, customerVoice
- Generate option labels dynamically based on prior answers — each question should feel personalized
- After each askUser response, acknowledge the answer briefly and naturally before moving to the next question
- Probe for optional fields (jobTitles, geography, buyingTriggers, commonObjections) as natural follow-ups within the flow — don't force them
- Track which required fields are populated. When all 8 required fields are filled, summarize and ask for confirmation
- If user gives a vague answer, push back: "Can you be more specific about [X]? That'll help me build a sharper strategy."
- If user says "skip" or "not sure", accept it but note the gap: "No worries — I'll work with what we have, though [X] would strengthen the analysis."

### Field Tracking:
Internally track field completion. When summarizing, present ALL collected data in a clear format and ask:
"Here's what I've got — [summary]. Does this look right?"
Options: "Looks good, let's go" · "I want to change something"
```

---

## 3. Thinking Block Enhancement

### What Exists
`src/components/chat/thinking-block.tsx` — basic thinking display, already wired into journey `renderMessageParts()`.

### What to Add
Enhance to match Design System Section 5.2:
- **Collapsible** — collapsed by default, chevron toggle to expand
- **Border-left accent** — 2px left border in `--accent-blue`
- **Timer** — "Thinking for X.Xs" label (track duration from stream start to thinking block completion)
- **Italic reasoning text** — content styled in italic, `--text-tertiary` color
- **Streaming** — show thinking content as it streams in (not wait for completion)

**File:** Extend `src/components/chat/thinking-block.tsx` or create `src/components/journey/thinking-block.tsx` if journey needs a different variant.

---

## 4. Session State Management

### New File: `src/lib/journey/session-state.ts`

```typescript
interface OnboardingState {
  // Required fields (gate completion)
  businessModel: string | null;
  industry: string | null;
  primaryIcpDescription: string | null;
  productDescription: string | null;
  topCompetitors: string[] | null;
  offerPricing: string | null;
  marketingChannels: string[] | null;
  goals: string | null;

  // Optional fields (collected opportunistically)
  jobTitles: string | null;
  geography: string | null;
  easiestToClose: string | null;
  buyingTriggers: string | null;
  painPoints: string | null;
  coreDeliverables: string | null;
  valueProp: string | null;
  uniqueEdge: string | null;
  marketBottlenecks: string | null;
  situationBeforeBuying: string | null;
  desiredTransformation: string | null;
  commonObjections: string | null;
  brandPositioning: string | null;
  customerVoice: string | null;

  // Meta
  phase: 'setup' | 'confirming' | 'complete';
  completionPercentage: number;
  storedUrls: string[]; // URLs shared by user, held for Sprint 3 research
}
```

### Storage Pattern
- **Primary:** Supabase `journey_sessions` table → `metadata` JSONB column stores `OnboardingState`
- **Mirror:** localStorage via `src/lib/storage/local-storage.ts` with `STORAGE_KEYS.JOURNEY_STATE` for instant hydration on page reload
- **Sync:** Write to Supabase after each askUser response; read from localStorage on mount, fallback to Supabase

### Structured Data Extraction for "Other" Responses
When user selects "Other" and types free text, use `generateObject()` with a Zod schema to extract the structured value:

```typescript
import { generateObject } from 'ai';

const extracted = await generateObject({
  model: anthropic(MODELS.CLAUDE_SONNET), // Use Sonnet, not Opus — cheaper for extraction
  schema: z.object({ value: z.string(), confidence: z.number() }),
  prompt: `Extract the ${fieldName} from this user response: "${freeText}"`,
});
```

---

## 5. Progress & Completion

### Header Progress
- Update `src/components/journey/journey-header.tsx` to show field completion
- Thin progress bar below the header (2px height, `--accent-blue` fill)
- Width = `completionPercentage` from session state (required fields only: 0/8 → 8/8)
- No step labels — just a visual indicator of how close to done

### Completion Flow
1. Agent detects all 8 required fields populated
2. Agent generates summary of all collected data
3. Agent calls askUser: `{ question: "Does this look right?", options: [{ label: "Looks good, let's go", description: "Start generating your strategy" }, { label: "I want to change something", description: "Edit any of the answers above" }] }`
4. "Looks good" → set `phase: 'complete'`, transition to generation phase (Sprint 3+)
5. "Change something" → agent asks which field to update, re-collects that field

---

## 6. Route Changes

### `/api/journey/stream/route.ts`

Add the askUser tool to the `streamText()` call:

```typescript
const result = streamText({
  model: anthropic(MODELS.CLAUDE_OPUS),
  system: LEAD_AGENT_SYSTEM_PROMPT,
  messages: await convertToModelMessages(sanitizedMessages),
  tools: { askUser },           // ← ADD THIS
  maxSteps: 15,                 // ← ADD THIS (enough for 8 questions + follow-ups)
  temperature: 0.3,
  providerOptions: {
    anthropic: {
      thinking: { type: 'adaptive' },
    },
  },
});
```

**Important:** `maxSteps: 15` allows the agent to call askUser up to ~15 times in a single conversation turn. This is intentional — the agent asks one question, gets the answer, then may immediately ask the next question in the same turn.

---

## 7. File Manifest

| File | Action | Purpose | Wave |
|------|--------|---------|------|
| `src/lib/ai/tools/ask-user.ts` | **CREATE** | askUser tool definition with Zod schema | 1A |
| `src/lib/journey/session-state.ts` | **CREATE** | OnboardingState interface + Supabase/localStorage sync | 1B |
| `src/lib/ai/prompts/lead-agent-system.ts` | **EXTEND** | Onboarding field collection instructions + askUser rules | 1C |
| `src/components/journey/ask-user-card.tsx` | **CREATE** | Interactive option chips for askUser tool | 1D |
| `src/components/chat/thinking-block.tsx` | **EXTEND** | Collapsible, timer, streaming, Design System 5.2 styling | 1D |
| `src/app/api/journey/stream/route.ts` | **MODIFY** | Add `tools: { askUser }`, `maxSteps: 15`, session persistence | 2A |
| `src/app/journey/page.tsx` | **MODIFY** | Wire askUser rendering, `addToolResult` flow, session hydration | 2B |
| `src/components/journey/chat-message.tsx` | **MODIFY** | Add askUser card rendering in `renderToolPart()` | 2B |
| `src/components/journey/journey-header.tsx` | **MODIFY** | Add thin progress bar for field completion | 2B |

---

## 8. Orchestration Strategy — Parallel Sub-Agents

### Principles

1. **Keep the orchestrator context LOW.** The main agent reads this spec, spawns sub-agents, merges results, and runs gates. It does NOT write implementation code itself.
2. **Every implementation task runs in a sub-agent with worktree isolation.** Sub-agents get an isolated repo copy — no merge conflicts between parallel work.
3. **Sub-agents are themed.** Each sub-agent has a clear domain (backend, frontend, prompt, state). It reads only the files relevant to its task.
4. **Gates between waves.** Wave N+1 cannot start until Wave N passes `npm run build` + `npm run lint`.
5. **Regression agent runs after every wave.** Dedicated sub-agent verifies v1 pages are untouched.

### Wave 1: Foundation (4 parallel sub-agents)

All tasks in Wave 1 are independent — zero file overlap. Launch all 4 simultaneously.

```
Orchestrator
├── Agent 1A (worktree) → Backend: askUser Tool Definition
├── Agent 1B (worktree) → State: Session State Manager
├── Agent 1C (worktree) → Prompt: Lead Agent System Prompt Extension
├── Agent 1D (worktree) → Frontend: AskUserCard + ThinkingBlock Enhancement
└── Orchestrator waits for all 4, then runs Gate 1
```

| Agent | Theme | Task | Creates/Modifies | Reads First |
|-------|-------|------|------------------|-------------|
| **1A** | Backend | Define `askUser` tool with Zod schema, export from `src/lib/ai/tools/ask-user.ts` | `src/lib/ai/tools/ask-user.ts` (CREATE) | `CLAUDE.md`, existing tools in `src/lib/ai/chat-tools/` for pattern reference |
| **1B** | State | Build `OnboardingState` interface, Supabase write/read helpers, localStorage mirror, completion percentage calculator | `src/lib/journey/session-state.ts` (CREATE) | `src/lib/storage/local-storage.ts`, `src/lib/supabase/types.ts`, `step-schemas.ts` |
| **1C** | Prompt | Extend `LEAD_AGENT_SYSTEM_PROMPT` with onboarding field tracking rules, askUser usage instructions, question flow guidance | `src/lib/ai/prompts/lead-agent-system.ts` (EXTEND) | Current prompt file, Section 2 of this spec (question flow) |
| **1D** | Frontend | Build `AskUserCard` component (chips, multi-select, "Other" text input). Enhance `ThinkingBlock` (collapsible, timer, streaming) | `src/components/journey/ask-user-card.tsx` (CREATE), `src/components/chat/thinking-block.tsx` (EXTEND) | Design System 5.9 (chip styling), Design System 5.2 (thinking block), existing chat-message.tsx |

**Gate 1:** `npm run build` + `npm run lint` pass. All 4 outputs exist and import without errors.

---

### Wave 2: Integration (3 parallel sub-agents)

Wave 2 wires Wave 1 outputs together. These agents depend on Wave 1 artifacts but are independent of each other.

```
Orchestrator
├── Agent 2A (worktree) → Backend Integration: Wire tool into stream route + session persistence
├── Agent 2B (worktree) → Frontend Integration: Wire AskUserCard into journey page + header progress
├── Agent 2C (worktree) → Regression: Verify v1 pages, build, lint
└── Orchestrator waits for 2A + 2B, then runs 2C
```

| Agent | Theme | Task | Modifies | Reads First |
|-------|-------|------|----------|-------------|
| **2A** | Backend | Import askUser tool into stream route, add `tools: { askUser }` + `maxSteps: 15`, add `onFinish` callback to persist session state to Supabase | `src/app/api/journey/stream/route.ts` | Wave 1A output (tool def), Wave 1B output (session state), current route.ts |
| **2B** | Frontend | Detect askUser tool parts in `renderToolPart()`, render `<AskUserCard>`, wire `addToolResult()` callback, add progress bar to header, hydrate session state from localStorage on mount | `src/app/journey/page.tsx`, `src/components/journey/chat-message.tsx`, `src/components/journey/journey-header.tsx` | Wave 1D output (AskUserCard), Wave 1B output (session state), current page.tsx + chat-message.tsx |
| **2C** | Regression | Run `npm run build`, `npm run lint`, verify `/dashboard` and `/generate` render correctly, verify `/journey` loads without errors | None (read-only) | All modified files from 2A + 2B |

**Gate 2:** Build passes, lint passes, v1 pages unaffected, `/journey` loads.

---

### Wave 3: E2E Validation (2 parallel sub-agents + final QC)

```
Orchestrator
├── Agent 3A (worktree) → Full Flow E2E: Simulate complete onboarding conversation
├── Agent 3B (worktree) → Edge Cases: Vague answers, "Other" text, multi-select, skip/change
└── Orchestrator runs Final QC after both complete
```

| Agent | Theme | Task |
|-------|-------|------|
| **3A** | E2E Flow | Navigate to `/journey`, complete full 8-question onboarding via askUser interactions. Verify: chips render, selections flow back to agent, agent context builds, summary appears, confirmation works. Check Supabase for persisted session. |
| **3B** | Edge Cases | Test: user selects "Other" and types free text (verify extraction). Test: multi-select for channels. Test: vague answer triggers pushback. Test: "I want to change something" re-collects field. Test: page reload hydrates from localStorage. |

**Final QC (Orchestrator):**
- All success criteria checked (Section 9)
- Progress bar reflects completion percentage
- Session state in Supabase matches collected answers
- Zero v1 regressions
- `npm run build` + `npm run lint` clean

---

### Sub-Agent Protocol (Every Agent Follows This)

```
1. ORIENT
   - Read this spec (SPRINT-2-CONVERSATIONAL-ONBOARDING.md)
   - Read CLAUDE.md for codebase conventions
   - Read your specific task description from the Wave table above
   - Read the "Reads First" files listed for your agent

2. PLAN
   - Explore the files you'll modify — understand current state
   - Identify exact import paths, naming conventions, existing patterns
   - Plan your approach before writing any code

3. IMPLEMENT
   - Follow codebase conventions:
     * Named exports (not default) for components — except page.tsx
     * Props interfaces suffixed with `Props`
     * `'use client'` for interactive components
     * `cn()` from `@/lib/utils` for conditional classes
     * `@/*` import alias (absolute imports)
     * kebab-case file names
     * Zod for schema validation
   - Write clean, minimal code — no over-engineering
   - Stay within your assigned files — do NOT touch files owned by other agents

4. VERIFY
   - `npm run build` must pass
   - `npm run lint` must pass (zero new errors)
   - Imports resolve correctly
   - Component renders without runtime errors

5. REPORT
   - Return: files created/modified, what was implemented, any concerns or deviations
```

### Orchestrator Protocol

```
1. PRE-FLIGHT
   - Verify branch is `aigos-v2`
   - Run `npm run build` (baseline must pass)
   - Read this spec in full

2. WAVE EXECUTION
   - Launch all agents in the wave simultaneously (use worktree isolation)
   - Wait for ALL agents in the wave to complete
   - Merge worktree changes back to main branch
   - Run gate checks (build + lint)
   - Fix any merge conflicts or integration issues
   - Only proceed to next wave after gate passes

3. CONTEXT MANAGEMENT
   - The orchestrator does NOT read implementation files in detail
   - The orchestrator reads agent REPORTS (summaries of what was built)
   - The orchestrator only reads source files when debugging gate failures
   - This keeps orchestrator context low and focused on coordination

4. CONFLICT RESOLUTION
   - If two agents modify the same file: orchestrator merges manually
   - In Wave 1: zero file overlap (by design) — no conflicts expected
   - In Wave 2: 2A (route.ts) and 2B (page.tsx + components) are separate files — no conflicts expected
   - If unexpected overlap: orchestrator reviews both changes, picks the correct merge

5. FAILURE HANDLING
   - If a sub-agent fails: orchestrator reads the error, spawns a fix agent
   - Fix agents get the failed agent's report + the error message
   - Fix agents run in isolation (worktree) and target only the broken file
   - After fix: re-run gate checks
```

### Agent Count Summary

| Wave | Agents | Parallel? | Files Touched |
|------|--------|-----------|---------------|
| Wave 1: Foundation | 4 | All parallel | 5 files (0 overlap) |
| Wave 2: Integration | 3 (2 parallel + 1 sequential) | 2A ∥ 2B, then 2C | 4 files (0 overlap between 2A/2B) |
| Wave 3: Validation | 2 parallel + final QC | 3A ∥ 3B, then QC | 0 files (read-only testing) |
| **Total** | **~10 sub-agents** | | **8 unique files** |

---

### Specialized Skill Assignments

Each sub-agent MUST read the appropriate skill SKILL.md files before writing any code. Skills provide battle-tested patterns and best practices that dramatically improve output quality.

| Agent | Required Skills | Why |
|-------|----------------|-----|
| **1A** (Backend) | — | Pure backend tool definition; no specialized skill needed. Follow `CLAUDE.md` conventions. |
| **1B** (State) | — | State management + Supabase helpers; standard TypeScript patterns. |
| **1C** (Prompt) | `design:ux-writing` | Prompt engineering is UX writing. This skill guides clear, effective microcopy for question phrasing, option labels, and agent personality tuning. Read `/mnt/.local-plugins/cache/knowledge-work-plugins/design/1.1.0/skills/ux-writing/SKILL.md` before drafting any question templates or system prompt copy. |
| **1D** (Frontend) | `frontend-design` + `design:accessibility-review` | AskUserCard is the most interaction-heavy component in Sprint 2. `frontend-design` ensures production-grade chip UI with polished micro-interactions. `design:accessibility-review` ensures chip cards are keyboard-navigable, screen-reader friendly (ARIA roles, focus management), and WCAG 2.1 AA compliant. Read both skill files before implementing. |
| **2A** (Backend Integration) | — | Wiring existing artifacts into route.ts; standard SDK patterns. |
| **2B** (Frontend Integration) | `frontend-design` + `design:design-system-management` | Wiring AskUserCard into the journey page and adding the progress bar header. `design:design-system-management` ensures new components use existing design tokens consistently (colors, spacing, typography from `globals.css`). Verify all new styles reference CSS variables, not hardcoded values. |
| **2C** (Regression) | — | Read-only verification. No skills needed. |
| **3A** (E2E Flow) | — | Integration testing; follows standard Playwright patterns. |
| **3B** (Edge Cases) | `design:ux-writing` | Edge case testing benefits from UX writing expertise — validates that error states, pushback messages, and fallback copy feel natural and helpful. |

**Skill Loading Protocol:** Sub-agents read skill SKILL.md files during their ORIENT phase (Step 1), before planning or writing any code. The skill file path follows the pattern:
- Core skills: `/mnt/.skills/skills/{skill-name}/SKILL.md`
- Plugin skills: `/mnt/.local-plugins/cache/knowledge-work-plugins/{plugin}/{version}/skills/{skill-name}/SKILL.md`

---

### Agent Team Communication

Sub-agents within the same wave are isolated (worktree). They cannot directly communicate. All coordination flows through the orchestrator via structured reports.

#### Communication Protocol

```
Sub-Agent → Report → Orchestrator → Context Brief → Next Wave Sub-Agents
```

**Every sub-agent produces a structured report on completion:**

```markdown
## Agent Report: {Agent ID} — {Theme}

### Files Created
- `path/to/file.ts` — description

### Files Modified
- `path/to/file.ts` — what changed and why

### Exports Available
- `functionName` from `@/path/to/module` — what it does
- `ComponentName` from `@/path/to/component` — props interface

### Interface Contracts
- `OnboardingState` shape: { fields collected, types, defaults }
- `AskUserCardProps`: { question, options, multiSelect, onResponse }

### Concerns / Deviations
- Any divergence from spec with justification

### Skill Insights Applied
- Key patterns or best practices used from skill files
```

#### Orchestrator Context Briefing

Between waves, the orchestrator creates a **Context Brief** — a compressed summary that gives the next wave's agents everything they need without overwhelming their context window.

```markdown
## Wave {N} → Wave {N+1} Context Brief

### What Was Built (Wave {N} Summary)
- Agent XA: Built {thing}, exported {exports}, file at {path}
- Agent XB: Built {thing}, exported {exports}, file at {path}

### Import Map (What Next Wave Agents Can Use)
| Export | Path | Type | Notes |
|--------|------|------|-------|
| `askUser` | `@/lib/ai/tools/ask-user` | Tool definition | Zod schema, parameters shape |
| `OnboardingState` | `@/lib/journey/session-state` | Interface + helpers | updateField(), getCompletion() |
| `AskUserCard` | `@/components/journey/ask-user-card` | React component | Props: AskUserCardProps |

### Known Issues
- Any unresolved concerns from agent reports

### Gate Status
- Build: ✅/❌
- Lint: ✅/❌
- Fix notes if any
```

#### Cross-Agent Dependencies

When a Wave 2 agent needs artifacts from Wave 1, the orchestrator ensures:

1. **The agent receives the Context Brief** — not the full report, keeping context lean
2. **The agent receives the exact file paths** — so it can `Read` the files it depends on
3. **The agent receives the interface contracts** — TypeScript types, prop shapes, export names
4. **The agent does NOT receive implementation details** — only the API surface

This prevents sub-agents from over-reading context and keeps them focused on their own domain.

#### Escalation Protocol

If a sub-agent encounters an issue that requires input from another agent's domain:

```
1. Sub-agent documents the issue in its Report under "Concerns / Deviations"
2. Sub-agent completes its task with a reasonable assumption (documented)
3. Orchestrator reads the concern during merge
4. Orchestrator spawns a targeted Fix Agent with:
   - The concern description
   - Both affected files
   - The correct resolution
5. Fix Agent resolves the issue in isolation
```

Sub-agents never wait on each other. They always complete with their best judgment and let the orchestrator resolve cross-domain issues.

#### Skill Knowledge Sharing

When a sub-agent discovers a valuable pattern from a skill file that would benefit other agents:

1. The agent notes it in "Skill Insights Applied" in its report
2. The orchestrator includes relevant insights in the next Context Brief
3. Example: Agent 1D discovers an accessibility pattern for chip components → orchestrator includes it in Wave 2 brief so Agent 2B applies it when wiring the chips into the page

---

### Custom Skill Creation (Post-Sprint)

After Sprint 2 completes, the orchestrator MAY use the `skill-creator` skill to package reusable patterns into a custom project skill:

- **`ai-gos-onboarding`** — Patterns for building conversational onboarding flows with askUser tool, including chip rendering, multi-select state machines, and session persistence
- **`ai-gos-agent-ui`** — Patterns for rendering AI agent tool results as interactive cards with approval flows

This is optional and only if recurring patterns emerge that would benefit Sprint 3+ execution. The `skill-creator` skill at `/mnt/.skills/skills/skill-creator/SKILL.md` has the full protocol for creating, testing, and optimizing custom skills.

---

## 9. Success Criteria

- [ ] User can complete onboarding via conversation in <5 minutes (no forms)
- [ ] askUser tool renders as interactive chip cards inline in chat
- [ ] Options are context-aware (Q3 options change based on Q1/Q2 answers)
- [ ] "Other" option opens free-text input, value is extracted to structured field
- [ ] Multi-select works for channels question (toggle chips + Done button)
- [ ] All 8 required fields collected before completion prompt
- [ ] Agent pushes back on vague answers with specific follow-ups
- [ ] Session state persists to Supabase + localStorage mirror
- [ ] Progress bar reflects field completion percentage
- [ ] Agent summarizes all data and asks for confirmation before completing
- [ ] Thinking blocks show collapsible with timer and streaming content
- [ ] All v1 pages unaffected (regression)
- [ ] `npm run build` passes
- [ ] `npm run lint` passes

---

## 10. Out of Scope (Deferred)

- Voice input (Groq Whisper) — Sprint 3+
- Background research during onboarding — Sprint 3
- URL scraping — Sprint 3 (store URLs in session metadata for now)
- Research activity ticker — Sprint 3
- Blueprint generation — Sprint 3+
- Two-column layout transition — Sprint 3+ (stays centered for all of Sprint 2)
