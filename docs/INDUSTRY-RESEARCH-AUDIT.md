# Industry Research Skill — Audit & Fix Plan

## 1. Architecture Overview (What I Found)

### The Pipeline
```
Onboarding → generateResearch tool → generateSection(industryResearch) → SKILL.md + Perplexity
```

**Files involved:**
| File | Role |
|------|------|
| `src/lib/ai/skills/industry-research/SKILL.md` | The skill — instructions for the Sonnet worker |
| `src/lib/ai/sections/runner.ts` | Agentic loop — calls Anthropic beta API with skill + tools |
| `src/lib/ai/sections/tools.ts` | Tool implementations — Perplexity, Firecrawl, etc. |
| `src/lib/ai/sections/configs.ts` | Section config (model, tools, dependencies, trigger fields) |
| `src/lib/ai/skills/manager.ts` | Uploads skill to Anthropic Skills API |
| `src/lib/ai/tools/generate-research.ts` | Bridges lead agent → section runner |

### What Gets Passed to the Worker
The `buildSectionBrief()` function in `runner.ts` builds a brief from `SectionContext`:
- companyName, websiteUrl, businessModel, productDescription, primaryIcpDescription
- topCompetitors (optional), monthlyAdBudget (optional)

**Problem #1: The brief passes GENERIC field names.** The worker gets "Business Model: B2B SaaS" — but NOT the client's specific niche/category, pricing tiers, or market positioning. The skill then searches for "[industry] market size" which resolves to the broad parent industry.

### How Perplexity Gets Called
`searchMarketData()` in `tools.ts` sends to Perplexity sonar-pro with:
```
system: "You are a market research analyst. Return specific data points with sources. 
         Focus on: [focus]"
user: [query from skill]
```

**Problem #2: The Perplexity system prompt is generic.** It doesn't know the client's niche. It returns whatever Perplexity thinks is relevant for the broad query.

### How the Skill Instructs Search
The SKILL.md tells the agent to search with template queries like:
```
Step 1: "[industry] market size revenue growth rate 2024 2025 forecast"
Step 2: "[product type] customer pain points complaints reviews G2 Reddit forums"
```

**Problem #3: `[industry]` and `[product type]` are NEVER defined.** The skill uses placeholder labels that the agent must infer from the brief. With "Business Model: B2B SaaS" and "Product: AI call handling for restaurants", the agent may search for "B2B SaaS market size" ($390B) instead of "AI call handling for restaurants market size" (~$800M-1.5B).

---

## 2. Root Cause Analysis

### Failure Mode 1: Wrong Market Scope
**Root cause: SEARCH QUERY PROBLEM + BRIEF PROBLEM**
- The brief doesn't explicitly state the client's **specific addressable category**
- The skill uses `[industry]` placeholder without defining how to derive it from the brief
- No instruction to narrow searches or reject parent-industry data
- No sanity check comparing cited market size against client's SAM

**Fix:** 
1. Add `specificCategory` field to `SectionContext` and `buildSectionBrief()`
2. Skill must define a "category narrowing" step BEFORE any searches
3. Add explicit instruction: "If market size is >50x what makes sense for [specificCategory], you're citing the parent industry — search narrower"

### Failure Mode 2: Generic Pain Points
**Root cause: SEARCH QUERY PROBLEM**
- Skill tells agent to search "[product type] customer pain points" — too broad
- No instruction to search for the CLIENT'S BUYERS specifically
- No quality criteria for what makes a pain point "specific enough"

**Fix:**
1. Search queries must include the ICP description, not just product type
2. Add examples of good vs bad pain points directly in the skill
3. Require each pain point to include: scenario, quantified impact, strategic action

### Failure Mode 3: Disconnected Psychological Drivers
**Root cause: SYNTHESIS PROBLEM**
- Skill says "Derive from Step 7 tool results" but gives no quality criteria
- No instruction to connect drivers to ad messaging
- No examples of good vs bad driver descriptions

**Fix:**
1. Add explicit format: `[Emotion]: [Visceral description]. → Campaign angle: [specific messaging]`
2. Show 2 examples of good vs bad
3. Ban academic/textbook language explicitly

