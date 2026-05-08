import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
import Firecrawl from '@mendable/firecrawl-js';
import type {
  BetaCodeExecutionToolResultBlock,
  BetaContentBlock,
  BetaMCPToolUseBlock,
  BetaServerToolUseBlock,
  BetaToolUseBlock,
  BetaWebSearchToolResultBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';

export {
  buildRunnerTelemetry,
  type RunnerChartTelemetry,
  type RunnerTelemetry,
  type RunnerUsageTelemetry,
} from './telemetry';
import { ANTHROPIC_CODE_EXECUTION_BETA, ANTHROPIC_SKILLS_BETA, hasConfiguredAnthropicSkills } from './anthropic-skills';
import { MODELS } from './models';

/** Advisor tool definition — shared by runners that opt into Opus guidance. */
export const ADVISOR_TOOL = {
  type: 'advisor_20260301' as const,
  name: 'advisor' as const,
  model: MODELS.STRONG,
  max_uses: 2,
};

/**
 * System prompt addendum based on Anthropic's recommended advisor prompting.
 * See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool#suggested-system-prompt-for-coding-tasks
 * Adapted for research tasks. Prepend to runner system prompts when advisor is enabled.
 */
export const ADVISOR_PROMPT_ADDENDUM = `
The advisor should respond in under 100 words and use enumerated steps, not explanations.

You have access to an \`advisor\` tool backed by a stronger reviewer model. It takes NO parameters — when you call advisor(), your entire conversation history is automatically forwarded. They see the task, every tool call you've made, every result you've seen.

Call advisor BEFORE substantive work — before writing, before committing to an interpretation, before building on an assumption. If the task requires orientation first (searching the web, fetching data from tools, gathering evidence), do that, then call advisor. Orientation is not substantive work. Writing, analyzing, and declaring an answer are.

Also call advisor:
- When you believe the task is complete. BEFORE this call, make your deliverable durable.
- When stuck — evidence is thin, approach not converging, results that don't fit.
- When considering a change of approach.

On tasks longer than a few steps, call advisor at least once before committing to an approach and once before declaring done. On short reactive tasks where the next action is dictated by tool output you just read, you don't need to keep calling — the advisor adds most of its value on the first call, before the approach crystallizes.

Give the advice serious weight. If you follow a step and it fails empirically, or you have primary-source evidence that contradicts a specific claim, adapt. If you've already retrieved data pointing one way and the advisor points another: don't silently switch. Surface the conflict in one more advisor call — the advisor saw your evidence but may have underweighted it; a reconcile call is cheaper than committing to the wrong branch.`;

export function isAdvisorEnabled(): boolean {
  return process.env.ENABLE_ADVISOR_TOOL === 'true';
}

function getAnthropicAuthOptions(): Pick<ClientOptions, 'apiKey' | 'authToken'> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (apiKey) {
    return { apiKey };
  }

  const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  if (authToken) {
    return { authToken };
  }

  return {};
}

interface CreateAnthropicClientOptions {
  enableSkillsBeta?: boolean;
}

export function createClient(options: CreateAnthropicClientOptions = {}): Anthropic {
  const betaFeatures = ['prompt-caching-2024-07-31'];
  if (options.enableSkillsBeta === true && hasConfiguredAnthropicSkills()) {
    betaFeatures.push(ANTHROPIC_SKILLS_BETA, ANTHROPIC_CODE_EXECUTION_BETA);
  }
  if (isAdvisorEnabled()) {
    betaFeatures.push('advisor-tool-2026-03-01');
    console.log('[runner] Advisor tool ENABLED — beta header includes advisor-tool-2026-03-01');
  }
  return new Anthropic({
    ...getAnthropicAuthOptions(),
    maxRetries: 0,
    defaultHeaders: {
      'anthropic-beta': betaFeatures.join(','),
    },
  });
}

export interface ProgressMeta {
  url?: string;
  screenshotUrl?: string;
  favicon?: string;
  pageTitle?: string;
  dataPoints?: Array<{ label: string; value: string }>;
  toolName?: string;
  resultCount?: number;
  eventType?:
    | 'artifact-clear'
    | 'artifact-delta'
    | 'artifact-section-state'
    | 'artifact-finish';
  section?: string;
  title?: string;
  status?:
    | 'queued'
    | 'researching'
    | 'drafting'
    | 'citing'
    | 'complete'
    | 'partial'
    | 'error';
  runId?: string;
}

