# Strategic Blueprint Generator
## Enhanced Multi-Agent Research Architecture
### Version 2.0 - OpenRouter Integration

---

## Executive Summary

This document outlines the enhanced architecture for the Strategic Blueprint Generator, integrating multi-agent research capabilities from four leading AI providers through OpenRouter's unified API. The enhancement transforms static LLM analysis into dynamic, real-time market intelligence.

---

## Current Limitations

- **Single Model Dependency:** Currently relies solely on Claude Sonnet with static training data
- **Stale Market Data:** No access to real-time competitor analysis, pricing, or market trends
- **Limited Verification:** Cannot cross-reference claims or validate market assumptions
- **No Citations:** Output lacks verifiable sources for stakeholder confidence

---

## Solution: Multi-Agent Research Pipeline

Integrate specialized research agents from Perplexity, OpenAI, Google, and Anthropic through OpenRouter's unified API. Each agent contributes domain-specific capabilities to create comprehensive, verified, and cited strategic blueprints.

---

## Architecture Comparison

### Current Architecture (Single Model)

| Section | Model | Limitation |
|---------|-------|------------|
| Section 1-5 | Claude Sonnet | Static training data only |

### Enhanced Architecture (Multi-Agent)

| Section | Research Agent | Synthesis Agent | Enhancement |
|---------|----------------|-----------------|-------------|
| **1. Industry Market** | Perplexity Sonar Deep Research | Claude Sonnet 4.5 | Real-time market data + citations |
| **2. ICP Analysis** | Perplexity Sonar Pro | GPT-5 | Validated reachability data |
| **3. Offer Analysis** | Gemini 2.5 Flash | Claude Sonnet 4.5 | Market pricing benchmarks |
| **4. Competitor** | Perplexity Deep Research + OpenAI o3 | Claude Opus 4.5 | Live competitor intel |
| **5. Synthesis** | N/A (uses prior research) | Claude Opus 4.5 | Multi-source synthesis |

---

## Section-by-Section Enhancement

### Section 1: Industry & Market Overview

**Current Problem:** Market data relies on Claude's training cutoff. Market maturity, demand drivers, and pain points may be outdated or regionally inaccurate.

#### Enhanced Pipeline

| Step | Agent / Model | Purpose |
|------|---------------|---------|
| 1. Research | `perplexity/sonar-deep-research` | Multi-step web research on industry, trends, pain points |
| 2. Verify | `perplexity/sonar-reasoning-pro` | Cross-check data, validate market claims |
| 3. Synthesize | `anthropic/claude-sonnet-4.5` | Structure into IndustryMarketOverview schema |

**New Data Points Added:**
- Real-time market size and growth rates with citations
- Current industry news and recent developments
- Verified pain points from recent surveys and reports
- Regional market variations and trends

---

### Section 4: Competitor Analysis (Critical Enhancement)

**Current Problem:** Competitor data is completely fabricated or outdated. No access to actual ad libraries, pricing, or current positioning.

#### Enhanced Pipeline

| Step | Agent / Model | Purpose |
|------|---------------|---------|
| 1. Deep Research | `perplexity/sonar-deep-research` | Research competitor websites, pricing, positioning |
| 2. Ad Intel | `openai/o3-deep-research` | Research Meta Ad Library, Google Ads patterns |
| 3. Verify | `google/gemini-2.5-flash` | Fast verification and data cleaning |
| 4. Synthesize | `anthropic/claude-opus-4.5` | Strategic synthesis into CompetitorAnalysis schema |

---

## OpenRouter Model Reference

### Perplexity Research Agents (Web Search Built-in)

| Model ID | Context | Pricing | Best For |
|----------|---------|---------|----------|
| `perplexity/sonar-deep-research` | 128K | $2/$8/M + search | Section 1, 4 research |
| `perplexity/sonar-pro-search` | 200K | $3/$15/M + $18/K | Multi-step agentic search |
| `perplexity/sonar-reasoning-pro` | 128K | $2/$8/M | Verification + reasoning |
| `perplexity/sonar` | 127K | $1/$1/M + $5/K | Fast lightweight queries |

### OpenAI Research & Reasoning Agents

