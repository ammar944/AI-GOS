// src/lib/journey/session-state.server.ts
import { createAdminClient } from '@/lib/supabase/server';

// ── Supabase Persistence ───────────────────────────────────────────────────
// Per DISCOVERY.md D11 (REVISED): Fetch-then-merge JSONB metadata column.
//
// Server-only: This file imports @/lib/supabase/server which transitively
// imports @clerk/nextjs/server. Must NOT be imported from client components.

export interface PersistResult {
  ok: boolean;
  error?: string;
}

// Transient Supabase error codes worth retrying (connection/timeout issues)
const RETRYABLE_PG_CODES = new Set(['08006', '08001', '57014', '40001', '40P01']);

function isRetryableSupabaseError(err: { code?: string; message?: string }): boolean {
  if (err.code && RETRYABLE_PG_CODES.has(err.code)) return true;
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('timeout') || msg.includes('connection') || msg.includes('reset');
}

export async function persistToSupabase(
  userId: string,
  fields: Record<string, unknown>,
): Promise<PersistResult> {
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
    const { error } = await supabase.from('journey_sessions').upsert(
      {
        user_id: userId,
        metadata: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('[journey] Supabase persistToSupabase failed:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[journey] Supabase persistence threw unexpectedly:', msg);
    return { ok: false, error: msg };
  }
}

export async function persistResearchToSupabase(
  userId: string,
  research: Record<string, unknown>,
  attempt = 1,
): Promise<PersistResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('journey_sessions')
      .upsert(
        { user_id: userId, research_output: research, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

    if (error) {
      const shouldRetry = attempt < 2 && isRetryableSupabaseError(error);
      if (shouldRetry) {
        console.warn(`[journey] Supabase write failed (attempt ${attempt}) — retrying in 1s:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return persistResearchToSupabase(userId, research, attempt + 1);
      }
      console.error(`[journey] persistResearchToSupabase failed after ${attempt} attempt(s):`, error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[journey] persistResearchToSupabase threw unexpectedly:', msg);
    return { ok: false, error: msg };
  }
}
