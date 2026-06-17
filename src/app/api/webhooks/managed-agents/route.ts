// Managed Agents webhook ingress (Phase 1).
//
// Thin route shell — all orchestration lives in
// src/lib/managed-agents/webhook-handler.ts so the logic is testable.
//
// Mitigations are enforced by the handler. See HARD RULES R1, R3, R5, R6 in
// docs/handoffs/2026-05-19-managed-agents-full-migration.md.

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { ManagedAgentsClient } from '@/lib/managed-agents/client';
import { createSupabaseWebhookAdapter } from '@/lib/managed-agents/supabase-adapter';
import { handleManagedAgentsWebhook } from '@/lib/managed-agents/webhook-handler';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
// Webhook fan-outs can include a large agent response; keep the timeout
// generous but not unbounded.
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const headerStore = await headers();
  const signatureHeader =
    headerStore.get('anthropic-webhook-signature') ??
    headerStore.get('Anthropic-Webhook-Signature') ??
    null;

  const webhookSecret = process.env.MANAGED_AGENTS_WEBHOOK_SECRET?.trim() ?? null;
  if (!webhookSecret) {
    console.error('[managed-agents/webhook] MANAGED_AGENTS_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'webhook_secret_missing' },
      { status: 500 },
    );
  }

  let client: ManagedAgentsClient;
  try {
    client = new ManagedAgentsClient();
  } catch (err) {
    console.error('[managed-agents/webhook] client init failed:', err);
    return NextResponse.json({ error: 'client_init_failed' }, { status: 500 });
  }

  const supabase = createSupabaseWebhookAdapter(createAdminClient());

  const result = await handleManagedAgentsWebhook(
    { client, supabase, webhookSecret },
    { rawBody, signatureHeader },
  );

  return NextResponse.json(result.body, { status: result.status });
}
