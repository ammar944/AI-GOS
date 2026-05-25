import { createAdminClient } from '@/lib/supabase/server';

export interface JourneySessionRow {
  id: string;
  user_id: string;
  run_id: string | null;
  research_results: Record<string, unknown> | null;
  onboarding_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface LoadOwnedResearchSessionInput {
  userId: string;
  runId: string;
}

export async function loadOwnedResearchSession({
  userId,
  runId,
}: LoadOwnedResearchSessionInput): Promise<JourneySessionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id,user_id,run_id,research_results,onboarding_data,metadata')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    console.warn('[orchestration-session] journey_sessions read failed', {
      runId,
      userId,
      message: error.message,
    });
    return null;
  }

  return (data as JourneySessionRow | null) ?? null;
}

export function corpusReady(session: JourneySessionRow): boolean {
  const results = session.research_results ?? {};
  const corpus = asRecord(results['deepResearchProgram']);
  return corpus?.status === 'complete';
}

export function getOnboardingReviewMetadata(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  return asRecord(metadata?.researchV2OnboardingReview);
}

export function getDeepResearchProgramData(
  session: JourneySessionRow,
): unknown | null {
  const result = asRecord(session.research_results?.deepResearchProgram);
  return result?.data ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}
