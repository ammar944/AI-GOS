// Wave Executor — Staggered parallel execution with error isolation
// Used by the media plan pipeline to run synthesis calls in waves,
// respecting Anthropic's output token rate limits while maximizing parallelism.

export interface WaveTask<T> {
  id: string;
  execute: () => Promise<T>;
  onStart?: () => void;
  onComplete?: (result: T) => void;
  onError?: (error: Error) => void;
}

export interface WaveConfig {
  /** Delay in ms between task starts within a wave */
  staggerDelayMs: number;
}

export interface WaveResult<T> {
  results: Map<string, T>;
  errors: Map<string, Error>;
  timingMs: number;
}

/**
 * Execute multiple tasks in a wave with staggered starts.
 *
 * - First task starts immediately, subsequent tasks start after `staggerDelayMs`
 * - Uses `Promise.allSettled` so one failure doesn't kill the wave
 * - Calls onStart/onComplete/onError callbacks for progress tracking
 */
export async function executeWave<T>(
  tasks: WaveTask<T>[],
  config: WaveConfig,
): Promise<WaveResult<T>> {
  const waveStart = Date.now();
  const results = new Map<string, T>();
  const errors = new Map<string, Error>();

  const taskPromises = tasks.map((task, index) => {
    return new Promise<{ id: string; result?: T; error?: Error }>(async (resolve) => {
      // Stagger: first task starts immediately, rest wait
      if (index > 0) {
        await new Promise<void>((r) => setTimeout(r, config.staggerDelayMs * index));
      }

      task.onStart?.();

      try {
        const result = await task.execute();
        task.onComplete?.(result);
        resolve({ id: task.id, result });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        task.onError?.(error);
        resolve({ id: task.id, error });
      }
    });
  });

  const settled = await Promise.all(taskPromises);

  for (const outcome of settled) {
    if (outcome.error) {
      errors.set(outcome.id, outcome.error);
    } else {
      results.set(outcome.id, outcome.result as T);
    }
  }

  // If any tasks failed, throw with details about which sections failed
  if (errors.size > 0) {
    const failedIds = Array.from(errors.keys());
    const firstError = errors.values().next().value!;
    throw new Error(
      `Wave execution failed for section(s): ${failedIds.join(', ')}. ` +
      `First error: ${firstError.message}`,
    );
  }

  return {
    results,
    errors,
    timingMs: Date.now() - waveStart,
  };
}
