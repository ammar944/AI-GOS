import { createAdminClient } from '@/lib/supabase/server';

export interface SaasLaunchPropertyDefinition {
  id: string;
  eventDefinitionId: string;
  propertyKey: string;
  propertyType: string;
  isRequired: boolean;
  enumValues: string[];
  maxLength: number;
  isFilterable: boolean;
}

export interface SaasLaunchEventDefinition {
  id: string;
  siteId: string;
  eventKey: string;
  displayName: string;
  category: string;
  isConversion: boolean;
  isActive: boolean;
  description: string | null;
  properties: SaasLaunchPropertyDefinition[];
}

export interface SaasLaunchEventRow {
  id: string;
  clientId: string;
  siteId: string;
  eventDefinitionId: string;
  eventKey: string;
  occurredAt: string;
  anonymousSessionId: string;
  pageUrl: string;
  path: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  deviceType: string;
  browser: string;
  properties: Record<string, unknown>;
  insertedAt: string;
}

export interface SaasLaunchRejectionRow {
  id: string;
  clientSlug: string | null;
  siteSlug: string | null;
  eventKey: string | null;
  origin: string | null;
  reason: string;
  payloadMetadata: Record<string, unknown>;
  createdAt: string;
}

export interface SaasLaunchSiteSummary {
  id: string;
  clientId: string;
  clientSlug: string;
  clientDisplayName: string;
  slug: string;
  displayName: string;
  pagePurpose: string;
  liveUrl: string;
  vercelProjectName: string | null;
  vercelProjectId: string | null;
  allowedOrigins: string[];
  trackerStatus: string;
  effectiveTrackerStatus: string;
  trackerLastSeenAt: string | null;
  eventDefinitions: SaasLaunchEventDefinition[];
  totalEvents: number;
  uniqueSessions: number;
  conversionEvents: number;
  rejectedEvents: number;
  lastEventAt: string | null;
}

export interface SaasLaunchClientSummary {
  id: string;
  slug: string;
  displayName: string;
  status: string;
  notes: string | null;
  sourceMetadata: Record<string, unknown>;
  sites: SaasLaunchSiteSummary[];
  totalEvents: number;
  uniqueSessions: number;
  conversionEvents: number;
  rejectedEvents: number;
  lastEventAt: string | null;
}

export interface SaasLaunchOverview {
  clients: SaasLaunchClientSummary[];
  sites: SaasLaunchSiteSummary[];
  recentEvents: SaasLaunchEventRow[];
  recentRejections: SaasLaunchRejectionRow[];
  totals: {
    clients: number;
    sites: number;
    events: number;
    conversions: number;
    rejections: number;
    uniqueSessions: number;
  };
}

export interface SaasLaunchClientDetail extends SaasLaunchClientSummary {
  recentEvents: SaasLaunchEventRow[];
  recentRejections: SaasLaunchRejectionRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function rowsFrom(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRecord);
}

