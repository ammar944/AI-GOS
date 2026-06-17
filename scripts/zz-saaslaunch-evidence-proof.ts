#!/usr/bin/env tsx
// zz-saaslaunch-evidence-proof.ts — OFFLINE proof for the value-by-construction
// runtime work (BuyerICP zero-candidate acquisition ledger + paid-media row-level
// evidence pack). Live egress to DeepSeek / Perplexity / Supabase is firewalled in
// this sandbox and paid runs are forbidden, so this drives the SAME enrichment
// functions saveCompletedArtifact() calls on the real run-store path —
//   withBuyerICPAcquisitionLedger(...)  (Wave 2B/2C, BuyerICP commit)
//   normalizePaidMediaPlanBody(...) -> withPaidMediaEvidencePack(...) (paid-media commit)
// — over realistic persisted-shape fixtures, dumps a zz-dump-run-sections.mjs-shaped
// bundle, and prints the persisted ledger/sufficiency + per-row evidence packs. The
// real coverage-eval CLI then grades the dumped bundle in a separate process:
//   node scripts/zz-saaslaunch-coverage-eval.mjs --bundle <outDir> --json
//
// Usage: npx tsx scripts/zz-saaslaunch-evidence-proof.ts
// Writes: tmp/aigos-evidence-proof/ (_manifest.json + <zone>.json per section).
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ArtifactEnvelope } from "../src/lib/lab-engine/artifacts/artifact-envelope";
import { withBuyerICPAcquisitionLedger } from "../src/lib/lab-engine/agents/buyer-icp-acquisition-ledger";
import type { BuyerPersonaLookup } from "../src/lib/lab-engine/agents/buyer-persona-acquisition";
import { withPaidMediaEvidencePack } from "../src/lib/lab-engine/agents/paid-media-evidence-pack";
import { normalizePaidMediaPlanBody } from "../src/lib/lab-engine/artifacts/schemas/paid-media-plan";

const OUT_DIR = join(process.cwd(), "tmp", "aigos-evidence-proof");
const OBSERVED_AT = "2026-06-17T00:00:00.000Z";

function envelope(sectionId: string, body: unknown): ArtifactEnvelope {
  return {
    id: `proof-${sectionId}`,
    runId: "proof-run",
    sectionId,
    title: sectionId,
    body,
  } as unknown as ArtifactEnvelope;
}

// ---------------------------------------------------------------------------
// 1) Realistic committed upstream bodies (what the run-store holds at paid-media
//    commit time as researchInput.committedPositioningArtifacts).
// ---------------------------------------------------------------------------

const vocBody = {
  painLanguage: {
    prose: "Buyers describe onboarding drag and silent support as the switching trigger.",
    quotes: [
      {
        verbatimText:
          "Setup took weeks and support ghosted us during onboarding — we never got activated.",
        source: "g2",
        sourceUrl: "https://www.g2.com/products/acme/reviews/r1",
        painTheme: "onboarding friction",
        painIntensity: "high",
      },
      {
        verbatimText:
          "Reconciliation still eats three hours every week even after we switched.",
        source: "reddit",
        sourceUrl: "https://www.reddit.com/r/ops/comments/r2",
        painTheme: "manual reconciliation",
        painIntensity: "high",
      },
    ],
  },
  objections: {
    prose: "Price and switching cost dominate.",
    items: [
      {
        objectionText: "Migrating our existing reconciliation rules will break things.",
        category: "switching-cost",
        frequency: "recurring",
        howToHandle: "Show a guided migration with rollback.",
        sourceUrl: "https://www.g2.com/products/acme/reviews/r3",
      },
    ],
  },
};

const competitorBody = {
  competitorSet: {
    competitors: [
      {
        name: "Ramp",
        oneLinePositioning: "Finance automation that pays for itself.",
        verbatimHeroCopy: "Save time and money with automated reconciliation.",
      },
      {
        name: "Brex",
        oneLinePositioning: "The financial stack for growing companies.",
        verbatimHeroCopy: "Corporate cards and spend controls in one place.",
      },
    ],
  },
};

