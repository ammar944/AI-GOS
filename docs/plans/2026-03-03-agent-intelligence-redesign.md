# Agent Intelligence Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the journey from a passive form-filler into a 3-stage progressive intelligence engine — instant hot-takes, fast competitor cards, and a full Opus research report with charts — ending with an agent mode shift to strategic advisor.

**Architecture:** Delete the right sidebar (context panel). Add a profile card pinned inline in chat that builds as each field is answered. Three intel stages fire throughout the conversation: (1) agent's own knowledge immediately after Q1-Q2, (2) fast competitor hits using existing Firecrawl+AdLibrary when a competitor/URL is mentioned, (3) all existing Opus sub-agents plus AntV chart generation at synthesis. After Stage 3 completes, the lead agent stops collecting and becomes a strategic advisor.

**Tech Stack:** Next.js 16, Vercel AI SDK v6, Anthropic SDK, `@antv/mcp-server-chart` SDK, existing `betaZodTool` pattern (Firecrawl, AdLibrary, SpyFu, PageSpeed, Perplexity)

---

### Task 1: Delete the right sidebar

**Files:**
- Delete: `src/components/shell/context-panel.tsx`
- Modify: `src/app/journey/page.tsx`

**Context:** The `ContextPanel` is only imported and used in `journey/page.tsx`. It is NOT re-exported from `src/components/shell/index.ts`. `AppShell` already handles the case where `rightPanel` prop is omitted — `showRightPanel` becomes false and the panel doesn't render.

**Step 1: Delete context-panel.tsx**

```bash
rm src/components/shell/context-panel.tsx
```

**Step 2: Remove ContextPanel from journey/page.tsx**

Open `src/app/journey/page.tsx`. Make these changes:

Remove the import on line 33:
```typescript
// DELETE this line:
import { ContextPanel } from '@/components/shell/context-panel';
```

Remove the `useShell` destructuring and its usage. Line 46 currently reads:
```typescript
const { setRightPanelCollapsed } = useShell();
```
Delete that line entirely. (If `useShell` is now unused, remove the import too — check line 10 which imports from `@/components/shell`.)

Remove `activePanelSection` state (around line 55):
```typescript
// DELETE:
const [activePanelSection, setActivePanelSection] = useState<string | null>(null);
```

Remove the `handleViewResearchSection` callback (lines 57-60):
```typescript
// DELETE:
const handleViewResearchSection = useCallback((section: string) => {
  setRightPanelCollapsed(false);
  setActivePanelSection(section);
}, [setRightPanelCollapsed]);
```

Simplify `journeyPhase` — the right-panel gating logic (Phase 2) is gone, only need to know if messages exist for WelcomeState. Replace the entire `journeyPhase` block (lines 152-169) with:
```typescript
const hasMessages = messages.length > 0;
const journeyPhase = hasMessages ? 1 : 0;
```

Remove the `useEffect` that opens the right panel (lines 171-176):
```typescript
// DELETE:
useEffect(() => {
  if (journeyPhase >= 2) {
    setRightPanelCollapsed(false);
  }
}, [journeyPhase, setRightPanelCollapsed]);
```

In the `<AppShell>` render (lines 360-378), remove the `rightPanel` prop entirely:
```tsx
// BEFORE:
<AppShell
  sidebar={<AppSidebar />}
  rightPanel={
    <ContextPanel
      onboardingState={onboardingState}
      messages={messages}
      journeyProgress={journeyProgress}
      activeSectionKey={activePanelSection}
      onClearActiveSection={() => setActivePanelSection(null)}
    />
  }
>

// AFTER:
<AppShell sidebar={<AppSidebar />}>
```

Remove `onViewResearchSection` from all `<ChatMessage>` usages — these were only needed to open the right panel. Find in the render (around line 317):
```tsx
// BEFORE:
onViewResearchSection={handleViewResearchSection}

// AFTER: (delete this prop entirely)
```

