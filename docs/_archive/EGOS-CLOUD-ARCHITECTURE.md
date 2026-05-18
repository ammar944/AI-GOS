# EGOS Cloud Architecture
> The complete system architecture for EGOS as a multi-tenant agency tool

## Overview

EGOS is a cloud-hosted AI marketing platform. Clients and team members access it via web browser. All AI execution happens server-side via OpenClaw + Claude Code.

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                        │
│  EGOS Web App (Next.js on Vercel)                       │
│  - Auth (Supabase)                                      │
│  - Chat UI (journey + sections)                         │
│  - Dashboard (analytics, content, campaigns)            │
│  - Team management                                      │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / SSE
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   CLOUD VPS                              │
│  (DigitalOcean / Hetzner / Railway)                     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ OpenClaw Gateway (port 18789)                    │    │
│  │ - Agent routing                                  │    │
│  │ - Session management                             │    │
│  │ - Tool execution                                 │    │
│  │ - Agent-to-agent communication                   │    │
│  └──────────┬──────────────────────────────────────┘    │
│             │                                            │
│  ┌──────────▼──────────────────────────────────────┐    │
│  │ Claude Code (ACP sessions)                       │    │
│  │ - Spawned per section/command                    │    │
│  │ - Reads engine workspace                         │    │
│  │ - Writes to client output folder                 │    │
│  │ - Max 4 concurrent sessions                      │    │
│  └──────────┬──────────────────────────────────────┘    │
│             │                                            │
│  ┌──────────▼──────────────────────────────────────┐    │
│  │ Engine Workspace (/engine/)                      │    │
│  │ ├── CLAUDE.md (commander)                        │    │
│  │ ├── agents/ (8 agent definitions)                │    │
│  │ ├── commands/ (16 section commands)              │    │
│  │ ├── scripts/ (Python utilities)                  │    │
│  │ └── skills/ (skill registry)                     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Client Data (/clients/)                          │    │
│  │ ├── techflow/                                    │    │
│  │ │   ├── context.md (onboarding data)             │    │
│  │ │   ├── output/ (generated sections)             │    │
│  │ │   └── STATUS.md (progress tracker)             │    │
│  │ ├── acme-corp/                                   │    │
│  │ └── ...per client                                │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ MCP Servers                                      │    │
│  │ - Firecrawl (web scraping)                       │    │
│  │ - SpyFu (keyword/ad data)                        │    │
│  │ - Ad Library (Meta/Google ad creatives)           │    │
│  │ - PageSpeed (site performance)                   │    │
│  │ - GA4 (analytics)                                │    │
│  │ - GSC (search console)                           │    │
│  │ - WordPress (content publishing)                 │    │
│  │ - DataForSEO (SEO data)                          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   SUPABASE                               │
│  - Auth (team members + optional client access)         │
│  - Database (clients, journeys, sections, content)      │
│  - Storage (assets, exports, PDFs)                      │
│  - Realtime (live progress updates)                     │
└─────────────────────────────────────────────────────────┘
```

## Context Management Strategy

### Problem
Claude Code has a 200K token context window. If we load everything for every call, we burn tokens and get worse output.

### Solution: Scoped Sessions
Each operation spawns a FRESH Claude Code session with ONLY the context it needs:

| Operation | Context Loaded | Est. Tokens |
|-----------|---------------|-------------|
| Onboarding chat | CLAUDE.md + onboard.md | ~5K |
| Section 1: Industry | CLAUDE.md + researcher.md + research-industry.md + context/{client}.md | ~12K |
| Section 3: Competitors | CLAUDE.md + strategist.md + research-competitors.md + context/{client}.md | ~12K |
| Section 8: Google Ads | CLAUDE.md + ad-architect.md + media-plan-google.md + context/{client}.md + output/{client}/06-synthesis.md | ~18K |
| Content production | CLAUDE.md + content-engine.md + context/{client}.md + relevant section outputs | ~20K |

### Key Principle
Media plan sections (7-16) ALSO read the synthesis from research (section 6). This is the bridge — research informs strategy. But we only load the synthesis, not all 6 research sections.

### Session Lifecycle
```
1. Client sends message in chat
2. API identifies intent (onboarding? section request? question?)
3. If section: spawn ACP session with scoped context
4. Claude Code reads context → runs command → writes output
5. Stream progress back to UI via SSE
6. Session terminates when section complete
7. Update STATUS.md + Supabase
```

## Database Schema (Supabase)

### teams
```sql
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'starter', -- starter, growth, agency
  created_at timestamptz default now()
);
```

### team_members
```sql
create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member', -- admin, strategist, viewer
  created_at timestamptz default now(),
  unique(team_id, user_id)
);
```

### clients
```sql
create table clients (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  slug text not null,
  industry text,
  website text,
  stage text, -- startup, growth, enterprise
  arr numeric,
  employees integer,
  onboarding_data jsonb default '{}', -- all 40 onboarding fields
  status text default 'onboarding', -- onboarding, active, paused, archived
  created_at timestamptz default now(),
  unique(team_id, slug)
);
```

### journeys
```sql
create table journeys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  type text not null default 'full', -- full, research-only, media-plan-only
  status text default 'in_progress', -- in_progress, completed, failed
  current_section integer default 0,
  total_sections integer default 16,
  started_at timestamptz default now(),
  completed_at timestamptz,
  metadata jsonb default '{}'
);
```

### sections
```sql
create table sections (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid references journeys(id) on delete cascade,
  number integer not null, -- 1-16
  title text not null,
  agent text not null, -- RESEARCHER, INTEL, STRATEGIST, etc.
  status text default 'pending', -- pending, generating, completed, failed
  content text, -- full markdown output
  data_sources jsonb default '[]', -- [{mcp: "spyfu", query: "...", results: N}]
  tokens_used integer default 0,
  duration_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  unique(journey_id, number)
);
```

### content_items
```sql
create table content_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  type text not null, -- blog, social, email, ad_copy, landing_page
  title text,
  content text,
  status text default 'draft', -- draft, scheduled, published
  scheduled_at timestamptz,
  published_at timestamptz,
  platform text, -- website, linkedin, twitter, meta, google
  metadata jsonb default '{}'
);
```

### campaigns
```sql
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  platform text not null, -- google, meta, linkedin
  name text not null,
  status text default 'draft', -- draft, active, paused, completed
  budget_daily numeric,
  budget_total numeric,
  performance jsonb default '{}', -- {impressions, clicks, conversions, cpl, cac}
  created_at timestamptz default now()
);
```

### assets
```sql
create table assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  type text not null, -- logo, brand_guide, sales_deck, case_study, screenshot
  name text not null,
  url text not null, -- Supabase storage URL
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
```

## API Routes

### Authentication
- `POST /api/auth/signup` — team signup (Supabase Auth)
- `POST /api/auth/login` — login
- `GET /api/auth/me` — current user + team + role

### Clients
- `GET /api/clients` — list clients for team
- `POST /api/clients` — create new client
- `GET /api/clients/[slug]` — client detail
- `PATCH /api/clients/[slug]` — update client

### Journey
- `POST /api/journey/start` — start new journey for client
- `POST /api/journey/chat` — send message, get streamed response (SSE)
- `GET /api/journey/[id]/status` — journey progress
- `GET /api/journey/[id]/sections` — all sections with content
- `POST /api/journey/[id]/section/[num]/regenerate` — redo a section

### Content
- `GET /api/content/[clientSlug]` — content calendar
- `POST /api/content/generate` — generate content piece
- `PATCH /api/content/[id]` — edit/schedule/publish

### Campaigns
- `GET /api/campaigns/[clientSlug]` — client campaigns
- `POST /api/campaigns/create` — create campaign blueprint
- `GET /api/campaigns/[id]/performance` — pull live metrics

## Cloud Deployment

### Option A: Single VPS (Recommended for launch)
- Hetzner CX32 (4 vCPU, 8GB RAM) — ~$15/mo
- OpenClaw + Claude Code + MCPs all on one box
- EGOS Next.js on Vercel (free tier)
- Supabase (free tier to start)

### Option B: Railway (Easier, more expensive)
- Railway handles deployment + scaling
- ~$20-50/mo depending on usage

### Option C: DigitalOcean App Platform
- Managed containers
- Easy scaling
- ~$25/mo

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://qpbjckuphrfjupqrtiai.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# OpenClaw Gateway (on VPS)
GATEWAY_URL=https://your-vps.com:18789
GATEWAY_TOKEN=...

# Anthropic (for Claude Code)
ANTHROPIC_API_KEY=...

# MCP API Keys
FIRECRAWL_API_KEY=...
SPYFU_API_KEY=...
PAGESPEED_API_KEY=...
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
```

## Security

- All client data in Supabase with RLS (Row Level Security)
- Team members can only see their team's clients
- Gateway behind auth proxy on VPS
- MCP API keys stored as environment variables, never in code
- Client context files encrypted at rest on VPS
- HTTPS everywhere

## Cost Model Per Client Journey

| Component | Cost |
|-----------|------|
| Claude Opus 4.6 (16 sections × ~15K tokens each) | ~$3.50 |
| Prompt caching (repeat context) | -60% = ~$1.40 |
| MCP API calls (Firecrawl, SpyFu, etc.) | ~$2.00 |
| Supabase (storage + DB) | ~$0.01 |
| VPS (amortized per journey) | ~$0.50 |
| **Total per journey** | **~$4.00** |

At $500/client for the initial strategy, that's 99.2% margin on the AI work.
