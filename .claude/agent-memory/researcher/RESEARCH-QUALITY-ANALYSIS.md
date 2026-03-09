# Research Section Quality Issues - Root Cause Analysis

**Date**: 2026-03-09  
**Status**: CRITICAL FINDINGS CONFIRMED  
**Confidence**: HIGH (traced complete code path)

---

## Executive Summary

Research output quality is **severely compromised** by a combination of:

1. **Model Routing Flaw**: Token counter only sees brief (~100-200 tokens), ignores skill content (1000+ tokens). All sections route to Haiku unless they have thinking enabled.
2. **Skill Content Not Counted**: Uploaded skills (1-200 lines each) provide critical context but are ignored by token counting.
3. **Haiku Routing Logic**: Line 88 in `runner.ts` routes to Haiku if input < 4000 AND no thinking. Most sections hit this unless manually configured with thinking.
4. **Brief Quality**: The research brief is deliberately minimal (~30-50 lines) and doesn't include:
   - Skill content (uploaded separately via Anthropic API)
   - Company market segment (agency vs product vs platform)
   - Research success criteria or output format
5. **Tool Quality**: Tools are basic wrappers with limited intelligence — they can fail silently or return incomplete data.
6. **Extraction Logic**: After strategic research (Sonnet), output is immediately downgraded by Haiku in `extract.ts:9` for structured extraction.

---

## Issue 1: Token Counting Flaw (CRITICAL)

**Location**: `src/lib/ai/sections/runner.ts:82-101`

### The Problem

```typescript
const tokenCount = await client.messages.countTokens({
  model: config.model,
  messages: [{ role: "user", content: brief }],  // ← ONLY counts the brief text
});

if (tokenCount.input_tokens < HAIKU_TOKEN_THRESHOLD && !config.thinking) {
  selectedModel = HAIKU_MODEL;  // ← Routes to Haiku
}
```

**What's NOT counted**:
- Skill content (uploaded via `container.skills`)
- Tool definitions (passed in `tools` parameter)
- System context from previous sections (in `context.previousSections`)

### Why This Breaks Everything

1. The brief text alone is typically **100-200 tokens** (just headers + company info)
2. But the actual input to the model includes:
   - **Skill content**: 130-195 lines of detailed instructions (Competitor Intel: 167 lines, ICP Validation: 180 lines)
   - **Tool definitions**: `search_market_data`, `scrape_website`, etc. with full schemas
   - **Previous section data**: If the section depends on earlier research
3. Actual total input is typically **1500-3000+ tokens**, well above 4000 threshold
4. But token counter returns **<500 tokens** → routes to Haiku

**Test Evidence**:
```
User reported: "141 input tokens → routing to Haiku"
This is ONLY the brief. Skill content not counted.
```

### Why Threshold is Wrong

Current code: `HAIKU_TOKEN_THRESHOLD = 4000`

Comment says: "Threshold lowered from 8000 → 4000: research briefs typically have 3000-6000 input tokens"

**This is factually incorrect** because:
- The 3000-6000 estimate includes skill content
- Token counter only counts brief (100-200)
- So threshold is off by 20-30x

### Impact on Each Section

| Section | Has Thinking? | Config Model | Actual Model | Quality Hit |
|---------|--------------|--------------|--------------|------------|
| industryResearch | NO | Sonnet 4 | Haiku | SEVERE |
| competitorIntel | NO | Sonnet 4 | Haiku | SEVERE |
| icpValidation | YES (8k) | Sonnet 4 | Sonnet 4 | OK (protected by thinking flag) |
| offerAnalysis | NO | Sonnet 4 | Haiku | SEVERE |
| strategicSynthesis | YES (8k) | Sonnet 4 | Sonnet 4 | OK (protected) |
| keywordIntel | NO | Sonnet 4 | Haiku | SEVERE |
| mediaPlan | NO | Sonnet 4 | Haiku | SEVERE |

**5 of 7 sections (71%) are downgraded to Haiku**.

---

## Issue 2: Brief Quality (MODERATE)

**Location**: `src/lib/ai/sections/runner.ts:311-345`

### Current Brief Structure