function maxIsoDate(values: Array<string | null>): string | null {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value): number => Date.parse(value))
    .filter((value): boolean => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function throwQueryError(label: string, error: { message: string } | null): void {
  if (!error) return;
  throw new Error(`SaaSLaunch dashboard query failed: ${label} error=${error.message}`);
}

function toPropertyDefinition(row: Record<string, unknown>): SaasLaunchPropertyDefinition {
  return {
    id: asString(row.id, ''),
    eventDefinitionId: asString(row.event_definition_id, ''),
    propertyKey: asString(row.property_key, ''),
    propertyType: asString(row.property_type, 'string'),
    isRequired: asBoolean(row.is_required),
    enumValues: asStringArray(row.enum_values),
    maxLength: asNumber(row.max_length, 200),
    isFilterable: asBoolean(row.is_filterable),
  };
}

function toEventDefinition(
  row: Record<string, unknown>,
  properties: SaasLaunchPropertyDefinition[],
): SaasLaunchEventDefinition {
  const id = asString(row.id, '');
  return {
    id,
    siteId: asString(row.site_id, ''),
    eventKey: asString(row.event_key, ''),
    displayName: asString(row.display_name, ''),
    category: asString(row.category, ''),
    isConversion: asBoolean(row.is_conversion),
    isActive: asBoolean(row.is_active),
    description: asNullableString(row.description),
    properties: properties.filter(
      (property): boolean => property.eventDefinitionId === id,
    ),
  };
}

function toEventRow(row: Record<string, unknown>): SaasLaunchEventRow {
  return {
    id: asString(row.id, ''),
    clientId: asString(row.client_id, ''),
    siteId: asString(row.site_id, ''),
    eventDefinitionId: asString(row.event_definition_id, ''),
    eventKey: asString(row.event_key, ''),
    occurredAt: asString(row.occurred_at, ''),
    anonymousSessionId: asString(row.anonymous_session_id, ''),
    pageUrl: asString(row.page_url, ''),
    path: asString(row.path, '/'),
    utmSource: asNullableString(row.utm_source),
    utmMedium: asNullableString(row.utm_medium),
    utmCampaign: asNullableString(row.utm_campaign),
    referrer: asNullableString(row.referrer),
    deviceType: asString(row.device_type, 'unknown'),
    browser: asString(row.browser, 'unknown'),
    properties: asMetadata(row.properties),
    insertedAt: asString(row.inserted_at, ''),
  };
}

function toRejectionRow(row: Record<string, unknown>): SaasLaunchRejectionRow {
  return {
    id: asString(row.id, ''),
    clientSlug: asNullableString(row.client_slug),
    siteSlug: asNullableString(row.site_slug),
    eventKey: asNullableString(row.event_key),
    origin: asNullableString(row.origin),
    reason: asString(row.reason, ''),
    payloadMetadata: asMetadata(row.payload_metadata),
    createdAt: asString(row.created_at, ''),
  };
}

function buildSiteSummary(input: {
  row: Record<string, unknown>;
  clientSlug: string;
  clientDisplayName: string;
  eventDefinitions: SaasLaunchEventDefinition[];
  events: SaasLaunchEventRow[];
  rejections: SaasLaunchRejectionRow[];
}): SaasLaunchSiteSummary {
  const id = asString(input.row.id, '');
  const events = input.events.filter((event): boolean => event.siteId === id);
  const eventDefinitionById = new Map(
    input.eventDefinitions.map(
      (definition): [string, SaasLaunchEventDefinition] => [definition.id, definition],
    ),
  );
  const conversions = events.filter((event): boolean => {
    const definition = eventDefinitionById.get(event.eventDefinitionId);
    return Boolean(definition?.isConversion);
  });
  const sessions = new Set(events.map((event): string => event.anonymousSessionId));
  const lastEventAt = maxIsoDate(events.map((event): string => event.occurredAt));
  const trackerStatus = asString(input.row.tracker_status, 'planned');

  return {
    id,
    clientId: asString(input.row.client_id, ''),
    clientSlug: input.clientSlug,
    clientDisplayName: input.clientDisplayName,
    slug: asString(input.row.slug, ''),
    displayName: asString(input.row.display_name, ''),
    pagePurpose: asString(input.row.page_purpose, ''),
    liveUrl: asString(input.row.live_url, ''),
    vercelProjectName: asNullableString(input.row.vercel_project_name),
    vercelProjectId: asNullableString(input.row.vercel_project_id),
    allowedOrigins: asStringArray(input.row.allowed_origins),
    trackerStatus,
    effectiveTrackerStatus: lastEventAt ? 'verified' : trackerStatus,
    trackerLastSeenAt: asNullableString(input.row.tracker_last_seen_at) ?? lastEventAt,
    eventDefinitions: input.eventDefinitions.filter(
      (definition): boolean => definition.siteId === id,
    ),
    totalEvents: events.length,
    uniqueSessions: sessions.size,
    conversionEvents: conversions.length,
    rejectedEvents: input.rejections.filter(
      (rejection): boolean =>
        rejection.clientSlug === input.clientSlug &&
        rejection.siteSlug === asString(input.row.slug, ''),
    ).length,
    lastEventAt,
  };
}

export function buildTrackerSnippet(input: {
  clientSlug: string;
  siteSlug: string;
  appOrigin?: string;
}): string {
  const origin =
    input.appOrigin ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://aigos.saaslaunch.com';

  return `<script async src="${origin}/sl-analytics.v1.js" data-client="${input.clientSlug}" data-site="${input.siteSlug}" data-endpoint="${origin}/api/landing-events"></script>`;
}

export async function getSaasLaunchOverview(): Promise<SaasLaunchOverview> {
  const supabase = createAdminClient();

  const [clientsResult, sitesResult, definitionsResult, propertiesResult, eventsResult, rejectionsResult] =
    await Promise.all([
      supabase
        .from('agency_clients')
        .select('id, slug, display_name, status, notes, source_metadata, created_at')
        .order('display_name', { ascending: true }),
      supabase
        .from('agency_client_sites')
        .select(
          'id, client_id, slug, display_name, page_purpose, live_url, vercel_project_name, vercel_project_id, allowed_origins, tracker_status, tracker_last_seen_at, source_metadata',
        )
        .order('display_name', { ascending: true }),
      supabase
        .from('landing_event_definitions')
        .select(
          'id, site_id, event_key, display_name, category, is_conversion, is_active, description',
        )
        .order('event_key', { ascending: true }),
      supabase
        .from('landing_event_property_definitions')
        .select(
          'id, event_definition_id, property_key, property_type, is_required, enum_values, max_length, is_filterable, is_active',
        )
        .eq('is_active', true),
      supabase
        .from('landing_events')
        .select(
          'id, client_id, site_id, event_definition_id, event_key, occurred_at, anonymous_session_id, page_url, path, utm_source, utm_medium, utm_campaign, referrer, device_type, browser, properties, inserted_at',
        )
        .order('occurred_at', { ascending: false })
        .limit(500),
      supabase
        .from('landing_event_rejections')
        .select('id, client_slug, site_slug, event_key, origin, reason, payload_metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

  throwQueryError('agency_clients', clientsResult.error);
  throwQueryError('agency_client_sites', sitesResult.error);
  throwQueryError('landing_event_definitions', definitionsResult.error);
  throwQueryError('landing_event_property_definitions', propertiesResult.error);
  throwQueryError('landing_events', eventsResult.error);
  throwQueryError('landing_event_rejections', rejectionsResult.error);

  const propertyDefinitions = rowsFrom(propertiesResult.data).map(toPropertyDefinition);
  const eventDefinitions = rowsFrom(definitionsResult.data).map(
    (row): SaasLaunchEventDefinition => toEventDefinition(row, propertyDefinitions),
  );
  const events = rowsFrom(eventsResult.data).map(toEventRow);
  const rejections = rowsFrom(rejectionsResult.data).map(toRejectionRow);
  const siteRows = rowsFrom(sitesResult.data);

  const clients = rowsFrom(clientsResult.data).map((clientRow): SaasLaunchClientSummary => {
    const id = asString(clientRow.id, '');
    const slug = asString(clientRow.slug, '');
    const displayName = asString(clientRow.display_name, '');
    const sites = siteRows
      .filter((siteRow): boolean => asString(siteRow.client_id, '') === id)
      .map((siteRow): SaasLaunchSiteSummary =>
        buildSiteSummary({
          row: siteRow,
          clientSlug: slug,
          clientDisplayName: displayName,
          eventDefinitions,
          events,
          rejections,
        }),
      );
    const uniqueSessions = new Set(
      events
        .filter((event): boolean => event.clientId === id)
        .map((event): string => event.anonymousSessionId),
    );

    return {
      id,
      slug,
      displayName,
      status: asString(clientRow.status, 'active'),
      notes: asNullableString(clientRow.notes),
      sourceMetadata: asMetadata(clientRow.source_metadata),
      sites,
      totalEvents: sites.reduce((total, site): number => total + site.totalEvents, 0),
      uniqueSessions: uniqueSessions.size,
      conversionEvents: sites.reduce(
        (total, site): number => total + site.conversionEvents,
        0,
      ),
      rejectedEvents: sites.reduce(
        (total, site): number => total + site.rejectedEvents,
        0,
      ),
      lastEventAt: maxIsoDate(sites.map((site): string | null => site.lastEventAt)),
    };
  });

  const sites = clients.flatMap((client): SaasLaunchSiteSummary[] => client.sites);
  const uniqueSessions = new Set(events.map((event): string => event.anonymousSessionId));

  return {
    clients,
    sites,
    recentEvents: events.slice(0, 25),
    recentRejections: rejections.slice(0, 25),
    totals: {
      clients: clients.length,
      sites: sites.length,
      events: events.length,
      conversions: clients.reduce(
        (total, client): number => total + client.conversionEvents,
        0,
      ),
      rejections: rejections.length,
      uniqueSessions: uniqueSessions.size,
    },
  };
}

export async function getSaasLaunchClientDetail(
  slug: string,
): Promise<SaasLaunchClientDetail | null> {
  const overview = await getSaasLaunchOverview();
  const client = overview.clients.find(
    (candidate): boolean => candidate.slug === slug,
  );
  if (!client) return null;

  return {
    ...client,
    recentEvents: overview.recentEvents.filter(
      (event): boolean => event.clientId === client.id,
    ),
    recentRejections: overview.recentRejections.filter(
      (rejection): boolean => rejection.clientSlug === client.slug,
    ),
  };
}
