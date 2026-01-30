# Requirements: AI-GOS v2.2

**Defined:** 2026-01-30
**Core Value:** Accurate competitor pricing extraction from actual pricing pages with confidence scoring

## v2.2 Requirements

Requirements for Pricing Intelligence milestone. Each maps to roadmap phases.

### Scraping

- [x] **SCRP-01**: Firecrawl service scrapes pricing page URL with JavaScript rendering
- [x] **SCRP-02**: Scraping errors are handled gracefully with logging

### Extraction

- [x] **EXTR-01**: LLM extracts structured PricingTier[] from scraped content
- [x] **EXTR-02**: Extracted data is validated against Zod schema
- [x] **EXTR-03**: Confidence score calculated for extracted pricing data

### Integration

- [x] **INTG-01**: Firecrawl pricing replaces Perplexity pricing in Section 4 pipeline
- [x] **INTG-02**: Pipeline falls back to Perplexity if Firecrawl extraction fails

## Future Requirements (Deferred)

### Discovery

- **DISC-01**: Multi-URL pricing page discovery (not just /pricing)
- **DISC-02**: Sitemap parsing for pricing URLs
- **DISC-03**: Navigation link analysis for pricing pages
- **DISC-04**: LLM-assisted page classification

### Advanced Scraping

- **SCRP-03**: Parallel processing for multiple competitors
- **SCRP-04**: Screenshot capture for visual verification

### Advanced Extraction

- **EXTR-04**: Multi-signal confidence scoring
- **EXTR-05**: Field-level confidence breakdown
- **EXTR-06**: Source text attribution (anti-hallucination)

### Advanced Integration

- **INTG-03**: Dual-write migration with feature flag
- **INTG-04**: Credit usage tracking per blueprint

## Out of Scope

| Feature | Reason |
|---------|--------|
| Historical pricing tracking | Future milestone (v2.3+) |
| Price change alerts | Future milestone |
| Pricing trend visualization | Future milestone |
| Full site crawling | Scope creep, use known URLs |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCRP-01 | Phase 35 | ✅ Complete |
| SCRP-02 | Phase 35 | ✅ Complete |
| EXTR-01 | Phase 36 | ✅ Complete |
| EXTR-02 | Phase 36 | ✅ Complete |
| EXTR-03 | Phase 36 | ✅ Complete |
| INTG-01 | Phase 37 | ✅ Complete |
| INTG-02 | Phase 37 | ✅ Complete |

**Coverage:**
- v2.2 requirements: 7 total
- Mapped to phases: 7 (100%)
- Unmapped: 0

**Phase breakdown:**
- Phase 35 (Firecrawl Foundation): 2 requirements (SCRP-01, SCRP-02)
- Phase 36 (LLM Extraction & Confidence): 3 requirements (EXTR-01, EXTR-02, EXTR-03)
- Phase 37 (Pipeline Integration): 2 requirements (INTG-01, INTG-02)

---
*Requirements defined: 2026-01-30*
*Last updated: 2026-01-31 after roadmap creation (100% coverage achieved)*
