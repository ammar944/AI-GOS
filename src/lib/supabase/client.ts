import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Creates a Supabase client for browser-side database operations.
 * Uses singleton pattern to avoid creating multiple clients.
 */
export function createClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return supabaseClient;
}
