# Async Research Worker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple research sub-agents from the Vercel AI SDK chat stream so the conversation flows freely while research runs in a Railway worker, with results pushed back to the frontend via Supabase Realtime.

**Architecture:** A persistent Node.js/Express service on Railway receives research job dispatches (HTTP POST) and immediately returns 202. It then runs the Anthropic sub-agent in the background, writes the result to `journey_sessions.research_results[section]` in Supabase. The frontend subscribes to Supabase Realtime and renders research cards as they arrive — completely independent of the chat stream.

**Tech Stack:** Express + TypeScript (Railway worker), `@anthropic-ai/sdk`, `@supabase/supabase-js`, `@mendable/firecrawl-js`, `@antv/mcp-server-chart/sdk`, Supabase Realtime, Vercel AI SDK (existing, unchanged).

**Design doc:** `docs/plans/2026-03-04-async-research-design.md`

---

## Task 1: Railway CLI + project init

**Files:**
- None (CLI commands only)

**Step 1: Check if Railway CLI is installed**

```bash
railway --version
```

Expected: version string (e.g., `railway 3.x.x`). If command not found, proceed to Step 2. If installed, skip to Step 3.

**Step 2: Install Railway CLI (if not installed)**

```bash
npm install -g @railway/cli
```

Expected: CLI installed. Verify with `railway --version`.

**Step 3: Login to Railway**

```bash
railway login
```

Expected: Browser opens for auth. After auth, terminal shows `Logged in as <email>`.

**Step 4: Create a new Railway project**

From the Railway dashboard (https://railway.app), click "New Project" → "Empty Project". Name it `aigos-research-worker`. This gives you a project ID.

**Step 5: Link the CLI to the project**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
railway link
```

Select the `aigos-research-worker` project when prompted. Expected: `.railway/` config written locally. This links the repo root to the Railway project for future deploys.

---

## Task 2: Supabase migration — add research_results column + enable Realtime

**Files:**
- None (Supabase dashboard SQL editor)

**Step 1: Open Supabase SQL editor**

Go to your Supabase project → SQL Editor. Run this migration:

```sql
-- Add research_results column to journey_sessions
ALTER TABLE journey_sessions
  ADD COLUMN IF NOT EXISTS research_results JSONB DEFAULT '{}';

-- Add index for fast userId lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_journey_sessions_user_id
  ON journey_sessions (user_id);
```

Expected: "Success. No rows returned."

**Step 2: Enable Realtime on journey_sessions**

In Supabase → Database → Replication (or Table Editor → journey_sessions → Realtime toggle). Enable Realtime for the `journey_sessions` table.

Alternatively via SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE journey_sessions;
```

Expected: Realtime enabled. You can verify in Table Editor — the lightning bolt icon appears next to the table.

**Step 3: Verify in Table Editor**

Open Table Editor → journey_sessions. Confirm `research_results` column exists with type `jsonb` and default `{}`.

---

## Task 3: Railway worker — scaffold (package.json, tsconfig, Dockerfile)

**Files:**
- Create: `research-worker/package.json`
- Create: `research-worker/tsconfig.json`
- Create: `research-worker/Dockerfile`
- Create: `research-worker/.env.example`

**Step 1: Create the directory and package.json**

```bash
mkdir -p /Users/ammar/Dev-Projects/AI-GOS-main/research-worker/src
```

Create `research-worker/package.json`:

```json
{
  "name": "aigos-research-worker",
  "version": "1.0.0",
  "description": "Background research worker for AI-GOS — runs Anthropic sub-agents async",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@antv/mcp-server-chart": "*",
    "@mendable/firecrawl-js": "*",
    "@supabase/supabase-js": "^2.49.4",
    "express": "^4.18.2",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.0"
  }
}
```

Note: Copy exact version numbers from the main `package.json` for packages that appear in both (especially `@anthropic-ai/sdk`, `@supabase/supabase-js`, `zod`).

**Step 2: Create tsconfig.json**

Create `research-worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create Dockerfile**

Create `research-worker/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled source (Railway builds via npm run build first)
COPY dist/ ./dist/

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

**Step 4: Create .env.example**

Create `research-worker/.env.example`:

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RAILWAY_API_KEY=
SEARCHAPI_KEY=
FIRECRAWL_API_KEY=
SPYFU_API_KEY=
FOREPLAY_API_KEY=
PORT=3001
```

**Step 5: Install dependencies**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main/research-worker
npm install
```

Expected: `node_modules/` created, no errors.

**Step 6: Commit scaffold**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add research-worker/
git commit -m "feat(worker): scaffold Railway research worker — package.json, tsconfig, Dockerfile"
```

---

## Task 4: Worker — Express server + /health route

**Files:**
- Create: `research-worker/src/index.ts`

**Step 1: Create the Express server**

Create `research-worker/src/index.ts`:

```typescript
import express from 'express';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(express.json({ limit: '1mb' }));

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.RAILWAY_API_KEY;

  if (!expectedKey) {
    // In development without a key set, warn and allow through
    console.warn('[auth] RAILWAY_API_KEY not set — skipping auth (dev mode)');
    next();
    return;
  }

  if (authHeader !== `Bearer ${expectedKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Run (placeholder — filled in Task 8) ───────────────────────────────────────
app.post('/run', requireApiKey, (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[worker] Research worker listening on :${PORT}`);
});

