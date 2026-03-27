// PATCH /api/profiles/:id — update business profile fields
// Merges into all_fields JSONB and updates individual columns where mapped.
// company_name is read-only to protect the upsert key.

import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { updateProfile } from '@/lib/profiles/business-profiles';

const PatchSchema = z.object({
  fields: z.record(z.string(), z.string()),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { fields } = parsed.data;

  // Block company_name edits — would corrupt the upsert key
  if ('companyName' in fields) {
    return Response.json(
      { error: 'company_name is read-only' },
      { status: 400 },
    );
  }

  const success = await updateProfile(userId, id, fields);

  if (!success) {
    return Response.json(
      { error: 'Profile not found or update failed' },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