// BuyerICP that FAILED acquisition: the venue prepass ran but parsed zero named
// personas. personaReality.personas is empty; an evidenceGapReport is present.
const buyerIcpGapBody = {
  keyFindings: undefined,
  strategicInsight: {
    strategicVerdict:
      "The buyer is a hands-on finance operator, but no named individual cleared the evidence bar this run.",
    keyTension: {
      tension: "Operator-owned pain vs. committee-owned budget for reconciliation tooling.",
      side: "Lead with the operator who feels the weekly reconciliation drag.",
      costOfPosition: "Risks stalling on procurement when finance leadership is the real signer.",
    },
  },
  icpExistenceCheck: { prose: "Mid-market SaaS finance teams.", firmographicCuts: [] },
  personaReality: { prose: "No named persona cleared the bar this run.", personas: [] },
  awarenessDistribution: { prose: "Problem-aware.", levels: [] },
  buyingContext: { prose: "Triggered by a new finance hire.", triggers: [] },
  clusters: { prose: "RevOps communities.", venues: [] },
  evidenceGap: true as const,
  evidenceGapReport: {
    reason: "insufficient_named_buyer_personas",
    summary: "Venue prepass ran across all four surfaces but surfaced no named buyer.",
    foundNamedPersonaCount: 0,
    requiredNamedPersonaCount: 3,
    rejectedPersonaLabels: [],
    sourcingPlan: ["Re-run persona acquisition with broadened review-site and event queries."],
  },
};

// The venue lookups behind that empty result (what acquireBuyerPersonaCandidates
// returns as .lookups). Three distinct honest tool outcomes.
const buyerIcpLookups: BuyerPersonaLookup[] = [
  {
    attempt: 1,
    venue: "public_voices",
    question: "Find NAMED individuals in ICP buyer roles...",
    output: { type: "result", answer: "I could not find anyone reliable for this category." },
  },
  {
    attempt: 1,
    venue: "reviewer_identities",
    question: "Find NAMED reviewer identities on G2/Capterra...",
    output: { type: "gap", reason: "missing_credential" },
  },
  {
    attempt: 1,
    venue: "case_study_champions",
    question: "Find NAMED customer champions quoted in case studies...",
    output: null,
  },
];

// ---------------------------------------------------------------------------
// 2) Realistic paid-media RAW body. Synthesized rows: some trace to exact
//    upstream rows (VoC quote / competitor), one is an honest gap citing the
//    insufficient BuyerICP. Templated slots carry honest, residue-free fill.
// ---------------------------------------------------------------------------

