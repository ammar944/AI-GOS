import { createAdminClient } from '@/lib/supabase/server';
import {
  LandingEventValidationError,
  parseLandingEventPayload,
  summarizeRejectedPayload,
  type LandingEventPayload,
  type LandingEventPropertyValue,
} from '@/lib/saaslaunch/event-contract';

export class LandingSiteConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LandingSiteConfigError';
  }
}

export interface RecordLandingEventInput {
  payload: unknown;
  origin: string | null;
  userAgent: string | null;
}

export interface RecordLandingEventResult {
  id: string;
}

interface SupabaseLike {
  from: (table: string) => SupabaseQueryBuilder;
}

interface SupabaseQueryBuilder
  extends PromiseLike<SupabaseResult<Record<string, unknown>[] | null>> {
  select: (columns?: string) => SupabaseQueryBuilder;
  insert: (values: Record<string, unknown>) => SupabaseQueryBuilder;
  eq: (column: string, value: string | boolean) => SupabaseQueryBuilder;
  maybeSingle: () => Promise<SupabaseResult<Record<string, unknown> | null>>;
  single: () => Promise<SupabaseResult<Record<string, unknown>>>;
}

interface SupabaseResult<T> {
  data: T;
  error: SupabaseError | null;
}

interface SupabaseError {
  message: string;
  code?: string;
}

interface AgencyClientRow {
  id: string;
  slug: string;
  displayName: string;
  status: string;
}

interface AgencyClientSiteRow {
  id: string;
  clientId: string;
  slug: string;
  displayName: string;
  liveUrl: string;
  allowedOrigins: string[];
  trackerStatus: string;
}

interface LandingEventDefinitionRow {
  id: string;
  eventKey: string;
  isActive: boolean;
}

type LandingPropertyType = 'string' | 'number' | 'boolean' | 'enum' | 'url' | 'path';

interface LandingPropertyDefinitionRow {
  propertyKey: string;
  propertyType: LandingPropertyType;
  isRequired: boolean;
  enumValues: string[];
  maxLength: number;
}

interface SiteRegistry {
  client: AgencyClientRow;
  site: AgencyClientSiteRow;
}

