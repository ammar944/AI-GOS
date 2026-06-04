import {
  ALL_POSITIONING_SECTION_LABELS,
  isPositioningSectionId,
  type AllPositioningSectionId,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
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
  const markdownLines: string[] = [];
  if (verdict) markdownLines.push(`**Verdict:** ${verdict}`);
  if (summary) markdownLines.push('', summary);
  const markdown = markdownLines.join('\n');
  const verificationFlag = buildVerificationFlag({
    verification: a.verification,
    evidenceGap: readEvidenceGap(a),
  });

  return {
    status: 'complete',
    title,
    markdown,
    data: artifact,
    claims: [],
    sources: Array.isArray(a.sources) ? (a.sources as unknown[]) : [],
    error: null,
    verificationTier: verificationFlag?.tier ?? null,
    verificationFlag,
  };
}
