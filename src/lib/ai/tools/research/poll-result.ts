import {
  readJobStatus,
  readResearchResult,
} from '@/lib/journey/read-research-result';

export interface PollOptions {
  maxWaitMs?: number; // Default: 300_000 (5 minutes)
  intervalMs?: number; // Default: 3_000 (3 seconds)
}

export interface PollResult {
  status: 'complete' | 'timeout' | 'error';
  data?: unknown;
  error?: string;
  durationMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollForResult(
  userId: string,
  section: string,
  jobId: string,
  opts?: PollOptions,
): Promise<PollResult> {
  const maxWaitMs = opts?.maxWaitMs ?? 300_000;
  const intervalMs = opts?.intervalMs ?? 3_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const jobStatus = await readJobStatus(userId, jobId);

    if (jobStatus?.status === 'complete') {
      const researchData = await readResearchResult(userId, section);
      return {
        status: 'complete',
        data: researchData,
        durationMs: Date.now() - startTime,
      };
    }

    if (jobStatus?.status === 'error') {
      return {
        status: 'error',
        error: jobStatus.error ?? 'Research job failed',
        durationMs: Date.now() - startTime,
      };
    }

    await sleep(intervalMs);
  }

  const partialData = await readResearchResult(userId, section);
  return {
    status: 'timeout',
    data: partialData,
    durationMs: Date.now() - startTime,
  };
}
