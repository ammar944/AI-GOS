import type { SupabaseClient } from '@supabase/supabase-js';

import type { AllPositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import type { ResearchInput } from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  createResearchArtifactsEvidencePoolStore,
  type SupabaseEvidencePoolClient,
} from '@/lib/lab-engine/evidence/evidence-pool';
import {
  createResearchArtifactsResearchFactStore,
  type ResearchFactsSupabaseClient,
} from '@/lib/lab-engine/evidence/research-fact';
import { prepareSectionContext } from '@/lib/lab-engine/agents/run-section';
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
import {
  createSupabaseRunStore,
  type SupabaseRunStoreReviewDispatch,
} from '@/lib/research-v2/supabase-run-store';

// Default 285_000 keeps the job inside the 300s Vercel route budget and the
// tested deadline invariant (answerTool < job < route maxDuration; see
// timeout-constants.test.ts). Overridable via env for LOCAL/dev runs ONLY —
// e.g. agentic GLM sections that need >285s. Do NOT set this in prod without
// also raising the route maxDuration (the unresolved runtime-placement decision).
const parsedLabSectionJobTimeoutMs = Number(
  process.env.LAB_SECTION_JOB_TIMEOUT_MS,
);
export const LAB_SECTION_JOB_TIMEOUT_MS =
  Number.isFinite(parsedLabSectionJobTimeoutMs) &&
  parsedLabSectionJobTimeoutMs > 0
    ? parsedLabSectionJobTimeoutMs
    : 285_000;

// The paid-media composer runs on its OWN route (run-paid-media-plan/route.ts,
// maxDuration=800) — isolated from the six-section fan-out route — because a
// single GLM compose runs ~385s (owner-paid live clay run) and would be killed
// by a short shared route clock. 760s clears that with margin while staying
// under the 800s route cap (>=15s salvage-commit headroom). Pinned in
// timeout-constants.test.ts. Passed via scheduleLabSectionJob({ jobTimeoutMs }).
export const PAID_MEDIA_PLAN_JOB_TIMEOUT_MS = 760_000;

export type ScheduleLabSectionTask = (task: () => Promise<void>) => void;

export interface ScheduleLabSectionJobInput {
  userId: string;
  runId: string;
  sectionId: SupportedSectionId;
  zones: readonly AllPositioningSectionId[];
  researchInput: ResearchInput;
  supabase: SupabaseClient;
  schedule: ScheduleLabSectionTask;
  // Per-dispatch override of the default section job deadline. The paid-media
  // composer passes PAID_MEDIA_PLAN_JOB_TIMEOUT_MS from its own maxDuration=800
  // route so its composer clock stays isolated from the six-section fan-out.
  jobTimeoutMs?: number;
  onJobComplete?: (context: ScheduleLabSectionJobContext) => Promise<void>;
  // True W3 detach: forwarded to the run store so the post-commit agentic
  // review runs in its own route invocation instead of this one's clock.
  reviewDispatch?: SupabaseRunStoreReviewDispatch;
}

export interface ScheduleLabSectionJobResult extends SeedOrchestrationResult {
  claim: SectionRunClaimResult;
}

export interface ScheduleLabSectionJobContext {
  claim: SectionRunClaimResult;
  seeded: SeedOrchestrationResult;
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
    schedulePostCommitReview: input.schedule,
    ...(input.reviewDispatch === undefined
      ? {}
      : { reviewDispatch: input.reviewDispatch }),
  });
  const evidencePoolStore = createResearchArtifactsEvidencePoolStore(
    input.supabase as unknown as SupabaseEvidencePoolClient,
  );
  const factStore = createResearchArtifactsResearchFactStore(
    input.supabase as unknown as ResearchFactsSupabaseClient,
    seeded.parent_audit_run_id,
  );

  await store.createRun(input.researchInput);
  // KEYSTONE: thread factStore + parentAuditRunId so the dispatch-time prepared
  // context actually reads the shared research_facts ledger (the orchestrator
  // writes facts before fan-out; this SELECT surfaces them). Without these args
  // the ledger is write-only in practice — preparedContext.factRows is always
  // empty and the job's own factStore is dead via the `??` short-circuit.
  const preparedContext = await prepareSectionContext(
    {
      runId: input.runId,
      sectionId: input.sectionId,
    },
    { store, factStore, parentAuditRunId: seeded.parent_audit_run_id },
  );

  const jobTimeoutMs = input.jobTimeoutMs ?? LAB_SECTION_JOB_TIMEOUT_MS;
  input.schedule(async (): Promise<void> => {
    const controller = new AbortController();
    const deadlineAt = Date.now() + jobTimeoutMs;
    const timer = setTimeout(() => {
      controller.abort(
        new Error(`lab section job timed out after ${jobTimeoutMs}ms`),
      );
    }, jobTimeoutMs);
    try {
      await runLabSectionJob({
        runId: input.runId,
        sectionId: input.sectionId,
        deadlineAt,
        evidencePoolStore,
        factStore,
        parentAuditRunId: seeded.parent_audit_run_id,
        preparedContext,
        signal: controller.signal,
        store,
      });
      await input.onJobComplete?.({ claim, seeded });
    } finally {
      clearTimeout(timer);
    }
  });

  return { ...seeded, claim };
}
