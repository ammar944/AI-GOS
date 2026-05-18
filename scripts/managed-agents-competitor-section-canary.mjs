#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const requireFromRoot = createRequire(resolve('package.json'));

const ANTHROPIC_API_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';
const SEARCHAPI_BASE_URL = 'https://www.searchapi.io/api/v1/search';
const DEFAULT_COMPANY = 'monday.com';
const DEFAULT_DOMAIN = 'monday.com';
const DEFAULT_REGION = 'US';
const DEFAULT_LIMIT = 5;
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const REQUEST_TIMEOUT_MS = 60_000;
const SEARCH_TIMEOUT_MS = 20_000;
const PAGE_TIMEOUT_MS = 12_000;
const STREAM_TIMEOUT_MS = 12 * 60_000;
const MAX_PAGE_TEXT_CHARS = 4_000;

function loadEnvFile(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const rawValue = trimmed.slice(eqIndex + 1).trim();
      if (!key || process.env[key]) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function parseArgs(argv) {
  const args = {
    company: process.env.MANAGED_AGENTS_COMPETITOR_COMPANY ?? DEFAULT_COMPANY,
    domain: process.env.MANAGED_AGENTS_COMPETITOR_DOMAIN ?? DEFAULT_DOMAIN,
    region: process.env.MANAGED_AGENTS_COMPETITOR_REGION ?? DEFAULT_REGION,
    limit: Number(process.env.MANAGED_AGENTS_COMPETITOR_LIMIT ?? DEFAULT_LIMIT),
    model: process.env.MANAGED_AGENTS_COMPETITOR_MODEL ?? DEFAULT_MODEL,
    environmentId: process.env.MANAGED_AGENTS_COMPETITOR_ENVIRONMENT_ID ?? '',
    agentId: process.env.MANAGED_AGENTS_COMPETITOR_AGENT_ID ?? '',
    deliberateInvalidFirstSave: process.env.MANAGED_AGENTS_COMPETITOR_SKIP_INVALID_FIRST_SAVE !== 'true',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--company' && next) {
      args.company = next;
      index += 1;
    } else if (token === '--domain' && next) {
      args.domain = next;
      index += 1;
    } else if (token === '--region' && next) {
      args.region = next;
      index += 1;
    } else if (token === '--limit' && next) {
      args.limit = Number(next);
      index += 1;
    } else if (token === '--model' && next) {
      args.model = next;
      index += 1;
    } else if (token === '--reuse-environment-id' && next) {
      args.environmentId = next;
      index += 1;
    } else if (token === '--reuse-agent-id' && next) {
      args.agentId = next;
      index += 1;
    } else if (token === '--no-deliberate-invalid-save') {
      args.deliberateInvalidFirstSave = false;
    } else if (token === '--help') {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  if (!args.company.trim()) throw new Error('--company is required');
  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 25) {
    throw new Error('--limit must be an integer between 1 and 25');
  }

  return args;
}

function printHelpAndExit() {
  console.log(`Usage: node scripts/managed-agents-competitor-section-canary.mjs [options]

Runs the P1 Managed Agents canary for Section 03:
  1. create/reuse one Managed Agents environment
  2. create/reuse one Competitor Landscape agent
  3. start a session and stream events over SSE
  4. execute AI-GOS-owned custom tools locally
  5. validate save_competitor_landscape_artifact against the real Section 03 schema
  6. write transcript and accepted artifact JSON to tmp/

Options:
  --company <name>                Audited company. Default: ${DEFAULT_COMPANY}
  --domain <domain>               Known company domain. Default: ${DEFAULT_DOMAIN}
  --region <region>               Region hint. Default: ${DEFAULT_REGION}
  --limit <n>                     Evidence result cap, 1-25. Default: ${DEFAULT_LIMIT}
  --model <model>                 Managed Agent model. Default: ${DEFAULT_MODEL}
  --reuse-environment-id <env>    Reuse an existing environment.
  --reuse-agent-id <agent>        Reuse an existing agent.
  --no-deliberate-invalid-save    Skip the intentional first invalid save probe.

Optional reuse env:
  MANAGED_AGENTS_COMPETITOR_ENVIRONMENT_ID=env_...
  MANAGED_AGENTS_COMPETITOR_AGENT_ID=agent_...
`);
  process.exit(0);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function assertRecord(value, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value;
}

function clampLimit(value, fallback, max) {
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), max) : fallback;
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeDomain(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0] ?? value;
}

