#!/usr/bin/env tsx
/**
 * zz-verify-idk-fix.ts — verification driver for the "idk" poisoning fix.
 *
 * PART 1 (no API, instant): proves corpusToResearchInput neutralizes "idk"
 *   non-answers. A POISONED brief ("idk idk" competitors, "idk" budget) must
 *   yield NO competitor seeds and NO monthly ad budget; a CLEAN brief (real
 *   competitors + real budget) must yield 3 seeds + the budget. Exits non-zero
 *   on any failure.
 *
 * PART 1 also writes the CLEAN ResearchInput to tmp/airtable-clean-input.json,
 *   which the operator then feeds to the LIVE section run:
 *     npx tsx scripts/zz-run-one-section.ts \
 *       --section positioningCompetitorLandscape \
 *       --fixture tmp/airtable-clean-input.json
 *   (see docs/handoffs/2026-06-09-idk-fix-live-verify-codex.md)
 *
 * Usage: npx tsx scripts/zz-verify-idk-fix.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { researchInputSchema } from "../src/lib/lab-engine/artifacts/artifact-envelope";
import { corpusToResearchInput } from "../src/lib/research-v2/corpus-to-research-input";

const observedAt = new Date("2026-06-09T12:00:00.000Z");

// Compact-but-valid Airtable corpus so the live section has something to draft.
const airtableCorpus = {
  researchSummary:
    "Airtable is a connected apps platform that lets non-technical and enterprise teams build apps, automate workflows, and collaborate on a shared relational data layer without traditional software development.",
  sources: [
    { title: "Airtable homepage", url: "https://www.airtable.com/" },
    { title: "Airtable pricing", url: "https://www.airtable.com/pricing" },
    {
      title: "What is Airtable",
      url: "https://www.airtable.com/guides/start/what-is-airtable",
    },
  ],
  evidence: [
    {
      claim:
        "Airtable combines a relational database with a spreadsheet interface so teams can build apps on shared data.",
      quote:
        "Teams build apps on shared data, automate work, and coordinate operational workflows without a dedicated engineering team.",
      source: "Airtable homepage",
      url: "https://www.airtable.com/",
    },
    {
      claim: "Airtable sells tiered SaaS plans from self-serve to enterprise.",
      quote:
        "Plans scale from free and Team to Business and Enterprise Scale for the largest organizations.",
      source: "Airtable pricing",
      url: "https://www.airtable.com/pricing",
    },
    {
      claim:
        "Airtable positions as a rapid application development platform used by individuals through large enterprises.",
      quote:
        "A relational database with a spreadsheet interface that anyone can use to build custom apps.",
      source: "What is Airtable",
      url: "https://www.airtable.com/guides/start/what-is-airtable",
    },
  ],
};

function buildInput(opts: {
  topCompetitorsCorpus: string | null;
  topCompetitorsBrief?: string;
  monthlyAdBudget?: string;
}): unknown {
  return corpusToResearchInput({
    runId: "zz-airtable-verify",
    deepResearchProgramData: {
      corpus: airtableCorpus,
      onboardingFields: {
        companyName: { value: "Airtable" },
        industryVertical: { value: "Collaborative work management" },
        productDescription: {
          value:
            "Airtable helps operations teams build flexible apps, track shared data, and automate workflows.",
        },
        primaryIcpDescription: {
          value:
            "Operations leaders who need custom workflow software without a long engineering queue.",
        },
        topCompetitors: { value: opts.topCompetitorsCorpus },
      },
    },
    onboardingData: {
      websiteUrl: "https://www.airtable.com/",
      primaryGoal: "Clarify the strongest paid-media positioning angle.",
      ...(opts.topCompetitorsBrief !== undefined
        ? { topCompetitors: opts.topCompetitorsBrief }
        : {}),
      ...(opts.monthlyAdBudget !== undefined
        ? { monthlyAdBudget: opts.monthlyAdBudget }
        : {}),
    },
    now: () => observedAt,
  });
}

type ParsedInput = ReturnType<typeof researchInputSchema.parse>;

const failures: string[] = [];
function check(label: string, ok: boolean, detail: string): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!ok) failures.push(label);
}

async function main(): Promise<void> {
  // POISONED: corpus has no competitors, user typed "idk idk" / "idk".
  const poisoned = researchInputSchema.parse(
    buildInput({
      topCompetitorsCorpus: null,
      topCompetitorsBrief: "idk idk",
      monthlyAdBudget: "idk",
    }),
  ) as ParsedInput;

  // CLEAN: corpus has no competitors, user supplied real competitors + budget.
  const clean = researchInputSchema.parse(
    buildInput({
      topCompetitorsCorpus: null,
      topCompetitorsBrief: "Notion, monday.com, ClickUp",
      monthlyAdBudget: "$25,000",
    }),
  ) as ParsedInput;

  console.log("\n=== FIX 1 — non-answer normalization (no API) ===");
  const poisonedSeeds = poisoned.competitorSeeds ?? [];
  check(
    'poisoned "idk idk" topCompetitors -> NO competitor seeds',
    poisonedSeeds.length === 0,
    `competitorSeeds=${JSON.stringify(poisonedSeeds.map((s) => s.name))}`,
  );
  check(
    'poisoned "idk" monthlyAdBudget -> NO budget',
    poisoned.onboarding.economics?.monthlyAdBudget === undefined,
    `monthlyAdBudget=${JSON.stringify(poisoned.onboarding.economics?.monthlyAdBudget)}`,
  );

  const cleanSeeds = clean.competitorSeeds ?? [];
  check(
    "clean brief -> 3 real competitor seeds",
    cleanSeeds.length === 3,
    `competitorSeeds=${JSON.stringify(cleanSeeds.map((s) => s.name))}`,
  );
  check(
    "clean brief -> budget preserved",
    clean.onboarding.economics?.monthlyAdBudget === "$25,000",
    `monthlyAdBudget=${JSON.stringify(clean.onboarding.economics?.monthlyAdBudget)}`,
  );

  // Dump the CLEAN input for the live section run.
  const outDir = join(process.cwd(), "tmp");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "airtable-clean-input.json");
  await writeFile(outPath, JSON.stringify(clean, null, 2), "utf8");
  console.log(`\nWrote clean ResearchInput -> ${outPath}`);
  console.log(
    `  competitorSeeds: ${cleanSeeds.map((s) => s.name).join(", ")}`,
  );

  if (failures.length > 0) {
    console.error(`\nFIX-1 VERIFICATION FAILED: ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("\nFIX-1 VERIFICATION PASSED. Proceed to the live section run.");
}

main().catch((err) => {
  console.error("[zz-verify-idk-fix] FATAL", err);
  process.exit(1);
});
