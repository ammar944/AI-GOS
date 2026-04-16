/**
 * Shared cascade execution utilities for research-worker runners.
 *
 * Extracted from industry.ts, competitors.ts, and keywords.ts which all share:
 * - timeout error detection
 * - tool-based attempt execution (beta.messages.toolRunner + Promise.race)
 * - message-based attempt execution (messages.create + Promise.race)
 * - observability wrapper (start / complete / timed-out progress events)
 * - the primary → repair → rescue cascade loop for simple two/three-stage runners
 *
 * Complex runners (keywords, competitors) use the low-level helpers directly
 * because their cascade logic diverges (extra stages, provider gates, thin-artifact
 * detection).  Simple runners (industry) can use runWithCascade end-to-end.
 */

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  buildRunnerTelemetry,
  createClient,
  emitRunnerProgress,
  extractJson,
  runStreamedToolRunner,
  runWithBackoff,
  type RunnerProgressReporter,
  type RunnerProgressUpdate,
} from './runner';
import { finalizeRunnerResult } from './contracts';
import type { ResearchResult } from './supabase';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CascadeAttemptConfig {
  /** Human-readable mode name used for backoff keys and progress labels. */
  mode: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  /** Empty array → message attempt (no tools). Non-empty → tool attempt. */
  tools: readonly unknown[];
  system: string;
  synthesisMessage: string;
  /** Only used by tool attempts. Defaults to 3. */
  maxToolIterations?: number;
  /** User message content sent to the model. */
  userMessage: string;
}

export interface CascadeAttemptResult {
  resultText: string;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}

/** Deps injected for testing — mirrors the pattern used by each runner. */
export interface CascadeDeps {
  now?: () => number;
  parseJson?: (text: string) => unknown;
  runToolAttempt?: (
    config: CascadeAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<CascadeAttemptResult>;
  runMessageAttempt?: (
    config: CascadeAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<CascadeAttemptResult>;
}

/**
 * Stage definition passed to runWithCascade.
 * Each stage knows how to build its own context from the original context
 * plus whatever progress was captured before it ran.
 */
export interface CascadeStage {
  config: CascadeAttemptConfig;
  /**
   * Build the context string to pass for this stage.
   * Receives the original context, all captured progress, and the partial
   * draft text produced by the previous stage (if any).
   */
  buildContext: (
    originalContext: string,
    capturedProgress: RunnerProgressUpdate[],
    partialDraft?: string,
  ) => string;
  /**
   * Progress message emitted before this stage runs.
   * If omitted the observability wrapper still emits start/complete/timed-out.
   */
  recoveryMessage?: string;
}

/**
 * Configuration for runWithCascade.
 */
export interface CascadeConfig {
  /** Section name forwarded to finalizeRunnerResult. */
  section: string;
  /** Label used in error returns when the whole cascade fails. */
  errorSection: string;
  /** Brief initialisation message (e.g. "preparing market overview brief"). */
  initMessage: string;
  /** Ordered stages: [primary, repair?, rescue?]. */
  stages: [CascadeStage, ...CascadeStage[]];
  /**
   * Optional post-processing applied to the parsed JSON before finalization.
   * Return the (possibly modified) value, or the original if no changes needed.
   */
  normalizePayload?: (parsed: unknown) => unknown;
}

// ---------------------------------------------------------------------------
// Timeout detection
// ---------------------------------------------------------------------------

/** Returns true for any timeout-flavoured error from Anthropic or the worker. */
export function isCascadeTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('request timed out') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout')
  );
}

// ---------------------------------------------------------------------------
// Low-level attempt executors
// ---------------------------------------------------------------------------

function getResultText(finalMsg: { content: BetaContentBlock[] }): string {
  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return textBlock && 'text' in textBlock ? textBlock.text : '';
}

/**
 * Executes a tool-using attempt via client.beta.messages.toolRunner.
 * This is the standard path for primary passes that need web_search, spyfu, etc.
 */
export async function runCascadeToolAttempt(
  config: CascadeAttemptConfig,
  onProgress?: RunnerProgressReporter,
): Promise<CascadeAttemptResult> {
  const client = createClient();
  const finalMsg = await runWithBackoff(
    () => {
      const runner = client.beta.messages.toolRunner({
        model: config.model,
        max_tokens: config.maxTokens,
        stream: true,
        tools: config.tools as Parameters<typeof client.beta.messages.toolRunner>[0]['tools'],
        system: config.system,
        messages: [{ role: 'user', content: config.userMessage }],
      });
      return Promise.race([
        runStreamedToolRunner(runner, {
          onProgress,
          synthesisMessage: config.synthesisMessage,
          maxToolIterations: config.maxToolIterations ?? 3,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Sub-agent timed out after ${config.timeoutMs / 1000}s`),
              ),
            config.timeoutMs,
          ),
        ),
      ]);
    },
    `cascade:${config.mode}`,
  );

  return {
    resultText: getResultText(finalMsg),
    telemetry: buildRunnerTelemetry(finalMsg),
  };
}

/**
 * Executes a no-tool attempt via client.messages.create.
 * Used for repair/rescue passes where tools are disabled to force JSON output.
 */
export async function runCascadeMessageAttempt(
  config: CascadeAttemptConfig,
  onProgress?: RunnerProgressReporter,
): Promise<CascadeAttemptResult> {
  const client = createClient();
  await emitRunnerProgress(onProgress, 'analysis', config.synthesisMessage);

  const finalMsg = await runWithBackoff(
    () =>
      Promise.race([
        client.messages.create({
          model: config.model,
          max_tokens: config.maxTokens,
          system: config.system,
          messages: [{ role: 'user', content: config.userMessage }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Sub-agent timed out after ${config.timeoutMs / 1000}s`),
              ),
            config.timeoutMs,
          ),
        ),
      ]),
    `cascade:${config.mode}`,
  );

  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return {
    resultText: textBlock?.type === 'text' ? textBlock.text : '',
    telemetry: buildRunnerTelemetry(finalMsg),
  };
}