Also remove `journeyProgress` useMemo (it was only used by ContextPanel):
```typescript
// DELETE (lines 75-88):
const journeyProgress = useMemo(
  () =>
    computeJourneyProgress({...}),
  [onboardingState]
);
```

And the `computeJourneyProgress` import.

**Step 3: Run build to confirm no errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completes. If there are unused import errors, remove those imports too.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: delete right sidebar — ContextPanel removed from journey"
```

---

### Task 2: Install AntV chart package

**Files:**
- `package.json` (via npm install)

**Context:** `@antv/mcp-server-chart` provides a server-side SDK to generate chart images. Call `callTool(chartType, spec)` and get back a hosted image URL. No browser dependency — runs in Node.js API routes and sub-agents.

**Step 1: Install the package**

```bash
npm install @antv/mcp-server-chart
```

**Step 2: Verify import works**

```bash
node -e "const { callTool } = require('@antv/mcp-server-chart/sdk'); console.log(typeof callTool);"
```

Expected output: `function`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @antv/mcp-server-chart for chart generation"
```

---

### Task 3: Create AntV chart generator betaZodTool

**Files:**
- Create: `src/lib/ai/tools/mcp/chart-tool.ts`
- Modify: `src/lib/ai/tools/mcp/index.ts`

**Context:** This follows the exact same `betaZodTool` pattern as `firecrawl-tool.ts`. It wraps the AntV SDK's `callTool()` for use by Anthropic SDK sub-agents (specifically `synthesizeResearch`).

**Step 1: Create the chart tool**

Create `src/lib/ai/tools/mcp/chart-tool.ts`:

```typescript
// MCP Tool Wrapper: AntV Chart Generator
// betaZodTool wrapping @antv/mcp-server-chart/sdk for use by Anthropic SDK sub-agents

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
// @ts-expect-error — no official types yet for this package
import { callTool } from '@antv/mcp-server-chart/sdk';

const CHART_TYPES = [
  'bar',
  'pie',
  'radar',
  'funnel',
  'word_cloud',
  'dual_axes',
  'line',
  'sankey',
] as const;

export const chartTool = betaZodTool({
  name: 'generateChart',
  description:
    'Generate a data visualization chart and get back a hosted image URL. ' +
    'Use for: pie (budget allocation), radar (competitor scoring), bar (comparisons), ' +
    'funnel (conversion path), word_cloud (keyword themes). ' +
    'Returns a URL to a hosted PNG image you can embed in your response.',
  inputSchema: z.object({
    chartType: z
      .enum(CHART_TYPES)
      .describe('The type of chart to generate'),
    title: z.string().describe('Chart title shown at the top'),
    data: z
      .array(z.record(z.unknown()))
      .describe('Array of data objects. Structure depends on chartType.'),
    xField: z
      .string()
      .optional()
      .describe('For bar/line/dual_axes: the field name for the x-axis'),
    yField: z
      .string()
      .optional()
      .describe('For bar/line: the field name for the y-axis'),
    colorField: z
      .string()
      .optional()
      .describe('For pie/radar: the field used for color/category'),
    valueField: z
      .string()
      .optional()
      .describe('For pie/radar/word_cloud: the field with the numeric value'),
  }),
  run: async ({ chartType, title, data, xField, yField, colorField, valueField }) => {
    try {
      const toolName = `generate_${chartType}_chart`;
      const spec: Record<string, unknown> = { title, data };
      if (xField) spec.xField = xField;
      if (yField) spec.yField = yField;
      if (colorField) spec.colorField = colorField;
      if (valueField) spec.valueField = valueField;

      const result = await callTool(toolName, spec);
      return JSON.stringify({
        success: true,
        url: result?.url ?? result,
        chartType,
        title,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
```

**Step 2: Export from mcp/index.ts**

Open `src/lib/ai/tools/mcp/index.ts` and add:

```typescript
export { chartTool } from './chart-tool';
```

**Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no TypeScript errors related to chart-tool.

**Step 4: Commit**

