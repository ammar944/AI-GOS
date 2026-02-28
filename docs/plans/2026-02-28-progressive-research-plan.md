# Progressive Research Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `runResearch` server-executed tool to the journey agent so it fires research progressively during conversation instead of batch-after-confirmation.

**Architecture:** Factory-pattern tool (`createRunResearchTool`) with message-history-as-cache. The route extracts previous research results from messages on each request and passes them via closure. Research functions from `research.ts` are called directly. Frontend renders results as inline cards.

**Tech Stack:** Vercel AI SDK `tool()`, Zod schemas, Perplexity Sonar Pro, existing `research.ts` functions, Framer Motion, React

**Design doc:** `docs/plans/2026-02-28-progressive-research-design.md`

---

### Task 1: Create the `runResearch` tool factory

**Files:**
- Create: `src/lib/ai/tools/run-research.ts`

**Step 1: Create the tool file with input schema, context builder, and execute function**

```typescript
// src/lib/ai/tools/run-research.ts
import { tool } from 'ai';
import { z } from 'zod';
import {
  researchIndustryMarket,
  researchICPAnalysis,
  researchOfferAnalysis,
  researchCompetitors,
  synthesizeCrossAnalysis,
} from '@/lib/ai/research';
import type {
  IndustryMarketResult,
  ICPAnalysisResult,
  OfferAnalysisResult,
  CompetitorAnalysisResult,
  AllSectionResults,
} from '@/lib/ai/types';

// ── Section metadata ────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  industryMarket: 'Industry & Market Research',
  competitors: 'Competitor Analysis',
  icpValidation: 'ICP Validation',
  offerAnalysis: 'Offer Analysis',
  crossAnalysis: 'Cross-Analysis Synthesis',
};

const REQUIRED_FIELDS: Record<string, string[]> = {
  industryMarket: ['businessModel', 'industry'],
  competitors: ['industry', 'productDescription'],
  icpValidation: ['businessModel', 'industry', 'icpDescription'],
  offerAnalysis: ['productDescription', 'offerPricing'],
  crossAnalysis: [], // validated separately — needs all 4 prior sections
};

// ── Context string builder ──────────────────────────────────────────────────

const contextSchema = z.object({
  businessModel: z.string().optional(),
  industry: z.string().optional(),
  icpDescription: z.string().optional(),
  productDescription: z.string().optional(),
  competitors: z.string().optional(),
  offerPricing: z.string().optional(),
  companyName: z.string().optional(),
  websiteUrl: z.string().optional(),
  monthlyBudget: z.string().optional(),
  geographicFocus: z.string().optional(),
  salesCycleLength: z.string().optional(),
  avgDealSize: z.string().optional(),
});

type ResearchContext = z.infer<typeof contextSchema>;

function buildContextString(ctx: ResearchContext): string {
  const lines: string[] = [];
  if (ctx.companyName) lines.push(`Company: ${ctx.companyName}`);
  if (ctx.websiteUrl) lines.push(`Website: ${ctx.websiteUrl}`);
  if (ctx.businessModel) lines.push(`Business Model: ${ctx.businessModel}`);
  if (ctx.industry) lines.push(`Industry: ${ctx.industry}`);
  if (ctx.productDescription) lines.push(`Product/Service: ${ctx.productDescription}`);
  if (ctx.icpDescription) lines.push(`Target Customer (ICP): ${ctx.icpDescription}`);
  if (ctx.competitors) lines.push(`Competitors: ${ctx.competitors}`);
  if (ctx.offerPricing) lines.push(`Pricing: ${ctx.offerPricing}`);
  if (ctx.monthlyBudget) lines.push(`Monthly Ad Budget: ${ctx.monthlyBudget}`);
  if (ctx.geographicFocus) lines.push(`Geographic Focus: ${ctx.geographicFocus}`);
  if (ctx.salesCycleLength) lines.push(`Sales Cycle: ${ctx.salesCycleLength}`);
  if (ctx.avgDealSize) lines.push(`Average Deal Size: ${ctx.avgDealSize}`);
  return lines.join('\n');
}

// ── Field validation ────────────────────────────────────────────────────────

function validateRequiredFields(
  section: string,
  ctx: ResearchContext,
): string | null {
  const required = REQUIRED_FIELDS[section];
  if (!required) return `Unknown section: ${section}`;

  const missing = required.filter(
    (field) => !ctx[field as keyof ResearchContext]?.trim(),
  );

  if (missing.length > 0) {
    return `Missing required fields for ${SECTION_LABELS[section]}: ${missing.join(', ')}`;
  }
  return null;
}

// ── Types for previous research results ─────────────────────────────────────

export interface PreviousResearch {
  industryMarket?: IndustryMarketResult['data'];
  competitors?: CompetitorAnalysisResult['data'];
  icpValidation?: ICPAnalysisResult['data'];
  offerAnalysis?: OfferAnalysisResult['data'];
}

// ── Tool factory ────────────────────────────────────────────────────────────

export function createRunResearchTool(deps: {
  previousResearch: PreviousResearch;
}) {
  return tool({
    description:
      'Execute a specific research section using Perplexity and Claude. ' +
      'Call this as soon as you have enough context for a section — don\'t wait for all fields. ' +
      'Each section only needs to run once per session.',
    inputSchema: z.object({
      section: z.enum([
        'industryMarket',
        'competitors',
        'icpValidation',
        'offerAnalysis',
        'crossAnalysis',
      ]),
      context: contextSchema,
    }),
    execute: async ({ section, context }) => {
      const startTime = Date.now();

      // Validate required fields
      if (section !== 'crossAnalysis') {
        const error = validateRequiredFields(section, context);
        if (error) {
          return { section, status: 'error' as const, error, durationMs: 0 };
        }
      }

      const contextString = buildContextString(context);

      try {
        switch (section) {
          case 'industryMarket': {
            const result = await researchIndustryMarket(contextString);
            return {
              section,
              status: 'complete' as const,
              data: result.data,
              sources: result.sources,
              durationMs: Date.now() - startTime,
              cost: result.cost,
            };
          }

          case 'competitors': {
            // Parse competitor names if provided
            const competitorNames = context.competitors
              ?.split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean);
            const result = await researchCompetitors(
              contextString,
              competitorNames?.length ? competitorNames : undefined,
            );
            return {
              section,
              status: 'complete' as const,
              data: result.data,
              sources: result.sources,
              durationMs: Date.now() - startTime,
              cost: result.cost,
            };
          }

          case 'icpValidation': {
            const industryData = deps.previousResearch.industryMarket;
            if (!industryData) {
              return {
                section,
                status: 'error' as const,
                error:
                  'industryMarket research must complete before running icpValidation. ' +
                  'Call runResearch with section "industryMarket" first.',
                durationMs: 0,
              };
            }
            const result = await researchICPAnalysis(
              contextString,
              industryData,
            );
            return {
              section,
              status: 'complete' as const,
              data: result.data,
              sources: result.sources,
              durationMs: Date.now() - startTime,
              cost: result.cost,
            };
          }

          case 'offerAnalysis': {
            const industryData = deps.previousResearch.industryMarket;
            if (!industryData) {
              return {
                section,
                status: 'error' as const,
                error:
                  'industryMarket research must complete before running offerAnalysis. ' +
                  'Call runResearch with section "industryMarket" first.',
                durationMs: 0,
              };
            }
            const result = await researchOfferAnalysis(
              contextString,
              industryData,
            );
            return {
              section,
              status: 'complete' as const,
              data: result.data,
              sources: result.sources,
              durationMs: Date.now() - startTime,
              cost: result.cost,
            };
          }

          case 'crossAnalysis': {
            const { industryMarket, competitors, icpValidation, offerAnalysis } =
              deps.previousResearch;
            if (
              !industryMarket ||
              !competitors ||
              !icpValidation ||
              !offerAnalysis
            ) {
              const missing = [
                !industryMarket && 'industryMarket',
                !competitors && 'competitors',
                !icpValidation && 'icpValidation',
                !offerAnalysis && 'offerAnalysis',
              ].filter(Boolean);
              return {
                section,
                status: 'error' as const,
                error: `All 4 research sections must complete before crossAnalysis. Missing: ${missing.join(', ')}`,
                durationMs: 0,
              };
            }
            const allSections: AllSectionResults = {
              industryMarket,
              icpAnalysis: icpValidation,
              offerAnalysis,
              competitorAnalysis: competitors,
            };
            const result = await synthesizeCrossAnalysis(
              contextString,
              allSections,
            );
            return {
              section,
              status: 'complete' as const,
              data: result.data,
              sources: result.sources,
              durationMs: Date.now() - startTime,
              cost: result.cost,
            };
          }

          default:
            return {
              section,
              status: 'error' as const,
              error: `Unknown section: ${section}`,
              durationMs: 0,
            };
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown research error';
        console.error(`[runResearch] ${section} failed:`, err);
        return {
          section,
          status: 'error' as const,
          error: message,
          durationMs: Date.now() - startTime,
        };
      }
    },
  });
}

// ── Extract previous research from message history ──────────────────────────

interface MessageLike {
  role: string;
  parts: Array<{ type: string; [key: string]: unknown }>;
}

export function extractResearchResults(
  messages: MessageLike[],
): PreviousResearch {
  const results: PreviousResearch = {};

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (
        typeof part.type === 'string' &&
        part.type === 'tool-runResearch' &&
        part.state === 'output-available'
      ) {
        // output can be string (JSON) or object
        let output: Record<string, unknown> | undefined;
        if (typeof part.output === 'string') {
          try {
            output = JSON.parse(part.output);
          } catch {
            continue;
          }
        } else {
          output = part.output as Record<string, unknown> | undefined;
        }

        if (!output || output.status !== 'complete' || !output.data) continue;

        const section = output.section as string;
        switch (section) {
          case 'industryMarket':
            results.industryMarket =
              output.data as PreviousResearch['industryMarket'];
            break;
          case 'competitors':
            results.competitors =
              output.data as PreviousResearch['competitors'];
            break;
          case 'icpValidation':
            results.icpValidation =
              output.data as PreviousResearch['icpValidation'];
            break;
          case 'offerAnalysis':
            results.offerAnalysis =
              output.data as PreviousResearch['offerAnalysis'];
            break;
        }
      }
    }
  }

  return results;
}

// Re-export for consumers
export { SECTION_LABELS };
```

