import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export type SectionRunClaimStatus =
  | 'claimed'
  | 'already_running'
  | 'already_complete'
  | 'already_error'
  | 'not_found';

export type SectionRunPreviousStatus = 'queued' | 'running' | 'complete' | 'error';

export interface SectionRunClaimResult {
  status: SectionRunClaimStatus;
  runId: string;
  sectionId: string;
  sectionRunId?: string;
  previousStatus?: SectionRunPreviousStatus;
}

export interface ClaimSectionRunInput {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  sectionId: string;
}

const SectionRunClaimRpcRowSchema = z
  .object({
    status: z.enum([
      'claimed',
      'already_running',
      'already_complete',
      'already_error',
      'not_found',
    ]),
    run_id: z.string().uuid(),
    section_id: z.string().min(1),
    section_run_id: z.string().uuid().nullable().optional(),
    previous_status: z
      .enum(['queued', 'running', 'complete', 'error'])
      .nullable()
      .optional(),
  })
  .strict();
const SectionRunClaimRpcRowsSchema = z.array(SectionRunClaimRpcRowSchema);

export class SectionRunClaimError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = 'SectionRunClaimError';
  }
}

export function parseSectionRunClaimResult(
  rowsInput: unknown,
): SectionRunClaimResult {
  let rows: z.infer<typeof SectionRunClaimRpcRowsSchema>;
  try {
    rows = SectionRunClaimRpcRowsSchema.parse(rowsInput ?? []);
  } catch (err) {
    throw new SectionRunClaimError(
      'claim_section_run returned malformed rows',
      err,
    );
  }

  if (rows.length !== 1) {
    throw new SectionRunClaimError(
      `claim_section_run returned ${rows.length} rows; expected 1`,
      null,
    );
  }

  const [row] = rows;
  return {
    status: row.status,
    runId: row.run_id,
    sectionId: row.section_id,
    ...(row.section_run_id ? { sectionRunId: row.section_run_id } : {}),
    ...(row.previous_status ? { previousStatus: row.previous_status } : {}),
  };
}

export async function claimSectionRun(
  input: ClaimSectionRunInput,
): Promise<SectionRunClaimResult> {
  const { data, error } = await input.supabase.rpc('claim_section_run', {
    p_user_id: input.userId,
    p_run_id: input.runId,
    p_section_id: input.sectionId,
  });

  if (error) {
    throw new SectionRunClaimError(
      `claim_section_run RPC failed for userId=${input.userId} runId=${input.runId} sectionId=${input.sectionId}: ${error.message}`,
      error,
    );
  }

  const result = parseSectionRunClaimResult(data);
  if (result.runId !== input.runId || result.sectionId !== input.sectionId) {
    throw new SectionRunClaimError(
      `claim_section_run returned mismatched row for userId=${input.userId} runId=${input.runId} sectionId=${input.sectionId}`,
      result,
    );
  }

  return result;
}
