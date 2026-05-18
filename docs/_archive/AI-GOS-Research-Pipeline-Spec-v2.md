# Technical Specification: Strategic Research Pipeline v2.0

**Vercel AI SDK Migration & Performance Optimization**

| Field | Value |
|-------|-------|
| Version | 2.0.0 |
| Date | January 21, 2025 |
| Author | AI-GOS Engineering |
| Status | Ready for Implementation |

---

## 1. Executive Summary

This specification defines the architecture for migrating AI-GOS's strategic research pipeline from OpenRouter to Vercel AI SDK, implementing parallel execution patterns, and optimizing for sub-2-minute document generation at reduced cost with improved quality.

### 1.1 Goals

- **Generation Time:** 60-90 seconds (down from 2-3 minutes)
- **Cost per Document:** $0.08-0.15 (down from $0.30-0.50)
- **Quality:** Richer data sources, better synthesis, structured outputs
- **UX:** Progressive streaming with real-time section rendering

### 1.2 Key Changes

| Component | Current State | Target State |
|-----------|---------------|--------------|
| API Layer | OpenRouter (5% markup) | Vercel AI SDK (direct) |
| Execution | Sequential (4 sections) | Parallel + Synthesis |
| Research Model | Perplexity Sonar only | Sonar + Gemini Grounding |
| Output | Complete on finish | Streaming + partial JSON |
| Caching | None | Prompt + Semantic caching |

---

## 2. Architecture Overview

### 2.1 System Context

The research pipeline transforms client briefing data into comprehensive strategic blueprints through a multi-stage AI orchestration process. The new architecture separates concerns into distinct layers: API Gateway, Model Router, Research Orchestrator, and Output Renderer.

#### 2.1.1 High-Level Flow

1. Client submits briefing data via `POST /api/strategic-blueprint/generate`
2. Input sanitization and validation
3. Parallel research execution (4 sections simultaneously)
4. Context aggregation and synthesis
5. Progressive streaming response to client
6. Cost tracking and metadata generation

### 2.2 Component Architecture

#### 2.2.1 Vercel AI SDK Integration

The Vercel AI SDK provides a unified interface for multiple AI providers with native streaming support, structured output handling, and edge runtime compatibility.

