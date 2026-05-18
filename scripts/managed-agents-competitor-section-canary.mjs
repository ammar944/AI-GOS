#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const requireFromRoot = createRequire(resolve('package.json'));

const ANTHROPIC_API_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';
const SKILLS_BETA = 'skills-2025-10-02';
const ANTHROPIC_BETA_HEADER = `${MANAGED_AGENTS_BETA},${SKILLS_BETA}`;
const SEARCHAPI_BASE_URL = 'https://www.searchapi.io/api/v1/search';
const DEFAULT_COMPANY = 'monday.com';
const DEFAULT_DOMAIN = 'monday.com';
const DEFAULT_REGION = 'US';
const DEFAULT_LIMIT = 5;
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_AD_PLATFORM = 'all';
const DEFAULT_AD_COMPETITOR_COUNT = 3;
const DEFAULT_COMPETITIVE_POSITIONING_SKILL_ID = 'skill_012yUuFMRGtjKTeNXNxhPAvh';
const REQUEST_TIMEOUT_MS = 60_000;
const SEARCH_TIMEOUT_MS = 20_000;
const PAGE_TIMEOUT_MS = 12_000;
const STREAM_TIMEOUT_MS = 12 * 60_000;
const MAX_PAGE_TEXT_CHARS = 4_000;
const AD_PLATFORMS = new Set(['google', 'linkedin', 'meta', 'all']);

const SOURCE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    url: { type: 'string' },
    whyItMatters: { type: 'string' },
  },
  required: ['title', 'url'],
};

const COMPETITOR_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    url: { type: 'string' },
    competitorType: { type: 'string', enum: ['direct', 'indirect', 'status-quo', 'diy'] },
    oneLinePositioning: { type: 'string' },
    verbatimHeroCopy: { type: 'string' },
    pricingPosition: { type: 'string' },
    sourceUrl: { type: 'string' },
  },
  required: [
    'name',
    'url',
    'competitorType',
    'oneLinePositioning',
    'verbatimHeroCopy',
    'pricingPosition',
    'sourceUrl',
  ],
};

const COMPETITOR_POSITION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    competitor: { type: 'string' },
    position: { type: 'string' },
  },
  required: ['competitor', 'position'],
};

const POSITIONING_AXIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    axisName: { type: 'string' },
    ourPosition: { type: 'string' },
    competitorPositions: {
      type: 'array',
      items: COMPETITOR_POSITION_JSON_SCHEMA,
    },
    evidenceUrl: { type: 'string' },
  },
  required: ['axisName', 'ourPosition', 'competitorPositions', 'evidenceUrl'],
};

const PRICING_DATA_POINT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    competitor: { type: 'string' },
    tierName: { type: 'string' },
    monthlyPrice: { type: 'string' },
    packagingPattern: { type: 'string' },
    gatedSignals: { type: 'string' },
    sourceUrl: { type: 'string' },
  },
  required: [
    'competitor',
    'tierName',
    'monthlyPrice',
    'packagingPattern',
    'gatedSignals',
    'sourceUrl',
  ],
};

const SHARE_OF_VOICE_SLICE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    surface: { type: 'string' },
    winner: { type: 'string' },
    evidence: { type: 'string' },
    sourceUrl: { type: 'string' },
  },
  required: ['surface', 'winner', 'evidence', 'sourceUrl'],
};

const COMPETITOR_WEAKNESS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    competitor: { type: 'string' },
    verbatimQuote: { type: 'string' },
    source: { type: 'string' },
    sourceUrl: { type: 'string' },
    whyItMatters: { type: 'string' },
  },
  required: ['competitor', 'verbatimQuote', 'source', 'sourceUrl', 'whyItMatters'],
};

const NARRATIVE_ARC_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    competitor: { type: 'string' },
    villain: { type: 'string' },
    hero: { type: 'string' },
    transformationClaim: { type: 'string' },
    sourceUrl: { type: 'string' },
  },
  required: ['competitor', 'villain', 'hero', 'transformationClaim', 'sourceUrl'],
};