export default app;
```

**Step 2: Test locally**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main/research-worker
npx ts-node-dev --transpile-only src/index.ts
```

Expected: `[worker] Research worker listening on :3001`

In a second terminal:
```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","ts":"2026-..."}`

**Step 3: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add research-worker/src/index.ts
git commit -m "feat(worker): Express server with /health + auth middleware"
```

---

## Task 5: Worker — Supabase write helper

**Files:**
- Create: `research-worker/src/supabase.ts`

**Step 1: Create the Supabase write helper**

Create `research-worker/src/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export interface ResearchResult {
  status: 'complete' | 'error';
  section: string;
  data?: unknown;
  error?: string;
  durationMs: number;
}

/**
 * Write a single research section result to journey_sessions.research_results.
 * Uses JSONB merge so concurrent writes don't overwrite each other.
 */
export async function writeResearchResult(
  userId: string,
  section: string,
  result: ResearchResult,
): Promise<void> {
  const supabase = getClient();

  // Find the session for this user
  const { data: session, error: fetchError } = await supabase
    .from('journey_sessions')
    .select('id, research_results')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !session) {
    console.error(`[supabase] Could not find session for user ${userId}:`, fetchError?.message);
    return;
  }

  const existing = (session.research_results as Record<string, unknown>) ?? {};
  const updated = { ...existing, [section]: result };

  const { error: updateError } = await supabase
    .from('journey_sessions')
    .update({ research_results: updated, updated_at: new Date().toISOString() })
    .eq('id', session.id);

  if (updateError) {
    console.error(`[supabase] Failed to write ${section} result:`, updateError.message);
  } else {
    console.log(`[worker] Wrote ${section} result (${result.status}) for user ${userId}`);
  }
}
```

**Step 2: Verify types match**

Check `journey_sessions` table has `user_id` and `updated_at` columns. If `updated_at` doesn't exist, remove that line from the update call.

**Step 3: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add research-worker/src/supabase.ts
git commit -m "feat(worker): Supabase write helper for research_results"
```

---

## Task 6: Worker — MCP tool definitions

**Files:**
- Create: `research-worker/src/tools/firecrawl.ts`
- Create: `research-worker/src/tools/spyfu.ts`
- Create: `research-worker/src/tools/adlibrary.ts`
- Create: `research-worker/src/tools/chart.ts`
- Create: `research-worker/src/tools/index.ts`

**Step 1: Create firecrawl tool**

Create `research-worker/src/tools/firecrawl.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';

export const firecrawlTool = betaZodTool({
  name: 'firecrawl',
  description: 'Scrape a web page and return its content as markdown. Use for pricing pages, landing pages, and competitor websites.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
  }),
  run: async ({ url }) => {
    try {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) return JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' });
      const client = new Firecrawl({ apiKey });
      const result = await client.scrapeUrl(url, { formats: ['markdown'] });
      return JSON.stringify({ success: result.success, markdown: result.markdown, error: (result as Record<string, unknown>).error });
    } catch (error) {
      return JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
```

Note: The main codebase uses `client.scrape()` — check if `@mendable/firecrawl-js` version uses `scrapeUrl()` or `scrape()`. Use whichever the installed version exports. Check with `node -e "const f = require('@mendable/firecrawl-js'); console.log(Object.keys(f.default.prototype))"` in the research-worker directory.

**Step 2: Create SpyFu tool**

Create `research-worker/src/tools/spyfu.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const SPYFU_BASE_URL = 'https://api.spyfu.com/apis';

async function spyfuGet(path: string): Promise<unknown> {
  const apiKey = process.env.SPYFU_API_KEY;
  if (!apiKey) throw new Error('SPYFU_API_KEY not configured');
  const url = `${SPYFU_BASE_URL}${path}&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SpyFu API error: ${res.status}`);
  return res.json();
}

export const spyfuTool = betaZodTool({
  name: 'spyfu',
  description: 'Get keyword intelligence and domain stats for a competitor domain using SpyFu.',
  inputSchema: z.object({
    domain: z.string().describe('The competitor domain to analyze (e.g., example.com)'),
  }),
  run: async ({ domain }) => {
    try {
      const [domainStats, keywords] = await Promise.all([
        spyfuGet(`/domain_stats/v2/getDomainStatsForQuery?query=${domain}&countryCode=US&_p=1&_pageSize=1`),
        spyfuGet(`/keyword_snake/v2/getMostValuableKeywordsForQuery?query=${domain}&countryCode=US&_p=1&_pageSize=20&excludeTerms=jobs,career,salary`),
      ]);
      return JSON.stringify({ keywords, domainStats });
    } catch (error) {
      return JSON.stringify({ keywords: [], domainStats: null, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
```

