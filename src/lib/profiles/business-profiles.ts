// Business Profile management — extract onboarding data into persistent profiles.
// Profiles are injected into the unified chat system prompt so the AI knows
// who it's talking to (company name, industry, ICP, budget, etc.).

import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/server';
import type { SectionKey } from '@/lib/workspace/types';
import { getResearchPipelineReadiness, SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import {
  createEmptyVerificationTierCounts,
  readVerificationTier,
  type VerificationTierCounts,
} from '@/lib/research-v2/verification-tier';

function getSupabase() {
  return createAdminClient();
}

// Field mapping: journey metadata key → business_profiles column
const FIELD_MAP: Record<string, string> = {
  companyName: 'company_name',
  websiteUrl: 'website_url',
  headquartersLocation: 'headquarters',
  businessModel: 'business_model',
  industryVertical: 'industry_vertical',
  productDescription: 'product_description',
  coreDeliverables: 'core_deliverables',
  valueProp: 'value_prop',
  uniqueEdge: 'unique_edge',
  pricingTiers: 'pricing_tiers',
  monthlyAdBudget: 'monthly_ad_budget',
  primaryIcpDescription: 'primary_icp',
  jobTitles: 'job_titles',
  companySize: 'company_size',
  geography: 'geography',
  buyingTriggers: 'buying_triggers',
  topCompetitors: 'top_competitors',
  marketProblem: 'market_problem',
  goals: 'goals',
  targetCpl: 'target_cpl',
  targetCac: 'target_cac',
  campaignDuration: 'campaign_duration',
};

export interface StyleReference {
  name: string;
  content: string;
  source: string;
}

export interface ProofPoint {
  id: string;
  type: 'case_study' | 'testimonial' | 'metric' | 'credential';
  headline: string;
  detail: string;
  clientName?: string;
  verified: boolean;
}

export interface BrandVoiceNotes {
  tone: string;
  constraints: string;
  goodExample: string;
  badExample: string;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  sessionId: string | null;
  companyName: string | null;
  websiteUrl: string | null;
  headquarters: string | null;
  businessModel: string | null;
  industryVertical: string | null;
  productDescription: string | null;
  valueProp: string | null;
  uniqueEdge: string | null;
  pricingTiers: string | null;
  monthlyAdBudget: string | null;
  primaryIcp: string | null;
  jobTitles: string | null;
  companySize: string | null;
  geography: string | null;
  topCompetitors: string | null;
  goals: string | null;
  allFields: Record<string, unknown>;
  aiInsights: Record<string, unknown> | null;
  offerScore: Record<string, unknown> | null;
  positioningStrategy: Record<string, unknown> | null;
  styleReferences: StyleReference[] | null;
  proofPoints: ProofPoint[];
  brandVoiceNotes: BrandVoiceNotes | null;
  lastResearchAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extract onboarding fields from journey_sessions.metadata
 * and upsert into business_profiles.
 *
 * Merge-aware: if a profile already exists for this company, new non-empty
 * values are merged on top of existing all_fields so manually-edited fields
 * are preserved when research saves don't include them.
 */
export async function saveBusinessProfile(
  userId: string,
  sessionId: string,
  metadata: Record<string, unknown>,
  cachedOnboarding?: Record<string, unknown>,
): Promise<{ id: string } | null> {
  const companyName =
    typeof metadata.companyName === 'string' ? metadata.companyName.trim() : '';
  if (!companyName) return null;

  // Check if profile already exists — if so, merge all_fields
  const { data: existing } = await getSupabase()
    .from('business_profiles')
    .select('all_fields')
    .eq('user_id', userId)
    .eq('company_name', companyName)
    .maybeSingle();

  const existingAllFields = (existing?.all_fields as Record<string, unknown>) ?? {};

  // Merge: existing values as base, new non-empty values on top
  const mergedAllFields: Record<string, unknown> = { ...existingAllFields };
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== null && value !== undefined && value !== '') {
      mergedAllFields[key] = value;
    }
  }

  // Map metadata fields to profile columns
  const profileData: Record<string, unknown> = {
    user_id: userId,
    session_id: sessionId,
    all_fields: mergedAllFields,
  };

  if (cachedOnboarding !== undefined) {
    profileData.cached_onboarding = cachedOnboarding;
  }

  for (const [metaKey, colName] of Object.entries(FIELD_MAP)) {
    const value = metadata[metaKey];
    if (typeof value === 'string' && value.trim()) {
      profileData[colName] = value.trim();
    }
  }

  profileData.company_name = companyName;

  const { data, error } = await getSupabase()
    .from('business_profiles')
    .upsert(profileData, {
      onConflict: 'user_id,company_name',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[business-profiles] upsert error:', error.message);
    return null;
  }

  return data;
}

export async function patchBusinessProfileInsights(input: {
  supabase: SupabaseClient;
  userId: string;
  profileId: string;
  insights: Record<string, unknown>;
}): Promise<void> {
  const { data: existing, error: readError } = await input.supabase
    .from('business_profiles')
    .select('ai_insights')
    .eq('id', input.profileId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (readError) {
    throw new Error(
      `business_profiles insights read failed for userId=${input.userId} profileId=${input.profileId}: ${readError.message}`,
    );
  }

  if (!existing) {
    throw new Error(
      `business_profiles insights read returned no row for userId=${input.userId} profileId=${input.profileId}`,
    );
  }

  const existingInsights =
    ((existing as { ai_insights?: unknown }).ai_insights as Record<
      string,
      unknown
    > | null) ?? {};
  const mergedInsights = { ...existingInsights, ...input.insights };

  const updateData: Record<string, unknown> = {
    ai_insights: mergedInsights,
    last_research_at: new Date().toISOString(),
  };
  if (input.insights.offerScore) updateData.offer_score = input.insights.offerScore;
  if (input.insights.positioningStrategy) {
    updateData.positioning_strategy = input.insights.positioningStrategy;
  }

  const { error: updateError } = await input.supabase
    .from('business_profiles')
    .update(updateData)
    .eq('id', input.profileId)
    .eq('user_id', input.userId);

  if (updateError) {
    throw new Error(
      `business_profiles insights update failed for userId=${input.userId} profileId=${input.profileId}: ${updateError.message}`,
    );
  }
}

export async function patchBusinessProfileSynthesis(input: {
  supabase: SupabaseClient;
  userId: string;
  profileId: string;
  insights: Record<string, unknown>;
  positioningStrategy: Record<string, unknown>;
}): Promise<void> {
  await patchBusinessProfileInsights({
    supabase: input.supabase,
    userId: input.userId,
    profileId: input.profileId,
    insights: {
      ...input.insights,
      positioningStrategy: input.positioningStrategy,
    },
  });
}

/**
 * Get all profiles for a user.
 */
export async function getUserProfiles(userId: string): Promise<BusinessProfile[]> {
  const { data, error } = await getSupabase()
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[business-profiles] list error:', error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

/**
 * Get the most recent profile for a user (active profile).
 */
export async function getActiveProfile(userId: string): Promise<BusinessProfile | null> {
  const { data, error } = await getSupabase()
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return mapRow(data);
}

/**
 * Build a system prompt fragment from a profile.
 * Injected into the unified chat so the AI knows the user's context.
 */
export function buildProfileContext(
  profile: BusinessProfile,
  userName?: string,
): string {
  const lines: string[] = ['## Business Profile'];

  if (userName) lines.push(`User: ${userName}`);
  if (profile.companyName) lines.push(`Company: ${profile.companyName}`);
  if (profile.websiteUrl) lines.push(`Website: ${profile.websiteUrl}`);
  if (profile.headquarters) lines.push(`HQ: ${profile.headquarters}`);
  if (profile.businessModel) lines.push(`Business Model: ${profile.businessModel}`);
  if (profile.industryVertical) lines.push(`Industry: ${profile.industryVertical}`);
  if (profile.productDescription) lines.push(`Product: ${profile.productDescription}`);
  if (profile.valueProp) lines.push(`Value Prop: ${profile.valueProp}`);
  if (profile.uniqueEdge) lines.push(`Unique Edge: ${profile.uniqueEdge}`);
  if (profile.pricingTiers) lines.push(`Pricing: ${profile.pricingTiers}`);
  if (profile.monthlyAdBudget) lines.push(`Monthly Ad Budget: ${profile.monthlyAdBudget}`);
  if (profile.primaryIcp) lines.push(`ICP: ${profile.primaryIcp}`);
  if (profile.jobTitles) lines.push(`Target Titles: ${profile.jobTitles}`);
  if (profile.companySize) lines.push(`Target Company Size: ${profile.companySize}`);
  if (profile.geography) lines.push(`Geography: ${profile.geography}`);
  if (profile.topCompetitors) lines.push(`Competitors: ${profile.topCompetitors}`);
  if (profile.goals) lines.push(`Goals: ${profile.goals}`);

  return lines.join('\n');
}

/**
 * Save AI-generated insights back into the business profile.
 * Called after research completes — enriches the profile with intelligence data.
 * Uses nullable JSONB columns so this works even before the migration (columns are silently ignored).
 */
export async function saveProfileInsights(
  userId: string,
  companyName: string,
  insights: Record<string, unknown>,
): Promise<boolean> {
  // Read existing insights to merge (not overwrite)
  const { data: existing } = await getSupabase()
    .from('business_profiles')
    .select('ai_insights')
    .eq('user_id', userId)
    .eq('company_name', companyName)
    .maybeSingle();

  const existingInsights = (existing?.ai_insights as Record<string, unknown>) ?? {};
  const mergedInsights = { ...existingInsights, ...insights };

  const updateData: Record<string, unknown> = {
    ai_insights: mergedInsights,
    last_research_at: new Date().toISOString(),
  };
  if (insights.offerScore) updateData.offer_score = insights.offerScore;
  if (insights.positioningStrategy) updateData.positioning_strategy = insights.positioningStrategy;

  const { error } = await getSupabase()
    .from('business_profiles')
    .update(updateData)
    .eq('user_id', userId)
    .eq('company_name', companyName);

  if (error) {
    // Columns may not exist yet — that's fine, the migration will add them
    console.warn('[business-profiles] saveInsights warning:', error.message);
    return false;
  }
  return true;
}

// Re-export normalizeProfileFields from client-safe module
export { normalizeProfileFields } from './normalize-fields';

/**
 * Update a profile's fields via partial update.
 * Merges into all_fields JSONB and updates individual columns where mapped.
 */
export async function updateProfile(
  userId: string,
  profileId: string,
  fields: Record<string, string>,
): Promise<boolean> {
  // Read current all_fields
  const { data: existing, error: readError } = await getSupabase()
    .from('business_profiles')
    .select('all_fields')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();

  if (readError || !existing) return false;

  const existingAllFields = (existing.all_fields as Record<string, unknown>) ?? {};
  const mergedAllFields = { ...existingAllFields, ...fields };

  // Build column updates from FIELD_MAP
  const columnUpdates: Record<string, unknown> = {
    all_fields: mergedAllFields,
  };
  for (const [metaKey, colName] of Object.entries(FIELD_MAP)) {
    if (metaKey in fields) {
      columnUpdates[colName] = fields[metaKey] || null;
    }
  }

  const { error: writeError } = await getSupabase()
    .from('business_profiles')
    .update(columnUpdates)
    .eq('id', profileId)
    .eq('user_id', userId);

  if (writeError) {
    console.error('[business-profiles] update error:', writeError.message);
    return false;
  }
  return true;
}

/**
 * Get a single profile by ID for an authenticated user.
 */
export async function getProfile(
  userId: string,
  profileId: string,
): Promise<BusinessProfile | null> {
  const { data, error } = await getSupabase()
    .from('business_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return mapRow(data);
}

/**
 * Get all journey sessions linked to a profile via profile_id FK.
 */
export async function getProfileSessions(
  userId: string,
  profileId: string,
): Promise<ProfileSession[]> {
  const supabase = getSupabase();

  // Fetch sessions explicitly linked to this profile
  const { data: linked, error: linkedErr } = await supabase
    .from('journey_sessions')
    .select('id, run_id, research_results, metadata, created_at, updated_at')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Also fetch unlinked sessions (profile_id is null) — the journey flow
  // doesn't set profile_id, so completed research sessions won't appear
  // in the profile command center without this fallback.
  const { data: unlinked, error: unlinkedErr } = await supabase
    .from('journey_sessions')
    .select('id, run_id, research_results, metadata, created_at, updated_at')
    .is('profile_id', null)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if ((linkedErr && unlinkedErr) || (!linked && !unlinked)) return [];

  // Merge and deduplicate by id
  const allRows = [...(linked ?? []), ...(unlinked ?? [])];
  const seen = new Set<string>();
  const deduped = allRows.filter((row) => {
    const id = row.id as string;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Only include unlinked sessions that have at least 1 research section
  // (skip empty/abandoned sessions)
  const filtered = deduped.filter((row) => {
    const results = row.research_results as Record<string, unknown> | null;
    if (!results) return false;
    return Object.keys(results).length > 0;
  });

  // Backfill: link unlinked sessions to this profile so future queries are fast
  const unlinkedIds = (unlinked ?? [])
    .filter((row) => {
      const results = row.research_results as Record<string, unknown> | null;
      return results && Object.keys(results).length > 0;
    })
    .map((row) => row.id as string);

  if (unlinkedIds.length > 0) {
    // Fire-and-forget backfill — don't block the response
    void supabase
      .from('journey_sessions')
      .update({ profile_id: profileId })
      .in('id', unlinkedIds)
      .eq('user_id', userId)
      .is('profile_id', null)
      .then(({ error }) => {
        if (error) console.warn('[getProfileSessions] backfill failed:', error.message);
      });
  }

  const verificationTierCountsByRunId = await loadVerificationTierCountsByRunId(
    supabase,
    userId,
    filtered.map((row) => row.run_id as string),
  );

  return filtered.map((row) =>
    mapSessionRow(
      row,
      verificationTierCountsByRunId.get(row.run_id as string),
    ),
  );
}

export interface ProfileSession {
  id: string;
  runId: string;
  sectionCount: number;
  totalSections: number;
  /** All SECTION_PIPELINE sections are complete with data (incl. media plan). */
  ready: boolean;
  missingSections: SectionKey[];
  hasMediaPlan: boolean;
  verificationTierCounts: VerificationTierCounts;
  createdAt: string;
  updatedAt: string;
}

interface ResearchArtifactTierRow {
  id: string;
  run_id: string;
}

interface ResearchArtifactSectionTierRow {
  artifact_id: string;
  status: string | null;
  verification_tier: unknown;
}

async function loadVerificationTierCountsByRunId(
  supabase: SupabaseClient,
  userId: string,
  runIds: string[],
): Promise<Map<string, VerificationTierCounts>> {
  const uniqueRunIds = Array.from(new Set(runIds.filter((runId) => runId.length > 0)));
  if (uniqueRunIds.length === 0) {
    return new Map<string, VerificationTierCounts>();
  }

  const { data: artifacts, error: artifactsError } = await supabase
    .from('research_artifacts')
    .select('id, run_id')
    .eq('user_id', userId)
    .in('run_id', uniqueRunIds);

  if (artifactsError || !Array.isArray(artifacts)) {
    console.warn('[business-profiles] verification tier artifact lookup failed', {
      userId,
      runIds: uniqueRunIds,
      message: artifactsError?.message ?? 'non-array artifacts response',
    });
    return new Map<string, VerificationTierCounts>();
  }

  const artifactRows = artifacts as ResearchArtifactTierRow[];
  const artifactIdToRunId = new Map<string, string>();
  const countsByRunId = new Map<string, VerificationTierCounts>();

  for (const artifact of artifactRows) {
    artifactIdToRunId.set(artifact.id, artifact.run_id);
    countsByRunId.set(artifact.run_id, createEmptyVerificationTierCounts());
  }

  const artifactIds = Array.from(artifactIdToRunId.keys());
  if (artifactIds.length === 0) {
    return countsByRunId;
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('research_artifact_sections')
    .select('artifact_id, status, verification_tier')
    .in('artifact_id', artifactIds);

  if (sectionsError || !Array.isArray(sections)) {
    console.warn('[business-profiles] verification tier section lookup failed', {
      userId,
      artifactIds,
      message: sectionsError?.message ?? 'non-array sections response',
    });
    return countsByRunId;
  }

  for (const section of sections as ResearchArtifactSectionTierRow[]) {
    if (section.status !== 'complete') {
      continue;
    }

    const runId = artifactIdToRunId.get(section.artifact_id);
    const tier = readVerificationTier(section.verification_tier);
    if (!runId || !tier) {
      continue;
    }

    const counts = countsByRunId.get(runId) ?? createEmptyVerificationTierCounts();
    counts[tier] += 1;
    countsByRunId.set(runId, counts);
  }

  return countsByRunId;
}

function mapSessionRow(
  row: Record<string, unknown>,
  verificationTierCounts: VerificationTierCounts = createEmptyVerificationTierCounts(),
): ProfileSession {
  const results = (row.research_results as Record<string, unknown>) ?? {};
  const readiness = getResearchPipelineReadiness(results);

  return {
    id: row.id as string,
    runId: row.run_id as string,
    sectionCount: readiness.completedSectionKeys.length,
    totalSections: SECTION_PIPELINE.length,
    ready: readiness.ready,
    missingSections: readiness.missingSections,
    hasMediaPlan: readiness.completedSectionKeys.includes('mediaPlan'),
    verificationTierCounts,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Map Supabase snake_case row to camelCase interface
export function mapRow(row: Record<string, unknown>): BusinessProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    sessionId: row.session_id as string | null,
    companyName: row.company_name as string | null,
    websiteUrl: row.website_url as string | null,
    headquarters: row.headquarters as string | null,
    businessModel: row.business_model as string | null,
    industryVertical: row.industry_vertical as string | null,
    productDescription: row.product_description as string | null,
    valueProp: row.value_prop as string | null,
    uniqueEdge: row.unique_edge as string | null,
    pricingTiers: row.pricing_tiers as string | null,
    monthlyAdBudget: row.monthly_ad_budget as string | null,
    primaryIcp: row.primary_icp as string | null,
    jobTitles: row.job_titles as string | null,
    companySize: row.company_size as string | null,
    geography: row.geography as string | null,
    topCompetitors: row.top_competitors as string | null,
    goals: row.goals as string | null,
    allFields: (row.all_fields as Record<string, unknown>) ?? {},
    aiInsights: (row.ai_insights as Record<string, unknown>) ?? null,
    offerScore: (row.offer_score as Record<string, unknown>) ?? null,
    positioningStrategy: (row.positioning_strategy as Record<string, unknown>) ?? null,
    styleReferences: (row.style_references as StyleReference[]) ?? null,
    proofPoints: (row.proof_points as ProofPoint[]) ?? [],
    brandVoiceNotes: (row.brand_voice_notes as BrandVoiceNotes) ?? null,
    lastResearchAt: (row.last_research_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
