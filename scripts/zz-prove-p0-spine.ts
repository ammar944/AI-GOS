#!/usr/bin/env tsx
//
// zz-prove-p0-spine.ts — the single end-to-end $0 SPINE PROOF that all three
// P0 research-OS pieces chain on the FROZEN b0d12b45 acceptance fixture with
// NO paid/live API call.
//
//   STEP 1 (P0.2 durability): run the SHIPPED corpusToResearchInput transform
//     on tmp/accept/b0d12b45/deepResearchProgram.json, promote every corpus
//     excerpt to a ResearchFact, INSERT into a real (pglite) research_facts
//     table created by the shipped 20260618_research_facts_ledger.sql migration.
//     Assert durable rows === researchInput.corpus.excerpts.length, every row
//     carries a non-empty source_url + source_quote, and a mid-loop abort
//     leaves the already-inserted rows durably committed (durability, not zero).
//
//   STEP 2 (P0.3 liar-catcher): build the committed deck from the frozen
//     per-section fixtures, then run the deterministic deck-vs-ledger gate
//     against the ledger derived from STEP 1's corpus facts. Prove the gate
//     CATCHES a deck that asserts grounding the ledger cannot prove (the exact
//     b0d12b45 failure: pipeline DROPS the evidence that backed the grounded
//     cells) — blocking the two grounded PMP cells while SKIPPING the empty
//     BuyerICP (an honest gap, never a lie). Also prove that with the FULL,
//     undropped corpus ledger the gate does NOT block — so the gate punishes
//     unprovable grounding, never honest data.
//
//   STEP 3 (P0.1 rollup): seed the seven research zones (six positioning + the
//     corpus zone) through the shipped seed_orchestration allow-list into the
//     full migration chain + 20260618_content_aware_rollup_allow_list.sql, mark
//     BuyerICP verification_tier='insufficient', run roll_up_research_artifact,
//     and assert children_complete === 5 (empty BuyerICP rejected by the
//     content-aware gate), parent status !== 'complete', and the corpus zone is
//     NOT counted (counts_toward_rollup=false via the exact-six allow-list).
//
// Offline. $0. Run: `npx tsx scripts/zz-prove-p0-spine.ts`.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

import { corpusToResearchInput } from "@/lib/research-v2/corpus-to-research-input";
import {
  buildResearchFactsFromCorpusExcerpts,
  type ResearchFact,
  type ResearchFactPromoterContext,
} from "@/lib/lab-engine/evidence/research-fact";
import {
  checkDeckAgainstLedger,
  type DeckBundle,
  type LiarVerdict,
} from "@/lib/lab-engine/verification/deck-ledger-gate";
import {
  buildHarness,
  smokeAssertSchema,
} from "../supabase/migrations/__tests__/_pglite-harness";
import { readCorpus, readSectionBody } from "./lib/fixture-loader";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(REPO_ROOT, "tmp/accept/b0d12b45");
const CORPUS_FILE = join(FIXTURE_DIR, "deepResearchProgram.json");
const LEDGER_MIGRATION = join(
  REPO_ROOT,
  "supabase/migrations/20260618_research_facts_ledger.sql",
);
const RUN_ID = "b0d12b45";

// The single upstream source that BOTH grounded PMP cells (audienceTypes[0],
// anglesToTest[0]) resolve to via positioningMarketCategory body.structuralForces
// .forces[0]. Dropping every corpus fact at this URL from the ledger reproduces
// the exact b0d12b45 failure: the deck ASSERTS grounding the pipeline dropped.
const GROUNDED_CELL_SOURCE_URL =
  "https://www.g2.com/products/ramp-financial-ramp/competitors/alternatives";