**Required packages:**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google @ai-sdk/perplexity
```

- `ai` — Core SDK with streaming primitives
- `@ai-sdk/anthropic` — Claude Sonnet 4 for synthesis
- `@ai-sdk/openai` — GPT-4o for structured extraction
- `@ai-sdk/google` — Gemini 2.0 Flash with Grounding
- `@ai-sdk/perplexity` — Sonar for web research

#### 2.2.2 Model Selection Strategy

| Task | Model | Cost/1M tokens | Rationale |
|------|-------|----------------|-----------|
| Market Research | Perplexity Sonar | $1.00 / $1.00 | Fast web search, citations |
| Competitor Analysis | Perplexity Sonar Pro | $3.00 / $15.00 | Deep reasoning for complex analysis |
| ICP Validation | Gemini 2.0 Flash + Grounding | $0.10 / $0.40 | Cost-efficient with Google Search |
| Offer Analysis | Perplexity Sonar | $1.00 / $1.00 | Pricing/positioning research |
| Strategic Synthesis | Claude Sonnet 4 | $3.00 / $15.00 | Best prose quality, low sycophancy |
| JSON Extraction | GPT-4o | $2.50 / $10.00 | 99.6% structured output reliability |

---

## 3. Data Flow Specification

### 3.1 Input Schema

The pipeline accepts an `OnboardingFormData` object containing all client briefing information:

```typescript
interface OnboardingFormData {
  companyInfo: { name: string; industry: string; size: string; website: string };
  targetMarket: { geography: string[]; segments: string[]; verticals: string[] };
  icp: { title: string; painPoints: string[]; buyingTriggers: string[] };
  product: { name: string; description: string; pricing: string; differentiators: string[] };
  competitors: string[];
  budget: { monthly: number; goals: string[] };
}
```

### 3.2 Pipeline Stages

#### Stage 1: Input Validation (~50ms)

- Sanitize all string fields (max 5000 chars)
- Filter prompt injection patterns
- Validate required fields present
- Build unified business context string

#### Stage 2: Parallel Research (15-25 seconds)

Four research modules execute simultaneously using `Promise.allSettled` for fault tolerance:

| Module | Model | Est. Time | Output Tokens |
|--------|-------|-----------|---------------|
| Industry Market | Perplexity Sonar | 3-5 sec | ~2000 |
| ICP Validation | Gemini + Grounding | 4-6 sec | ~1500 |
| Competitor Analysis | Perplexity Sonar Pro | 8-12 sec | ~3000 |
| Offer Analysis | Perplexity Sonar | 3-5 sec | ~1500 |

#### Stage 3: Context Aggregation (~100ms)

- Collect successful research results
- Log any failed modules with fallback data
- Merge citations by source
- Calculate running cost

#### Stage 4: Strategic Synthesis (40-60 seconds, streamed)

Claude Sonnet 4 synthesizes all research into the final strategic blueprint. Output is streamed progressively to the client, with partial JSON objects emitted as sections complete.

#### Stage 5: Output Compilation

- Finalize `StrategicBlueprintOutput` structure
- Attach metadata (time, cost, models used)
- Aggregate all citations with section attribution
- Signal stream completion

---

## 4. API Contracts

### 4.1 Generate Blueprint Endpoint

| Property | Value |
|----------|-------|
| Endpoint | `POST /api/strategic-blueprint/generate` |
| Runtime | Edge (Vercel) |
| Max Duration | 300 seconds |
| Response Type | `ReadableStream` (Server-Sent Events) |

#### 4.1.1 Request Schema

```json
{
  "onboardingData": OnboardingFormData
}
```

#### 4.1.2 Stream Events

| Event Type | Payload | Description |
|------------|---------|-------------|
| `progress` | `{ stage, percent, message }` | Pipeline progress updates |
| `section_start` | `{ sectionId, name }` | Section generation beginning |
| `section_chunk` | `{ sectionId, content }` | Partial section content |
| `section_complete` | `{ sectionId, data }` | Full section JSON |
| `cost_update` | `{ totalCost, breakdown }` | Running cost calculation |
| `complete` | `{ blueprint, metadata }` | Final output with all data |
| `error` | `{ code, message, retry }` | Error with retry guidance |

### 4.2 Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `VALIDATION_FAILED` | Invalid input data | Fix input, do not retry |
| `RATE_LIMITED` | Provider rate limit hit | Retry after delay |
| `TIMEOUT` | 300s limit exceeded | Retry with simpler input |
| `PARTIAL_FAILURE` | Some sections failed | Use partial result or retry |
| `PROVIDER_ERROR` | AI provider unavailable | Automatic failover or retry |

---

## 5. Implementation Details

### 5.1 File Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── client.ts              # Vercel AI SDK setup
│   │   ├── providers.ts           # Provider registry
│   │   ├── models.ts              # Model constants & pricing
│   │   └── cache.ts               # Semantic cache layer
│   ├── research/
│   │   ├── orchestrator.ts        # Parallel execution
│   │   ├── industry-market.ts     # Market research module
│   │   ├── icp-validation.ts      # ICP module (Gemini)
│   │   ├── competitor-analysis.ts # Competitor module
│   │   ├── offer-analysis.ts      # Offer module
│   │   └── prompts/               # Prompt templates
│   └── strategic-blueprint/
│       ├── synthesizer.ts         # Claude synthesis
│       ├── output-types.ts        # TypeScript schemas
│       └── stream-utils.ts        # Streaming helpers
├── app/
│   └── api/
│       └── strategic-blueprint/
│           └── generate/
│               └── route.ts       # API endpoint
```

### 5.2 Provider Registry

The provider registry enables hot-swapping models without code changes. Define semantic aliases for each task type:

```typescript
// src/lib/ai/providers.ts
import { createProviderRegistry, customProvider } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { perplexity } from '@ai-sdk/perplexity';

export const registry = createProviderRegistry({
  anthropic,
  openai,
  google,
  perplexity,
  research: customProvider({
    languageModels: {
      fast: perplexity('sonar'),
      deep: perplexity('sonar-pro'),
      grounded: google('gemini-2.0-flash'),
      synthesis: anthropic('claude-sonnet-4'),
      structured: openai('gpt-4o'),
    },
  }),
});

// Usage: registry.languageModel('research:synthesis')
```

