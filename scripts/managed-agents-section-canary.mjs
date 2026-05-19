#!/usr/bin/env node

// Phase 1 Managed Agents section canary.
//
// Runs one positioning audit section (positioningMarketCategory by default)
// through the Managed Agents path end-to-end:
//
//   1. Create / reuse environment + specialist + coordinator
//   2. Open a session and post a user.message with the kickoff context
//   3. Stream events; locally execute custom-tool calls
//   4. Validate the produced artifact against the mirrored Zod schema
//   5. Save the transcript + accepted artifact to tmp/
//
// This canary mirrors the Phase 0 / Phase 2 competitor canaries but speaks
// the Phase 1 contract: section_run_id is required in every save_* input.
//
// Usage:
//   node scripts/managed-agents-section-canary.mjs --section positioningMarketCategory --advertiser "monday.com" --domain monday.com

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const requireFromRoot = createRequire(resolve('package.json'));

const ANTHROPIC_API_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';
const SKILLS_BETA = 'skills-2025-10-02';
const COMBINED_BETA_HEADER = `${MANAGED_AGENTS_BETA},${SKILLS_BETA}`;
const REQUEST_TIMEOUT_MS = 60_000;
const STREAM_TIMEOUT_MS = 12 * 60_000;

const SECTION_TO_TOOL = {
  positioningMarketCategory: 'save_market_category_artifact',
  positioningBuyerICP: 'save_buyer_icp_artifact',
  positioningCompetitorLandscape: 'save_competitor_landscape_artifact',
  positioningVoiceOfCustomer: 'save_voice_of_customer_artifact',
  positioningDemandIntent: 'save_demand_intent_artifact',
  positioningOfferDiagnostic: 'save_offer_diagnostic_artifact',
};

const SPECIALIST_TO_SECTION = {
  MarketCategory: 'positioningMarketCategory',
  marketCategory: 'positioningMarketCategory',
  market_category: 'positioningMarketCategory',
  'market-category': 'positioningMarketCategory',
  BuyerICP: 'positioningBuyerICP',
  buyerICP: 'positioningBuyerICP',
  buyer_icp: 'positioningBuyerICP',
  'buyer-icp': 'positioningBuyerICP',
  CompetitorLandscape: 'positioningCompetitorLandscape',
  competitorLandscape: 'positioningCompetitorLandscape',
  competitor_landscape: 'positioningCompetitorLandscape',
  'competitor-landscape': 'positioningCompetitorLandscape',
  VoiceOfCustomer: 'positioningVoiceOfCustomer',
  voiceOfCustomer: 'positioningVoiceOfCustomer',
  voice_of_customer: 'positioningVoiceOfCustomer',
  'voice-of-customer': 'positioningVoiceOfCustomer',
  DemandIntent: 'positioningDemandIntent',
  demandIntent: 'positioningDemandIntent',
  demand_intent: 'positioningDemandIntent',
  'demand-intent': 'positioningDemandIntent',
  OfferDiagnostic: 'positioningOfferDiagnostic',
  offerDiagnostic: 'positioningOfferDiagnostic',
  offer_diagnostic: 'positioningOfferDiagnostic',
  'offer-diagnostic': 'positioningOfferDiagnostic',
};

const SECTION_TO_SCHEMA_FILE = {
  positioningMarketCategory: 'market-category.ts',
  positioningBuyerICP: 'buyer-icp.ts',
  positioningCompetitorLandscape: 'competitor-landscape.ts',
  positioningVoiceOfCustomer: 'voc-objection-evidence.ts',
  positioningDemandIntent: 'demand-intent-signals.ts',
  positioningOfferDiagnostic: 'offer-performance-diagnostic.ts',
};

const SECTION_TO_VALIDATOR = {
  positioningMarketCategory: [
    'MarketCategoryArtifactSchema',
    'validateMarketCategoryMinimums',
  ],
  positioningBuyerICP: ['BuyerICPArtifactSchema', 'validateBuyerICPMinimums'],
  positioningCompetitorLandscape: [
    'CompetitorLandscapeArtifactSchema',
    'validateCompetitorLandscapeMinimums',
  ],
  positioningVoiceOfCustomer: [
    'VoiceOfCustomerArtifactSchema',
    'validateVoiceOfCustomerMinimums',
  ],
  positioningDemandIntent: [
    'DemandIntentArtifactSchema',
    'validateDemandIntentMinimums',
  ],
  positioningOfferDiagnostic: [
    'OfferPerformanceArtifactSchema',
    'validateOfferPerformanceMinimums',
  ],
};

