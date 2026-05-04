import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const GTM_RLS_MIGRATIONS = [
  "20260430_create_gtm_runs.sql",
  "20260430_create_gtm_stage_events.sql",
  "20260430_fix_gtm_runs_rls_clerk_text.sql",
  "20260430_fix_gtm_stage_events_rls_clerk_text.sql",
] as const;

describe("GTM RLS policies", () => {
  it("read Clerk user ids as text without calling auth.uid", () => {
    for (const migration of GTM_RLS_MIGRATIONS) {
      const sql = readMigration(migration);

      expect(sql).not.toContain("auth.uid()");
      expect(sql).toContain(
        "current_setting('request.jwt.claims', true)::json->>'sub' = user_id"
      );
    }
  });
});

function readMigration(filename: string): string {
  const migrationPath = join(process.cwd(), "supabase", "migrations", filename);
  const sql = readFileSync(migrationPath, "utf8");

  return stripLineComments(sql);
}

function stripLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const commentStart = line.indexOf("--");

      if (commentStart === -1) {
        return line;
      }

      return line.slice(0, commentStart);
    })
    .join("\n");
}
