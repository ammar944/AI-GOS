import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ArtifactEnvelope,
  ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import type { AllPositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import {
  saveBusinessProfile,
  saveProfileInsights,
} from '@/lib/profiles/business-profiles';

interface PersistProfileFromCommittedSectionInput {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  researchInput: ResearchInput;
  sectionId: AllPositioningSectionId;
  artifact: ArtifactEnvelope;
}

interface PersistProfileFromCommittedSectionDeps {
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

const defaultDeps: PersistProfileFromCommittedSectionDeps = {
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

export async function persistProfileFromCommittedSection(
  input: PersistProfileFromCommittedSectionInput,
  deps: PersistProfileFromCommittedSectionDeps = defaultDeps,
): Promise<void> {
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
    buildCommittedSectionProfileInsights({
      sectionId: input.sectionId,
      artifact: input.artifact,
    }),
  );

  if (!savedInsights) {
    throw new Error(
      `saveProfileInsights returned false for userId=${input.userId} runId=${input.runId} companyName=${companyName} sectionId=${input.sectionId}`,
    );
  }
}

export async function persistProfileFromCommittedSectionBestEffort(
  input: PersistProfileFromCommittedSectionInput,
): Promise<void> {
  try {
    await persistProfileFromCommittedSection(input);
  } catch (error) {
    console.warn('[section-profile-persistence] commit profile persist failed', {
      userId: input.userId,
      runId: input.runId,
      sectionId: input.sectionId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