| Model ID | Context | Pricing | Best For |
|----------|---------|---------|----------|
| `openai/o3-deep-research` | 200K | $10/$40/M + search | Complex multi-step research |
| `openai/gpt-5` | 200K | $10-30/M | Logic, decision rules |
| `openai/gpt-5.2` | 200K | Premium | Latest frontier reasoning |

### Anthropic Synthesis Agents

| Model ID | Context | Pricing | Best For |
|----------|---------|---------|----------|
| `anthropic/claude-opus-4.5` | 200K | $5/$25/M | Section 4, 5 synthesis |
| `anthropic/claude-sonnet-4.5` | 1M | $3/$15/M | Section 1, 2, 3 synthesis |
| `anthropic/claude-sonnet-4` | 1M | $3/$15/M | Cost-effective synthesis |

### Google Gemini Verification Agents

| Model ID | Context | Pricing | Best For |
|----------|---------|---------|----------|
| `google/gemini-2.5-flash` | 1.05M | $0.30/$2.50/M | Fast verification, thinking |
| `google/gemini-2.5-flash-lite` | 1M | $0.10/$0.40/M | Ultra-fast, budget |
| `google/gemini-3-pro` | 1M | Premium | Flagship multimodal |

---

## Implementation Guide

### OpenRouter Integration

All models are accessed through a single OpenRouter API endpoint. This provides unified billing, automatic fallbacks, and consistent request/response format.

#### API Configuration

- **Base URL:** `https://openrouter.ai/api/v1`
- **Auth Header:** `Authorization: Bearer {OPENROUTER_API_KEY}`
- **SDK Compatible:** OpenAI SDK works directly with base_url override

---

## Cost Estimation Per Blueprint

| Section | Models Used | Est. Tokens | Est. Cost |
|---------|-------------|-------------|-----------|
| Section 1: Industry Market | 2 Perplexity + Claude | ~15K | $0.15-0.25 |
| Section 2: ICP Analysis | Perplexity + GPT-5 | ~12K | $0.10-0.20 |
| Section 3: Offer Analysis | Gemini + Claude | ~10K | $0.08-0.15 |
| Section 4: Competitor | Perplexity + o3 + Opus | ~25K | $0.35-0.50 |
| Section 5: Synthesis | Claude Opus 4.5 | ~20K | $0.20-0.30 |
| **TOTAL PER BLUEPRINT** | **Multi-Agent Pipeline** | **~82K** | **$0.88-1.40** |

**Comparison:** Current single-model cost ~$0.15-0.25 per blueprint. Enhanced multi-agent cost ~$0.88-1.40 per blueprint. Premium justified by real-time data, citations, and verification.

---

## Implementation Roadmap

### Phase 1: OpenRouter Setup (Week 1)

1. Create OpenRouter account and obtain API key
2. Add OpenRouter credits for testing (~$20)
3. Create openrouter.ts service wrapper with model configurations
4. Test basic calls to each provider through OpenRouter

### Phase 2: Section 4 Enhancement (Week 2)

Start with Section 4 (Competitor Analysis) as it benefits most from real-time research.

5. Implement Perplexity Deep Research call for competitor website analysis
6. Add OpenAI o3 Deep Research for ad library intelligence
7. Integrate Gemini Flash for data verification
8. Route verified data to Claude Opus for final synthesis

### Phase 3: Section 1 Enhancement (Week 3)

9. Add Perplexity Sonar Deep Research for market intelligence
10. Implement citation extraction and storage
11. Update IndustryMarketOverview schema to include source citations

### Phase 4: Full Integration (Week 4)

12. Enhance Sections 2 and 3 with research agents
13. Implement parallel research calls for performance
14. Add cost tracking per agent and section
15. A/B test enhanced vs standard blueprints with media team

---

## Summary

The enhanced multi-agent architecture transforms the Strategic Blueprint Generator from a static analysis tool into a real-time market intelligence platform. By leveraging specialized research agents from Perplexity, OpenAI, Google, and Anthropic through OpenRouter's unified API, each section of the blueprint receives verified, cited, and current data.

**Key Benefits:**

1. **Real-time market data** - No more stale training data limitations
2. **Verified intelligence** - Cross-check claims across multiple sources
3. **Citations included** - Stakeholder confidence with source attribution
4. **Single API** - Unified billing and integration through OpenRouter
5. **Cost effective** - ~$1-1.50 per blueprint for premium multi-agent analysis
