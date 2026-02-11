# SEO Audit Feature Spec

**Status:** Proposal
**Date:** February 10, 2025
**Author:** Engineering

---

## 1. Overview

An automated SEO audit that crawls a client's website, analyzes technical health, cross-references keyword gaps against competitors, and produces a scored report with prioritized recommendations.

Positioned as an **optional upsell** alongside the existing Strategic Blueprint. Can also function as a standalone **lead magnet** ("Free SEO Audit" → email capture → upsell to full blueprint).

---

## 2. User Flow

```
User enters website URL + 1-3 competitor URLs
         │
         ▼
   [Generate Audit]
         │
         ▼
  Live progress UI (SSE streaming, same pattern as blueprint)
  ├─ "Crawling website..."        (~10-15s)
  ├─ "Analyzing page speed..."    (~3-5s)
  ├─ "Running keyword gap..."     (~5-8s)
  └─ "Generating recommendations" (~5-8s)
         │
         ▼
  Interactive audit report (in-app)
         │
         ▼
  [Export PDF] ← white-label ready (custom logo, brand colors)
```

**Total generation time:** ~25-35 seconds
**Estimated cost per audit:** ~$0.15-0.25 (Firecrawl crawl + SpyFu + Claude synthesis)

---

## 3. Audit Report Sections

### 3.1 Executive Summary
- **Overall SEO Score:** weighted average out of 100
- **Category scores:** Technical / Content / Performance / Keyword Opportunity
- **Top 5 priority fixes** — one-sentence each, ranked by impact
- **Competitive position summary** — where the site stands vs competitors

### 3.2 Technical SEO Audit
Crawl up to 10 pages (homepage + key internal pages) and analyze:

| Check | What We Measure | Scoring |
|-------|----------------|---------|
| Meta titles | Present, correct length (50-60 chars), unique per page | Per-page pass/fail |
| Meta descriptions | Present, correct length (150-160 chars), unique | Per-page pass/fail |
| H1 tags | Exactly one per page, contains target keyword | Per-page pass/fail |
| Image alt text | % of images with descriptive alt text | Coverage % |
| Internal linking | Pages with <2 internal links flagged | Count |
| Schema markup | Structured data present (Organization, Product, FAQ, etc.) | Present/absent |
| Sitemap | XML sitemap exists and is valid | Pass/fail |
| Robots.txt | Exists, not blocking important pages | Pass/fail |
| HTTPS | All pages served over HTTPS | Pass/fail |
| Canonical tags | Present and self-referencing | Per-page pass/fail |
| Mobile viewport | Meta viewport tag configured | Pass/fail |

**Output:** Page-by-page breakdown table + aggregate score.

### 3.3 Performance Audit
Using Google PageSpeed Insights API (free tier, no key required for basic usage):

| Metric | What | Target |
|--------|------|--------|
| Performance Score | Lighthouse overall | >90 |
| LCP (Largest Contentful Paint) | Main content load time | <2.5s |
| FID (First Input Delay) | Interactivity delay | <100ms |
| CLS (Cumulative Layout Shift) | Visual stability | <0.1 |
| Mobile vs Desktop | Score comparison | Both >80 |

**Output:** Score cards with green/yellow/red indicators + specific fix recommendations.

### 3.4 Keyword & Content Opportunity
Reuses existing SpyFu keyword intelligence module:

| Analysis | What | Actionable Output |
|----------|------|-------------------|
| Organic gaps | Keywords competitors rank for, client doesn't | Content creation targets |
| Paid gaps | Keywords competitors bid on, client doesn't | PPC campaign targets |
| Quick wins | Low difficulty (<40), decent volume (100+) | "Do these first" list |
| Content clusters | Grouped keyword themes | 3-month content calendar |
| Competitive position | Domain authority comparison | Benchmark metrics |

**Output:** Keyword tables with volume, difficulty, CPC + prioritized action list.

### 3.5 Competitor Comparison Matrix
Side-by-side comparison of client vs competitors:

- Domain metrics (organic keywords, paid keywords, estimated traffic)
- Technical SEO score comparison (if we crawl competitor pages too)
- Content gap visualization
- "Where you're winning" vs "Where you're losing"

### 3.6 Prioritized Action Plan
AI-synthesized recommendations, scored and ordered:

- **Critical (fix now):** Issues hurting rankings today (broken meta, slow pages, missing schema)
- **High impact (this month):** Quick-win content targets, missing keyword pages
- **Strategic (next quarter):** Long-term content plays, authority building, competitive positioning
- **Each item includes:** What to do, why it matters, estimated effort (low/medium/high), expected impact

---

## 4. Technical Architecture

### 4.1 Stack (All Existing)

| Component | Tool | Status |
|-----------|------|--------|
| Website crawling | Firecrawl (`crawl` endpoint, multi-page) | Already integrated |
| Keyword intelligence | SpyFu API | Already integrated |
| Page speed analysis | Google PageSpeed Insights API | New — free, no auth |
| AI synthesis | Claude Sonnet (Vercel AI SDK) | Already integrated |
| Streaming progress | SSE (same as blueprint) | Already built |
| PDF export | React-to-PDF pipeline | Already built |