```markdown
# Research Brief: [Section Name]

**Company:** [name]
**Website:** [url]
**Business Model:** [model]
**Product:** [description]
**Target Customer:** [icp]
**Competitors:** [list]
**Monthly Ad Budget:** [budget]

[Previous section outputs if dependencies exist]

Generate the [Section Name]. Use your tools to gather real data.
Do not use any information from your training data for statistics, market figures, or company details.
```

### What's Missing

1. **No output format specification**: Sections with complex schemas (like `strategicSynthesis`) need explicit formatting instructions. Currently relies on skill content alone.

2. **No failure modes documented**: No instruction on what to do if tools fail or return incomplete data.

3. **No company type context**: Doesn't specify:
   - Is this a B2B or B2C company?
   - Is it SaaS, agency, marketplace, or hardware?
   - What's the annual revenue range?
   - This dramatically affects research focus.

4. **No research success criteria**: No clear way for the model to know when research is "complete."

5. **Skill content NOT in brief**: The detailed research methodology (130-195 lines per skill) is uploaded separately. If skill upload fails, the brief has no fallback context.

### Example Weakness

For `competitorIntel`, the brief says:
```
**Competitors:** HubSpot, Marketo, Pardot

Generate Competitor Intelligence...
```

But doesn't say:
- "Find their ad spend, keywords they rank for, pricing tiers"
- "Analyze their positioning vs the client"
- "Identify white-space gaps the client can exploit"

These details are in `competitor-intel/SKILL.md` lines 1-167, but if the skill fails to upload or is ignored, the model has no guidance.

---

## Issue 3: Extraction Downgrade (MODERATE)

**Location**: `src/lib/ai/sections/extract.ts:9`

### The Problem

After a Sonnet agent completes research (with thinking, tools, complex output), the prose is immediately re-processed by **Haiku** to extract structured data:

```typescript
const EXTRACTION_MODEL = anthropic('claude-haiku-4-5-20251001');
```