const SHARED_FIELDS_HEADER = `All sections share these required top-level fields:
  - sectionTitle: string
  - verdict: string (one-paragraph judgment)
  - statusSummary: string (status sentence)
  - confidence: number in [0, 10]
  - sources: Array<{ title: string, url: string (HTTPS), whyItMatters?: string }>

Every url, sourceUrl, evidenceUrl field must be a valid HTTPS URL (regex: ^https?:\\/\\/\\S+\\.\\S+).`;

const SECTION_TO_GUIDE = {
  positioningMarketCategory: `Section 01 — positioningMarketCategory (Market & Category Intelligence).

${SHARED_FIELDS_HEADER}

Section-specific shape:
  sources: >= 3 distinct.

  categoryDefinition: {
    prose: string,
    adjacentCategories: Array of >= 2 of { name, whyBuyersConfuseIt, disambiguatingSignal, sourceTitle?, sourceUrl? }
  }

  marketSize: {
    prose: string,
    signals: Array of >= 3 of { signalType, name, evidence, trajectory, methodology, sourceTitle, sourceUrl, dateObserved }
      signalType ∈ {public-data, funding-flow, hiring-velocity, search-trend, analyst-report} — UNIQUE per signal (no duplicate signalTypes)
      trajectory ∈ {expanding, stable, contracting, unclear}
      methodology ∈ {top-down, bottom-up} — TRIANGULATION REQUIRED: include >= 1 top-down AND >= 1 bottom-up
  }

  structuralForces: {
    prose: string,
    forces: Array of >= 3 of { forceType, name, evidence, implication, impact, direction, sourceTitle?, sourceUrl? }
      forceType ∈ {regulation, platform-shift, buyer-behavior} — MUST cover ALL THREE, one per type (no duplicates)
      impact ∈ {high, medium, low}
      direction ∈ {accelerating, decelerating, neutral}
  }

  categoryMaturity: {
    prose: string,
    classification: {
      stage ∈ {emerging, growing, consolidating, commoditizing},
      evidenceSummary: string,
      supportingSignals: Array of >= 2 of { signalType, evidence, implication, sourceUrl? }
        signalType ∈ {player-count, buyer-education, feature-parity, price-pressure, platform-bundling}
    }
  }`,

  positioningBuyerICP: `Section 02 — positioningBuyerICP (Buyer & ICP Validation).

${SHARED_FIELDS_HEADER}

Section-specific shape:
  icpExistenceCheck: {
    prose: string,
    firmographicCuts: Array of >= 3 of { cutType, value, accountCount?, source, sourceUrl, dateObserved }
      cutType ∈ {industry, employeeBands, revenueBands, geography, techStack} — UNIQUE per cut (one per dimension, no duplicates)
  }

  personaReality: {
    prose: string,
    personas: Array of >= 5 of { name, title, company, sourceUrl, role, seniority, teamSize?, evidence }
      role ∈ {champion, economic-buyer, decision-maker, influencer, end-user, gatekeeper}
      personas MUST be named real persons at named real ICP companies, with sourceUrl evidence
  }

  awarenessDistribution: {
    prose: string,
    levels: Array of EXACTLY 5 of { level, share, evidence, sampleQuery? }
      level MUST cover all 5 Schwartz levels: {unaware, problem-aware, solution-aware, product-aware, most-aware} (one per level, no duplicates)
  }

  buyingContext: {
    prose: string,
    triggers: Array of >= 3 of { name, detectionSignal, window, evidence, sourceUrl? }
      window ∈ {immediate, weeks, quarters}
  }

  clusters: {
    prose: string,
    venues: Array of { bucketType, name, audienceSize, sourceUrl, whyItMatters }
      bucketType ∈ {community, newsletter, conference, podcast, slack-group, event}
      REQUIRED: >= 2 venues with bucketType=community AND >= 2 venues with bucketType=newsletter
  }`,

  positioningCompetitorLandscape: `Section 03 — positioningCompetitorLandscape (Competitor Landscape & Positioning).

${SHARED_FIELDS_HEADER}

Section-specific shape:
  sources: >= 5 distinct.

  competitorSet: {
    prose: string,
    competitors: Array of >= 5 of { name, url, competitorType, oneLinePositioning, verbatimHeroCopy, pricingPosition, sourceUrl }
      competitorType ∈ {direct, indirect, status-quo, diy} — MUST cover ALL FOUR types
  }

  positioningTaxonomy: {
    prose: string,
    axes: Array of >= 3 of { axisName, ourPosition, competitorPositions: [{competitor, position}, ...], evidenceUrl }
  }

  pricingReality: {
    prose: string,
    dataPoints: Array of >= 3 of { competitor, tierName, monthlyPrice, packagingPattern, gatedSignals, sourceUrl }
      MUST cover >= 3 distinct competitors
  }

  shareOfVoice: {
    prose: string,
    slices: Array of >= 3 of { surface, winner, evidence, sourceUrl }
  }

  publicWeaknesses: {
    prose: string,
    items: Array of >= 4 of { competitor, verbatimQuote, source, sourceUrl, whyItMatters }
      MUST cover >= 2 distinct competitors
  }

  narrativeArcs: {
    prose: string,
    arcs: Array of >= 3 of { competitor, villain, hero, transformationClaim, sourceUrl }
  }`,

  positioningVoiceOfCustomer: `Section 04 — positioningVoiceOfCustomer (Voice of Customer & Objection Evidence).

${SHARED_FIELDS_HEADER}

Section-specific shape:
  sources: >= 5 distinct.

  painLanguage: {
    prose: string,
    quotes: Array of >= 10 of { verbatimText, source, sourceUrl, painTheme, painIntensity }
      source ∈ {g2, reddit, hackernews, sales-call, support-thread, twitter, other}
      painIntensity ∈ {high, medium, low}
      REQUIRED: >= 3 distinct source hosts (use real domains, not the same site repeatedly)
  }

  objections: {
    prose: string,
    items: Array of >= 5 of { objectionText, category, frequency, howToHandle, sourceUrl }
      category ∈ {price, feature, trust, switching-cost, timing, stakeholder, other}
      frequency ∈ {recurring, occasional, one-off}
      REQUIRED: >= 3 distinct categories
  }

  switchingStories: {
    prose: string,
    stories: Array of >= 3 of { priorSolution, reasonToLeave, decisionPath, exampleCompany?, sourceUrl }
      REQUIRED: >= 2 distinct priorSolutions
  }

  decisionCriteria: {
    prose: string,
    criteria: Array of >= 5 of { criterion, statedBy, evidenceQuote, sourceUrl }
      statedBy ∈ {buyer, champion, influencer, blocker}
  }

  successLanguage: {
    prose: string,
    quotes: Array of >= 5 of { verbatimText, source, sourceUrl, afterStatePattern }
      source ∈ {g2, reddit, hackernews, sales-call, support-thread, twitter, other}
  }`,

  positioningDemandIntent: `Section 05 — positioningDemandIntent (Demand & Intent Signals).

${SHARED_FIELDS_HEADER}

Section-specific shape:
  sources: >= 5 distinct.

  keywordDemand: {
    prose: string,
    keywords: Array of >= 10 of { keyword, monthlyVolume, intentType, top3RankingDomains: [string,...], sourceTitle, sourceUrl, dateObserved }
      intentType ∈ {informational, commercial, transactional, navigational}
      top3RankingDomains MUST be a non-empty array of domain strings
  }

  questionMining: {
    prose: string,
    questions: Array of >= 10 of { question, surface, sourceUrl, frequency }
      surface ∈ {paa, reddit, quora, community, forum, support-thread} — REQUIRED: >= 2 distinct surfaces
      frequency ∈ {recurring, occasional}
  }

  contentGaps: {
    prose: string,
    gaps: Array of >= 3 of { topic, evidenceOfDemand, weakCompetitorAnswerEvidence, opportunity }
  }

  intentSignals: {
    prose: string,
    items: Array of >= 5 of { signalType, description, sourceUrl, exampleCompany? }
      signalType ∈ {job-posting, rfp, news-trigger, funding, leadership-change} — REQUIRED: >= 2 distinct signalTypes
  }

  venueMap: {
    prose: string,
    venues: Array of >= 4 of { name, venueType, audienceSize, sourceUrl }
      venueType ∈ {event, community, newsletter, podcast, slack} — REQUIRED: >= 2 distinct venueTypes
  }`,

  positioningOfferDiagnostic: `Section 06 — positioningOfferDiagnostic (Offer & Performance Diagnostic).

${SHARED_FIELDS_HEADER}

Section-specific shape:
  sources: >= 5 distinct.

  offerMarketFit: {
    prose: string,
    proofPoints: Array of >= 3 of { metric, value, reportedBy, confidence, sourceUrl }
      reportedBy ∈ {company-own, external-source}
      confidence ∈ {high, medium, low}
  }

  funnelDiagnosis: {
    prose: string,
    breaks: Array of >= 2 of { stageName, metric, magnitude, hypothesis, sourceUrl }
  }

  channelTruth: {
    prose: string,
    channels: Array of >= 3 of { channelName, hasWorked, quantifiedEvidence, sourceUrl }
      hasWorked ∈ {yes, partial, no, unknown}
      REQUIRED: >= 3 distinct channelNames
  }

  retentionHealth: {
    prose: string,
    signals: Array of >= 3 of { signalType, metric, value, sourceUrl }
      signalType ∈ {activation, retention, first-value-moment} — REQUIRED: >= 2 distinct signalTypes
  }

  redFlags: {
    prose: string,
    items: Array of >= 3 of { claimedMotion, actualEvidence, contradiction, severity }
      severity ∈ {high, medium, low}
  }`,
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
    section: 'positioningMarketCategory',
    advertiser: 'monday.com',
    domain: 'monday.com',
    model: 'claude-opus-4-7',
    sectionRunId: process.env.MANAGED_AGENTS_CANARY_SECTION_RUN_ID ?? 'canary-section-run',
    artifactId: process.env.MANAGED_AGENTS_CANARY_ARTIFACT_ID ?? 'canary-artifact',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--section' && next) {
      args.section = next;
      index += 1;
    } else if (token === '--specialist' && next) {
      args.section = SPECIALIST_TO_SECTION[next] ?? next;
      index += 1;
    } else if (token === '--advertiser' && next) {
      args.advertiser = next;
      index += 1;
    } else if (token === '--domain' && next) {
      args.domain = next;
      index += 1;
    } else if (token === '--model' && next) {
      args.model = next;
      index += 1;
    } else if (token === '--section-run-id' && next) {
      args.sectionRunId = next;
      index += 1;
    } else if (token === '--artifact-id' && next) {
      args.artifactId = next;
      index += 1;
    } else if (token === '--help') {
      console.log(`Usage: node scripts/managed-agents-section-canary.mjs [options]

Options:
  --section <section>            Positioning section id (default: positioningMarketCategory)
  --specialist <name>            Specialist alias, e.g. MarketCategory or DemandIntent
  --advertiser <name>            Audited company name
  --domain <domain>              Known domain
  --model <model>                Anthropic model id
  --section-run-id <uuid>        section_run_id stamped in tool inputs
  --artifact-id <uuid>           parent artifact_id stamped in tool inputs
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  if (!SECTION_TO_TOOL[args.section]) {
    throw new Error(`Unsupported --section ${args.section}`);
  }

  return args;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function anthropicRequest(path, options = {}) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${ANTHROPIC_API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': COMBINED_BETA_HEADER,
        'X-Api-Key': apiKey,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Anthropic ${options.method ?? 'GET'} ${path} failed ${response.status}: ${text.slice(0, 400)}`,
      );
    }
    return text.trim().length > 0 ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
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
        paths: { '@/*': ['src/*'] },
        baseUrl: '.',
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
  tsHook.__aigosManagedAgentsCanary = true;
  extensions['.ts'] = tsHook;
}