```bash
git add src/lib/ai/tools/mcp/chart-tool.ts src/lib/ai/tools/mcp/index.ts
git commit -m "feat: add AntV chart generator betaZodTool"
```

---

### Task 4: Update synthesizeResearch to generate charts

**Files:**
- Modify: `src/lib/ai/tools/research/synthesize-research.ts`

**Context:** `synthesizeResearch` currently runs a pure-synthesis sub-agent with no tools. We add `chartTool` to the sub-agent and instruct it to generate charts at the end of its analysis. The JSON output gains a `charts` array.

**Step 1: Update synthesize-research.ts**

Open `src/lib/ai/tools/research/synthesize-research.ts`.

Add the import at the top:
```typescript
import { chartTool } from '@/lib/ai/tools/mcp';
```

Replace the `SYNTHESIS_SYSTEM_PROMPT` constant — add chart generation instructions after the `nextSteps` section in OUTPUT FORMAT, and add a CHART GENERATION section:

Find the section that starts `PLATFORM RECOMMENDATIONS:` and add after the existing `OUTPUT FORMAT:` block (keep all existing JSON structure, just add charts field):

In the JSON output structure, add after `"nextSteps"`:
```
"charts": [
  {
    "chartType": "pie | radar | bar | funnel | word_cloud",
    "title": "string",
    "imageUrl": "string — URL returned by generateChart tool",
    "description": "string — 1 sentence explaining what this chart shows"
  }
]
```

Add this section to the system prompt (before `OUTPUT FORMAT:`):

```
CHART GENERATION:
After completing your strategic analysis, generate 2-3 charts using the generateChart tool to visualize key insights:

1. Budget allocation pie chart (if budget is known):
   - chartType: "pie"
   - title: "Recommended Budget Allocation"
   - data: array of { channel, percentage } from your platformRecommendations
   - colorField: "channel", valueField: "percentage"

2. Competitor positioning radar chart (if competitor data available):
   - chartType: "radar"
   - title: "Competitive Positioning"
   - data: array of { competitor, metric, score } for 3-5 positioning dimensions
   - colorField: "competitor", valueField: "score"

3. Channel performance comparison bar chart:
   - chartType: "bar"
   - title: "Channel Priority by ICP Concentration"
   - data: array of { channel, score } from your platform recommendations
   - xField: "channel", yField: "score"

Call generateChart for each chart. Add the returned imageUrl and a 1-sentence description to the "charts" array in your JSON output. If a chart fails, skip it — do not fail the whole synthesis.
```

In `execute()`, change `tools: []` to `tools: [chartTool]`:
```typescript
// BEFORE:
tools: [],

// AFTER:
tools: [chartTool],
```

**Step 2: Verify types pass**

```bash
npx tsc --noEmit 2>&1 | grep -E "synthesize|chart" | head -10
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/lib/ai/tools/research/synthesize-research.ts
git commit -m "feat: add chart generation to synthesizeResearch sub-agent"
```

---

### Task 5: Create ProfileCard component

**Files:**
- Create: `src/components/journey/profile-card.tsx`

**Context:** A compact dossier card that renders inline at the top of the chat messages area. It reads from `onboardingState` and fills in field-by-field as the user answers questions. Shows progress bar. Hidden when no fields answered yet.

**Step 1: Create the component**

Create `src/components/journey/profile-card.tsx`:

