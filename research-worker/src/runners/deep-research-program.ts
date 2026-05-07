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

const DEEP_RESEARCH_MODEL = process.env.RESEARCH_DEEP_PROGRAM_MODEL ?? MODELS.STANDARD;
const DEEP_RESEARCH_MAX_TOKENS = Number(process.env.RESEARCH_DEEP_PROGRAM_MAX_TOKENS ?? 20000);
const DEEP_RESEARCH_TIMEOUT_MS = Number(process.env.RESEARCH_DEEP_PROGRAM_TIMEOUT_MS ?? 900000);

const DEEP_RESEARCH_SYSTEM_PROMPT = `You are AI-GOS's Deep Research Agent for a supervised GTM workspace.

MISSION
Run one evidence-grounded company/category research pass that extracts and verifies company context for onboarding.
Do not write GTM section cards. Do not synthesize market, ICP, competitor, offer, keyword, or VoC sections.
Your job is to build the company corpus that later section-specific synthesis jobs will use one by one.

STYLE
- Be specific, executive, and useful. No generic strategy filler.
- Every major claim must be backed by a source, quote, user-provided context, or explicit "insufficient evidence" marker.
- Do not invent market size, pricing, CAC, ROAS, search volume, competitor claims, or customer quotes.
- If source coverage is thin, say exactly what is missing and still provide the best grounded diagnosis.
- Keep output concise but complete enough to complete onboarding and seed later section synthesis.

OUTPUT
Return ONLY valid JSON. No markdown fences. Shape:
{
  "corpus": {
    "company": "string",
    "category": "string",
    "researchSummary": "string",
    "sources": [{"title":"string","url":"string","whyItMatters":"string"}],
    "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}]
  }
}

CRITICAL RETURN CONTRACT
- Do not export, attach, or summarize the final JSON as a file.
- You may use code_execution only as scratch analysis. The final assistant response itself must contain the complete JSON object.
- The final response must start with "{" and end with "}". No preamble, no completion note, no file path, no markdown.`;

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
    await emitRunnerProgress(onProgress, 'runner', 'starting company research extraction');
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
            content: `Use the onboarding/prefill context below as confirmed input. Run focused web research once and build the shared company evidence corpus for onboarding. Do not synthesize GTM report sections in this run.\n\n${context}`,
          }],
        });
        return Promise.race([
          runStreamedToolRunner(runner, {
            onProgress,
            synthesisMessage: 'assembling company corpus for onboarding',
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