const COMPETITOR_LANDSCAPE_ARTIFACT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sectionTitle: { type: 'string' },
    verdict: { type: 'string' },
    statusSummary: { type: 'string' },
    confidence: { type: 'number' },
    sources: {
      type: 'array',
      items: SOURCE_JSON_SCHEMA,
    },
    competitorSet: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prose: { type: 'string' },
        competitors: {
          type: 'array',
          items: COMPETITOR_JSON_SCHEMA,
        },
      },
      required: ['prose', 'competitors'],
    },
    positioningTaxonomy: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prose: { type: 'string' },
        axes: {
          type: 'array',
          items: POSITIONING_AXIS_JSON_SCHEMA,
        },
      },
      required: ['prose', 'axes'],
    },
    pricingReality: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prose: { type: 'string' },
        dataPoints: {
          type: 'array',
          items: PRICING_DATA_POINT_JSON_SCHEMA,
        },
      },
      required: ['prose', 'dataPoints'],
    },
    shareOfVoice: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prose: { type: 'string' },
        slices: {
          type: 'array',
          items: SHARE_OF_VOICE_SLICE_JSON_SCHEMA,
        },
      },
      required: ['prose', 'slices'],
    },
    publicWeaknesses: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prose: { type: 'string' },
        items: {
          type: 'array',
          items: COMPETITOR_WEAKNESS_JSON_SCHEMA,
        },
      },
      required: ['prose', 'items'],
    },
    narrativeArcs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prose: { type: 'string' },
        arcs: {
          type: 'array',
          items: NARRATIVE_ARC_JSON_SCHEMA,
        },
      },
      required: ['prose', 'arcs'],
    },
  },
  required: [
    'sectionTitle',
    'verdict',
    'statusSummary',
    'confidence',
    'sources',
    'competitorSet',
    'positioningTaxonomy',
    'pricingReality',
    'shareOfVoice',
    'publicWeaknesses',
    'narrativeArcs',
  ],
};

const COMPETITOR_LANDSCAPE_ARTIFACT_SKELETON = {
  sectionTitle: 'Competitor Landscape & Positioning',
  verdict: 'One sentence judgment.',
  statusSummary: 'Two to four sentences summarizing the competitive reality.',
  confidence: 0,
  sources: [
    { title: 'Source title', url: 'https://example.com', whyItMatters: 'Why this source supports the section.' },
  ],
  competitorSet: {
    prose: 'Narrative full competitor set across direct, indirect, status-quo, and DIY.',
    competitors: [
      {
        name: 'Competitor name',
        url: 'https://example.com',
        competitorType: 'direct',
        oneLinePositioning: 'One-line positioning summary.',
        verbatimHeroCopy: 'Observed homepage or campaign copy.',
        pricingPosition: 'Observed pricing posture.',
        sourceUrl: 'https://example.com/source',
      },
    ],
  },
  positioningTaxonomy: {
    prose: 'Narrative positioning taxonomy.',
    axes: [
      {
        axisName: 'Axis name',
        ourPosition: 'How the audited company is positioned on this axis.',
        competitorPositions: [{ competitor: 'Competitor name', position: 'Competitor position.' }],
        evidenceUrl: 'https://example.com/source',
      },
    ],
  },
  pricingReality: {
    prose: 'Narrative pricing reality.',
    dataPoints: [
      {
        competitor: 'Competitor name',
        tierName: 'Tier or pricing label.',
        monthlyPrice: 'Observed price text, gated, or not disclosed.',
        packagingPattern: 'Packaging pattern.',
        gatedSignals: 'Gated or enterprise signals.',
        sourceUrl: 'https://example.com/pricing',
      },
    ],
  },
  shareOfVoice: {
    prose: 'Narrative share-of-voice map.',
    slices: [
      {
        surface: 'Search term, category, community, review, or ad surface.',
        winner: 'Visible owner of this surface.',
        evidence: 'Concrete evidence for the winner.',
        sourceUrl: 'https://example.com/source',
      },
    ],
  },
  publicWeaknesses: {
    prose: 'Narrative public weaknesses.',
    items: [
      {
        competitor: 'Competitor name',
        verbatimQuote: 'Observed review/search/page excerpt text.',
        source: 'Source name',
        sourceUrl: 'https://example.com/reviews',
        whyItMatters: 'Why this changes positioning.',
      },
    ],
  },
  narrativeArcs: {
    prose: 'Narrative competitor arcs.',
    arcs: [
      {
        competitor: 'Competitor name',
        villain: 'Problem or old way named by the competitor.',
        hero: 'Hero mechanism or new way claimed by the competitor.',
        transformationClaim: 'After-state promised by the competitor.',
        sourceUrl: 'https://example.com/source',
      },
    ],
  },
};

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
    adPlatform: process.env.MANAGED_AGENTS_COMPETITOR_AD_PLATFORM ?? DEFAULT_AD_PLATFORM,
    adCompetitorCount: Number(
      process.env.MANAGED_AGENTS_COMPETITOR_AD_COMPETITOR_COUNT ?? DEFAULT_AD_COMPETITOR_COUNT,
    ),
    platformSkillId:
      process.env.MANAGED_AGENTS_COMPETITIVE_POSITIONING_SKILL_ID ??
      DEFAULT_COMPETITIVE_POSITIONING_SKILL_ID,
    attachPlatformSkill: process.env.MANAGED_AGENTS_COMPETITOR_DISABLE_PLATFORM_SKILL !== 'true',
    environmentId: process.env.MANAGED_AGENTS_COMPETITOR_ENVIRONMENT_ID ?? '',
    agentId: process.env.MANAGED_AGENTS_COMPETITOR_AGENT_ID ?? '',
    sessionId: process.env.MANAGED_AGENTS_COMPETITOR_SESSION_ID ?? '',
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
    } else if (token === '--ad-platform' && next) {
      args.adPlatform = next;
      index += 1;
    } else if (token === '--ad-competitor-count' && next) {
      args.adCompetitorCount = Number(next);
      index += 1;
    } else if (token === '--platform-skill-id' && next) {
      args.platformSkillId = next;
      index += 1;
    } else if (token === '--no-platform-skill') {
      args.attachPlatformSkill = false;
    } else if (token === '--reuse-environment-id' && next) {
      args.environmentId = next;
      index += 1;
    } else if (token === '--reuse-agent-id' && next) {
      args.agentId = next;
      index += 1;
    } else if (token === '--reuse-session-id' && next) {
      args.sessionId = next;
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
  if (!AD_PLATFORMS.has(args.adPlatform)) {
    throw new Error('--ad-platform must be one of all, google, linkedin, meta');
  }
  if (!Number.isInteger(args.adCompetitorCount) || args.adCompetitorCount < 0 || args.adCompetitorCount > 10) {
    throw new Error('--ad-competitor-count must be an integer between 0 and 10');
  }
  if (args.attachPlatformSkill && !args.platformSkillId.trim()) {
    throw new Error('--platform-skill-id is required unless --no-platform-skill is used');
  }

  return args;
}

