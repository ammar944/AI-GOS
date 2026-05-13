// Phase 1 of the orchestrator + artifact UI cycle.
// Server-only helpers that wrap the seed_orchestration RPC.

import { z } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { createAdminClient } from '@/lib/supabase/server';

export interface SeedOrchestrationResult {
  parent_audit_run_id: string;
  section_run_ids: Array<{
    section_id: PositioningSectionId;
    section_run_id: string;
    ordinal: number;
    reused: boolean;
  }>;
}

const RpcRowSchema = z.object({
  parent_id: z.string().uuid(),
  zone: z.string(),
  section_run_id: z.string().uuid(),
  ordinal: z.number().int().min(1),
  reused: z.boolean(),
});
const RpcRowsSchema = z.array(RpcRowSchema);

const POSITIONING_ZONE_SET: ReadonlySet<string> = new Set(POSITIONING_SECTION_IDS);

export interface SeedOrchestrationInput {
  userId: string;
  runId: string;
  zones?: readonly PositioningSectionId[];
}

export async function seedOrchestration(
  input: SeedOrchestrationInput,
): Promise<SeedOrchestrationResult> {
  const zones = input.zones ?? POSITIONING_SECTION_IDS;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('seed_orchestration', {
    p_user_id: input.userId,
    p_run_id: input.runId,
    p_zones: zones as readonly string[] as string[],
  });

  if (error) {
    throw new OrchestrateRpcError(error.message, error);
  }

  const rows = RpcRowsSchema.parse(data ?? []);
  if (rows.length !== zones.length) {
    throw new OrchestrateRpcError(
      `seed_orchestration returned ${rows.length} rows; expected ${zones.length}`,
      null,
    );
  }

  const parent_audit_run_id = rows[0]?.parent_id;
  if (!parent_audit_run_id) {
    throw new OrchestrateRpcError(
      'seed_orchestration returned no parent_id',
      null,
    );
  }

  const allSameParent = rows.every((row) => row.parent_id === parent_audit_run_id);
  if (!allSameParent) {
    throw new OrchestrateRpcError(
      'seed_orchestration returned mixed parent_ids',
      null,
    );
  }

  const section_run_ids = rows
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((row) => {
      if (!POSITIONING_ZONE_SET.has(row.zone)) {
        throw new OrchestrateRpcError(
          `seed_orchestration returned unknown zone "${row.zone}"`,
          null,
        );
      }
      return {
        section_id: row.zone as PositioningSectionId,
        section_run_id: row.section_run_id,
        ordinal: row.ordinal,
        reused: row.reused,
      };
    });

  return { parent_audit_run_id, section_run_ids };
}

export class OrchestrateRpcError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = 'OrchestrateRpcError';
  }
}
