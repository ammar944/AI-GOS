# Claude Code Prompt: Fix Industry Research Skill

Read `docs/INDUSTRY-RESEARCH-AUDIT.md` first for the full root cause analysis. Then implement these changes across 4 files. Do NOT modify any API routes.

## Changes

### 1. `src/lib/ai/sections/runner.ts` — Update SectionContext + buildSectionBrief

Add two new optional fields to the `SectionContext` interface:

```typescript
export interface SectionContext {
  companyName: string;
  websiteUrl: string;
  businessModel: string;
  productDescription: string;
  primaryIcpDescription: string;
  topCompetitors?: string[];
  monthlyAdBudget?: string;
  previousSections?: Record<string, string>;
  // NEW
  specificCategory?: string;   // e.g. "AI call handling for restaurants"
  pricingRange?: string;       // e.g. "$195-$1,495/mo"
}
```

Update `buildSectionBrief()` to include these in the brief PROMINENTLY — before the generic fields:

```typescript
// In buildSectionBrief(), after the opening "# Research Brief" line:
if (context.specificCategory) {
  brief += `\n## CRITICAL: Specific Market Category\n`;
  brief += `**This client's specific addressable category is: ${context.specificCategory}**\n`;
  brief += `All market sizing, pain points, and buying behavior MUST be scoped to this specific category — NOT the parent industry.\n`;
  if (context.pricingRange) {
    brief += `**Pricing range:** ${context.pricingRange}\n`;
  }
  brief += `\n`;
}
```

### 2. `src/lib/ai/tools/generate-research.ts` — Pass new fields

Find where `sectionContext` is built (around line 227) and add:

```typescript
const sectionContext: SectionContext = {
  companyName: context.companyName,
  websiteUrl: context.websiteUrl,
  businessModel: context.businessModel,
  productDescription: context.productDescription,
  primaryIcpDescription: context.primaryIcpDescription,
  topCompetitors: context.topCompetitors,
  monthlyAdBudget: context.monthlyAdBudget,
  previousSections: context.previousSections,
  // NEW — derive from onboarding fields
  specificCategory: context.specificCategory || context.productDescription,
  pricingRange: context.pricingRange,
};
```

Also update the `GenerateResearchContext` interface (or whatever type `context` is) to include `specificCategory` and `pricingRange`. Grep for where this context is assembled from onboarding state — it likely pulls from `extractConfirmedJourneyFields()` or the lead agent's collected fields. Add `specificCategory` and `pricingRange` to that extraction.

If `specificCategory` isn't collected during onboarding yet, fall back to `productDescription` for now. We can add it to onboarding later.

### 3. `src/lib/ai/sections/tools.ts` — Enhance Perplexity system prompt

Replace the `searchMarketData()` Perplexity system message. Currently it says:
```
"You are a market research analyst. Return specific data points with sources. Focus on: " + (focus || "general market data")
```

Change to:
```typescript
async function searchMarketData(
  query: string,
  focus?: string,
  categoryHint?: string,  // NEW parameter
): Promise<{ content: string; citations: Array<{ url: string; title?: string }> }> {
  // ... existing API key check ...

  const systemPrompt = categoryHint
    ? `You are a market research analyst specializing in the "${categoryHint}" market specifically. Return data about THIS specific niche — not the parent industry or broad market. Include specific numbers, percentages, and source citations. Focus on: ${focus || "general market data"}. If you cannot find data specific to "${categoryHint}", say so explicitly rather than citing broader industry data.`
    : `You are a market research analyst. Return specific data points with sources. Include numbers, percentages, and citations. Focus on: ${focus || "general market data"}`;

  // ... rest unchanged, just use systemPrompt in the messages array ...
}
```

Then update `executeToolCall()` to pass the category hint through. This requires either:
- Adding a module-level variable that gets set before tool execution (simplest)
- Or adding `categoryHint` to the tool input schema so the agent can pass it

**Recommended approach — module-level context:**
```typescript
// At the top of tools.ts
let _currentCategoryHint: string | undefined;

export function setToolContext(categoryHint?: string) {
  _currentCategoryHint = categoryHint;
}

