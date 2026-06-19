// @vitest-environment node
// PGlite's WASM loader needs Node's fetch/Response.arrayBuffer; the repo-default
// jsdom environment polyfills a Response without arrayBuffer and breaks loading.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { buildHarness, smokeAssertSchema } from "./_pglite-harness";

// Toggle: false during RED (chain-only, proves the deny-list defaults unknown
// zones to true). true once the GREEN allow-list migration exists.
const INCLUDE_NEW_MIGRATION = true;

describe("seed_orchestration — exact-six allow-list (P0.1)", () => {
  let db: PGlite;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const harness = await buildHarness({
      includeNewMigration: INCLUDE_NEW_MIGRATION,
    });
    db = harness.db;
    close = harness.close;
    await smokeAssertSchema(db);
  });

  afterAll(async () => {
    await close();
  });

  it("flags a KNOWN positioning zone counts_toward_rollup=true, an UNKNOWN zone false", async () => {
    await db.query(
      `select * from public.seed_orchestration($1, $2, $3::text[])`,
      [
        "user_allow_list",
        "run_allow_list",
        ["positioningMarketCategory", "someFutureZone"],
      ],
    );

    const rows = await db.query<{
      zone: string;
      counts_toward_rollup: boolean;
    }>(
      `select s.zone, s.counts_toward_rollup
         from public.research_artifact_sections s
         join public.research_artifacts a on a.id = s.artifact_id
        where a.run_id = $1
        order by s.zone`,
      ["run_allow_list"],
    );

    const byZone = new Map(
      rows.rows.map((r) => [r.zone, r.counts_toward_rollup]),
    );

    // Known canonical positioning zone => counts.
    expect(byZone.get("positioningMarketCategory")).toBe(true);
    // Unknown/future zone must NOT count (fail-closed allow-list).
    // RED today: the deny-list defaults unknown zones to true.
    expect(byZone.get("someFutureZone")).toBe(false);
  });

  it("does NOT raise inside roll_up_research_artifact when an unknown zone is present (fail-closed, no throw)", async () => {
    await db.query(
      `select * from public.seed_orchestration($1, $2, $3::text[])`,
      ["user_no_raise", "run_no_raise", ["positioningBuyerICP", "anotherFutureZone"]],
    );

    const artifact = await db.query<{ id: string }>(
      `select id from public.research_artifacts where run_id = $1`,
      ["run_no_raise"],
    );
    const artifactId = artifact.rows[0].id;

    // roll_up runs synchronously inside commit_artifact_section; a throwing
    // rollup would abort live section commits. It must complete without error
    // even with an unknown zone seeded.
    await expect(
      db.query(`select public.roll_up_research_artifact($1)`, [artifactId]),
    ).resolves.toBeDefined();
  });
});