const SECTION_FILES = {
  positioningPaidMediaPlan: join(FIXTURE_DIR, "positioningPaidMediaPlan.json"),
  positioningVoiceOfCustomer: join(
    FIXTURE_DIR,
    "positioningVoiceOfCustomer.json",
  ),
  positioningMarketCategory: join(FIXTURE_DIR, "positioningMarketCategory.json"),
  positioningBuyerICP: join(FIXTURE_DIR, "positioningBuyerICP.json"),
  positioningCompetitorLandscape: join(
    FIXTURE_DIR,
    "positioningCompetitorLandscape.json",
  ),
  positioningDemandIntent: join(FIXTURE_DIR, "positioningDemandIntent.json"),
  positioningOfferDiagnostic: join(
    FIXTURE_DIR,
    "positioningOfferDiagnostic.json",
  ),
} as const;

// The six canonical positioning zones (the allow-list) + the corpus zone, which
// must NOT count toward the rollup.
const SIX_POSITIONING_ZONES = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
] as const;
const CORPUS_ZONE = "deepResearchProgram";

// ---------------------------------------------------------------------------
// Result shape — the test asserts every field of this.
// ---------------------------------------------------------------------------

export interface SpineProofResult {
  step1: {
    excerptCount: number;
    durableRowCount: number;
    everyRowHasSourceUrl: boolean;
    everyRowHasSourceQuote: boolean;
    abortAfterN: number;
    durableRowsAfterAbort: number;
  };
  step2: {
    droppedLedgerVerdict: LiarVerdict;
    fullLedgerVerdict: LiarVerdict;
  };
  step3: {
    childrenComplete: number;
    parentStatus: string;
    corpusCountsTowardRollup: boolean;
    buyerIcpVerificationTier: string;
  };
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function corpusFactContext(): ResearchFactPromoterContext {
  return {
    runId: RUN_ID,
    // Corpus excerpts are pre-section evidence; attribute them to the market
    // category section solely so the promoter has a valid SectionId. The
    // ledger keys facts off (sourceUrl, claimToken), not sectionId.
    sectionId: "positioningMarketCategory",
    createdAt: "2026-06-18T00:00:00.000Z",
    parentAuditRunId: RUN_ID,
  };
}

/**
 * STEP 1: shipped transform -> promote -> durable INSERT into a real pglite
 * research_facts table, with a mid-loop abort durability probe.
 */
async function proveStep1(): Promise<{
  facts: ResearchFact[];
  result: SpineProofResult["step1"];
}> {
  // The SHIPPED transform first (NOT a hand-built excerpt array): this is the
  // exact path prod runs, so the proof binds to production behavior.
  const rawCorpusFile = JSON.parse(readFileSync(CORPUS_FILE, "utf8")) as unknown;
  // readCorpus is a fail-closed guard: it throws if the file is not the RAW
  // corpus envelope, so an inverted-access bug can never silently pass.
  readCorpus(CORPUS_FILE);

  const researchInput = corpusToResearchInput({
    runId: RUN_ID,
    deepResearchProgramData: rawCorpusFile,
  });
  const excerpts = researchInput.corpus.excerpts;
  const excerptCount = excerpts.length;

  const facts = buildResearchFactsFromCorpusExcerpts(
    excerpts,
    corpusFactContext(),
  );

  // Spin a dedicated pglite instance with ONLY the ledger migration applied —
  // the real shipped 20260618_research_facts_ledger.sql, not a mock table.
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  await db.exec(`create extension if not exists pgcrypto;`);
  // The migration declares RLS + grants to service_role; pre-create the role so
  // the GRANT does not error in the bare pglite instance.
  await db.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
    end $$;
  `);
  await db.exec(readFileSync(LEDGER_MIGRATION, "utf8"));

  const insertFact = async (fact: ResearchFact): Promise<void> => {
    await db.query(
      `insert into public.research_facts
         (run_id, parent_audit_run_id, section_id, fact_kind, source_url, source_quote, claim_token, payload, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        fact.runId,
        fact.parentAuditRunId ?? null,
        fact.sectionId,
        fact.factKind,
        fact.sourceUrl,
        fact.sourceQuote,
        fact.claimToken,
        fact.payload ? JSON.stringify(fact.payload) : null,
        fact.createdAt,
      ],
    );
  };

  // Full durable insert of every promoted fact.
  for (const fact of facts) {
    await insertFact(fact);
  }

  const durable = await db.query<{ count: number }>(
    `select count(*)::int as count from public.research_facts`,
  );
  const durableRowCount = durable.rows[0].count;

  const nullUrl = await db.query<{ count: number }>(
    `select count(*)::int as count from public.research_facts
       where source_url is null or length(trim(source_url)) = 0`,
  );
  const nullQuote = await db.query<{ count: number }>(
    `select count(*)::int as count from public.research_facts
       where source_quote is null or length(trim(source_quote)) = 0`,
  );

  // Durability under a mid-loop abort: a SECOND, fresh instance into which we
  // insert only the first N facts, then "abort" (stop inserting) — the N rows
  // already committed must remain durable, NOT roll back to zero.
  const abortDb = new PGlite({ extensions: { pgcrypto } });
  await abortDb.waitReady;
  await abortDb.exec(`create extension if not exists pgcrypto;`);
  await abortDb.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
    end $$;
  `);
  await abortDb.exec(readFileSync(LEDGER_MIGRATION, "utf8"));

  const abortAfterN = Math.floor(facts.length / 2);
  const insertAbortFact = async (fact: ResearchFact): Promise<void> => {
    await abortDb.query(
      `insert into public.research_facts
         (run_id, parent_audit_run_id, section_id, fact_kind, source_url, source_quote, claim_token, payload, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        fact.runId,
        fact.parentAuditRunId ?? null,
        fact.sectionId,
        fact.factKind,
        fact.sourceUrl,
        fact.sourceQuote,
        fact.claimToken,
        fact.payload ? JSON.stringify(fact.payload) : null,
        fact.createdAt,
      ],
    );
  };

  try {
    let inserted = 0;
    for (const fact of facts) {
      if (inserted >= abortAfterN) {
        // Simulate a mid-loop abort (e.g. job watchdog kill / process death).
        throw new Error("simulated mid-loop abort");
      }
      await insertAbortFact(fact);
      inserted += 1;
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== "simulated mid-loop abort"
    ) {
      throw error;
    }
  }

  const afterAbort = await abortDb.query<{ count: number }>(
    `select count(*)::int as count from public.research_facts`,
  );
  const durableRowsAfterAbort = afterAbort.rows[0].count;

  await db.close();
  await abortDb.close();

  return {
    facts,
    result: {
      excerptCount,
      durableRowCount,
      everyRowHasSourceUrl: nullUrl.rows[0].count === 0,
      everyRowHasSourceQuote: nullQuote.rows[0].count === 0,
      abortAfterN,
      durableRowsAfterAbort,
    },
  };
}

