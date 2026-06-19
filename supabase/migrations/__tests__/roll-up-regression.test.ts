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

const SIX_ZONES = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
];

describe("roll_up_research_artifact — regression (gate does not over-block)", () => {
  let db: PGlite;
  let close: () => Promise<void>;

  beforeAll(async () => {
    // Regression runs WITH the new migration applied.
    const harness = await buildHarness({ includeNewMigration: true });
    db = harness.db;
    close = harness.close;
    await smokeAssertSchema(db);
  });

  afterAll(async () => {
    await close();
  });

  it("flips status='complete' at 6/6 when all six are verified/needs_review and a capstone is present but not counted", async () => {
    // children_total = 6 (the six positioning zones). A paid-media capstone is
    // also present and complete, but counts_toward_rollup=false so it must not
    // inflate the count past 6.
    const tiers = [
      "verified",
      "needs_review",
      "verified",
      "needs_review",
      "verified",
      "needs_review",
    ];
    const artifactId = await seedArtifactWithSections(db, {
      userId: "user_regression",
      runId: "run_regression",
      childrenTotal: 6,
      sections: [
        ...SIX_ZONES.map((zone, i) => ({
          zone,
          status: "complete",
          countsTowardRollup: true,
          verificationTier: tiers[i],
          data: { ok: true },
        })),
        {
          // capstone — complete but excluded from rollup
          zone: "positioningPaidMediaPlan",
          status: "complete",
          countsTowardRollup: false,
          verificationTier: "verified",
          data: { ok: true },
        },
      ],
    });

    await db.query(`select public.roll_up_research_artifact($1)`, [artifactId]);

    const res = await db.query<{
      children_complete: number;
      status: string;
    }>(
      `select children_complete, status from public.research_artifacts where id = $1`,
      [artifactId],
    );

    // All six verified/needs_review sections count; capstone does not.
    expect(res.rows[0].children_complete).toBe(6);
    expect(res.rows[0].status).toBe("complete");
  });
});
