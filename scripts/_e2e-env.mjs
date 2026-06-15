// _e2e-env.mjs — single source of truth for E2E harness config.
// Import from every zz-e2e-* and zz-drive-e2e-* script so port, base URL, and
// "which run do I test against" never drift between scripts again.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createClient } from '@supabase/supabase-js';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
// One CDP port for the whole harness. Strategy-brief scripts used 9223; the two
// full drivers used 9222 — that split silently targeted the wrong browser.
export const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
export const CHROME_PROFILE_DIR =
  process.env.E2E_CHROME_PROFILE ?? 'tmp/e2e-chrome-profile';

export function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'serviceRoleClient: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required in .env.local',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Returns the most recent STRUCTURALLY-clean run id: status=complete, all
// children rolled up (complete === total > 0), and zero error sections.
// NOTE: structural only — it does NOT judge content. A run can be structurally
// clean and still fail the value bar (e.g. a leaked test fixture in a zone).
// Use this to pick a run to exercise the pipeline against, not as a quality gate.
export async function getCleanRunId(sb = serviceRoleClient()) {
  const { data: arts, error } = await sb
    .from('research_artifacts')
    .select('run_id, id, status, children_total, children_complete, created_at')
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(`getCleanRunId: ${error.message}`);

  for (const art of arts ?? []) {
    if (!art.children_total || art.children_complete !== art.children_total) continue;
    const { data: errs } = await sb
      .from('research_artifact_sections')
      .select('zone', { count: 'exact', head: false })
      .eq('artifact_id', art.id)
      .eq('status', 'error');
    if ((errs?.length ?? 0) === 0) return art.run_id;
  }
  return null;
}

// Presence-only env check (never reads or returns the secret value).
export function envPresence(names) {
  return names.map((name) => ({ name, present: Boolean(process.env[name]) }));
}
