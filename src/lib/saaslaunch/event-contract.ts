import { z } from 'zod';

export interface LandingEventPayload {
  eventKey: string;
  clientSlug: string;
  siteSlug: string;
  pageUrl: string;
  path: string;
  occurredAt: Date;
  anonymousSessionId: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  deviceType: string;
  browser: string;
  properties: Record<string, LandingEventPropertyValue>;
}

export type LandingEventPropertyValue = string | number | boolean | null;

export class LandingEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LandingEventValidationError';
  }
}

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);

const eventKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{1,79}$/);

const nullableTextSchema = z
  .union([z.string().trim().min(1).max(512), z.null()])
  .optional()
  .transform((value): string | null => value ?? null);

const propertyValueSchema = z.union([
  z.string().max(1000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const rawPayloadSchema = z
  .object({
    event_name: eventKeySchema,
    client_slug: slugSchema,
    site_slug: slugSchema,
    page_url: z.string().trim().url().max(2048),
    path: z.string().trim().min(1).max(1024),
    occurred_at: z
      .string()
      .trim()
      .refine((value): boolean => !Number.isNaN(Date.parse(value)), {
        message: 'occurred_at must be an ISO datetime',
      }),
    session_id: z.string().trim().min(8).max(128),
    utm_source: nullableTextSchema,
    utm_medium: nullableTextSchema,
    utm_campaign: nullableTextSchema,
    utm_content: nullableTextSchema,
    utm_term: nullableTextSchema,
    referrer: nullableTextSchema,
    device_type: z.string().trim().min(2).max(64),
    browser: z.string().trim().min(2).max(128),
    properties: z.record(z.string().trim().min(1).max(80), propertyValueSchema).default({}),
  })
  .strict();

const piiKeyPattern =
  /(^|_|\b)(email|e-mail|phone|mobile|name|first_name|last_name|full_name|address|ip|ssn|token|password|domain|website|company|message|note)($|_|\b)/i;
const emailValuePattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phoneValuePattern = /(?:\+?\d[\s().-]*){8,}/;
const secretValuePattern =
  /(bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}|api[_-]?key|password|secret|token)/i;
const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

function buildIssueDetails(error: z.ZodError): string {
  return error.issues
    .map((issue): string => {
      const path = issue.path.length ? issue.path.join('.') : 'body';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function assertHttpUrl(value: string, label: string): void {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new LandingEventValidationError(
      `Invalid landing event payload: ${label} must be HTTP(S)`,
    );
  }
}

function assertNoPiiLookingProperties(
  properties: Record<string, LandingEventPropertyValue>,
): void {
  for (const [key, value] of Object.entries(properties)) {
    if (piiKeyPattern.test(key)) {
      throw new LandingEventValidationError(
        `PII-looking field is not allowed in landing event properties: ${key}`,
      );
    }

    if (typeof value === 'string') {
      if (
        emailValuePattern.test(value) ||
        phoneValuePattern.test(value) ||
        secretValuePattern.test(value) ||
        ipv4Pattern.test(value)
      ) {
        throw new LandingEventValidationError(
          `PII-looking value is not allowed in landing event properties: ${key}`,
        );
      }
    }
  }
}

function sanitizedPageUrl(value: string): string {
  const source = new URL(value);
  const sanitized = new URL(`${source.origin}${source.pathname}`);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  for (const key of utmKeys) {
    const paramValue = source.searchParams.get(key);
    if (paramValue) {
      sanitized.searchParams.set(key, paramValue.slice(0, 512));
    }
  }

  return sanitized.toString();
}

function sanitizedReferrer(value: string | null): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new LandingEventValidationError(
      'Invalid landing event payload: referrer must be HTTP(S)',
    );
  }
  return `${url.origin}${url.pathname}`;
}

function sanitizedPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return `/${trimmed}`;
  return trimmed;
}

export function parseLandingEventPayload(input: unknown): LandingEventPayload {
  const parsed = rawPayloadSchema.safeParse(input);
  if (!parsed.success) {
    throw new LandingEventValidationError(
      `Invalid landing event payload: ${buildIssueDetails(parsed.error)}`,
    );
  }

  assertHttpUrl(parsed.data.page_url, 'page_url');
  if (parsed.data.referrer) {
    assertHttpUrl(parsed.data.referrer, 'referrer');
  }
  assertNoPiiLookingProperties(parsed.data.properties);

  return {
    eventKey: parsed.data.event_name,
    clientSlug: parsed.data.client_slug,
    siteSlug: parsed.data.site_slug,
    pageUrl: sanitizedPageUrl(parsed.data.page_url),
    path: sanitizedPath(parsed.data.path),
    occurredAt: new Date(parsed.data.occurred_at),
    anonymousSessionId: parsed.data.session_id,
    utmSource: parsed.data.utm_source,
    utmMedium: parsed.data.utm_medium,
    utmCampaign: parsed.data.utm_campaign,
    utmContent: parsed.data.utm_content,
    utmTerm: parsed.data.utm_term,
    referrer: sanitizedReferrer(parsed.data.referrer),
    deviceType: parsed.data.device_type,
    browser: parsed.data.browser,
    properties: parsed.data.properties,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function summarizeRejectedPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) {
    return { shape: typeof input };
  }

  const properties = isRecord(input.properties) ? input.properties : {};
  const pageUrl = typeof input.page_url === 'string' ? input.page_url : null;
  let pageHost: string | null = null;
  let pagePath: string | null = null;

  if (pageUrl) {
    try {
      const url = new URL(pageUrl);
      pageHost = url.host;
      pagePath = url.pathname;
    } catch {
      pageHost = null;
      pagePath = null;
    }
  }

  return {
    topLevelKeys: Object.keys(input).sort(),
    propertyKeys: Object.keys(properties).sort(),
    pageHost,
    pagePath,
  };
}
