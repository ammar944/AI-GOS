import Anthropic from '@anthropic-ai/sdk';
import type {
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

export function createClient() {
  return new Anthropic({ maxRetries: 0 });
}

export interface RunnerProgressUpdate {
  at?: string;
  id?: string;
  message: string;
  phase: 'runner' | 'tool' | 'analysis' | 'output' | 'error';
}

export type RunnerProgressReporter = (
  update: RunnerProgressUpdate,
) => Promise<void> | void;

interface ToolRunnerStream {
  finalMessage(): Promise<Anthropic.Beta.BetaMessage>;
  on(event: 'contentBlock', listener: (content: BetaContentBlock) => void): unknown;
  on(event: 'text', listener: (textDelta: string, textSnapshot: string) => void): unknown;
}

function createProgressUpdate(
  phase: RunnerProgressUpdate['phase'],
  message: string,
): RunnerProgressUpdate {
  return {
    at: new Date().toISOString(),
    id: crypto.randomUUID(),
    message,
    phase,
  };
}

export async function emitRunnerProgress(
  onProgress: RunnerProgressReporter | undefined,
  phase: RunnerProgressUpdate['phase'],
  message: string,
): Promise<void> {
  if (!onProgress) {
    return;
  }

  await onProgress(createProgressUpdate(phase, message));
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
  ['category', 'category'],
  ['marketSize', 'market size'],
  ['marketMaturity', 'maturity'],
  ['awarenessLevel', 'awareness'],
  ['averageSalesCycle', 'sales cycle'],
  ['buyingBehavior', 'buying behavior'],
  ['trend', 'trend'],
  ['evidence', 'evidence'],
]);

export function extractDraftFactMessages(snapshot: string): string[] {
  const matches = snapshot.matchAll(
    /"(?<key>category|marketSize|marketMaturity|awarenessLevel|averageSalesCycle|buyingBehavior|trend|evidence)"\s*:\s*"(?<value>(?:[^"\\]|\\.)*)"/g,
  );
  const messages: string[] = [];
  const seenKeys = new Set<string>();

  for (const match of matches) {
    const key = match.groups?.key;
    const rawValue = match.groups?.value;
    if (!key || !rawValue || seenKeys.has(key)) {
      continue;
    }

    const label = DRAFT_FACT_KEYS.get(key);
    const value = truncate(normalizeWhitespace(unescapeQuotedJsonValue(rawValue)), 140);
    if (!label || value.length === 0) {
      continue;
    }

    messages.push(`${label}: ${value}`);
    seenKeys.add(key);
  }

  return messages;
}

export async function runStreamedToolRunner(
  runner: AsyncIterable<ToolRunnerStream>,
  options: {
    onProgress?: RunnerProgressReporter;
    synthesisMessage?: string;
  },
): Promise<Anthropic.Beta.BetaMessage> {
  let finalMessage: Anthropic.Beta.BetaMessage | null = null;
  let sawAnalysisText = false;
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
        void emitRunnerProgress(options.onProgress, 'tool', describeToolUseBlock(block));
        return;
      }

      if (block.type === 'web_search_tool_result') {
        const resultBlock = block as BetaWebSearchToolResultBlock;
        const signature = `${resultBlock.tool_use_id}:${Array.isArray(resultBlock.content) ? resultBlock.content.map((result) => `${result.title}|${result.url}`).join('|') : 'error'}`;
        if (seenWebSearchResultIds.has(signature)) {
          return;
        }

        seenWebSearchResultIds.add(signature);
        for (const message of describeWebSearchResultBlock(resultBlock)) {
          void emitRunnerProgress(options.onProgress, 'tool', message);
        }
      }
    });

    stream.on('text', (_delta, snapshot) => {
      if (snapshot.trim().length === 0) {
        return;
      }

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
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch {}
  }
  throw new Error('No parseable JSON found');
}