async function loadCommittedDeck(): Promise<DeckBundle> {
  const deck: DeckBundle = {};
  for (const [sectionId, file] of Object.entries(SECTION_FILES)) {
    deck[sectionId] = { body: await readSectionBody(file) };
  }
  return deck;
}

/**
 * STEP 2: the deterministic deck-vs-ledger liar-catcher on the frozen deck.
 */
async function proveStep2(
  corpusFacts: readonly ResearchFact[],
): Promise<SpineProofResult["step2"]> {
  const deck = await loadCommittedDeck();

  // The b0d12b45 failure mode reproduced from the REAL corpus ledger: the
  // evidence that backed the grounded cells was DROPPED from the pipeline. Drop
  // every corpus fact at the grounded cells' cited source so the deck's
  // asserted grounding becomes unprovable.
  const droppedLedger = corpusFacts.filter(
    (fact) => fact.sourceUrl !== GROUNDED_CELL_SOURCE_URL,
  );
  const droppedLedgerVerdict = checkDeckAgainstLedger({
    deck,
    ledger: droppedLedger,
  });

  // Control: the FULL, undropped corpus ledger DOES back the grounded cells, so
  // the gate must NOT block — proving it punishes unprovable grounding, not
  // honest data.
  const fullLedgerVerdict = checkDeckAgainstLedger({
    deck,
    ledger: corpusFacts,
  });

  return { droppedLedgerVerdict, fullLedgerVerdict };
}

