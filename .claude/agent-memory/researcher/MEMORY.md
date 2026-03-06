# Researcher Agent Memory

## Task #1: Perplexity & SearchAPI Audit — COMPLETE

### Perplexity Usage Summary

**Files using Perplexity:**
1. `src/lib/ai/tools/perplexity-search.ts` — The core betaZodTool wrapper
2. `src/lib/ai/tools/research/research-industry.ts` — uses perplexitySearch
3. `src/lib/ai/tools/research/research-competitors.ts` — uses perplexitySearch + adLibrary + spyFu + pageSpeed
4. `src/lib/ai/tools/research/research-icp.ts` — uses perplexitySearch
5. `src/lib/ai/tools/research/research-offer.ts` — uses perplexitySearch + firecrawl
6. `src/lib/ai/tools/research/synthesize-research.ts` — uses chartTool only (no Perplexity)
7. `src/lib/ai/providers.ts` — Creates perplexity provider instance + MODELS constants
8. Legacy files (should be archived): `src/lib/ai/research.ts`, `src/lib/ai/chat-tools/deep-research.ts`, `src/lib/company-intel/research-service.ts`

**perplexitySearch Tool Specification:**
- **File**: `src/lib/ai/tools/perplexity-search.ts`
- **Type**: betaZodTool (Anthropic SDK beta)
- **Inputs**: `{ query: string, context?: string }`
- **Outputs**: `{ results: string, sources: { url: string, title: string }[] }`
- **Model**: perplexity('sonar-pro')
- **Config**: maxOutputTokens: 4000, temperature: 0.3
- **Current timeout**: 40 seconds (AbortSignal)

### SearchAPI Status

**CRITICAL FINDING**: SearchAPI is set as REQUIRED but ONLY used in one place:

1. **Configured as Required** (env.ts:9): `SEARCHAPI_KEY` in REQUIRED_ENV_VARS.server
2. **Used by**: AdLibraryService (src/lib/ad-library/service.ts:94)
3. **Purpose**: Fetch competitor ads from LinkedIn, Meta, Google via SearchAPI.io
4. **Base URL**: `https://www.searchapi.io/api/v1/search`
5. **Access**: `new AdLibraryService()` constructor calls `getRequiredEnv('SEARCHAPI_KEY')`

**Integration Path:**
- SearchAPI only accessed via AdLibraryService
- AdLibraryService wrapped as betaZodTool: `adLibraryTool` in `src/lib/ai/tools/mcp/`
- adLibraryTool used in research-competitors.ts sub-agent

**NOT used anywhere else**: No standalone SearchAPI calls or web search tool currently exists.

### Recommendation for Task #3

Since SearchAPI is already configured and integrated via AdLibraryService + betaZodTool wrapper:
- SearchAPI provides ad library access (competitor creative intelligence)
- Perplexity provides web search (market research, pricing, pain points)
- **Complementary, not replacement**: Both serve different purposes
- If building a webSearch tool, should consider adding SearchAPI as a web-search fallback OR keep Perplexity-only

---

## Task #2: Research Tool Hanging - REVISED (Timeout Infrastructure Actually IN PLACE)

### Investigation Findings — Code Review Complete

**MAJOR DISCOVERY**: The three timeout mechanisms I identified as missing are ACTUALLY ALREADY IMPLEMENTED in the codebase. Re-checking all files revealed they were added after my initial memory was created.

#### ✅ VERIFIED: AbortSignal Timeout on perplexitySearch
**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/lib/ai/tools/perplexity-search.ts` (lines 20-33)

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 40_000); // 40s hard limit
try {
  response = await generateText({
    model: perplexity(MODELS.SONAR_PRO),
    prompt,
    maxOutputTokens: 4000,
    temperature: 0.3,
    abortSignal: controller.signal,  // ← WIRED CORRECTLY
  });
} finally {
  clearTimeout(timeout);  // ← PROPER CLEANUP
}
```
**Status**: ✅ CORRECT — 40s timeout with proper signal passing and cleanup.

#### ✅ VERIFIED: Promise.race() Timeout on All 6 Research Sub-Agents
**Files affected** (all use 120s timeout):
1. `research-industry.ts` (lines 106-111)
2. `research-competitors.ts` (lines 129-134)
3. `research-icp.ts` (same pattern)
4. `research-offer.ts` (lines 123-128)
5. `synthesize-research.ts` (same pattern)
6. `research-keywords.ts` (lines 87-92)

```typescript
const finalMsg = await Promise.race([
  runner.runUntilDone(),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Research sub-agent timed out after 120s')), 120_000)
  ),
]);
```
**Status**: ✅ CORRECT — All 6 tools have 120s timeout wrapper.

#### ✅ VERIFIED: No Temperature Parameter on Lead Agent
**File**: `/Users/ammar/Dev-Projects/AI-GOS-main/src/app/api/journey/stream/route.ts` (lines 107-134)
- NO temperature parameter in streamText() call
- Only has `thinking: { type: 'enabled', budgetTokens: 10000 }` in providerOptions
**Status**: ✅ CORRECT — Vercel AI SDK handles this properly. No conflict.

