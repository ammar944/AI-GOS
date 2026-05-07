import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  createClient,
  buildRunnerTelemetry,
  emitRunnerProgress,
  extractJson,
  runStreamedToolRunner,
  runWithBackoff,
  type RunnerProgressReporter,
} from '../runner';
import type { ResearchResult } from '../supabase';
import { buildDeepResearchContainerParams } from '../anthropic-skills';
import { MODELS } from '../models';
import { maybeCachedSystem } from '../utils/prompt-cache';

export const DEEP_RESEARCH_BOUNDARY_SECTIONS = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'crossAnalysis',
  'keywordIntel',
  'offerAnalysis',
] as const;

const DEEP_RESEARCH_SECTION_MAP = {
  industryMarket: 'industryResearch',
  icpValidation: 'icpValidation',
  competitors: 'competitorIntel',
  crossAnalysis: 'strategicSynthesis',
  keywordIntel: 'keywordIntel',
  offerAnalysis: 'offerAnalysis',
} as const;

export const DEEP_RESEARCH_CANONICAL_SECTIONS = [
  'industryResearch',
  'icpValidation',
  'competitorIntel',
  'strategicSynthesis',
  'keywordIntel',
  'offerAnalysis',
] as const;

export type DeepResearchBoundarySection = (typeof DEEP_RESEARCH_BOUNDARY_SECTIONS)[number];

const SECTION_TITLES: Record<DeepResearchBoundarySection, string> = {
  industryMarket: 'Market & Category Intelligence',
  icpValidation: 'Buyer & ICP Validation',
  competitors: 'Competitor Landscape & Positioning',
  crossAnalysis: 'Voice of Customer & Objection Evidence',
  keywordIntel: 'Demand & Intent Signals',
  offerAnalysis: 'Offer & Performance Diagnostic',
};

const DEEP_RESEARCH_MODEL = process.env.RESEARCH_DEEP_PROGRAM_MODEL ?? MODELS.STANDARD;
const DEEP_RESEARCH_MAX_TOKENS = Number(process.env.RESEARCH_DEEP_PROGRAM_MAX_TOKENS ?? 20000);
const DEEP_RESEARCH_TIMEOUT_MS = Number(process.env.RESEARCH_DEEP_PROGRAM_TIMEOUT_MS ?? 900000);

