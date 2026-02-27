import { createAdminClient } from '@/lib/supabase/server';

// ── Supabase Persistence ───────────────────────────────────────────────────
// Per DISCOVERY.md D11 (REVISED): Fetch-then-merge JSONB metadata column.
// Per DISCOVERY.md D22: Silent fail with console.error on write failure.
//
// Server-only: This file imports @/lib/supabase/server which transitively
// imports @clerk/nextjs/server. Must NOT be imported from client components.

export async function persistToSupabase(
  userId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Fetch current metadata (D13: fetch-then-merge pattern)
    const { data: existing } = await supabase
      .from('journey_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .single();

    const currentMetadata =
      (existing?.metadata as Record<string, unknown>) || {};

    // Shallow merge — new fields overwrite existing, preserving untouched fields
    const merged = {
      ...currentMetadata,
      ...fields,
      lastUpdated: new Date().toISOString(),
    };

    // Upsert (D12: one session per user, UNIQUE on user_id)
    await supabase.from('journey_sessions').upsert(
      {
        user_id: userId,
        metadata: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch (error) {
    // Silent fail — localStorage is the fallback (DISCOVERY.md D22)
    console.error('[journey] Supabase persistence failed:', error);
  }
}
