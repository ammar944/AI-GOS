/**
 * research-market - deterministic pipeline tail
 *
 * Usage:
 *   npx tsx scripts/orchestrate.ts <run_dir>
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ResearchMarketInputSchema, type GtmBriefField, type ResearchMarketInput } from "../schemas/input";
import { ResearchMarketOutputSchema, type ResearchMarketOutput } from "../schemas/output";

function skillRoot(): string {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}

function runStep(label: string, args: string[]): void {
  process.stdout.write(`\n== ${label} ==\n`);
  const result = spawnSync("npx", ["tsx", ...args], {
    stdio: "inherit",
    cwd: skillRoot(),
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`[orchestrate] ${label} failed with exit ${result.status}`);
  }
}

function readJson(pathname: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(pathname, "utf-8")) as unknown;
  } catch (error: unknown) {
    throw new Error(
      `[orchestrate] JSON parse failed for ${pathname}: ${(error as Error).message}`,
    );
  }
}

function readInput(runDir: string): ResearchMarketInput {
  const inputPath = path.join(runDir, "input.json");
  if (!fs.existsSync(inputPath)) {
    throw new Error(`[orchestrate] missing input.json: ${inputPath}`);
  }

  const parsed = ResearchMarketInputSchema.safeParse(readJson(inputPath));
  if (!parsed.success) {
    throw new Error(
      `[orchestrate] input.json schema invalid: ${JSON.stringify(parsed.error.issues, null, 2)}`,
    );
  }

  return parsed.data;
}

function fieldValue(field: GtmBriefField | undefined): string | null {
  const value = field?.value.trim();
  return value && value.length > 0 ? value : null;
}

function normalizeUrl(candidate: string | null): string {
  if (!candidate) return "https://example.com";
  const trimmed = candidate.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function buildSeedOutput(input: ResearchMarketInput, generatedAt: string): ResearchMarketOutput {
  const fields = input.briefSnapshot.fields;
  const companyName = fieldValue(fields.companyName) ?? "unknown";
  const companyUrl = normalizeUrl(fieldValue(fields.companyUrl));
  const category =
    input.focus?.categoryOverride ??
    fieldValue(fields.category) ??
    fieldValue(fields.market) ??
    fieldValue(fields.industryVertical) ??
    "unknown";
  const geography = input.focus?.geography ?? fieldValue(fields.geography) ?? undefined;
  const buyerContext =
    fieldValue(fields.primaryIcpDescription) ??
    fieldValue(fields.targetCustomer) ??
    undefined;
  const source = {
    source_url: companyUrl,
    retrieved_at: generatedAt,
    source_title: `${companyName} locked GTM Brief`,
    publisher: "AIGOS",
  };
  const claim = {
    claim: `Locked GTM Brief frames ${companyName} in ${category}.`,
    evidence_quote: `category=${category}`,
    ...source,
  };

  return ResearchMarketOutputSchema.parse({
    run_id: input.run_id,
    brief_snapshot_id: input.briefSnapshot.snapshotId,
    source_company_name: companyName,
    source_company: {
      name: companyName,
      url: companyUrl,
      declared_category: fieldValue(fields.category) ?? undefined,
      declared_market: fieldValue(fields.market) ?? undefined,
      geography,
    },
    generated_at: generatedAt,
    tool_calls_used: [],
    summary: `Scaffold market artifact for ${companyName}. Agent collection has not supplied market evidence yet.`,
    keyFindings: [`Locked GTM Brief category: ${category}`],
    evidenceIds: [companyUrl],
    assumptions: [
      "This seed output must be replaced or enriched by collector fragments before production use.",
    ],
    market_scope: {
      subject_company: companyName,
      category,
      geography,
      buyer_context: buyerContext,
      excluded_scopes: [],
    },
    category_definition: {
      category_name: category,
      definition: `Brief-provided category for ${companyName}.`,
      adjacent_categories: [],
      ...claim,
    },
    market_size_signals: [],
    category_maturity: {
      maturity: "unknown",
      observable_signals: [],
      ...claim,
    },
    timing_signals: [],
    demand_drivers: [],
    buying_triggers: [],
    adoption_barriers: [],
    category_pain_points: {
      primary: [],
      secondary: [],
      triggers: [],
    },
    competitive_intensity: {
      intensity: "unknown",
      observable_signals: [],
      caveats: ["research-competitor owns direct competitor verification."],
    },
    opportunity_candidates: [],
    source_gaps: [
      {
        topic: "market_size",
        reason: "No live market sizing evidence has been collected yet.",
        attempted_queries: [],
        needed_evidence: [
          "direct SAM report, buyer-count proxy, company-count proxy, or spend proxy",
        ],
      },
    ],
    categorySnapshot: {
      category,
      marketMaturity: "unknown",
      awarenessLevel: "unknown",
      buyingBehavior: "unknown",
    },
    painPoints: {
      primary: [],
      secondary: [],
      triggers: [],
    },
    marketDynamics: {
      demandDrivers: [],
      buyingTriggers: [],
      barriersToPurchase: [],
    },
    trendSignals: [],
    messagingOpportunities: {
      summaryRecommendations: [],
    },
    marketOpportunities: [],
  });
}

function ensureOutput(runDir: string, input: ResearchMarketInput): string {
  const outputPath = path.join(runDir, "output.json");
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  const seed = buildSeedOutput(input, new Date().toISOString());
  fs.writeFileSync(outputPath, `${JSON.stringify(seed, null, 2)}\n`);
  process.stdout.write(`[orchestrate] wrote scaffold seed ${outputPath}\n`);
  return outputPath;
}

function main(): void {
  const runDir = process.argv[2];
  if (!runDir) {
    process.stderr.write("Usage: orchestrate.ts <run_dir>\n");
    process.exit(2);
  }

  try {
    if (!fs.existsSync(runDir)) {
      throw new Error(`[orchestrate] run dir missing: ${runDir}`);
    }

    const input = readInput(runDir);
    const outputPath = ensureOutput(runDir, input);
    const fragmentsDir = path.join(runDir, "fragments");
    if (fs.existsSync(fragmentsDir)) {
      runStep("merge fragments", [
        "scripts/merge-fragments.ts",
        outputPath,
        fragmentsDir,
      ]);
    } else {
      process.stdout.write(`[orchestrate] no fragments dir: ${fragmentsDir}\n`);
    }

    runStep("validate", ["scripts/validate.ts", outputPath]);
    runStep("sanity check", [
      "scripts/sanity-check.ts",
      outputPath,
      ...(process.env.ALLOW_SUSPECT === "1" ? ["--allow-suspect"] : []),
    ]);
    runStep("generate report", [
      "scripts/generate-report.ts",
      outputPath,
      path.join(runDir, "report.html"),
    ]);
    process.stdout.write(`[orchestrate] complete: ${outputPath}\n`);
  } catch (error: unknown) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}

main();