function toUrlFromDomain(domain) {
  const normalized = normalizeDomain(domain);
  return normalized ? `https://${normalized}` : '';
}

function chooseAdvertiser(candidates, advertiserName) {
  const normalized = normalizeName(advertiserName);
  const exact = candidates.find((candidate) => normalizeName(candidate.name ?? '') === normalized);
  if (exact) return exact;

  const contains = candidates.find((candidate) => {
    const name = normalizeName(candidate.name ?? '');
    return name.includes(normalized) || normalized.includes(name);
  });
  return contains ?? candidates[0] ?? null;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${options.label ?? 'request'} failed ${response.status}: ${text.slice(0, 800)}`);
    }
    return text.trim().length > 0 ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

async function anthropicRequest(path, options = {}) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  return await fetchJson(`${ANTHROPIC_API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
    label: `Anthropic ${options.method ?? 'GET'} ${path}`,
    timeoutMs: options.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': MANAGED_AGENTS_BETA,
      'X-Api-Key': apiKey,
    },
  });
}

async function createEnvironment(args) {
  if (args.environmentId.trim()) {
    console.log(`[managed-agents] reusing environment ${args.environmentId}`);
    return { id: args.environmentId, reused: true };
  }

  const name = `aigos-p1-competitor-section-${Date.now()}`;
  const environment = await anthropicRequest('/environments', {
    method: 'POST',
    body: {
      name,
      description: 'AI-GOS P1 Managed Agents Competitor Landscape canary environment.',
      metadata: { project: 'AI-GOS', phase: 'managed-agents-p1', section: 'positioningCompetitorLandscape' },
      config: {
        type: 'cloud',
        networking: { type: 'unrestricted' },
      },
    },
  });
  console.log(`[managed-agents] created environment ${environment.id}`);
  return { id: environment.id, reused: false, raw: environment };
}

function buildFetchCompetitorAdsTool() {
  return {
    type: 'custom',
    name: 'fetch_competitor_ads',
    description:
      'Fetch bounded Google Ads Transparency Center evidence for one advertiser. AI-GOS executes SearchAPI locally and returns normalized creative metadata. Do not invent missing ad copy; report sparse Google transparency rows as a data gap.',
    input_schema: {
      type: 'object',
      properties: {
        advertiser_name: { type: 'string' },
        platform: { type: 'string', enum: ['google'] },
        region: { type: 'string', enum: ['US', 'CA', 'UK', 'AU', 'ALL'] },
        limit: { type: 'integer' },
      },
      required: ['advertiser_name', 'platform'],
    },
  };
}

function buildHomepageTool() {
  return {
    type: 'custom',
    name: 'fetch_homepage_positioning',
    description:
      'Fetch bounded homepage positioning evidence for one company or competitor. Returns direct page title/meta/body excerpt plus Google search results with source URLs.',
    input_schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        known_domain: { type: ['string', 'null'] },
        limit: { type: 'integer' },
      },
      required: ['company_name'],
    },
  };
}

function buildPricingTool() {
  return {
    type: 'custom',
    name: 'fetch_pricing_evidence',
    description:
      'Fetch bounded pricing and packaging evidence for one company or competitor. Returns direct pricing-page excerpt when available plus Google results with source URLs.',
    input_schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        known_domain: { type: ['string', 'null'] },
        limit: { type: 'integer' },
      },
      required: ['company_name'],
    },
  };
}

function buildReviewTool() {
  return {
    type: 'custom',
    name: 'fetch_review_evidence',
    description:
      'Fetch bounded public review, complaint, and weakness evidence for one company. Returns SearchAPI snippets from review surfaces with URLs. Use snippets exactly as observed; do not invent customer quotes.',
    input_schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        limit: { type: 'integer' },
      },
      required: ['company_name'],
    },
  };
}

function buildShareOfVoiceTool() {
  return {
    type: 'custom',
    name: 'fetch_share_of_voice',
    description:
      'Run one bounded Google search for competitor discovery, category visibility, status-quo alternatives, or DIY surfaces. Returns organic results with titles, snippets, and URLs.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer' },
      },
      required: ['query'],
    },
  };
}

