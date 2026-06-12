import type { SupabaseClient } from '@supabase/supabase-js';

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
  type ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  buildVerificationFlag,
  readVerificationFlag,
  readVerificationTier,
  type VerificationFlag,
  type VerificationTier,
} from '@/lib/research-v2/verification-tier';
import {
  saveBusinessProfile,
  saveProfileInsights,
} from '@/lib/profiles/business-profiles';

interface PersistAuditProfileInput {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  researchInput: ResearchInput;
  parentAuditRunId: string;
}

interface PersistAuditProfileDeps {
  saveBusinessProfile: typeof saveBusinessProfile;
  saveProfileInsights: typeof saveProfileInsights;
}

interface JourneySessionProfileRow {
  id: string;
  metadata: Record<string, unknown> | null;
  onboarding_data: Record<string, unknown> | null;
}

interface SectionInsightSummary {
  sectionTitle: string;
  verdict: string;
  statusSummary: string;
  confidence: number;
  sourceCount: number;
  verificationTier?: VerificationTier;
  verificationFlag?: VerificationFlag;
}

interface ResearchArtifactSectionProfileRow {
  zone: unknown;
  data: unknown;
  status: unknown;
  verificationTier: unknown;
  verificationFlag: unknown;
}

const PROFILE_INSIGHT_SECTION_IDS = [
  ...POSITIONING_SECTION_IDS,
  PAID_MEDIA_PLAN_SECTION_ID,
] as const;

type ProfileInsightSectionId = (typeof PROFILE_INSIGHT_SECTION_IDS)[number];

const defaultDeps: PersistAuditProfileDeps = {
  saveBusinessProfile,
  saveProfileInsights,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function nonEmptyStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(nonEmptyString).filter((item): item is string => item !== null)
    : [];
}

function isProfileInsightSectionId(
  value: unknown,
): value is ProfileInsightSectionId {
  return (
    typeof value === 'string' &&
    (PROFILE_INSIGHT_SECTION_IDS as readonly string[]).includes(value)
  );
}

function buildProfileMetadata(input: {
  session: JourneySessionProfileRow;
  researchInput: ResearchInput;
}): Record<string, unknown> {
  const metadata = asRecord(input.session.metadata);
  const onboardingData = asRecord(input.session.onboarding_data);

  return {
    ...metadata,
    ...onboardingData,
    companyName:
      nonEmptyString(onboardingData.companyName) ??
      nonEmptyString(metadata.companyName) ??
      input.researchInput.company.name,
    websiteUrl:
      nonEmptyString(onboardingData.websiteUrl) ??
      nonEmptyString(metadata.websiteUrl) ??
      input.researchInput.company.websiteUrl,
    industryVertical:
      nonEmptyString(onboardingData.industryVertical) ??
      nonEmptyString(metadata.industryVertical) ??
      input.researchInput.company.category,
    productDescription:
      nonEmptyString(onboardingData.productDescription) ??
      nonEmptyString(metadata.productDescription) ??
      input.researchInput.company.description,
    primaryIcpDescription:
      nonEmptyString(onboardingData.primaryIcpDescription) ??
      nonEmptyString(metadata.primaryIcpDescription) ??
      input.researchInput.company.targetCustomer,
  };
}

function normalizeCrossSectionInsightItem(
  value: unknown,
): Record<string, unknown> | null {
  const record = asRecord(value);
  const sourceSections = nonEmptyStringArray(record.sourceSections);
  const insight: Record<string, unknown> = {};
  const stringFields = [
    'tension',
    'implicationForPlan',
    'clientBlindSpot',
    'secondOrderRisk',
    'contrarianInversion',
  ] as const;

  for (const field of stringFields) {
    const text = nonEmptyString(record[field]);
    if (text) {
      insight[field] = text;
    }
  }

  if (sourceSections.length > 0) {
    insight.sourceSections = sourceSections;
  }

  return Object.keys(insight).length > 0 ? insight : null;
}

