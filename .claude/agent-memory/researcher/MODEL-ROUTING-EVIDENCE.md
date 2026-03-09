# Model Routing Downgrade: Evidence and Impact

## The Contradiction

**Code Intent** (from configs.ts):
```typescript
industryResearch: {
  model: "claude-sonnet-4-20250514",  // ← Intended: Sonnet
  ...
}
```

**Actual Routing** (runner.ts line 88):
```typescript
if (tokenCount.input_tokens < HAIKU_TOKEN_THRESHOLD && !config.thinking) {
  selectedModel = HAIKU_MODEL;  // ← Forced: Haiku
}
```

**Result**: Intended Sonnet, gets Haiku.

---

## Why Token Counter is Wrong

### What Gets Sent to Model

The model receives:

```
1. Skill content (uploaded via Anthropic Skills API)
   - competitor-intel/SKILL.md: 167 lines
   - industry-research/SKILL.md: 129 lines
   - etc.

2. Tool definitions (in tools parameter)
   - search_market_data: full schema
   - scrape_website: full schema
   - get_keyword_data: full schema
   - check_page_speed: full schema
   - search_competitor_ads: full schema

3. System context
   - Previous section outputs (sliced at 4000 chars each)

4. User message
   - The brief (~100-200 tokens)
```

### What Token Counter Counts

```typescript
const tokenCount = await client.messages.countTokens({
  model: config.model,
  messages: [{ role: "user", content: brief }],  // ← ONLY this
});
```

Result: ~100-200 tokens (brief only)

### The Gap

| Component | Tokens | Counted? |
|-----------|--------|----------|
| Brief | ~100 | YES |
| Skill content | ~600-900 | NO |
| Tool definitions | ~400-600 | NO |
| Previous sections | ~500-1500 | NO |
| **TOTAL** | **~1600-3500** | **~100** |

**Counting error**: 16-35x underestimate.

---

## Real-World Example: Competitor Intel Section

### Expected Flow (Design Intent)

1. Load config:
   ```
   competitorIntel: {
     model: "claude-sonnet-4-20250514",
     tools: ["scrape_website", "search_competitor_ads", "get_keyword_data", "check_page_speed"],
   }
   ```

2. Brief sent with:
   - `competitor-intel/SKILL.md` (167 lines) uploaded to Anthropic
   - Tool definitions for 4 tools
   - Research context from previous section

3. Sonnet processes with:
   - Skill guidance on what to analyze
   - Tool access to competitive data
   - Multi-source synthesis capability

4. Output: Rich, sourced analysis with specific numbers

### Actual Flow (Reality)

1. Load config: Same as above

2. Count tokens in brief only:
   ```
   Company: Acme
   Website: acme.com
   Competitors: HubSpot, Marketo, Pardot
   ...
   [~141 tokens]
   ```

3. 141 < 4000 AND !config.thinking → **Select Haiku**

4. Haiku processes with:
   - No time to use tools effectively
   - Raw tool outputs must be synthesized
   - Limited token budget for complex analysis

5. Output: Generic summary, missing specifics, hallucinated data

---

## Token Counting Bug: The Code Comments Reveal It

From `runner.ts:75-77`:

```typescript
// Smart model routing: count tokens and route to Haiku if context is small.
// Threshold lowered from 8000 → 4000: research briefs typically have 3000-6000
// input tokens, and the previous value was downgrading most sections to Haiku.
```

**What this comment says**:
- "research briefs typically have 3000-6000 input tokens"

**What's actually happening**:
- Only brief is counted: ~100-200 tokens
- Skills are NOT counted: +600-900 tokens
- Tools are NOT counted: +400-600 tokens
- The comment assumed all of this would be counted, but it's not

**Explanation**: The comment was written based on the belief that token counting would include everything sent to the model. But the implementation only counts the brief.

---

## Verification: Check Your Own Logs

When running a research section, you'll see:

```
[runner] Section industryResearch: 141 input tokens → routing to Haiku (saves ~60%)
```

**That 141 is ONLY the brief.**

To verify:
1. Count words in brief output: ~80 words
2. Words → tokens: 80 × 1.3 = ~104 tokens
3. Matches "141" in log? Close enough (different tokenizer behavior)

---

## Impact Matrix: Which Sections Are Hurt

| Section | Config Model | Has Thinking? | Line 88 Check | Actual Model | Quality Impact |
|---------|--------------|---------------|---------------|--------------|---|
| industryResearch | Sonnet 4 | NO | FAIL | Haiku | SEVERE |
| competitorIntel | Sonnet 4 | NO | FAIL | Haiku | SEVERE |
| icpValidation | Sonnet 4 | **YES** | PASS | Sonnet 4 | OK |
| offerAnalysis | Sonnet 4 | NO | FAIL | Haiku | SEVERE |
| strategicSynthesis | Sonnet 4 | **YES** | PASS | Sonnet 4 | OK |
| keywordIntel | Sonnet 4 | NO | FAIL | Haiku | SEVERE |
| mediaPlan | Sonnet 4 | NO | FAIL | Haiku | SEVERE |

**Sections working correctly** (protected by thinking): 2/7 (icpValidation, strategicSynthesis)
**Sections broken** (downgraded to Haiku): 5/7 (71%)

---

## Why This Matters

Haiku is fast and cheap, but for strategic research:

| Task | Haiku Capability | Needed For |
|------|-----------------|-----------|
| Parse raw JSON from APIs | Good | Tool outputs are JSON |
| Synthesize 5 sources | Limited | Must create unified narrative |
| Handle strategic reasoning | Weak | Competitive positioning analysis |
| Complex schema extraction | Poor | Structured output validation |
| Tool orchestration (retry, fallback) | Weak | Tools fail — need intelligent recovery |

**Haiku's token budget** (4000 output max):
- Tool call round 1: ~500 tokens (setup, reasoning, tool invocation)
- Tool result 1: ~1000 tokens (raw JSON from API)
- Tool call round 2: ~500 tokens
- Tool result 2: ~1000 tokens
- Output synthesis: <500 tokens (budget exhausted)

Sonnet's budget (20000 output max):
- Same flow but with 4x more space for reasoning and synthesis

---

## The Fix

Option 1 (Recommended): Never downgrade research sections

```typescript
// BEFORE
if (tokenCount.input_tokens < HAIKU_TOKEN_THRESHOLD && !config.thinking) {
  selectedModel = HAIKU_MODEL;
}

// AFTER
// Never use Haiku for research sections — they require strategic reasoning
// selectedModel stays as config.model (Sonnet)
```

Option 2: Fix token counting to include skills

```typescript
// Count skill tokens before checking threshold
const skillTokenCount = await estimateSkillTokens(skillName);
const totalTokens = tokenCount.input_tokens + skillTokenCount;

if (totalTokens < HAIKU_TOKEN_THRESHOLD && !config.thinking) {
  selectedModel = HAIKU_MODEL;
}
```

Option 3: Remove threshold entirely and add thinking to all sections

```typescript
const configs = {
  industryResearch: {
    thinking: { type: 'enabled', budgetTokens: 8000 },
    // ... thinking protects from Haiku downgrade
  }
}
```