function buildSaveTool() {
  return {
    type: 'custom',
    name: 'save_competitor_landscape_artifact',
    description:
      'Validate the completed Section 03 Competitor Landscape Artifact. Returns ok:true only when CompetitorLandscapeArtifactSchema.safeParse and validateCompetitorLandscapeMinimums pass. Returns ok:false with repair_feedback for business validation failures; revise and retry.',
    input_schema: {
      type: 'object',
      properties: {
        artifact: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['artifact'],
    },
  };
}

function buildSystemPrompt() {
  return [
    'You are the AI-GOS Managed Agents P1 canary for Section 03: Competitor Landscape & Positioning.',
    'Your objective is to produce exactly one CompetitorLandscapeArtifact for the audited company and submit it through save_competitor_landscape_artifact.',
    'Use only evidence returned by AI-GOS custom tools. Do not invent market data, pricing, competitor claims, ad copy, review quotes, URLs, or source titles.',
    'If Google Ads Transparency rows lack headline/body/landing URL fields, report that as a source gap rather than filling copy.',
    'The final artifact must include top-level fields sectionTitle, verdict, statusSummary, confidence, sources, competitorSet, positioningTaxonomy, pricingReality, shareOfVoice, publicWeaknesses, and narrativeArcs.',
    'Minimums: sources >=5; competitors >=5 and include direct, indirect, status-quo, diy; positioningTaxonomy.axes >=3; pricingReality.dataPoints >=3 across >=3 competitors; shareOfVoice.slices >=3; publicWeaknesses.items >=4 across >=2 competitors; narrativeArcs.arcs >=3; confidence 0-10.',
    'Use publicWeaknesses.items.verbatimQuote only for text observed in review/search snippets or page excerpts. If the source is a snippet, keep it short and attribute the source URL.',
    'When save_competitor_landscape_artifact returns ok:false, treat repair_feedback as normal validation feedback and call the save tool again after revising. Do not stop after a failed save.',
    'After the save tool returns ok:true, send a concise final message with the accepted verdict, confidence, and any data gaps.',
  ].join('\n');
}

async function createAgent(args) {
  if (args.agentId.trim()) {
    console.log(`[managed-agents] reusing agent ${args.agentId}`);
    return { id: args.agentId, reused: true };
  }

  const agent = await anthropicRequest('/agents', {
    method: 'POST',
    body: {
      name: `AI-GOS Competitor Landscape P1 ${Date.now()}`,
      description: 'Internal AI-GOS Managed Agents P1 canary for one Section 03 artifact.',
      metadata: { project: 'AI-GOS', phase: 'managed-agents-p1', section: 'positioningCompetitorLandscape' },
      model: args.model,
      system: buildSystemPrompt(),
      tools: [
        { type: 'agent_toolset_20260401', default_config: { enabled: false } },
        buildFetchCompetitorAdsTool(),
        buildHomepageTool(),
        buildPricingTool(),
        buildReviewTool(),
        buildShareOfVoiceTool(),
        buildSaveTool(),
      ],
    },
  });
  console.log(`[managed-agents] created agent ${agent.id} version ${agent.version}`);
  return { id: agent.id, version: agent.version, reused: false, raw: agent };
}

async function createSession(agentId, environmentId, args) {
  const session = await anthropicRequest('/sessions', {
    method: 'POST',
    body: {
      agent: agentId,
      environment_id: environmentId,
      metadata: {
        project: 'AI-GOS',
        phase: 'managed-agents-p1',
        section: 'positioningCompetitorLandscape',
        company: args.company,
        domain: args.domain,
      },
    },
  });
  console.log(`[managed-agents] created session ${session.id}`);
  return session;
}

async function sendEvents(sessionId, events) {
  return await anthropicRequest(`/sessions/${sessionId}/events`, {
    method: 'POST',
    body: { events },
  });
}

async function searchApi(params, timeoutMs = SEARCH_TIMEOUT_MS) {
  const apiKey = requireEnv('SEARCHAPI_KEY');
  const searchParams = new URLSearchParams({ ...params, api_key: apiKey });
  return await fetchJson(`${SEARCHAPI_BASE_URL}?${searchParams.toString()}`, {
    label: `SearchAPI ${params.engine}`,
    timeoutMs,
  });
}

function normalizeOrganicResults(payload, limit) {
  const results = Array.isArray(payload.organic_results) ? payload.organic_results : [];
  return results.slice(0, limit).map((result, index) => ({
    rank: index + 1,
    title: firstString([result.title]) ?? 'Untitled result',
    url: firstString([result.link, result.url]),
    snippet: firstString([result.snippet, result.description]),
    source: firstString([result.source, result.displayed_link]),
  }));
}

async function searchGoogle(query, limit) {
  const payload = await searchApi({
    engine: 'google',
    q: query,
    num: String(limit),
  });
  return normalizeOrganicResults(payload, limit).filter((result) => result.url);
}

async function fetchText(url, timeoutMs = PAGE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AI-GOS Managed Agents Canary/1.0',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, error: text.slice(0, 240) };
    }
    return { ok: true, status: response.status, text };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractMeta(html, attrName) {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexes = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return null;
}

function extractPageSummary(html, url) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    url,
    title: title ? decodeHtml(title.replace(/\s+/g, ' ').trim()) : null,
    description: extractMeta(html, 'description') ?? extractMeta(html, 'og:description'),
    h1: h1 ? decodeHtml(h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : null,
    text_excerpt: decodeHtml(bodyText).slice(0, MAX_PAGE_TEXT_CHARS),
  };
}