Note: Copy the exact SpyFu API paths from `src/lib/ai/spyfu-client.ts` if these paths are wrong.

**Step 3: Create Ad Library tool**

Create `research-worker/src/tools/adlibrary.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

// Ad Library uses SearchAPI.io — same key as web search
async function searchAds(query: string): Promise<unknown[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  // SearchAPI.io Google Ads Transparency Center endpoint
  const params = new URLSearchParams({
    engine: 'google_ads_transparency',
    q: query,
    api_key: apiKey,
  });
  const res = await fetch(`https://www.searchapi.io/api/v1/search?${params}`);
  if (!res.ok) return [];
  const data = await res.json() as Record<string, unknown>;
  return (data.ads as unknown[]) ?? [];
}

export const adLibraryTool = betaZodTool({
  name: 'adLibrary',
  description: 'Fetch competitor ads from ad libraries. Use for creative intelligence — understand what messaging, formats, and offers competitors are running.',
  inputSchema: z.object({
    companyName: z.string().describe('The company name to search for ads'),
    domain: z.string().optional().describe('The competitor domain (e.g., "salesforce.com")'),
  }),
  run: async ({ companyName }) => {
    try {
      const ads = await searchAds(companyName);
      return JSON.stringify({ ads, totalFound: ads.length });
    } catch (error) {
      return JSON.stringify({ ads: [], totalFound: 0, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
```

Note: Check `src/lib/ad-library/service.ts` to confirm what API this uses. The SearchAPI.io implementation above is a best guess — adapt to match the real implementation if it differs.

**Step 4: Create Chart tool**

Create `research-worker/src/tools/chart.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { callTool } from '@antv/mcp-server-chart/sdk';
import { z } from 'zod';

const CHART_TYPES = ['bar', 'pie', 'radar', 'funnel', 'word_cloud', 'dual_axes', 'line', 'sankey'] as const;

export const chartTool = betaZodTool({
  name: 'generateChart',
  description: 'Generate a data visualization chart and return a hosted image URL.',
  inputSchema: z.object({
    chartType: z.enum(CHART_TYPES),
    title: z.string(),
    data: z.array(z.record(z.string(), z.unknown())),
    xField: z.string().optional(),
    yField: z.string().optional(),
    colorField: z.string().optional(),
    valueField: z.string().optional(),
  }),
  run: async ({ chartType, title, data, xField, yField, colorField, valueField }) => {
    try {
      const spec: Record<string, unknown> = { title, data };
      if (xField) spec.xField = xField;
      if (yField) spec.yField = yField;
      if (colorField) spec.colorField = colorField;
      if (valueField) spec.valueField = valueField;

      const result = await callTool(`generate_${chartType}_chart`, spec);
      let url: string | undefined;
      if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
        for (const item of (result.content as Array<Record<string, unknown>>)) {
          if (item.type === 'image' && typeof item.url === 'string') { url = item.url; break; }
          if (item.type === 'text' && typeof item.text === 'string') {
            const match = (item.text as string).match(/https?:\/\/\S+/);
            if (match) { url = match[0]; break; }
          }
        }
      }
      return JSON.stringify({ success: true, url: url ?? null, chartType, title });
    } catch (error) {
      return JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
```

**Step 5: Create tools/index.ts**

Create `research-worker/src/tools/index.ts`:

```typescript
export { firecrawlTool } from './firecrawl';
export { spyfuTool } from './spyfu';
export { adLibraryTool } from './adlibrary';
export { chartTool } from './chart';
```

**Step 6: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add research-worker/src/tools/
git commit -m "feat(worker): MCP tool definitions — firecrawl, spyfu, adlibrary, chart"
```

---

## Task 7: Worker — research runner functions

**Files:**
- Create: `research-worker/src/runner.ts` (shared Anthropic runner)
- Create: `research-worker/src/runners/industry.ts`
- Create: `research-worker/src/runners/competitors.ts`
- Create: `research-worker/src/runners/icp.ts`
- Create: `research-worker/src/runners/offer.ts`
- Create: `research-worker/src/runners/synthesize.ts`
- Create: `research-worker/src/runners/keywords.ts`
- Create: `research-worker/src/runners/index.ts`

**Step 1: Create shared runner**

Create `research-worker/src/runner.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';

export function createClient() {
  return new Anthropic({ maxRetries: 0 });
}

export async function runWithBackoff(
  runFn: () => Promise<Anthropic.Beta.BetaMessage>,
  label: string,
): Promise<Anthropic.Beta.BetaMessage> {
  try {
    return await runFn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes('rate limit') || msg.includes('rate_limit') || (err as { status?: number }).status === 429;
    if (isRateLimit) {
      console.warn(`[${label}] Rate limited — waiting 65s before retry`);
      await new Promise((resolve) => setTimeout(resolve, 65_000));
      return await runFn();
    }
    throw err;
  }
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {}
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) { return JSON.parse(trimmed.slice(first, last + 1)); }
  throw new Error('No parseable JSON found');
}

export type { BetaMessageParam };
```

**Step 2: Create industry runner**

Create `research-worker/src/runners/industry.ts`:

```typescript
import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff, extractJson } from '../runner';
import type { ResearchResult } from '../supabase';

// Copy INDUSTRY_SYSTEM_PROMPT verbatim from:
// src/lib/ai/tools/research/research-industry.ts
const INDUSTRY_SYSTEM_PROMPT = `You are an expert market researcher with real-time web search capabilities.
[... copy full prompt from src/lib/ai/tools/research/research-industry.ts ...]`;

export async function runResearchIndustry(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();

  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
          system: INDUSTRY_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Research the industry and market for:\n\n${context}` }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Sub-agent timed out after 120s')), 120_000)
          ),
        ]);
      },
      'researchIndustry',
    );

    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';

    let data: unknown;
    try {
      data = extractJson(resultText);
    } catch {
      console.error('[industry] JSON extraction failed:', resultText.slice(0, 300));
      data = { summary: resultText };
    }

    return { status: 'complete', section: 'industryMarket', data, durationMs: Date.now() - startTime };
  } catch (error) {
    return { status: 'error', section: 'industryMarket', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startTime };
  }
}
```

**Step 3: Create remaining runners (competitors, icp, offer, synthesize, keywords)**

Create `research-worker/src/runners/competitors.ts`, `icp.ts`, `offer.ts`, `synthesize.ts`, `keywords.ts` — same pattern as industry.ts above. For each:

- Copy the system prompt verbatim from the corresponding file in `src/lib/ai/tools/research/`
- Use the correct `section` value: `'competitors'`, `'icpValidation'`, `'offerAnalysis'`, `'crossAnalysis'`, `'keywords'`
- Use the correct tools array for each runner:
  - `competitors`: `[web_search, adLibraryTool, spyfuTool, pagespeedTool]` — import from `../tools`
  - `icp`: `[web_search]`
  - `offer`: `[web_search, firecrawlTool]` — import from `../tools`
  - `synthesize`: `[chartTool]` — import from `../tools`
  - `keywords`: `[spyfuTool]` — import from `../tools`

Note: `pagespeedTool` is used in competitors in the main codebase. Check `src/lib/ai/tools/mcp/pagespeed-tool.ts` and port it to `research-worker/src/tools/pagespeed.ts` if needed.

**Step 4: Create runners/index.ts**

Create `research-worker/src/runners/index.ts`:

```typescript
export { runResearchIndustry } from './industry';
export { runResearchCompetitors } from './competitors';
export { runResearchICP } from './icp';
export { runResearchOffer } from './offer';
export { runSynthesizeResearch } from './synthesize';
export { runResearchKeywords } from './keywords';
```

**Step 5: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add research-worker/src/runner.ts research-worker/src/runners/
git commit -m "feat(worker): research runner functions — all 6 tools ported"
```

---

## Task 8: Worker — /run route with async dispatch

**Files:**
- Modify: `research-worker/src/index.ts`

**Step 1: Add the job dispatch logic to index.ts**

Replace the placeholder `/run` handler in `research-worker/src/index.ts` with:

```typescript
import {
  runResearchIndustry,
  runResearchCompetitors,
  runResearchICP,
  runResearchOffer,
  runSynthesizeResearch,
  runResearchKeywords,
} from './runners';
import { writeResearchResult } from './supabase';

// Add after the imports, before the route definitions:

type ToolName =
  | 'researchIndustry'
  | 'researchCompetitors'
  | 'researchICP'
  | 'researchOffer'
  | 'synthesizeResearch'
  | 'researchKeywords';

interface RunJobRequest {
  tool: ToolName;
  context: string;
  userId: string;
  jobId: string;
}

const TOOL_RUNNERS: Record<ToolName, (context: string) => Promise<import('./supabase').ResearchResult>> = {
  researchIndustry: runResearchIndustry,
  researchCompetitors: runResearchCompetitors,
  researchICP: runResearchICP,
  researchOffer: runResearchOffer,
  synthesizeResearch: runSynthesizeResearch,
  researchKeywords: runResearchKeywords,
};

// Replace the existing /run handler:
app.post('/run', requireApiKey, (req: express.Request, res: express.Response) => {
  const { tool, context, userId, jobId } = req.body as RunJobRequest;

  // Validate required fields
  if (!tool || !context || !userId || !jobId) {
    res.status(400).json({ error: 'tool, context, userId, jobId are required' });
    return;
  }

  const runner = TOOL_RUNNERS[tool];
  if (!runner) {
    res.status(400).json({ error: `Unknown tool: ${tool}` });
    return;
  }

  // Return 202 immediately — job runs in background
  res.status(202).json({ status: 'accepted', jobId });

  // Fire-and-forget: run sub-agent, write result to Supabase
  setImmediate(async () => {
    console.log(`[worker] Starting ${tool} for user ${userId} (job ${jobId})`);
    try {
      const result = await runner(context);
      await writeResearchResult(userId, result.section, result);
      console.log(`[worker] Completed ${tool} for user ${userId} in ${result.durationMs}ms`);
    } catch (error) {
      console.error(`[worker] Unhandled error in ${tool}:`, error);
      // Write error result so frontend shows failure card
      await writeResearchResult(userId, tool, {
        status: 'error',
        section: tool,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0,
      });
    }
  });
});
```

**Step 2: Test the /run route locally (without a real sub-agent)**

Start the server and send a test request:

```bash
curl -X POST http://localhost:3001/run \
  -H "Content-Type: application/json" \
  -d '{"tool":"researchIndustry","context":"test","userId":"test-user","jobId":"test-123"}'
```

Expected: `{"status":"accepted","jobId":"test-123"}` within <100ms.

**Step 3: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add research-worker/src/index.ts
git commit -m "feat(worker): /run route with async job dispatch via setImmediate"
```

---

## Task 9: Deploy Railway worker + set env vars

**Files:**
- Create: `research-worker/railway.json`

**Step 1: Add railway.json for build config**

Create `research-worker/railway.json`:

```json
{
  "$schema": "https://schema.railway.app/config-schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

Wait — Railway builds from the Dockerfile. But we need `npm run build` (tsc) to compile TypeScript first. Update the Dockerfile to include the build step:

**Step 2: Update Dockerfile to build TypeScript**

Edit `research-worker/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Step 3: Deploy to Railway**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main/research-worker
railway up --service research-worker
```

Expected: Build starts, logs appear. Wait for "Deploy succeeded". Railway gives you a public URL like `https://research-worker-production.up.railway.app`.

If prompted to select a service, create a new one named `research-worker`.

**Step 4: Set environment variables in Railway**

Go to Railway dashboard → `aigos-research-worker` project → `research-worker` service → Variables tab. Add:

```
ANTHROPIC_API_KEY=<copy from Vercel or .env.local>
SUPABASE_URL=<copy from Vercel — NEXT_PUBLIC_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API → service_role key>
RAILWAY_API_KEY=<generate: openssl rand -hex 32>
SEARCHAPI_KEY=<copy from Vercel>
FIRECRAWL_API_KEY=<copy from Vercel>
SPYFU_API_KEY=<copy from Vercel>
FOREPLAY_API_KEY=<copy from Vercel>
PORT=3001
```

Railway auto-redeploys after env var changes.

**Step 5: Smoke test the deployed service**

```bash
curl https://YOUR_RAILWAY_URL.railway.app/health
```

Expected: `{"status":"ok","ts":"2026-..."}`

```bash
curl -X POST https://YOUR_RAILWAY_URL.railway.app/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_RAILWAY_API_KEY" \
  -d '{"tool":"researchIndustry","context":"B2B SaaS, DevTools","userId":"smoke-test-user","jobId":"smoke-001"}'
```

Expected: `{"status":"accepted","jobId":"smoke-001"}` within 500ms.

**Step 6: Add env vars to Vercel**

In Vercel dashboard → AI-GOS project → Settings → Environment Variables. Add:

```
RAILWAY_WORKER_URL=https://YOUR_RAILWAY_URL.railway.app
RAILWAY_API_KEY=<same key as set in Railway>
```

Also add to `.env.local` for local dev:
```
RAILWAY_WORKER_URL=http://localhost:3001
RAILWAY_API_KEY=dev-key-not-validated-in-dev
```

**Step 7: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add research-worker/railway.json research-worker/Dockerfile
git commit -m "feat(worker): Railway config + multi-stage Dockerfile"
```

---

## Task 10: Vercel — swap all 6 research tool execute() to fire-and-forget

**Files:**
- Modify: `src/lib/ai/tools/research/research-industry.ts`
- Modify: `src/lib/ai/tools/research/research-competitors.ts`
- Modify: `src/lib/ai/tools/research/research-icp.ts`
- Modify: `src/lib/ai/tools/research/research-offer.ts`
- Modify: `src/lib/ai/tools/research/synthesize-research.ts`
- Modify: `src/lib/ai/tools/research/research-keywords.ts`

**Step 1: Create a shared dispatch helper**

Create `src/lib/ai/tools/research/dispatch.ts`:

```typescript
// Dispatch a research job to the Railway worker.
// Returns immediately (fire-and-forget from the lead agent's perspective).

import { auth } from '@clerk/nextjs/server';

export interface DispatchResult {
  status: 'queued' | 'error';
  section: string;
  jobId?: string;
  error?: string;
}

export async function dispatchResearch(
  tool: string,
  section: string,
  context: string,
): Promise<DispatchResult> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', section, error: 'Unauthorized' };
  }

  const workerUrl = process.env.RAILWAY_WORKER_URL;
  const apiKey = process.env.RAILWAY_API_KEY;

  if (!workerUrl) {
    console.error('[dispatch] RAILWAY_WORKER_URL not configured');
    return { status: 'error', section, error: 'Research worker not configured' };
  }

  const jobId = crypto.randomUUID();

  try {
    const res = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ tool, context, userId, jobId }),
      signal: AbortSignal.timeout(5000), // 5s to dispatch — not to complete
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[dispatch] Worker rejected ${tool}: ${res.status} ${body}`);
      return { status: 'error', section, error: `Worker error: ${res.status}` };
    }

    return { status: 'queued', section, jobId };
  } catch (error) {
    console.error(`[dispatch] Failed to reach worker for ${tool}:`, error);
    return { status: 'error', section, error: error instanceof Error ? error.message : String(error) };
  }
}
```