```tsx
'use client';

import { cn } from '@/lib/utils';
import type { OnboardingState } from '@/lib/journey/session-state';

interface ProfileCardProps {
  state: Partial<OnboardingState> | null;
  className?: string;
}

interface FieldDef {
  key: keyof OnboardingState;
  label: string;
  format?: (v: unknown) => string;
}

const FIELDS: FieldDef[] = [
  { key: 'companyName', label: 'Company' },
  { key: 'websiteUrl', label: 'Website' },
  { key: 'businessModel', label: 'Model' },
  { key: 'industry', label: 'Industry' },
  { key: 'icpDescription', label: 'ICP' },
  { key: 'productDescription', label: 'Product' },
  { key: 'competitors', label: 'Competitors' },
  { key: 'offerPricing', label: 'Pricing' },
  {
    key: 'marketingChannels',
    label: 'Channels',
    format: (v) => (Array.isArray(v) ? v.join(', ') : String(v)),
  },
  { key: 'goals', label: 'Goals' },
  { key: 'monthlyBudget', label: 'Budget' },
];

const REQUIRED_KEYS: Array<keyof OnboardingState> = [
  'businessModel',
  'industry',
  'icpDescription',
  'productDescription',
  'competitors',
  'offerPricing',
  'marketingChannels',
  'goals',
];

export function ProfileCard({ state, className }: ProfileCardProps) {
  if (!state) return null;

  const answeredFields = FIELDS.filter((f) => {
    const v = state[f.key];
    return v !== undefined && v !== null && v !== '';
  });

  if (answeredFields.length === 0) return null;

  const requiredAnswered = REQUIRED_KEYS.filter((k) => {
    const v = state[k];
    return v !== undefined && v !== null && v !== '';
  }).length;
  const progress = requiredAnswered / REQUIRED_KEYS.length;

  return (
    <div
      className={cn('mb-6 rounded-xl p-4', className)}
      style={{
        background: 'var(--bg-glass-panel)',
        border: '1px solid var(--border-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium tracking-wide uppercase"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-instrument-sans)' }}
        >
          Client Dossier
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {requiredAnswered}/{REQUIRED_KEYS.length} fields
        </span>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
        {answeredFields.map(({ key, label, format }) => {
          const raw = state[key];
          const value = format ? format(raw) : String(raw);
          const truncated = value.length > 40 ? value.slice(0, 38) + '…' : value;
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {label}
              </span>
              <span
                className="text-xs leading-snug"
                style={{ color: 'var(--text-primary)' }}
                title={value}
              >
                {truncated}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        className="h-0.5 w-full rounded-full overflow-hidden"
        style={{ background: 'var(--border-glass)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.round(progress * 100)}%`,
            background: 'var(--accent-primary, #6366f1)',
          }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "profile-card" | head -10
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/journey/profile-card.tsx
git commit -m "feat: ProfileCard component — inline dossier that builds as fields answered"
```

---

### Task 6: Wire ProfileCard into journey page

**Files:**
- Modify: `src/app/journey/page.tsx`

**Context:** ProfileCard goes inside the scrollable messages area, above the conversation messages but below the resume/welcome message. It always renders when `onboardingState` has at least one answered field.

**Step 1: Import ProfileCard**

In `src/app/journey/page.tsx`, add the import near the other journey component imports:
```typescript
import { ProfileCard } from '@/components/journey/profile-card';
```

**Step 2: Insert ProfileCard in the chat content**

Find the messages area in `chatContent` (around line 281). Currently it starts with:
```tsx
<div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
  {/* Resume prompt OR welcome message */}
  {showResumePrompt && savedSession ? (
    <ResumePrompt ... />
  ) : (
    <ChatMessage role="assistant" content={welcomeMessage} ... />
  )}

  {/* Conversation messages */}
  {messages.map(...)}
```

Add ProfileCard AFTER the welcome/resume section but BEFORE the messages map:
```tsx
<div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
  {/* Resume prompt OR welcome message */}
  {showResumePrompt && savedSession ? (
    <ResumePrompt ... />
  ) : (
    <ChatMessage role="assistant" content={welcomeMessage} ... />
  )}

  {/* Inline profile card — renders once at least one field is answered */}
  <ProfileCard state={onboardingState} />

  {/* Conversation messages */}
  {messages.map(...)}
```

**Step 3: Manual verification**

Start dev server:
```bash
npm run dev
```

Navigate to `http://localhost:3000/journey`. Answer one chip question. After answering, verify:
- Profile card appears above the conversation messages
- It shows the answered field's label and value
- Progress bar shows `1/8`
- The card does NOT appear before any fields are answered

