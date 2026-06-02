import type { SupabaseClient } from '@supabase/supabase-js';

import type { AllPositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import type { ResearchInput } from '@/lib/lab-engine/artifacts/artifact-envelope';
import type { SupportedSectionId } from '@/lib/lab-engine/sections/section-registry';
import { runLabSectionJob } from '@/lib/research-v2/lab-section-job';
import {
  seedOrchestration,
  type SeedOrchestrationResult,
} from '@/lib/research-v2/orchestrate-db';
import {
  claimSectionRun,
  type SectionRunClaimResult,
} from '@/lib/research-v2/section-run-claim';
import { buildSectionRunIdByZone } from '@/lib/research-v2/section-run-id-map';
import { createSupabaseRunStore } from '@/lib/research-v2/supabase-run-store';

export const LAB_SECTION_JOB_TIMEOUT_MS = 270_000;

export type ScheduleLabSectionTask = (task: () => Promise<void>) => void;

export interface ScheduleLabSectionJobInput {
  userId: string;
  runId: string;
  sectionId: SupportedSectionId;
  zones: readonly AllPositioningSectionId[];
  researchInput: ResearchInput;
  supabase: SupabaseClient;
  schedule: ScheduleLabSectionTask;
}

export interface ScheduleLabSectionJobResult extends SeedOrchestrationResult {
  claim: SectionRunClaimResult;
}

export class LabSectionDispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LabSectionDispatchError';
  }
}

export async function scheduleLabSectionJob(
  input: ScheduleLabSectionJobInput,
): Promise<ScheduleLabSectionJobResult> {
  const seeded = await seedOrchestration({
    userId: input.userId,
    runId: input.runId,
    zones: input.zones,
  });

  const claim = await claimSectionRun({
    supabase: input.supabase,
    userId: input.userId,
    runId: input.runId,
    sectionId: input.sectionId,
  });

  if (claim.status === 'not_found') {
    throw new LabSectionDispatchError(
      `claim_section_run returned not_found for userId=${input.userId} runId=${input.runId} sectionId=${input.sectionId}`,
    );
  }

  if (claim.status !== 'claimed') {
    console.info('[lab-section-dispatch] skipped lab section job after claim', {
      runId: input.runId,
      sectionId: input.sectionId,
      status: claim.status,
      previousStatus: claim.previousStatus,
      sectionRunId: claim.sectionRunId,
    });
    return { ...seeded, claim };
  }

  if (!claim.sectionRunId) {
    throw new LabSectionDispatchError(
      `claim_section_run returned claimed without sectionRunId for userId=${input.userId} runId=${input.runId} sectionId=${input.sectionId}`,
    );
  }

  const sectionRunIdByZone = {
    ...buildSectionRunIdByZone(seeded, input.zones),
    [input.sectionId]: claim.sectionRunId,
  };
  const store = createSupabaseRunStore({
    supabase: input.supabase,
    userId: input.userId,
    parentAuditRunId: seeded.parent_audit_run_id,
    sectionRunIdByZone,
    researchInput: input.researchInput,
  });

  await store.createRun(input.researchInput);

  input.schedule(async (): Promise<void> => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(
        new Error(
          `lab section job timed out after ${LAB_SECTION_JOB_TIMEOUT_MS}ms`,
        ),
      );
    }, LAB_SECTION_JOB_TIMEOUT_MS);
    try {
      await runLabSectionJob({
        runId: input.runId,
        sectionId: input.sectionId,
        signal: controller.signal,
        store,
      });
    } finally {
      clearTimeout(timer);
    }
  });

  return { ...seeded, claim };
}