const piiValuePattern =
  /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\s().-]*){8,}|bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}|api[_-]?key|password|secret|token)/i;

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid SaaSLaunch DB row: ${field} must be a non-empty string`);
  }
  return value;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toClientRow(row: Record<string, unknown>): AgencyClientRow {
  return {
    id: asString(row.id, 'agency_clients.id'),
    slug: asString(row.slug, 'agency_clients.slug'),
    displayName: asString(row.display_name, 'agency_clients.display_name'),
    status: asString(row.status, 'agency_clients.status'),
  };
}

function toSiteRow(row: Record<string, unknown>): AgencyClientSiteRow {
  return {
    id: asString(row.id, 'agency_client_sites.id'),
    clientId: asString(row.client_id, 'agency_client_sites.client_id'),
    slug: asString(row.slug, 'agency_client_sites.slug'),
    displayName: asString(row.display_name, 'agency_client_sites.display_name'),
    liveUrl: asString(row.live_url, 'agency_client_sites.live_url'),
    allowedOrigins: asStringArray(row.allowed_origins),
    trackerStatus: asString(row.tracker_status, 'agency_client_sites.tracker_status'),
  };
}

function toEventDefinitionRow(row: Record<string, unknown>): LandingEventDefinitionRow {
  return {
    id: asString(row.id, 'landing_event_definitions.id'),
    eventKey: asString(row.event_key, 'landing_event_definitions.event_key'),
    isActive: asBoolean(row.is_active),
  };
}

function toPropertyDefinitionRow(
  row: Record<string, unknown>,
): LandingPropertyDefinitionRow {
  const propertyType = asString(
    row.property_type,
    'landing_event_property_definitions.property_type',
  );
  if (
    propertyType !== 'string' &&
    propertyType !== 'number' &&
    propertyType !== 'boolean' &&
    propertyType !== 'enum' &&
    propertyType !== 'url' &&
    propertyType !== 'path'
  ) {
    throw new Error(
      `Invalid SaaSLaunch DB row: unsupported property_type ${propertyType}`,
    );
  }

  return {
    propertyKey: asString(
      row.property_key,
      'landing_event_property_definitions.property_key',
    ),
    propertyType,
    isRequired: asBoolean(row.is_required),
    enumValues: asStringArray(row.enum_values),
    maxLength: asNumber(row.max_length, 200),
  };
}

function getStringField(input: unknown, field: string): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = (input as Record<string, unknown>)[field];
  return asOptionalString(value);
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  return url.origin;
}

function assertOriginAllowed(site: AgencyClientSiteRow, origin: string | null): void {
  if (!origin) {
    throw new LandingSiteConfigError(
      `Missing Origin header for landing event: client_site=${site.slug}`,
    );
  }

  const normalizedOrigin = normalizeOrigin(origin);
  const allowed = site.allowedOrigins.map((allowedOrigin): string =>
    normalizeOrigin(allowedOrigin),
  );

  if (!allowed.includes(normalizedOrigin)) {
    throw new LandingSiteConfigError(
      `Origin is not allowed for landing event: origin=${normalizedOrigin} client_site=${site.slug}`,
    );
  }
}

async function loadSiteRegistry(
  supabase: SupabaseLike,
  payload: LandingEventPayload,
): Promise<SiteRegistry> {
  const { data: clientRow, error: clientError } = await supabase
    .from('agency_clients')
    .select('id, slug, display_name, status')
    .eq('slug', payload.clientSlug)
    .maybeSingle();

  if (clientError) {
    throw new Error(
      `SaaSLaunch client lookup failed: client_slug=${payload.clientSlug} error=${clientError.message}`,
    );
  }
  if (!clientRow) {
    throw new LandingSiteConfigError(
      `Unknown SaaSLaunch client: client_slug=${payload.clientSlug}`,
    );
  }

  const client = toClientRow(clientRow);
  if (client.status !== 'active') {
    throw new LandingSiteConfigError(
      `SaaSLaunch client is not active: client_slug=${client.slug} status=${client.status}`,
    );
  }

  const { data: siteRow, error: siteError } = await supabase
    .from('agency_client_sites')
    .select('id, client_id, slug, display_name, live_url, allowed_origins, tracker_status')
    .eq('client_id', client.id)
    .eq('slug', payload.siteSlug)
    .maybeSingle();

  if (siteError) {
    throw new Error(
      `SaaSLaunch site lookup failed: client_slug=${payload.clientSlug} site_slug=${payload.siteSlug} error=${siteError.message}`,
    );
  }
  if (!siteRow) {
    throw new LandingSiteConfigError(
      `Unknown SaaSLaunch site: client_slug=${payload.clientSlug} site_slug=${payload.siteSlug}`,
    );
  }

  const site = toSiteRow(siteRow);
  if (site.trackerStatus === 'disabled') {
    throw new LandingSiteConfigError(
      `SaaSLaunch site tracker is disabled: client_slug=${payload.clientSlug} site_slug=${payload.siteSlug}`,
    );
  }

  return { client, site };
}

async function loadEventDefinition(
  supabase: SupabaseLike,
  site: AgencyClientSiteRow,
  eventKey: string,
): Promise<LandingEventDefinitionRow> {
  const { data, error } = await supabase
    .from('landing_event_definitions')
    .select('id, event_key, is_active')
    .eq('site_id', site.id)
    .eq('event_key', eventKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `SaaSLaunch event definition lookup failed: site_id=${site.id} event_key=${eventKey} error=${error.message}`,
    );
  }
  if (!data) {
    throw new LandingEventValidationError(
      `Unsupported landing event: site_slug=${site.slug} event_key=${eventKey}`,
    );
  }

  return toEventDefinitionRow(data);
}

async function loadPropertyDefinitions(
  supabase: SupabaseLike,
  eventDefinitionId: string,
): Promise<LandingPropertyDefinitionRow[]> {
  const { data, error } = await supabase
    .from('landing_event_property_definitions')
    .select('property_key, property_type, is_required, enum_values, max_length')
    .eq('event_definition_id', eventDefinitionId)
    .eq('is_active', true);

  if (error) {
    throw new Error(
      `SaaSLaunch property definition lookup failed: event_definition_id=${eventDefinitionId} error=${error.message}`,
    );
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row): LandingPropertyDefinitionRow =>
    toPropertyDefinitionRow(row as Record<string, unknown>),
  );
}

function assertNoPiiValue(key: string, value: string): void {
  if (piiValuePattern.test(value)) {
    throw new LandingEventValidationError(
      `PII-looking value is not allowed in landing event properties: ${key}`,
    );
  }
}

function validateStringProperty(
  definition: LandingPropertyDefinitionRow,
  value: LandingEventPropertyValue,
): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new LandingEventValidationError(
      `Invalid property type: ${definition.propertyKey} must be a string`,
    );
  }

  const trimmed = value.trim();
  if (trimmed.length > definition.maxLength) {
    throw new LandingEventValidationError(
      `Invalid property length: ${definition.propertyKey} exceeds ${definition.maxLength} characters`,
    );
  }
  assertNoPiiValue(definition.propertyKey, trimmed);
  return trimmed;
}

function validateUrlProperty(
  definition: LandingPropertyDefinitionRow,
  value: LandingEventPropertyValue,
): string | null {
  const stringValue = validateStringProperty(definition, value);
  if (stringValue === null || stringValue.length === 0) return stringValue;
  const url = new URL(stringValue);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new LandingEventValidationError(
      `Invalid property URL: ${definition.propertyKey} must be HTTP(S)`,
    );
  }
  return `${url.origin}${url.pathname}`;
}

function validatePathProperty(
  definition: LandingPropertyDefinitionRow,
  value: LandingEventPropertyValue,
): string | null {
  const stringValue = validateStringProperty(definition, value);
  if (stringValue === null || stringValue.length === 0) return stringValue;
  if (!stringValue.startsWith('/')) {
    throw new LandingEventValidationError(
      `Invalid property path: ${definition.propertyKey} must start with /`,
    );
  }
  return stringValue.split('?')[0]?.split('#')[0] ?? '/';
}

function validateEnumProperty(
  definition: LandingPropertyDefinitionRow,
  value: LandingEventPropertyValue,
): string | null {
  const stringValue = validateStringProperty(definition, value);
  if (stringValue === null) return null;
  if (!definition.enumValues.includes(stringValue)) {
    throw new LandingEventValidationError(
      `Invalid enum property: ${definition.propertyKey}=${stringValue}`,
    );
  }
  return stringValue;
}

function validatePropertyValue(
  definition: LandingPropertyDefinitionRow,
  value: LandingEventPropertyValue,
): LandingEventPropertyValue {
  if (definition.propertyType === 'string') {
    return validateStringProperty(definition, value);
  }
  if (definition.propertyType === 'enum') {
    return validateEnumProperty(definition, value);
  }
  if (definition.propertyType === 'url') {
    return validateUrlProperty(definition, value);
  }
  if (definition.propertyType === 'path') {
    return validatePathProperty(definition, value);
  }
  if (definition.propertyType === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new LandingEventValidationError(
        `Invalid property type: ${definition.propertyKey} must be a finite number`,
      );
    }
    return value;
  }
  if (typeof value !== 'boolean') {
    throw new LandingEventValidationError(
      `Invalid property type: ${definition.propertyKey} must be a boolean`,
    );
  }
  return value;
}

function validateProperties(
  payload: LandingEventPayload,
  definitions: LandingPropertyDefinitionRow[],
): Record<string, LandingEventPropertyValue> {
  const definitionByKey = new Map(
    definitions.map((definition): [string, LandingPropertyDefinitionRow] => [
      definition.propertyKey,
      definition,
    ]),
  );
  const sanitized: Record<string, LandingEventPropertyValue> = {};

  for (const definition of definitions) {
    const value = payload.properties[definition.propertyKey];
    if (definition.isRequired && (value === undefined || value === null || value === '')) {
      throw new LandingEventValidationError(
        `Missing required landing event property: ${definition.propertyKey}`,
      );
    }
  }

  for (const [key, value] of Object.entries(payload.properties)) {
    const definition = definitionByKey.get(key);
    if (!definition) {
      throw new LandingEventValidationError(
        `Unknown landing event property: event_key=${payload.eventKey} property=${key}`,
      );
    }

    sanitized[key] = validatePropertyValue(definition, value);
  }

  return sanitized;
}

async function recordLandingEventRejection(
  supabase: SupabaseLike,
  input: {
    payload: unknown;
    reason: string;
    origin: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('landing_event_rejections').insert({
    client_slug: getStringField(input.payload, 'client_slug'),
    site_slug: getStringField(input.payload, 'site_slug'),
    event_key: getStringField(input.payload, 'event_name'),
    origin: input.origin,
    reason: input.reason,
    payload_metadata: summarizeRejectedPayload(input.payload),
  });

  if (error) {
    throw new Error(
      `Landing event rejection persistence failed: reason=${input.reason} error=${error.message}`,
    );
  }
}

function isExpectedIngestError(
  error: unknown,
): error is LandingEventValidationError | LandingSiteConfigError {
  return (
    error instanceof LandingEventValidationError ||
    error instanceof LandingSiteConfigError
  );
}

export async function recordLandingEvent(
  input: RecordLandingEventInput,
): Promise<RecordLandingEventResult> {
  const supabase = createAdminClient() as unknown as SupabaseLike;

  try {
    const payload = parseLandingEventPayload(input.payload);
    const registry = await loadSiteRegistry(supabase, payload);
    assertOriginAllowed(registry.site, input.origin);

    const eventDefinition = await loadEventDefinition(
      supabase,
      registry.site,
      payload.eventKey,
    );
    const propertyDefinitions = await loadPropertyDefinitions(
      supabase,
      eventDefinition.id,
    );
    const properties = validateProperties(payload, propertyDefinitions);

    const { data, error } = await supabase
      .from('landing_events')
      .insert({
        client_id: registry.client.id,
        site_id: registry.site.id,
        event_definition_id: eventDefinition.id,
        event_key: payload.eventKey,
        occurred_at: payload.occurredAt.toISOString(),
        anonymous_session_id: payload.anonymousSessionId,
        page_url: payload.pageUrl,
        path: payload.path,
        utm_source: payload.utmSource,
        utm_medium: payload.utmMedium,
        utm_campaign: payload.utmCampaign,
        utm_content: payload.utmContent,
        utm_term: payload.utmTerm,
        referrer: payload.referrer,
        device_type: payload.deviceType,
        browser: payload.browser,
        properties,
        origin: input.origin,
        user_agent: input.userAgent,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(
        `Landing event insert failed: client_slug=${payload.clientSlug} site_slug=${payload.siteSlug} event_key=${payload.eventKey} error=${error.message}`,
      );
    }

    return { id: asString(data.id, 'landing_events.id') };
  } catch (error) {
    if (isExpectedIngestError(error)) {
      await recordLandingEventRejection(supabase, {
        payload: input.payload,
        reason: error.message,
        origin: input.origin,
      });
    }
    throw error;
  }
}
