import type { ArtifactEnvelope } from "../artifacts/artifact-envelope";
import type { SectionId } from "../events/activity-event";
import {
  evaluateEvidenceSupport,
  type EvidenceSupportShortfall,
  type LoadBearingClaimKind,
} from "../agents/verification/evidence-support";
import type { VerificationReport } from "../agents/verification/types";
import {
  checkRequiredEvidenceClasses,
  type RequiredEvidenceClass,
} from "./required-evidence";

interface MinimumValidationResult {
  ok: boolean;
  errors: string[];
}

export interface CommittableSectionDefinition {
  id: SectionId;
  requiredEvidenceClasses: readonly RequiredEvidenceClass[];
  validateMinimums: (
    artifact: ArtifactEnvelope & { body: Record<string, unknown> },
  ) => MinimumValidationResult;
}

export interface PostRequiredEvidenceHookContext {
  artifact: ArtifactEnvelope;
  definition: CommittableSectionDefinition;
  env: Record<string, string | undefined>;
  verification: VerificationReport;
}

export type HookOutcome =
  | { kind: "ok" }
  | {
      kind: "reject";
      errors: readonly string[];
      gapArtifact?: ArtifactEnvelope;
    }
  | { kind: "soften"; artifact: ArtifactEnvelope }
  | { kind: "softenFailed"; errors: readonly string[] };

export type CommittableVerdict =
  | { kind: "minimumsFailed"; errors: readonly string[] }
  | {
      kind: "requiredEvidenceMissing";
      missingClass: RequiredEvidenceClass;
      unsupportedCount: number;
      verifiedCount: number;
    }
  | {
      kind: "hookReject";
      errors: readonly string[];
      gapArtifact?: ArtifactEnvelope;
    }
  | {
      kind: "evidenceShortfall";
      committableArtifact: ArtifactEnvelope;
      shortfall: EvidenceSupportShortfall;
    }
  | { kind: "committable"; committableArtifact: ArtifactEnvelope };

export interface EvaluateCommittableAttemptArgs {
  artifact: ArtifactEnvelope;
  definition: CommittableSectionDefinition;
  env: Record<string, string | undefined>;
  postRequiredEvidenceHook?: (
    context: PostRequiredEvidenceHookContext,
  ) => HookOutcome;
  verification: VerificationReport;
}

const defaultLoadBearingKinds = ["numeric", "url"] as const;
const paidMediaLoadBearingKinds = ["url"] as const;
const voiceOfCustomerLoadBearingKinds = ["numeric", "url", "quote"] as const;

function getLoadBearingKindsForSection(
  sectionId: SectionId,
): readonly LoadBearingClaimKind[] {
  if (sectionId === "positioningPaidMediaPlan") {
    return paidMediaLoadBearingKinds;
  }

  if (sectionId === "positioningVoiceOfCustomer") {
    return voiceOfCustomerLoadBearingKinds;
  }

  return defaultLoadBearingKinds;
}

export function evaluateCommittableAttempt({
  artifact,
  definition,
  env,
  postRequiredEvidenceHook,
  verification,
}: EvaluateCommittableAttemptArgs): CommittableVerdict {
  const minimums = definition.validateMinimums(artifact);

  if (!minimums.ok) {
    return { kind: "minimumsFailed", errors: minimums.errors };
  }

  const missingClass = checkRequiredEvidenceClasses({
    body: artifact.body,
    env,
    requiredEvidenceClasses: definition.requiredEvidenceClasses,
    sectionId: definition.id,
  });

  if (missingClass !== null) {
    return {
      kind: "requiredEvidenceMissing",
      missingClass,
      unsupportedCount: verification.unsupportedCount,
      verifiedCount: verification.verifiedCount,
    };
  }

  let committableArtifact = artifact;
  if (postRequiredEvidenceHook !== undefined) {
    const hookOutcome = postRequiredEvidenceHook({
      artifact,
      definition,
      env,
      verification,
    });

    if (hookOutcome.kind === "reject") {
      return {
        kind: "hookReject",
        errors: hookOutcome.errors,
        ...(hookOutcome.gapArtifact === undefined
          ? {}
          : { gapArtifact: hookOutcome.gapArtifact }),
      };
    }

    if (hookOutcome.kind === "softenFailed") {
      return { kind: "hookReject", errors: hookOutcome.errors };
    }

    if (hookOutcome.kind === "soften") {
      committableArtifact = hookOutcome.artifact;
    }
  }

  const shortfall = evaluateEvidenceSupport({
    verification,
    loadBearingKinds: getLoadBearingKindsForSection(definition.id),
  });

  if (shortfall.unsupportedLoadBearing.length > 0) {
    return {
      kind: "evidenceShortfall",
      committableArtifact,
      shortfall,
    };
  }

  return { kind: "committable", committableArtifact };
}