**Step 2: Verify the file compiles**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main && npx tsc --noEmit src/lib/ai/tools/run-research.ts 2>&1 | head -20`

Expected: No errors (or only pre-existing ones unrelated to this file).

**Step 3: Commit**

```bash
git add src/lib/ai/tools/run-research.ts
git commit -m "feat: add runResearch tool factory with message-history caching

Progressive research tool that fires research sections during
conversation. Uses factory pattern with closure for cross-request
state via message history extraction.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 2: Update the system prompt

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts:63-138`

**Step 1: Remove the "cannot generate" restriction from Scope section**

In `lead-agent-system.ts`, find line ~136:
```
You are having an onboarding conversation. You can use the askUser tool to present structured questions with option chips. You cannot generate reports, strategy documents, or deliverables yet — that comes after onboarding is complete. Do not reference research pipelines, background analysis, or output formats. Stay focused on understanding their business through conversation.
```

Replace the Scope section (lines 136-138) with:
```
You are running a strategy onboarding session. You can use askUser to present structured questions and runResearch to fire live market research. Stay focused on understanding their business and progressively building their strategic picture.
```

**Step 2: Add Progressive Research section after the Completion Flow section**

After the "Completion Flow" section (after line ~133), add:

```typescript
## Progressive Research

You have a tool called \`runResearch\` that executes real market research using Perplexity and Claude. As soon as you have enough context for a section, run it — don't wait for all fields to be collected.

### Trigger Thresholds
- After collecting businessModel + industry → run industryMarket
- After industryMarket completes AND you have industry + productDescription → run competitors
- After industryMarket completes AND you have icpDescription → run icpValidation
- After industryMarket completes AND you have productDescription + offerPricing → run offerAnalysis
- After all 4 sections complete → run crossAnalysis

### Rules
- Run research BETWEEN questions — call runResearch, then immediately ask the next question in the same response
- Only run each section ONCE — check what you've already run before calling again
- Reference research findings in follow-up questions when they're relevant (e.g., "Our market research found X — does that match your experience?")
- If a section fails, tell the user briefly and continue onboarding — don't retry automatically
- The crossAnalysis section ties everything together — only run it when all 4 prior sections have completed successfully
```