async function fetchPageSummary(url) {
  const result = await fetchText(url);
  if (!result.ok) return { ok: false, url, status: result.status, error: result.error };
  return { ok: true, ...extractPageSummary(result.text, url) };
}

function normalizeGoogleAd(record, index, advertiserName) {
  const regionStats = Array.isArray(record.regionStats)
    ? record.regionStats[0]
    : Array.isArray(record.region_stats)
      ? record.region_stats[0]
      : null;
  const advertiser = record.advertiser && typeof record.advertiser === 'object'
    ? record.advertiser
    : null;
  const image = record.image && typeof record.image === 'object' ? record.image : null;
  const previewUrls = Array.isArray(record.previewUrls)
    ? record.previewUrls
    : Array.isArray(record.preview_urls)
      ? record.preview_urls
      : [];

  return {
    platform: 'google',
    source_platform: 'google_ads_transparency_center',
    id: firstString([record.creativeId, record.creative_id, record.id]) ?? `google-${index}`,
    advertiser: firstString([record.advertiserName, record.advertiser_name, advertiser?.name]) ?? advertiserName,
    headline: firstString([record.headline, record.title]),
    body: firstString([record.description, record.body, record.text]),
    landing_url: firstString([record.landing_url, record.destination_url, record.click_url]),
    creative_url: firstString([record.creative_url, image?.link, ...previewUrls]),
    details_url: firstString([
      record.details_link,
      record.details_url,
      record.adTransparencyUrl,
      record.ad_transparency_url,
    ]),
    first_seen: firstString([
      regionStats?.firstShown,
      regionStats?.first_shown,
      record.first_shown_datetime,
      record.first_shown,
    ]),
    last_seen: firstString([
      regionStats?.lastShown,
      regionStats?.last_shown,
      record.last_shown_datetime,
      record.last_shown,
    ]),
    total_days_shown: Number.isFinite(record.total_days_shown) ? record.total_days_shown : null,
    format: firstString([record.format, record.creative_format]) ?? 'unknown',
    region: firstString([regionStats?.regionName, regionStats?.region_name]),
  };
}

async function fetchCompetitorAds(input, args) {
  const data = assertRecord(input, 'fetch_competitor_ads input');
  const advertiserName = typeof data.advertiser_name === 'string' ? data.advertiser_name.trim() : '';
  const platform = data.platform ?? 'google';
  const limit = clampLimit(data.limit, args.limit, 25);
  const region = typeof data.region === 'string' ? data.region : args.region;

  if (!advertiserName) return { ok: false, error: 'advertiser_name is required' };
  if (platform !== 'google') return { ok: false, error: 'P1 canary supports platform="google" only' };

  const advertiserPayload = await searchApi({
    engine: 'google_ads_transparency_center_advertiser_search',
    q: advertiserName,
  });
  const advertisers = Array.isArray(advertiserPayload.advertisers) ? advertiserPayload.advertisers : [];
  const selected = chooseAdvertiser(advertisers, advertiserName);
  if (!selected?.id) {
    return {
      ok: true,
      advertiser_name: advertiserName,
      platform: 'google',
      region,
      total_available: 0,
      returned: 0,
      ads: [],
      source: {
        engine: 'google_ads_transparency_center_advertiser_search',
        candidate_count: advertisers.length,
      },
      warning: 'No matching Google Ads Transparency advertiser ID was found.',
    };
  }

  const adsPayload = await searchApi({
    engine: 'google_ads_transparency_center',
    advertiser_id: String(selected.id),
  });
  const rawAds = Array.isArray(adsPayload.ad_creatives) ? adsPayload.ad_creatives : [];
  const ads = rawAds
    .filter((ad) => ad && typeof ad === 'object' && !Array.isArray(ad))
    .slice(0, limit)
    .map((ad, index) => normalizeGoogleAd(ad, index, selected.name ?? advertiserName));

  return {
    ok: true,
    advertiser_name: selected.name ?? advertiserName,
    requested_advertiser_name: advertiserName,
    advertiser_id: String(selected.id),
    platform: 'google',
    region,
    total_available: rawAds.length,
    returned: ads.length,
    ads,
    source: {
      search_engine: 'google_ads_transparency_center_advertiser_search',
      ads_engine: 'google_ads_transparency_center',
      selected_advertiser: selected,
    },
  };
}

