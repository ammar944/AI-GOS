// @vitest-environment node
// Drift guard: the exact-six allow-list baked into
// 20260618_content_aware_rollup_allow_list.sql MUST stay equal to
// POSITIONING_SECTION_IDS (the application source of truth). If someone adds a
// 7th positioning zone in TypeScript but forgets the SQL allow-list (or vice
// versa), this test fails loudly.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POSITIONING_SECTION_IDS } from "@/lib/ai/prompts/positioning-skills";

const MIGRATION_PATH = join(
  __dirname,
  "..",
  "20260618_content_aware_rollup_allow_list.sql",
);

/**
 * Extract every `v_allow_list text[] := array[ ... ]` literal from the migration
 * and return the ordered list of quoted zone ids inside each. The migration
 * declares the allow-list in both seed_orchestration and commit_artifact_section,
 * so we assert ALL declared copies match the constant.
 */
function extractAllowListArrays(sql: string): string[][] {
  const arrays: string[][] = [];
  const re = /v_allow_list\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const ids = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    arrays.push(ids);
  }
  return arrays;
}

describe("allow-list drift guard (SQL <-> POSITIONING_SECTION_IDS)", () => {
  it("every v_allow_list array in the migration equals POSITIONING_SECTION_IDS (order-sensitive)", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    const arrays = extractAllowListArrays(sql);

    // Sanity: the migration must declare the allow-list in both functions.
    expect(arrays.length).toBeGreaterThanOrEqual(2);

    const expected = [...POSITIONING_SECTION_IDS];
    for (const arr of arrays) {
      expect(arr).toEqual(expected);
    }
  });
});
