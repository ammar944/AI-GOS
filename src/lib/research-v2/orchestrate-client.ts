// Phase 1 of the orchestrator + artifact UI cycle.
// Browser-safe fetch wrapper for POST /api/research-v2/orchestrate.

import { z } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

const POSITIONING_ZONE_SET: ReadonlySet<string> = new Set(POSITIONING_SECTION_IDS);

const SectionRunIdSchema = z.object({
  section_id: z.string().refine((v) => POSITIONING_ZONE_SET.has(v), {
    message: 'unknown positioning section id',
  }) as unknown as z.ZodType<PositioningSectionId>,
  section_run_id: z.string().uuid(),
  ordinal: z.number().int().min(1),
  reused: z.boolean(),
});

export const OrchestrateResponseSchema = z.object({
  parent_audit_run_id: z.string().uuid(),
  section_run_ids: z.array(SectionRunIdSchema).length(POSITIONING_SECTION_IDS.length),
});
export type OrchestrateResponse = z.infer<typeof OrchestrateResponseSchema>;

export const OrchestrateRequestSchema = z.object({
  journey_session_id: z.string().uuid().optional(),
  run_id: z.string().uuid(),
  executionMode: z.enum(['draft', 'deep', 'managed']).optional(),
});
export type OrchestrateRequest = z.infer<typeof OrchestrateRequestSchema>;

/**
 * Reads the public managed-agents opt-in flag for the browser side.
 * The server-side gate is MANAGED_AGENTS_POSITIONING_ENABLED; this
 * NEXT_PUBLIC_ variant exists only so the frontend knows whether to
 * request executionMode='managed' from the orchestrate route. Both
 * flags must be 'true' for the managed path to actually run.
 */
export function isManagedAgentsEnabledOnClient(): boolean {
  if (typeof process === 'undefined') return false;
  return process.env.NEXT_PUBLIC_MANAGED_AGENTS_ENABLED === 'true';
}

/** Convenience — what the 3 kickoff sites should send today. */
export function defaultOrchestrateExecutionMode():
  | 'managed'
  | undefined {
  return isManagedAgentsEnabledOnClient() ? 'managed' : undefined;
}

export interface PostOrchestrateOptions {
  signal?: AbortSignal;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export class OrchestrateClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'OrchestrateClientError';
  }
}

export async function postOrchestrate(
  body: OrchestrateRequest,
  options: PostOrchestrateOptions = {},
): Promise<OrchestrateResponse> {
  const parsedBody = OrchestrateRequestSchema.parse(body);
  const endpoint = options.endpoint ?? '/api/research-v2/orchestrate';
  const fetcher = options.fetchImpl ?? fetch;

  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsedBody),
    signal: options.signal,
  });

  let parsedJson: unknown = null;
  try {
    parsedJson = await response.json();
  } catch {
    parsedJson = null;
  }

  if (!response.ok) {
    throw new OrchestrateClientError(
      `POST ${endpoint} failed: ${response.status}`,
      response.status,
      parsedJson,
    );
  }

  return OrchestrateResponseSchema.parse(parsedJson);
}
