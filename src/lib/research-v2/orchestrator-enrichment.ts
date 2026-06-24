// P4b — orchestrator enrichment delivery.
//
// The GLM orchestrator (orchestrator-glm.ts) discovers gtmFields (companyName,
// category, productDescription, targetCustomer, topCompetitors[], marketProblem)
// + a research digest, but those have NO path to the six positioning sections:
// the sections build their ResearchInput from journey_sessions.onboarding_data
// via corpusToResearchInput, which reads `topCompetitors` (-> buildCompetitorSeeds)
// and `marketProblem` (-> voiceOfClient) off that JSONB.
//
// This module persists the orchestrator's discovered fields back into
// onboarding_data so the sections downstream pick them up — GAP-FILL ONLY:
// a non-empty user-supplied field (the onboarding-reframe keeps the human in
// the loop) is never overwritten. Best-effort: a write failure never throws,
// so the section fan-out still proceeds.

import type { OrchestratorGtmFields } from "@/lib/lab-engine/agents/orchestrator-glm";

export interface OrchestratorEnrichmentInput {
  gtmFields: OrchestratorGtmFields | null;
  researchDigest: string;
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

/**
 * Merge orchestrator-discovered gtm fields into the onboarding_data record,
 * filling only fields the operator left blank. Pure — returns a new object,
 * does not mutate the input. A null `gtmFields` is a no-op (returns the input).
 */
export function mergeOrchestratorEnrichment(
  onboardingData: Record<string, unknown>,
  { gtmFields, researchDigest }: OrchestratorEnrichmentInput,
): Record<string, unknown> {
  if (gtmFields === null) {
    return onboardingData;
  }

  const merged: Record<string, unknown> = { ...onboardingData };

  // topCompetitors feeds buildCompetitorSeeds, which parses a free-text string
  // (commas / "and" / newlines). Join the discovered array into that shape.
  const topCompetitors = gtmFields.topCompetitors
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .join(", ");
  if (topCompetitors.length > 0 && isBlank(merged.topCompetitors)) {
    merged.topCompetitors = topCompetitors;
  }

  if (!isBlank(gtmFields.marketProblem) && isBlank(merged.marketProblem)) {
    merged.marketProblem = gtmFields.marketProblem;
  }

  // The research digest is not yet read by corpusToResearchInput; persist it
  // under a dedicated key so the composer / future seams can pick it up without
  // colliding with any onboarding field.
  if (!isBlank(researchDigest)) {
    merged.orchestratorResearchDigest = researchDigest;
  }

  return merged;
}

interface JourneySessionUpdateClient {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
}

export interface PersistOrchestratorEnrichmentInput
  extends OrchestratorEnrichmentInput {
  supabase: JourneySessionUpdateClient;
  userId: string;
  runId: string;
  onboardingData: Record<string, unknown>;
}

/**
 * Merge the orchestrator enrichment into the session's onboarding_data and
 * write it back to journey_sessions. Best-effort — skips the write when the
 * orchestrator produced no fields, and swallows any DB error so the section
 * fan-out is never blocked.
 */
export async function persistOrchestratorEnrichment({
  supabase,
  userId,
  runId,
  onboardingData,
  gtmFields,
  researchDigest,
}: PersistOrchestratorEnrichmentInput): Promise<void> {
  if (gtmFields === null) {
    return;
  }

  const merged = mergeOrchestratorEnrichment(onboardingData, {
    gtmFields,
    researchDigest,
  });

  // Nothing changed (every gap-fill field was already user-supplied) — skip.
  if (merged === onboardingData) {
    return;
  }

  try {
    const { error } = await supabase
      .from("journey_sessions")
      .update({ onboarding_data: merged })
      .eq("user_id", userId)
      .eq("run_id", runId);

    if (error) {
      console.warn("[orchestrator-enrichment] onboarding_data write failed", {
        runId,
        userId,
        message: error.message,
      });
    }
  } catch (err) {
    console.warn("[orchestrator-enrichment] onboarding_data write threw", {
      runId,
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
