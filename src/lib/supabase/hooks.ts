// Supabase React hooks with Clerk authentication
"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * React hook that creates a Supabase client with Clerk authentication.
 * The client automatically includes the Clerk JWT for RLS policy enforcement.
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const supabase = useSupabaseClient();
 *
 *   useEffect(() => {
 *     async function fetchData() {
 *       const { data } = await supabase.from('my_table').select('*');
 *       // RLS policies will filter by the authenticated user
 *     }
 *     fetchData();
 *   }, [supabase]);
 * }
 * ```
 */
export function useSupabaseClient() {
  const { session } = useSession();

  const supabase = useMemo(() => {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        async accessToken() {
          // Get the Clerk session token to pass to Supabase
          const token = await session?.getToken();
          return token ?? null;
        },
      }
    );
  }, [session]);

  return supabase;
}
