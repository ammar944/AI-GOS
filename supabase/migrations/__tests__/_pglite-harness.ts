// Real-plpgsql, offline, $0 SQL test substrate for the research rollup chain.
//
// Spins a PGlite (in-memory Postgres) instance, pre-creates the Supabase-only
// objects the production migrations assume already exist (roles, pgcrypto,
// the auth.jwt() helper used in RLS policies, and the supabase_realtime
// publication), then replays the EXACT ordered rollup migration chain so the
// functions under test (roll_up_research_artifact, seed_orchestration,
// commit_artifact_section) run against the real shipped plpgsql — not a mock.
//
// Why each pre-create is required (verified against the migration sources):
//   - roles anon/authenticated/service_role: every rollup migration ends with
//     `grant ... to service_role` (+ revoke from anon/authenticated) and errors
//     on a missing role.
//   - pgcrypto: gen_random_uuid() is used by ensure_artifact/seed_orchestration.
//   - auth.jwt(): 20260514 RLS policies reference `auth.jwt() ->> 'sub'`.
//   - supabase_realtime publication: 20260514 runs `alter publication
//     supabase_realtime add table ...` (guarded only on table membership, not
//     publication existence) — without the publication the ALTER throws.

import { PGlite } from "@electric-sql/pglite";
// pgcrypto is a contrib extension that vanilla PGlite does not bundle by
// default; the migration chain runs `create extension if not exists pgcrypto`
// and calls gen_random_uuid(). Register it on the instance.
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(__dirname, "..");

// The EXACT ordered chain (latest defs; intermediate CREATE-OR-REPLACEs are
// superseded by these and intentionally skipped).
export const ROLLUP_MIGRATION_CHAIN = [
  "20260514_research_artifact_normalized.sql",
  "20260520_orchestrate_parent_child.sql",
  "20260524_research_artifact_sections_data.sql",
  "20260603_research_v3_rollup_persistence_flags.sql",
  "20260604_research_artifact_section_verification_tiers.sql",
  "20260613_strategy_brief_rollup_exclusion.sql",
] as const;

// The new migration under test (P0.1). Replayed last, after the chain.
export const NEW_MIGRATION = "20260618_content_aware_rollup_allow_list.sql";

function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

// Migrations that widen a function's RETURN TABLE shape need a DROP first
// (Postgres rejects CREATE OR REPLACE that changes the return type). Keyed by
// the migration filename that introduces the new shape. seed_orchestration's
// 20260520 definition returns 5 columns; 20260603 returns 6 (adds `status`).
const SIGNATURE_CHANGE_DROPS: Record<string, string> = {
  "20260603_research_v3_rollup_persistence_flags.sql":
    "drop function if exists public.seed_orchestration(text, text, text[]);",
};

/**
 * Pre-create the Supabase-managed objects the migrations assume exist, in the
 * order Postgres requires (roles + extensions + auth schema + publication)
 * BEFORE any migration is replayed.
 */
async function seedSupabaseEnvironment(db: PGlite): Promise<void> {
  // Roles. `create role` errors if it already exists; guard with a DO block.
  await db.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end $$;
  `);

  await db.exec(`create extension if not exists pgcrypto;`);

  // auth.jwt() stub — RLS policies in 20260514 reference auth.jwt() ->> 'sub'.
  // Policies are only parsed/validated at create time against the function's
  // existence + return type (jsonb), so a constant stub is sufficient for the
  // schema to load; tests write via SECURITY DEFINER RPCs and never exercise RLS.
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.jwt() returns jsonb
      language sql stable
      as $$ select '{}'::jsonb $$;
  `);

  // supabase_realtime publication — 20260514 runs `alter publication
  // supabase_realtime add table ...`. Create it empty if absent.
  await db.exec(`
    do $$
    begin
      if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
      end if;
    end $$;
  `);

  // business_profiles — a Supabase table created outside the rollup chain.
  // 20260603 runs `alter table public.business_profiles add column if not
  // exists cached_onboarding jsonb` (unrelated to the rollup logic under test).
  // A minimal stub lets that ALTER succeed without pulling in the whole table's
  // own migration. The rollup functions never read this table.
  await db.exec(`
    create table if not exists public.business_profiles (
      id uuid primary key default gen_random_uuid()
    );
  `);
}

export interface BuiltHarness {
  db: PGlite;
  /** Close the underlying PGlite instance. */
  close: () => Promise<void>;
}

