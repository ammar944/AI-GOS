import type { JobStatusRow } from './supabase';
import type { RunnerProgressReporter } from './runner';

/**
 * Testable factory for the emitProgress closure used inside the /run handler.
 * Lives in its own module so tests can import it without pulling in Express.
 */
export function createEmitProgress({
  queueWrite,
  getJobFinalized,
  runId,
  status,
  tool,
  startedAt,
}: {
  queueWrite: (row: JobStatusRow) => unknown;
  getJobFinalized: () => boolean;
  runId: string | undefined;
  status: 'running';
  tool: string;
  startedAt: string;
}): { emitProgress: RunnerProgressReporter; getLastSignature: () => string | null } {
  let lastProgressSignature: string | null = null;

  const emitProgress: RunnerProgressReporter = async (update) => {
    if (getJobFinalized()) {
      return;
    }

    const signature = update.phase === 'artifact'
      ? null
      : `${update.phase}:${update.message}:${update.id ?? ''}`;
    if (signature && signature === lastProgressSignature) {
      return;
    }
    lastProgressSignature = signature;

    await queueWrite({
      runId,
      status,
      tool,
      startedAt,
      lastHeartbeat: new Date().toISOString(),
      updates: [
        {
          at: update.at ?? new Date().toISOString(),
          id: update.id ?? crypto.randomUUID(),
          message: update.message,
          phase: update.phase,
          ...(update.meta ? { meta: update.meta } : {}),
        },
      ],
    });
  };

  return { emitProgress, getLastSignature: () => lastProgressSignature };
}