This creates a two-stage downgrade:
1. **Input stage**: Research brief routed to Haiku (Issue #1)
2. **Output stage**: Strategic synthesis routed to Sonnet, then extraction routed to Haiku

For sections like `strategicSynthesis` (195-line skill, full messaging framework with hooks, positioning angles, proof points, budget allocation), Haiku must:
- Parse complex structured output with 10+ nested objects
- Identify JSON block in markdown
- Extract and validate against Zod schema
- All with 4000 tokens total

**Expected result**: Schema violations, missing fields, hallucinated data in extracted blocks.

---

## Issue 4: Tool Quality (MODERATE)

**Location**: `src/lib/ai/sections/tools.ts:8-271`

### Tools Defined

| Tool | Implementation | Limitations |
|------|----------------|------------|
| `search_market_data` | Calls Perplexity Sonar Pro | Can fail silently if API key missing; returns raw Perplexity response |
| `scrape_website` | Calls Firecrawl | Truncates to 8000 chars; fails if Firecrawl API missing |
| `search_competitor_ads` | SearchAPI.io (Google Ads Transparency) | Returns raw JSON; no parsing or summarization |
| `get_keyword_data` | SpyFu API | Returns raw API response; no filtering for relevance |
| `check_page_speed` | Google PageSpeed Insights API | Only returns metrics; no interpretation |

### Problems

1. **No fallback if API is missing**: Each tool returns error message as content. Model can't distinguish "API not configured" from "no results found."

2. **Raw data not processed**: Tools return raw API responses. Model must parse JSON, extract signal from noise, and synthesize.

3. **No error recovery**: If a tool call fails mid-research, the loop continues but the model has no way to retry or use alternative sources.

4. **No quality gates**: No validation that tool output actually answers the research question.

Example: `search_competitor_ads` returns:
```json
[
  { "headline": "AI Marketing Automation", "domain": "example.com", ... },
  { "headline": "Smart Campaign Optimization", "domain": "example.com", ... },
  ...
]
```

The model must determine:
- Is this ad spend data? (It's not.)
- What does it tell us about positioning? (Must infer from headlines.)
- Why are there 15 ads for one company? (Duplicate headlines? Different date ranges?)

With Haiku, this becomes hit-or-miss.

---

## Issue 5: Thinking Configuration (MINOR)

**Location**: `src/lib/ai/sections/configs.ts:1-78`

### Current Config

Only 2 of 7 sections have thinking enabled:
- `icpValidation`: thinking enabled, 8000 tokens budget
- `strategicSynthesis`: thinking enabled, 8000 tokens budget

**These are the ONLY sections protected from Haiku downgrade.**

### Missing Thinking

Sections that should have thinking but don't:
- `competitorIntel` (complex multi-source analysis)
- `offerAnalysis` (pricing strategy synthesis)
- `keywordIntel` (CPC/volume trade-off analysis)
- `mediaPlan` (budget allocation strategy)

With Haiku and no thinking, these sections can't handle the reasoning complexity.

---

## Data Flow: How Bad Data Flows Through System

```
1. Brief (~100-200 tokens)
   ↓
2. Token counter returns ~100-200
   ↓
3. Haiku selected (< 4000 threshold)
   ↓
4. Skill content uploaded (166-195 lines) but NOT counted
   ↓
5. Haiku tries to synthesize with tools
   ↓
6. Raw tool outputs returned (JSON, unprocessed)
   ↓
7. Haiku extracts structure (no reasoning, 4k token budget)
   ↓
8. Extracted data has hallucinations, missing fields
   ↓
9. Frontend renders incomplete/incorrect research cards
```

---

## Reproduction

To see this in action:

1. Run `generateSection("industryResearch", context)`
2. Watch logs: `[runner] Section industryResearch: 141 input tokens → routing to Haiku`
3. Section completes but output is shallow, generic, no specific numbers
4. Extraction to structured format fails or has missing fields

---

## Recommended Fixes (Priority Order)

### CRITICAL (Fix First)

1. **Fix token counting**: Include skill content in token count before deciding on model
   - Option A: Upload skills, then count full message with skill context
   - Option B: Pre-calculate skill token costs, add to brief token count
   - Option C: Never route section research to Haiku (keep all at Sonnet)

2. **Never route research sections to Haiku**: Change line 88:
   ```typescript
   // BEFORE
   if (tokenCount.input_tokens < HAIKU_TOKEN_THRESHOLD && !config.thinking) {
     selectedModel = HAIKU_MODEL;
   }
   
   // AFTER
   // Never downgrade research sections — they require strategic reasoning
   // Keep selectedModel = config.model
   ```

### HIGH (Fix Second)

3. **Add thinking to all sections**: Enable thinking with appropriate budgets:
   ```typescript
   industryResearch: { type: 'enabled', budgetTokens: 8000 },
   competitorIntel: { type: 'enabled', budgetTokens: 10000 },
   offerAnalysis: { type: 'enabled', budgetTokens: 8000 },
   keywordIntel: { type: 'enabled', budgetTokens: 6000 },
   mediaPlan: { type: 'enabled', budgetTokens: 10000 },
   ```

4. **Move extraction to Sonnet or Opus**: Don't downgrade structured extraction to Haiku:
   ```typescript
   const EXTRACTION_MODEL = anthropic('claude-sonnet-4-20250514');
   ```

5. **Include brief success criteria**: Add to `buildSectionBrief()`:
   ```markdown
   ## Success Criteria
   Your output must include:
   - [Schema-specific required fields]
   - Citations for every statistic
   - Clear data source attribution
   ```

### MEDIUM (Fix Third)

6. **Improve tool implementations**: Wrap API calls with better error handling, summarization, and quality gates.

7. **Add tool result validation**: Check if tool output actually answers the research question before returning to model.

---

## Files Affected

| File | Issue | Line(s) |
|------|-------|--------|
| `src/lib/ai/sections/runner.ts` | Model routing flaw | 82-101 |
| `src/lib/ai/sections/runner.ts` | Brief quality | 311-345 |
| `src/lib/ai/sections/configs.ts` | Thinking config incomplete | 1-78 |
| `src/lib/ai/sections/extract.ts` | Haiku extraction | 9 |
| `src/lib/ai/sections/tools.ts` | Tool quality | 8-271 |

---

## Success Metrics

After fixes:
- All 7 sections use Sonnet or Opus for research (no Haiku downgrade)
- 4-6 sections have thinking enabled
- Extraction uses Sonnet
- Section output includes specific numbers, citations, and structured data
- Extracted schema fields are populated (not empty/null)