function printHelpAndExit() {
  console.log(`Usage: node scripts/managed-agents-competitor-section-canary.mjs [options]

Runs the P2 Managed Agents canary for Section 03:
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
  --limit <n>                     Evidence result cap per call, 1-25. Default: ${DEFAULT_LIMIT}
  --model <model>                 Managed Agent model. Default: ${DEFAULT_MODEL}
  --ad-platform <platform>        Ad platform for mandatory ad calls: all, google, linkedin, meta. Default: ${DEFAULT_AD_PLATFORM}
  --ad-competitor-count <n>       Minimum direct competitors requiring ad evidence. Default: ${DEFAULT_AD_COMPETITOR_COUNT}
  --platform-skill-id <skill_id>  AI-GOS competitive-positioning skill ID. Default: ${DEFAULT_COMPETITIVE_POSITIONING_SKILL_ID}
  --no-platform-skill             Do not attach the AI-GOS competitive-positioning platform skill.
  --reuse-environment-id <env>    Reuse an existing environment.
  --reuse-agent-id <agent>        Reuse an existing agent.
  --reuse-session-id <session>    Reconnect to an existing session without sending a new user message.
  --no-deliberate-invalid-save    Skip the intentional first invalid save probe.

Optional reuse env:
  MANAGED_AGENTS_COMPETITOR_ENVIRONMENT_ID=env_...
  MANAGED_AGENTS_COMPETITOR_AGENT_ID=agent_...
  MANAGED_AGENTS_COMPETITOR_SESSION_ID=sesn_...
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
      'anthropic-beta': ANTHROPIC_BETA_HEADER,
      'X-Api-Key': apiKey,
    },
  });
}

async function anthropicSkillsRequest(path, options = {}) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  return await fetchJson(`${ANTHROPIC_API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
    label: `Anthropic ${options.method ?? 'GET'} ${path}`,
    timeoutMs: options.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': SKILLS_BETA,
      'X-Api-Key': apiKey,
    },
  });
}