**Step 3: Update the Completion Flow**

Change the completion flow section (around line ~128-133) to:

```
### Completion Flow

When all 8 required fields have been collected AND all 5 research sections have completed:
1. Present a brief summary weaving together what you learned from conversation AND research findings (2–3 paragraphs)
2. Call askUser with fieldName "confirmation", options: "Looks good, let's go" / "I want to change something"
3. If "Looks good" → acknowledge and present the strategic blueprint summary
4. If "Change something" → ask which field, re-collect with askUser, re-run affected research if needed, then present updated summary

If all 8 fields are collected but some research is still missing, run the remaining sections before the confirmation flow.
```

**Step 4: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "feat: add progressive research instructions to lead agent prompt

Agent now fires runResearch between questions instead of waiting
for batch generation. Updated scope and completion flow.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 3: Wire the tool into the streaming route

**Files:**
- Modify: `src/app/api/journey/stream/route.ts:1-114`

**Step 1: Add imports**

At the top of `route.ts`, after the existing imports (line ~14), add:

```typescript
import {
  createRunResearchTool,
  extractResearchResults,
} from '@/lib/ai/tools/run-research';
```

**Step 2: Extract previous research and create tool**

After the `systemPrompt` construction (after line ~89), before the `streamText` call, add:

```typescript
  // ── Extract previous research from message history ──────────────────────
  const previousResearch = extractResearchResults(
    sanitizedMessages as Array<{ role: string; parts: Array<{ type: string; [key: string]: unknown }> }>,
  );
  const runResearch = createRunResearchTool({ previousResearch });
```

