// GET /api/profiles/:id/sessions — fetch all research sessions linked to a profile

import { auth } from '@clerk/nextjs/server';
import { getProfileSessions } from '@/lib/profiles/business-profiles';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const sessions = await getProfileSessions(userId, id);

  return Response.json({ sessions });
}
