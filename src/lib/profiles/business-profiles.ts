// Business Profile management — extract onboarding data into persistent profiles.
// Profiles are injected into the unified chat system prompt so the AI knows
// who it's talking to (company name, industry, ICP, budget, etc.).

import { createAdminClient } from '@/lib/supabase/server';
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';

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
  insights: {
    offerScore?: Record<string, unknown>;
    positioningStrategy?: Record<string, unknown>;
    keyInsights?: unknown[];
  },
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
  const { data, error } = await getSupabase()
    .from('journey_sessions')
    .select('id, run_id, research_results, metadata, created_at, updated_at')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapSessionRow);
}

export interface ProfileSession {
  id: string;
  runId: string;
  sectionCount: number;
  totalSections: number;
  createdAt: string;
  updatedAt: string;
}

function mapSessionRow(row: Record<string, unknown>): ProfileSession {
  const results = (row.research_results as Record<string, unknown>) ?? {};
  const completedSections = Object.values(results).filter(
    (r) => r && typeof r === 'object' && (r as Record<string, unknown>).status === 'complete',
  ).length;

  return {
    id: row.id as string,
    runId: row.run_id as string,
    sectionCount: completedSections,
    totalSections: 7,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Map Supabase snake_case row to camelCase interface
function mapRow(row: Record<string, unknown>): BusinessProfile {
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
    lastResearchAt: (row.last_research_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