**Step 3: Add runResearch to tools and bump step count**

Change the `streamText` call (line ~92-111):

```typescript
  const result = streamText({
    model: anthropic(MODELS.CLAUDE_OPUS),
    system: systemPrompt,
    messages: await convertToModelMessages(sanitizedMessages),
    tools: { askUser, runResearch },
    stopWhen: stepCountIs(20),
    temperature: 0.3,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 10000 },
      },
    },
    onFinish: async ({ usage, steps }) => {
      console.log('[journey] stream finished', {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        steps: steps.length,
      });
    },
  });
```

Changes: `tools: { askUser, runResearch }` (was `{ askUser }`), `stepCountIs(20)` (was `15`).

**Step 4: Commit**

```bash
git add src/app/api/journey/stream/route.ts
git commit -m "feat: wire runResearch tool into journey stream route

Extract previous research from message history each request,
create tool with closure, bump max steps to 20.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 4: Create the ResearchInlineCard component

**Files:**
- Create: `src/components/journey/research-inline-card.tsx`

**Step 1: Create the component with all three states**

```typescript
// src/components/journey/research-inline-card.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Globe,
  Users,
  Target,
  Package,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Section metadata ────────────────────────────────────────────────────────

const SECTION_META: Record<
  string,
  { label: string; icon: typeof Globe; color: string }
> = {
  industryMarket: {
    label: 'Industry & Market Research',
    icon: Globe,
    color: 'var(--accent-blue)',
  },
  competitors: {
    label: 'Competitor Analysis',
    icon: Users,
    color: 'var(--accent-purple, #a855f7)',
  },
  icpValidation: {
    label: 'ICP Validation',
    icon: Target,
    color: 'var(--accent-cyan, #06b6d4)',
  },
  offerAnalysis: {
    label: 'Offer Analysis',
    icon: Package,
    color: 'var(--accent-green, #22c55e)',
  },
  crossAnalysis: {
    label: 'Strategic Synthesis',
    icon: Layers,
    color: '#f59e0b',
  },
};

