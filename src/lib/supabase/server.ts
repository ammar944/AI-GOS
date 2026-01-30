import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

/**
 * Creates a Supabase client for server-side database operations with Clerk auth.
 * This client passes the Clerk JWT to Supabase for RLS policy enforcement.
 * Authentication is handled by Clerk, Supabase is used for database only.
 */
export async function createClient() {
  const { getToken } = await auth();

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await getToken({ template: "supabase" })) ?? null;
      },
    }
  );
}

/**
 * Creates a Supabase admin client with service role key.
 * USE ONLY for server-side admin operations (webhooks, background jobs).
 * This bypasses RLS - never expose to client or use for user operations.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