function buildPaidMediaPositioningStrategy(
  artifact: ArtifactEnvelope,
): Record<string, unknown> | null {
  const body = asRecord(artifact.body);
  const crossSectionInsight = Array.isArray(body.crossSectionInsight)
    ? body.crossSectionInsight
        .map(normalizeCrossSectionInsightItem)
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];

  if (crossSectionInsight.length === 0) {
    return null;
  }

  const firstInsight = crossSectionInsight[0] ?? {};
  const campaignOverview = asRecord(body.campaignOverview);
  const recommendedAngle =
    nonEmptyString(firstInsight.implicationForPlan) ??
    nonEmptyString(firstInsight.tension) ??
    artifact.verdict;
  const leadRecommendation =
    nonEmptyString(campaignOverview.prose) ?? artifact.statusSummary;
  const planSummary: Record<string, unknown> = {
    sectionTitle: artifact.sectionTitle,
    verdict: artifact.verdict,
    statusSummary: artifact.statusSummary,
    confidence: artifact.confidence,
  };
  const platform = nonEmptyString(campaignOverview.platform);
  const primaryKpi = nonEmptyString(campaignOverview.primaryKpi);

  if (platform) {
    planSummary.platform = platform;
  }
  if (primaryKpi) {
    planSummary.primaryKpi = primaryKpi;
  }

  return {
    source: PAID_MEDIA_PLAN_SECTION_ID,
    recommendedAngle,
    leadRecommendation,
    crossSectionInsight,
    paidMediaPlan: planSummary,
  };
}

export function buildCommittedSectionProfileInsights(input: {
  sectionId: AllPositioningSectionId;
  artifact: ArtifactEnvelope;
  verificationTier?: unknown;
  verificationFlag?: unknown;
}): Record<string, unknown> {
  const persistedFlag = readVerificationFlag(input.verificationFlag);
  const derivedFlag = buildVerificationFlag({
    verification: input.artifact.verification,
    evidenceGap: asRecord(input.artifact.body).evidenceGap,
  });
  const verificationFlag = persistedFlag ?? derivedFlag;
  const verificationTier =
    readVerificationTier(input.verificationTier) ?? verificationFlag?.tier ?? null;
  const summary: SectionInsightSummary = {
    sectionTitle: input.artifact.sectionTitle,
    verdict: input.artifact.verdict,
    statusSummary: input.artifact.statusSummary,
    confidence: input.artifact.confidence,
    sourceCount: input.artifact.sources.length,
    ...(verificationTier ? { verificationTier } : {}),
    ...(verificationFlag ? { verificationFlag } : {}),
    // Review stays tier + clientQuestions only. tierRationale and removedItems
    // are unverified model assertions (phantom removals, fabricated clean
    // bills of health) — they remain on the artifact as an internal log but
    // never persist into profile insights.
    ...(input.artifact.review
      ? {
          clientQuestions: input.artifact.review.clientQuestions,
        }
      : {}),
  };

  const insights: Record<string, unknown> = {
    [input.sectionId]: summary,
  };

  if (input.sectionId === 'positioningOfferDiagnostic') {
    insights.offerScore = {
      verdict: input.artifact.verdict,
      confidence: input.artifact.confidence,
      body: input.artifact.body,
      ...(verificationTier ? { verificationTier } : {}),
      ...(verificationFlag ? { verificationFlag } : {}),
    };
  }

  if (input.sectionId === PAID_MEDIA_PLAN_SECTION_ID) {
    const positioningStrategy = buildPaidMediaPositioningStrategy(input.artifact);
    if (positioningStrategy) {
      insights.positioningStrategy = positioningStrategy;
    }
  }

  return insights;
}

function getCompletedSectionRows(input: {
  rows: unknown;
  parentAuditRunId: string;
}): ResearchArtifactSectionProfileRow[] {
  if (!Array.isArray(input.rows)) {
    throw new Error(
      `research_artifact_sections profile lookup returned non-array data for artifactId=${input.parentAuditRunId}`,
    );
  }

  return input.rows
    .map((row): ResearchArtifactSectionProfileRow => {
      const record = asRecord(row);

      return {
        zone: record.zone,
        data: record.data,
        status: record.status,
        verificationTier: record.verification_tier,
        verificationFlag: record.verification_flag,
      };
    })
    .filter(
      (row): row is ResearchArtifactSectionProfileRow =>
        row.status === 'complete' && isProfileInsightSectionId(row.zone),
    );
}

