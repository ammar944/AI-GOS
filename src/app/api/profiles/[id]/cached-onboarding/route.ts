import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

const CachedOnboardingResponseSchema = z
  .object({
    cachedOnboarding: z.record(z.string(), z.unknown()).nullable(),
    websiteUrl: z.string().nullable(),
  })
  .strict();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readWebsiteUrl(row: Record<string, unknown>): string | null {
  const direct = row.website_url;
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }

  const allFields = row.all_fields;
  if (!isRecord(allFields)) return null;

  const fromAllFields = allFields.websiteUrl ?? allFields.website_url;
  if (typeof fromAllFields === 'string' && fromAllFields.trim().length > 0) {
    return fromAllFields.trim();
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('business_profiles')
    .select('cached_onboarding, website_url, all_fields')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return Response.json(
      {
        error: `Failed to read cached onboarding for profile ${id}: ${error.message}`,
      },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json(
      { error: `Profile ${id} not found for current user` },
      { status: 404 },
    );
  }

  const row = data as Record<string, unknown>;
  const cachedOnboarding = isRecord(row.cached_onboarding)
    ? row.cached_onboarding
    : null;
  const response = CachedOnboardingResponseSchema.parse({
    cachedOnboarding,
    websiteUrl: readWebsiteUrl(row),
  });

  return Response.json(response);
}
