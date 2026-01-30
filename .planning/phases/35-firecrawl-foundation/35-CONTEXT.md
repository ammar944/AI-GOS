# Phase 35: Firecrawl Foundation - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Firecrawl service scrapes competitor pricing pages with JavaScript rendering and graceful error handling. Returns clean markdown for LLM extraction in Phase 36. Scraping failures allow pipeline to continue with Perplexity fallback.

</domain>

<decisions>
## Implementation Decisions

### URL Discovery Strategy
- Hardcoded paths only — no crawling or dynamic discovery
- Fallback order: `/pricing` → `/plans` → `/buy`
- Stop at first successful response (200 OK with content)
- If all paths fail (404/403/timeout): return null, log warning
- No caching of working paths — always try fresh each run

### Claude's Discretion
- Exact timeout values per scrape request
- Rate limiting between competitors (if needed)
- Output markdown cleaning/formatting
- Error log verbosity and format
- Whether to include page metadata in response

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing AI-GOS error handling patterns (graceful degradation like ad library integration).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-firecrawl-foundation*
*Context gathered: 2026-01-31*
