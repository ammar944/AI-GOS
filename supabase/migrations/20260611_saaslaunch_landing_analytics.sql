-- Internal SaaSLaunch landing-page analytics.
-- This schema is intentionally separate from user_profiles/client app accounts.

create extension if not exists pgcrypto;

create table if not exists public.agency_clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  notes text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_client_sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  display_name text not null,
  page_purpose text not null,
  live_url text not null check (live_url ~ '^https?://'),
  vercel_project_name text,
  vercel_project_id text,
  vercel_scope text not null default 'saaslaunch',
  allowed_origins text[] not null default '{}',
  tracker_status text not null default 'planned' check (tracker_status in ('planned', 'installed', 'verified', 'disabled', 'error')),
  tracker_last_seen_at timestamptz,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, slug)
);

create table if not exists public.landing_event_definitions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.agency_client_sites(id) on delete cascade,
  event_key text not null check (event_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  display_name text not null,
  category text not null check (category in ('page', 'engagement', 'form', 'booking', 'video', 'conversion', 'debug')),
  is_conversion boolean not null default false,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, event_key)
);

create table if not exists public.landing_event_property_definitions (
  id uuid primary key default gen_random_uuid(),
  event_definition_id uuid not null references public.landing_event_definitions(id) on delete cascade,
  property_key text not null check (property_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  property_type text not null check (property_type in ('string', 'number', 'boolean', 'enum', 'url', 'path')),
  is_required boolean not null default false,
  enum_values text[] not null default '{}',
  max_length integer not null default 200 check (max_length between 1 and 1000),
  is_filterable boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_definition_id, property_key)
);

create table if not exists public.landing_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete restrict,
  site_id uuid not null references public.agency_client_sites(id) on delete restrict,
  event_definition_id uuid not null references public.landing_event_definitions(id) on delete restrict,
  event_key text not null,
  occurred_at timestamptz not null,
  anonymous_session_id text not null check (length(anonymous_session_id) between 8 and 128),
  page_url text not null check (page_url ~ '^https?://'),
  path text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  device_type text not null,
  browser text not null,
  properties jsonb not null default '{}'::jsonb,
  origin text,
  user_agent text,
  inserted_at timestamptz not null default now()
);