async function fetchHomepagePositioning(input, args) {
  const data = assertRecord(input, 'fetch_homepage_positioning input');
  const companyName = typeof data.company_name === 'string' ? data.company_name.trim() : '';
  const knownDomain = typeof data.known_domain === 'string' ? normalizeDomain(data.known_domain) : '';
  const limit = clampLimit(data.limit, args.limit, 10);
  if (!companyName) return { ok: false, error: 'company_name is required' };

  const directUrl = knownDomain ? toUrlFromDomain(knownDomain) : '';
  const direct = directUrl ? await fetchPageSummary(directUrl) : null;
  const search_results = await searchGoogle(`${companyName} official homepage positioning`, limit);

  return {
    ok: true,
    company_name: companyName,
    known_domain: knownDomain || null,
    observed_at: new Date().toISOString(),
    direct,
    search_results,
  };
}

async function fetchPricingEvidence(input, args) {
  const data = assertRecord(input, 'fetch_pricing_evidence input');
  const companyName = typeof data.company_name === 'string' ? data.company_name.trim() : '';
  const knownDomain = typeof data.known_domain === 'string' ? normalizeDomain(data.known_domain) : '';
  const limit = clampLimit(data.limit, args.limit, 10);
  if (!companyName) return { ok: false, error: 'company_name is required' };

  const pricingUrls = knownDomain
    ? [`https://${knownDomain}/pricing`, `https://www.${knownDomain}/pricing`]
    : [];
  const direct_pages = [];
  for (const url of pricingUrls) {
    const summary = await fetchPageSummary(url);
    direct_pages.push(summary);
    if (summary.ok) break;
  }

  const query = knownDomain
    ? `${companyName} pricing site:${knownDomain} OR ${companyName} plans pricing`
    : `${companyName} pricing plans`;
  const search_results = await searchGoogle(query, limit);

  return {
    ok: true,
    company_name: companyName,
    known_domain: knownDomain || null,
    observed_at: new Date().toISOString(),
    direct_pages,
    search_results,
  };
}

async function fetchReviewEvidence(input, args) {
  const data = assertRecord(input, 'fetch_review_evidence input');
  const companyName = typeof data.company_name === 'string' ? data.company_name.trim() : '';
  const limit = clampLimit(data.limit, args.limit, 10);
  if (!companyName) return { ok: false, error: 'company_name is required' };

  const query = `${companyName} reviews complaints (site:g2.com OR site:capterra.com OR site:trustpilot.com OR site:reddit.com)`;
  const search_results = await searchGoogle(query, limit);

  return {
    ok: true,
    company_name: companyName,
    observed_at: new Date().toISOString(),
    search_results,
  };
}

async function fetchShareOfVoice(input, args) {
  const data = assertRecord(input, 'fetch_share_of_voice input');
  const query = typeof data.query === 'string' ? data.query.trim() : '';
  const limit = clampLimit(data.limit, args.limit, 10);
  if (!query) return { ok: false, error: 'query is required' };

  const search_results = await searchGoogle(query, limit);

  return {
    ok: true,
    query,
    observed_at: new Date().toISOString(),
    search_results,
  };
}