async function createEnvironment(args) {
  if (args.environmentId.trim()) {
    console.log(`[managed-agents] reusing environment ${args.environmentId}`);
    return { id: args.environmentId, reused: true };
  }

  const name = `aigos-p2-competitor-section-${Date.now()}`;
  const environment = await anthropicRequest('/environments', {
    method: 'POST',
    body: {
      name,
      description: 'AI-GOS P2 Managed Agents Competitor Landscape canary environment.',
      metadata: { project: 'AI-GOS', phase: 'managed-agents-p2', section: 'positioningCompetitorLandscape' },
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
      'Fetch bounded multi-platform public ad evidence for one advertiser across Google Ads Transparency, LinkedIn Ad Library, Meta Ad Library, or all platforms. AI-GOS executes SearchAPI locally and returns raw counts separately from displayable creative cards. Do not invent missing ad copy; report sparse platform rows as data gaps.',
    input_schema: {
      type: 'object',
      properties: {
        advertiser_name: { type: 'string' },
        domain: { type: ['string', 'null'] },
        platform: { type: 'string', enum: ['all', 'google', 'linkedin', 'meta'] },
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

function stripUnsupportedToolSchemaKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripUnsupportedToolSchemaKeywords(item));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'additionalProperties')
      .map(([key, child]) => [key, stripUnsupportedToolSchemaKeywords(child)]),
  );
}

function buildSaveTool() {
  return {
    type: 'custom',
    name: 'save_competitor_landscape_artifact',
    description:
      [
        'Validate the completed Section 03 Competitor Landscape Artifact.',
        'Use this only after building the complete artifact with the exact nested key names in the schema.',
        'Every competitor requires name, url, competitorType, oneLinePositioning, verbatimHeroCopy, pricingPosition, and sourceUrl.',
        'Every sub-section requires prose plus its typed array: competitorSet.competitors, positioningTaxonomy.axes, pricingReality.dataPoints, shareOfVoice.slices, publicWeaknesses.items, narrativeArcs.arcs.',
        'Returns ok:true only when CompetitorLandscapeArtifactSchema.safeParse and validateCompetitorLandscapeMinimums pass.',
        'Returns ok:false with repair_feedback for business validation failures; revise the same artifact shape and retry.',
      ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        artifact: stripUnsupportedToolSchemaKeywords(COMPETITOR_LANDSCAPE_ARTIFACT_JSON_SCHEMA),
      },
      required: ['artifact'],
    },
  };
}

function buildSystemPrompt(args) {
  return [
    'You are the AI-GOS Managed Agents canary for Section 03: Competitor Landscape & Positioning.',
    'Your objective is to produce exactly one CompetitorLandscapeArtifact for the audited company and submit it through save_competitor_landscape_artifact.',
    'Use only evidence returned by AI-GOS custom tools. Do not invent market data, pricing, competitor claims, ad copy, review quotes, URLs, or source titles.',
    'Ad evidence is mandatory for this P2 run. Use fetch_competitor_ads with platform "all" for the audited company and at least the first direct competitors you discover.',
    `Minimum direct competitors requiring ad evidence: ${args.adCompetitorCount}. Preferred ad platform request: ${args.adPlatform}.`,
    'Report raw ad-library source counts separately from displayable creative counts. Raw Google transparency rows are source evidence, not creative proof, when they lack useful copy, image, video, or detail-link evidence.',
    'If Google Ads Transparency, LinkedIn, or Meta rows lack headline/body/media fields, report that as a source gap rather than filling copy.',
    'The final artifact must include top-level fields sectionTitle, verdict, statusSummary, confidence, sources, competitorSet, positioningTaxonomy, pricingReality, shareOfVoice, publicWeaknesses, and narrativeArcs.',
    'Use this exact nested shape. Do not rename keys to type, summary, positioning, pricing, quote, evidence, or weaknesses:',
    JSON.stringify(COMPETITOR_LANDSCAPE_ARTIFACT_SKELETON, null, 2),
    'Minimums: sources >=5; competitors >=5 and include direct, indirect, status-quo, diy; positioningTaxonomy.axes >=3; pricingReality.dataPoints >=3 across >=3 competitors; shareOfVoice.slices >=3; publicWeaknesses.items >=4 across >=2 competitors; narrativeArcs.arcs >=3; confidence 0-10.',
    'Use publicWeaknesses.items.verbatimQuote only for text observed in review/search snippets or page excerpts. If the source is a snippet, keep it short and attribute the source URL.',
    'When save_competitor_landscape_artifact returns ok:false, treat repair_feedback as normal validation feedback and call the save tool again after revising. Do not stop after a failed save.',
    'After the save tool returns ok:true, send a concise final message with the accepted verdict, confidence, and any data gaps.',
  ].join('\n');
}

async function createAgent(args) {
  if (args.agentId.trim()) {
    console.log(`[managed-agents] reusing agent ${args.agentId}`);
    try {
      const agent = await anthropicRequest(`/agents/${args.agentId}`, { method: 'GET' });
      const skills = Array.isArray(agent.skills) ? agent.skills : [];
      const hasPlatformSkill = skills.some((skill) => (
        skill?.type === 'custom' && skill?.skill_id === args.platformSkillId
      ));
      return {
        id: args.agentId,
        version: agent.version,
        reused: true,
        raw: agent,
        skillWiring: hasPlatformSkill
          ? {
              status: 'attached',
              skill: skills.find((skill) => skill?.skill_id === args.platformSkillId),
              evidence: 'GET /v1/agents/{agent_id} returned the AI-GOS competitive-positioning skill on the reused Managed Agent.',
            }
          : {
              status: 'not_attached',
              reason: 'GET /v1/agents/{agent_id} did not return the AI-GOS competitive-positioning skill on the reused Managed Agent.',
            },
      };
    } catch (error) {
      return {
        id: args.agentId,
        reused: true,
        skillWiring: {
          status: 'unknown_reused_agent',
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  const baseBody = {
    name: `AI-GOS Competitor Landscape P2 ${Date.now()}`,
    description: 'Internal AI-GOS Managed Agents P2 canary for one Section 03 artifact with multi-platform ad evidence.',
    metadata: { project: 'AI-GOS', phase: 'managed-agents-p2', section: 'positioningCompetitorLandscape' },
    model: args.model,
    system: buildSystemPrompt(args),
    tools: [
      {
        type: 'agent_toolset_20260401',
        default_config: { enabled: false },
        configs: [{ name: 'read', enabled: true }],
      },
      buildFetchCompetitorAdsTool(),
      buildHomepageTool(),
      buildPricingTool(),
      buildReviewTool(),
      buildShareOfVoiceTool(),
      buildSaveTool(),
    ],
  };
  const skillRef = {
    type: 'custom',
    skill_id: args.platformSkillId,
    version: 'latest',
  };
  const bodyWithSkill = args.attachPlatformSkill
    ? { ...baseBody, skills: [skillRef] }
    : baseBody;

  try {
    const agent = await anthropicRequest('/agents', {
      method: 'POST',
      body: bodyWithSkill,
    });
    console.log(`[managed-agents] created agent ${agent.id} version ${agent.version}`);
    return {
      id: agent.id,
      version: agent.version,
      reused: false,
      raw: agent,
      skillWiring: args.attachPlatformSkill
        ? {
            status: 'attached',
            skill: skillRef,
            evidence: 'POST /v1/agents accepted the top-level skills field for the AI-GOS competitive-positioning custom skill.',
          }
        : {
            status: 'not_requested',
            reason: '--no-platform-skill was used.',
          },
    };
  } catch (error) {
    if (!args.attachPlatformSkill) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.log(`[managed-agents] platform skill attachment blocked: ${message}`);
    console.log('[managed-agents] retrying agent creation without platform skill');
    const agent = await anthropicRequest('/agents', {
      method: 'POST',
      body: baseBody,
    });
    console.log(`[managed-agents] created fallback agent ${agent.id} version ${agent.version}`);
    return {
      id: agent.id,
      version: agent.version,
      reused: false,
      raw: agent,
      skillWiring: {
        status: 'blocked',
        skill: skillRef,
        error: message,
        fallback: 'Created the Managed Agent without skills and relied on the hardcoded Section 03 prompt plus local custom tools.',
      },
    };
  }
}

async function createSession(agentId, environmentId, args) {
  const session = await anthropicRequest('/sessions', {
    method: 'POST',
    body: {
      agent: agentId,
      environment_id: environmentId,
      metadata: {
        project: 'AI-GOS',
        phase: 'managed-agents-p2',
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

function loadManagedAgentsAdEvidenceAdapter() {
  registerTypeScriptRequireHook();
  return requireFromRoot('./research-worker/src/tools/managed-agents-ad-evidence.ts');
}

async function fetchCompetitorAds(input, args) {
  const data = assertRecord(input, 'fetch_competitor_ads input');
  const advertiserName = typeof data.advertiser_name === 'string' ? data.advertiser_name.trim() : '';
  const platform = typeof data.platform === 'string' ? data.platform : args.adPlatform;
  const limit = clampLimit(data.limit, args.limit, 25);
  const region = typeof data.region === 'string' ? data.region : args.region;
  const domain =
    typeof data.domain === 'string' && data.domain.trim().length > 0
      ? normalizeDomain(data.domain)
      : null;

  if (!advertiserName) return { ok: false, error: 'advertiser_name is required' };
  if (!AD_PLATFORMS.has(platform)) {
    return { ok: false, error: `Unsupported ad platform: ${platform}` };
  }

  const { fetchManagedAgentsAdEvidence } = loadManagedAgentsAdEvidenceAdapter();
  return await fetchManagedAgentsAdEvidence({
    advertiser_name: advertiserName,
    domain,
    platform,
    region,
    limit,
  });
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
    const repairFeedback = [
      'Schema validation failed. Keep the exact CompetitorLandscapeArtifact shape and patch these paths:',
      ...errors,
      'Canonical skeleton:',
      JSON.stringify(COMPETITOR_LANDSCAPE_ARTIFACT_SKELETON),
    ].join('\n');
    return {
      ok: false,
      schema_ok: false,
      minimums_ok: false,
      errors,
      repair_feedback: repairFeedback,
    };
  }

  const minimums = validateCompetitorLandscapeMinimums(parsed.data);
  if (!minimums.ok) {
    const repairFeedback = [
      'Business minimum validation failed. Keep the schema-valid shape and add evidence to satisfy these minimums:',
      ...minimums.errors,
    ].join('\n');
    return {
      ok: false,
      schema_ok: true,
      minimums_ok: false,
      errors: minimums.errors,
      repair_feedback: repairFeedback,
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
  const adEvidenceResults = [];
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
    if (toolEvent.name === 'fetch_competitor_ads') {
      const result = await fetchCompetitorAds(toolEvent.input, args);
      if (result?.ok === true) {
        adEvidenceResults.push(result);
      }
      return result;
    }
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
    getAdEvidenceResults: () => adEvidenceResults,
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

function parseCustomToolResult(event) {
  if (event?.type !== 'user.custom_tool_result') return null;
  const text = extractTextContent(event);
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isAdEvidenceResult(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      value.ok === true &&
      typeof value.advertiser_name === 'string' &&
      value.raw_counts &&
      value.displayable_counts &&
      Array.isArray(value.adCreatives) &&
      value.libraryLinks,
  );
}

function getAdEvidenceResultsFromEvents(events) {
  return events
    .map(parseCustomToolResult)
    .filter(isAdEvidenceResult);
}

function getAcceptedArtifactFromEvents(events) {
  const acceptedResultEvent = events.find((event) => {
    const result = parseCustomToolResult(event);
    return result?.accepted === true;
  });
  const toolUseId = acceptedResultEvent?.custom_tool_use_id;
  if (!toolUseId) return null;

  const toolUse = events.find((event) => event.id === toolUseId && event.type === 'agent.custom_tool_use');
  const artifact = toolUse?.input?.artifact;
  return artifact && typeof artifact === 'object' && !Array.isArray(artifact) ? artifact : null;
}

function getValidationAttemptsFromEvents(events) {
  return events
    .map(parseCustomToolResult)
    .filter((result) => (
      result &&
      typeof result === 'object' &&
      result.section_type === 'positioningCompetitorLandscape' &&
      typeof result.attempt === 'number'
    ))
    .map((result) => ({
      attempt: result.attempt,
      ok: result.ok === true,
      schema_ok: result.schema_ok === true,
      minimums_ok: result.minimums_ok === true,
      errors: Array.isArray(result.errors) ? result.errors : [],
    }));
}

function mergeAdEvidenceResults(primary, secondary) {
  const keyed = new Map();
  for (const result of [...primary, ...secondary]) {
    const key = [
      normalizeName(result.advertiser_name),
      result.requested_platform,
      result.observed_at,
    ].join('|');
    keyed.set(key, result);
  }
  return [...keyed.values()];
}

async function listEvents(sessionId) {
  return await anthropicRequest(`/sessions/${sessionId}/events?order=asc&limit=200`, {
    method: 'GET',
  });
}

async function getSessionEvents(sessionId) {
  const listed = await listEvents(sessionId);
  return Array.isArray(listed.data) ? listed.data : [];
}

function countToolCallsFromEvents(events) {
  return events
    .filter((event) => event.type === 'agent.custom_tool_use')
    .reduce((counts, event) => ({
      ...counts,
      [event.name ?? 'unknown']: (counts[event.name ?? 'unknown'] ?? 0) + 1,
    }), {});
}

function getFinalMessagesFromEvents(events) {
  return events
    .filter((event) => event.type === 'agent.message')
    .map(extractTextContent)
    .filter(Boolean);
}

function isSessionEndTurn(events) {
  const lastStatus = [...events]
    .reverse()
    .find((event) => (
      event.type === 'session.status_idle' ||
      event.type === 'session.status_idled' ||
      event.type === 'session.thread_status_idle'
    ));
  return lastStatus?.stop_reason?.type === 'end_turn';
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
      'anthropic-beta': ANTHROPIC_BETA_HEADER,
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
    `5. Mandatory ad evidence: call fetch_competitor_ads with platform "${args.adPlatform}" for the audited company and at least ${args.adCompetitorCount} direct competitors you discovered. Use domain when known, region "${args.region}", and limit ${args.limit}.`,
    '6. In your synthesis, report raw ad-library counts separately from displayable creative counts. Cite sparse or missing Google/LinkedIn/Meta fields honestly and do not invent ad copy.',
    '7. Build the artifact with the exact schema skeleton below, filling every nested string/array with evidence-backed content.',
    JSON.stringify(COMPETITOR_LANDSCAPE_ARTIFACT_SKELETON, null, 2),
    '8. Call save_competitor_landscape_artifact only after the mandatory ad evidence calls are complete or explicitly returned empty. If it returns ok:false, repair and retry once.',
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

  let adEvidencePath = null;
  if (Array.isArray(payload.adEvidenceResults) && payload.adEvidenceResults.length > 0) {
    adEvidencePath = resolve(tmpDir, `managed-agents-competitor-section-canary-${stamp}-ad-evidence.json`);
    writeFileSync(adEvidencePath, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      sessionId: payload.session?.id,
      args: payload.args,
      environment: payload.environment,
      agent: {
        id: payload.agent?.id,
        version: payload.agent?.version,
        reused: payload.agent?.reused,
      },
      skillProbe: payload.skillProbe,
      skillWiring: payload.agent?.skillWiring,
      adEvidenceResults: payload.adEvidenceResults,
    }, null, 2)}\n`);
  }

  return { transcriptPath, artifactPath, adEvidencePath };
}

function assertCanaryPassed(args, validationAttempts, acceptedArtifact) {
  if (!acceptedArtifact) {
    throw new Error('Canary did not produce an accepted CompetitorLandscapeArtifact');
  }

  if (args.deliberateInvalidFirstSave && !args.sessionId.trim()) {
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

async function verifyPlatformSkill(args) {
  if (!args.attachPlatformSkill) {
    return {
      status: 'not_requested',
      reason: '--no-platform-skill was used.',
    };
  }

  try {
    const skill = await anthropicSkillsRequest(`/skills/${args.platformSkillId}`, {
      method: 'GET',
    });
    return {
      status: 'available',
      skill: {
        id: skill.id,
        display_title: skill.display_title,
        source: skill.source,
        latest_version: skill.latest_version,
      },
    };
  } catch (error) {
    return {
      status: 'blocked',
      skill: { id: args.platformSkillId },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function assertAdEvidencePassed(args, adEvidenceResults) {
  const minimumAdvertisers = args.adCompetitorCount + 1;
  const advertiserNames = [
    ...new Set(
      adEvidenceResults
        .map((result) => result.advertiser_name)
        .filter((name) => typeof name === 'string' && name.trim().length > 0)
        .map((name) => normalizeName(name)),
    ),
  ];
  const allPlatformCalls = adEvidenceResults.filter((result) => result.requested_platform === 'all');
  const nonGoogleDisplayable = adEvidenceResults.some((result) => (
    (result.displayable_counts?.linkedin ?? 0) > 0 ||
    (result.displayable_counts?.meta ?? 0) > 0
  ));
  const nonGoogleRaw = adEvidenceResults.some((result) => (
    (result.raw_counts?.linkedin ?? 0) > 0 ||
    (result.raw_counts?.meta ?? 0) > 0
  ));

  if (adEvidenceResults.length < minimumAdvertisers) {
    throw new Error(
      `Expected ad evidence for audited company plus ${args.adCompetitorCount} direct competitors, observed ${adEvidenceResults.length} successful ad evidence result(s)`,
    );
  }
  if (advertiserNames.length < minimumAdvertisers) {
    throw new Error(
      `Expected ad evidence for at least ${minimumAdvertisers} distinct advertisers, observed ${advertiserNames.length}: ${advertiserNames.join(', ')}`,
    );
  }
  if (allPlatformCalls.length === 0) {
    throw new Error('Expected at least one fetch_competitor_ads result with requested_platform="all"');
  }
  if (!nonGoogleRaw) {
    throw new Error('Expected at least one LinkedIn or Meta raw ad result; source APIs returned no non-Google rows');
  }
  if (!nonGoogleDisplayable) {
    throw new Error('Expected at least one LinkedIn or Meta displayable creative; source APIs returned no displayable non-Google creatives');
  }
}

async function main() {
  loadEnvFile(resolve('.env.local'));
  loadEnvFile(resolve('research-worker/.env'));
  const args = parseArgs(process.argv.slice(2));

  requireEnv('ANTHROPIC_API_KEY');
  requireEnv('SEARCHAPI_KEY');

  console.log('[managed-agents] starting P2 competitor section canary');
  console.log(
    `[managed-agents] company=${args.company} domain=${args.domain || 'n/a'} region=${args.region} limit=${args.limit} model=${args.model}`,
  );
  console.log(
    `[managed-agents] ad_platform=${args.adPlatform} ad_competitor_count=${args.adCompetitorCount} platform_skill=${args.attachPlatformSkill ? args.platformSkillId : 'disabled'}`,
  );
  console.log(
    `[managed-agents] deliberate_invalid_first_save=${args.deliberateInvalidFirstSave ? 'true' : 'false'}`,
  );

  const skillProbe = await verifyPlatformSkill(args);
  console.log(`[managed-agents] skill probe: ${JSON.stringify(skillProbe)}`);
  const environment = await createEnvironment(args);
  const agent = await createAgent(args);
  const session = args.sessionId.trim()
    ? { id: args.sessionId.trim(), status: 'reused' }
    : await createSession(agent.id, environment.id, args);
  const executor = createToolExecutor(args);

  if (args.sessionId.trim()) {
    console.log(`[managed-agents] reusing session ${session.id}`);
  } else {
    await sendEvents(session.id, [
      { type: 'user.message', content: [{ type: 'text', text: buildUserMessage(args) }] },
    ]);
  }

  const preStreamEvents = args.sessionId.trim() ? await getSessionEvents(session.id) : [];
  const streamResult = isSessionEndTurn(preStreamEvents)
    ? {
        transcript: preStreamEvents,
        finalMessages: getFinalMessagesFromEvents(preStreamEvents),
        handledToolUseCount: 0,
        toolCallCounts: countToolCallsFromEvents(preStreamEvents),
      }
    : await streamSession(session.id, executor);
  const postStreamEvents = await getSessionEvents(session.id);
  const transcriptEvents = postStreamEvents.length >= streamResult.transcript.length
    ? postStreamEvents
    : streamResult.transcript;
  const fullStreamResult = {
    ...streamResult,
    transcript: transcriptEvents,
    finalMessages: getFinalMessagesFromEvents(transcriptEvents),
    toolCallCounts: countToolCallsFromEvents(transcriptEvents),
  };
  const validationAttempts = executor.getValidationAttempts().length > 0
    ? executor.getValidationAttempts()
    : getValidationAttemptsFromEvents(transcriptEvents);
  const adEvidenceResults = mergeAdEvidenceResults(
    executor.getAdEvidenceResults(),
    getAdEvidenceResultsFromEvents(transcriptEvents),
  );
  const acceptedArtifact = executor.getAcceptedArtifact() ?? getAcceptedArtifactFromEvents(transcriptEvents);
  const outputPayload = {
    args,
    skillProbe,
    environment,
    agent,
    session: { id: session.id, status: session.status },
    validationAttempts,
    adEvidenceResults,
    acceptedArtifact,
    ...fullStreamResult,
  };
  const outputPaths = writeOutputs(outputPayload);

  try {
    assertCanaryPassed(args, validationAttempts, acceptedArtifact);
    assertAdEvidencePassed(args, adEvidenceResults);
  } catch (error) {
    console.log(`[managed-agents] transcript: ${outputPaths.transcriptPath}`);
    if (outputPaths.artifactPath) console.log(`[managed-agents] artifact: ${outputPaths.artifactPath}`);
    if (outputPaths.adEvidencePath) console.log(`[managed-agents] ad evidence: ${outputPaths.adEvidencePath}`);
    throw error;
  }

  console.log(`[managed-agents] handled custom tool calls: ${fullStreamResult.handledToolUseCount}`);
  console.log(`[managed-agents] tool calls: ${JSON.stringify(fullStreamResult.toolCallCounts)}`);
  console.log(`[managed-agents] validation attempts: ${JSON.stringify(validationAttempts)}`);
  console.log(`[managed-agents] ad evidence results: ${adEvidenceResults.length}`);
  console.log(`[managed-agents] transcript: ${outputPaths.transcriptPath}`);
  if (outputPaths.artifactPath) console.log(`[managed-agents] artifact: ${outputPaths.artifactPath}`);
  if (outputPaths.adEvidencePath) console.log(`[managed-agents] ad evidence: ${outputPaths.adEvidencePath}`);
}

main().catch((error) => {
  console.error(`[managed-agents] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