export type RunnerProgressPhase =
  | 'runner'
  | 'tool'
  | 'analysis'
  | 'artifact'
  | 'output'
  | 'error';

export interface RunnerProgressUpdate {
  at?: string;
  id?: string;
  message: string;
  phase: RunnerProgressPhase;
  meta?: ProgressMeta;
}

export type RunnerProgressReporter = (
  update: RunnerProgressUpdate,
) => Promise<void> | void;

interface ToolRunnerStream {
  finalMessage(): Promise<Anthropic.Beta.BetaMessage>;
  on(event: 'contentBlock', listener: (content: BetaContentBlock) => void): unknown;
  on(event: 'text', listener: (textDelta: string, textSnapshot: string) => void): unknown;
}

function sanitizeMeta(meta: ProgressMeta): ProgressMeta {
  const clean: ProgressMeta = { ...meta };
  if (clean.url) clean.url = sanitizeForJson(clean.url);
  if (clean.pageTitle) clean.pageTitle = sanitizeForJson(clean.pageTitle);
  if (clean.favicon) clean.favicon = sanitizeForJson(clean.favicon);
  if (clean.screenshotUrl) clean.screenshotUrl = sanitizeForJson(clean.screenshotUrl);
  if (clean.toolName) clean.toolName = sanitizeForJson(clean.toolName);
  if (clean.eventType) clean.eventType = sanitizeForJson(clean.eventType) as ProgressMeta['eventType'];
  if (clean.section) clean.section = sanitizeForJson(clean.section);
  if (clean.title) clean.title = sanitizeForJson(clean.title);
  if (clean.status) clean.status = sanitizeForJson(clean.status) as ProgressMeta['status'];
  if (clean.runId) clean.runId = sanitizeForJson(clean.runId);
  return clean;
}

function createProgressUpdate(
  phase: RunnerProgressUpdate['phase'],
  message: string,
  meta?: ProgressMeta,
): RunnerProgressUpdate {
  return {
    at: new Date().toISOString(),
    id: crypto.randomUUID(),
    message: sanitizeForJson(message),
    phase,
    ...(meta ? { meta: sanitizeMeta(meta) } : {}),
  };
}

export async function emitRunnerProgress(
  onProgress: RunnerProgressReporter | undefined,
  phase: RunnerProgressPhase,
  message: string,
  meta?: ProgressMeta,
): Promise<void> {
  if (!onProgress) {
    return;
  }

  await onProgress(createProgressUpdate(phase, message, meta));
}

export type RunnerArtifactProgressInput =
  | {
      type: 'artifact-clear';
      section: string;
      title?: string;
      runId?: string;
    }
  | {
      type: 'artifact-delta';
      section: string;
      delta: string;
      title?: string;
      runId?: string;
    }
  | {
      type: 'artifact-section-state';
      section: string;
      status: NonNullable<ProgressMeta['status']>;
      title?: string;
      runId?: string;
    }
  | {
      type: 'artifact-finish';
      section: string;
      title?: string;
      runId?: string;
    };

export function buildArtifactProgressUpdate(
  input: RunnerArtifactProgressInput,
): RunnerProgressUpdate {
  const meta: ProgressMeta = {
    eventType: input.type,
    section: input.section,
    ...(input.title ? { title: input.title } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
  };

  if (input.type === 'artifact-section-state') {
    meta.status = input.status;
  }

  const message =
    input.type === 'artifact-delta'
      ? input.delta
      : input.type === 'artifact-section-state'
        ? input.status
        : input.title ?? input.type;

  return createProgressUpdate('artifact', message, meta);
}

export async function emitArtifactProgress(
  onProgress: RunnerProgressReporter | undefined,
  input: RunnerArtifactProgressInput,
): Promise<void> {
  if (!onProgress) {
    return;
  }

  await onProgress(buildArtifactProgressUpdate(input));
}

type ToolUseBlock = BetaServerToolUseBlock | BetaToolUseBlock | BetaMCPToolUseBlock;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatUrlHost(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, '');
    return host.length > 0 ? host : rawUrl;
  } catch {
    return rawUrl;
  }
}