**Step 4: Commit**

```bash
git add src/app/journey/page.tsx
git commit -m "feat: wire ProfileCard into journey page — renders inline above messages"
```

---

### Task 7: Stage 1 system prompt — instant hot-takes

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`

**Context:** After businessModel and industry are confirmed, the lead agent should immediately drop a sharp market take using its own training knowledge — no tools, no latency. This shows the agent is already thinking about their specific situation, not just filling in a form. Add this as a new section in the system prompt.

**Step 1: Add Stage 1 instructions to system prompt**

Open `src/lib/ai/prompts/lead-agent-system.ts`.

Find the `## What You're Doing Right Now` section (around line 87). After the paragraph about `askUser`, add a new section:

```
## Progressive Intelligence

The conversation delivers intelligence in 3 stages. You control Stage 1 and Stage 2 — Stage 3 is the full research pipeline.

### Stage 1 — Instant Hot-Take (your own knowledge, no tools)

As soon as **businessModel** AND **industry** are both confirmed, include a 2-3 sentence market hot-take in your response — before asking the next question. This uses your training knowledge only. No tool calls needed.

Rules for the hot-take:
- Reference their specific combination (e.g., "B2B SaaS in Developer Tools", not generic)
- Give a real, opinionated take: typical CAC range, key buying behavior, competitive intensity, or seasonal pattern
- Frame it as "while I pull live data, here's what I already know": shows the AI is working even while talking
- Keep it to 2-3 sentences max, then immediately continue with the next question

Example:
"B2B SaaS in DevTools — you're in a crowded auction. LinkedIn CPL typically runs $200-400 for engineers, but Google Search (problem-aware keywords like 'CI/CD tools', 'monorepo tooling') often converts better. Q1 and Q4 are your buying windows as teams get new headcount approved. Let me run live market data while we keep going."

### Stage 2 — Fast Competitor Hit (Firecrawl + Ad Library)

When the user **names a competitor** OR **provides a website URL** (their own or a competitor's), immediately call `competitorFastHits` before your next question.

Trigger conditions:
- User says "my competitors are X, Y" — call with the first named competitor's domain
- User provides a URL in their message — call with that URL
- User says "I don't know my competitors" — skip Stage 2, continue onboarding

After calling competitorFastHits:
- Briefly acknowledge what you found (1-2 sentences)
- Continue with the next onboarding question

### Stage 3 — Full Research Pipeline

This is the existing research flow (researchIndustry, researchCompetitors, etc.). Run as before.
After **synthesizeResearch** completes — including any charts it generates — you enter Strategist Mode:
- No more askUser calls for onboarding fields
- Present synthesis findings and any charts inline
- Ask: "Where do you want to focus first — channel strategy, messaging angles, or ICP targeting?"
- Respond to their choice with specific strategic recommendations
```

**Step 2: Verify the prompt still exports correctly**

```bash
npx tsc --noEmit 2>&1 | grep "lead-agent-system" | head -5
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "feat: Stage 1 instant hot-takes + Stage 2/3 trigger instructions in system prompt"
```

---

### Task 8: Create competitorFastHits lead agent tool

**Files:**
- Create: `src/lib/ai/tools/competitor-fast-hits.ts`

**Context:** This is a LEAD AGENT tool (uses `tool` from Vercel AI SDK, registered in `streamText`). It runs a fast Anthropic SDK sub-agent using Haiku (speed over depth) with Firecrawl and Ad Library tools. Returns a structured competitor snapshot in under 10 seconds.

Unlike the research tools which use Opus for depth, this sub-agent uses Haiku for speed. The lead agent presents the findings conversationally.

**Step 1: Create the tool**

Create `src/lib/ai/tools/competitor-fast-hits.ts`:

