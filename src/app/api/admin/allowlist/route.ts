import { z } from 'zod';
import {
  requireApiUser,
  jsonError,
  requireAdmin,
} from '@/lib/auth/app-access';
import { createAdminClient } from '@/lib/supabase/server';

const PostSchema = z.object({
  email: z.string().email(),
  intended_role: z.enum(['admin', 'internal', 'client']),
  notes: z.string().optional(),
  status: z.enum(['pending', 'approved', 'revoked']).optional(),
});

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'revoked']).optional(),
  intended_role: z.enum(['admin', 'internal', 'client']).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  const access = await requireApiUser();
  if (access instanceof Response) return access;
  if (!requireAdmin(access)) return jsonError('Forbidden', 403);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('client_allowlist')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return jsonError(error.message, 500);
  return Response.json({ entries: data ?? [] });
}

export async function POST(req: Request) {
  const access = await requireApiUser();
  if (access instanceof Response) return access;
  if (!requireAdmin(access)) return jsonError('Forbidden', 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid payload', 400);
  }

  const { email, intended_role, notes, status } = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('client_allowlist')
    .insert({
      email: email.trim().toLowerCase(),
      intended_role,
      notes: notes ?? null,
      status: status ?? 'pending',
      created_by: access.actorUserId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return jsonError('Email already on allowlist', 409);
    return jsonError(error.message, 500);
  }
  return Response.json({ entry: data });
}

export async function PATCH(req: Request) {
  const access = await requireApiUser();
  if (access instanceof Response) return access;
  if (!requireAdmin(access)) return jsonError('Forbidden', 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid payload', 400);
  }

  const { id, status, intended_role, notes } = parsed.data;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status !== undefined) patch.status = status;
  if (intended_role !== undefined) patch.intended_role = intended_role;
  if (notes !== undefined) patch.notes = notes;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('client_allowlist')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError('Not found', 404);
  return Response.json({ entry: data });
}