### REVISED CONCLUSION

The timeout infrastructure is **NOT the cause** of 2.6+ minute hangs. All mechanisms are in place:
- ✅ perplexitySearch: 40s client timeout
- ✅ Sub-agents: 120s Promise.race() timeout
- ✅ Lead agent: No invalid parameter conflicts

**The actual hang must originate from**:
1. **Perplexity API response time** — 40s timeout on client side doesn't catch Perplexity hanging at its API servers
2. **Sub-agent tool loop retry behavior** — If tools fail partway through, they may retry and exceed 120s before timeout fires
3. **Some other blocking operation** not in the timeout-protected paths

**Next investigation**: Check Perplexity response times + whether sub-agent tool failures cause retry loops.

---

## Task #3: SearchAPI + Claude Architecture Design — COMPLETE

### SearchAPI.io Integration Analysis

**SearchAPI.io URL Construction:**
- **Base**: `https://www.searchapi.io/api/v1/search`
- **Engines Available**: `google`, `linkedin_ad_library`, `meta_ad_library`, `google_advertiser`
- **URL Parameters** (URLSearchParams):
  - `engine`: search engine type (e.g., 'google' for web search)
  - `q`: search query (for google engine)
  - `api_key`: authentication token from SEARCHAPI_KEY env var
- **Response Format**:
  ```json
  {
    "search_results": [ { "title": string, "link": string, "snippet": string }, ... ],
    "search_information": { "total_results": number },
    "error": string | undefined
  }
  ```

**Timeout Approach:**
- AdLibraryService uses 30s timeout (line 32)
- SearchAPI is HTTP-based (no model inference), so 15s is safe
- Use AbortController + setTimeout pattern (proven working in ad-library + perplexity-search)

### webSearch Tool Design

**File to Create**: `src/lib/ai/tools/web-search.ts`

**Zod Schema**:
```typescript
inputSchema: z.object({
  query: z.string().describe('The search query'),
  context: z.string().optional().describe('Optional context to refine search')
})
```

**Output Format**:
```typescript
{
  results: string,  // Formatted snippets (title + snippet for each result)
  sources: [{ url: string, title: string }, ...]
}
```

**Implementation Strategy**:
1. Construct SearchAPI URL with `engine: 'google'`, `q: query`, `api_key: SEARCHAPI_KEY`
2. Fetch with AbortSignal (15s timeout) and proper error handling
3. Parse response.search_results array
4. Format as markdown snippets for Claude to synthesize
5. Return { results: string, sources: array }
6. **NO Claude model call in the tool** — sub-agent synthesizes raw results

### Migration Plan

**Sub-agents to update** (4 files):
1. `research-industry.ts` — replace `[perplexitySearch]` with `[webSearch]`
2. `research-competitors.ts` — replace first tool in array with `webSearch` (keep others)
3. `research-icp.ts` — replace `[perplexitySearch]` with `[webSearch]`
4. `research-offer.ts` — replace `[perplexitySearch]` with `webSearch` (keep firecrawl)

**System prompts**: Minimal changes — all existing research instructions remain valid (they call the search tool, which now returns different format but same contract)

**Files NOT affected**:
- `src/lib/ai/tools/perplexity-search.ts` — keep as-is (can be used elsewhere if needed)
- `src/lib/ai/tools/mcp/*.ts` — no changes (ad-library, firecrawl, etc. remain)
- Provider config — no changes (Perplexity still defined but unused in research)

### Key Differences: SearchAPI vs Perplexity

| Aspect | Perplexity (current) | SearchAPI (new) |
|--------|---|---|
| **Speed** | 40s timeout (model inference) | 15s timeout (HTTP call) |
| **Output format** | Prose synthesis (Claude-generated) | Raw snippets (human-written snippets from Google SERPs) |
| **Cost** | Higher (model inference per query) | Lower (HTTP API call) |
| **Reliability** | Subject to model delays | Faster, more predictable |
| **Sub-agent synthesis** | Receives Claude prose | Receives raw snippets, synthesizes itself |

### Gotchas & Edge Cases

1. **Google SERP structure**: SearchAPI.io parses Google results with standard fields (`title`, `link`, `snippet`). Format is stable.
2. **Rate limiting**: SearchAPI allows 100 requests/month on free tier — but we have SEARCHAPI_KEY for paid access. No expected rate limit issues.
3. **Empty results**: If no results found, `search_results` will be empty array. Return empty sources list + message to sub-agent.
4. **API errors**: SearchAPI returns `{ error: string }` — handle and propagate to sub-agent.
5. **URL validation**: Ensure returned URLs are valid before including in sources (use existing pattern from ad-library)

### Build Impact

