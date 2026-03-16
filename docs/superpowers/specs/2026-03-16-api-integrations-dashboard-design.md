# API Integrations Dashboard — Design Spec

## Purpose

A dashboard page at `/dashboard/integrations` that shows the health and configuration status of all 14 external API integrations in AI-GOS. Lets the user see at a glance which services are configured, reachable, and how fast they respond.

## Data Model

```ts
interface IntegrationStatus {
  name: string;           // e.g. "Anthropic Claude"
  slug: string;           // e.g. "anthropic"
  tier: 'required' | 'research' | 'paid-media' | 'enrichment';
  purpose: string;        // one-liner description
  configured: boolean;    // all required env vars present
  reachable: boolean | null;  // null = skipped (unconfigured)
  latencyMs: number | null;
  envVars: { key: string; set: boolean }[];  // no values exposed
}

interface IntegrationsHealthResponse {
  status: 'all-healthy' | 'degraded' | 'critical';
  timestamp: string;
  integrations: IntegrationStatus[];
}
```

## Backend: `/api/integrations/health`

**Route**: `src/app/api/integrations/health/route.ts`

Server-only GET route (requires Clerk auth). For each of the 14 services:

1. Check env var presence (never expose values)
2. If configured, run a lightweight probe:
   - **Anthropic**: `GET https://api.anthropic.com/v1/models` with API key header (or just check env)
   - **Supabase**: simple query via client (`select count from journey_sessions limit 1`)
   - **Clerk**: env check only (SDK handles auth)
   - **Railway Worker**: `GET {RAILWAY_WORKER_URL}/health`
   - **Perplexity**: env check only (no health endpoint)
   - **SearchAPI**: env check only
   - **Firecrawl**: env check only
   - **SpyFu**: env check only
   - **Google Ads**: env check only (OAuth2 complexity)
   - **Meta Marketing**: env check only
   - **GA4**: env check only
   - **PageSpeed**: `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&strategy=mobile` (public, no key)
   - **AntV Chart**: env check only (internal)
   - **Foreplay**: env check + feature flag check

3. Measure latency for probed services
4. Return `IntegrationsHealthResponse`

**Integration registry**: `src/lib/integrations/registry.ts` — static metadata for all 14 services (name, slug, tier, purpose, required env vars). Single source of truth.

**Probe logic**: `src/lib/integrations/probes.ts` — per-service probe functions. Each returns `{ reachable: boolean; latencyMs: number }`. Timeout: 5s per probe. All probes run with `Promise.allSettled` for parallel execution.

## Frontend: `/dashboard/integrations`

**Page**: `src/app/dashboard/integrations/page.tsx` — server component with auth check, reuses dashboard layout pattern (header, `DashboardBackground`).

**Client component**: `src/app/dashboard/integrations/_components/integrations-dashboard.tsx`
- Fetches `/api/integrations/health` on mount
- Refresh button to re-fetch
- Groups cards by tier with section headers

**Card component**: `src/app/dashboard/integrations/_components/integration-card.tsx`
- Service name + purpose
- Status badge: green (configured + reachable), yellow (configured, not probed), red (unconfigured)
- Latency display when available
- Expandable env var list (set/missing indicators, no values)

**Navigation**: Add "Integrations" link to dashboard header.

## Tiers & Grouping

| Tier | Label | Services |
|------|-------|----------|
| required | Core Infrastructure | Anthropic, Supabase, Clerk, Railway Worker |
| research | Research Pipeline | Perplexity, SearchAPI, Firecrawl, SpyFu |
| paid-media | Paid Media Data | Google Ads, Meta Marketing, GA4 |
| enrichment | Enrichment & Utilities | PageSpeed, AntV Chart, Foreplay |

## Security

- Route requires Clerk auth (same pattern as other API routes)
- No env var values exposed — only `set: boolean`
- No secrets in response body
- Server-side only probes (no client-side API calls to third parties)

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/integrations/registry.ts` | Service metadata registry (14 entries) |
| `src/lib/integrations/probes.ts` | Connectivity probe functions |
| `src/app/api/integrations/health/route.ts` | Health check API route |
| `src/app/dashboard/integrations/page.tsx` | Dashboard page (server component) |
| `src/app/dashboard/integrations/_components/integrations-dashboard.tsx` | Client dashboard component |
| `src/app/dashboard/integrations/_components/integration-card.tsx` | Individual card component |

## Testing

- `src/lib/integrations/__tests__/registry.test.ts` — registry has all 14 services, correct env var mappings
- `src/lib/integrations/__tests__/probes.test.ts` — probe timeout handling, error cases

## Out of Scope

- Usage/cost tracking per API
- Historical uptime data
- Webhook/notification on status change
- API key management UI
