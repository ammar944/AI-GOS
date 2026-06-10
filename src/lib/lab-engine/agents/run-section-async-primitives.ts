// Answer-tool retry config, env helpers, abort/timeout signal primitives,
// the first-step stall guard, and bounded-concurrency mapping. Extracted from
// run-section.ts in Phase 5 as a dependency-free leaf so the competitor-ad
// probe (and the runners) can import them without a cycle. Pure utilities; the
// section-level overall budget (answerToolTimeoutMs) stays in run-section.ts and
// is injected into the stall guard via overallTimeoutMs.

import { randomUUID } from "node:crypto";

import type { Tool, ToolExecutionOptions } from "ai";

import type { AgentStep, AnswerToolRunner } from "./section-agent";

// The first agent step (a model response or tool call) must arrive within this
// window. A stalled provider transport produces zero steps, so we abandon the
// attempt here instead of waiting out the full answer-tool budget.
const defaultAnswerToolFirstStepTimeoutMs = 120_000;
// One retry on a zero-step stall: the stall is a transient transport fault, so a
// fresh attempt usually proceeds. A second stall fails the section terminally.
const answerToolMaxAttempts = 2;

function getPositiveIntegerEnvValue(key: string): number | undefined {
  const rawValue = process.env[key]?.trim();

  if (rawValue === undefined || rawValue.length === 0) {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer number of milliseconds.`);
  }

  return value;
}

function getAnswerToolFirstStepTimeoutMs(): number {
  return (
    getPositiveIntegerEnvValue("LAB_ENGINE_ANSWER_TOOL_FIRST_STEP_TIMEOUT_MS") ??
    defaultAnswerToolFirstStepTimeoutMs
  );
}

function createToolExecutionOptions({
  signal,
  toolName,
}: {
  toolName: string;
  signal?: AbortSignal;
}): ToolExecutionOptions {
  return {
    abortSignal: signal,
    messages: [],
    toolCallId: `${toolName}_${randomUUID()}`,
  };
}

function createTimeoutSignal({
  parentSignal,
  reasonLabel = "Structured output",
  timeoutMs,
}: {
  parentSignal?: AbortSignal;
  reasonLabel?: string;
  timeoutMs: number;
}): { abort: (reason?: unknown) => void; cleanup: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`${reasonLabel} timed out after ${timeoutMs}ms.`));
  }, timeoutMs);
  const abortFromParent = (): void => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal?.aborted === true) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    abort: (reason?: unknown): void => {
      controller.abort(reason);
    },
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
    signal: controller.signal,
  };
}

function createForwardedAbortSignal(
  parentSignal?: AbortSignal,
): { abort: (reason?: unknown) => void; cleanup: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  const abortFromParent = (): void => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal?.aborted === true) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    abort: (reason?: unknown): void => {
      controller.abort(reason);
    },
    cleanup: () => {
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
    signal: controller.signal,
  };
}

async function withStructuredTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Structured output timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

type CapturedStructuredOutput<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

function captureStructuredOutput<T>(
  promise: PromiseLike<T>,
): Promise<CapturedStructuredOutput<T>> {
  return Promise.resolve(promise).then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );
}

// Thrown when an answer-tool attempt produces no step before the first-step
// watchdog fires. Distinct from a generic timeout so the caller can retry a
// zero-step stall while still failing fast on real, step-producing errors.
class AnswerToolStalledError extends Error {
  readonly attempt: number;
  readonly timeoutMs: number;

  constructor(attempt: number, timeoutMs: number) {
    super(
      `Answer tool produced no step within ${timeoutMs}ms (attempt ${attempt}).`,
    );
    this.name = "AnswerToolStalledError";
    this.attempt = attempt;
    this.timeoutMs = timeoutMs;
  }
}

// Runs the answer tool with a first-step watchdog layered over the overall
// budget. If an attempt produces no step within the first-step window we
// abandon it WITHOUT awaiting the (possibly never-settling) provider promise,
// emit a retry event, and start a fresh attempt. Once any step has arrived the
// watchdog disarms and the run proceeds under the remaining overall budget, so
// long-but-progressing runs are never killed early.
async function runAnswerToolWithStallGuard({
  onStall,
  onStep,
  overallTimeoutMs,
  params,
  parentSignal,
  runAnswerTool,
}: {
  onStall: (info: {
    attempt: number;
    timeoutMs: number;
  }) => void | Promise<void>;
  onStep: (step: AgentStep) => void;
  overallTimeoutMs: number;
  params: Omit<Parameters<AnswerToolRunner>[0], "onStepFinish" | "signal">;
  parentSignal?: AbortSignal;
  runAnswerTool: AnswerToolRunner;
}): Promise<Awaited<ReturnType<AnswerToolRunner>>> {
  const overallDeadline = Date.now() + overallTimeoutMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= answerToolMaxAttempts; attempt += 1) {
    const remainingMs = overallDeadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    const timeoutSignal = createTimeoutSignal({
      parentSignal,
      reasonLabel: "Answer tool",
      timeoutMs: remainingMs,
    });
    const firstStepDeadlineMs = Math.min(
      getAnswerToolFirstStepTimeoutMs(),
      remainingMs,
    );
    let firstStepSeen = false;
    let attemptActive = true;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;

    const stallPromise = new Promise<never>((_resolve, reject) => {
      stallTimer = setTimeout(() => {
        if (!firstStepSeen) {
          reject(new AnswerToolStalledError(attempt, firstStepDeadlineMs));
        }
      }, firstStepDeadlineMs);
    });

    const runnerPromise = runAnswerTool({
      ...params,
      signal: timeoutSignal.signal,
      onStepFinish: (step) => {
        if (!attemptActive) {
          return;
        }
        firstStepSeen = true;
        onStep(step);
      },
    });

    try {
      return await Promise.race([runnerPromise, stallPromise]);
    } catch (error) {
      lastError = error;
      if (error instanceof AnswerToolStalledError) {
        // Stop counting steps from the abandoned attempt, free its request, and
        // swallow its eventual rejection so it does not surface as unhandled.
        attemptActive = false;
        timeoutSignal.abort(error);
        void runnerPromise.catch(() => undefined);
        if (attempt < answerToolMaxAttempts) {
          await onStall({ attempt, timeoutMs: firstStepDeadlineMs });
          continue;
        }
      }
      throw error;
    } finally {
      if (stallTimer !== undefined) {
        clearTimeout(stallTimer);
      }
      timeoutSignal.cleanup();
    }
  }

  throw (
    lastError ??
    new AnswerToolStalledError(
      answerToolMaxAttempts,
      getAnswerToolFirstStepTimeoutMs(),
    )
  );
}

function hasExecutableTool(
  tools: Record<string, unknown>,
  toolName: string,
): boolean {
  const tool = tools[toolName] as Tool<unknown, unknown> | undefined;
  return tool?.execute !== undefined;
}

function getExecutableTool<TInput>(
  tools: Record<string, unknown>,
  toolName: string,
): Tool<TInput, unknown> {
  const tool = tools[toolName] as Tool<TInput, unknown> | undefined;

  if (tool?.execute === undefined) {
    throw new Error(`Required tool ${toolName} has no execute function.`);
  }

  return tool;
}

async function mapWithBoundedConcurrency<TItem, TResult>({
  concurrency,
  items,
  mapper,
}: {
  concurrency: number;
  items: readonly TItem[];
  mapper: (item: TItem, index: number) => Promise<TResult>;
}): Promise<TResult[]> {
  const boundedConcurrency = Math.max(1, Math.floor(concurrency));
  const batches: TResult[][] = [];

  for (let start = 0; start < items.length; start += boundedConcurrency) {
    const batch = items.slice(start, start + boundedConcurrency);
    batches.push(
      await Promise.all(
        batch.map((item, offset) => mapper(item, start + offset)),
      ),
    );
  }

  return batches.flat();
}

export {
  answerToolMaxAttempts,
  defaultAnswerToolFirstStepTimeoutMs,
  getPositiveIntegerEnvValue,
  getAnswerToolFirstStepTimeoutMs,
  createToolExecutionOptions,
  createTimeoutSignal,
  createForwardedAbortSignal,
  withStructuredTimeout,
  captureStructuredOutput,
  AnswerToolStalledError,
  runAnswerToolWithStallGuard,
  hasExecutableTool,
  getExecutableTool,
  mapWithBoundedConcurrency,
};
export type { CapturedStructuredOutput };
