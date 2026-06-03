import type { SupabaseClient } from '@supabase/supabase-js';

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
  type ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
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
}

interface ResearchArtifactSectionProfileRow {
  zone: unknown;
  data: unknown;
  status: unknown;
}

const PROFILE_INSIGHT_SECTION_IDS = [
  ...POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
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

export function buildCommittedSectionProfileInsights(input: {
  sectionId: AllPositioningSectionId;
  artifact: ArtifactEnvelope;
}): Record<string, unknown> {
  const summary: SectionInsightSummary = {
    sectionTitle: input.artifact.sectionTitle,
    verdict: input.artifact.verdict,
    statusSummary: input.artifact.statusSummary,
    confidence: input.artifact.confidence,
    sourceCount: input.artifact.sources.length,
  };

  const insights: Record<string, unknown> = {
    [input.sectionId]: summary,
  };

  if (input.sectionId === 'positioningOfferDiagnostic') {
    insights.offerScore = {
      verdict: input.artifact.verdict,
      confidence: input.artifact.confidence,
      body: input.artifact.body,
    };
  }

  if (input.sectionId === 'positioningSynthesis') {
    insights.positioningStrategy = {
      verdict: input.artifact.verdict,
      confidence: input.artifact.confidence,
      body: input.artifact.body,
    };
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
    .select('zone, title, markdown, data, status, updated_at')
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