function loadValidator(section) {
  registerTypeScriptRequireHook();
  const [schemaExportName, validateExportName] = SECTION_TO_VALIDATOR[section];
  const schemaFile = SECTION_TO_SCHEMA_FILE[section];
  const mod = requireFromRoot(
    `./src/lib/managed-agents/schemas/${schemaFile}`,
  );
  return {
    Schema: mod[schemaExportName],
    validate: mod[validateExportName],
  };
}

function validateArtifact(section, artifact) {
  const { Schema, validate } = loadValidator(section);
  const guide = SECTION_TO_GUIDE[section] ?? '';
  const parsed = Schema.safeParse(artifact);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 80);
    const errorList = issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
    return {
      ok: false,
      schema_ok: false,
      minimums_ok: false,
      errors: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      repair_feedback: [
        'Schema validation failed. Fix EVERY error below in your next attempt — not just the first block.',
        '',
        'SCHEMA ERRORS:',
        errorList,
        '',
        'REMINDER OF REQUIRED SHAPE:',
        guide,
      ].join('\n'),
    };
  }
  const minimums = validate(parsed.data);
  if (!minimums.ok) {
    return {
      ok: false,
      schema_ok: true,
      minimums_ok: false,
      errors: minimums.errors,
      repair_feedback: [
        'Schema is valid but section minimums failed. Fix EVERY minimum below in your next attempt.',
        '',
        'MINIMUM VIOLATIONS:',
        minimums.errors.join('\n'),
        '',
        'REMINDER OF REQUIRED SHAPE:',
        guide,
      ].join('\n'),
      artifact: parsed.data,
    };
  }
  return { ok: true, schema_ok: true, minimums_ok: true, artifact: parsed.data };
}