function extractToolQuery(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const query =
    typeof record.query === 'string'
      ? record.query
      : typeof record.search_query === 'string'
        ? record.search_query
        : null;

  if (query) {
    const normalized = normalizeWhitespace(query);
    return normalized.length > 0 ? normalized : null;
  }

  const url =
    typeof record.url === 'string'
      ? record.url
      : Array.isArray(record.urls) && typeof record.urls[0] === 'string'
        ? record.urls[0]
        : null;

  if (url) {
    const normalized = normalizeWhitespace(url);
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

const TOOL_FRIENDLY_LABELS: Record<string, string> = {
  // Web search
  web_search: 'Searching the web',
  web_fetch: 'Reading page content',

  // Website analysis
  firecrawl_scrape: 'Analyzing website content',
  firecrawl_scrape_url: 'Analyzing website content',

  // Ad intelligence
  ad_library_search: 'Checking ad libraries',
  search_ads: 'Checking ad libraries',
  google_ads_transparency: 'Checking ad transparency data',
  meta_ad_library: 'Checking paid social ad data',
  linkedin_ad_library: 'Checking LinkedIn ad data',

  // Keyword intelligence
  spyfu_keyword_intel: 'Gathering keyword intelligence',
  spyfu_domain_stats: 'Analyzing domain performance',
  spyfu: 'Gathering keyword intelligence',

  // Performance
  pagespeed_audit: 'Running page speed analysis',
  page_speed: 'Running page speed analysis',

  // Platform APIs
  google_ads: 'Querying paid search data',
  meta_ads: 'Querying paid social data',
  ga4: 'Querying analytics data',
  google_ads_manager: 'Querying paid search data',
  meta_ads_manager: 'Querying paid social data',

  // Charts
  chart: 'Generating visualization',
  create_chart: 'Generating visualization',

  // Advisor
  advisor: 'Consulting strategic advisor',
};

export function describeToolUseBlock(block: ToolUseBlock): string {
  const friendlyLabel = TOOL_FRIENDLY_LABELS[block.name];
  const detail = extractToolQuery(block.input);

  if (detail) {
    if (block.name === 'web_search') {
      return `searching: "${truncate(detail, 120)}"`;
    }

    if (block.name === 'web_fetch') {
      return `reading: ${truncate(detail, 120)}`;
    }

    const prefix = friendlyLabel ?? 'analyzing';
    return `${prefix}: ${truncate(detail, 120)}`;
  }

  return friendlyLabel ?? 'running analysis';
}

export function describeWebSearchResultBlock(
  block: BetaWebSearchToolResultBlock,
): string[] {
  if (!Array.isArray(block.content)) {
    return ['web search returned an error'];
  }

  const results = block.content;
  const messages = [
    `web search returned ${results.length} result${results.length === 1 ? '' : 's'}`,
  ];

  for (const result of results.slice(0, 3)) {
    messages.push(
      `source: ${truncate(
        normalizeWhitespace(result.title),
        110,
      )} (${formatUrlHost(result.url)})`,
    );
  }

  return messages;
}

function unescapeQuotedJsonValue(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\');
}

const DRAFT_FACT_KEYS = new Map<string, string>([
  // Industry / Market
  ['category', 'category'],
  ['marketSize', 'market size'],
  ['marketMaturity', 'maturity'],
  ['awarenessLevel', 'awareness'],
  ['averageSalesCycle', 'sales cycle'],
  ['buyingBehavior', 'buying behavior'],
  ['trend', 'trend'],
  ['evidence', 'evidence'],
  // ICP
  ['validatedPersona', 'persona'],
  ['audienceSize', 'audience size'],
  ['confidenceScore', 'confidence'],
  ['finalVerdict', 'verdict'],
  // Offer
  ['recommendation', 'recommendation'],
  ['marketFitAssessment', 'market fit'],
  // Competitors
  ['overallLandscape', 'landscape'],
  ['positioning', 'positioning'],
  ['ourAdvantage', 'our advantage'],
  // Keywords
  ['totalKeywordsFound', 'keywords found'],
  ['competitorGapCount', 'competitor gaps'],
  // Synthesis
  ['positioningStrategy', 'positioning'],
  ['strategicNarrative', 'narrative'],
  // Offer scoring dimensions
  ['painRelevance', 'pain relevance'],
  ['urgency', 'urgency'],
  ['differentiation', 'differentiation'],
  ['tangibility', 'tangibility'],
  ['pricingLogic', 'pricing logic'],
]);

// Build regex patterns from all keys — match string values AND numeric values
const DRAFT_FACT_KEY_PATTERN = [...DRAFT_FACT_KEYS.keys()].join('|');
const DRAFT_FACT_STRING_REGEX = new RegExp(
  `"(?<key>${DRAFT_FACT_KEY_PATTERN})"\\s*:\\s*"(?<value>(?:[^"\\\\]|\\\\.)*)"`,
  'g',
);
const DRAFT_FACT_NUMBER_REGEX = new RegExp(
  `"(?<key>${DRAFT_FACT_KEY_PATTERN})"\\s*:\\s*(?<value>\\d+(?:\\.\\d+)?)`,
  'g',
);

export function extractDraftFactMessages(snapshot: string): string[] {
  const messages: string[] = [];
  const seenKeys = new Set<string>();

  // Pass 1: string values ("key": "value")
  for (const match of snapshot.matchAll(DRAFT_FACT_STRING_REGEX)) {
    const key = match.groups?.key;
    const rawValue = match.groups?.value;
    if (!key || !rawValue || seenKeys.has(key)) continue;

    const label = DRAFT_FACT_KEYS.get(key);
    const value = truncate(normalizeWhitespace(unescapeQuotedJsonValue(rawValue)), 140);
    if (!label || value.length === 0) continue;

    messages.push(`${label}: ${value}`);
    seenKeys.add(key);
  }

  // Pass 2: numeric values ("key": 42)
  for (const match of snapshot.matchAll(DRAFT_FACT_NUMBER_REGEX)) {
    const key = match.groups?.key;
    const rawValue = match.groups?.value;
    if (!key || !rawValue || seenKeys.has(key)) continue;

    const label = DRAFT_FACT_KEYS.get(key);
    if (!label) continue;

    messages.push(`${label}: ${rawValue}`);
    seenKeys.add(key);
  }

  return messages;
}

const FIRECRAWL_TOOL_NAMES = new Set([
  'firecrawl',
  'firecrawl_scrape',
  'firecrawl_scrape_url',
  'firecrawlExtract',
]);

const SCREENSHOT_TIMEOUT_MS = 8_000;

/**
 * Strip lone surrogates from a string. Lone surrogates (unpaired U+D800–U+DFFF)
 * cause JSON.stringify to produce bytes that are not valid UTF-8, which makes
 * Anthropic's API reject the request with "no low surrogate in string".
 *
 * The approach: iterate code units and replace any high surrogate not followed
 * by a low surrogate (or any low surrogate not preceded by a high surrogate)
 * with U+FFFD (replacement character). This is more reliable than regex
 * lookbehind which can behave inconsistently with surrogate code units.
 */
export function sanitizeForJson(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      // High surrogate — check if next is a valid low surrogate
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
      if (next >= 0xDC00 && next <= 0xDFFF) {
        // Valid pair — keep both
        result += value[i] + value[i + 1];
        i++; // skip the low surrogate
      } else {
        // Lone high surrogate — replace
        result += '\uFFFD';
      }
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      // Lone low surrogate (not preceded by high) — replace
      result += '\uFFFD';
    } else {
      result += value[i];
    }
  }
  return result;
}