### 4.2 Pipeline Design

```
Phase 1 — Data Collection (parallel, ~10-15s)
├─ Firecrawl crawl (up to 10 pages, HTML + metadata)
├─ PageSpeed Insights API (mobile + desktop)
└─ SpyFu keyword gap analysis (reuse existing module)

Phase 2 — Scoring (~1-2s, deterministic)
├─ Parse HTML for technical signals (meta, H1, alt, schema, etc.)
├─ Score each category (0-100)
└─ Compute weighted overall score

Phase 3 — AI Synthesis (~5-8s)
└─ Claude generates prioritized recommendations from all data
```

**Key design principle:** Phase 1 is all real data (crawl results, API responses, keyword data). AI only enters in Phase 3 for synthesis — ensuring recommendations are grounded in facts, not hallucinated.

### 4.3 New Files Needed

| File | Purpose |
|------|---------|
| `src/lib/ai/seo-audit.ts` | Crawl parser, scoring engine, technical checks |
| `src/lib/ai/schemas/seo-audit.ts` | Zod schema for audit output |
| `src/lib/ai/pagespeed.ts` | PageSpeed Insights API client |
| `src/app/api/seo-audit/generate/route.ts` | SSE streaming API route |
| `src/app/seo-audit/page.tsx` | Input form + audit results UI |
| `src/components/seo-audit/audit-report.tsx` | Report rendering component |
| `src/components/seo-audit/score-card.tsx` | Visual score indicators |

### 4.4 Estimated Development Effort

| Task | Effort |
|------|--------|
| Technical SEO parser (HTML → scores) | 2-3 days |
| PageSpeed Insights integration | 0.5 day |
| Scoring engine + schema | 1 day |
| API route (SSE pipeline) | 1 day |
| Frontend (input form + report UI) | 2-3 days |
| PDF export template | 1 day |
| Testing + polish | 1-2 days |
| **Total** | **~8-11 days** |

Much of this is reusing existing patterns (SSE streaming, SpyFu integration, PDF export, Firecrawl client).

---

## 5. Business Model Options

### Option A: Lead Magnet (Free)
- Free audit with email capture
- Limited report (executive summary + top 5 fixes)
- Full report requires blueprint purchase or subscription
- **Goal:** Funnel users into paid blueprint

### Option B: Standalone Product ($49-99/audit)
- Full audit report with PDF export
- One-time purchase per domain
- Can be bundled with blueprint at discount

### Option C: Subscription Add-On ($29-49/mo)
- Unlimited audits
- Monthly re-scan tracking (score changes over time)
- Competitor monitoring alerts
- **Goal:** Recurring revenue

### Option D: White-Label / Agency
- Custom branding on PDF exports (logo, colors, company name)
- Bulk pricing for agencies running audits for clients
- API access for programmatic audits
- **Goal:** B2B revenue stream

These options are **not mutually exclusive** — a common pattern is:
1. Free limited audit (lead magnet)
2. Full audit included with blueprint
3. White-label sold separately to agencies

---

## 6. Competitive Positioning

| Competitor Tool | Price | Our Advantage |
|----------------|-------|---------------|
| Ahrefs Site Audit | $99+/mo subscription | We're a one-time or per-audit cost. No subscription commitment. |
| SEMrush Audit | $130+/mo subscription | Our audit is integrated with competitive keyword intelligence + strategic recommendations. Not just data. |
| Screaming Frog | Free (limited) | We add AI-powered prioritized recommendations. Screaming Frog is raw data only. |
| Ubersuggest | $29/mo | We include real competitor review data + ad intelligence from the blueprint pipeline. |

**Our differentiator:** We don't just list problems — we synthesize keyword gaps, competitor weaknesses, and technical issues into a **prioritized action plan with estimated impact**. Other tools dump data; we give strategy.

---

## 7. Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Firecrawl crawl rate limits | Cap at 10 pages per audit; queue if rate limited |
| PageSpeed API rate limits | 25,000 queries/day free tier — more than sufficient |
| SpyFu API requires paid key | Already have this; falls back gracefully if unavailable |
| Large sites (1000+ pages) | Scope to 10 most important pages; offer deep crawl as premium |
| AI hallucinating recommendations | Phase 3 synthesis only — all data is real from Phase 1 |

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Audit completion rate | >90% (audits started → completed) |
| Generation time | <35 seconds |
| Cost per audit | <$0.25 |
| Lead magnet conversion | >15% of free audit users view blueprint offering |
| User satisfaction | Recommendations rated "actionable" by >80% of users |

---

## 9. Future Enhancements (V2+)

- **Scheduled re-scans:** Monthly automated audits with score change tracking
- **Fix verification:** Re-crawl specific pages after user implements fixes
- **Content gap pages:** Auto-generate content briefs for missing keyword pages
- **Backlink analysis:** Integrate Ahrefs/Moz API for link profile data
- **Multi-language support:** Audit sites in non-English markets
- **Slack/email alerts:** Notify when competitor SEO changes detected
