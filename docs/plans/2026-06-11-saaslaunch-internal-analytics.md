# Active Plan: SaaSLaunch Internal Landing Analytics

## Scope

Implement SaaSLaunch landing-page analytics inside AI-GOS, not inside the prototype repository.

Primary AI-GOS surfaces:

- `/internal/saaslaunch`
- `/internal/saaslaunch/clients/[slug]`
- `/api/landing-events`
- `public/sl-analytics.v1.js`

## Grounding

Verified on 2026-06-11 with `vercel project ls --scope saaslaunch`:

- `ai-gos` -> `https://aigos.saaslaunch.com`
- `anura-landing-claude` -> `https://try.anura.io`
- `fox-ai` -> `https://www.usefox.ai`
- `zuppler-thank-you-page` -> `https://zuppler-thank-you-page.vercel.app`

Verified production deployments are Ready with `vercel inspect` for Anura, Fox AI, and Zuppler. NexOne is present in the SaaSLaunch corpus, but not confirmed as a deployed project in the current `saaslaunch` Vercel inventory.

## Implementation Sequence

1. Add append-only Supabase migration for internal agency analytics tables:
   - `agency_clients`
   - `agency_client_sites`
   - `landing_event_definitions`
   - `landing_event_property_definitions`
   - `landing_events`
   - `landing_event_rejections`
2. Add `src/lib/saaslaunch/*` schemas and helpers:
   - registry-driven ingest validation
   - URL/referrer sanitization
   - origin allowlist enforcement
   - key-level and value-level PII rejection
   - dashboard read helpers for internal pages
3. Add `POST /api/landing-events` with structured rejection persistence.
4. Port the tracker as a browser-served static file that:
   - requires `data-client`, `data-site`, and `data-endpoint`
   - respects Do Not Track
   - uses anonymous sessionStorage only
   - never reads form values
   - strips non-UTM query params
5. Add internal pages under `/internal/saaslaunch`:
   - client/site inventory
   - client detail with active sites, install snippet, event registry, recent events, and rejections
6. Add sidebar navigation item for internal users.
7. Add focused tests for payload validation and API acceptance/rejection.
8. Verify with scoped tests, lint, and build where practical.

## First Seed

Seed only the current Vercel-confirmed landing pages:

- Anura / `try.anura.io`
- Fox AI / `www.usefox.ai`, `usefox.ai`
- Zuppler thank-you page / `zuppler-thank-you-page.vercel.app`

Keep AI-GOS itself out of agency client inventory. Keep NexOne as corpus evidence only until deployment ownership is verified.

## Proof Limits

Do not claim live tracking until a live landing page loads the AI-GOS tracker, posts to `/api/landing-events`, the API accepts the event, and the row appears in Supabase. Static script presence is not enough.