// ---------------------------------------------------------------------------
// Observability wrapper
// ---------------------------------------------------------------------------

/**
 * Runs a single attempt with start/complete/timed-out progress events.
 * Dispatches to tool or message attempt based on config.tools.length.
 */
export async function runCascadeAttemptWithObservability(
  config: CascadeAttemptConfig,
  onProgress: RunnerProgressReporter | undefined,
  deps: CascadeDeps = {},
): Promise<CascadeAttemptResult> {
  const hasTools = config.tools.length > 0;
  const runAttempt = hasTools
    ? (deps.runToolAttempt ?? runCascadeToolAttempt)
    : (deps.runMessageAttempt ?? runCascadeMessageAttempt);

  await emitRunnerProgress(onProgress, 'runner', `${config.mode} started`);

  try {
    const result = await runAttempt(config, onProgress);
    await emitRunnerProgress(onProgress, 'runner', `${config.mode} complete`);
    return result;
  } catch (error) {
    if (isCascadeTimeoutError(error)) {
      await emitRunnerProgress(onProgress, 'runner', `${config.mode} timed out`);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Full cascade runner (for simple primary → repair → rescue runners)
// ---------------------------------------------------------------------------

/**
 * Executes a multi-stage cascade for simple runners (e.g. industry).
 *
 * Flow:
 * 1. Run stages[0] (primary). On timeout → fall through to stages[1].
 * 2. Run stages[1] (repair). On timeout → fall through to stages[2] if present.
 * 3. Run stages[N-1] (rescue/final). If it times out, the error propagates.
 * 4. After each stage attempt, try to parse JSON. If parse fails (or telemetry
 *    says max_tokens), advance to the next stage with the partial draft.
 * 5. Call finalizeRunnerResult with the last parsed result.
 *
 * For runners with non-trivial cascade logic (keywords, competitors), use the
 * lower-level helpers (runCascadeAttemptWithObservability, isCascadeTimeoutError)
 * directly instead.
 */
export async function runWithCascade(
  originalContext: string,
  config: CascadeConfig,
  onProgress?: RunnerProgressReporter,
  deps: CascadeDeps = {},
): Promise<ResearchResult> {
  const now = deps.now ?? (() => Date.now());
  const parseJson = deps.parseJson ?? extractJson;
  const normalizePayload = config.normalizePayload ?? ((p: unknown) => p);
  const startTime = now();
  const capturedProgressUpdates: RunnerProgressUpdate[] = [];

  const reportProgress: RunnerProgressReporter = async (update) => {
    capturedProgressUpdates.push(update);
    await onProgress?.(update);
  };

  try {
    await emitRunnerProgress(reportProgress, 'runner', config.initMessage);

    let resultText = '';
    let telemetry!: ReturnType<typeof buildRunnerTelemetry>;

    // Run through stages sequentially. On timeout, advance to the next stage.
    // On parse failure after a completed attempt, also advance to the next stage.
    let stageIndex = 0;
    let partialDraft: string | undefined;

    while (stageIndex < config.stages.length) {
      const stage = config.stages[stageIndex];
      const stageContext = stage.buildContext(
        originalContext,
        capturedProgressUpdates,
        partialDraft,
      );
      const stageConfig: CascadeAttemptConfig = {
        ...stage.config,
        // Inject the built context into the userMessage if it uses a placeholder.
        // For flexibility, runners embed context directly in userMessage via buildContext.
      };

      if (stage.recoveryMessage) {
        await emitRunnerProgress(reportProgress, 'runner', stage.recoveryMessage);
      }

      let stageTimedOut = false;
      try {
        const result = await runCascadeAttemptWithObservability(
          { ...stageConfig, userMessage: stage.config.userMessage.replace('{{context}}', stageContext) },
          reportProgress,
          deps,
        );
        resultText = result.resultText;
        telemetry = result.telemetry;
      } catch (error) {
        if (!isCascadeTimeoutError(error)) {
          throw error;
        }
        stageTimedOut = true;
        // Save partial draft if any text was accumulated before timeout.
        if (resultText.trim().length > 0) {
          partialDraft = resultText;
        }
      }

      if (!stageTimedOut) {
        // Attempt to parse the result.
        let parsed: unknown;
        let parseError: unknown;
        try {
          parsed = normalizePayload(parseJson(resultText));
        } catch (error) {
          console.error(
            `[${config.section}:${stage.config.mode}] JSON extraction failed:`,
            resultText.slice(0, 300),
          );
          parseError = error;
        }

        const needsNextStage =
          parseError !== undefined || telemetry.stopReason === 'max_tokens';

        if (!needsNextStage || stageIndex === config.stages.length - 1) {
          // Either parsed successfully or no more stages left.
          return finalizeRunnerResult({
            section: config.section,
            durationMs: now() - startTime,
            parsed,
            rawText: resultText,
            parseError,
            telemetry,
          });
        }

        // Advance with the partial draft for the next stage.
        partialDraft = resultText;
      }

      stageIndex++;
    }

    // All stages timed out without producing parseable output.
    // Return a partial result with whatever text we have.
    return finalizeRunnerResult({
      section: config.section,
      durationMs: now() - startTime,
      parsed: undefined,
      rawText: resultText,
      parseError: new Error('All cascade stages timed out'),
      telemetry,
    });
  } catch (error) {
    return {
      status: 'error',
      section: config.errorSection,
      error: error instanceof Error ? error.message : String(error),
      durationMs: now() - startTime,
    };
  }
}