// ── Finding extraction ──────────────────────────────────────────────────────

function extractTopFindings(
  section: string,
  data: Record<string, unknown>,
): string[] {
  try {
    switch (section) {
      case 'industryMarket': {
        const findings: string[] = [];
        const snap = data.categorySnapshot as Record<string, unknown> | undefined;
        if (snap?.category) findings.push(`Category: ${snap.category}`);
        if (snap?.marketMaturity) findings.push(`Market maturity: ${snap.marketMaturity}`);
        const pains = data.painPoints as Record<string, unknown> | undefined;
        const primary = (pains?.primary as string[]) ?? [];
        if (primary.length > 0) findings.push(`Top pain: ${primary[0]}`);
        if (primary.length > 1) findings.push(`${primary[1]}`);
        return findings.slice(0, 4);
      }

      case 'competitors': {
        const findings: string[] = [];
        const comps = (data.competitors as Array<Record<string, unknown>>) ?? [];
        findings.push(`${comps.length} competitor${comps.length !== 1 ? 's' : ''} analyzed`);
        for (const c of comps.slice(0, 2)) {
          if (c.name) findings.push(`${c.name}: ${(c.positioning as string)?.slice(0, 60) ?? 'analyzed'}`);
        }
        const gaps = (data.whiteSpaceGaps as Array<Record<string, unknown>>) ?? [];
        if (gaps.length > 0) {
          findings.push(`${gaps.length} market gap${gaps.length !== 1 ? 's' : ''} identified`);
        }
        return findings.slice(0, 4);
      }

      case 'icpValidation': {
        const findings: string[] = [];
        const verdict = data.finalVerdict as Record<string, unknown> | undefined;
        if (verdict?.status) {
          findings.push(`Verdict: ${(verdict.status as string).toUpperCase()}`);
        }
        const fit = data.painSolutionFit as Record<string, unknown> | undefined;
        if (fit?.primaryPain) findings.push(`Primary pain: ${fit.primaryPain}`);
        if (fit?.fitAssessment) findings.push(`Fit: ${fit.fitAssessment}`);
        const risks = (data.riskScores as Array<Record<string, unknown>>) ?? [];
        const highRisks = risks.filter(
          (r) => ((r.probability as number) ?? 0) * ((r.impact as number) ?? 0) > 12,
        );
        if (highRisks.length > 0) {
          findings.push(`${highRisks.length} high-risk factor${highRisks.length !== 1 ? 's' : ''}`);
        }
        return findings.slice(0, 4);
      }

      case 'offerAnalysis': {
        const findings: string[] = [];
        const strength = data.offerStrength as Record<string, unknown> | undefined;
        if (strength?.overallScore) findings.push(`Offer score: ${strength.overallScore}/10`);
        const rec = data.recommendation as Record<string, unknown> | undefined;
        if (rec?.status) findings.push(`Recommendation: ${rec.status}`);
        const flags = (data.redFlags as string[]) ?? [];
        if (flags.length > 0) {
          findings.push(`${flags.length} red flag${flags.length !== 1 ? 's' : ''}: ${flags[0]}`);
        } else {
          findings.push('No red flags detected');
        }
        return findings.slice(0, 4);
      }

      case 'crossAnalysis': {
        const findings: string[] = [];
        const insights = (data.keyInsights as Array<Record<string, unknown>>) ?? [];
        for (const insight of insights.slice(0, 3)) {
          if (insight.insight) findings.push((insight.insight as string).slice(0, 80));
        }
        const platforms = (data.recommendedPlatforms as Array<Record<string, unknown>>) ?? [];
        if (platforms.length > 0) {
          const names = platforms.map((p) => p.platform).join(', ');
          findings.push(`Platforms: ${names}`);
        }
        return findings.slice(0, 4);
      }

      default:
        return ['Research complete'];
    }
  } catch {
    return ['Research complete'];
  }
}

// ── Component ───────────────────────────────────────────────────────────────

interface ResearchInlineCardProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  data?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  sourceCount?: number;
  className?: string;
}