### 5.3 Parallel Research Orchestrator

The orchestrator manages concurrent research execution with fault tolerance and progress tracking:

```typescript
// src/lib/research/orchestrator.ts
import { generateText } from 'ai';
import { registry } from '@/lib/ai/providers';

interface ResearchModule {
  id: string;
  fn: (context: BusinessContext) => Promise<ResearchResult>;
  model: string;
}

export async function executeParallelResearch(
  context: BusinessContext,
  onProgress: (event: ProgressEvent) => void
): Promise<ResearchResults> {
  const modules: ResearchModule[] = [
    { id: 'market', fn: industryMarketResearch, model: 'research:fast' },
    { id: 'icp', fn: icpValidation, model: 'research:grounded' },
    { id: 'competitor', fn: competitorAnalysis, model: 'research:deep' },
    { id: 'offer', fn: offerAnalysis, model: 'research:fast' },
  ];

  const startTime = Date.now();

  const results = await Promise.allSettled(
    modules.map(async (mod) => {
      onProgress({ type: 'section_start', sectionId: mod.id, name: mod.id });
      
      try {
        const result = await mod.fn(context);
        onProgress({ 
          type: 'section_complete', 
          sectionId: mod.id, 
          data: result,
          duration: Date.now() - startTime 
        });
        return { id: mod.id, success: true, ...result };
      } catch (error) {
        onProgress({ 
          type: 'section_error', 
          sectionId: mod.id, 
          error: error.message 
        });
        return { id: mod.id, success: false, error };
      }
    })
  );

  return aggregateResults(results);
}

function aggregateResults(results: PromiseSettledResult<any>[]): ResearchResults {
  const successful: Record<string, any> = {};
  const failed: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      successful[result.value.id] = result.value;
    } else {
      failed.push(result.status === 'fulfilled' ? result.value.id : 'unknown');
    }
  }

  return { successful, failed, partial: failed.length > 0 };
}
```

### 5.4 Streaming Response Handler

The API route streams events to the client using Vercel AI SDK's streaming utilities:

```typescript
// src/app/api/strategic-blueprint/generate/route.ts
import { streamText } from 'ai';
import { registry } from '@/lib/ai/providers';
import { executeParallelResearch } from '@/lib/research/orchestrator';
import { buildBusinessContext, sanitizeInput } from '@/lib/strategic-blueprint/utils';

export const runtime = 'edge';
export const maxDuration = 300;

export async function POST(req: Request) {
  const { onboardingData } = await req.json();
  
  // Validate and sanitize
  const sanitized = sanitizeInput(onboardingData);
  const context = buildBusinessContext(sanitized);
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // Phase 1: Parallel research
        emit({ type: 'progress', stage: 'research', percent: 0, message: 'Starting research...' });
        
        const research = await executeParallelResearch(context, emit);
        
        emit({ type: 'progress', stage: 'synthesis', percent: 50, message: 'Synthesizing findings...' });

        // Phase 2: Streaming synthesis with Claude
        const synthesisPrompt = buildSynthesisPrompt(context, research);
        
        const { textStream } = await streamText({
          model: registry.languageModel('research:synthesis'),
          system: SYNTHESIS_SYSTEM_PROMPT,
          prompt: synthesisPrompt,
          maxTokens: 4000,
        });

        let fullSynthesis = '';
        for await (const chunk of textStream) {
          fullSynthesis += chunk;
          emit({ type: 'section_chunk', sectionId: 'synthesis', content: chunk });
        }

        // Phase 3: Compile final output
        const blueprint = compileBlueprint(research, fullSynthesis);
        
        emit({ 
          type: 'complete', 
          blueprint,
          metadata: {
            generatedAt: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            totalCost: calculateTotalCost(research),
          }
        });
        
      } catch (error) {
        emit({ 
          type: 'error', 
          code: 'GENERATION_FAILED', 
          message: error.message,
          retry: true 
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## 6. Data Source Enrichment

### 6.1 Reddit & Community Integration

Reddit provides authentic user discussions, pain points, and competitive insights that traditional web search misses. Perplexity already indexes Reddit heavily, but targeted prompts improve relevance.

#### 6.1.1 Prompt Pattern for Community Research

```
Search Reddit communities r/SaaS, r/startups, r/sales, r/marketing, 
r/[INDUSTRY] for authentic discussions about [PRODUCT_CATEGORY]:

