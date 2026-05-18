#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ANTHROPIC_API_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';
const SEARCHAPI_BASE_URL = 'https://www.searchapi.io/api/v1/search';
const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_ADVERTISER = 'Notion';
const DEFAULT_REGION = 'US';
const DEFAULT_LIMIT = 25;
const REQUEST_TIMEOUT_MS = 60_000;
const STREAM_TIMEOUT_MS = 8 * 60_000;

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
    advertiser: process.env.MANAGED_AGENTS_CANARY_ADVERTISER ?? DEFAULT_ADVERTISER,
    region: process.env.MANAGED_AGENTS_CANARY_REGION ?? DEFAULT_REGION,
    limit: Number(process.env.MANAGED_AGENTS_CANARY_LIMIT ?? DEFAULT_LIMIT),
    model: process.env.MANAGED_AGENTS_CANARY_MODEL ?? DEFAULT_MODEL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--advertiser' && next) {
      args.advertiser = next;
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
    } else if (token === '--help') {
      printHelpAndExit();
    }
  }

  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50) {
    throw new Error('--limit must be an integer between 1 and 50');
  }

  return args;
}

function printHelpAndExit() {
  console.log(`Usage: node scripts/managed-agents-ad-canary.mjs [options]

Runs the P0 Managed Agents canary:
  1. create/reuse one Managed Agents environment
  2. create/reuse one agent with the fetch_competitor_ads custom tool
  3. start a session
  4. handle the custom tool locally through SearchAPI
  5. write a JSON transcript to tmp/

Options:
  --advertiser <name>  Advertiser to fetch. Default: ${DEFAULT_ADVERTISER}
  --region <region>   Region hint. Default: ${DEFAULT_REGION}
  --limit <n>         Max ads to return, 1-50. Default: ${DEFAULT_LIMIT}
  --model <model>     Managed Agent model. Default: ${DEFAULT_MODEL}

Optional reuse env:
  MANAGED_AGENTS_CANARY_ENVIRONMENT_ID=env_...
  MANAGED_AGENTS_CANARY_AGENT_ID=agent_...
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

async function createEnvironment() {
  const existingId = process.env.MANAGED_AGENTS_CANARY_ENVIRONMENT_ID?.trim();
  if (existingId) {
    console.log(`[managed-agents] reusing environment ${existingId}`);
    return { id: existingId, reused: true };
  }

  const name = `aigos-p0-ad-canary-${Date.now()}`;
  const environment = await anthropicRequest('/environments', {
    method: 'POST',
    body: {
      name,
      description: 'AI-GOS P0 Managed Agents ad canary environment.',
      metadata: { project: 'AI-GOS', phase: 'managed-agents-p0' },
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
      'Fetch active Google Ads Transparency Center creatives for one advertiser. Use this when the user asks for competitor or advertiser ad evidence. The client app executes the SearchAPI calls and returns normalized ad cards plus source metadata; do not invent ad copy or fill missing fields. If the result has zero ads or sparse creative text, report that limitation explicitly.',
    input_schema: {
      type: 'object',
      properties: {
        advertiser_name: {
          type: 'string',
          description: 'The advertiser or competitor name to look up.',
        },
        platform: {
          type: 'string',
          enum: ['google'],
          description: 'P0 supports Google Ads Transparency Center only.',
        },
        region: {
          type: 'string',
          enum: ['US', 'CA', 'UK', 'AU', 'ALL'],
          description: 'Region hint for the analysis. SearchAPI lookup is advertiser-first.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum normalized ad cards to return. Must be 1-50.',
        },
      },
      required: ['advertiser_name', 'platform'],
    },
  };
}

async function createAgent(model) {
  const existingId = process.env.MANAGED_AGENTS_CANARY_AGENT_ID?.trim();
  if (existingId) {
    console.log(`[managed-agents] reusing agent ${existingId}`);
    return { id: existingId, reused: true };
  }

  const agent = await anthropicRequest('/agents', {
    method: 'POST',
    body: {
      name: `AI-GOS Positioning Ads Canary ${Date.now()}`,
      description: 'Internal AI-GOS Managed Agents P0 canary for custom-tool ad evidence.',
      metadata: { project: 'AI-GOS', phase: 'managed-agents-p0' },
      model,
      system: [
        'You are the AI-GOS Positioning Audit canary agent.',
        'Your job is to prove that Anthropic Managed Agents can call an AI-GOS-owned custom tool, receive validated SearchAPI ad evidence, and produce a concise operator-readable summary.',
        'Use fetch_competitor_ads exactly once for the advertiser requested by the user.',
        'Do not invent ad copy, counts, dates, landing URLs, or platforms. If a field is null or missing, say it is unavailable.',
        'Return two sections: "Angle summary" with 3-5 evidence-backed angles, and "Raw normalized ads" as compact JSON.',
      ].join('\n'),
      tools: [
        {
          type: 'agent_toolset_20260401',
          default_config: { enabled: false },
        },
        buildFetchCompetitorAdsTool(),
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
        phase: 'managed-agents-p0',
        advertiser: args.advertiser,
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

async function searchApi(params) {
  const apiKey = requireEnv('SEARCHAPI_KEY');
  const searchParams = new URLSearchParams({ ...params, api_key: apiKey });
  return await fetchJson(`${SEARCHAPI_BASE_URL}?${searchParams.toString()}`, {
    label: `SearchAPI ${params.engine}`,
    timeoutMs: 20_000,
  });
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
  const image = record.image && typeof record.image === 'object'
    ? record.image
    : null;
  const previewUrls = Array.isArray(record.previewUrls)
    ? record.previewUrls
    : Array.isArray(record.preview_urls)
      ? record.preview_urls
      : [];

  return {
    platform: 'google',
    source_platform: 'google_ads_transparency_center',
    id: firstString([record.creativeId, record.creative_id, record.id]) ?? `google-${index}`,
    advertiser: firstString([
      record.advertiserName,
      record.advertiser_name,
      advertiser?.name,
    ]) ?? advertiserName,
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
    total_days_shown: Number.isFinite(record.total_days_shown)
      ? record.total_days_shown
      : null,
    format: firstString([record.format, record.creative_format]) ?? 'unknown',
    region: firstString([regionStats?.regionName, regionStats?.region_name]),
  };
}

async function fetchCompetitorAds(input) {
  const data = assertRecord(input, 'fetch_competitor_ads input');
  const advertiserName = typeof data.advertiser_name === 'string'
    ? data.advertiser_name.trim()
    : '';
  const platform = data.platform ?? 'google';
  const limit = Number.isInteger(data.limit) ? Math.min(Math.max(data.limit, 1), 50) : DEFAULT_LIMIT;
  const region = typeof data.region === 'string' ? data.region : DEFAULT_REGION;

  if (!advertiserName) {
    return { ok: false, error: 'advertiser_name is required' };
  }
  if (platform !== 'google') {
    return { ok: false, error: 'P0 canary supports platform="google" only' };
  }

  const advertiserPayload = await searchApi({
    engine: 'google_ads_transparency_center_advertiser_search',
    q: advertiserName,
  });
  const advertisers = Array.isArray(advertiserPayload.advertisers)
    ? advertiserPayload.advertisers
    : [];
  const selected = chooseAdvertiser(advertisers, advertiserName);
  if (!selected?.id) {
    return {
      ok: true,
      advertiser_name: advertiserName,
      platform: 'google',
      region,
      total: 0,
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

async function executeCustomTool(toolEvent) {
  if (toolEvent.name !== 'fetch_competitor_ads') {
    return { ok: false, error: `Unknown custom tool: ${toolEvent.name}` };
  }
  return await fetchCompetitorAds(toolEvent.input);
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) {
      return null;
    }
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

async function streamSession(sessionId) {
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

  async function handleEvent(event) {
    if (!event?.type) return;
    transcript.push(event);
    if (event.id) eventsById.set(event.id, event);

    if (event.type === 'agent.message') {
      const text = extractTextContent(event);
      if (text) finalMessages.push(text);
      console.log(`[agent.message] ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
    } else if (event.type === 'agent.custom_tool_use') {
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

    const eventIds = Array.isArray(event.stop_reason.event_ids)
      ? event.stop_reason.event_ids
      : [];
    for (const eventId of eventIds) {
      if (handledToolUseIds.has(eventId)) continue;
      const toolEvent = await resolvePendingEvent(eventId);
      if (!toolEvent || toolEvent.type !== 'agent.custom_tool_use') {
        throw new Error(`Could not resolve required custom tool event ${eventId}`);
      }

      handledToolUseIds.add(eventId);
      const result = await executeCustomTool(toolEvent);
      console.log(`[tool.result] ${toolEvent.name} ok=${result.ok} returned=${result.returned ?? 'n/a'}`);

      const resultEvent = {
        type: 'user.custom_tool_result',
        custom_tool_use_id: eventId,
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
      if (toolEvent.session_thread_id) {
        resultEvent.session_thread_id = toolEvent.session_thread_id;
      }
      if (result.ok === false) {
        resultEvent.is_error = true;
      }
      await sendEvents(sessionId, [resultEvent]);
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

  return { transcript, finalMessages, handledToolUseCount: handledToolUseIds.size };
}

function writeTranscript(payload) {
  const tmpDir = resolve('tmp');
  mkdirSync(tmpDir, { recursive: true });
  const filePath = resolve(tmpDir, `managed-agents-ad-canary-${Date.now()}.json`);
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}

async function main() {
  loadEnvFile(resolve('.env.local'));
  loadEnvFile(resolve('research-worker/.env'));
  const args = parseArgs(process.argv.slice(2));

  requireEnv('ANTHROPIC_API_KEY');
  requireEnv('SEARCHAPI_KEY');

  console.log('[managed-agents] starting P0 ad canary');
  console.log(`[managed-agents] advertiser=${args.advertiser} region=${args.region} limit=${args.limit} model=${args.model}`);

  const environment = await createEnvironment();
  const agent = await createAgent(args.model);
  const session = await createSession(agent.id, environment.id, args);

  const userMessage = [
    `For advertiser "${args.advertiser}" in ${args.region}, fetch the top ${args.limit} active Google ads.`,
    'Cluster them into 3-5 dominant angles.',
    'Return a markdown summary plus the raw normalized ad list.',
  ].join(' ');

  await sendEvents(session.id, [
    { type: 'user.message', content: [{ type: 'text', text: userMessage }] },
  ]);

  const streamResult = await streamSession(session.id);
  const outputPath = writeTranscript({
    args,
    environment,
    agent,
    session: { id: session.id, status: session.status },
    ...streamResult,
  });

  console.log(`[managed-agents] handled custom tool calls: ${streamResult.handledToolUseCount}`);
  console.log(`[managed-agents] transcript: ${outputPath}`);
}

main().catch((error) => {
  console.error(`[managed-agents] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