const DEEP_RESEARCH_SYSTEM_PROMPT = `You are AI-GOS's Deep Research Agent for a supervised GTM workspace.

MISSION
Run one evidence-grounded company/category research pass, then synthesize six GTM research cards from the same shared corpus.

STYLE
- Be specific, executive, and useful. No generic strategy filler.
- Every major claim must be backed by a source, quote, user-provided context, or explicit "insufficient evidence" marker.
- Do not invent market size, pricing, CAC, ROAS, search volume, competitor claims, or customer quotes.
- If source coverage is thin, say exactly what is missing and still provide the best grounded diagnosis.
- Keep outputs card-shaped: concise but complete enough to be reviewed by a client.

OUTPUT
Return ONLY valid JSON. No markdown fences. Shape:
{
  "corpus": {
    "company": "string",
    "category": "string",
    "researchSummary": "string",
    "sources": [{"title":"string","url":"string","whyItMatters":"string"}],
    "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":0-100}]
  },
  "sections": {
    "industryMarket": SectionCard,
    "icpValidation": SectionCard,
    "competitors": SectionCard,
    "crossAnalysis": SectionCard,
    "keywordIntel": SectionCard,
    "offerAnalysis": SectionCard
  }
}

CRITICAL RETURN CONTRACT
- Do not export, attach, or summarize the final JSON as a file.
- You may use code_execution only as scratch analysis. The final assistant response itself must contain the complete JSON object.
- The final response must start with "{" and end with "}". No preamble, no completion note, no file path, no markdown.

SectionCard shape:
{
  "sectionTitle": "one of the requested six section titles",
  "statusSummary": "2-4 sentence answer for this card",
  "verdict": "clear strategic verdict",
  "confidence": 0-100,
  "keyFindings": [{"title":"string","detail":"string","evidence":"string","sourceUrl":"string"}],
  "evidenceQuotes": [{"quote":"string","source":"string","url":"string","interpretation":"string"}],
  "risksOrGaps": ["string"],
  "recommendedMoves": ["string"]
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasAnthropicAuth(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function tryExtractJson(text: string): unknown | null {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return extractJson(text);
  } catch {
    return null;
  }
}

async function downloadAnthropicFileText(
  client: ReturnType<typeof createClient>,
  fileId: string,
): Promise<string | null> {
  const response = await client.beta.files.download(fileId);
  const text = await response.text();
  return text.trim().length > 0 ? text : null;
}

function normalizeSectionPayload(
  section: DeepResearchBoundarySection,
  value: unknown,
  corpus: Record<string, unknown>,
): Record<string, unknown> {
  const payload = isRecord(value) ? { ...value } : {};
  payload.sectionTitle = typeof payload.sectionTitle === 'string' ? payload.sectionTitle : SECTION_TITLES[section];
  payload.source = 'deepResearchProgram';
  payload.sharedCorpus = corpus;
  if (!Array.isArray(payload.keyFindings)) payload.keyFindings = [];
  if (!Array.isArray(payload.evidenceQuotes)) payload.evidenceQuotes = [];
  if (!Array.isArray(payload.risksOrGaps)) payload.risksOrGaps = [];
  if (!Array.isArray(payload.recommendedMoves)) payload.recommendedMoves = [];
  if (typeof payload.statusSummary !== 'string') payload.statusSummary = 'Deep research completed, but this card returned limited structured detail.';
  if (typeof payload.verdict !== 'string') payload.verdict = 'Review required — limited structured output.';
  if (typeof payload.confidence !== 'number') payload.confidence = 50;
  return payload;
}

export function splitDeepResearchResult(result: ResearchResult): ResearchResult[] {
  if (result.status !== 'complete' || !isRecord(result.data)) return [];
  const sections = isRecord(result.data.sections) ? result.data.sections : {};
  const corpus = isRecord(result.data.corpus) ? result.data.corpus : {};

  return DEEP_RESEARCH_BOUNDARY_SECTIONS.map((section) => ({
    status: 'complete' as const,
    section: DEEP_RESEARCH_SECTION_MAP[section],
    data: normalizeSectionPayload(section, sections[section], corpus),
    durationMs: result.durationMs,
    rawText: result.rawText,
    citations: result.citations,
    provenance: result.provenance,
    telemetry: result.telemetry,
  }));
}

export async function runDeepResearchProgram(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startTime = Date.now();

  try {
    if (!hasAnthropicAuth()) {
      return {
        status: 'error',
        section: 'deepResearchProgram',
        error:
          'ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is not configured in the research worker environment. Deep research cannot run without direct Anthropic auth.',
        durationMs: Date.now() - startTime,
      };
    }

    const client = createClient({ enableSkillsBeta: true });
    const codeExecutionOutputFileIds: string[] = [];
    const codeExecutionStdouts: string[] = [];
    await emitRunnerProgress(onProgress, 'runner', 'starting one-pass deep research program for all six cards');
    const finalMsg = await runWithBackoff(
      () => {
        const container = buildDeepResearchContainerParams();
        const runner = client.beta.messages.toolRunner({
          model: DEEP_RESEARCH_MODEL,
          max_tokens: DEEP_RESEARCH_MAX_TOKENS,
          stream: true,
          ...(container ? { container } : {}),
          tools: [
            { type: 'web_search_20250305' as const, name: 'web_search' },
            ...(container ? [{ type: 'code_execution_20250825' as const, name: 'code_execution' as const }] : []),
          ],
          system: maybeCachedSystem(DEEP_RESEARCH_SYSTEM_PROMPT) as Parameters<typeof client.beta.messages.toolRunner>[0]['system'],
          messages: [{
            role: 'user',
            content: `Use the onboarding/prefill context below as confirmed input. Run focused web research once, build a shared evidence corpus, then synthesize the six requested GTM research cards.\n\n${context}`,
          }],
        });
        return Promise.race([
          runStreamedToolRunner(runner, {
            onProgress,
            synthesisMessage: 'synthesizing shared corpus into six GTM cards',
            maxToolIterations: 8,
            onCodeExecutionOutputFile: (fileId) => {
              if (!codeExecutionOutputFileIds.includes(fileId)) {
                codeExecutionOutputFileIds.push(fileId);
              }
            },
            onCodeExecutionStdout: (stdout) => {
              if (!codeExecutionStdouts.includes(stdout)) {
                codeExecutionStdouts.push(stdout);
              }
            },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Deep research program timed out after ${Math.round(DEEP_RESEARCH_TIMEOUT_MS / 1000)}s`)), DEEP_RESEARCH_TIMEOUT_MS)),
        ]);
      },
      'deepResearchProgram',
    );

    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let parsed: unknown | null = tryExtractJson(resultText);
    let parseSource = parsed ? 'assistant text' : null;

    if (!parsed) {
      for (const stdout of codeExecutionStdouts) {
        parsed = tryExtractJson(stdout);
        if (parsed) {
          parseSource = 'code execution stdout';
          break;
        }
      }
    }

    if (!parsed && codeExecutionOutputFileIds.length > 0) {
      await emitRunnerProgress(onProgress, 'tool', 'reading exported JSON from code execution output');
      for (const fileId of codeExecutionOutputFileIds) {
        try {
          const fileText = await downloadAnthropicFileText(client, fileId);
          parsed = fileText ? tryExtractJson(fileText) : null;
          if (parsed) {
            parseSource = `code execution file ${fileId}`;
            break;
          }
        } catch (downloadError) {
          console.warn('[deep-research-program] Could not read code execution output file:', {
            fileId,
            error: downloadError instanceof Error ? downloadError.message : String(downloadError),
          });
        }
      }
    }

    if (!parsed || !isRecord(parsed)) {
      console.error('[deep-research-program] JSON extraction failed:', {
        assistantTextPreview: resultText.slice(0, 500),
        codeExecutionOutputFileCount: codeExecutionOutputFileIds.length,
        codeExecutionStdoutCount: codeExecutionStdouts.length,
      });
      return {
        status: 'error',
        section: 'deepResearchProgram',
        error:
          'Deep research returned no parseable JSON in assistant text, code execution stdout, or exported files',
        durationMs: Date.now() - startTime,
        rawText: resultText,
        telemetry: buildRunnerTelemetry(finalMsg),
      };
    }

    if (parseSource) {
      console.log(`[deep-research-program] Parsed JSON from ${parseSource}`);
    }

    return {
      status: 'complete',
      section: 'deepResearchProgram',
      data: parsed,
      durationMs: Date.now() - startTime,
      rawText: resultText,
      telemetry: buildRunnerTelemetry(finalMsg),
      provenance: {
        status: 'sourced',
        citationCount: Array.isArray((parsed.corpus as Record<string, unknown> | undefined)?.sources)
          ? ((parsed.corpus as Record<string, unknown>).sources as unknown[]).length
          : 0,
      },
    };
  } catch (error) {
    return {
      status: 'error',
      section: 'deepResearchProgram',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}