function buildSaveTool(section) {
  return {
    type: 'custom',
    name: SECTION_TO_TOOL[section],
    description: `Validate and persist the ${section} Section Artifact. Pass artifact + section_run_id.`,
    input_schema: {
      type: 'object',
      properties: {
        artifact: { type: 'object' },
        section_run_id: { type: 'string' },
        confidence_notes: { type: 'string' },
      },
      required: ['artifact', 'section_run_id'],
    },
  };
}

function buildSystemPrompt(section, args) {
  return [
    `You are the AI-GOS Managed Agents canary specialist for ${section}.`,
    `Audited company: ${args.advertiser}. Domain: ${args.domain}.`,
    '',
    'PROCESS:',
    '1. Use the read tool to gather public evidence covering EVERY required field in the schema below.',
    `2. Submit ONE complete artifact via ${SECTION_TO_TOOL[section]} — every required field present, every minimum array count met, every enum value exact.`,
    '3. If the save tool returns ok:false, ALL errors are in repair_feedback. Fix EVERY listed error in your next attempt — never just the first block.',
    '',
    'CRITICAL:',
    '- The save tool rejects partial artifacts. Do NOT submit until you have all top-level fields, all minimum counts, and all required enum values.',
    `- Stamp section_run_id="${args.sectionRunId}" in every save_* call.`,
    '- Every url/sourceUrl/evidenceUrl must be a valid HTTPS URL.',
    '- Use only what the read tool returns — never invent data or sources.',
    '',
    SECTION_TO_GUIDE[section] ?? '',
  ].join('\n');
}