// In executeToolCall, for search_market_data:
case "search_market_data": {
  const result = await searchMarketData(
    toolInput.query as string,
    toolInput.focus as string | undefined,
    _currentCategoryHint,  // pass it through
  );
  return { content: result.content + TOOL_REMINDER, citations: result.citations };
}
```

Then in `runner.ts`, call `setToolContext(context.specificCategory)` before the agentic loop starts.

### 4. `src/lib/ai/skills/industry-research/SKILL.md` — Full rewrite

Replace the entire contents with:

```markdown
---
name: industry-research
description: "Generate Industry & Market Research section for a client's specific market category. Use when the research brief includes a specific addressable category, product description, and ICP. Focuses on the client's exact niche — never the parent industry."
---

# Industry & Market Research

You are a market research analyst generating the Industry & Market Research section for a client's Strategic Blueprint. You have access to `search_market_data` for web research and `scrape_website` for specific URLs.

## CRITICAL RULE: Category Scoping

Before running ANY search, identify the client's **specific addressable category** from the research brief. This is NOT the parent industry.

Examples:
- ✅ Correct: "AI call handling for restaurants" → search for THIS market
- ❌ Wrong: "B2B SaaS" or "restaurant technology" → these are parent industries, NOT the client's market
- ✅ Correct: "API monitoring for engineering teams" → search for THIS market  
- ❌ Wrong: "DevOps tools" or "cloud infrastructure" → too broad

If the brief includes a "Specific Market Category" field, use it verbatim. Otherwise, derive it from the product description + ICP. Write down your identified category before proceeding.

## Research Process

### Step 0: Define Search Terms
Before any tool calls, define:
1. **Exact category**: The client's specific addressable market (from the brief)
2. **Adjacent categories**: 2-3 related niches to use as fallback if exact data is thin
3. **ICP-specific terms**: Job titles, industries, and pain language of the client's actual buyers

Use these terms in ALL subsequent searches. Never default to the parent industry.

### Step 1: Market Size & Growth
Run TWO searches:

**Search A (narrow):**
`search_market_data` with query: "[exact category] market size revenue 2024 2025 forecast TAM"

**Search B (validation):**
`search_market_data` with query: "[exact category] number of companies providers competitors pricing"

Cross-reference both results:
- If Search A returns a market size, check it against the client's pricing × estimated addressable businesses
- If the cited market size is >50x what makes sense for the client's niche, you have parent-industry data — discard it
- If no direct market data exists for the exact category, do a bottom-up estimate: [number of potential customers] × [average annual contract value] = SAM estimate. State this is an estimate and show your math.

**NEVER cite the total B2B SaaS market ($390B+), restaurant technology ($27B+), or any other parent-industry figure as the client's addressable market.**

### Step 2: Customer Pain Points
`search_market_data` with query: "[ICP job title] [exact category] pain points frustrations complaints reviews G2 Reddit"

For each pain point found:
- **Scenario**: A specific situation the buyer experiences (not abstract)
- **Impact**: Quantified where possible ("losing $200-400 per missed booking")
- **Strategic action**: How to leverage in campaigns ("target with ads emphasizing automated recovery")

Quality check — reject pain points that:
- Could apply to ANY B2B buyer (e.g., "wants better ROI") — too generic
- Don't mention the buyer's actual daily reality
- Have no connection to campaign strategy

#### Good vs Bad Pain Points

**GOOD** (specific, quantified, actionable):
"Fine dining owners lose $200-400 per missed high-ticket reservation when phones go to voicemail during peak hours. Front-of-house staff can't answer calls while managing floor service. → Target with peak-season ads: 'Never miss a $300 table again.'"

**BAD** (generic, academic, disconnected):
"Business owners experience challenges with customer communication and operational efficiency, leading to potential revenue loss."

### Step 3: Buying Behavior & Triggers
`search_market_data` with query: "how do [ICP job title] buy [exact category] solutions decision process sales cycle"

If results are thin, search adjacent: "how do [ICP job title] evaluate [adjacent category] software purchasing"