- No new dependencies required (SearchAPI is REST API, native fetch available)
- No env var changes (SEARCHAPI_KEY already required)
- 120s sub-agent timeout remains unchanged (webSearch is faster, won't hit timeout)
- Build time: no impact (single new file, minimal changes to 4 existing research tools)

---

## Task #4: Anthropic Native web_search Tool — COMPLETE

### Native web_search_20250305 Tool Found

**DISCOVERY**: Anthropic has a NATIVE web search tool in both:
1. **Anthropic SDK** (`@anthropic-ai/sdk`) — raw protocol-level tool
2. **Vercel AI SDK** (`@ai-sdk/anthropic`) — wrapped as `webSearch_20250305`

### Tool Specifications

#### Anthropic SDK Native Tool (Direct API)
**File**: `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts`

```typescript
interface BetaWebSearchTool20250305 {
  name: 'web_search';                              // ← Tool is called 'web_search'
  type: 'web_search_20250305';                     // ← Version type in API
  allowed_domains?: Array<string> | null;          // Optional domain whitelist
  blocked_domains?: Array<string> | null;          // Optional domain blacklist
  allowed_callers?: Array<'direct' | ...>;         // Who can call this tool
  defer_loading?: boolean;                         // Lazy-load tool from search results
  cache_control?: BetaCacheControlEphemeral;       // Prompt caching control
  max_uses?: number;                               // Max calls per request
}
```

**Input Schema** (what Claude sends when calling the tool):
```typescript
{
  query: string;
}
```

**Output Schema** (what Anthropic API returns):
```typescript
Array<{
  type: 'web_search_result';
  url: string;
  title: string | null;
  pageAge: string | null;
  encryptedContent: string;  // ← For citations + multi-turn
}>
```

#### Vercel AI SDK Wrapper
**File**: `node_modules/@ai-sdk/anthropic/src/tool/web-search_20250305.ts`

- **Export**: `webSearch_20250305(args?: {...})`
- **ID**: `anthropic.web_search_20250305`
- **Supported in**: `streamText()`, `generateText()`, `generateObject()` (any Vercel AI function)
- **Constructor Args** (optional):
  ```typescript
  {
    maxUses?: number;              // Max uses in conversation
    allowedDomains?: string[];     // Domain whitelist
    blockedDomains?: string[];     // Domain blacklist
    userLocation?: {               // Geolocation for search
      type: 'approximate';
      city?: string;
      region?: string;
      country?: string;
      timezone?: string;
    };
  }
  ```

### Key Differences: Native vs betaZodTool (SearchAPI)

| Aspect | Native `web_search_20250305` | Custom `webSearch` (SearchAPI) |
|--------|---|---|
| **Who handles the tool?** | Anthropic servers execute it | Your code executes it (runs HTTP fetch) |
| **API call** | Claude calls API, Anthropic does search | Claude calls your backend, you call SearchAPI |
| **Encrypted content** | Returns `encryptedContent` for citations | Returns raw snippet text |
| **Speed** | Depends on Anthropic infra (likely 2-5s) | Depends on SearchAPI (3-5s + your fetch) |
| **Citations** | Built-in `encryptedContent` for multi-turn | You format snippets as markdown |
| **Cost** | No additional charge (Anthropic infrastructure) | SearchAPI charges per request |
| **Geolocation** | Built-in `userLocation` support | Not supported |
| **Setup** | Just add to tools array | betaZodTool wrapper required |
| **Error handling** | Anthropic handles API errors | You handle fetch errors |

### How to Use Native web_search_20250305

**With Vercel AI SDK** (lead agent):
```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { webSearch_20250305 } from '@ai-sdk/anthropic';

await streamText({
  model: anthropic('claude-opus-4-6'),
  tools: [
    webSearch_20250305({
      maxUses: 10,
      allowedDomains: ['example.com', 'google.com'],
    }),
  ],
  messages,
});
```

**With Anthropic SDK directly** (sub-agents):
```typescript
const response = await client.beta.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 2048,
  tools: [
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 10,
    },
  ],
  messages,
});
```

### Current Implementation Status

- **webSearch.ts exists**: Uses `betaZodTool(webSearch)` wrapping SearchAPI.io HTTP calls
- **Not using native tool**: The codebase never imports `webSearch_20250305`
- **Why custom wrapper?**: Likely to control which search engine (Google vs LinkedIn vs Meta ad libs) and avoid relying on Anthropic infrastructure

### Recommendation: Native vs Custom

**Use Native `web_search_20250305` if**:
- You want Anthropic to handle search infrastructure (no extra API key needed)
- You want built-in citation support (`encryptedContent` for multi-turn)
- You don't need control over search engine selection
- **COST**: No additional charge (vs SearchAPI per-request pricing)

**Keep Custom `webSearch` (SearchAPI) if**:
- You need to use specific search engines (LinkedIn ads, Meta ads)
- You want control over domain filtering + search parameters
- SearchAPI pricing is acceptable
- You want fallback if Anthropic's search is unavailable

### Investigation Complete

The native tool exists, is production-ready, and could replace the custom SearchAPI wrapper entirely. However, the custom wrapper gives more control for enterprise features (ad library search, domain filtering). **No code changes needed unless strategy shifts to use native tool.**