const paidMediaRawBody = {
  campaignOverview: {
    prose: "Concentrate the $25,000/mo budget on a single high-intent angle proven by review pain, then scale.",
    platform: "Meta",
    monthlyBudget: "$25,000/mo",
    monthlyBudgetValue: 25000,
    monthlyBudgetProvenance: "user-supplied",
    dailySpend: "$833/day",
    dailySpendValue: 833,
    dailySpendProvenance: "derived",
    totalMonths: 4,
    phaseCount: 2,
    primaryKpi: "Marketing Qualified Leads",
  },
  campaignPhases: [
    {
      phaseName: "Phase 1 — Testing",
      monthsLabel: "Months 1-2",
      monthlyBudget: "$25,000/mo",
      monthlyBudgetValue: 25000,
      monthlyBudgetProvenance: "user-supplied",
      bullets: ["Test the onboarding-friction angle against the reconciliation-time angle."],
    },
  ],
  audienceTypes: [
    {
      slot: "01",
      archetype: "Honest gap (BuyerICP empty)",
      dailyBudget: "$833/day",
      dailyBudgetValue: 833,
      dailyBudgetProvenance: "derived",
      detail:
        "Evidence gap: BuyerICP surfaced no grounded persona this run, so no audience can be targeted yet.",
      sourceSection: "positioningBuyerICP",
      grounding: "Evidence gap: awaiting named-persona acquisition before an audience can be defined.",
    },
  ],
  anglesToTest: [
    {
      shortName: "Onboarding without the ghosting",
      description:
        "Lead with the onboarding friction and silent support pain that buyers cite when they switch.",
      angleType: "Problem-Solution",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "VoC pain language: setup took weeks and support went silent during onboarding.",
    },
    {
      shortName: "Win back your reconciliation hours",
      description: "Reframe the three weekly hours lost to manual reconciliation as recoverable.",
      angleType: "Problem-Solution",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "VoC pain language: reconciliation still eats three hours every week.",
    },
  ],
  creativeStrategy: { prose: "Static-led, hook on the named pain themes from VoC." },
  creativeFramework: [
    {
      label: "PST 1",
      angleType: "Problem-Solution",
      hook: "Still losing weeks to onboarding while support goes quiet?",
      executesAngle: "Onboarding without the ghosting",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "Hook drawn from the onboarding-friction pain quote.",
    },
    {
      label: "PST 2",
      angleType: "Problem-Solution",
      hook: "Three hours a week on reconciliation is three hours you never get back.",
      executesAngle: "Win back your reconciliation hours",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "Hook drawn from the manual-reconciliation pain quote.",
    },
    {
      label: "USP",
      angleType: "Differentiation",
      hook: "Migration with rollback — switch without breaking your reconciliation rules.",
      executesAngle: "Onboarding without the ghosting",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "Addresses the switching-cost objection about breaking reconciliation rules.",
    },
  ],
  funnelIdeation: [
    {
      rank: "1 - PRIMARY",
      name: "Pain-led lead magnet",
      description: "Reconciliation-time calculator gated behind an email opt-in.",
      whatItProves: "Whether the reconciliation pain is acute enough to trade an email.",
    },
  ],
  salesProcess: [
    {
      label: "Sales assets",
      assetType: "gap",
      url: "",
      note: "Client did not supply sales assets — upload your SOP, SDR opt-in flow, and Loom walkthrough.",
    },
  ],
  competitorMarketingInsights: [
    {
      competitor: "Ramp",
      messaging: "Ramp leans on time-and-money savings from automated reconciliation.",
      adPlatforms: "Meta, LinkedIn — monthly spend unknown",
      estSpendProvenance: "unknown",
      icp: "Mid-market finance teams",
      angles: "Cost savings, automation",
      positioning: "Finance automation that pays for itself",
      offer: "Free demo",
      sourceSection: "positioningCompetitorLandscape",
      grounding: "Ramp competitor teardown: hero copy promises automated reconciliation savings.",
    },
    {
      competitor: "Brex",
      messaging: "Brex bundles corporate cards with spend controls.",
      adPlatforms: "LinkedIn — monthly spend unknown",
      estSpendProvenance: "unknown",
      icp: "Growing companies",
      angles: "Consolidation",
      positioning: "The financial stack for growing companies",
      offer: "Free trial",
      sourceSection: "positioningCompetitorLandscape",
      grounding: "Brex competitor teardown: corporate cards plus spend controls in one place.",
    },
  ],
  competitorReviewInsights: [
    {
      complaint: "Onboarding drags for weeks and support goes quiet right when you need activation.",
      howWeLeverage: "Lead ad copy with white-glove onboarding and a named activation owner.",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "Mirrors the VoC onboarding-friction quote about support ghosting during setup.",
    },
    {
      complaint: "Manual reconciliation still costs hours every week even after switching.",
      howWeLeverage: "Quantify the recovered reconciliation hours in the hook.",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "Mirrors the VoC manual-reconciliation quote about three weekly hours.",
    },
    {
      complaint: "Switching feels risky because migration could break reconciliation rules.",
      howWeLeverage: "Show guided migration with rollback to defuse the switching objection.",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "Mirrors the VoC switching-cost objection about breaking reconciliation rules.",
    },
  ],
  channelSuggestions: [
    {
      channel: "Meta",
      recommendation: "Run the onboarding-friction angle as the primary Meta test.",
      verdict: "SCALE",
      sourceSection: "positioningVoiceOfCustomer",
    },
  ],
  projectedResults: [
    {
      targetIcp: "Mid-market SaaS finance teams",
      kpi: "Marketing Qualified Leads",
      kpiCostProvenance: "unknown",
      objective: "Phase 1 — Testing",
      durationLabel: "Months 1-2",
      phaseMonthlyBudgetValue: 25000,
      phaseMonthlyBudgetProvenance: "user-supplied",
      sourceSection: "gtmBrief",
    },
  ],
  kpis: [
    { metric: "MQLs", role: "Primary outcome", definition: "Marketing qualified leads that book a call." },
    { metric: "CPL", role: "Efficiency", definition: "Cost per qualified lead." },
  ],
  crossSectionInsight: [
    {
      tension: "VoC pain is sharp but BuyerICP could not name the buyer who feels it.",
      sourceSections: ["positioningVoiceOfCustomer", "positioningBuyerICP"],
      implicationForPlan: "Test the pain-led angle broadly until persona acquisition catches up.",
      clientBlindSpot: "Assuming the operator is the signer.",
      secondOrderRisk: "Procurement stalls if finance leadership is the real buyer.",
      contrarianInversion: "Target the signer, not the sufferer, if CPLs stay high.",
    },
  ],
};

function sufficientUpstream(zone: string, body: unknown) {
  return {
    zone,
    status: "complete",
    verification_tier: "sufficient",
    counts_toward_rollup: true,
    reviewTier: null,
    data: { body },
  };
}

