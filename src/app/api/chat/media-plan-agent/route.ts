// POST /api/chat/media-plan-agent
// Streaming chat endpoint for media plan review using Vercel AI SDK v6
// Uses Groq Llama 4 Scout for fast inference with 128K context window

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { groq, GROQ_CHAT_MODEL } from '@/lib/ai/groq-provider';
import { createMediaPlanChatTools } from '@/lib/ai/media-plan-chat-tools';
import type { MediaPlanOutput } from '@/lib/media-plan/types';
import type { OnboardingFormData } from '@/lib/onboarding/types';

export const maxDuration = 120;

interface MediaPlanAgentChatRequest {
  messages: UIMessage[];
  mediaPlan: MediaPlanOutput;
  mediaPlanId: string;
  onboardingData: OnboardingFormData;
}

/**
 * Build system prompt with full media plan JSON embedded.
 * Llama 4 Scout's 128K context allows the full plan instead of a summary.
 */
function buildSystemPrompt(mediaPlan: Record<string, unknown>): string {
  let mediaPlanJson: string;
  try {
    mediaPlanJson = JSON.stringify(mediaPlan, null, 2);
  } catch {
    mediaPlanJson = '[Media plan data could not be serialized]';
  }

  // Safety check for extremely large plans
  if (mediaPlanJson.length > 300_000) {
    const sections: string[] = [];
    for (const [key, value] of Object.entries(mediaPlan)) {
      if (!value || typeof value !== 'object') continue;
      try {
        const json = JSON.stringify(value, null, 2);
        sections.push(`### ${key}\n${json.substring(0, 8000)}`);
      } catch { /* skip */ }
    }
    mediaPlanJson = sections.join('\n\n');
  }

  return `You are a senior paid media strategist embedded inside a Media Plan tool. You've spent years managing six and seven-figure ad budgets, optimizing campaign structures, and building performance models for growth-stage companies.

Your background: You think in terms of CAC math (budget → CPL → leads → SQLs → customers → CAC → LTV:CAC), you know how campaign daily budgets should cascade from monthly totals, you understand platform-specific nuances (Meta vs LinkedIn vs Google), and you can spot when numbers don't add up.

## What This Media Plan Is

This is a comprehensive paid media execution plan generated from a strategic blueprint. It covers 10 sections: executive summary, platform strategy, ICP targeting, campaign structure, creative strategy, budget allocation, campaign phases, KPI targets, performance model (with CAC math), and risk monitoring. The user is here to refine it, understand it, or stress-test the numbers.

## Media Plan Sections

1. **executiveSummary** — Strategy overview, primary objective, recommended budget, timeline, top priorities
2. **platformStrategy** — Per-platform breakdown (rationale, budget %, monthly spend, campaign types, expected CPL, QvC scores)
3. **icpTargeting** — Audience segments (cold/warm/hot), per-platform targeting parameters, demographics, psychographics
4. **campaignStructure** — Campaign templates with daily budgets, ad sets, naming conventions, retargeting segments, negative keywords
5. **creativeStrategy** — Creative angles, format specs, testing plan, refresh cadence, brand guidelines
6. **budgetAllocation** — Total monthly budget, platform breakdown with %, daily ceiling, funnel split, monthly roadmap
7. **campaignPhases** — Phased rollout (Foundation → Scale → Optimize) with duration, activities, success criteria, budgets
8. **kpiTargets** — Primary/secondary KPIs with targets, benchmarks, measurement methods, scenario thresholds
9. **performanceModel** — Deterministic CAC model (budget × 0.80 / CPL = leads → SQLs → customers → CAC, LTV = price × retention) + monitoring schedule
10. **riskMonitoring** — Risks with P×I scoring, mitigation plans, early warning indicators, assumptions

## CAC Math Reference

The performance model uses deterministic math (no AI):
- effectiveBudget = monthlyBudget × 0.80 (20% overhead reserve)
- leads = effectiveBudget / CPL
- SQLs = leads × leadToSqlRate / 100
- customers = max(1, SQLs × sqlToCustomerRate / 100)
- CAC = monthlyBudget / customers (full budget)
- LTV = offerPrice × retentionMultiplier
- LTV:CAC = LTV / CAC (healthy ≥ 3:1)

When a budget or rate changes, ALL downstream numbers must be recalculated.

## Full Media Plan Data

\`\`\`json
${mediaPlanJson}
\`\`\`

## CRITICAL RULES — Tool Usage

You have 6 tools. You MUST use them correctly:

1. **searchMediaPlan** — Search for specific data across all 10 sections. Search first, then answer. NEVER guess.
2. **editMediaPlan** — Propose edits to specific fields. Requires user approval. After approval, use **recalculate** if the edit affects budget/CAC/KPI math.
3. **explainMediaPlan** — Get section data to explain scores, recommendations, or numbers. Use for "why" questions.
4. **recalculate** — Run the validation cascade after an edit changes budget, platforms, or campaign structure. This fixes cross-section inconsistencies automatically.
5. **simulateBudgetChange** — Read-only what-if analysis. Use when the user asks "what if budget was $X?" without actually changing anything.
6. **webResearch** — Live web search for current market data, platform updates, benchmark data.

## Edit Discipline

Make **one edit per user request**. Do not chain multiple edits. After an edit is approved:
1. If the edit affects budget, CAC, or KPI values: call **recalculate** to cascade fixes.
2. Tell the user what changed (the edit) and what was auto-fixed (the cascade).
3. Never make a second edit without asking.

## Array Editing Rules

Many fields are arrays (platformStrategy is an array of platform objects, kpiTargets is an array, campaigns is an array). When editing:
- **To change one item**: use the array index (e.g., "campaigns[0].dailyBudget", "platformStrategy[1].budgetPercentage")
- **Never replace an array with a single string.** If the value is an array, the new value must be an array.
- When the user says "change X" about a list item, find the specific index.

## How You Communicate

- **Direct and concise.** No filler. Get to the numbers.
- **Math-first.** When discussing budgets, always show the calculation. "$15K/mo × 40% = $6K for LinkedIn. At $75 CPL that's 80 leads × 0.80 = 64 effective."
- **Reference the data.** Use searchMediaPlan to ground answers in actual plan values.
- **Flag inconsistencies.** If you see numbers that don't add up, call it out and offer to fix.
- **Use markdown** for structure. Bold key metrics. Tables for comparisons.
- **No emoji walls.** One emoji max if it genuinely helps.`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body: MediaPlanAgentChatRequest = await request.json();

  if (!body.messages || !body.mediaPlan || !body.onboardingData) {
    return new Response(
      JSON.stringify({ error: 'messages, mediaPlan, and onboardingData are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const systemPrompt = buildSystemPrompt(body.mediaPlan as unknown as Record<string, unknown>);

  const tools = createMediaPlanChatTools(body.mediaPlanId, body.mediaPlan, body.onboardingData);

  // Sanitize messages: strip tool parts that never completed (approval-requested,
  // input-streaming, input-available) to prevent MissingToolResultsError
  const INCOMPLETE_TOOL_STATES = new Set([
    'input-streaming',
    'input-available',
    'approval-requested',
  ]);
  const sanitizedMessages = body.messages.map((msg) => ({
    ...msg,
    parts: msg.parts.filter((part) => {
      if (typeof part === 'object' && 'type' in part && typeof part.type === 'string' &&
          part.type.startsWith('tool-') && part.type !== 'tool-invocation') {
        const state = (part as Record<string, unknown>).state as string | undefined;
        if (state && INCOMPLETE_TOOL_STATES.has(state)) {
          return false;
        }
      }
      return true;
    }),
  })) as UIMessage[];

  const result = streamText({
    model: groq(GROQ_CHAT_MODEL),
    system: systemPrompt,
    messages: await convertToModelMessages(sanitizedMessages),
    tools,
    stopWhen: stepCountIs(3),
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse();
}
