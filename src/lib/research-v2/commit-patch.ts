import {
  ALL_POSITIONING_SECTION_LABELS,
  isPositioningSectionId,
  type AllPositioningSectionId,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { sectionReviewResultSchema } from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  buildReviewVerificationFlag,
  buildVerificationFlag,
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

export interface CommitArtifactSectionInput {
  artifactId: string;
  zone: AllPositioningSectionId;
  sectionRunId: string;
  expectedRevision: number;
  patch: {
    status: 'complete' | 'error' | 'partial';
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
): CommitArtifactSectionInput['patch'] {
  const a = artifact as Record<string, unknown>;
  const title = typeof a.sectionTitle === 'string'
    ? a.sectionTitle
    : isPositioningSectionId(sectionId)
      ? sectionArtifactSchemas[sectionId].label
      : ALL_POSITIONING_SECTION_LABELS[sectionId];
  const summary = typeof a.statusSummary === 'string' ? a.statusSummary : null;
  const verdict = typeof a.verdict === 'string' ? a.verdict : null;
  const review = readSectionReview(a);
  const markdownLines: string[] = [];
  if (verdict) markdownLines.push(`**Verdict:** ${verdict}`);
  if (summary) markdownLines.push('', summary);
  const markdown = review?.upgradedMarkdown ?? markdownLines.join('\n');
  const deterministicVerificationFlag = buildVerificationFlag({
    verification: a.verification,
    evidenceGap: readEvidenceGap(a),
  });
  const verificationFlag = review
    ? buildReviewVerificationFlag({
        tier: review.tier,
        baseFlag: deterministicVerificationFlag,
      })
    : deterministicVerificationFlag;

  return {
    status: 'complete',
    title,
    markdown,
    data: artifact,
    claims: [],
    sources: Array.isArray(a.sources) ? (a.sources as unknown[]) : [],
    error: null,
    verificationTier: review?.tier ?? verificationFlag?.tier ?? null,
    verificationFlag,
  };
}