function extractToolUrl(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (typeof record.url === 'string') return record.url;
  if (Array.isArray(record.urls) && typeof record.urls[0] === 'string') return record.urls[0];
  return null;
}

function buildFaviconUrl(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function extractToolMetaFromBlock(block: ToolUseBlock): ProgressMeta | undefined {
  const url = extractToolUrl(block.input);
  if (!url) return undefined;
  return {
    url,
    toolName: block.name,
    favicon: buildFaviconUrl(url) ?? undefined,
  };
}

function captureFirecrawlScreenshot(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return Promise.resolve(null);

  const client = new Firecrawl({ apiKey });
  return Promise.race([
    (client.scrape(url, { formats: ['screenshot'] }) as Promise<{
      success: boolean;
      screenshot?: string;
    }>).then(result =>
      result.success && typeof result.screenshot === 'string' ? result.screenshot : null,
    ).catch(() => null),
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SCREENSHOT_TIMEOUT_MS),
    ),
  ]);
}

export async function runStreamedToolRunner(
  runner: AsyncIterable<ToolRunnerStream>,
  options: {
    onProgress?: RunnerProgressReporter;
    synthesisMessage?: string;
    maxToolIterations?: number;
    onTextSnapshot?: (snapshot: string) => void;
    onWebSearchSource?: (source: {
      title: string;
      url: string;
    }) => void;
    onCodeExecutionOutputFile?: (fileId: string) => void;
    onCodeExecutionStdout?: (stdout: string) => void;
  },
): Promise<Anthropic.Beta.BetaMessage> {
  const MAX_SOURCE_SCREENSHOTS = 3;
  let finalMessage: Anthropic.Beta.BetaMessage | null = null;
  let sawAnalysisText = false;
  let sourceScreenshotCount = 0;
  let iterationCount = 0;
  const screenshotUrlsSeen = new Set<string>();
  const seenToolUseIds = new Set<string>();
  const seenWebSearchResultIds = new Set<string>();
  const seenDraftFacts = new Set<string>();

  for await (const stream of runner) {
    stream.on('contentBlock', (block) => {
      if (
        block.type === 'server_tool_use' ||
        block.type === 'tool_use' ||
        block.type === 'mcp_tool_use'
      ) {
        if (seenToolUseIds.has(block.id)) {
          return;
        }

        seenToolUseIds.add(block.id);
        const meta = extractToolMetaFromBlock(block);
        void emitRunnerProgress(options.onProgress, 'tool', describeToolUseBlock(block), meta);

        // Fire parallel screenshot for Firecrawl tools (non-blocking)
        if (FIRECRAWL_TOOL_NAMES.has(block.name) && meta?.url && !screenshotUrlsSeen.has(meta.url)) {
          screenshotUrlsSeen.add(meta.url);
          const screenshotUrl = meta.url;
          void captureFirecrawlScreenshot(screenshotUrl).then((ssUrl) => {
            if (ssUrl) {
              void emitRunnerProgress(
                options.onProgress,
                'tool',
                `screenshot captured: ${formatUrlHost(screenshotUrl)}`,
                { ...meta, screenshotUrl: ssUrl },
              );
            }
          });
        }
        return;
      }

      // Advisor tool result — Opus guidance received, emit progress
      if ((block as { type: string }).type === 'advisor_tool_result') {
        console.log('[runner] Advisor tool result received — Opus guidance applied');
        void emitRunnerProgress(
          options.onProgress,
          'analysis',
          'strategic guidance received from advisor',
        );
        return;
      }

      if (block.type === 'web_search_tool_result') {
        const resultBlock = block as BetaWebSearchToolResultBlock;
        const signature = sanitizeForJson(`${resultBlock.tool_use_id}:${Array.isArray(resultBlock.content) ? resultBlock.content.map((result) => `${result.title}|${result.url}`).join('|') : 'error'}`);
        if (seenWebSearchResultIds.has(signature)) {
          return;
        }

        seenWebSearchResultIds.add(signature);
        const results = Array.isArray(resultBlock.content) ? resultBlock.content : [];
        const resultCount = results.length;
        for (const result of results) {
          if (typeof result.url === 'string' && result.url.trim().length > 0) {
            options.onWebSearchSource?.({
              title: sanitizeForJson(normalizeWhitespace(result.title ?? result.url)),
              url: result.url,
            });
          }
        }
        for (const message of describeWebSearchResultBlock(resultBlock)) {
          const sourceMeta: ProgressMeta = { toolName: 'web_search', resultCount };
          // Extract URL from source messages (format: "source: title (host)")
          const sourceResult = results.find(
            (r) => message.includes(formatUrlHost(r.url)),
          );
          if (sourceResult) {
            sourceMeta.url = sourceResult.url;
            sourceMeta.pageTitle = sanitizeForJson(sourceResult.title);
            sourceMeta.favicon = buildFaviconUrl(sourceResult.url) ?? undefined;
          }
          void emitRunnerProgress(options.onProgress, 'tool', message, sourceMeta);

          // Fire parallel screenshot for first source URL per search (non-blocking, capped)
          if (
            sourceResult?.url &&
            sourceScreenshotCount < MAX_SOURCE_SCREENSHOTS &&
            !screenshotUrlsSeen.has(sourceResult.url)
          ) {
            sourceScreenshotCount++;
            screenshotUrlsSeen.add(sourceResult.url);
            const ssSourceUrl = sourceResult.url;
            const ssSourceMeta = { ...sourceMeta };
            void captureFirecrawlScreenshot(ssSourceUrl).then((ssUrl) => {
              if (ssUrl) {
                void emitRunnerProgress(
                  options.onProgress,
                  'tool',
                  `screenshot captured: ${formatUrlHost(ssSourceUrl)}`,
                  { ...ssSourceMeta, screenshotUrl: ssUrl },
                );
              }
            });
          }
        }
      }

      if (block.type === 'code_execution_tool_result') {
        const resultBlock = block as BetaCodeExecutionToolResultBlock;
        const content = resultBlock.content;
        if (
          content.type === 'code_execution_result' ||
          content.type === 'encrypted_code_execution_result'
        ) {
          for (const output of content.content) {
            options.onCodeExecutionOutputFile?.(output.file_id);
          }

          if (content.type === 'code_execution_result' && content.stdout.trim().length > 0) {
            options.onCodeExecutionStdout?.(content.stdout);
          }
        }
      }
    });

    stream.on('text', (_delta, snapshot) => {
      if (snapshot.trim().length === 0) {
        return;
      }

      options.onTextSnapshot?.(snapshot);

      if (!sawAnalysisText) {
        sawAnalysisText = true;
        void emitRunnerProgress(
          options.onProgress,
          'analysis',
          options.synthesisMessage ?? 'synthesizing findings into artifact blocks',
        );
      }

      for (const fact of extractDraftFactMessages(snapshot)) {
        if (seenDraftFacts.has(fact)) {
          continue;
        }

        seenDraftFacts.add(fact);
        void emitRunnerProgress(options.onProgress, 'analysis', `draft ${fact}`);
      }
    });

    finalMessage = await stream.finalMessage();
    iterationCount++;

    // Enforce tool iteration cap — stop after N rounds of tool use
    if (options.maxToolIterations && iterationCount >= options.maxToolIterations) {
      break;
    }
  }

  if (!finalMessage) {
    throw new Error('Tool runner finished without a final message');
  }

  return finalMessage;
}