export function ResearchInlineCard({
  section,
  status,
  data,
  error,
  durationMs,
  sourceCount,
  className,
}: ResearchInlineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = SECTION_META[section] ?? {
    label: section,
    icon: Globe,
    color: 'var(--text-tertiary)',
  };
  const Icon = meta.icon;
  const findings = status === 'complete' && data ? extractTopFindings(section, data) : [];
  const durationStr = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : '';

  // ── Loading state ───────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn('flex items-center gap-2.5 my-2', className)}
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-md, 10px)',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-md"
          style={{
            width: 24,
            height: 24,
            background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 style={{ width: 13, height: 13, color: meta.color }} />
          </motion.div>
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="font-medium leading-tight truncate"
            style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
          >
            Researching {meta.label.toLowerCase()}...
          </p>
          <p
            className="truncate mt-0.5"
            style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
          >
            This may take 15–60 seconds
          </p>
        </div>

        <motion.span
          className="flex-shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: meta.color }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn('flex items-center gap-2.5 my-2', className)}
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-md, 10px)',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
        }}
      >
        <XCircle style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <p
            className="font-medium leading-tight"
            style={{ fontSize: '12px', color: '#ef4444' }}
          >
            {meta.label} — Failed
          </p>
          {error && (
            <p
              className="truncate mt-0.5"
              style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
            >
              {error}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Complete state ──────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('my-2', className)}
      style={{
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-surface, var(--bg-hover))',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2.5 cursor-pointer"
        style={{ padding: '10px 14px' }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-md"
          style={{
            width: 24,
            height: 24,
            background: 'rgba(34, 197, 94, 0.12)',
          }}
        >
          <CheckCircle2 style={{ width: 14, height: 14, color: '#22c55e' }} />
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p
              className="font-medium leading-tight truncate"
              style={{ fontSize: '12px', color: 'var(--text-primary)' }}
            >
              {meta.label}
            </p>
            <Icon style={{ width: 12, height: 12, color: meta.color, flexShrink: 0 }} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {durationStr && (
            <span style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}>
              {durationStr}
            </span>
          )}
          {expanded ? (
            <ChevronUp style={{ width: 14, height: 14, color: 'var(--text-tertiary)' }} />
          ) : (
            <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-tertiary)' }} />
          )}
        </div>
      </button>

      {/* Findings (expandable) */}
      <AnimatePresence>
        {expanded && findings.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0 14px 10px 14px',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
              }}
            >
              <ul className="space-y-1">
                {findings.map((finding, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5"
                    style={{
                      fontSize: '12px',
                      lineHeight: '1.5',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span
                      className="flex-shrink-0 mt-1.5 rounded-full"
                      style={{
                        width: 4,
                        height: 4,
                        background: meta.color,
                      }}
                    />
                    {finding}
                  </li>
                ))}
              </ul>
              {sourceCount != null && sourceCount > 0 && (
                <p
                  className="mt-2"
                  style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}
                >
                  {sourceCount} source{sourceCount !== 1 ? 's' : ''} cited
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/journey/research-inline-card.tsx
git commit -m "feat: add ResearchInlineCard with loading/complete/error states

Three-state inline card for progressive research results in the
journey chat. Expandable findings with section-specific extraction.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 5: Integrate ResearchInlineCard into chat-message.tsx

**Files:**
- Modify: `src/components/journey/chat-message.tsx:1-14` (imports) and `src/components/journey/chat-message.tsx:273-359` (renderToolPart function)

**Step 1: Add import**

After line 12 (`import { AskUserCard } ...`), add:

```typescript
import { ResearchInlineCard } from '@/components/journey/research-inline-card';
```

**Step 2: Add runResearch case in renderToolPart**

In the `renderToolPart` function (line ~273), after the `askUser` block (after line ~359, before the generic loading states at line ~362), add a new block:

```typescript
  // runResearch tool — render inline research card
  if (toolName === 'runResearch') {
    const researchInput = input as { section?: string } | undefined;
    const sectionName = researchInput?.section ?? 'unknown';

    if (state === 'output-available') {
      let parsedOutput: Record<string, unknown> | undefined;
      if (typeof part.output === 'string') {
        try { parsedOutput = JSON.parse(part.output); } catch { parsedOutput = undefined; }
      } else {
        parsedOutput = output;
      }

      if (parsedOutput?.status === 'error') {
        return (
          <ResearchInlineCard
            key={key}
            section={sectionName}
            status="error"
            error={parsedOutput.error as string}
          />
        );
      }

      return (
        <ResearchInlineCard
          key={key}
          section={sectionName}
          status="complete"
          data={parsedOutput?.data as Record<string, unknown>}
          durationMs={parsedOutput?.durationMs as number}
          sourceCount={(parsedOutput?.sources as unknown[])?.length}
        />
      );
    }

    if (state === 'output-error') {
      return (
        <ResearchInlineCard
          key={key}
          section={sectionName}
          status="error"
          error={(part.errorText as string) || 'Research failed'}
        />
      );
    }

    // input-streaming, input-available → loading
    return (
      <ResearchInlineCard
        key={key}
        section={sectionName}
        status="loading"
      />
    );
  }
```

**Step 3: Commit**

```bash
git add src/components/journey/chat-message.tsx
git commit -m "feat: render runResearch tool results as inline cards

Route runResearch tool parts to ResearchInlineCard with proper
state mapping: loading/complete/error.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 6: Add runResearch to ToolLoadingIndicator config

**Files:**
- Modify: `src/components/chat/tool-loading-indicator.tsx:26-111`

**Step 1: Add runResearch entry to TOOL_CONFIG**

After the existing entries in the `TOOL_CONFIG` object (around line ~111), add:

```typescript
  runResearch: {
    label: 'Running research...',
    description: 'Executing market research with Perplexity',
    icon: Search,
    color: 'var(--accent-blue)',
  },
```

**Step 2: Add context extraction for runResearch**

In the `getArgContext` function (line ~121-136), add a case:

```typescript
  if (toolName === 'runResearch' && typeof args.section === 'string') {
    const sectionLabels: Record<string, string> = {
      industryMarket: 'Industry & Market',
      competitors: 'Competitors',
      icpValidation: 'ICP Validation',
      offerAnalysis: 'Offer Analysis',
      crossAnalysis: 'Cross-Analysis',
    };
    return sectionLabels[args.section] ?? args.section;
  }
```

**Step 3: Commit**

```bash
git add src/components/chat/tool-loading-indicator.tsx
git commit -m "feat: add runResearch config to ToolLoadingIndicator

Shows section-specific label when research tool is executing.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 7: Build verification

**Step 1: Run TypeScript check**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20`

Expected: No new errors from our files. Pre-existing errors in test files are OK.

**Step 2: Run lint**

Run: `npm run lint 2>&1 | tail -20`

Expected: No new lint errors.

**Step 3: Run build**

Run: `npm run build 2>&1 | tail -30`

Expected: Build succeeds. Check for any import resolution issues.

**Step 4: Manual smoke test**

Run: `npm run dev`

1. Open http://localhost:3000/journey
2. Start a conversation
3. Answer business model + industry questions
4. Verify the agent calls `runResearch` for industryMarket
5. Verify a ResearchInlineCard appears in the chat (loading → complete)
6. Verify the agent references research findings in follow-up questions
7. Continue through all 8 fields and verify all research sections fire progressively

---

### Summary: File Change Map

| # | File | Action | Task |
|---|------|--------|------|
| 1 | `src/lib/ai/tools/run-research.ts` | CREATE | Task 1 |
| 2 | `src/lib/ai/prompts/lead-agent-system.ts` | MODIFY | Task 2 |
| 3 | `src/app/api/journey/stream/route.ts` | MODIFY | Task 3 |
| 4 | `src/components/journey/research-inline-card.tsx` | CREATE | Task 4 |
| 5 | `src/components/journey/chat-message.tsx` | MODIFY | Task 5 |
| 6 | `src/components/chat/tool-loading-indicator.tsx` | MODIFY | Task 6 |

**Unchanged:** `research.ts`, `generator.ts`, `schemas.ts`, `providers.ts`, `types.ts`
