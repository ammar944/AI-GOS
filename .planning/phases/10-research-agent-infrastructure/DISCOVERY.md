# Phase 10 Discovery: Research Agent Infrastructure

**Discovery Level:** Level 2 (Standard Research)
**Date:** 2026-01-05
**Topics:** Perplexity citation format, OpenRouter citation pass-through, research agent abstraction

## Key Findings

### 1. Perplexity Citation Format (via OpenRouter)

**Current API Response Structure:**

Perplexity returns citations in two ways (changed May 2025):

1. **Legacy `citations` field** - Array of URLs (being deprecated)
```json
{
  "citations": [
    "https://example.com/source1",
    "https://example.com/source2"
  ]
}
```

2. **New `search_results` field** - Structured metadata (preferred)
```json
{
  "search_results": [
    {
      "title": "Source Title",
      "url": "https://example.com/article",
      "date": "2023-12-25"
    }
  ]
}
```

**Important:** After April 2025, `citation_tokens` and `num_search_queries` no longer appear in usage field for Sonar Pro and Sonar Reasoning Pro.

### 2. OpenRouter Pass-Through Behavior

- OpenRouter passes through Perplexity citations in the response object
- Access via `response.citations` or `response.search_results` depending on model
- Citations appear as top-level fields in the API response, NOT nested in `choices[0].message`
- For sonar-deep-research: both `citations` and `search_results` may be available

### 3. Citation Cost Structure

For Perplexity Deep Research:
- Input: $2.00/1M tokens
- Output: $8.00/1M tokens
- Citation tokens: Processed separately (billed at $2/1M)
- Additional: $5/1K searches

### 4. Implementation Pattern

Based on Open WebUI implementation:

```typescript
// Non-streaming response handling
const response = await client.chat(options);
const citations = response.citations ?? [];          // URL array
const searchResults = response.search_results ?? []; // Structured results

// Citation structure for storage
interface Citation {
  url: string;
  title?: string;
  date?: string;
  snippet?: string;
}
```

## Recommendations

### Citation Extraction Pattern

```typescript
interface CitationResult {
  citations: Citation[];
  totalCitationTokens?: number;
}

function extractCitations(response: OpenRouterResponse): CitationResult {
  // Prefer search_results (structured) over citations (URLs only)
  if (response.search_results?.length) {
    return {
      citations: response.search_results.map(sr => ({
        url: sr.url,
        title: sr.title,
        date: sr.date,
      })),
    };
  }

  // Fallback to citations array (URLs only)
  if (response.citations?.length) {
    return {
      citations: response.citations.map(url => ({ url })),
    };
  }

  return { citations: [] };
}
```

### Research Agent Abstraction

Create a `ResearchAgent` abstraction that:
1. Wraps OpenRouter client for research-specific calls
2. Handles citation extraction from any supported model
3. Tracks research-specific costs (citations + searches)
4. Supports multi-step research pipelines

## Source URLs

- https://docs.perplexity.ai/getting-started/models/models/sonar-deep-research
- https://openrouter.ai/perplexity/sonar-deep-research
- https://docs.perplexity.ai/changelog/changelog
- https://github.com/Mintplex-Labs/anything-llm/issues/3581
- https://openwebui.com/f/yazon/perplexity_sonar_api_with_citations

## Impact on Phase 10

1. **Need to extend OpenRouter client** - Add `citations` and `search_results` to response type
2. **Create Citation type** - Unified structure for storing/displaying citations
3. **Research agent should handle both formats** - Support legacy `citations` array and new `search_results`
4. **Cost tracking enhancement** - Track citation token costs separately for accurate billing

---
*Discovery completed: 2026-01-05*
