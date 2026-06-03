/**
 * Edge-safe existence check for a public share token.
 *
 * Why this exists: the `/shared/[token]` page can only ever *soft*-404 (HTTP 200
 * with the not-found UI) because the root `app/loading.tsx` Suspense boundary
 * streams a 200 shell before the page's `notFound()` runs. Middleware uses this
 * to emit a genuine 404 for unknown tokens. Implemented with plain `fetch`
 * (Supabase REST) so it runs on the Edge middleware runtime — no supabase-js /
 * node deps.
 *
 * Fail-open: if the env is missing or the REST call errors, return `true` so we
 * never hard-404 a token that might be valid. A genuinely-unknown token still
 * falls through to the page's soft-404 in that degraded case.
 */
export async function shareTokenExists(token: string): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey || token.length === 0) {
    return true;
  }

  try {
    const res = await fetch(
      `${baseUrl}/rest/v1/shared_sessions?share_token=eq.${encodeURIComponent(
        token,
      )}&select=share_token&limit=1`,
      {
        headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      return true;
    }

    const rows = (await res.json()) as unknown;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return true;
  }
}