Requirements:
- At least 2 buying triggers SPECIFIC to this category (not generic "new funding round" or "new CTO")
- Sales cycle length specific to this price range and buyer type
- If using adjacent-category data, label it: "Based on adjacent category data ([category name])"

### Step 4: Trend Signals
`search_market_data` with query: "[exact category] trends 2024 2025 emerging declining disruption"

For each trend (3-5):
- **What**: Specific trend description
- **Direction**: Rising, declining, or stable
- **Evidence**: Specific data point WITH source
- **Strategic implication**: How this affects the client's paid media strategy

### Step 5: Seasonality
`search_market_data` with query: "[ICP industry] seasonal demand patterns budget cycles peak trough monthly"

Build a 12-month intensity map (1-10). Each month must include:
- Intensity score
- Why this month is high/low (specific to the ICP's industry, not generic)
- Strategic recommendation for ad spend timing

### Step 6: Macro Risks
`search_market_data` with query: "[ICP industry] market risks economic factors 2024 2025 affecting buying decisions"

**Relevance test for EVERY risk**: "Would this risk cause [ICP] to delay or cancel purchasing [client's product]?"
- YES → include it
- NO → exclude it, no matter how interesting

Examples of RELEVANT risks for "AI call handling for restaurants":
- Restaurant industry labor shortages (drives demand UP)
- Economic downturn reducing dining out (reduces restaurant revenue → tighter budgets)
- AI tools becoming commoditized (price pressure on the client)

Examples of IRRELEVANT risks (DO NOT INCLUDE):
- Generic SaaS cybersecurity concerns
- EU AI Act compliance (unless the client's product is directly affected)
- Cryptocurrency volatility
- Global supply chain disruption (unless directly affecting the ICP's industry)

### Step 7: Psychological Drivers & Objections
`search_market_data` with query: "[ICP job title] buying [exact category] fears objections hesitations why not buy reviews forums"

**For psychological drivers** — use visceral, emotional language that could appear in ad copy:

**GOOD**: "Fear of losing high-value customers to competitors who pick up the phone: Owners see 5-star reviews mentioning 'they always answer' for rival restaurants and feel a gut-punch of lost revenue. → Campaign angle: 'Your competitor answers on the first ring. Do you?'"

**BAD**: "Fear of Technology Obsolescence: Buyers worry about investing in solutions that may become outdated, creating resistance to adoption."

**For objections** — find real objections from reviews, forums, Reddit, G2. Each must include:
- The exact objection (in buyer's language, not academic phrasing)
- Recommended rebuttal with proof point
- Source where the objection was found

### Step 8: Channel & Media Benchmarks
`search_market_data` with query: "[exact category] advertising benchmarks CPL CPC conversion rates best channels paid media"

If exact category data unavailable, search: "[adjacent category] SaaS advertising benchmarks by platform 2024 2025"

Label proxy data clearly.

## Output Format

Structure your response with these exact headers. Start DIRECTLY with content — no preamble.

### Market Overview
- **Specific addressable market**: [exact category name and size with source]
- **Growth rate**: [percentage with source]
- **Market maturity**: early / growing / saturated
- **Awareness level**: low / medium / high
- **Buying behavior type**: impulsive / committee_driven / roi_based / mixed
- **Key market drivers**: [3-5 specific drivers]
- **SAM validation**: [brief cross-reference of market size against pricing × addressable customers]

### Pain Points & Frustrations
For each (3-5 primary):
- **Scenario**: [Specific situation the buyer faces]
- **Impact**: [Quantified where possible]
- **Strategic action**: [How to leverage in campaigns]
- **Source**: [Which search returned this]

### Buying Behavior & Triggers
- **Decision process**: [How buyers in THIS category evaluate and buy]
- **Category-specific triggers**: [At least 2 triggers unique to this niche]
- **Sales cycle**: [Length and dynamics for this price range]
- **Decision influencers**: [Who is involved]
- **Barriers**: [What stops purchases]

### Psychological Drivers
For each (3-5):
- **[Emotion]**: [Visceral description in buyer's voice]. → Campaign angle: [specific messaging approach]
- **Source**: [Which search returned this]

### Audience Objections & Rebuttals
For each (3-5):
- **Objection**: "[In buyer's own words]"
- **Rebuttal**: [Proof point or counter-argument]
- **Source**: [Forum, review site, or survey where found]

### Trend Signals
For each (3-5):
- **Trend**: [What's happening]
- **Direction**: rising / declining / stable
- **Evidence**: [Specific data point with source]
- **Strategic implication**: [What this means for paid media]

### Seasonality Calendar
| Month | Intensity (1-10) | Notes | Ad Strategy |
|-------|-------------------|-------|-------------|
| January | [X] | [Why] | [Recommendation] |
| ... | | | |

### Macro Risks
For each risk:
- **Risk**: [Description]
- **Relevance**: [Why this would affect THIS client's prospects' buying behavior]
- **Severity**: low / medium / high

### Strategic Implications for Paid Media
- **Best channels**: [Based on buying behavior data, with benchmark citations]
- **Timing**: [Based on seasonality data]
- **Budget allocation**: [Based on CPL/CPC benchmarks if available]
- **Messaging angles**: [Derived from pain points + psychological drivers]

## Quality Verification (Run Before Outputting)

Before writing your final output, verify:
1. ☐ Market size is for [exact category], not parent industry
2. ☐ Every statistic has a source citation
3. ☐ Every pain point includes scenario + impact + strategic action
4. ☐ Every psychological driver uses visceral language + campaign angle
5. ☐ Every macro risk passes the "would this delay buying THIS product?" test
6. ☐ At least 2 buying triggers are specific to this category
7. ☐ No data from training knowledge — all from tool results
8. ☐ Any insufficient data areas explicitly say "Insufficient data from available sources"

## Anti-Patterns (NEVER Do These)
- Cite total B2B SaaS market ($390B+) as a client's addressable market
- List pain points without strategic implications
- Include macro risks about generic SaaS security or AI regulation (unless directly relevant)
- Use academic language in psychological drivers ("Technology Obsolescence concerns" → NO)
- Present buying behavior from a different buyer persona as the client's audience
- Fill gaps with training data when search results are thin — say "Insufficient data" instead
- Write preamble like "I'll now research..." or "Let me search for..." — just call tools and write the report
```

### 5. Verification

After all changes:

```bash
npx tsc --noEmit
```

Then grep to verify the chain is connected:
```bash
grep "specificCategory" src/lib/ai/sections/runner.ts
grep "specificCategory" src/lib/ai/tools/generate-research.ts
grep "setToolContext\|_currentCategoryHint" src/lib/ai/sections/tools.ts
grep "categoryHint" src/lib/ai/sections/tools.ts
```

Verify the skill file was updated:
```bash
head -5 src/lib/ai/skills/industry-research/SKILL.md
wc -l src/lib/ai/skills/industry-research/SKILL.md
```

### 6. Clear Skill Cache

The skill is cached in-memory AND on Anthropic's servers. After updating SKILL.md:

1. Add a call to `clearSkillCache()` (exported from `src/lib/ai/skills/manager.ts`) — either in a test script or by restarting the dev server
2. The manager will re-upload the new skill on next run

### 7. Commit

```bash
git add -A
git commit -m "fix: rewrite industry research skill to fix market scoping, pain point quality, and run-to-run variability

Root causes:
- Search queries used parent-industry terms instead of client's specific category
- No relevance filtering for macro risks
- No quality gates for pain points or psychological drivers
- Perplexity system prompt had no category context
- Brief didn't include specific category or pricing info

Changes:
- SKILL.md: Full rewrite with category narrowing, quality gates, good/bad examples, anti-patterns
- runner.ts: Added specificCategory + pricingRange to SectionContext and brief
- tools.ts: Enhanced Perplexity system prompt with category hint, added setToolContext()
- generate-research.ts: Pass specificCategory and pricingRange to section context

Fixes: wrong market scope, generic pain points, disconnected psych drivers, irrelevant macro risks, weak buying behavior, run-to-run variability"
```