async function streamSession(sessionId, executor) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const response = await fetch(
    `${ANTHROPIC_API_BASE_URL}/sessions/${sessionId}/events/stream`,
    {
      headers: {
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': COMBINED_BETA_HEADER,
        'X-Api-Key': apiKey,
      },
      signal: controller.signal,
    },
  );
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    clearTimeout(timer);
    throw new Error(`stream failed ${response.status}: ${text.slice(0, 400)}`);
  }

  const decoder = new TextDecoder();
  const transcript = [];
  const handledToolUseEventIds = new Set();
  let buffer = '';
  let finished = false;

  async function handleEvent(event) {
    if (!event?.type) return;
    transcript.push(event);
    if (event.type === 'agent.message') {
      const text = (event.content || [])
        .filter((b) => b?.type === 'text')
        .map((b) => b.text)
        .join('\n');
      console.log(`[agent.message] ${text.slice(0, 180).replace(/\s+/g, ' ')}`);
    } else if (event.type === 'agent.custom_tool_use') {
      console.log(`[tool.use] ${event.name} ${event.id}`);
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

    const eventIds = event.stop_reason.event_ids ?? [];
    for (const eventId of eventIds) {
      if (handledToolUseEventIds.has(eventId)) continue;
      const toolEvent = transcript.find(
        (e) => e.id === eventId && e.type === 'agent.custom_tool_use',
      );
      if (!toolEvent) continue;
      handledToolUseEventIds.add(eventId);
      try {
        const result = await executor(toolEvent);
        await sendCustomToolResult(sessionId, eventId, toolEvent, result, false);
      } catch (err) {
        await sendCustomToolResult(
          sessionId,
          eventId,
          toolEvent,
          { ok: false, error: err.message ?? String(err) },
          true,
        );
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
  } catch (err) {
    if (!finished && err?.name !== 'AbortError') throw err;
  } finally {
    clearTimeout(timer);
  }

  return { transcript };
}

function parseSseBlock(block) {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());
  if (dataLines.length === 0) return null;
  const payload = dataLines.join('\n').trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function sendCustomToolResult(sessionId, eventId, toolEvent, result, isTransportError) {
  const event = {
    type: 'user.custom_tool_result',
    custom_tool_use_id: eventId,
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
  if (toolEvent.session_thread_id) event.session_thread_id = toolEvent.session_thread_id;
  if (isTransportError) event.is_error = true;
  await anthropicRequest(`/sessions/${sessionId}/events`, {
    method: 'POST',
    body: { events: [event] },
  });
}

async function main() {
  loadEnvFile(resolve('.env.local'));
  loadEnvFile(resolve('research-worker/.env'));
  const args = parseArgs(process.argv.slice(2));
  requireEnv('ANTHROPIC_API_KEY');

  console.log(
    `[canary] section=${args.section} advertiser=${args.advertiser} run=${args.sectionRunId}`,
  );

  const environment = await anthropicRequest('/environments', {
    method: 'POST',
    body: {
      name: `aigos-p1-${args.section}-${Date.now()}`,
      description: 'AI-GOS Phase 1 Managed Agents section canary environment.',
      config: { type: 'cloud', networking: { type: 'unrestricted' } },
    },
  });
  console.log(`[canary] environment ${environment.id}`);

  const agent = await anthropicRequest('/agents', {
    method: 'POST',
    body: {
      name: `AI-GOS ${args.section} P1 Canary ${Date.now()}`,
      description: 'AI-GOS Phase 1 Managed Agents section canary specialist.',
      model: args.model,
      system: buildSystemPrompt(args.section, args),
      tools: [
        {
          type: 'agent_toolset_20260401',
          default_config: { enabled: false },
          configs: [{ name: 'read', enabled: true }],
        },
        buildSaveTool(args.section),
      ],
    },
  });
  console.log(`[canary] agent ${agent.id}`);

  const session = await anthropicRequest('/sessions', {
    method: 'POST',
    body: { agent: agent.id, environment_id: environment.id, metadata: { project: 'AI-GOS' } },
  });
  console.log(`[canary] session ${session.id}`);

  await anthropicRequest(`/sessions/${session.id}/events`, {
    method: 'POST',
    body: {
      events: [
        {
          type: 'user.message',
          content: [
            {
              type: 'text',
              text: `Produce the ${args.section} artifact for ${args.advertiser}. Section run id ${args.sectionRunId}. Use only public evidence.`,
            },
          ],
        },
      ],
    },
  });

  const attempts = [];
  let acceptedArtifact = null;
  const result = await streamSession(session.id, async (toolEvent) => {
    if (toolEvent.name === SECTION_TO_TOOL[args.section]) {
      const validation = validateArtifact(args.section, toolEvent.input?.artifact);
      attempts.push({
        attempt: attempts.length + 1,
        ok: validation.ok,
        schema_ok: validation.schema_ok,
        minimums_ok: validation.minimums_ok,
        errors: validation.errors,
      });
      if (validation.ok) {
        acceptedArtifact = validation.artifact;
        return { ok: true, accepted: true, section_type: args.section, attempt: attempts.length };
      }
      return {
        ok: false,
        accepted: false,
        section_type: args.section,
        attempt: attempts.length,
        repair_feedback: validation.repair_feedback,
      };
    }
    return { ok: false, error: `Unknown tool ${toolEvent.name}` };
  });

  mkdirSync(resolve('tmp'), { recursive: true });
  const stamp = Date.now();
  const transcriptPath = resolve(
    'tmp',
    `managed-agents-section-canary-${args.section}-${stamp}.json`,
  );
  writeFileSync(
    transcriptPath,
    `${JSON.stringify(
      {
        args,
        environment,
        agent,
        session,
        attempts,
        acceptedArtifact,
        transcript: result.transcript,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`[canary] transcript: ${transcriptPath}`);
  console.log(`[managed-agents] validation attempts: ${JSON.stringify(attempts)}`);

  if (acceptedArtifact) {
    const artifactPath = resolve(
      'tmp',
      `managed-agents-section-canary-${args.section}-${stamp}-artifact.json`,
    );
    writeFileSync(artifactPath, `${JSON.stringify(acceptedArtifact, null, 2)}\n`);
    console.log(`[canary] artifact: ${artifactPath}`);
  } else {
    console.error('[canary] FAILED — no accepted artifact');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[canary] failed: ${err?.message ?? err}`);
  process.exitCode = 1;
});
