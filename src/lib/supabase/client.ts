import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for browser-side database operations.
 * Note: For RLS-protected queries, use the useSupabaseClient hook instead
 * which passes the Clerk JWT token for authentication.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Creates a Supabase client with Clerk session token for RLS.
 * Use this in client components that need RLS-protected access.
 *
 * @param getToken - Function to get Clerk session token (from useSession hook)
 */
export function createClientWithAuth(getToken: () => Promise<string | null>) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return await getToken();
      },
    }
  );
}