export async function runWithBackoff<T>(
  runFn: () => Promise<T>,
  label: string,
): Promise<T> {
  const retryDelayMs = 10_000;

  try {
    return await runFn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes('rate limit') || msg.includes('rate_limit') || (err as { status?: number }).status === 429;
    if (isRateLimit) {
      console.warn(`[${label}] Rate limited — waiting ${retryDelayMs / 1000}s before retry`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      return await runFn();
    }
    throw err;
  }
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {}
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  // Unclosed fence: model truncated before closing backticks
  const unclosed = trimmed.match(/```(?:json)?\s*([\s\S]+)/);
  if (unclosed) {
    const inner = unclosed[1].trim();
    try { return JSON.parse(inner); } catch {}
    // Try extracting just the JSON object from the unclosed fence content
    const uf = inner.indexOf('{');
    const ul = inner.lastIndexOf('}');
    if (uf >= 0 && ul > uf) {
      const ucandidate = inner.slice(uf, ul + 1);
      try { return JSON.parse(ucandidate); } catch {}
      const ufixed = ucandidate.replace(/,\s*([\]}])/g, '$1');
      try { return JSON.parse(ufixed); } catch {}
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const candidate = trimmed.slice(first, last + 1);
    try { return JSON.parse(candidate); } catch {}
    // Fix trailing commas before } or ] (common with Haiku/Sonnet)
    const fixed = candidate.replace(/,\s*([\]}])/g, '$1');
    try { return JSON.parse(fixed); } catch {}
  }
  throw new Error('No parseable JSON found');
}
