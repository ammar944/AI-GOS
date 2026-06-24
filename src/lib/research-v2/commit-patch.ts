import {
  ALL_POSITIONING_SECTION_LABELS,
  isPositioningSectionId,
  type AllPositioningSectionId,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { sectionReviewResultSchema } from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  sanitizeArtifactForClientSurface,
  scrubMarkdownVocabOnly,
} from '@/lib/research-v2/client-surface-sanitizer';
import {
  buildReviewVerificationFlag,
  buildVerificationFlag,
  INSUFFICIENT_MAX_CONFIDENCE,
  VERIFIED_MIN_CONFIDENCE,
  type VerificationFlag,
  type VerificationTier,
} from '@/lib/research-v2/verification-tier';

interface SectionCommitPatchLabelEntry {
  readonly label: string;
}

const SECTION_ARTIFACT_SCHEMAS: Record<
  PositioningSectionId,
  SectionCommitPatchLabelEntry
> = {
  positioningMarketCategory: {
    label: 'Market & Category Intelligence',
  },
  positioningBuyerICP: {
    label: 'Buyer & ICP Validation',
  },
  positioningCompetitorLandscape: {
    label: 'Competitor Landscape & Positioning',
  },
  positioningVoiceOfCustomer: {
    label: 'Voice of Customer & Objection Evidence',
  },
  positioningDemandIntent: {
    label: 'Demand & Intent Signals',
  },
  positioningOfferDiagnostic: {
    label: 'Offer & Performance Diagnostic',
  },
};

const sectionArtifactSchemas: Readonly<
  Record<PositioningSectionId, SectionCommitPatchLabelEntry>
> = SECTION_ARTIFACT_SCHEMAS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readEvidenceGap(artifact: Record<string, unknown>): boolean {
  const body = artifact.body;
  return isRecord(body) && body.evidenceGap === true;
}

function readSectionReview(artifact: Record<string, unknown>) {
  const parsed = sectionReviewResultSchema.safeParse(artifact.review);

  return parsed.success ? parsed.data : null;
}

// Trust-corrected confidence computed by the wave-2 verifier
// (min of liveness/containment/claim-support, with honest-empty caps).
// When present it is the most pessimistic — and most honest — number the
// pipeline has for this section, so the persisted badge clamps to it.
function readComputedTrustConfidence(
  artifact: Record<string, unknown>,
): number | null {
  const verifierSummary = isRecord(artifact.verifierSummary)
    ? artifact.verifierSummary
    : null;
  const computedTrust =
    verifierSummary && isRecord(verifierSummary.computedTrust)
      ? verifierSummary.computedTrust
      : null;
  const confidence = computedTrust?.confidence;

  return typeof confidence === 'number' && Number.isFinite(confidence)
    ? Math.min(1, Math.max(0, confidence))
    : null;
}

const VERIFICATION_TIER_SEVERITY: Record<VerificationTier, number> = {
  verified: 0,
  needs_review: 1,
  insufficient: 2,
};

function clampFlagToComputedTrust(
  flag: VerificationFlag | null,
  computedTrustConfidence: number | null,
): VerificationFlag | null {
  if (
    flag === null ||
    computedTrustConfidence === null ||
    computedTrustConfidence >= flag.confidence
  ) {
    return flag;
  }

  const tierFromTrust: VerificationTier =
    flag.evidenceGap || computedTrustConfidence < INSUFFICIENT_MAX_CONFIDENCE
      ? 'insufficient'
      : computedTrustConfidence < VERIFIED_MIN_CONFIDENCE
        ? 'needs_review'
        : 'verified';
  const tier =
    VERIFICATION_TIER_SEVERITY[tierFromTrust] >=
    VERIFICATION_TIER_SEVERITY[flag.tier]
      ? tierFromTrust
      : flag.tier;

  return {
    ...flag,
    confidence: computedTrustConfidence,
    tier,
  };
}

export interface CommitArtifactSectionInput {
  artifactId: string;
  zone: AllPositioningSectionId;
  sectionRunId: string;
  expectedRevision: number;
  patch: {
    status?: 'complete' | 'error' | 'partial';
    title?: string | null;
    markdown?: string | null;
    data?: unknown;
    claims?: unknown[];
    sources?: unknown[];
    error?: unknown;
    verificationTier?: VerificationTier | null;
    verificationFlag?: VerificationFlag | null;
  };
}

/**
 * Builds the normalized commit_artifact_section patch from a validated
 * section artifact. Mirrors the worker-side projection so the React UI
 * keeps rendering identical content.
 */