create table if not exists public.landing_event_rejections (
  id uuid primary key default gen_random_uuid(),
  client_slug text,
  site_slug text,
  event_key text,
  origin text,
  reason text not null,
  payload_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agency_client_sites_client
  on public.agency_client_sites (client_id);

create index if not exists idx_landing_event_definitions_site
  on public.landing_event_definitions (site_id, event_key);

create index if not exists idx_landing_events_site_occurred
  on public.landing_events (site_id, occurred_at desc);

create index if not exists idx_landing_events_client_occurred
  on public.landing_events (client_id, occurred_at desc);

create index if not exists idx_landing_events_event_key_occurred
  on public.landing_events (event_key, occurred_at desc);

create index if not exists idx_landing_events_session
  on public.landing_events (site_id, anonymous_session_id);

create index if not exists idx_landing_event_rejections_created
  on public.landing_event_rejections (created_at desc);

alter table public.agency_clients enable row level security;
alter table public.agency_client_sites enable row level security;
alter table public.landing_event_definitions enable row level security;
alter table public.landing_event_property_definitions enable row level security;
alter table public.landing_events enable row level security;
alter table public.landing_event_rejections enable row level security;

drop policy if exists "internal users select agency clients" on public.agency_clients;
create policy "internal users select agency clients"
  on public.agency_clients
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

drop policy if exists "internal users select agency client sites" on public.agency_client_sites;
create policy "internal users select agency client sites"
  on public.agency_client_sites
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

drop policy if exists "internal users select landing event definitions" on public.landing_event_definitions;
create policy "internal users select landing event definitions"
  on public.landing_event_definitions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

drop policy if exists "internal users select landing property definitions" on public.landing_event_property_definitions;
create policy "internal users select landing property definitions"
  on public.landing_event_property_definitions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

drop policy if exists "internal users select landing events" on public.landing_events;
create policy "internal users select landing events"
  on public.landing_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

drop policy if exists "internal users select landing event rejections" on public.landing_event_rejections;
create policy "internal users select landing event rejections"
  on public.landing_event_rejections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

grant select on public.agency_clients to authenticated, service_role;
grant select on public.agency_client_sites to authenticated, service_role;
grant select on public.landing_event_definitions to authenticated, service_role;
grant select on public.landing_event_property_definitions to authenticated, service_role;
grant select on public.landing_events to authenticated, service_role;
grant select on public.landing_event_rejections to authenticated, service_role;

grant insert, update, delete on public.agency_clients to service_role;
grant insert, update, delete on public.agency_client_sites to service_role;
grant insert, update, delete on public.landing_event_definitions to service_role;
grant insert, update, delete on public.landing_event_property_definitions to service_role;
grant insert, update, delete on public.landing_events to service_role;
grant insert, update, delete on public.landing_event_rejections to service_role;

insert into public.agency_clients (slug, display_name, status, source_metadata)
values
  ('anura', 'Anura', 'active', '{"corpusClientId":"anura","corpusPath":"/Users/ammar/Dev-Projects/saaslaunch/corpus/clients/anura.json"}'::jsonb),
  ('fox-ai', 'Fox AI', 'active', '{"corpusClientId":"foxai","corpusPath":"/Users/ammar/Dev-Projects/saaslaunch/corpus/clients/foxai.json"}'::jsonb),
  ('zuppler', 'Zuppler', 'active', '{"corpusClientId":"zuppler","corpusPath":"/Users/ammar/Dev-Projects/saaslaunch/corpus/clients/zuppler.json"}'::jsonb)
on conflict (slug) do update
set display_name = excluded.display_name,
    status = excluded.status,
    source_metadata = excluded.source_metadata,
    updated_at = now();

insert into public.agency_client_sites (
  client_id,
  slug,
  display_name,
  page_purpose,
  live_url,
  vercel_project_name,
  vercel_project_id,
  allowed_origins,
  tracker_status,
  source_metadata
)
select
  c.id,
  s.slug,
  s.display_name,
  s.page_purpose,
  s.live_url,
  s.vercel_project_name,
  s.vercel_project_id,
  s.allowed_origins,
  'planned',
  s.source_metadata
from (
  values
    (
      'anura',
      'try-anura',
      'Try Anura',
      'Traffic-quality audit lead capture',
      'https://try.anura.io',
      'anura-landing-claude',
      'dpl_3Tp9ca8zeRLEeU7ribqQeLzdmYjq',
      array['https://try.anura.io', 'https://anura-landing-claude.vercel.app', 'https://anura-landing-claude-saaslaunch.vercel.app'],
      '{"vercelScope":"saaslaunch","verifiedAt":"2026-06-11","deploymentStatus":"Ready"}'::jsonb
    ),
    (
      'fox-ai',
      'usefox-ai',
      'UseFox AI',
      'SEO and product-growth strategy-call booking',
      'https://www.usefox.ai',
      'fox-ai',
      'dpl_GjTBMBdTu4vrqzNeJKwB1fMLhYyS',
      array['https://www.usefox.ai', 'https://usefox.ai', 'https://fox-ai-nine.vercel.app', 'https://fox-ai-saaslaunch.vercel.app'],
      '{"vercelScope":"saaslaunch","verifiedAt":"2026-06-11","deploymentStatus":"Ready"}'::jsonb
    ),
    (
      'zuppler',
      'zuppler-thank-you',
      'Zuppler Thank You',
      'Post-submit thank-you page and external booking next step',
      'https://zuppler-thank-you-page.vercel.app',
      'zuppler-thank-you-page',
      'dpl_4tUryZdVjp3N67WvhF3B8VsNcJYY',
      array['https://zuppler-thank-you-page.vercel.app', 'https://zuppler-thank-you-page-saaslaunch.vercel.app'],
      '{"vercelScope":"saaslaunch","verifiedAt":"2026-06-11","deploymentStatus":"Ready"}'::jsonb
    )
) as s(client_slug, slug, display_name, page_purpose, live_url, vercel_project_name, vercel_project_id, allowed_origins, source_metadata)
join public.agency_clients c on c.slug = s.client_slug
on conflict (client_id, slug) do update
set display_name = excluded.display_name,
    page_purpose = excluded.page_purpose,
    live_url = excluded.live_url,
    vercel_project_name = excluded.vercel_project_name,
    vercel_project_id = excluded.vercel_project_id,
    allowed_origins = excluded.allowed_origins,
    source_metadata = excluded.source_metadata,
    updated_at = now();

insert into public.landing_event_definitions (
  site_id,
  event_key,
  display_name,
  category,
  is_conversion,
  description
)
select
  s.id,
  e.event_key,
  e.display_name,
  e.category,
  e.is_conversion,
  e.description
from public.agency_client_sites s
join public.agency_clients c on c.id = s.client_id
join (
  values
    ('anura', 'try-anura', 'page_viewed', 'Page viewed', 'page', false, 'Landing page loaded.'),
    ('anura', 'try-anura', 'cta_clicked', 'CTA clicked', 'engagement', false, 'Tracked CTA click.'),
    ('anura', 'try-anura', 'form_started', 'Audit form started', 'form', false, 'Traffic audit form started.'),
    ('anura', 'try-anura', 'traffic_audit_submitted', 'Traffic audit submitted', 'conversion', true, 'Traffic audit lead form submitted.'),
    ('anura', 'try-anura', 'faq_opened', 'FAQ opened', 'engagement', false, 'FAQ item expanded.'),
    ('anura', 'try-anura', 'scroll_50', 'Scrolled 50%', 'engagement', false, 'Visitor crossed 50% scroll depth.'),
    ('anura', 'try-anura', 'scroll_90', 'Scrolled 90%', 'engagement', false, 'Visitor crossed 90% scroll depth.'),
    ('fox-ai', 'usefox-ai', 'page_viewed', 'Page viewed', 'page', false, 'Landing page loaded.'),
    ('fox-ai', 'usefox-ai', 'cta_clicked', 'CTA clicked', 'engagement', false, 'Tracked CTA click.'),
    ('fox-ai', 'usefox-ai', 'calendar_loaded', 'Calendar loaded', 'booking', false, 'Scheduler embedded or opened.'),
    ('fox-ai', 'usefox-ai', 'calendly_scheduled', 'Calendly scheduled', 'conversion', true, 'Calendly scheduled-event callback.'),
    ('fox-ai', 'usefox-ai', 'booking_completed', 'Booking completed', 'conversion', true, 'Post-booking confirmation reached.'),
    ('fox-ai', 'usefox-ai', 'scroll_50', 'Scrolled 50%', 'engagement', false, 'Visitor crossed 50% scroll depth.'),
    ('fox-ai', 'usefox-ai', 'scroll_90', 'Scrolled 90%', 'engagement', false, 'Visitor crossed 90% scroll depth.'),
    ('zuppler', 'zuppler-thank-you', 'page_viewed', 'Page viewed', 'page', false, 'Thank-you page loaded.'),
    ('zuppler', 'zuppler-thank-you', 'external_booking_clicked', 'External booking clicked', 'conversion', true, 'Visitor clicked the external booking next step.'),
    ('zuppler', 'zuppler-thank-you', 'video_played', 'Video played', 'video', false, 'Embedded video started.'),
    ('zuppler', 'zuppler-thank-you', 'video_50_percent_watched', 'Video 50% watched', 'video', false, 'Embedded video reached 50% progress.'),
    ('zuppler', 'zuppler-thank-you', 'scroll_50', 'Scrolled 50%', 'engagement', false, 'Visitor crossed 50% scroll depth.'),
    ('zuppler', 'zuppler-thank-you', 'scroll_90', 'Scrolled 90%', 'engagement', false, 'Visitor crossed 90% scroll depth.')
) as e(client_slug, site_slug, event_key, display_name, category, is_conversion, description)
  on c.slug = e.client_slug and s.slug = e.site_slug
on conflict (site_id, event_key) do update
set display_name = excluded.display_name,
    category = excluded.category,
    is_conversion = excluded.is_conversion,
    description = excluded.description,
    is_active = true,
    updated_at = now();

insert into public.landing_event_property_definitions (
  event_definition_id,
  property_key,
  property_type,
  is_required,
  enum_values,
  max_length,
  is_filterable
)
select
  d.id,
  p.property_key,
  p.property_type,
  p.is_required,
  p.enum_values,
  p.max_length,
  p.is_filterable
from public.landing_event_definitions d
join public.agency_client_sites s on s.id = d.site_id
join public.agency_clients c on c.id = s.client_id
join (
  values
    ('*', '*', 'cta_id', 'string', false, array[]::text[], 120, true),
    ('*', '*', 'cta_text', 'string', false, array[]::text[], 160, false),
    ('*', '*', 'href_hostname', 'string', false, array[]::text[], 200, true),
    ('*', '*', 'href_path', 'path', false, array[]::text[], 200, true),
    ('anura', 'traffic_audit_submitted', 'form_id', 'string', false, array[]::text[], 120, true),
    ('anura', 'traffic_audit_submitted', 'spend_range', 'enum', false, array['under_10k','10k_50k','50k_250k','250k_plus'], 40, true),
    ('anura', 'traffic_audit_submitted', 'channel', 'enum', false, array['meta','google','linkedin','tiktok','mixed','other'], 40, true),
    ('anura', 'form_started', 'form_id', 'string', false, array[]::text[], 120, true),
    ('anura', 'faq_opened', 'question_id', 'string', false, array[]::text[], 120, true),
    ('fox-ai', 'calendar_loaded', 'scheduler_type', 'enum', false, array['calendly','hubspot','other'], 40, true),
    ('fox-ai', 'calendly_scheduled', 'booking_flow_stage', 'enum', false, array['scheduled','confirmed'], 40, true),
    ('fox-ai', 'booking_completed', 'booking_flow_stage', 'enum', false, array['scheduled','confirmed','post_booking'], 40, true),
    ('zuppler', 'external_booking_clicked', 'booking_destination', 'string', false, array[]::text[], 160, true),
    ('zuppler', 'video_played', 'video_id', 'string', false, array[]::text[], 120, true),
    ('zuppler', 'video_50_percent_watched', 'video_id', 'string', false, array[]::text[], 120, true)
) as p(client_slug, event_key, property_key, property_type, is_required, enum_values, max_length, is_filterable)
  on (p.client_slug = '*' or p.client_slug = c.slug)
 and (p.event_key = '*' or p.event_key = d.event_key)
 and (
   (p.property_key in ('cta_id', 'cta_text', 'href_hostname', 'href_path') and d.event_key in ('cta_clicked', 'external_booking_clicked'))
   or p.property_key not in ('cta_id', 'cta_text', 'href_hostname', 'href_path')
 )
on conflict (event_definition_id, property_key) do update
set property_type = excluded.property_type,
    is_required = excluded.is_required,
    enum_values = excluded.enum_values,
    max_length = excluded.max_length,
    is_filterable = excluded.is_filterable,
    is_active = true;

comment on table public.agency_clients is
  'Internal SaaSLaunch agency clients. Separate from AI-GOS app user_profiles.';

comment on table public.agency_client_sites is
  'Live SaaSLaunch-managed landing pages and tracker installation metadata.';

comment on table public.landing_event_definitions is
  'Server-owned event registry per landing page.';

comment on table public.landing_event_property_definitions is
  'Allowed property schemas for each landing event definition.';

comment on table public.landing_events is
  'Accepted anonymous landing-page analytics events.';

comment on table public.landing_event_rejections is
  'Rejected landing analytics payload metadata without raw PII values.';