function registerTypeScriptRequireHook() {
  const extensions = requireFromRoot.extensions;
  if (extensions['.ts']?.__aigosManagedAgentsCanary) return;

  const ts = requireFromRoot('./research-worker/node_modules/typescript');
  const tsHook = (module, filename) => {
    const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
  tsHook.__aigosManagedAgentsCanary = true;
  extensions['.ts'] = tsHook;
}

function loadCompetitorValidator() {
  registerTypeScriptRequireHook();
  return requireFromRoot('./research-worker/src/agents/subagents/schemas/competitor-landscape.ts');
}

function formatZodIssues(error) {
  return error.issues
    .slice(0, 24)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`);
}

function validateCompetitorArtifact(artifact) {
  const {
    CompetitorLandscapeArtifactSchema,
    validateCompetitorLandscapeMinimums,
  } = loadCompetitorValidator();

  const parsed = CompetitorLandscapeArtifactSchema.safeParse(artifact);
  if (!parsed.success) {
    const errors = formatZodIssues(parsed.error);
    return {
      ok: false,
      schema_ok: false,
      minimums_ok: false,
      errors,
      repair_feedback: errors.join('; '),
    };
  }

  const minimums = validateCompetitorLandscapeMinimums(parsed.data);
  if (!minimums.ok) {
    return {
      ok: false,
      schema_ok: true,
      minimums_ok: false,
      errors: minimums.errors,
      repair_feedback: minimums.errors.join('; '),
      artifact: parsed.data,
    };
  }

  return {
    ok: true,
    schema_ok: true,
    minimums_ok: true,
    errors: [],
    repair_feedback: '',
    artifact: parsed.data,
  };
}

function createToolExecutor(args) {
  const validationAttempts = [];
  let acceptedArtifact = null;

  async function saveCompetitorLandscapeArtifact(input) {
    const data = assertRecord(input, 'save_competitor_landscape_artifact input');
    const attempt = validationAttempts.length + 1;
    const validation = validateCompetitorArtifact(data.artifact);
    const summary = {
      attempt,
      ok: validation.ok,
      schema_ok: validation.schema_ok,
      minimums_ok: validation.minimums_ok,
      errors: validation.errors,
    };
    validationAttempts.push(summary);

    if (!validation.ok) {
      console.log(`[validation] attempt=${attempt} ok=false errors=${validation.errors.length}`);
      return {
        ok: false,
        accepted: false,
        section_type: 'positioningCompetitorLandscape',
        attempt,
        schema_ok: validation.schema_ok,
        minimums_ok: validation.minimums_ok,
        repair_feedback: validation.repair_feedback,
      };
    }

    acceptedArtifact = validation.artifact;
    console.log(`[validation] attempt=${attempt} ok=true`);
    return {
      ok: true,
      accepted: true,
      section_type: 'positioningCompetitorLandscape',
      attempt,
      schema_ok: true,
      minimums_ok: true,
    };
  }

  async function execute(toolEvent) {
    if (toolEvent.name === 'fetch_competitor_ads') return await fetchCompetitorAds(toolEvent.input, args);
    if (toolEvent.name === 'fetch_homepage_positioning') return await fetchHomepagePositioning(toolEvent.input, args);
    if (toolEvent.name === 'fetch_pricing_evidence') return await fetchPricingEvidence(toolEvent.input, args);
    if (toolEvent.name === 'fetch_review_evidence') return await fetchReviewEvidence(toolEvent.input, args);
    if (toolEvent.name === 'fetch_share_of_voice') return await fetchShareOfVoice(toolEvent.input, args);
    if (toolEvent.name === 'save_competitor_landscape_artifact') {
      return await saveCompetitorLandscapeArtifact(toolEvent.input);
    }
    return { ok: false, error: `Unknown custom tool: ${toolEvent.name}` };
  }

  return {
    execute,
    getValidationAttempts: () => validationAttempts,
    getAcceptedArtifact: () => acceptedArtifact,
  };
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) return null;
    return JSON.parse(trimmed);
  }

  const payload = dataLines.join('\n').trim();
  if (!payload || payload === '[DONE]') return null;
  return JSON.parse(payload);
}

function extractTextContent(event) {
  if (!Array.isArray(event.content)) return '';
  return event.content
    .map((block) => (block?.type === 'text' && typeof block.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('\n');
}

async function listEvents(sessionId) {
  return await anthropicRequest(`/sessions/${sessionId}/events?order=asc&limit=100`, {
    method: 'GET',
  });
}

function incrementToolCount(toolCallCounts, toolName) {
  toolCallCounts[toolName] = (toolCallCounts[toolName] ?? 0) + 1;
}

async function streamSession(sessionId, executor) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const response = await fetch(`${ANTHROPIC_API_BASE_URL}/sessions/${sessionId}/events/stream`, {
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': MANAGED_AGENTS_BETA,
      'X-Api-Key': apiKey,
    },
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    clearTimeout(timeout);
    throw new Error(`stream failed ${response.status}: ${text.slice(0, 800)}`);
  }

  const decoder = new TextDecoder();
  const eventsById = new Map();
  const handledToolUseIds = new Set();
  const transcript = [];
  const finalMessages = [];
  const toolCallCounts = {};
  let buffer = '';
  let finished = false;

  async function resolvePendingEvent(eventId) {
    const local = eventsById.get(eventId);
    if (local) return local;
    const listed = await listEvents(sessionId);
    const events = Array.isArray(listed.data) ? listed.data : [];
    for (const event of events) {
      if (event?.id) eventsById.set(event.id, event);
    }
    return eventsById.get(eventId);
  }

  async function sendCustomToolResult(eventId, toolEvent, result, isTransportError) {
    const resultEvent = {
      type: 'user.custom_tool_result',
      custom_tool_use_id: eventId,
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
    if (toolEvent.session_thread_id) resultEvent.session_thread_id = toolEvent.session_thread_id;
    if (isTransportError) resultEvent.is_error = true;
    await sendEvents(sessionId, [resultEvent]);
  }

  async function handleEvent(event) {
    if (!event?.type) return;
    transcript.push(event);
    if (event.id) eventsById.set(event.id, event);

    if (event.type === 'agent.message') {
      const text = extractTextContent(event);
      if (text) finalMessages.push(text);
      console.log(`[agent.message] ${text.slice(0, 180).replace(/\s+/g, ' ')}`);
    } else if (event.type === 'agent.custom_tool_use') {
      incrementToolCount(toolCallCounts, event.name ?? 'unknown');
      console.log(`[tool.use] ${event.name} ${event.id}`);
    } else if (event.type.startsWith('session.')) {
      console.log(`[${event.type}] ${event.stop_reason?.type ?? ''}`);
    }

    const isIdle =
      event.type === 'session.status_idle' ||
      event.type === 'session.status_idled' ||
      event.type === 'session.thread_status_idle';
    if (!isIdle || !event.stop_reason) return;

    if (event.stop_reason.type === 'end_turn') {
      finished = true;
      controller.abort();
      return;
    }

    if (event.stop_reason.type !== 'requires_action') return;

    const eventIds = Array.isArray(event.stop_reason.event_ids) ? event.stop_reason.event_ids : [];
    for (const eventId of eventIds) {
      if (handledToolUseIds.has(eventId)) continue;
      const toolEvent = await resolvePendingEvent(eventId);
      if (!toolEvent || toolEvent.type !== 'agent.custom_tool_use') {
        throw new Error(`Could not resolve required custom tool event ${eventId}`);
      }

      handledToolUseIds.add(eventId);
      try {
        const result = await executor.execute(toolEvent);
        const isTransportError =
          result?.ok === false &&
          typeof result.error === 'string' &&
          !toolEvent.name?.startsWith('save_');
        console.log(`[tool.result] ${toolEvent.name} ok=${result.ok} attempt=${result.attempt ?? 'n/a'}`);
        await sendCustomToolResult(eventId, toolEvent, result, isTransportError);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[tool.result] ${toolEvent.name} transport_error=${message}`);
        await sendCustomToolResult(eventId, toolEvent, { ok: false, error: message }, true);
      }
    }
  }

  try {
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const event = parseSseBlock(part);
        if (event) await handleEvent(event);
        if (finished) break;
      }
      if (finished) break;
    }
  } catch (error) {
    if (!finished && error?.name !== 'AbortError') throw error;
  } finally {
    clearTimeout(timeout);
  }

  return {
    transcript,
    finalMessages,
    handledToolUseCount: handledToolUseIds.size,
    toolCallCounts,
  };
}

