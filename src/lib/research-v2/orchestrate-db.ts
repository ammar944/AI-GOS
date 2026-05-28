// Phase 1 of the orchestrator + artifact UI cycle.
// Server-only helpers that wrap the seed_orchestration RPC.

import { z } from 'zod';

import {
  ALL_POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_IDS,
} from '@/lib/ai/prompts/positioning-skills';
import type { AllPositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { createAdminClient } from '@/lib/supabase/server';

export interface SeedOrchestrationResult {
  parent_audit_run_id: string;
  section_run_ids: Array<{
    section_id: AllPositioningSectionId;
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
const FreezeReviewedBriefSnapshotResultSchema = z.enum([
  'frozen',
  'already_frozen',
]);

const POSITIONING_ZONE_SET: ReadonlySet<string> = new Set(ALL_POSITIONING_SECTION_IDS);

export interface SeedOrchestrationInput {
  userId: string;
  runId: string;
  zones?: readonly AllPositioningSectionId[];
}

export interface FrozenGtmBriefThesisPatchInput {
  existingThesis: Record<string, unknown> | null;
  gtmBriefSnapshot: Record<string, unknown>;
  gtmBriefReview: Record<string, unknown> | null;
  frozenAt: string;
}

export interface FrozenGtmBriefThesisPatchResult {
  shouldUpdate: boolean;
  thesis: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function buildFrozenGtmBriefThesisPatch(
  input: FrozenGtmBriefThesisPatchInput,
): FrozenGtmBriefThesisPatchResult {
  const existingThesis = input.existingThesis ?? {};
  if (
    existingThesis.source === 'onboarding_v2_review' &&
    asRecord(existingThesis.gtmBriefSnapshot)
  ) {
    return { shouldUpdate: false, thesis: existingThesis };
  }

  return {
    shouldUpdate: true,
    thesis: {
      ...existingThesis,
      source: 'onboarding_v2_review',
      frozenAt: input.frozenAt,
      gtmBriefSnapshot: input.gtmBriefSnapshot,
      gtmBriefReview: input.gtmBriefReview,
    },
  };
}

export async function freezeReviewedBriefSnapshot(input: {
  parentAuditRunId: string;
  gtmBriefSnapshot: Record<string, unknown>;
  gtmBriefReview: Record<string, unknown> | null;
  frozenAt?: string;
}): Promise<'frozen' | 'already_frozen'> {
  const supabase = createAdminClient();
  const frozenAt = input.frozenAt ?? new Date().toISOString();
  const { data, error } = await supabase.rpc('freeze_reviewed_brief_snapshot', {
    p_parent_audit_run_id: input.parentAuditRunId,
    p_gtm_brief_snapshot: input.gtmBriefSnapshot,
    p_gtm_brief_review: input.gtmBriefReview,
    p_frozen_at: frozenAt,
  });

  if (error) {
    throw new OrchestrateRpcError(
      `freeze_reviewed_brief_snapshot RPC failed: ${error.message}`,
      error,
    );
  }

  return FreezeReviewedBriefSnapshotResultSchema.parse(data);
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
        section_id: row.zone as AllPositioningSectionId,
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