function buildCommittedAuditProfileInsights(input: {
  rows: ResearchArtifactSectionProfileRow[];
  parentAuditRunId: string;
}): Record<string, unknown> {
  let mergedInsights: Record<string, unknown> = {};

  for (const row of input.rows) {
    if (!isProfileInsightSectionId(row.zone)) {
      continue;
    }

    if (!row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
      throw new Error(
        `research_artifact_sections row missing artifact data for artifactId=${input.parentAuditRunId} zone=${row.zone}`,
      );
    }

    const parsedArtifact = artifactEnvelopeSchema.safeParse(row.data);
    if (!parsedArtifact.success) {
      throw new Error(
        `research_artifact_sections row has invalid artifact data for artifactId=${input.parentAuditRunId} zone=${row.zone}: ${parsedArtifact.error.message}`,
      );
    }

    if (parsedArtifact.data.sectionId !== row.zone) {
      throw new Error(
        `research_artifact_sections row zone mismatch for artifactId=${input.parentAuditRunId}: row zone=${row.zone} artifact sectionId=${parsedArtifact.data.sectionId}`,
      );
    }

    mergedInsights = {
      ...mergedInsights,
      ...buildCommittedSectionProfileInsights({
        sectionId: row.zone,
        artifact: parsedArtifact.data,
        verificationTier: row.verificationTier,
        verificationFlag: row.verificationFlag,
      }),
    };
  }

  return mergedInsights;
}

export async function persistAuditProfile(
  input: PersistAuditProfileInput,
  deps: PersistAuditProfileDeps = defaultDeps,
): Promise<string> {
  const { data, error } = await input.supabase
    .from('journey_sessions')
    .select('id, metadata, onboarding_data')
    .eq('run_id', input.runId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `journey_sessions profile lookup failed for userId=${input.userId} runId=${input.runId}: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      `journey_sessions profile lookup returned no row for userId=${input.userId} runId=${input.runId}`,
    );
  }

  const { data: sectionRows, error: sectionRowsError } = await input.supabase
    .from('research_artifact_sections')
    .select(
      'zone, title, markdown, data, status, verification_tier, verification_flag, updated_at',
    )
    .eq('artifact_id', input.parentAuditRunId);

  if (sectionRowsError) {
    throw new Error(
      `research_artifact_sections profile lookup failed for artifactId=${input.parentAuditRunId} userId=${input.userId} runId=${input.runId}: ${sectionRowsError.message}`,
    );
  }

  const completedRows = getCompletedSectionRows({
    rows: sectionRows,
    parentAuditRunId: input.parentAuditRunId,
  });
  const mergedInsights = buildCommittedAuditProfileInsights({
    rows: completedRows,
    parentAuditRunId: input.parentAuditRunId,
  });

  if (Object.keys(mergedInsights).length === 0) {
    throw new Error(
      `No completed profile insights found for artifactId=${input.parentAuditRunId} userId=${input.userId} runId=${input.runId}`,
    );
  }

  const session = data as JourneySessionProfileRow;
  const profileMetadata = buildProfileMetadata({
    session,
    researchInput: input.researchInput,
  });
  const companyName = nonEmptyString(profileMetadata.companyName);

  if (!companyName) {
    throw new Error(
      `Cannot persist profile for userId=${input.userId} runId=${input.runId}: companyName missing`,
    );
  }

  const profile = await deps.saveBusinessProfile(
    input.userId,
    session.id,
    profileMetadata,
    asRecord(session.onboarding_data),
  );

  if (!profile) {
    throw new Error(
      `saveBusinessProfile returned null for userId=${input.userId} runId=${input.runId} companyName=${companyName}`,
    );
  }

  const { error: linkError } = await input.supabase
    .from('journey_sessions')
    .update({ profile_id: profile.id })
    .eq('id', session.id);

  if (linkError) {
    throw new Error(
      `journey_sessions profile link failed for sessionId=${session.id} profileId=${profile.id}: ${linkError.message}`,
    );
  }

  const savedInsights = await deps.saveProfileInsights(
    input.userId,
    companyName,
    mergedInsights,
  );

  if (!savedInsights) {
    throw new Error(
      `saveProfileInsights returned false for userId=${input.userId} runId=${input.runId} companyName=${companyName} insightKeys=${Object.keys(mergedInsights).join(',')}`,
    );
  }

  return profile.id;
}

export async function persistAuditProfileBestEffort(
  input: PersistAuditProfileInput,
): Promise<string | null> {
  try {
    return await persistAuditProfile(input);
  } catch (error) {
    console.warn('[section-profile-persistence] audit profile persist failed', {
      userId: input.userId,
      runId: input.runId,
      parentAuditRunId: input.parentAuditRunId,
      message: error instanceof Error ? error.message : String(error),
    });

    const { error: resetError } = await input.supabase
      .from('research_artifacts')
      .update({ profile_persisted_at: null })
      .eq('id', input.parentAuditRunId);

    if (resetError) {
      console.warn('[section-profile-persistence] profile persist claim reset failed', {
        userId: input.userId,
        runId: input.runId,
        parentAuditRunId: input.parentAuditRunId,
        message: resetError.message,
      });
    }

    return null;
  }
}