function buildUserMessage(args) {
  const invalidProbe = args.deliberateInvalidFirstSave
    ? [
        'Mandatory repair-loop probe: before doing research, call save_competitor_landscape_artifact once with this intentionally incomplete artifact exactly:',
        '{"artifact":{"sectionTitle":"Competitor Landscape & Positioning"}}',
        'Wait for repair_feedback, then continue the real research and submit a complete valid artifact.',
      ].join('\n')
    : 'Do not perform an intentional invalid save probe in this run.';

  return [
    `Audit company: ${args.company}`,
    `Known domain: ${args.domain || 'unknown'}`,
    `Region: ${args.region}`,
    `Evidence result cap per tool call: ${args.limit}`,
    invalidProbe,
    'Suggested workflow after the probe:',
    '1. Use fetch_share_of_voice to discover the visible category and alternatives.',
    '2. Choose at least five competitive alternatives spanning direct, indirect, status-quo, and diy.',
    '3. Use homepage and pricing tools for the audited company and selected alternatives.',
    '4. Use review evidence for at least two competitors to populate publicWeaknesses.',
    '5. Use fetch_competitor_ads for the audited company or one direct competitor only if ad evidence helps; report sparse fields honestly.',
    '6. Call save_competitor_landscape_artifact with the complete artifact. If it returns ok:false, repair and retry once.',
  ].join('\n\n');
}