1. Pain points: What problems do users complain about most?
2. Product mentions: Which competitors are recommended/criticized?
3. Pricing discussions: What do users consider fair pricing?
4. Feature requests: What capabilities are users asking for?
5. Decision factors: How do users evaluate solutions?

Cite specific subreddits and include sentiment indicators.
```

#### 6.1.2 Additional Data Sources

| Source | Access Method | Cost | Use Case |
|--------|---------------|------|----------|
| G2/Capterra | Perplexity prompt | Included | Review sentiment |
| LinkedIn | Perplexity prompt | Included | Company/people data |
| Exa AI | Direct API | $5/1K requests | Semantic company search |
| Tavily | Direct API | $0.008/credit | RAG-optimized search |

### 6.2 Research Prompt Templates

Each research module uses structured prompts with explicit source guidance. Store templates in `/src/lib/research/prompts/` for maintainability.

#### 6.2.1 Template Structure

- **Context Section:** Business context from onboarding data
- **Source Guidance:** Explicit platforms/communities to search
- **Output Schema:** Zod schema for structured extraction
- **Quality Criteria:** Minimum citations, recency requirements

---

## 7. Caching Strategy

### 7.1 Three-Layer Cache Architecture

#### Layer 1: Prompt Caching (Provider-Level)

Anthropic and OpenAI support automatic caching of repeated prompt prefixes. Structure prompts with stable system instructions first to maximize cache hits.

- **Anthropic:** 90% cost reduction, 85% latency reduction on cache hits
- **OpenAI:** 50% automatic discount for prompts ≥1024 tokens

```typescript
// Anthropic explicit caching
const result = await generateText({
  model: anthropic('claude-sonnet-4'),
  messages: [
    {
      role: 'system',
      content: LONG_SYSTEM_PROMPT, // ~2000 tokens, stable
      experimental_providerMetadata: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
    {
      role: 'user',
      content: userQuery, // Dynamic per-request
    },
  ],
});
```

#### Layer 2: Semantic Cache (Application-Level)

Cache research results by semantic similarity using embeddings + Vercel KV:

```typescript
// src/lib/ai/cache.ts
import { createClient } from '@vercel/kv';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const SIMILARITY_THRESHOLD = 0.92;
const CACHE_TTL = 3600; // 1 hour

export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl = CACHE_TTL
): Promise<{ result: T; cached: boolean }> {
  // Generate embedding for query
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: key,
  });

  // Check cache
  const cacheKey = `research:${hashKey(key)}`;
  const cached = await kv.get<{ result: T; embedding: number[] }>(cacheKey);
  
  if (cached) {
    const similarity = cosineSimilarity(embedding, cached.embedding);
    if (similarity > SIMILARITY_THRESHOLD) {
      return { result: cached.result, cached: true };
    }
  }

  // Fetch fresh data
  const result = await fetchFn();
  
  // Store in cache
  await kv.set(cacheKey, { result, embedding }, { ex: ttl });
  
  return { result, cached: false };
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}
```

#### Layer 3: Result Cache (Document-Level)

Cache complete blueprints by content hash of input data. Identical inputs return cached documents instantly.

### 7.2 Cache Invalidation

- **TTL-based:** Research cache expires after 24 hours
- **Version-based:** Prompt template changes invalidate related cache
- **Manual:** Admin endpoint to purge cache by key pattern

### 7.3 Expected Cache Performance

| Metric | No Cache | With Cache | Improvement |
|--------|----------|------------|-------------|
| Avg. Generation Time | 90 sec | 45 sec | 50% |
| Avg. Cost/Document | $0.15 | $0.08 | 47% |
| API Calls/Document | 6 | 2-3 | 50-67% |

---

## 8. Streaming UI Implementation

### 8.1 Client-Side Architecture

The React client consumes the SSE stream and progressively renders sections as they arrive:

```typescript
// src/hooks/useStreamingBlueprint.ts
import { useState, useCallback } from 'react';
import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';

interface SectionState {
  content: string;
  data?: any;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  error?: string;
}