export function buildCommitPatch(
  sectionId: AllPositioningSectionId,
  artifact: unknown,
  opts?: { degradeToNeedsReview?: boolean },
): CommitArtifactSectionInput['patch'] {
  // Scrub internal pipeline vocabulary from every client-surface string before
  // it is persisted. Internal metadata subtrees (verification/review/blockGap*)
  // are preserved so tier/flag derivation below reads the original values.
  const sanitizedArtifact = sanitizeArtifactForClientSurface(artifact);
  const a = sanitizedArtifact as Record<string, unknown>;
  const title = typeof a.sectionTitle === 'string'
    ? a.sectionTitle
    : isPositioningSectionId(sectionId)
      ? sectionArtifactSchemas[sectionId].label
      : ALL_POSITIONING_SECTION_LABELS[sectionId];
  const summary = typeof a.statusSummary === 'string' ? a.statusSummary : null;
  const verdict = typeof a.verdict === 'string' ? a.verdict : null;
  const review = readSectionReview(a);
  // The markdown column defaults to the deterministic verdict/summary lines.
  // review.upgradedMarkdown is regenerated model prose with zero evidence
  // verification — it must never replace the canonical markdown (it shipped
  // invented quotes/prices to the share view). Review stays tier +
  // clientQuestions metadata only.
  const markdownLines: string[] = [];
  if (verdict) markdownLines.push(`**Verdict:** ${verdict}`);
  if (summary) markdownLines.push('', summary);
  const deterministicMarkdown = markdownLines.join('\n');

  // §4.1 (RAW un-caged GLM): when the artifact carries body.narrativeMarkdown,
  // that is GLM's own source-class-labeled research — persist THAT as the card
  // body (vocab-scrubbed for internal tool names, structure preserved), read
  // from the RAW artifact so the full client-surface sanitizer (whose wholesale
  // validator-replace + whitespace collapse would corrupt long prose) never
  // touches it. Unlike the killed upgradedMarkdown path this prose was produced
  // and grounded by the section run itself, not regenerated post-hoc.
  const rawBody = (artifact as { body?: unknown }).body;
  const rawNarrative =
    rawBody !== null && typeof rawBody === 'object'
      ? (rawBody as Record<string, unknown>).narrativeMarkdown
      : undefined;
  const cleanNarrative =
    typeof rawNarrative === 'string' && rawNarrative.trim().length > 0
      ? scrubMarkdownVocabOnly(rawNarrative)
      : null;
  const markdown = cleanNarrative ?? deterministicMarkdown;

  // Overwrite the sanitized body's narrativeMarkdown with the markdown-safe
  // clean copy: the full client-surface sanitizer above runs scrubClientSurfaceText
  // on every string, which would have collapsed this blob's newlines (and could
  // wholesale-replace it on an incidental validator-message match). The Audit
  // Reader renders artifact.narrativeMarkdown from this `data`, so it must carry
  // the structure-preserving copy, not the mangled one.
  if (cleanNarrative !== null) {
    const sanitizedBody = (a as { body?: unknown }).body;
    if (sanitizedBody !== null && typeof sanitizedBody === 'object') {
      (sanitizedBody as Record<string, unknown>).narrativeMarkdown =
        cleanNarrative;
    }
  }
  const deterministicVerificationFlag = clampFlagToComputedTrust(
    buildVerificationFlag({
      verification: a.verification,
      evidenceGap: readEvidenceGap(a),
    }),
    readComputedTrustConfidence(a),
  );
  const verificationFlag = review
    ? buildReviewVerificationFlag({
        tier: review.tier,
        baseFlag: deterministicVerificationFlag,
      })
    : deterministicVerificationFlag;

  // ARI: capstones (thinker/synthesis/paid-media) built on degraded upstream
  // evidence commit best-effort but are badged at least needs_review. Strictest
  // tier wins, so a genuinely-insufficient capstone stays insufficient.
  const effectiveFlag = opts?.degradeToNeedsReview
    ? buildReviewVerificationFlag({
        tier: 'needs_review',
        baseFlag: verificationFlag ?? null,
      })
    : verificationFlag;

  return {
    status: 'complete',
    title,
    markdown,
    data: sanitizedArtifact,
    claims: [],
    sources: Array.isArray(a.sources) ? (a.sources as unknown[]) : [],
    error: null,
    verificationTier: effectiveFlag?.tier ?? null,
    verificationFlag: effectiveFlag,
  };
}

export function buildReviewCommitPatch(
  sectionId: AllPositioningSectionId,
  artifact: unknown,
  opts?: { degradeToNeedsReview?: boolean },
): CommitArtifactSectionInput['patch'] {
  const { status, ...patch } = buildCommitPatch(
    sectionId,
    artifact,
    opts,
  );
  void status;

  return patch;
}