async function main(): Promise<void> {
  // --- Run the REAL BuyerICP commit enrichment (zero candidates + lookups). ---
  const buyerIcpEnriched = withBuyerICPAcquisitionLedger({
    artifact: envelope("positioningBuyerICP", buyerIcpGapBody),
    candidates: [],
    lookups: buyerIcpLookups,
    observedAt: OBSERVED_AT,
  });
  const buyerReport = (buyerIcpEnriched.body as Record<string, any>).evidenceGapReport;

  // --- Run the REAL paid-media commit pipeline: normalize -> evidence pack. ---
  const normalizedPaidBody = normalizePaidMediaPlanBody(paidMediaRawBody);
  const paidEnriched = withPaidMediaEvidencePack({
    artifact: envelope("positioningPaidMediaPlan", normalizedPaidBody),
    committedArtifacts: {
      positioningVoiceOfCustomer: { body: vocBody },
      positioningCompetitorLandscape: { body: competitorBody },
      positioningBuyerICP: { body: buyerIcpGapBody },
    },
  });
  const paidBody = paidEnriched.body as Record<string, any>;

  // --- Write the bundle (zz-dump-run-sections.mjs shape). ---
  await mkdir(OUT_DIR, { recursive: true });
  const sections = [
    {
      zone: "positioningBuyerICP",
      status: "complete",
      verification_tier: "insufficient",
      counts_toward_rollup: true,
      reviewTier: null,
      data: { body: buyerIcpEnriched.body },
    },
    sufficientUpstream("positioningVoiceOfCustomer", vocBody),
    sufficientUpstream("positioningCompetitorLandscape", competitorBody),
    sufficientUpstream("positioningMarketCategory", { keyFindings: [] }),
    sufficientUpstream("positioningDemandIntent", { keyFindings: [] }),
    sufficientUpstream("positioningOfferDiagnostic", { keyFindings: [] }),
    {
      zone: "positioningPaidMediaPlan",
      status: "complete",
      verification_tier: "sufficient",
      counts_toward_rollup: true,
      reviewTier: null,
      data: { body: paidEnriched.body },
    },
  ];
  for (const section of sections) {
    await writeFile(join(OUT_DIR, `${section.zone}.json`), JSON.stringify(section.data, null, 2), "utf8");
  }
  await writeFile(
    join(OUT_DIR, "_manifest.json"),
    JSON.stringify(
      {
        run_id: "proof-run",
        artifact_id: "proof-artifact",
        status: "complete",
        sections: sections.map(({ data: _data, ...meta }) => meta),
      },
      null,
      2,
    ),
    "utf8",
  );

  // --- Print the proof report. ---
  const line = "=".repeat(78);
  console.log(`\n${line}`);
  console.log("  OFFLINE EVIDENCE PROOF — real enrichment functions, persisted-shape bundle");
  console.log(`  Blocker: live DeepSeek/Perplexity/Supabase egress is firewalled in this sandbox;`);
  console.log(`           paid live runs are forbidden. This drives the SAME functions`);
  console.log(`           saveCompletedArtifact() calls on the run-store path.`);
  console.log(line);

  console.log("\n[WP1] BuyerICP zero-candidate acquisition ledger (was: silently omitted)");
  console.log(`  evidenceGapReport.sufficiency = ${JSON.stringify(buyerReport.sufficiency)}`);
  console.log(`  acquisitionLedger rows (${buyerReport.acquisitionLedger.length}, all promotionStatus=not_applicable):`);
  for (const row of buyerReport.acquisitionLedger) {
    console.log(`    · source=${row.source}  promotion=${row.promotionStatus}  toolGapReason=${row.toolGapReason}  query="${row.query.slice(0, 48)}…"`);
  }

  console.log("\n[WP2] Paid-media synthesized rows — deterministic row-level evidence pack");
  const showPack = (label: string, row: Record<string, any>): void => {
    const pack = row.evidencePack;
    if (!pack) {
      console.log(`  ${label}: (honest gap row — evidencePack intentionally omitted; eval WARNs)`);
      return;
    }
    if (pack.status === "grounded") {
      console.log(`  ${label}: GROUNDED -> ${pack.refs.length} ref(s)`);
      for (const ref of pack.refs) {
        console.log(`      ↳ ${ref.sourceSection} / ${ref.evidenceKind} @ ${ref.locator}`);
        console.log(`        excerpt: "${ref.excerpt.slice(0, 80)}…"`);
      }
    } else {
      console.log(`  ${label}: GAP — ${pack.note}`);
    }
  };
  showPack("audienceTypes[0] (cites insufficient BuyerICP)", paidBody.audienceTypes[0]);
  paidBody.competitorReviewInsights.forEach((row: Record<string, any>, i: number) =>
    showPack(`competitorReviewInsights[${i}] (cites VoC)`, row),
  );
  paidBody.competitorMarketingInsights.forEach((row: Record<string, any>, i: number) =>
    showPack(`competitorMarketingInsights[${i}] (cites Competitor)`, row),
  );
  paidBody.anglesToTest.forEach((row: Record<string, any>, i: number) =>
    showPack(`anglesToTest[${i}] (cites VoC)`, row),
  );

  console.log(`\n  Bundle written to: ${OUT_DIR}`);
  console.log("  Grade it with the REAL eval CLI:");
  console.log(`    node scripts/zz-saaslaunch-coverage-eval.mjs --bundle ${OUT_DIR}`);
  console.log(`${line}\n`);
}

main().catch((error) => {
  console.error("evidence proof failed:", error);
  process.exit(1);
});
