import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  'supabase/migrations/20260601_claim_section_run.sql',
  'utf8',
);

describe('claim_section_run migration tenant scope', () => {
  it('defines only the tenant-scoped claim function signature for service-role callers', () => {
    expect(migrationSql).toContain(
      'drop function if exists public.claim_section_run(uuid, text);',
    );
    expect(migrationSql).toContain(
      [
        'create or replace function public.claim_section_run(',
        '  p_user_id text,',
        '  p_run_id uuid,',
        '  p_section_id text',
      ].join('\n'),
    );
    expect(migrationSql).toContain(
      'revoke execute on function public.claim_section_run(text, uuid, text)',
    );
    expect(migrationSql).toContain(
      'grant execute on function public.claim_section_run(text, uuid, text) to service_role;',
    );
    expect(migrationSql).not.toContain(
      'grant execute on function public.claim_section_run(uuid, text)',
    );
  });

  it('scopes both claim update and fallback lookup by user_id and run_id', () => {
    expect(migrationSql).toContain(
      ['where a.user_id = $1', '         and a.run_id = $2::text'].join('\n'),
    );
    expect(migrationSql).toContain(
      [
        'where a.user_id = p_user_id',
        '     and a.run_id = p_run_id::text',
      ].join('\n'),
    );
  });
});