interface UseStreamingBlueprintReturn {
  sections: Record<string, SectionState>;
  progress: number;
  stage: string;
  isComplete: boolean;
  error: string | null;
  generate: (data: OnboardingFormData) => Promise<void>;
  reset: () => void;
}

export function useStreamingBlueprint(): UseStreamingBlueprintReturn {
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSections({});
    setProgress(0);
    setStage('');
    setIsComplete(false);
    setError(null);
  }, []);

  const generate = useCallback(async (data: OnboardingFormData) => {
    reset();
    
    try {
      const response = await fetch('/api/strategic-blueprint/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingData: data }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(event.slice(6));
            
            switch (data.type) {
              case 'progress':
                setProgress(data.percent);
                setStage(data.message);
                break;
                
              case 'section_start':
                setSections(s => ({
                  ...s,
                  [data.sectionId]: { content: '', status: 'streaming' },
                }));
                break;
                
              case 'section_chunk':
                setSections(s => ({
                  ...s,
                  [data.sectionId]: {
                    ...s[data.sectionId],
                    content: (s[data.sectionId]?.content || '') + data.content,
                    status: 'streaming',
                  },
                }));
                break;
                
              case 'section_complete':
                setSections(s => ({
                  ...s,
                  [data.sectionId]: {
                    content: s[data.sectionId]?.content || '',
                    data: data.data,
                    status: 'complete',
                  },
                }));
                break;
                
              case 'section_error':
                setSections(s => ({
                  ...s,
                  [data.sectionId]: {
                    content: '',
                    status: 'error',
                    error: data.error,
                  },
                }));
                break;
                
              case 'complete':
                setIsComplete(true);
                setProgress(100);
                break;
                
              case 'error':
                setError(data.message);
                break;
            }
          } catch (e) {
            console.error('Failed to parse event:', event);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [reset]);

  return { sections, progress, stage, isComplete, error, generate, reset };
}
```

### 8.2 Progressive Section Rendering

Each section card shows its state: pending, streaming (with skeleton pulse), or complete.

- **Pending:** Muted card with loading indicator
- **Streaming:** Partial content with typing animation, skeleton for remaining
- **Complete:** Full content with edit controls enabled

### 8.3 Real-Time Cost Display

Display running cost in the header as each API call completes. This transparency builds trust and helps identify cost optimization opportunities.

---

## 9. Cost Tracking & Monitoring

### 9.1 Per-Document Cost Calculation

```typescript
// src/lib/ai/cost.ts
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  searches?: number;
}

interface ModelPricing {
  input: number;  // per 1M tokens
  output: number; // per 1M tokens
  searchCostPer1K?: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'perplexity/sonar': { input: 1.00, output: 1.00, searchCostPer1K: 5.00 },
  'perplexity/sonar-pro': { input: 3.00, output: 15.00, searchCostPer1K: 5.00 },
  'google/gemini-2.0-flash': { input: 0.10, output: 0.40, searchCostPer1K: 35.00 },
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'openai/text-embedding-3-small': { input: 0.02, output: 0 },
};

export function calculateCost(usage: TokenUsage, model: string): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const searchCost = pricing.searchCostPer1K
    ? ((usage.searches || 0) / 1000) * pricing.searchCostPer1K
    : 0;

  return inputCost + outputCost + searchCost;
}
```

### 9.2 Model Pricing Reference

| Model | Input/1M | Output/1M | Search Cost |
|-------|----------|-----------|-------------|
| `perplexity/sonar` | $1.00 | $1.00 | $5/1K requests |
| `perplexity/sonar-pro` | $3.00 | $15.00 | $5/1K requests |
| `google/gemini-2.0-flash` | $0.10 | $0.40 | $35/1K grounded |
| `anthropic/claude-sonnet-4` | $3.00 | $15.00 | N/A |
| `openai/gpt-4o` | $2.50 | $10.00 | N/A |
| `openai/text-embedding-3-small` | $0.02 | N/A | N/A |

### 9.3 Monitoring & Observability

Integrate OpenTelemetry for production observability:

- **Langfuse:** LLM tracing, prompt analytics, cost dashboards
- **Vercel Analytics:** Edge function performance, error rates
- **Custom Metrics:** Cost per document, cache hit rate, section latencies

```typescript
// Enable telemetry in Vercel AI SDK
const result = await generateText({
  model: registry.languageModel('research:synthesis'),
  prompt: '...',
  experimental_telemetry: {
    isEnabled: true,
    metadata: {
      userId: user.id,
      blueprintId: blueprint.id,
      section: 'synthesis',
    },
  },
});
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Migrate to Vercel AI SDK with feature parity