/**
 * STEP 3: content-aware + allow-list rollup through the full shipped chain.
 */
async function proveStep3(): Promise<SpineProofResult["step3"]> {
  const harness = await buildHarness({ includeNewMigration: true });
  const db = harness.db;
  await smokeAssertSchema(db);

  // Seed all seven zones through the shipped seed_orchestration allow-list so
  // counts_toward_rollup is set by REAL plpgsql (corpus -> false).
  const zones = [...SIX_POSITIONING_ZONES, CORPUS_ZONE];
  await db.query(`select * from public.seed_orchestration($1, $2, $3::text[])`, [
    "user_spine",
    "run_spine",
    zones,
  ]);

  const artifact = await db.query<{ id: string }>(
    `select id from public.research_artifacts where run_id = $1`,
    ["run_spine"],
  );
  const artifactId = artifact.rows[0].id;

  // Mark every section complete with real data; BuyerICP is the empty/unreliable
  // section (verification_tier='insufficient'), all others 'verified'.
  for (const zone of zones) {
    const tier = zone === "positioningBuyerICP" ? "insufficient" : "verified";
    await db.query(
      `update public.research_artifact_sections
         set status = 'complete', verification_tier = $2, data = $3
       where artifact_id = $1 and zone = $4`,
      [artifactId, tier, JSON.stringify({ seeded: true }), zone],
    );
  }

  await db.query(`select public.roll_up_research_artifact($1)`, [artifactId]);

  const res = await db.query<{
    children_complete: number;
    status: string;
  }>(
    `select children_complete, status from public.research_artifacts where id = $1`,
    [artifactId],
  );

  const corpusRow = await db.query<{ counts_toward_rollup: boolean }>(
    `select counts_toward_rollup from public.research_artifact_sections
       where artifact_id = $1 and zone = $2`,
    [artifactId, CORPUS_ZONE],
  );

  const buyerIcpRow = await db.query<{ verification_tier: string }>(
    `select verification_tier from public.research_artifact_sections
       where artifact_id = $1 and zone = $2`,
    [artifactId, "positioningBuyerICP"],
  );

  await harness.close();

  return {
    childrenComplete: res.rows[0].children_complete,
    parentStatus: res.rows[0].status,
    corpusCountsTowardRollup: corpusRow.rows[0].counts_toward_rollup,
    buyerIcpVerificationTier: buyerIcpRow.rows[0].verification_tier,
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function runSpineProof(): Promise<SpineProofResult> {
  const { facts, result: step1 } = await proveStep1();
  const step2 = await proveStep2(facts);
  const step3 = await proveStep3();
  return { step1, step2, step3 };
}

// Pure pass/fail evaluation so both the CLI and the test agree on the bar.
export function evaluateSpineProof(result: SpineProofResult): {
  step1Pass: boolean;
  step2Pass: boolean;
  step3Pass: boolean;
  allPass: boolean;
} {
  const step1Pass =
    result.step1.durableRowCount === result.step1.excerptCount &&
    result.step1.excerptCount > 0 &&
    result.step1.everyRowHasSourceUrl &&
    result.step1.everyRowHasSourceQuote &&
    result.step1.durableRowsAfterAbort === result.step1.abortAfterN &&
    result.step1.durableRowsAfterAbort > 0;

  const droppedFlagged = result.step2.droppedLedgerVerdict.violations
    .map((v) => `${v.cell.rowKind}[${v.cell.rowIndex}]`)
    .sort();
  const step2Pass =
    result.step2.droppedLedgerVerdict.blocked === true &&
    result.step2.droppedLedgerVerdict.violations.length === 2 &&
    droppedFlagged.join(",") === "anglesToTest[0],audienceTypes[0]" &&
    result.step2.droppedLedgerVerdict.violations.every(
      (v) => v.reason === "no-ledger-fact-for-source",
    ) &&
    result.step2.droppedLedgerVerdict.violations.every(
      (v) => v.cell.sectionId !== "positioningBuyerICP",
    ) &&
    result.step2.fullLedgerVerdict.blocked === false &&
    result.step2.fullLedgerVerdict.violations.length === 0;

  const step3Pass =
    result.step3.childrenComplete === 5 &&
    result.step3.parentStatus !== "complete" &&
    result.step3.corpusCountsTowardRollup === false &&
    result.step3.buyerIcpVerificationTier === "insufficient";

  return {
    step1Pass,
    step2Pass,
    step3Pass,
    allPass: step1Pass && step2Pass && step3Pass,
  };
}

function printSummary(
  result: SpineProofResult,
  verdict: ReturnType<typeof evaluateSpineProof>,
): void {
  const mark = (ok: boolean): string => (ok ? "PASS" : "FAIL");

  console.log("\n=== P0 SPINE PROOF (offline, $0, frozen fixture b0d12b45) ===");

  console.log(`\n[${mark(verdict.step1Pass)}] STEP 1 — P0.2 durability`);
  console.log(
    `  corpusToResearchInput excerpts:        ${result.step1.excerptCount}`,
  );
  console.log(
    `  durable research_facts rows:           ${result.step1.durableRowCount}`,
  );
  console.log(
    `  every row has non-empty source_url:    ${result.step1.everyRowHasSourceUrl}`,
  );
  console.log(
    `  every row has non-empty source_quote:  ${result.step1.everyRowHasSourceQuote}`,
  );
  console.log(
    `  mid-loop abort after N=${result.step1.abortAfterN} inserts -> durable rows: ${result.step1.durableRowsAfterAbort}`,
  );

  console.log(`\n[${mark(verdict.step2Pass)}] STEP 2 — P0.3 liar-catcher`);
  const flagged = result.step2.droppedLedgerVerdict.violations
    .map((v) => `${v.cell.rowKind}[${v.cell.rowIndex}]`)
    .sort();
  console.log(
    `  dropped-data corpus ledger -> blocked: ${result.step2.droppedLedgerVerdict.blocked} (${result.step2.droppedLedgerVerdict.violations.length} violations)`,
  );
  console.log(`  flagged grounded cells:                ${flagged.join(", ")}`);
  console.log(
    `  empty BuyerICP flagged:                ${result.step2.droppedLedgerVerdict.violations.some((v) => v.cell.sectionId === "positioningBuyerICP")} (must be false — honest gap, skipped)`,
  );
  console.log(
    `  full corpus ledger -> blocked:         ${result.step2.fullLedgerVerdict.blocked} (must be false — gate punishes unprovable grounding only)`,
  );

  console.log(`\n[${mark(verdict.step3Pass)}] STEP 3 — P0.1 rollup`);
  console.log(
    `  children_complete:                     ${result.step3.childrenComplete} (must be 5 — empty BuyerICP rejected)`,
  );
  console.log(
    `  parent status:                         ${result.step3.parentStatus} (must NOT be 'complete')`,
  );
  console.log(
    `  corpus zone counts_toward_rollup:      ${result.step3.corpusCountsTowardRollup} (must be false — allow-list)`,
  );
  console.log(
    `  BuyerICP verification_tier:            ${result.step3.buyerIcpVerificationTier}`,
  );

  console.log(
    `\n=== OVERALL: ${verdict.allPass ? "PASS — all three P0 pieces chain on the frozen fixture" : "FAIL"} ===\n`,
  );
}

async function main(): Promise<void> {
  const result = await runSpineProof();
  const verdict = evaluateSpineProof(result);
  printSummary(result, verdict);
  process.exit(verdict.allPass ? 0 : 1);
}

// Only auto-run when invoked directly (npx tsx scripts/zz-prove-p0-spine.ts),
// never on import from the test.
if (
  process.argv[1] !== undefined &&
  process.argv[1].endsWith("zz-prove-p0-spine.ts")
) {
  main().catch((error) => {
    console.error("[zz-prove-p0-spine] fatal:", error);
    process.exit(1);
  });
}