**Step 2: Update research-industry.ts**

Replace the entire `execute` function body:

```typescript
// At top of file, replace the runner import with:
import { dispatchResearch } from './dispatch';

// Replace execute: async ({ context }) => { ... } with:
execute: async ({ context }) => {
  return dispatchResearch('researchIndustry', 'industryMarket', context);
},
```

The `tool()` wrapper, description, and inputSchema stay unchanged. Only `execute` changes.

**Step 3: Update the remaining 5 research tools**

Apply the same pattern to each file:

| File | tool arg | section arg |
|------|----------|-------------|
| `research-competitors.ts` | `'researchCompetitors'` | `'competitors'` |
| `research-icp.ts` | `'researchICP'` | `'icpValidation'` |
| `research-offer.ts` | `'researchOffer'` | `'offerAnalysis'` |
| `synthesize-research.ts` | `'synthesizeResearch'` | `'crossAnalysis'` |
| `research-keywords.ts` | `'researchKeywords'` | `'keywords'` |

In each file: remove all Anthropic SDK imports, remove system prompts, add `import { dispatchResearch } from './dispatch'`, replace the execute body.

**Step 4: Run the TypeScript build to verify no errors**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
npm run build
```

Expected: Build completes with 0 errors. Fix any type errors (usually leftover imports).

**Step 5: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add src/lib/ai/tools/research/
git commit -m "feat: swap research tool execute() to fire-and-forget Railway dispatch"
```