1. Install Vercel AI SDK packages and configure providers
2. Create provider registry with model aliases
3. Migrate existing research modules to new SDK
4. Convert API route to Edge runtime
5. Implement basic streaming response
6. Validate output parity with existing pipeline

**Deliverable:** Working pipeline on new SDK, same output quality  
**Success Metric:** All existing tests pass, no regression

### Phase 2: Parallelization (Week 2)

**Goal:** Implement parallel research execution

1. Build research orchestrator with `Promise.allSettled`
2. Add progress event emission
3. Implement fault tolerance (partial results on failure)
4. Update synthesis to handle parallel inputs
5. Add streaming synthesis with Claude

**Deliverable:** 60-90 second generation time  
**Success Metric:** P95 generation time < 120 seconds

### Phase 3: Caching & Cost Optimization (Week 3)

**Goal:** Reduce costs by 50%+ through caching

1. Set up Vercel KV for semantic cache
2. Implement prompt caching patterns for Claude/OpenAI
3. Add embedding-based similarity search
4. Implement cost tracking and real-time display
5. Add Gemini Grounding for ICP validation (cost reduction)

**Deliverable:** $0.08-0.15 cost per document  
**Success Metric:** 50% cost reduction, 40% cache hit rate

### Phase 4: Quality & Enrichment (Week 4)

**Goal:** Improve research quality and data sources

1. Add Reddit/community-targeted prompts
2. Implement structured output schemas with Zod
3. Add LLM-as-judge quality evaluation
4. Fine-tune prompts based on quality metrics
5. Build progressive UI with section-by-section rendering
6. Production deployment and monitoring setup

**Deliverable:** Production-ready v2.0 pipeline  
**Success Metric:** Quality score improvement (via LLM evaluation)

---

## 11. Success Metrics

### 11.1 Key Performance Indicators

| Metric | Current | Target | Stretch |
|--------|---------|--------|---------|
| P50 Generation Time | 150 sec | 75 sec | 45 sec |
| P95 Generation Time | 240 sec | 120 sec | 90 sec |
| Cost per Document | $0.35 | $0.15 | $0.08 |
| Cache Hit Rate | 0% | 40% | 70% |
| Time to First Byte | 3 sec | 500 ms | 200 ms |
| Error Rate | 5% | < 2% | < 0.5% |

### 11.2 Quality Metrics

- **Citation Count:** Average citations per section (target: 5+)
- **Source Diversity:** Unique domains cited (target: 10+)
- **Recency Score:** % of citations from last 6 months (target: 60%+)
- **LLM Quality Score:** Automated evaluation via Claude judge (target: 8/10)

---

## 12. Dependencies & Prerequisites

### 12.1 Environment Variables

```bash
# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
PERPLEXITY_API_KEY=pplx-...

# Caching
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

# Monitoring
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
```

### 12.2 Package Dependencies

```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/google": "^1.0.0",
    "@ai-sdk/perplexity": "^1.0.0",
    "@vercel/kv": "^2.0.0",
    "zod": "^3.23.0"
  }
}
```

### 12.3 Vercel Configuration

- Vercel Pro plan (for 300s function timeout)
- Vercel KV (for semantic caching)
- Edge Functions enabled

---

## Appendix A: Output Schema Reference

The complete `StrategicBlueprintOutput` TypeScript interface remains unchanged from v1.0. See `src/lib/strategic-blueprint/output-types.ts` for the full schema definition.

## Appendix B: Migration Checklist

- [ ] Remove `openrouter` dependency
- [ ] Install Vercel AI SDK packages
- [ ] Update environment variables
- [ ] Migrate API route to Edge runtime
- [ ] Update research modules to use registry
- [ ] Add streaming response handling
- [ ] Implement parallel orchestrator
- [ ] Set up Vercel KV caching
- [ ] Configure Langfuse monitoring
- [ ] Update client-side hooks for streaming
- [ ] Run regression tests

---

*— End of Specification —*
