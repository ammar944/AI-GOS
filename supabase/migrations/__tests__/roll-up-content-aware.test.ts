// @vitest-environment node
// PGlite's WASM loader needs Node's fetch/Response.arrayBuffer; the repo-default
// jsdom environment polyfills a Response without arrayBuffer and breaks loading.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  buildHarness,
  smokeAssertSchema,
  seedArtifactWithSections,
} from "./_pglite-harness";

// Toggle: false during RED (chain-only, proves the bug). true once the GREEN
// migration 20260618_content_aware_rollup_allow_list.sql exists.
const INCLUDE_NEW_MIGRATION = true;

// The six canonical positioning zones (the allow-list). Mirrors
// POSITIONING_SECTION_IDS in src/lib/ai/prompts/positioning-skills/index.ts.
const SIX_ZONES = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
];

describe("roll_up_research_artifact — content-aware (P0.1)", () => {
  let db: PGlite;
  let close: () => Promise<void>;

  beforeAll(async () => {
    // RED: build WITHOUT the new migration — proves the bug exists on the
    // shipped chain. The GREEN run flips includeNewMigration to true.
    const harness = await buildHarness({
      includeNewMigration: INCLUDE_NEW_MIGRATION,
    });
    db = harness.db;
    close = harness.close;
    // Smoke-assert the schema actually built before asserting behavior.
    await smokeAssertSchema(db);
  });

  afterAll(async () => {
    await close();
  });

  it("does NOT count an 'insufficient'-tier section toward the rollup", async () => {
    // 6 positioning sections, all complete & counts_toward_rollup=true, but
    // positioningBuyerICP is verification_tier='insufficient' (empty/unreliable).
    const artifactId = await seedArtifactWithSections(db, {
      userId: "user_content_aware",
      runId: "run_content_aware",
      childrenTotal: 6,
      sections: SIX_ZONES.map((zone) => ({
        zone,
        status: "complete",
        countsTowardRollup: true,
        verificationTier:
          zone === "positioningBuyerICP" ? "insufficient" : "verified",
      })),
    });

    await db.query(`select public.roll_up_research_artifact($1)`, [artifactId]);

    const res = await db.query<{
      children_complete: number;
      status: string;
    }>(
      `select children_complete, status from public.research_artifacts where id = $1`,
      [artifactId],
    );

    // The insufficient BuyerICP must NOT count: 5 of 6, parent NOT complete.
    expect(res.rows[0].children_complete).toBe(5);
    expect(res.rows[0].status).not.toBe("complete");
  });
});