### Failure Mode 4: Irrelevant Macro Risks
**Root cause: RELEVANCE FILTERING PROBLEM**
- Skill search query: "[industry] regulatory risks market downturn consolidation threats"
- No filter for relevance to the CLIENT'S BUYING CONTEXT
- Agent pulls cybersecurity/AI Act because those are common results for "SaaS risks"

**Fix:**
1. Change search query template to include the buyer context
2. Add explicit relevance test: "Would this risk cause [ICP] to delay buying [product]? If no, exclude."
3. Add anti-patterns list in the skill

### Failure Mode 5: Weak Buying Behavior
**Root cause: SEARCH QUERY PROBLEM + VARIABILITY**
- Skill searches for generic "[ICP description] buying behavior" — results vary wildly per Perplexity run
- No instruction to search for category-specific buying patterns
- No fallback when search returns thin data

**Fix:**
1. Multi-query strategy: search exact category first, then adjacent if thin
2. Require at least 2 category-specific triggers (not generic B2B)
3. Add fallback instruction: "If category-specific data unavailable, use adjacent category and label it as proxy"

### Failure Mode 6: Run-to-Run Variability  
**Root cause: STRUCTURAL PROBLEM**
- No quality gates or minimum thresholds
- Skill has no "self-check" step before outputting
- Perplexity returns different results each time, and the skill doesn't compensate

**Fix:**
1. Add a final "quality verification" step in the skill
2. Add minimum data thresholds ("If fewer than 3 sourced data points for market sizing, state insufficient data")
3. Add the "narrowing search" pattern: start specific, widen only if needed

---

## 3. The Fixes (3 Files)

### Fix 1: `src/lib/ai/sections/configs.ts`
Add `specificCategory` to `triggerFields` for industryResearch so the onboarding must collect it before research fires.

### Fix 2: `src/lib/ai/sections/runner.ts` → `buildSectionBrief()`
Add `specificCategory` and `pricingTiers` to SectionContext. Include them in the brief so the worker knows the EXACT niche.

### Fix 3: `src/lib/ai/skills/industry-research/SKILL.md` 
Complete rewrite. The new skill must:

**A) Define category narrowing FIRST**
Before any searches, the agent must:
1. Extract the specific addressable category from the brief (not parent industry)
2. Define 3-5 search terms that describe THIS niche specifically
3. Use these terms in ALL subsequent searches

**B) Use multi-step search with narrowing**
For each research area:
1. Search with the SPECIFIC category first
2. If results are thin (<3 relevant data points), widen to adjacent category
3. If still thin, state "Insufficient data" — NEVER fall back to parent industry for market sizing

**C) Add inline quality gates**
After each section, require self-check:
- "Is every data point from a tool result?"
- "Is market sizing scoped to the specific category?"
- "Does each pain point include a strategic action?"

**D) Add good/bad examples**
For pain points, psychological drivers, and macro risks — show what good looks like vs bad.

**E) Add anti-patterns list**
Explicit list of things to NEVER do (cite parent industry, use academic language, include irrelevant risks).

### Fix 4: `src/lib/ai/sections/tools.ts` → `searchMarketData()`
Enhance the Perplexity system prompt to include the client's category context so Perplexity returns more targeted results.

---

## 4. Implementation Plan

### Step 1: Update SectionContext interface
Add `specificCategory` and `pricingRange` fields to `SectionContext` in `runner.ts`.

### Step 2: Update buildSectionBrief()
Include the new fields in the research brief with labels:
```
**Specific Category:** AI call handling for restaurants
**Pricing Range:** $195-$1,495/mo
```

### Step 3: Update generate-research.ts
Pass `specificCategory` and `pricingRange` from onboarding state to `SectionContext`.

### Step 4: Update searchMarketData() system prompt
Change from generic "market research analyst" to include category context:
```
"You are a market research analyst researching the [specificCategory] market specifically. 
Return data about THIS specific niche, not the parent industry."
```

### Step 5: Rewrite SKILL.md
Full rewrite with all fixes above. This is the biggest change.

### Step 6: Clear skill cache
The uploaded skill is cached in-memory and on Anthropic's side. Need to clear cache and re-upload.

### Step 7: Test with AgentSupply
Run the full pipeline and verify:
- Market size cites "AI call handling for restaurants" (~$500M-2B), not "B2B SaaS" ($390B)
- Pain points specific to restaurant owners losing revenue from missed calls
- Macro risks about restaurant industry factors, not generic SaaS security

---