```typescript
// Lead Agent Tool: Fast Competitor Intelligence
// Stage 2 — runs a Haiku sub-agent with Firecrawl + Ad Library for quick competitor snapshot
// Target: < 10 seconds from call to result

import { tool } from 'ai';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { firecrawlTool } from '@/lib/ai/tools/mcp/firecrawl-tool';
import { adLibraryTool } from '@/lib/ai/tools/mcp/ad-library-tool';

const FAST_HIT_PROMPT = `You are a fast competitive intelligence researcher.
Get a quick snapshot of this competitor for a paid media strategist.

TOOLS:
1. Use firecrawl to scrape the competitor's homepage — extract their value prop, key benefits, and any pricing signals
2. Use adLibraryTool to check their current ad activity on Meta

SPEED RULES:
- Make at most 2 tool calls total (1 firecrawl + 1 adLibrary)
- Do NOT make multiple searches — one shot per tool
- If a tool fails, skip it and use what you have

OUTPUT FORMAT:
Return ONLY valid JSON, no other text:
{
  "name": "string — company name",
  "url": "string — their domain",
  "valueProposition": "string — their core claim in 1 sentence",
  "pricingSignal": "string — any pricing found, or 'not found'",
  "activeAdCount": number or null,
  "adThemes": ["string — 2-3 ad creative themes if found"],
  "trafficEstimate": "string — 'high/medium/low' based on site quality signals, or 'unknown'",
  "keyStrength": "string — single biggest competitive strength from what you found",
  "keyWeakness": "string — single most obvious weakness or gap"
}`;

export const competitorFastHits = tool({
  description:
    'Get a fast competitor intelligence snapshot (< 10s). ' +
    'Scrapes their homepage and checks ad library activity. ' +
    'Call this immediately when the user names a competitor or provides a competitor URL. ' +
    'Pass the competitor domain/URL and any context about the client business.',
  inputSchema: z.object({
    competitorUrl: z
      .string()
      .describe(
        'The competitor domain or URL (e.g., "hubspot.com" or "https://www.hubspot.com")',
      ),
    clientContext: z
      .string()
      .optional()
      .describe(
        'Brief context about the client: business model, industry, ICP. Used to interpret competitor relevance.',
      ),
  }),
  execute: async ({ competitorUrl, clientContext }) => {
    const client = new Anthropic();
    const startTime = Date.now();

    // Normalize URL
    const url = competitorUrl.startsWith('http')
      ? competitorUrl
      : `https://${competitorUrl}`;

    const userContent = clientContext
      ? `Research this competitor: ${url}\n\nClient context: ${clientContext}`
      : `Research this competitor: ${url}`;

    try {
      const stream = client.beta.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        tools: [firecrawlTool, adLibraryTool],
        system: FAST_HIT_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });

      const finalMsg = await stream.finalMessage();

      const textBlock = finalMsg.content.findLast((b) => b.type === 'text');
      const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';

      let data: unknown;
      try {
        const trimmed = resultText.trim();
        const first = trimmed.indexOf('{');
        const last = trimmed.lastIndexOf('}');
        data = JSON.parse(
          first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed,
        );
      } catch {
        data = { summary: resultText };
      }

      return {
        status: 'complete' as const,
        competitor: competitorUrl,
        data,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        competitor: competitorUrl,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "competitor-fast-hits" | head -5
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/lib/ai/tools/competitor-fast-hits.ts
git commit -m "feat: competitorFastHits lead agent tool — Stage 2 fast competitor intel"
```

---

### Task 9: Wire competitorFastHits into streaming route

**Files:**
- Modify: `src/app/api/journey/stream/route.ts`

**Context:** The streaming route is where all lead agent tools are registered with `streamText`. Add `competitorFastHits` to the tools object. Also increase `stopWhen` from 20 to 25 steps to accommodate Stage 2 extra tool calls.

**Step 1: Add import and register tool**

Open `src/app/api/journey/stream/route.ts`.

Add import near the other tool imports:
```typescript
import { competitorFastHits } from '@/lib/ai/tools/competitor-fast-hits';
```

In the `streamText` call, add `competitorFastHits` to the tools object:
```typescript
tools: {
  askUser,
  competitorFastHits,    // ← add this
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
},
```

Change `stopWhen: stepCountIs(20)` to `stopWhen: stepCountIs(25)`:
```typescript
stopWhen: stepCountIs(25),
```

**Step 2: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | grep -v "node_modules" | head -10
```

Expected: clean build.

**Step 3: Commit**

```bash
git add src/app/api/journey/stream/route.ts
git commit -m "feat: register competitorFastHits in streaming route"
```

---

### Task 10: Extract Claude Skills into sub-agent system prompts

**Files:**
- Create: `src/lib/ai/prompts/skills/paid-ads-skill.ts`
- Create: `src/lib/ai/prompts/skills/competitor-analysis-skill.ts`
- Modify: `src/lib/ai/tools/research/research-competitors.ts`
- Modify: `src/lib/ai/tools/research/synthesize-research.ts`

**Context:** The `marketingskills` GitHub repo has 32 skills as system prompt libraries. We extract the core paid-ads and competitor-analysis content and prepend it to the relevant sub-agent system prompts. This gives sub-agents richer marketing domain knowledge without changing their tool setup.

**Step 1: Create paid-ads-skill.ts**

Create `src/lib/ai/prompts/skills/paid-ads-skill.ts`:

```typescript
// Extracted from marketingskills/paid-ads skill
// Prepend to sub-agent system prompts that need paid media expertise

export const PAID_ADS_SKILL = `
## Paid Media Domain Knowledge

### Platform Benchmarks (2024-2025)
- Google Search: avg CPC $2-8 for mid-market SaaS, CTR 3-6% for branded terms
- LinkedIn Ads: CPL $150-400 for B2B, CPC $8-20, best for titles/functions targeting
- Meta Ads: CPM $20-50 for B2B audiences, CPL $30-80 for SMB, $100-200 for enterprise
- YouTube: CPV $0.03-0.10, 25-40% view-through rate on 30s ads

### CAC by Business Model
- B2B SaaS: $800-3,000 (SMB), $3,000-15,000 (mid-market), $15,000+ (enterprise)
- B2C SaaS: $20-150 (consumer), $50-500 (prosumer)
- E-commerce: $15-80 (impulse buys), $50-200 (considered purchases)
- Marketplace: $20-100 (supply side), $5-30 (demand side)

### ROAS Benchmarks
- Minimum viable ROAS: 2x (covering ad spend)
- Target ROAS: 3-4x for scaling, 5x+ for profitable growth
- Cold traffic ROAS is always lower than retargeting (expect 30-50% lower)

### Creative Performance Patterns
- Hook quality determines 80% of ad performance — first 3 seconds on video, first line on static
- Pain-agitation-solution outperforms feature-benefit for B2B
- Social proof (customer logos, review counts) lifts CTR 15-25% on landing pages
- Specificity beats generality: "$47K saved" > "save money", "3x faster" > "saves time"

### Budget Allocation by Funnel Stage
- Awareness (cold traffic): 50-60% of budget
- Consideration (warm/retargeting): 25-30%
- Conversion (hot retargeting): 15-20%
`;
```

**Step 2: Create competitor-analysis-skill.ts**

Create `src/lib/ai/prompts/skills/competitor-analysis-skill.ts`:

```typescript
// Extracted from marketingskills/competitor-alternatives skill
// Prepend to researchCompetitors sub-agent system prompt

export const COMPETITOR_ANALYSIS_SKILL = `
## Competitive Analysis Domain Knowledge

### Ad Library Interpretation
- 0-5 active ads: testing phase or low investment
- 5-20 active ads: established presence, iterating
- 20-50 active ads: scaling actively, well-funded
- 50+ active ads: dominant advertiser, heavy investment

### Competitive Positioning Frameworks
- Category leader: focuses on market share ("the #1 X")
- Challenger: attacks leader's weakness ("X without the [pain]")
- Niche specialist: owns a segment ("the only X for [ICP]")
- Price disruptor: "enterprise features at SMB prices"

### Review Mining (G2/Capterra) Patterns
- Look for reviews mentioning "switched from X" — reveals switching triggers
- 1-2 star reviews reveal acute pain points = your messaging hooks
- Feature requests in reviews = product gaps = white space opportunity
- "What do you wish it did" reviews = unmet needs your offer should address

### White Space Identification
- Messaging white space: emotional angles no one owns
- Audience white space: ICP sub-segments being ignored
- Channel white space: platforms with weak competitor presence
- Feature white space: capabilities no one talks about in ads
`;
```

**Step 3: Prepend skills to sub-agent system prompts**

In `src/lib/ai/tools/research/research-competitors.ts`, add import at top:
```typescript
import { COMPETITOR_ANALYSIS_SKILL } from '@/lib/ai/prompts/skills/competitor-analysis-skill';
```

Then in the `execute()` function, update the `system` field:
```typescript
// BEFORE:
system: COMPETITORS_SYSTEM_PROMPT,

// AFTER:
system: COMPETITOR_ANALYSIS_SKILL + '\n\n---\n\n' + COMPETITORS_SYSTEM_PROMPT,
```

In `src/lib/ai/tools/research/synthesize-research.ts`, add import:
```typescript
import { PAID_ADS_SKILL } from '@/lib/ai/prompts/skills/paid-ads-skill';
```

Update `system` in execute():
```typescript
// BEFORE:
system: SYNTHESIS_SYSTEM_PROMPT,

// AFTER:
system: PAID_ADS_SKILL + '\n\n---\n\n' + SYNTHESIS_SYSTEM_PROMPT,
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "error|Error" | grep -v "node_modules" | head -10
```

**Step 5: Commit**

```bash
git add src/lib/ai/prompts/skills/ src/lib/ai/tools/research/research-competitors.ts src/lib/ai/tools/research/synthesize-research.ts
git commit -m "feat: inject Claude Skills domain knowledge into competitor + synthesis sub-agents"
```

---

### Task 11: Final build and smoke test

**Files:** None — verification only.

**Step 1: Full build**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds with 0 errors.

**Step 2: Run existing tests**

```bash
npm run test:run 2>&1 | tail -20
```

Expected: all tests pass. (Pre-existing failures in openrouter tests are known and can be ignored.)

**Step 3: Dev server smoke test**

Start:
```bash
npm run dev
```

Navigate to `http://localhost:3000/journey`. Run through these checks:

1. **Right sidebar removed**: Page should be two-panel (left sidebar + chat). No right panel visible.

2. **ProfileCard**: Answer the first askUser chip (businessModel). After answering, a "Client Dossier" card should appear above the conversation, showing the answered field.

3. **Stage 1 hot-take**: After businessModel + industry are answered, the next assistant message should include a 2-3 sentence market take before asking the next question.

4. **CompetitorFastHits**: In the competitors question, select "I can name my top 2-3" then type a competitor name with a domain (e.g., "HubSpot, hubspot.com"). The agent should call `competitorFastHits` and present a brief competitive snapshot.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: agent intelligence redesign complete — 3-stage progressive intel, profile card, charts"
```

---

## Implementation Order Summary

| Task | What | Est. time |
|------|------|-----------|
| 1 | Delete right sidebar | 15 min |
| 2 | Install @antv/mcp-server-chart | 5 min |
| 3 | Create chart betaZodTool | 15 min |
| 4 | Update synthesizeResearch for charts | 20 min |
| 5 | Create ProfileCard component | 20 min |
| 6 | Wire ProfileCard into journey page | 10 min |
| 7 | Stage 1 system prompt update | 15 min |
| 8 | Create competitorFastHits tool | 25 min |
| 9 | Wire into streaming route | 10 min |
| 10 | Claude Skills extraction | 15 min |
| 11 | Build + smoke test | 15 min |