---

## Task 11: Lead agent system prompt — handle 'queued' status

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`

**Step 1: Update the system prompt**

In `src/lib/ai/prompts/lead-agent-system.ts`, find the `## Progressive Research` section (around line 175). Add this paragraph at the end of the `### Rules` list:

```
- When a research tool returns `{ status: 'queued' }`, treat it as success. The research is running in the background — results will appear in the chat on their own. Acknowledge briefly in one sentence ("Research is running — I'll surface findings as they come in") then immediately continue the conversation with the next question. Do NOT wait or ask the user to wait. Do NOT say "I'm waiting for results".
- When a research tool returns `{ status: 'error' }`, tell the user briefly ("Research hit a snag on this section — I'll continue with what I have") and proceed with onboarding.
```

Also update the `### Completion Flow` trigger condition (line ~167). Change:

```
When all 8 required fields have been collected AND all 5 research sections have completed:
```

To:

```
When all 8 required fields have been collected AND all research tools have been called (status queued or complete — do not wait for actual results):
```

**Step 2: Verify the prompt reads naturally**

Read `LEAD_AGENT_SYSTEM_PROMPT` top to bottom. Ensure the new instructions don't conflict with existing ones.

**Step 3: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "feat: system prompt — handle queued research status, don't block on results"
```

---

## Task 12: Frontend — Supabase Realtime subscription

**Files:**
- Modify: `src/app/journey/page.tsx`
- Create: `src/lib/journey/research-realtime.ts`

**Step 1: Create the Realtime hook**

Create `src/lib/journey/research-realtime.ts`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export interface ResearchSectionResult {
  status: 'complete' | 'error';
  section: string;
  data?: unknown;
  error?: string;
  durationMs: number;
}

interface UseResearchRealtimeOptions {
  userId: string | null | undefined;
  onSectionComplete: (section: string, result: ResearchSectionResult) => void;
}

/**
 * Subscribe to Supabase Realtime for research results.
 * Calls onSectionComplete whenever a new section arrives in journey_sessions.research_results.
 */
export function useResearchRealtime({ userId, onSectionComplete }: UseResearchRealtimeOptions) {
  const seenSections = useRef<Set<string>>(new Set());
  const onSectionCompleteRef = useRef(onSectionComplete);
  onSectionCompleteRef.current = onSectionComplete;

  useEffect(() => {
    if (!userId) return;

    const supabase = createBrowserClient();

    // On mount, check for already-completed sections (page refresh case)
    supabase
      .from('journey_sessions')
      .select('research_results')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data?.research_results) return;
        const results = data.research_results as Record<string, ResearchSectionResult>;
        for (const [section, result] of Object.entries(results)) {
          if (!seenSections.current.has(section)) {
            seenSections.current.add(section);
            onSectionCompleteRef.current(section, result);
          }
        }
      });

    // Subscribe to future changes
    const channel = supabase
      .channel(`research-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'journey_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const results = (payload.new as Record<string, unknown>).research_results as Record<string, ResearchSectionResult> | null;
          if (!results) return;

          for (const [section, result] of Object.entries(results)) {
            if (!seenSections.current.has(section)) {
              seenSections.current.add(section);
              onSectionCompleteRef.current(section, result);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
```

**Step 2: Wire the hook into journey/page.tsx**

In `src/app/journey/page.tsx`, inside `JourneyPageContent`:

```typescript
// Add import at top:
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import { useUser } from '@clerk/nextjs';

// Inside JourneyPageContent(), after the useChat hook:
const { user } = useUser();

useResearchRealtime({
  userId: user?.id,
  onSectionComplete: (section, result) => {
    // Append a synthetic assistant message that renders as a ResearchInlineCard
    // The message format matches what chat-message.tsx expects for research tool parts
    const syntheticMessage = {
      id: `realtime-${section}-${Date.now()}`,
      role: 'assistant' as const,
      content: '',
      parts: [
        {
          type: `tool-researchIndustry`, // ResearchInlineCard checks for tool-research* prefix
          toolName: sectionToToolName(section),
          state: 'output-available' as const,
          output: JSON.stringify(result),
        },
      ],
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, syntheticMessage]);
  },
});
```

Add the helper function (outside the component):

```typescript
function sectionToToolName(section: string): string {
  const map: Record<string, string> = {
    industryMarket: 'researchIndustry',
    competitors: 'researchCompetitors',
    icpValidation: 'researchICP',
    offerAnalysis: 'researchOffer',
    crossAnalysis: 'synthesizeResearch',
    keywords: 'researchKeywords',
  };
  return map[section] ?? section;
}
```

**Step 3: Check chat-message.tsx to confirm the synthetic message format**

Open `src/components/journey/chat-message.tsx` and find how it renders research tool parts. Verify the `type` prefix, `state`, and `output` field names match what you set in the synthetic message above. Adjust if the real format differs.

**Step 4: Build and test**

```bash
npm run build
```

Expected: 0 errors.

**Step 5: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add src/lib/journey/research-realtime.ts src/app/journey/page.tsx
git commit -m "feat: Supabase Realtime subscription — render research cards as they arrive"
```

---

## Task 13: Synthesis trigger — auto-detect when all 4 sections complete

**Files:**
- Modify: `src/lib/journey/research-realtime.ts`

**Background:** `synthesizeResearch` needs all 4 prior sections complete before it fires. With async research, completion is detected in the frontend (Realtime events). When all 4 arrive, we trigger synthesis by sending a chat message.

**Step 1: Add synthesis auto-trigger to research-realtime.ts**

In `src/lib/journey/research-realtime.ts`, update `UseResearchRealtimeOptions`:

```typescript
interface UseResearchRealtimeOptions {
  userId: string | null | undefined;
  onSectionComplete: (section: string, result: ResearchSectionResult) => void;
  onAllSectionsComplete?: (allResults: Record<string, ResearchSectionResult>) => void;
}
```

Add to the `useResearchRealtime` hook logic — after calling `onSectionCompleteRef.current`:

```typescript
const SYNTHESIS_PREREQUISITES = new Set(['industryMarket', 'competitors', 'icpValidation', 'offerAnalysis']);

// After: onSectionCompleteRef.current(section, result);
// Check if all 4 prerequisites are now complete
const allResults = { ...seenResults.current, [section]: result }; // need a seenResults ref too
seenResults.current = allResults;

const completedPrereqs = [...SYNTHESIS_PREREQUISITES].filter(
  (s) => allResults[s]?.status === 'complete'
);

if (completedPrereqs.length === SYNTHESIS_PREREQUISITES.size && !synthesisTriggered.current) {
  synthesisTriggered.current = true;
  onAllSectionsCompleteRef.current?.(allResults);
}
```

Add the missing refs at the top of the hook:

```typescript
const seenResults = useRef<Record<string, ResearchSectionResult>>({});
const synthesisTriggered = useRef(false);
const onAllSectionsCompleteRef = useRef(onSectionCompleteOptions.onAllSectionsComplete);
onAllSectionsCompleteRef.current = onSectionCompleteOptions.onAllSectionsComplete;
```

**Step 2: Use the callback in journey/page.tsx**

In `journey/page.tsx`, add the `onAllSectionsComplete` callback to `useResearchRealtime`:

```typescript
useResearchRealtime({
  userId: user?.id,
  onSectionComplete: (section, result) => { /* existing logic */ },
  onAllSectionsComplete: (allResults) => {
    // Build synthesis context from all 4 results
    const synthesisContext = JSON.stringify(allResults, null, 2);
    // Send a system message that triggers the lead agent to call synthesizeResearch
    sendMessage({
      role: 'user',
      content: `[SYSTEM] All 4 research sections complete. Please synthesize the research now. Here are the results:\n\n${synthesisContext}`,
    });
  },
});
```

Note: The system prompt already instructs the lead agent to call `synthesizeResearch` when all prerequisites are complete. This message gives it the data it needs.

**Step 3: Build and verify no errors**

```bash
npm run build
```

**Step 4: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add src/lib/journey/research-realtime.ts src/app/journey/page.tsx
git commit -m "feat: auto-trigger synthesis when all 4 research sections arrive via Realtime"
```

---

## Task 14: E2E validation

**Step 1: Start the Railway worker locally for testing**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main/research-worker
cp .env.example .env
# Fill in .env with real keys (copy from .env.local in the main project)
npx ts-node-dev --transpile-only src/index.ts
```

Expected: `[worker] Research worker listening on :3001`

**Step 2: Start the Next.js dev server**

In a separate terminal:
```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
npm run dev
```

**Step 3: Run a full journey test**

1. Open http://localhost:3000/journey
2. Answer the first question (business model)
3. Answer the industry question
4. Watch: lead agent should say something like "Research is running — let's keep going" and immediately ask the next question (no 60s freeze)
5. Continue answering questions — the conversation should flow freely
6. Watch the right panel: research cards should appear asynchronously as each sub-agent completes (approximately 60-120s after each tool is triggered)
7. After all 4 sections appear, synthesis should auto-trigger
8. Synthesis result card should appear ~60-90s later

**Expected timeline:**
- Conversation: flows freely, no blocking
- Industry card: appears ~60-120s after industry question answered
- Competitors card: appears ~60-120s after dispatched
- ICP + Offer cards: similar timing
- Synthesis card: appears ~90s after all 4 complete
- Total wall-clock time with user talking: similar to before, but none of it is blocked

**Step 4: Check Supabase for written results**

In Supabase Table Editor → journey_sessions → find your test row → inspect `research_results` column. Should contain JSON for each completed section.

**Step 5: Tag and commit if all E2E checks pass**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main
git add .
git commit -m "fix: async research complete — journey flows freely, research cards push via Realtime"
```

---

## Summary

| Task | What it builds | Est. time |
|------|---------------|-----------|
| 1 | Railway CLI + project link | 5 min |
| 2 | Supabase migration (column + Realtime) | 5 min |
| 3 | Worker scaffold (package.json, tsconfig, Dockerfile) | 10 min |
| 4 | Worker Express server + /health | 5 min |
| 5 | Worker Supabase write helper | 5 min |
| 6 | Worker MCP tools | 15 min |
| 7 | Worker research runners (port 6 tools) | 20 min |
| 8 | Worker /run route with async dispatch | 10 min |
| 9 | Railway deploy + env vars | 10 min |
| 10 | Vercel tool shims (6 execute() swaps) | 10 min |
| 11 | System prompt update | 5 min |
| 12 | Frontend Realtime subscription | 15 min |
| 13 | Synthesis auto-trigger | 10 min |
| 14 | E2E validation | 20 min |

**Total: ~2.5 hours of focused implementation**