/**
 * Build a fresh in-memory Postgres with the rollup chain replayed.
 *
 * @param includeNewMigration when true, also replays the P0.1 migration
 *   (20260618_content_aware_rollup_allow_list.sql) after the chain. RED tests
 *   build WITHOUT it (chain-only) to prove the bug exists; GREEN/regression
 *   tests build WITH it.
 */
export async function buildHarness(opts?: {
  includeNewMigration?: boolean;
}): Promise<BuiltHarness> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;

  await seedSupabaseEnvironment(db);

  for (const file of ROLLUP_MIGRATION_CHAIN) {
    // Signature-change bridge: a few migrations widen a function's RETURN TABLE
    // (e.g. seed_orchestration gains a `status` column in 20260603). Postgres
    // forbids changing a function's return type via CREATE OR REPLACE — the
    // real prod chain did this with intermediate DROP-and-recreate migrations
    // that we intentionally skip. Drop the affected function first so the
    // latest definition installs cleanly.
    const drops = SIGNATURE_CHANGE_DROPS[file];
    if (drops) {
      await db.exec(drops);
    }
    try {
      await db.exec(readMigration(file));
    } catch (err) {
      throw new Error(
        `Failed replaying migration ${file}: ${(err as Error).message}`,
      );
    }
  }

  if (opts?.includeNewMigration) {
    try {
      await db.exec(readMigration(NEW_MIGRATION));
    } catch (err) {
      throw new Error(
        `Failed replaying new migration ${NEW_MIGRATION}: ${(err as Error).message}`,
      );
    }
  }

  return {
    db,
    close: () => db.close(),
  };
}

/**
 * SMOKE-ASSERT: prove the schema actually built before any RED/GREEN test runs.
 * Returns a human-readable report; throws if anything is missing.
 */
export async function smokeAssertSchema(db: PGlite): Promise<string> {
  const lines: string[] = [];

  const tbl = await db.query<{ exists: boolean }>(
    `select exists (
       select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'research_artifact_sections'
     ) as exists`,
  );
  if (!tbl.rows[0]?.exists) {
    throw new Error("smoke: research_artifact_sections table missing");
  }
  lines.push("table research_artifact_sections: OK");

  const fns = [
    "roll_up_research_artifact",
    "seed_orchestration",
    "commit_artifact_section",
  ];
  for (const fn of fns) {
    const res = await db.query<{ exists: boolean }>(
      `select exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = $1
       ) as exists`,
      [fn],
    );
    if (!res.rows[0]?.exists) {
      throw new Error(`smoke: function ${fn} not callable (missing)`);
    }
    lines.push(`function ${fn}: callable`);
  }

  // verification_tier column must exist (added in 20260604) — the gate depends on it.
  const col = await db.query<{ exists: boolean }>(
    `select exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'research_artifact_sections'
         and column_name = 'verification_tier'
     ) as exists`,
  );
  if (!col.rows[0]?.exists) {
    throw new Error("smoke: research_artifact_sections.verification_tier column missing");
  }
  lines.push("column research_artifact_sections.verification_tier: OK");

  return lines.join("\n");
}

/**
 * Seed a parent artifact + N sections directly (bypassing seed_orchestration so
 * tests can control counts_toward_rollup / verification_tier precisely), then
 * return the artifact id. Sections are inserted at revision 1.
 */
export async function seedArtifactWithSections(
  db: PGlite,
  params: {
    userId: string;
    runId: string;
    childrenTotal: number;
    sections: Array<{
      zone: string;
      status: string;
      countsTowardRollup: boolean;
      verificationTier: string | null;
      data?: unknown;
    }>;
  },
): Promise<string> {
  const artifact = await db.query<{ id: string }>(
    `insert into public.research_artifacts (run_id, user_id, status, children_total, children_complete)
     values ($1, $2, 'queued', $3, 0)
     returning id`,
    [params.runId, params.userId, params.childrenTotal],
  );
  const artifactId = artifact.rows[0].id;

  for (const s of params.sections) {
    await db.query(
      `insert into public.research_artifact_sections
         (artifact_id, zone, revision, status, counts_toward_rollup, verification_tier, data)
       values ($1, $2, 1, $3, $4, $5, $6)`,
      [
        artifactId,
        s.zone,
        s.status,
        s.countsTowardRollup,
        s.verificationTier,
        s.data === undefined ? null : JSON.stringify(s.data),
      ],
    );
  }

  return artifactId;
}
