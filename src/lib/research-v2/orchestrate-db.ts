// Phase 1 of the orchestrator + artifact UI cycle.
// Server-only helpers that wrap the seed_orchestration RPC.

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import { createAdminClient } from '@/lib/supabase/server';

export type SectionSeedStatus = 'queued' | 'running' | 'complete' | 'error';

export interface SeedOrchestrationResult {
  parent_audit_run_id: string;
  section_run_ids: Array<{
    section_id: string;
    section_run_id: string;
    ordinal: number;
    reused: boolean;
    status: SectionSeedStatus;
  }>;
}

const RpcRowSchema = z.object({
  parent_id: z.string().uuid(),
  zone: z.string(),
  section_run_id: z.string().uuid(),
  ordinal: z.number().int().min(1),
  reused: z.boolean(),
  status: z.enum(['queued', 'running', 'complete', 'error']),
});
const RpcRowsSchema = z.array(RpcRowSchema);
const FreezeReviewedBriefSnapshotResultSchema = z.enum([
  'frozen',
  'already_frozen',
]);
const ResetSectionRunForRerunRowSchema = z
  .object({
    section_run_id: z.string().uuid(),
    previous_section_run_id: z.string().uuid().nullable().optional(),
    previous_status: z.string().nullable().optional(),
  })
  .strict();
const ResetSectionRunForRerunRowsSchema = z.array(
  ResetSectionRunForRerunRowSchema,
);

export interface SeedOrchestrationInput {
  userId: string;
  runId: string;
  zones?: readonly string[];
}

export interface ResetSectionRunForRerunInput {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  sectionId: string;
}

export interface ResetSectionRunForRerunResult {
  sectionRunId: string;
  previousSectionRunId?: string;
  previousStatus?: string;
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
  const requestedZoneSet: ReadonlySet<string> = new Set(zones);

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
      if (!requestedZoneSet.has(row.zone)) {
        throw new OrchestrateRpcError(
          `seed_orchestration returned unrequested zone "${row.zone}"`,
          null,
        );
      }
      return {
        section_id: row.zone,
        section_run_id: row.section_run_id,
        ordinal: row.ordinal,
        reused: row.reused,
        status: row.status,
      };
    });

  return { parent_audit_run_id, section_run_ids };
}

export async function resetSectionRunForRerun(
  input: ResetSectionRunForRerunInput,
): Promise<ResetSectionRunForRerunResult> {
  const { data, error } = await input.supabase.rpc('reset_section_run_for_rerun', {
    p_user_id: input.userId,
    p_run_id: input.runId,
    p_section_id: input.sectionId,
  });

  if (error) {
    throw new OrchestrateRpcError(
      `reset_section_run_for_rerun RPC failed for runId=${input.runId} sectionId=${input.sectionId}: ${error.message}`,
      error,
    );
  }

  let rows: z.infer<typeof ResetSectionRunForRerunRowsSchema>;
  try {
    rows = ResetSectionRunForRerunRowsSchema.parse(data ?? []);
  } catch (err) {
    throw new OrchestrateRpcError(
      `reset_section_run_for_rerun returned malformed rows for runId=${input.runId} sectionId=${input.sectionId}`,
      err,
    );
  }

  if (rows.length !== 1) {
    throw new OrchestrateRpcError(
      `reset_section_run_for_rerun returned ${rows.length} rows; expected 1 for runId=${input.runId} sectionId=${input.sectionId}`,
      null,
    );
  }

  const [row] = rows;
  return {
    sectionRunId: row.section_run_id,
    ...(row.previous_section_run_id
      ? { previousSectionRunId: row.previous_section_run_id }
      : {}),
    ...(row.previous_status ? { previousStatus: row.previous_status } : {}),
  };
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
