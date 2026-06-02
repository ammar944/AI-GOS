import type { SupabaseClient } from '@supabase/supabase-js';

export interface SharedSessionReadModel {
  id: string;
  share_token: string;
  title: string | null;
  research_snapshot: unknown;
  media_plan_snapshot: unknown;
  created_at: string;
}

export async function getSharedSessionByToken(input: {
  supabase: SupabaseClient;
  token: string;
}): Promise<SharedSessionReadModel | null> {
  const { data, error } = await input.supabase
    .from('shared_sessions')
    .select('id, share_token, title, research_snapshot, media_plan_snapshot, created_at')
    .eq('share_token', input.token)
    .maybeSingle();

  if (error) {
    throw new Error(
      `shared_sessions lookup failed for token=${input.token}: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return data as SharedSessionReadModel;
}