function writeOutputs(payload) {
  const tmpDir = resolve('tmp');
  mkdirSync(tmpDir, { recursive: true });
  const stamp = Date.now();
  const transcriptPath = resolve(tmpDir, `managed-agents-competitor-section-canary-${stamp}.json`);
  writeFileSync(transcriptPath, `${JSON.stringify(payload, null, 2)}\n`);

  let artifactPath = null;
  if (payload.acceptedArtifact) {
    artifactPath = resolve(tmpDir, `managed-agents-competitor-section-canary-${stamp}-artifact.json`);
    writeFileSync(artifactPath, `${JSON.stringify(payload.acceptedArtifact, null, 2)}\n`);
  }

  return { transcriptPath, artifactPath };
}

function assertCanaryPassed(args, validationAttempts, acceptedArtifact) {
  if (!acceptedArtifact) {
    throw new Error('Canary did not produce an accepted CompetitorLandscapeArtifact');
  }

  if (args.deliberateInvalidFirstSave) {
    if (validationAttempts.length < 2) {
      throw new Error(`Expected at least two save attempts, observed ${validationAttempts.length}`);
    }
    const first = validationAttempts[0];
    if (first.ok !== false || (first.schema_ok !== false && first.minimums_ok !== false)) {
      throw new Error('Expected first save attempt to fail schema or minimum validation');
    }
  }

  const final = validationAttempts.at(-1);
  if (!final?.ok || !final.schema_ok || !final.minimums_ok) {
    throw new Error('Final save attempt did not pass schema and minimum validation');
  }
}

async function main() {
  loadEnvFile(resolve('.env.local'));
  loadEnvFile(resolve('research-worker/.env'));
  const args = parseArgs(process.argv.slice(2));

  requireEnv('ANTHROPIC_API_KEY');
  requireEnv('SEARCHAPI_KEY');

  console.log('[managed-agents] starting P1 competitor section canary');
  console.log(
    `[managed-agents] company=${args.company} domain=${args.domain || 'n/a'} region=${args.region} limit=${args.limit} model=${args.model}`,
  );
  console.log(
    `[managed-agents] deliberate_invalid_first_save=${args.deliberateInvalidFirstSave ? 'true' : 'false'}`,
  );

  const environment = await createEnvironment(args);
  const agent = await createAgent(args);
  const session = await createSession(agent.id, environment.id, args);
  const executor = createToolExecutor(args);

  await sendEvents(session.id, [
    { type: 'user.message', content: [{ type: 'text', text: buildUserMessage(args) }] },
  ]);

  const streamResult = await streamSession(session.id, executor);
  const validationAttempts = executor.getValidationAttempts();
  const acceptedArtifact = executor.getAcceptedArtifact();
  const outputPayload = {
    args,
    environment,
    agent,
    session: { id: session.id, status: session.status },
    validationAttempts,
    acceptedArtifact,
    ...streamResult,
  };
  const outputPaths = writeOutputs(outputPayload);

  try {
    assertCanaryPassed(args, validationAttempts, acceptedArtifact);
  } catch (error) {
    console.log(`[managed-agents] transcript: ${outputPaths.transcriptPath}`);
    if (outputPaths.artifactPath) console.log(`[managed-agents] artifact: ${outputPaths.artifactPath}`);
    throw error;
  }

  console.log(`[managed-agents] handled custom tool calls: ${streamResult.handledToolUseCount}`);
  console.log(`[managed-agents] tool calls: ${JSON.stringify(streamResult.toolCallCounts)}`);
  console.log(`[managed-agents] validation attempts: ${JSON.stringify(validationAttempts)}`);
  console.log(`[managed-agents] transcript: ${outputPaths.transcriptPath}`);
  if (outputPaths.artifactPath) console.log(`[managed-agents] artifact: ${outputPaths.artifactPath}`);
}

main().catch((error) => {
  console.error(`[managed-agents] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
